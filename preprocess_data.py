"""
Preprocessing script to convert AI4I 2020 dataset to sensor data format
"""
import pandas as pd

# Read the AI4I dataset
df = pd.read_csv('data/ai4i2020.csv')

# Create sensor_data.csv with required schema
# Mapping:
# - UDI -> machine_id
# - Air temperature [K] -> temperature
# - Rotational speed [rpm] -> vibration (proxy for vibration)
# - UDI -> timestamp (using row number)

sensor_data = pd.DataFrame({
    'machine_id': df['UDI'],
    'temperature': df['Air temperature [K]'],
    'vibration': df['Rotational speed [rpm]'],
    'timestamp': df['UDI']  # Using UDI as timestamp
})

# Save to CSV
sensor_data.to_csv('data/sensor_data.csv', index=False)

print("✅ Dataset converted successfully!")
print(f"Created sensor_data.csv with {len(sensor_data)} rows")
print("\nSample data:")
print(sensor_data.head(10))
