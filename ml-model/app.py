import os
from typing import Any, Dict, List, Tuple

import joblib
import pandas as pd
from flask import Flask, jsonify, request

app = Flask(__name__)

# Model expects these exact feature names and order.
MODEL_FEATURES = ["temp", "hr", "spo2", "gsr"]
MODEL_PATH = os.getenv("MODEL_PATH", "model.pkl")

# Medically plausible sensor ranges for API validation.
INPUT_RANGES = {
    "temperature": (30.0, 45.0),
    "heartRate": (30, 220),
    "spo2": (70, 100),
    "gsr": (0, 5000),
}


def load_model(path: str):
    """Load trained model once at startup (no retraining in API)."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model file not found at '{path}'.")
    return joblib.load(path)


model = load_model(MODEL_PATH)


def validate_and_normalize(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Validate required fields, types, and ranges.
    Returns normalized numeric values + validation errors.
    """
    errors: List[str] = []
    required = ["temperature", "heartRate", "spo2", "gsr"]

    if payload is None or not isinstance(payload, dict):
        return {}, ["Body must be valid JSON object."]

    missing = [field for field in required if field not in payload]
    if missing:
        errors.append(f"Missing required fields: {', '.join(missing)}.")
        return {}, errors

    normalized: Dict[str, Any] = {}
    numeric_casts = {
        "temperature": float,
        "heartRate": int,
        "spo2": int,
        "gsr": int,
    }

    for key, caster in numeric_casts.items():
        try:
            normalized[key] = caster(payload[key])
        except (TypeError, ValueError):
            errors.append(f"Field '{key}' must be a valid {caster.__name__}.")
            continue

        min_val, max_val = INPUT_RANGES[key]
        value = normalized[key]
        if value < min_val or value > max_val:
            errors.append(f"Field '{key}' out of range [{min_val}, {max_val}].")

    return normalized, errors


def analyze_conditions(temp: float, hr: int, spo2: int, gsr: int) -> Tuple[List[str], List[str], int]:
    """
    Generate dynamic conditions and interventions from live values.
    Also returns a deterministic stress percentage.
    """
    issues: List[str] = []
    measures: List[str] = []
    severity_points = 0

    # Temperature analysis
    if temp >= 40.0:
        issues.append(f"Temperature critical at {temp:.1f}C (hyperpyrexia risk).")
        measures.append("Urgent clinical evaluation and active cooling recommended.")
        severity_points += 40
    elif temp >= 38.0:
        issues.append(f"Fever detected at {temp:.1f}C.")
        measures.append("Hydrate, reduce exertion, and re-check temperature frequently.")
        severity_points += 20
    elif temp < 35.0:
        issues.append(f"Temperature critically low at {temp:.1f}C (possible hypothermia).")
        measures.append("Warm gradually and seek urgent medical support.")
        severity_points += 40
    elif temp < 36.0:
        issues.append(f"Temperature below normal at {temp:.1f}C.")
        measures.append("Keep warm and continue close monitoring.")
        severity_points += 15

    # Heart rate analysis
    if hr >= 140:
        issues.append(f"Heart rate critical at {hr} bpm.")
        measures.append("Stop activity immediately and obtain urgent cardiac assessment.")
        severity_points += 35
    elif hr >= 110:
        issues.append(f"Heart rate elevated at {hr} bpm.")
        measures.append("Rest in seated position and practice paced breathing.")
        severity_points += 18
    elif hr < 45:
        issues.append(f"Heart rate critically low at {hr} bpm.")
        measures.append("Assess for dizziness/syncope and seek immediate care.")
        severity_points += 35
    elif hr < 55:
        issues.append(f"Heart rate below expected resting range at {hr} bpm.")
        measures.append("Repeat measurement at rest and monitor symptoms.")
        severity_points += 12

    # SpO2 analysis
    if spo2 < 88:
        issues.append(f"SpO2 critical at {spo2}%.")
        measures.append("Emergency oxygen evaluation is recommended immediately.")
        severity_points += 45
    elif spo2 < 92:
        issues.append(f"SpO2 low at {spo2}%.")
        measures.append("Limit activity and seek same-day clinical assessment.")
        severity_points += 28
    elif spo2 < 95:
        issues.append(f"SpO2 mildly reduced at {spo2}%.")
        measures.append("Perform deep breathing and recheck sensor placement.")
        severity_points += 12

    # GSR stress analysis
    if gsr >= 3000:
        issues.append(f"GSR indicates extreme stress activation ({gsr}).")
        measures.append("Pause workload immediately and begin guided calming protocol.")
        severity_points += 30
    elif gsr >= 2200:
        issues.append(f"GSR indicates high stress activation ({gsr}).")
        measures.append("Use 2-5 minutes of breathing exercises and reduce stimuli.")
        severity_points += 18
    elif gsr >= 1600:
        issues.append(f"GSR indicates moderate stress activation ({gsr}).")
        measures.append("Take a brief recovery break and hydrate.")
        severity_points += 10

    # Combine concurrent conditions into one deterministic explanation.
    if len(issues) > 1:
        issues.append(f"Combined concern: {len(issues)} concurrent physiological deviations detected.")
        measures.append("Prioritize the most severe issue first, then re-measure all sensors within 5 minutes.")
        severity_points += 8
    elif not issues:
        issues.append("All monitored parameters are currently within expected range.")
        measures.append("Continue routine monitoring.")

    # Deterministic stress score from severity + GSR component.
    gsr_component = min(35, max(0, int(round((gsr / 5000) * 35))))
    stress_percent = min(100, max(0, severity_points + gsr_component))
    return issues, measures, stress_percent


def safety_override(temp: float, hr: int, spo2: int, current_level: str) -> str:
    """
    Safety-first deterministic override:
    critical physiological red flags supersede model class.
    """
    critical = temp >= 40.0 or temp < 35.0 or hr >= 140 or hr < 45 or spo2 < 88
    high_risk = temp >= 38.5 or hr >= 120 or spo2 < 92

    if critical:
        return "Critical"
    if high_risk and str(current_level).lower() == "normal":
        return "High"
    return str(current_level)


@app.route("/health", methods=["GET"])
def health():
    """Simple readiness probe for Node.js backend integration."""
    return jsonify({"status": "ok", "modelLoaded": True, "features": MODEL_FEATURES})


@app.route("/predict", methods=["POST"])
def predict():
    """Prediction endpoint for real-time sensor payload."""
    payload = request.get_json(silent=True)
    values, errors = validate_and_normalize(payload)
    if errors:
        return jsonify({"error": "ValidationError", "details": errors}), 400

    temp = values["temperature"]
    hr = values["heartRate"]
    spo2 = values["spo2"]
    gsr = values["gsr"]

    try:
        # Build DataFrame with exact feature names expected by model.
        model_input = pd.DataFrame([[temp, hr, spo2, gsr]], columns=MODEL_FEATURES)
        model_pred = model.predict(model_input)[0]
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": "PredictionError", "details": str(exc)}), 500

    issues, measures, stress = analyze_conditions(temp, hr, spo2, gsr)
    final_level = safety_override(temp, hr, spo2, str(model_pred))

    response = {
        "class": final_level,
        "stress": stress,
        "level": final_level,
        "issues": issues,
        "measures": measures,
    }
    return jsonify(response), 200


if __name__ == "__main__":
    # Use debug=False for predictable production behavior.
    app.run(host="0.0.0.0", port=5001, debug=False)