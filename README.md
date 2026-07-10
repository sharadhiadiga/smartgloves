# 🧤 Smart Gloves Health Monitoring System

A wearable IoT-based health monitoring platform that continuously monitors patient vital signs using sensor-enabled smart gloves. The system collects physiological data, processes it through an ML-powered backend for risk assessment, and displays real-time health status on a mobile application, enabling proactive healthcare monitoring.



#  Overview

The Smart Gloves Health Monitoring System is designed to provide continuous patient monitoring by integrating wearable sensors, IoT communication, machine learning, and mobile technologies. The gloves collect vital health parameters, transmit them to a backend server through an ESP32 microcontroller, and classify the patient's condition into different risk levels. The processed information is then displayed on a real-time mobile dashboard, allowing caregivers and healthcare professionals to monitor patients efficiently.



#  Features

###  Real-Time Health Monitoring
- Continuous monitoring of:
  - Body Temperature
  - Heart Rate
  - Blood Oxygen (SpO₂)
  - Galvanic Skin Response (GSR)

###  ML-Based Risk Assessment
- Intelligent patient health classification
- Four health status levels:
  - 🟢 Normal
  - 🟡 Moderate
  - 🟠 High
  - 🔴 Critical

###  End-to-End IoT Pipeline
- Sensor data collection using ESP32
- WiFi-based data transmission
- Backend data processing
- Real-time mobile application updates

###  Mobile Dashboard
- Live health status monitoring
- Patient-wise vital statistics
- Instant visualization of sensor readings
- User-friendly interface

###  Critical Health Alerts
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
- Git

### Clone the Repository

```bash
git clone https://github.com/sharadhiadiga/smartgloves.git

cd smartgloves
```

---

## Backend Setup

Navigate to the backend directory:

```bash
cd backend-node
```

Install the required dependencies:

```bash
npm install
```

Start the backend server:

```bash
npm start
```

If using the ML prediction service, install the required Python dependencies and run the Python server as specified in the backend configuration.

---

## Mobile Application Setup

Open a new terminal and navigate to the mobile application:

```bash
cd mobile-app
```

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

Scan the QR code using the Expo Go app or run the application on an Android emulator or iOS simulator.

---

## ESP32 Firmware Setup

Navigate to:

```text
firmware/esp32_wifi_health_glove/
```

1. Open the project in **Arduino IDE**.
2. Configure your WiFi credentials.
3. Select the ESP32 board and the appropriate COM port.
4. Upload the firmware to the ESP32 device.

---

## Database Setup

1. Install and start **MongoDB**.
2. Configure the MongoDB connection string in the backend configuration.
3. Start the backend server to begin storing incoming sensor data.

---

## Access the Application

- Backend API: Runs on the configured Express server.
- Mobile App: Launch using **Expo Go** or an emulator after running `npx expo start`.
- ESP32: Begins transmitting sensor data to the backend over WiFi once connected.
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
