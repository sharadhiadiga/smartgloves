# SmartGloves

SmartGloves is a comprehensive smart wearable health monitoring system that integrates a Node.js backend, a Python machine learning model, and a React Native mobile application built with Expo. The system collects health data from wearable devices, processes it using machine learning algorithms, and provides real-time insights through a user-friendly mobile app.

## Project Structure

- **backend-node/**: Node.js backend server with Express, MongoDB integration, and API endpoints for data handling and ML service communication.
- **ml-model/**: Python-based machine learning service using Flask, scikit-learn, and pandas for health data analysis and predictions.
- **mobile-app/**: React Native mobile application built with Expo, featuring TypeScript support and modern UI components.

## Prerequisites

Before running the project, ensure you have the following installed:

- **Node.js** (>= 18.0.0)
- **Python** (>= 3.8)
- **MongoDB** (local or cloud instance)
- **Expo CLI** (for mobile app development)
- **Git** (for cloning the repository)

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

## API Endpoints

The backend provides the following main endpoints:

- `GET /api/health`: Check server health
- `POST /api/data`: Submit health data
- `GET /api/data`: Retrieve processed health data
- `POST /api/predict`: Get ML predictions

Refer to the backend routes for detailed API documentation.

## Database

The system uses MongoDB to store health data. Ensure MongoDB is running locally or update the `MONGODB_URI` in the `.env` file for a cloud instance.

## Machine Learning

The ML model handles:

- Data preprocessing
- Health anomaly detection
- Predictive analytics for health trends

The model is served via a Flask API and can be trained using the provided scripts in the `ml-model` directory.

## Development

### Backend Development

- Use `npm run dev` for hot reloading during development.
- API routes are defined in `routes/`.
- Controllers handle business logic in `controllers/`.
- Models define data schemas in `models/`.

### ML Model Development

- Training scripts are in `train.py`.
- Dataset creation in `create-dataset.py`.
- The main Flask app is in `app.py`.

### Mobile App Development

- The app uses Expo Router for file-based routing.
- Components are in `components/`.
- Screens are in `app/(tabs)/`.
- Theme and constants in `constants/`.

## Testing

Add tests for each component:

- Backend: Use Jest or Mocha for API testing.
- ML Model: Use pytest for Python testing.
- Mobile App: Use Jest and React Native Testing Library.

## Deployment

### Backend Deployment

Deploy the Node.js backend to platforms like Heroku, Vercel, or AWS.

### ML Model Deployment

Deploy the Flask app to cloud platforms like Heroku, Google Cloud Run, or AWS Lambda.

### Mobile App Deployment

Build and submit the app to app stores using Expo Application Services (EAS):

```bash
npx eas build --platform ios
npx eas build --platform android
```

## License

This project is licensed under the MIT License.


