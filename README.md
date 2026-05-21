# Smart Gloves Health Monitoring System

A wearable health monitoring platform that collects patient vitals using sensor-enabled gloves, processes them on a backend with ML-based risk scoring, and displays live health status on a mobile dashboard.

---

## 🚀 Features

- Real-time vitals: Temperature, Heart Rate, SpO₂, GSR  
- Risk classification: Normal → Moderate → High → Critical  
- End-to-end pipeline: ESP32 → Backend → Mobile App  
- Live dashboard with real-time updates  
- Critical condition alerts  

---

## 📁 Project Structure
smartgloves/

├── firmware/    # ESP32 code

├── backend-node/          # API + database

├── backend-node/ml-model/ # ML service

└── mobile-app/            # React Native app

## 🛠 Tech Stack

| Layer     | Technologies |
|----------|-------------|
| Hardware | ESP32, TMP117, MAX30102, GSR |
| Firmware | Arduino (WiFi) |
| Backend  | Node.js (Express), Python (ML) |
| Mobile   | React Native, Expo |
| Database | MongoDB |

---

## ⚙️ How It Works

1. Sensors capture temperature, heart rate, SpO₂, and GSR  
2. ESP32 sends data to backend via WiFi  
3. Backend processes data and applies ML prediction  
4. Data stored in MongoDB  
5. Mobile app displays patient status in real time  

---

## 🧪 Setup

- Backend: `npm install && npm start`  
- Mobile: `npm install && npx expo start`  
- ESP32: Upload firmware and configure WiFi  

---

## 📡 API

### POST `/api/data`

```json
{
  "id": "P0009",
  "deviceId": "ESP32_TEST",
  "temperature": 36.7,
  "heartRate": 82,
  "spo2": 99,
  "gsr": 1200
}
```

## 📊 Status Levels

Normal — Safe range

Moderate — Slight deviation

High — Concerning

Critical — Immediate attention required

