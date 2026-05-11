import pandas as pd
import random

data = []

def rand_range(a, b):
    return round(random.uniform(a, b), 2)

# -----------------------------
# NORMAL (250 rows)
# -----------------------------
for _ in range(250):
    temp = rand_range(36.0, 37.5)
    hr = int(rand_range(60, 100))
    spo2 = int(rand_range(95, 100))
    gsr = int(rand_range(800, 1300))
    data.append([temp, hr, spo2, gsr, "Normal"])

# -----------------------------
# MODERATE (250 rows)
# -----------------------------
for _ in range(250):
    temp = rand_range(34.5, 35.9)
    hr = int(rand_range(60, 100))
    spo2 = int(rand_range(95, 100))
    gsr = int(rand_range(1400, 2000))
    data.append([temp, hr, spo2, gsr, "Moderate"])

# -----------------------------
# HIGH (250 rows)
# -----------------------------
for _ in range(250):
    temp = rand_range(38.0, 39.0)
    hr = int(rand_range(100, 120))
    spo2 = int(rand_range(90, 94))
    gsr = int(rand_range(2100, 2600))
    data.append([temp, hr, spo2, gsr, "High"])

# -----------------------------
# CRITICAL (250 rows)
# -----------------------------
for _ in range(250):
    temp = rand_range(39.0, 40.5)
    hr = int(rand_range(120, 150))
    spo2 = int(rand_range(75, 89))
    gsr = int(rand_range(2600, 3200))
    data.append([temp, hr, spo2, gsr, "Critical"])

# -----------------------------
# Convert to DataFrame
# -----------------------------
df = pd.DataFrame(data, columns=["temp", "hr", "spo2", "gsr", "label"])

# Shuffle dataset
df = df.sample(frac=1).reset_index(drop=True)

# Save
df.to_csv("data/dataset.csv", index=False)

print("✅ 1000-row REALISTIC dataset created!")