# 🧤 Smart Gloves Health Monitoring System

A wearable IoT-based health monitoring platform that continuously monitors patient vital signs using sensor-enabled smart gloves. The system collects physiological data, processes it through an ML-powered backend for risk assessment, and displays real-time health status on a mobile application, enabling proactive healthcare monitoring.



# 📖 Overview

The Smart Gloves Health Monitoring System is designed to provide continuous patient monitoring by integrating wearable sensors, IoT communication, machine learning, and mobile technologies. The gloves collect vital health parameters, transmit them to a backend server through an ESP32 microcontroller, and classify the patient's condition into different risk levels. The processed information is then displayed on a real-time mobile dashboard, allowing caregivers and healthcare professionals to monitor patients efficiently.



# ✨ Features

### 🩺 Real-Time Health Monitoring
- Continuous monitoring of:
  - Body Temperature
  - Heart Rate
  - Blood Oxygen (SpO₂)
  - Galvanic Skin Response (GSR)

### 🤖 ML-Based Risk Assessment
- Intelligent patient health classification
- Four health status levels:
  - 🟢 Normal
  - 🟡 Moderate
  - 🟠 High
  - 🔴 Critical

### 📡 End-to-End IoT Pipeline
- Sensor data collection using ESP32
- WiFi-based data transmission
- Backend data processing
- Real-time mobile application updates

### 📱 Mobile Dashboard
- Live health status monitoring
- Patient-wise vital statistics
- Instant visualization of sensor readings
- User-friendly interface

### 🚨 Critical Health Alerts
- Detects abnormal vital signs
- Generates alerts for critical patient conditions
- Enables timely medical intervention



# 🛠️ Tech Stack

| Category | Technologies |
|----------|--------------|
| **Hardware** | ESP32, TMP117, MAX30102, GSR Sensor |
| **Firmware** | Arduino IDE (WiFi Communication) |
| **Backend** | Node.js, Express.js, Python (Machine Learning) |
| **Mobile** | React Native, Expo |
| **Database** | MongoDB |



# 🚀 Installation

## Prerequisites

- Node.js
- Python 3.x
- MongoDB
- Arduino IDE
- Expo CLI

### Backend Setup

```bash
cd backend-node

npm install

npm start
```

### Mobile App Setup

```bash
cd mobile-app

npm install

npx expo start
```

### ESP32 Firmware

- Open the firmware project in Arduino IDE
- Configure WiFi credentials
- Upload the firmware to the ESP32 board

---

# 🚀 Future Work

- Integration with cloud platforms (AWS/Azure)
- Doctor and caregiver web dashboard
- Push notifications and SMS alerts
- ECG and Blood Pressure sensor support
- Historical health trend visualization
- AI-based anomaly detection
- Multi-patient monitoring
- Electronic Health Record (EHR) integration
- Voice assistant support
- Wearable battery optimization
