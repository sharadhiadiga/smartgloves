import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

# -----------------------------
# LOAD DATASET
# -----------------------------
df = pd.read_csv("data/dataset.csv")

print("\nDataset Loaded:")
print(df.head())

# -----------------------------
# FEATURES
# -----------------------------
X = df[[
    "temp",
    "hr",
    "spo2",
    "gsr"
]]

# -----------------------------
# LABELS
# -----------------------------
y = df["label"]

# -----------------------------
# SPLIT
# -----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# -----------------------------
# MODEL
# -----------------------------
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    random_state=42
)

# -----------------------------
# TRAIN
# -----------------------------
model.fit(X_train, y_train)

# -----------------------------
# ACCURACY
# -----------------------------
accuracy = model.score(X_test, y_test)

print("\n===================================")
print("MODEL ACCURACY")
print("===================================")

print(f"\nAccuracy: {accuracy}")

# -----------------------------
# CLASSIFICATION REPORT
# -----------------------------
predictions = model.predict(X_test)

print("\n===================================")
print("CLASSIFICATION REPORT")
print("===================================")

print(classification_report(
    y_test,
    predictions
))

# -----------------------------
# TEST CASES
# -----------------------------
test_cases = [

    [36.8, 75, 98, 1000],  # Normal

    [37.8, 110, 93, 1700], # Moderate

    [38.5, 130, 90, 2400], # High

    [39.8, 150, 84, 3000]  # Critical
]

print("\n===================================")
print("TEST PREDICTIONS")
print("===================================")

for case in test_cases:

    pred = model.predict([case])[0]

    print(f"{case} → {pred}")

# -----------------------------
# SAVE MODEL
# -----------------------------
joblib.dump(model, "model.pkl")

print("\n✅ Model saved as model.pkl")