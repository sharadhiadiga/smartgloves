import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import joblib

from flask import Flask, jsonify, request
from flask_cors import CORS

# --------------------------------
# FLASK SETUP
# --------------------------------
app = Flask(__name__)
CORS(app)

# --------------------------------
# MODEL CONFIG
# --------------------------------
MODEL_PATH = os.getenv("MODEL_PATH", "model.pkl")

FEATURE_ORDER = [
    "temperature",
    "heartRate",
    "spo2",
    "gsr"
]

INPUT_RANGES = {
    "temperature": (30.0, 45.0),
    "heartRate": (30, 220),
    "spo2": (70, 100),
    "gsr": (0, 5000),
}

# --------------------------------
# IN-MEMORY PATIENT STORAGE
# --------------------------------
patients: Dict[str, Dict[str, Any]] = {}

# --------------------------------
# LOAD MODEL
# --------------------------------
def load_model(path: str):

    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Model file not found at '{path}'"
        )

    return joblib.load(path)

model = load_model(MODEL_PATH)

# --------------------------------
# VALIDATION
# --------------------------------
def validate_input(payload):

    errors = []
    normalized = {}

    required_fields = [
        "temperature",
        "heartRate",
        "spo2",
        "gsr"
    ]

    if not isinstance(payload, dict):
        return {}, ["Invalid JSON"]

    for field in required_fields:

        if field not in payload:
            errors.append(f"Missing {field}")
            continue

        try:
            value = float(payload[field])
            normalized[field] = value

        except:
            errors.append(f"{field} must be numeric")
            continue

        min_v, max_v = INPUT_RANGES[field]

        if value < min_v or value > max_v:
            errors.append(
                f"{field} out of range"
            )

    return normalized, errors

# --------------------------------
# SAFETY OVERRIDE
# --------------------------------
def safety_override(
    temperature,
    heartRate,
    spo2,
    gsr
):

    # CRITICAL
    if (
        temperature >= 39.0 or
        heartRate >= 140 or
        spo2 < 90 or
        gsr >= 3000
    ):
        return "Critical"

    # HIGH
    elif (
        temperature >= 38.0 or
        heartRate >= 120 or
        spo2 <= 93 or
        gsr >= 2500
    ):
        return "High"

    # MODERATE
    elif (
        temperature >= 37.5 or
        heartRate >= 100 or (0 < heartRate < 60) or
        spo2 <= 95 or
        gsr >= 2000
    ):
        return "Moderate"

    return "Normal"

# --------------------------------
# SOLUTIONS
# --------------------------------
def get_solution(level):

    mapping = {

        "Normal":
        "Vitals are stable.",

        "Moderate":
        "Monitor patient carefully.",

        "High":
        "Recommend immediate observation.",

        "Critical":
        "Urgent medical attention required."
    }

    return mapping.get(level, "Unknown")

# --------------------------------
# HEALTH CHECK
# --------------------------------
@app.route("/health", methods=["GET"])
def health():

    return jsonify({
        "status": "ok"
    })

# --------------------------------
# MAIN VITALS API
# --------------------------------
@app.route("/api/vitals", methods=["POST"])
def vitals():

    payload = request.get_json()

    values, errors = validate_input(payload)

    if errors:

        return jsonify({
            "error": errors
        }), 400

    features = [[
        values["temperature"],
        values["heartRate"],
        values["spo2"],
        values["gsr"]
    ]]

    try:

        prediction = model.predict(features)[0]

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500

    # SAFETY OVERRIDE
    final_level = safety_override(
        values["temperature"],
        values["heartRate"],
        values["spo2"],
        values["gsr"]
    )

    patient_id = payload.get(
        "patientId",
        "Unknown"
    )

    patient_data = {

        "patientId": patient_id,

        "temperature":
        values["temperature"],

        "heartRate":
        values["heartRate"],

        "spo2":
        values["spo2"],

        "gsr":
        values["gsr"],

        "prediction":
        prediction,

        "riskLevel":
        final_level,

        "recommendation":
        get_solution(final_level),

        "timestamp":
        datetime.now(
            timezone.utc
        ).isoformat()
    }

    patients[patient_id] = patient_data

    return jsonify(patient_data)

# --------------------------------
# GET ALL PATIENTS
# --------------------------------
@app.route("/api/all-patients", methods=["GET"])
def all_patients():

    return jsonify({
        "patients":
        list(patients.values())
    })

# --------------------------------
# RUN SERVER
# --------------------------------
if __name__ == "__main__":

    port = int(
        os.getenv("PORT", "10000")
    )

    app.run(
        host="0.0.0.0",
        port=port
    )