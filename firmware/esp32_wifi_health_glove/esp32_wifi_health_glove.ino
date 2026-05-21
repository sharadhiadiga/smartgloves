/**
 * Smart Glove — Production WiFi IoT Firmware
 * Architecture: Sensors → ESP32 → HTTPS POST → Render Backend → Mobile Dashboard
 *
 * Required libraries (Arduino Library Manager):
 *   - WiFiManager by tzapu
 *   - ArduinoJson by Benoit Blanchon
 *   - Adafruit TMP117
 *   - SparkFun MAX3010x Pulse and Heart Rate Sensor (MAX30102)
 *   - Wire (built-in)
 *
 * First boot: connect phone to AP "HealthGlove_Setup" → captive portal → save WiFi.
 */

#include <WiFi.h>
#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <time.h>

#include <Adafruit_TMP117.h>
#include <MAX30105.h>
#include "heartRate.h"

// ===================== CONFIG =====================
static const char* BACKEND_VITALS_URL =
  "https://smartgloves-backend.onrender.com/api/vitals";

static const char* AP_PORTAL_NAME = "HealthGlove_Setup";
static const char* DEFAULT_PATIENT_ID = "P001";
static const char* DEFAULT_DEVICE_ID = "ESP32_001";

static const uint32_t SENSOR_INTERVAL_MS = 1000;
static const uint32_t POST_INTERVAL_MS = 1000;
static const uint32_t WIFI_CHECK_MS = 10000;
static const uint32_t HTTP_TIMEOUT_MS = 20000;
static const int MAX_HTTP_RETRIES = 3;

// I2C
static const int I2C_SDA = 21;
static const int I2C_SCL = 22;

// GSR analog
static const int PIN_GSR = 34;

// LEDs (active HIGH)
static const int LED_WIFI = 2;
static const int LED_CONNECTED = 4;
static const int LED_SENDING = 16;
static const int LED_ERROR = 17;

// ===================== GLOBALS =====================
Adafruit_TMP117 tmp117;
MAX30105 particleSensor;
WiFiClientSecure secureClient;

bool tmp117Ok = false;
bool max30102Ok = false;

uint32_t lastSensorMs = 0;
uint32_t lastPostMs = 0;
uint32_t lastWifiCheckMs = 0;

struct VitalsSnapshot {
  float temperature = 36.5f;
  int heartRate = 75;
  int spo2 = 98;
  int gsr = 1200;
  String temperatureCondition = "Normal";
  String heartRateCondition = "Normal";
  String spo2Condition = "Normal";
  String gsrCondition = "Normal";
};

VitalsSnapshot currentVitals;
byte rates[100];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute = 0;
int beatAvg = 0;

// ===================== LED HELPERS =====================
void ledAllOff() {
  digitalWrite(LED_WIFI, LOW);
  digitalWrite(LED_CONNECTED, LOW);
  digitalWrite(LED_SENDING, LOW);
  digitalWrite(LED_ERROR, LOW);
}

void ledWifiConnecting() {
  ledAllOff();
  digitalWrite(LED_WIFI, HIGH);
}

void ledConnectedOk() {
  ledAllOff();
  digitalWrite(LED_CONNECTED, HIGH);
}

void ledSending() {
  digitalWrite(LED_SENDING, HIGH);
}

void ledBackendError() {
  digitalWrite(LED_ERROR, HIGH);
}

// ===================== CONDITION LABELS =====================
String conditionTemperature(float t) {
  if (t <= 0.0f) return "Invalid";
  if (t >= 39.0f) return "Critical";
  if (t >= 38.0f) return "High";
  if (t >= 37.5f) return "Moderate";
  return "Normal";
}

String conditionHeartRate(int hr) {
  if (hr == 0) return "Invalid";
  if (hr >= 140) return "Critical";
  if (hr >= 120) return "High";
  if (hr >= 100) return "Moderate";
  if (hr >= 60) return "Normal";
  return "Moderate";
}

String conditionSpo2(int spo2) {
  if (spo2 == 0) return "Invalid";
  if (spo2 < 90) return "Critical";
  if (spo2 <= 93) return "High";
  if (spo2 <= 95) return "Moderate";
  return "Normal";
}

String conditionGsr(int gsr) {
  if (gsr <= 10) return "Invalid";
  if (gsr >= 3000) return "Critical";
  if (gsr >= 2500) return "High";
  if (gsr >= 2000) return "Moderate";
  return "Normal";
}

// ===================== WiFiManager =====================
bool connectWiFi() {
  Serial.println("[WiFi] Starting WiFiManager...");
  ledWifiConnecting();

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  wm.setConnectTimeout(30);
  wm.setCaptivePortalEnable(true);

  bool ok = wm.autoConnect(AP_PORTAL_NAME);
  if (!ok) {
    Serial.println("[WiFi] Portal timeout — restarting");
    ledBackendError();
    delay(2000);
    ESP.restart();
    return false;
  }

  Serial.print("[WiFi] Connected. IP: ");
  Serial.println(WiFi.localIP());
  ledConnectedOk();

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("[NTP] Sync requested");
  return true;
}

void reconnectIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("[WiFi] Disconnected — reconnecting");
  ledWifiConnecting();
  WiFi.reconnect();
  delay(2000);
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnect failed — full portal");
    connectWiFi();
  } else {
    ledConnectedOk();
  }
}

String isoTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 500)) {
    return String(millis());
  }
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// ===================== SENSORS =====================
bool initSensors() {
  Wire.begin(I2C_SDA, I2C_SCL);

  tmp117Ok = tmp117.begin(0x48, &Wire);
  Serial.println(tmp117Ok ? "[TMP117] OK" : "[TMP117] FAIL");

  max30102Ok = particleSensor.begin(Wire, I2C_SPEED_FAST);
  if (max30102Ok) {
    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeIR(0x0A);
    Serial.println("[MAX30102] OK");
  } else {
    Serial.println("[MAX30102] FAIL");
  }

  pinMode(PIN_GSR, INPUT);
  analogSetAttenuation(ADC_11db);
  return tmp117Ok || max30102Ok;
}

void readSensors() {
  if (tmp117Ok) {
    sensors_event_t ev;
    tmp117.getEvent(&ev);
    currentVitals.temperature = ev.temperature;
  } else {
    currentVitals.temperature = 36.5f;
  }

  int gsrRaw = analogRead(PIN_GSR);
  currentVitals.gsr = map(gsrRaw, 0, 4095, 400, 3000);

  if (max30102Ok) {
    long ir = particleSensor.getIR();
    if (checkForBeat(ir)) {
      long delta = millis() - lastBeat;
      lastBeat = millis();
      beatsPerMinute = 60.0 / (delta / 1000.0);
      if (beatsPerMinute < 200 && beatsPerMinute > 30) {
        rates[rateSpot++] = (byte)beatsPerMinute;
        rateSpot %= sizeof(rates);
        beatAvg = 0;
        for (byte i = 0; i < sizeof(rates); i++) beatAvg += rates[i];
        beatAvg /= sizeof(rates);
        currentVitals.heartRate = beatAvg;
      }
    }
    float ratio = (float)particleSensor.getRed() / (float)(particleSensor.getIR() + 1);
    int estSpo2 = (int)(110.0f - 25.0f * ratio);
    estSpo2 = constrain(estSpo2, 85, 100);
    if (ir > 50000) currentVitals.spo2 = estSpo2;
  }

  currentVitals.temperatureCondition = conditionTemperature(currentVitals.temperature);
  currentVitals.heartRateCondition = conditionHeartRate(currentVitals.heartRate);
  currentVitals.spo2Condition = conditionSpo2(currentVitals.spo2);
  currentVitals.gsrCondition = conditionGsr(currentVitals.gsr);

  Serial.printf("[Sensors] T=%.2f HR=%d SpO2=%d GSR=%d\n",
                currentVitals.temperature,
                currentVitals.heartRate,
                currentVitals.spo2,
                currentVitals.gsr);
}

// ===================== HTTPS POST =====================
bool sendData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTPS] WiFi down — skip send");
    return false;
  }

  StaticJsonDocument<640> doc;
  doc["patientId"] = DEFAULT_PATIENT_ID;
  doc["deviceId"] = DEFAULT_DEVICE_ID;
  doc["temperature"] = roundf(currentVitals.temperature * 100.0f) / 100.0f;
  doc["temperatureCondition"] = currentVitals.temperatureCondition;
  doc["heartRate"] = currentVitals.heartRate;
  doc["heartRateCondition"] = currentVitals.heartRateCondition;
  doc["spo2"] = currentVitals.spo2;
  doc["spo2Condition"] = currentVitals.spo2Condition;
  doc["gsr"] = currentVitals.gsr;
  doc["gsrCondition"] = currentVitals.gsrCondition;
  doc["timestamp"] = isoTimestamp();

  String body;
  serializeJson(doc, body);
  Serial.println("[HTTPS] Payload:");
  Serial.println(body);

  secureClient.setInsecure();
  bool ok = false;

  for (int attempt = 1; attempt <= MAX_HTTP_RETRIES; attempt++) {
    HTTPClient http;
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.setReuse(false);

    ledSending();
    Serial.printf("[HTTPS] POST %d/%d → %s\n", attempt, MAX_HTTP_RETRIES, BACKEND_VITALS_URL);

    if (!http.begin(secureClient, BACKEND_VITALS_URL)) {
      Serial.println("[HTTPS] begin() failed");
      ledBackendError();
      delay(400 * attempt);
      continue;
    }

    http.addHeader("Content-Type", "application/json");
    int code = http.POST(body);
    String response = http.getString();
    http.end();

    Serial.printf("[HTTPS] Response: %d\n", code);
    if (response.length() > 0) Serial.println(response);

    if (code > 0 && code < 300) {
      ok = true;
      ledConnectedOk();
      break;
    }

    ledBackendError();
    Serial.println("[HTTPS] retry...");
    delay(800 * attempt);
  }

  return ok;
}

// ===================== SETUP / LOOP =====================
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== Smart Glove WiFi IoT ===");

  pinMode(LED_WIFI, OUTPUT);
  pinMode(LED_CONNECTED, OUTPUT);
  pinMode(LED_SENDING, OUTPUT);
  pinMode(LED_ERROR, OUTPUT);
  ledAllOff();

  initSensors();
  connectWiFi();

  lastSensorMs = millis();
  lastPostMs = millis();
  lastWifiCheckMs = millis();
}

void loop() {
  const uint32_t now = millis();

  if (now - lastWifiCheckMs >= WIFI_CHECK_MS) {
    lastWifiCheckMs = now;
    reconnectIfNeeded();
  }

  if (now - lastSensorMs >= SENSOR_INTERVAL_MS) {
    lastSensorMs = now;
    readSensors();
  }

  if (now - lastPostMs >= POST_INTERVAL_MS) {
    lastPostMs = now;
    if (!sendData()) {
      reconnectIfNeeded();
    }
  }

  yield();
}
