"""
🚀 Real-Time Predictive Maintenance System
Using Pathway Streaming Engine

This system continuously monitors machine sensor data and generates
real-time alerts for predictive maintenance.
"""
import pathway as pw
from modules.ingestion import ingest_sensor_data, filter_valid_readings
from modules.processing import (
    compute_rolling_statistics,
    join_with_statistics,
    calculate_deviation
)
from modules.detection import (
    apply_anomaly_detection,
    filter_anomalies_only,
    format_alert_output
)


def main():
    """
    Main pipeline for real-time predictive maintenance
    """
    print("=" * 60)
    print("🚀 Real-Time Predictive Maintenance System")
    print("=" * 60)
    print("📊 Using AI4I 2020 Predictive Maintenance Dataset")
    print("⚡ Streaming Mode: Active")
    print("=" * 60)
    print("\n🔍 Monitoring for anomalies...\n")
    
    # =========================
    # 1️⃣ Data Ingestion
    # =========================
    sensor_stream = ingest_sensor_data(
        csv_path="data/sensor_data.csv",
        mode="streaming"
    )
    
    # =========================
    # 2️⃣ Data Validation
    # =========================
    filtered_stream = filter_valid_readings(sensor_stream)
    
    # =========================
    # 3️⃣ Feature Engineering
    # =========================
    # Compute rolling statistics
    statistics = compute_rolling_statistics(filtered_stream)
    
    # Join current readings with statistics
    joined_stream = join_with_statistics(filtered_stream, statistics)
    
    # Calculate deviations
    processed_stream = calculate_deviation(joined_stream)
    
    # =========================
    # 4️⃣ Anomaly Detection
    # =========================
    alerts = apply_anomaly_detection(processed_stream)
    
    # =========================
    # 5️⃣ Filter and Format Output
    # =========================
    # Option 1: Show all readings
    formatted_all = format_alert_output(alerts)
    
    # Option 2: Show only anomalies (uncomment to use)
    # anomalies = filter_anomalies_only(alerts)
    # formatted_anomalies = format_alert_output(anomalies)
    
    # =========================
    # 6️⃣ Real-Time Output
    # =========================
    pw.io.csv.write(formatted_all, "output/alerts.csv")
    pw.io.jsonlines.write(formatted_all, "output/alerts.jsonl")
    
    # Print to console
    print("📋 Alert Stream (displaying all readings):")
    print("-" * 60)
    pw.io.null.write(formatted_all)  # Process without output for monitoring
    
    # =========================
    # 7️⃣ Run Streaming Pipeline
    # =========================
    pw.run()


if __name__ == "__main__":
    main()
