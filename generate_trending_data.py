"""Generate time-series sensor data with machines trending toward failure"""
import pandas as pd
import numpy as np

# Generate data for 100 machines with 100 readings each
machines = []
for machine_id in range(1, 101):
    for reading in range(1, 101):
        # Some machines have rising temperature trends (approaching but not exceeding 320K)
        if machine_id <= 10:  # 10 machines with temperature rising toward 320K
            base_temp = 298 + (reading * 0.15)  # Rising 0.15K per reading (will reach ~313K)
            temp_noise = np.random.normal(0, 0.5)
            temperature = base_temp + temp_noise
            vibration = 1400 + np.random.normal(0, 100)
        
        elif machine_id <= 20:  # 10 machines with vibration rising toward 2000
            temperature = 298 + np.random.normal(0, 1)
            base_vib = 1400 + (reading * 4)  # Rising 4 RPM per reading (will reach ~1800)
            vibration = base_vib + np.random.normal(0, 50)
        
        elif machine_id <= 30:  # 10 machines with both rising
            base_temp = 300 + (reading * 0.10)  # Slower rise
            temperature = base_temp + np.random.normal(0, 0.5)
            base_vib = 1500 + (reading * 3)  # Slower rise
            vibration = base_vib + np.random.normal(0, 50)
        
        else:  # 70 machines stable/healthy
            temperature = 298 + np.random.normal(0, 1.5)
            vibration = 1450 + np.random.normal(0, 150)
        
        machines.append({
            'machine_id': machine_id,
            'temperature': round(temperature, 1),
            'vibration': int(vibration),
            'timestamp': (machine_id - 1) * 100 + reading
        })

# Create DataFrame and save
df = pd.DataFrame(machines)
df.to_csv('data/sensor_data.csv', index=False)
print(f"Generated {len(df)} sensor readings for {df['machine_id'].nunique()} machines")
print(f"Readings per machine: {len(df) // df['machine_id'].nunique()}")
print("\nMachines with rising temperature (1-10):")
m5 = df[df['machine_id'] == 5].tail(10)
print(f"Machine 5 last temp: {m5['temperature'].iloc[-1]}K (threshold: 320K)")
print(f"Slope: {(m5['temperature'].iloc[-1] - m5['temperature'].iloc[0]) / 9:.3f}K per reading")
print("\nMachines with rising vibration (11-20):")
m15 = df[df['machine_id'] == 15].tail(10)
print(f"Machine 15 last vib: {m15['vibration'].iloc[-1]} RPM (threshold: 2000 RPM)")
print(f"Slope: {(m15['vibration'].iloc[-1] - m15['vibration'].iloc[0]) / 9:.1f} RPM per reading")
