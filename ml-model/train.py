import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
import joblib

# -----------------------------
# 1. LOAD DATASET
# -----------------------------
df = pd.read_csv("data/dataset.csv")

print("Dataset loaded:")
print(df.head())

# -----------------------------
# 2. FEATURES & LABELS
# -----------------------------
X = df[["temp", "hr", "spo2", "gsr"]]
y = df["label"]

# -----------------------------
# 3. SPLIT DATA
# -----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# -----------------------------
# 4. CREATE MODEL
# -----------------------------
model = DecisionTreeClassifier(max_depth=4)

# -----------------------------
# 5. TRAIN MODEL
# -----------------------------
model.fit(X_train, y_train)

# -----------------------------
# 6. CHECK ACCURACY
# -----------------------------
accuracy = model.score(X_test, y_test)
print("\nAccuracy:", accuracy)

# -----------------------------
# 7. TEST YOUR 4 MAIN CASES
# -----------------------------
test_cases = [
    [36.8, 75, 98, 2000],   # Person 1 → Normal
    [35.0, 70, 96, 1700],   # Person 2 → Moderate
    [38.5, 105, 92, 2500],  # Person 3 → High
    [39.5, 125, 85, 2800]   # Person 4 → Critical
]

print("\nTest Predictions:")
for case in test_cases:
    pred = model.predict([case])[0]
    print(case, "→", pred)

# -----------------------------
# 8. SAVE MODEL
# -----------------------------
joblib.dump(model, "model.pkl")

print("\nModel saved as model.pkl")