# SmartGloves

SmartGloves is a smart wearable health monitoring system: **ESP32 → WiFi → Node.js API → Expo mobile app**. Sensor data is POSTed over HTTP from the glove; the app polls the backend every 2 seconds. BLE is no longer used.

## Architecture (WiFi)

```
ESP32 (sensors) --WiFi POST--> Backend :5000/api/data
Mobile app      --WiFi GET---> Backend :5000/api/patients
```

- Firmware: `firmware/esp32_wifi_health_glove/`
- Configure ESP32 `BACKEND_HOST` and mobile `EXPO_PUBLIC_API_BASE_URL` to your machine’s **LAN IP** (same WiFi).

## Project Structure

- **backend-node/**: Node.js backend server with Express, MongoDB integration, and API endpoints for data handling and ML service communication.
- **ml-model/**: Python-based machine learning service using Flask, scikit-learn, and pandas for health data analysis and predictions.
- **mobile-app/**: React Native mobile application built with Expo, featuring TypeScript support and modern UI components.

## Installation and Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd smartgloves
```

### 2. Backend Setup (Node.js)

Navigate to the backend directory:

```bash
cd backend-node
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the `backend-node` directory with the following variables:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/smartgloves
ML_SERVICE_URL=http://localhost:5000
```

Start the backend server:

```bash
npm run dev  # For development with nodemon
# or
npm start    # For production
```

The backend will run on `http://localhost:3000`.

### 3. Machine Learning Model Setup (Python)

Navigate to the ML model directory:

```bash
cd ../ml-model
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Run the ML service:

```bash
python app.py
```

The ML service will run on `http://localhost:5000`.

### 4. Mobile App Setup (React Native/Expo)

Navigate to the mobile app directory:

```bash
cd ../mobile-app
```

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npm start
```

This will open the Expo Developer Tools. You can then run the app on:

- **iOS Simulator**: Press `i` in the terminal
- **Android Emulator**: Press `a` in the terminal
- **Expo Go App**: Scan the QR code with the Expo Go app on your phone
- **Web**: Press `w` in the terminal

