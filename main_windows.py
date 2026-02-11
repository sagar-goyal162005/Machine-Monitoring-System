"""
Real-Time Predictive Maintenance System - Windows Compatible Version
Using pandas for simulation of streaming behavior

Note: This is a simulation. For true Pathway streaming, use Linux/Mac/WSL.
"""
import pandas as pd
import time
from datetime import datetime


class RollingStatistics:
    """Maintains rolling statistics for anomaly detection"""
    
    def __init__(self):
        self.data = {}
    
    def update(self, machine_id, temperature, vibration):
        """Update rolling statistics for a machine"""
        if machine_id not in self.data:
            self.data[machine_id] = {
                'temps': [],
                'vibs': []
            }
        
        self.data[machine_id]['temps'].append(temperature)
        self.data[machine_id]['vibs'].append(vibration)
        
        # Keep only last 100 readings for rolling average
        if len(self.data[machine_id]['temps']) > 100:
            self.data[machine_id]['temps'].pop(0)
            self.data[machine_id]['vibs'].pop(0)
    
    def get_stats(self, machine_id):
        """Get statistics for a machine"""
        if machine_id not in self.data or not self.data[machine_id]['temps']:
            return None, None, None, None
        
        temps = self.data[machine_id]['temps']
        vibs = self.data[machine_id]['vibs']
        
        avg_temp = sum(temps) / len(temps)
        max_temp = max(temps)
        avg_vib = sum(vibs) / len(vibs)
        max_vib = max(vibs)
        
        return avg_temp, max_temp, avg_vib, max_vib


class AnomalyDetector:
    """Detects anomalies in sensor data"""
    
    TEMP_HIGH_THRESHOLD = 320  # Kelvin
    TEMP_SPIKE_THRESHOLD = 15  # Kelvin deviation
    VIBRATION_HIGH_THRESHOLD = 2000  # RPM
    VIBRATION_SPIKE_THRESHOLD = 500  # RPM deviation
    
    @staticmethod
    def detect(temp, vib, avg_temp, avg_vib):
        """Detect anomalies based on current and historical data"""
        alerts = []
        
        # High temperature
        if temp > AnomalyDetector.TEMP_HIGH_THRESHOLD:
            alerts.append("🔥 CRITICAL: High Temperature")
        
        # Temperature spike
        if avg_temp is not None:
            temp_dev = abs(temp - avg_temp)
            if temp_dev > AnomalyDetector.TEMP_SPIKE_THRESHOLD:
                alerts.append("⚠️ WARNING: Sudden Temperature Spike")
        
        # High vibration
        if vib > AnomalyDetector.VIBRATION_HIGH_THRESHOLD:
            alerts.append("🔥 CRITICAL: Excessive Vibration")
        
        # Vibration spike
        if avg_vib is not None:
            vib_dev = abs(vib - avg_vib)
            if vib_dev > AnomalyDetector.VIBRATION_SPIKE_THRESHOLD:
                alerts.append("⚠️ WARNING: Sudden Vibration Spike")
        
        if alerts:
            return " | ".join(alerts)
        else:
            return "✅ Normal Operation"


def process_stream(csv_path, output_path, streaming_mode=False, chunk_size=100):
    """
    Process sensor data stream
    
    Args:
        csv_path: Path to sensor data CSV
        output_path: Path to save alerts
        streaming_mode: If True, simulates real-time streaming
        chunk_size: Number of rows to process at once in streaming mode
    """
    print("=" * 70)
    print("🚀 Real-Time Predictive Maintenance System")
    print("=" * 70)
    print(f"📊 Data Source: {csv_path}")
    print(f"⚡ Mode: {'Streaming (Simulated)' if streaming_mode else 'Batch'}")
    print("=" * 70)
    print()
    
    # Initialize components
    stats = RollingStatistics()
    detector = AnomalyDetector()
    
    # Read data
    df = pd.read_csv(csv_path)
    total_rows = len(df)
    
    results = []
    anomaly_count = 0
    
    print("🔍 Processing sensor data...\n")
    
    # Process in chunks if streaming
    if streaming_mode:
        for i in range(0, total_rows, chunk_size):
            chunk = df.iloc[i:i+chunk_size]
            print(f"📦 Processing chunk {i//chunk_size + 1} ({len(chunk)} rows)...")
            
            for _, row in chunk.iterrows():
                process_row(row, stats, detector, results)
            
            time.sleep(0.1)  # Simulate streaming delay
    else:
        for idx, row in df.iterrows():
            process_row(row, stats, detector, results)
            
            if (idx + 1) % 1000 == 0:
                print(f"  Processed {idx + 1}/{total_rows} rows...")
    
    # Create results dataframe
    results_df = pd.DataFrame(results)
    
    # Count anomalies
    anomaly_count = len(results_df[results_df['Alert'] != "✅ Normal Operation"])
    
    # Save results
    results_df.to_csv(output_path, index=False)
    
    # Print summary
    print()
    print("=" * 70)
    print("✅ Processing Complete!")
    print("=" * 70)
    print(f"📊 Total Records Processed: {total_rows:,}")
    print(f"🚨 Anomalies Detected: {anomaly_count:,} ({anomaly_count/total_rows*100:.2f}%)")
    print(f"📁 Results saved to: {output_path}")
    print("=" * 70)
    
    # Show sample anomalies
    if anomaly_count > 0:
        print("\n📋 Sample Anomalies Detected:")
        print("-" * 70)
        anomalies = results_df[results_df['Alert'] != "✅ Normal Operation"].head(10)
        print(anomalies.to_string(index=False))
        print("-" * 70)


def process_row(row, stats, detector, results):
    """Process a single data row"""
    machine_id = int(row['machine_id'])
    temperature = float(row['temperature'])
    vibration = float(row['vibration'])
    timestamp = int(row['timestamp'])
    
    # Get current statistics
    avg_temp, max_temp, avg_vib, max_vib = stats.get_stats(machine_id)
    
    # Detect anomalies
    alert = detector.detect(temperature, vibration, avg_temp, avg_vib)
    
    # Update statistics
    stats.update(machine_id, temperature, vibration)
    
    # Calculate deviations
    temp_dev = abs(temperature - avg_temp) if avg_temp is not None else 0
    vib_dev = abs(vibration - avg_vib) if avg_vib is not None else 0
    
    # Store result
    results.append({
        'Machine': machine_id,
        'Time': timestamp,
        'Temp': f"{temperature:.1f}K",
        'Vibration': f"{vibration:.0f}",
        'Avg_Temp': f"{avg_temp:.1f}K" if avg_temp is not None else "N/A",
        'Temp_Dev': f"{temp_dev:.1f}K",
        'Alert': alert
    })


def main():
    """Main entry point"""
    import sys
    
    # Default parameters
    csv_path = "data/sensor_data.csv"
    output_path = "output/alerts_windows.csv"
    streaming_mode = "--streaming" in sys.argv
    
    # Process the stream
    process_stream(csv_path, output_path, streaming_mode=streaming_mode, chunk_size=100)
    
    print()
    print("💡 Tips:")
    print("   - Add --streaming flag to simulate streaming mode")
    print("   - For true Pathway streaming, use Linux/Mac/WSL")
    print()


if __name__ == "__main__":
    main()
