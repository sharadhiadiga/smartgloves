# ESP32 → Render (HTTPS)

## Configure

1. Set `WIFI_SSID` and `WIFI_PASSWORD` in `esp32_wifi_health_glove.ino`
2. Backend URL is preset: `https://smartgloves-backend.onrender.com/api/data`
3. Upload with Arduino IDE (ESP32 board + ArduinoJson)

## Serial monitor (115200)

Expect:

- `[WiFi] Connected`
- `[HTTPS] Response code: 200` (first request after cold start may take 15–30s)

## Libraries

- WiFi, WiFiClientSecure, HTTPClient (built-in)
- ArduinoJson 6.x
