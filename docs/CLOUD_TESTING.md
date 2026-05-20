# Option B — Cloud testing (Render)

Backend: [https://smartgloves-backend.onrender.com](https://smartgloves-backend.onrender.com)

## Prerequisites

- Render backend **redeployed** with latest `backend-node` (WiFi routes + `/api/patients`)
- Render env: `MONGO_URI` set (MongoDB Atlas)
- Phone with internet (WiFi or mobile data)
- ESP32 on WiFi with internet

---

## Step 1 — Verify backend is live

Browser or PowerShell:

```text
https://smartgloves-backend.onrender.com/health
https://smartgloves-backend.onrender.com/api/patients
```

Root should show `Server is working`. `/api/patients` returns `{ "patients": [...] }`.

**Note:** Free Render tier may **sleep**; first request after idle can take 30–60 seconds.

---

## Step 2 — Redeploy backend (if not done)

1. Push latest code to GitHub
2. Render → your service → Deploy latest commit
3. Confirm **Environment**: `MONGO_URI`, optional `FORCE_CRITICAL_FOR_TESTING=false`

---

## Step 3 — Test API without hardware

```powershell
curl https://smartgloves-backend.onrender.com/health

curl -X POST https://smartgloves-backend.onrender.com/api/data ^
  -H "Content-Type: application/json" ^
  -d "{\"patientId\":\"P001\",\"temperature\":37.2,\"temperatureCondition\":\"Low\",\"heartRate\":78,\"heartRateCondition\":\"Low\",\"spo2\":97,\"spo2Condition\":\"Low\",\"gsr\":1200,\"gsrCondition\":\"Moderate\"}"

curl https://smartgloves-backend.onrender.com/api/patients
```

You should see `P001` in the patients list.

---

## Step 4 — ESP32 (HTTPS)

1. Open `firmware/esp32_wifi_health_glove/esp32_wifi_health_glove.ino`
2. Set `WIFI_SSID` / `WIFI_PASSWORD`
3. URL is already: `https://smartgloves-backend.onrender.com/api/data`
4. Upload → Serial Monitor **115200**
5. Wait for `[HTTPS] Response code: 200` (be patient on first POST after sleep)

---

## Step 5 — Mobile app

`mobile-app/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://smartgloves-backend.onrender.com
```

```powershell
cd mobile-app
npm install
npx expo start -c
```

Open on a **physical phone** (Expo Go or dev build). Pull to refresh if needed.

**Expected:**

- WiFi Data Stream → **Connected**
- Patient **P001** with vitals + conditions
- Updates every **2 seconds**
- Critical patients → red card + banner

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| App offline | Check phone internet; URL in `.env`; restart Expo with `-c` |
| ESP32 HTTPS failed (-1 / timeout) | Wake Render with browser first; increase timeout; check WiFi internet |
| Empty patients | Confirm POST returns 200; check `/api/patients` in browser |
| Always Critical | Set `FORCE_CRITICAL_FOR_TESTING=false` on Render |
