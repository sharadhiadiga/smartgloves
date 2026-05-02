from flask import Flask, request, jsonify
import pandas as pd
from sklearn.tree import DecisionTreeClassifier

app = Flask(__name__)

DATA_PATH = "data/dataset.csv"

model = None


# -----------------------------
# TRAIN MODEL (ONLY WHEN CALLED)
# -----------------------------
def train_model():
    global model

    df = pd.read_csv(DATA_PATH)

    # safety checks
    if df.empty:
        raise Exception("Dataset is empty")

    required_cols = ["temp", "hr", "spo2", "gsr", "label"]
    if not all(col in df.columns for col in required_cols):
        raise Exception("Dataset format invalid")

    X = df[["temp", "hr", "spo2", "gsr"]]
    y = df["label"]

    model = DecisionTreeClassifier(max_depth=4)
    model.fit(X, y)

    print("✅ Model trained from dataset.csv")


# -----------------------------
# OUTPUT MAPPING
# -----------------------------
def map_output(pred):
    mapping = {
        "Normal": {
            "class": "Normal",
            "stress": 10,
            "level": "Low",
            "description": "All vital parameters are within normal range.",
            "measures": ["Continue monitoring"]
        },
        "Moderate": {
            "class": "Moderate",
            "stress": 40,
            "level": "Moderate",
            "description": "Low body temperature and moderate stress.",
            "measures": [
                "Keep warm",
                "Consult doctor if persistent",
                "Practice relaxation"
            ]
        },
        "High": {
            "class": "High",
            "stress": 75,
            "level": "High",
            "description": "Fever, high heart rate, low SpO2, and high stress.",
            "measures": [
                "Hydrate",
                "Deep breathing",
                "Seek medical advice"
            ]
        },
        "Critical": {
            "class": "Critical",
            "stress": 85,
            "level": "High",
            "description": "Critical condition detected.",
            "measures": [
                "Immediate medical attention required"
            ]
        }
    }

    return mapping.get(pred, {"error": "Unknown class"})


# -----------------------------
# PREDICT API
# -----------------------------
@app.route('/predict', methods=['POST'])
def predict():

    global model

    # ❗ ensure model exists
    if model is None:
        return jsonify({"error": "Model not trained yet"}), 500

    data = request.json

    required = ["temperature", "heartRate", "spo2", "gsr"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400

    temp = data["temperature"]
    hr = data["heartRate"]
    spo2 = data["spo2"]
    gsr = data["gsr"]

    # validation
    if not (30 <= temp <= 45):
        return jsonify({"error": "Invalid temperature"}), 400

    if not (30 <= hr <= 200):
        return jsonify({"error": "Invalid heart rate"}), 400

    if not (70 <= spo2 <= 100):
        return jsonify({"error": "Invalid SpO2"}), 400

    if gsr > 3000:
        return jsonify({"error": "Sensor not worn properly"}), 400

    # prediction
    pred = model.predict([[temp, hr, spo2, gsr]])[0]

    return jsonify(map_output(pred))


# -----------------------------
# RETRAIN API (ONLY WHEN NEEDED)
# -----------------------------
@app.route('/retrain', methods=['POST'])
def retrain():
    try:
        train_model()
        return jsonify({"message": "Model retrained successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# SERVER START
# -----------------------------
if __name__ == '__main__':
    train_model()   # 🔥 train once at startup
    app.run(port=5001)