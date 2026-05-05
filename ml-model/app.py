import os
from typing import Any, Dict, List, Tuple

import joblib
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.getenv("MODEL_PATH", "model.pkl")
REQUIRED_FIELDS = ["temperature", "heartRate", "spo2", "gsr"]
INPUT_RANGES = {
    "temperature": (30.0, 45.0),
    "heartRate": (30, 220),
    "spo2": (70, 100),
    "gsr": (0, 5000),
}
FEATURE_ORDER = ["temperature", "heartRate", "spo2", "gsr"]


def load_model(path: str):
    """Load the trained ML model once when the server starts."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model file not found at '{path}'.")

    return joblib.load(path)


model = load_model(MODEL_PATH)


def get_solution(prediction: str) -> str:
    """Map string model labels to a recommended action."""
    normalized_label = str(prediction).strip().lower()
    return {
        "normal": "Normal - No action needed",
        "high": "High stress - Recommend rest",
        "critical": "Possible health issue - Consult doctor",
    }.get(normalized_label, "Unknown condition - Review input data")


def safety_override(temperature: float, heartRate: float, spo2: float, current_level: str) -> str:
    """Override prediction labels for critical physiological conditions."""
    level = str(current_level).strip().lower()
    critical = temperature >= 40.0 or temperature < 35.0 or heartRate >= 140 or heartRate < 45 or spo2 < 88
    high_risk = temperature >= 38.5 or heartRate >= 120 or spo2 < 92

    if critical:
        return "critical"
    if high_risk and level == "normal":
        return "high"
    return level


def analyze_conditions(temperature: float, heartRate: float, spo2: float, gsr: float) -> Tuple[int, List[str], List[str]]:
    """Generate stress score, issues, and recommended measures."""
    issues: List[str] = []
    measures: List[str] = []
    score = 0

    if temperature >= 38.0:
        issues.append(f"Fever detected at {temperature:.1f}°C.")
        measures.append("Hydrate, rest, and monitor temperature.")
        score += 20
    elif temperature < 36.0:
        issues.append(f"Below normal temperature at {temperature:.1f}°C.")
        measures.append("Keep warm and check for symptoms.")
        score += 10

    if heartRate >= 120:
        issues.append(f"Elevated pulse at {heartRate} bpm.")
        measures.append("Slow down activity and breathe deeply.")
        score += 20
    elif heartRate < 50:
        issues.append(f"Low pulse at {heartRate} bpm.")
        measures.append("Sit down and seek medical advice if dizzy.")
        score += 15

    if spo2 < 92:
        issues.append(f"Low SpO₂ at {spo2}%.")
        measures.append("Check sensor placement and consider oxygen support.")
        score += 25
    elif spo2 < 95:
        issues.append(f"Mildly reduced SpO₂ at {spo2}%.")
        measures.append("Take a few deep breaths and recheck.")
        score += 10

    if gsr >= 2200:
        issues.append(f"GSR indicates elevated stress ({gsr}).")
        measures.append("Pause and perform calming breathing exercises.")
        score += 20
    elif gsr >= 1600:
        issues.append(f"GSR indicates moderate stress ({gsr}).")
        measures.append("Take a short break and relax.")
        score += 10

    if not issues:
        issues.append("All measured values are within expected range.")
        measures.append("Continue standard monitoring.")

    stress_level = min(100, max(0, score))
    return stress_level, issues, measures


def validate_input(payload: Any) -> Tuple[Dict[str, float], List[str]]:
    """Validate the request JSON and required sensor values."""
    errors: List[str] = []
    normalized: Dict[str, float] = {}

    if not isinstance(payload, dict):
        return {}, ["Request body must be valid JSON."]

    missing = [field for field in REQUIRED_FIELDS if field not in payload]
    if missing:
        errors.append(f"Missing required fields: {', '.join(missing)}.")
        return {}, errors

    for field in REQUIRED_FIELDS:
        try:
            normalized[field] = float(payload[field])
        except (TypeError, ValueError):
            errors.append(f"Field '{field}' must be numeric.")
            continue

        min_value, max_value = INPUT_RANGES[field]
        if normalized[field] < min_value or normalized[field] > max_value:
            errors.append(
                f"Field '{field}' must be between {min_value} and {max_value}."
            )

    return normalized, errors


@app.route("/", methods=["GET"])
def index():
    """Simple health check endpoint."""
    return "API is running", 200


@app.route("/predict", methods=["POST"])
def predict():
    """Predict condition based on smart glove sensor data."""
    payload = request.get_json(silent=True)
    values, errors = validate_input(payload)

    if errors:
        return jsonify({"error": "ValidationError", "details": errors}), 400

    feature_vector = [values[field] for field in FEATURE_ORDER]

    try:
        model_pred = model.predict([feature_vector])[0]
    except Exception as err:
        return jsonify({"error": "PredictionError", "details": str(err)}), 500

    prediction = safety_override(
        values["temperature"],
        values["heartRate"],
        values["spo2"],
        str(model_pred),
    )
    recommendation = get_solution(prediction)
    stress, issues, measures = analyze_conditions(
        values["temperature"],
        values["heartRate"],
        values["spo2"],
        values["gsr"],
    )
    return jsonify({
        "prediction": prediction,
        "level": prediction,
        "condition": recommendation.split(" - ")[0],
        "recommendation": recommendation,
        "stress": stress,
        "issues": issues,
        "measures": measures,
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
