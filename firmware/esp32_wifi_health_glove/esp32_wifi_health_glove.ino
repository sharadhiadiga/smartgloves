/**
 * Smart Glove — WiFi HTTPS sensor uplink (Render cloud)
 * ESP32 → WiFi → POST https://smartgloves-backend.onrender.com/api/data
 *
 * Libraries: WiFi, WiFiClientSecure, HTTPClient, ArduinoJson (v6+)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============ CONFIG — set before upload ============
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

/** Cloud backend (Render) — full POST URL, HTTPS port 443 */
const char* BACKEND_DATA_URL =
  "https://smartgloves-backend.onrender.com/api/data";

const char* PATIENT_ID = "P001";
const unsigned long POST_INTERVAL_MS = 1500;
const int MAX_HTTP_RETRIES = 3;
const unsigned long HTTP_TIMEOUT_MS = 15000;  // Render cold start can be slow

// ============ Sensor pins (adjust for your wiring) ============
const int PIN_TEMP = 34;
const int PIN_HR   = 35;
const int PIN_SPO2 = 32;
const int PIN_GSR  = 33;

// ============ State ============
unsigned long lastPostMs = 0;
unsigned long lastWifiCheckMs = 0;
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 10000;

WiFiClientSecure secureClient;

// ---------- Condition helpers (match backend thresholds) ----------
String conditionForTemperature(float t) {
  if (t >= 39.5f || t <= 35.0f) return "Critical";
  if (t >= 38.0f || t < 36.0f) return "High";
  if (t >= 37.0f || t < 36.5f) return "Moderate";
  return "Low";
}

String conditionForHeartRate(int hr) {
  if (hr >= 140 || hr <= 45) return "Critical";
  if (hr >= 115 || hr < 55) return "High";
  if (hr >= 100 || hr < 60) return "Moderate";
  return "Low";
}

String conditionForSpo2(int spo2) {
  if (spo2 < 88) return "Critical";
  if (spo2 < 94) return "High";
  if (spo2 < 97) return "Moderate";
  return "Low";
}

String conditionForGsr(int gsr) {
  if (gsr >= 2400) return "Critical";
  if (gsr >= 1700) return "High";
  if (gsr >= 1200) return "Moderate";
  return "Low";
}

float readTemperatureC() {
  int raw = analogRead(PIN_TEMP);
  float voltage = (raw / 4095.0f) * 3.3f;
  return 25.0f + (voltage - 0.5f) * 100.0f;
}

int readHeartRate() {
  return map(analogRead(PIN_HR), 0, 4095, 60, 120);
}

int readSpo2() {
  return map(analogRead(PIN_SPO2), 0, 4095, 92, 99);
}

int readGsr() {
  return map(analogRead(PIN_GSR), 0, 4095, 800, 2800);
}

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.println("[WiFi] Connecting...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Connected. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("[WiFi] Connection failed");
  return false;
}

bool postSensorDataWithRetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTPS] Skipped — WiFi not connected");
    return false;
  }

  float temperature = readTemperatureC();
  int heartRate = readHeartRate();
  int spo2 = readSpo2();
  int gsr = readGsr();

  StaticJsonDocument<512> doc;
  doc["patientId"] = PATIENT_ID;
  doc["temperature"] = temperature;
  doc["temperatureCondition"] = conditionForTemperature(temperature);
  doc["heartRate"] = heartRate;
  doc["heartRateCondition"] = conditionForHeartRate(heartRate);
  doc["spo2"] = spo2;
  doc["spo2Condition"] = conditionForSpo2(spo2);
  doc["gsr"] = gsr;
  doc["gsrCondition"] = conditionForGsr(gsr);

  String jsonBody;
  serializeJson(doc, jsonBody);
  Serial.println("[HTTPS] Sending JSON:");
  Serial.println(jsonBody);

  bool success = false;

  for (int attempt = 1; attempt <= MAX_HTTP_RETRIES; attempt++) {
    HTTPClient http;
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.setReuse(false);

    // TLS to Render — skip cert store (typical for ESP32 + cloud hosts)
    secureClient.setInsecure();

    Serial.printf("[HTTPS] POST attempt %d/%d → %s\n", attempt, MAX_HTTP_RETRIES, BACKEND_DATA_URL);

    if (!http.begin(secureClient, BACKEND_DATA_URL)) {
      Serial.println("[HTTPS] http.begin failed");
      delay(500 * attempt);
      continue;
    }

    http.addHeader("Content-Type", "application/json");

    int httpCode = http.POST(jsonBody);
    String response = http.getString();
    http.end();

    Serial.printf("[HTTPS] Response code: %d\n", httpCode);
    if (response.length() > 0) {
      Serial.println("[HTTPS] Response body:");
      Serial.println(response);
    }

    if (httpCode > 0 && httpCode < 300) {
      success = true;
      break;
    }

    Serial.println("[HTTPS] Request failed, retrying...");
    delay(1000 * attempt);
  }

  return success;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Smart Glove WiFi → Render (HTTPS) ===");
  Serial.println(BACKEND_DATA_URL);

  pinMode(PIN_TEMP, INPUT);
  pinMode(PIN_HR, INPUT);
  pinMode(PIN_SPO2, INPUT);
  pinMode(PIN_GSR, INPUT);

  connectWiFi();
  lastPostMs = millis();
  lastWifiCheckMs = millis();
}

void loop() {
  unsigned long now = millis();

  if (now - lastWifiCheckMs >= WIFI_RECONNECT_INTERVAL_MS) {
    lastWifiCheckMs = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Lost connection — reconnecting");
      WiFi.disconnect();
      connectWiFi();
    }
  }

  if (now - lastPostMs >= POST_INTERVAL_MS) {
    lastPostMs = now;
    if (!postSensorDataWithRetry()) {
      if (WiFi.status() != WL_CONNECTED) {
        connectWiFi();
      }
    }
  }

  delay(10);
}
