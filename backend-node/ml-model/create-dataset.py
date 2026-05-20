import pandas as pd
import random

# -----------------------------------
# CONFIG
# -----------------------------------

ROWS_PER_CLASS = 5000

data = []

# -----------------------------------
# RANDOM FLOAT GENERATOR
# -----------------------------------

def rand_range(a, b):

    return round(random.uniform(a, b), 2)

# -----------------------------------
# NORMAL (5000)
# -----------------------------------

for _ in range(ROWS_PER_CLASS):

    temp = rand_range(36.0, 37.5)
    hr = random.randint(60, 100)
    spo2 = random.randint(95, 100)
    gsr = random.randint(800, 1300)

    data.append([
        temp,
        hr,
        spo2,
        gsr,
        "Normal"
    ])

# -----------------------------------
# MODERATE (5000)
# -----------------------------------

for _ in range(ROWS_PER_CLASS):

    temp = rand_range(37.6, 38.0)
    hr = random.randint(101, 120)
    spo2 = random.randint(92, 94)
    gsr = random.randint(1400, 1900)

    data.append([
        temp,
        hr,
        spo2,
        gsr,
        "Moderate"
    ])

# -----------------------------------
# HIGH (5000)
# -----------------------------------

for _ in range(ROWS_PER_CLASS):

    temp = rand_range(38.1, 39.0)
    hr = random.randint(121, 140)
    spo2 = random.randint(89, 91)
    gsr = random.randint(2000, 2600)

    data.append([
        temp,
        hr,
        spo2,
        gsr,
        "High"
    ])

# -----------------------------------
# CRITICAL (5000)
# -----------------------------------

for _ in range(ROWS_PER_CLASS):

    temp = rand_range(39.1, 40.5)
    hr = random.randint(141, 170)
    spo2 = random.randint(75, 88)
    gsr = random.randint(2700, 3200)

    data.append([
        temp,
        hr,
        spo2,
        gsr,
        "Critical"
    ])

# -----------------------------------
# CREATE DATAFRAME
# -----------------------------------

df = pd.DataFrame(
    data,
    columns=[
        "temp",
        "hr",
        "spo2",
        "gsr",
        "label"
    ]
)

# -----------------------------------
# SHUFFLE DATASET
# -----------------------------------

df = df.sample(frac=1).reset_index(drop=True)

# -----------------------------------
# SAVE DATASET
# -----------------------------------

df.to_csv(
    "data/dataset_20000.csv",
    index=False
)

# -----------------------------------
# SUMMARY
# -----------------------------------

print("\n===================================")
print("BALANCED DATASET CREATED")
print("===================================")

print("\nTotal Rows:")
print(len(df))

print("\nClass Distribution:")
print(df["label"].value_counts())

print("\nSaved As:")
print("data/dataset_20000.csv")

print("\nSample Rows:")
print(df.head())