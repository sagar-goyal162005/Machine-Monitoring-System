import pandas as pd

df = pd.read_csv('data/sensor_data.csv')
m5 = df[df['machine_id'] == 5].tail(10)

print('Last 10 readings for machine 5:')
print(m5[['temperature', 'vibration']])

print('\nCalculations:')
temp_slope = (m5['temperature'].iloc[-1] - m5['temperature'].iloc[0]) / 9
vib_slope = (m5['vibration'].iloc[-1] - m5['vibration'].iloc[0]) / 9

print(f'Temp slope: {temp_slope:.4f}')
print(f'Last temp: {m5.temperature.iloc[-1]}')
print(f'Slope > 0: {temp_slope > 0}')

if temp_slope > 0:
    temp_min = (320 - m5.temperature.iloc[-1]) / temp_slope
    print(f'Minutes to 320K: {temp_min:.1f}')
    print(f'Is >= 0: {temp_min >= 0}')
else:
    print('Temp slope not positive, no prediction')

print(f'\nVib slope: {vib_slope:.4f}')
print(f'Last vib: {m5.vibration.iloc[-1]}')
if vib_slope > 0:
    vib_min = (2000 - m5.vibration.iloc[-1]) / vib_slope
    print(f'Minutes to 2000 RPM: {vib_min:.1f}')
