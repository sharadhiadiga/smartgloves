# Smart Gloves — Production deployment & testing

Backend: **https://smartgloves-backend.onrender.com**

## 1. MongoDB Atlas

1. Create free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Database user + password
3. Network Access → Allow from anywhere (`0.0.0.0/0`) for Render
4. Connection string → `MONGO_URI`

## 2. Render (backend)

1. New **Web Service** → connect GitHub repo
2. Root directory: `backend-node`
3. Build: `npm install`
4. Start: `npm start`
5. Environment:
   - `MONGO_URI` = Atlas URI
   - `PORT` = `5000` (or leave Render default)
   - `FORCE_CRITICAL_FOR_TESTING` = `false`
   - `ML_API_URL` = optional external ML service
6. Deploy → verify:
   - [https://smartgloves-backend.onrender.com/health](https://smartgloves-backend.onrender.com/health)
   - [https://smartgloves-backend.onrender.com/api/dashboard](https://smartgloves-backend.onrender.com/api/dashboard)

## 3. ESP32 libraries (Arduino IDE)

Install via Library Manager:

- **WiFiManager** (tzapu)
- **ArduinoJson** 6.x
- **Adafruit TMP117**
- **SparkFun MAX3010x Pulse and Heart Rate Sensor**

Board: **ESP32 Dev Module**

### First-time WiFi

1. Flash `firmware/esp32_wifi_health_glove/esp32_wifi_health_glove.ino`
2. Connect phone to WiFi AP **`HealthGlove_Setup`**
3. Captive portal → enter home WiFi credentials
4. ESP32 reboots and POSTs to `/api/vitals` every second

### Wiring (default I2C)

| Sensor | Connection |
|--------|------------|
| TMP117 | SDA 21, SCL 22 |
| MAX30102 | SDA 21, SCL 22 |
| GSR | GPIO 34 analog |

## 4. Mobile app (Expo)

`mobile-app/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://smartgloves-backend.onrender.com
EXPO_PUBLIC_POLL_MS=1000
```

```bash
cd mobile-app
npm install
npx expo start -c
```

Use physical phone + internet. No Bluetooth permissions required.

## 5. Production test checklist

| # | Test | Expected |
|---|------|----------|
| 1 | GET `/health` | `status: online` |
| 2 | POST `/api/vitals` sample JSON | `201`, `success: true` |
| 3 | GET `/api/dashboard` | patients array |
| 4 | GET `/api/alerts` | alerts when risk High/Critical |
| 5 | ESP32 serial HTTPS 200 | JSON logged |
| 6 | App Doctor tab | vitals update ~1s |
| 7 | App Patients tab | cards + detail |
| 8 | Socket.IO | console shows `vitals:update` on ingest |

## 6. Troubleshooting

| Issue | Fix |
|-------|-----|
| Render 404 on `/api/vitals` | Redeploy latest `backend-node` |
| ESP32 HTTPS -1 | Wake Render in browser first; check internet |
| WiFi portal not showing | Power-cycle ESP32; search AP `HealthGlove_Setup` |
| MAX30102 no HR | Finger on sensor; wait 10–15s |
| App offline | Check `.env` URL; `npx expo start -c` |
| Always Critical | `FORCE_CRITICAL_FOR_TESTING=false` on Render |

## 7. API reference

- `POST /api/vitals` — ESP32 ingestion
- `GET /api/dashboard` — doctor dashboard payload
- `GET /api/alerts` — high/critical only
- `GET /api/patient/latest/:patientId`
- `GET /api/patients` — mobile compatibility
- **Socket.IO** events: `vitals:update`, `alert:new`
