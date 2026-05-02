Smart Wearable Health Monitoring System

A comprehensive backend system for monitoring health data from smart wearables, featuring real-time data processing, machine learning integration, and MongoDB storage.

Features

Health Data Collection: Accepts and validates temperature, heart rate, SpO2, and GSR readings
Machine Learning Integration: Calls external ML API for health status prediction (Normal, High Stress, Abnormal)
Data Persistence: Stores health records in MongoDB with timestamps
RESTful API: Clean endpoints for data submission and retrieval
Error Handling: Robust error handling with graceful fallbacks
Environment Configuration: Supports environment variables for flexible deployment

Tech Stack

Backend: Node.js, Express.js

Database: MongoDB with Mongoose ODM

HTTP Client: Axios for ML API calls

Middleware: CORS, dotenv

Development: Nodemon for hot reloading

Installation

Clone the repository:
```bash
git clone <repository-url>
cd smart-gloves
```
Install backend dependencies:
```bash
cd backend-node
npm install
```
Set up environment variables:
```bash
cp .env.example .env
```
```bash
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/health-monitor
ML_API_URL=http://localhost:5001/predict
```
Running the Application

Start MongoDB (ensure MongoDB is running locally or update MONGO_URI)

Start the backend server:
```bash
cd backend-node
npm start
```
The server will start on port 5000 (or as configured in .env)

For development with auto-reload:
```bash
npm run dev
```
License

This project is licensed under the MIT License - see the LICENSE file for details.
