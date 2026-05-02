from flask import Flask, request, jsonify
import joblib
import pandas as pd

app = Flask(__name__)

# -----------------------------
# LOAD TRAINED MODEL
# -----------------------------
model = joblib.load("model.pkl")


# -----------------------------
# DYNAMIC ANALYSIS ENGINE
# -----------------------------
def analyze_conditions(temp, hr, spo2, gsr):

    issues = []
    measures = []

    # -------------------------
    # TEMPERATURE
    # -------------------------
    if temp > 39:
        issues.append("Critical high body temperature")
        measures.append("Seek immediate medical attention")
    elif temp > 38:
        issues.append("High body temperature (fever)")
        measures.append("Stay hydrated and rest")
    elif temp < 35.5:
        issues.append("Low body temperature")
        measures.append("Keep warm and monitor")

    # -------------------------
    # HEART RATE
    # -------------------------
    if hr > 120:
        issues.append("Very high heart rate")
        measures.append("Avoid physical activity and consult a doctor")
    elif hr > 100:
        issues.append("Elevated heart rate")
        measures.append("Relax and reduce stress")

    # -------------------------
    # SPO2
    # -------------------------
    if spo2 < 90:
        issues.append("Critically low oxygen level")
        measures.append("Seek oxygen support immediately")
    elif spo2 < 95:
        issues.append("Low oxygen level")
        measures.append("Practice deep breathing")

    # -------------------------
    # GSR (STRESS)
    # -------------------------
    if gsr > 2600:
        issues.append("Extreme stress level")
        measures.append("Immediate calming or intervention required")
    elif gsr > 2000:
        issues.append("High stress level")
        measures.append("Try meditation or breathing exercises")
    elif gsr > 1400:
        issues.append("Moderate stress level")
        measures.append("Take rest and relax")

    # -------------------------
    # NORMAL CASE
    # -------------------------
    if not issues:
        issues.append("All parameters normal")
        measures.append("Continue monitoring")

    return issues, measures


# -----------------------------
# OPTIONAL SAFETY OVERRIDE
# -----------------------------
def safety_override(temp, hr, spo2, pred):
    if spo2 < 90 or hr > 130 or temp > 39.5:
        return "Critical"
    if spo2 < 92 or hr > 110 or temp > 38.5:
        return "High"
    return pred


# -----------------------------
# OPTIONAL AI PLACEHOLDER
# -----------------------------
def generate_ai_summary(issues):
    return "Patient shows: " + ", ".join(issues)


# -----------------------------
# PREDICTION API
# -----------------------------
@app.route('/predict', methods=['POST'])
def predict():

    data = request.json

    # -----------------------------
    # INPUT VALIDATION
    # -----------------------------
    required = ["temperature", "heartRate", "spo2", "gsr"]

    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400

    temp = data["temperature"]
    hr = data["heartRate"]
    spo2 = data["spo2"]
    gsr = data["gsr"]

    # Basic sanity checks
    if not (30 <= temp <= 45):
        return jsonify({"error": "Invalid temperature"}), 400

    if not (30 <= hr <= 200):
        return jsonify({"error": "Invalid heart rate"}), 400

    if not (70 <= spo2 <= 100):
        return jsonify({"error": "Invalid SpO2"}), 400

    if gsr > 4000:
        return jsonify({"error": "Sensor not worn properly"}), 400

    # -----------------------------
    # ML PREDICTION
    # -----------------------------
    sample = pd.DataFrame(
        [[temp, hr, spo2, gsr]],
        columns=["temp", "hr", "spo2", "gsr"]
    )

    pred = model.predict(sample)[0]

    # Apply safety override
    pred = safety_override(temp, hr, spo2, pred)

    # -----------------------------
    # DYNAMIC ANALYSIS
    # -----------------------------
    issues, measures = analyze_conditions(temp, hr, spo2, gsr)

    # -----------------------------
    # FINAL RESPONSE
    # -----------------------------
    response = {
        "class": pred,
        "stress": int((gsr / 3000) * 100),
        "level": pred,
        "issues": issues,
        "measures": measures,
        "summary": generate_ai_summary(issues)  # optional
    }

    return jsonify(response)


# -----------------------------
# RUN SERVER
# -----------------------------
if __name__ == '__main__':
    app.run(port=5001, debug=True)