"""
Anomaly Detection Module
Implements real-time anomaly detection logic for predictive maintenance
"""
import pathway as pw


# Threshold configurations
TEMP_HIGH_THRESHOLD = 320  # Kelvin (approximately 47°C)
TEMP_SPIKE_THRESHOLD = 15  # Kelvin deviation
VIBRATION_HIGH_THRESHOLD = 2000  # RPM
VIBRATION_SPIKE_THRESHOLD = 500  # RPM deviation


def detect_anomaly(temp, vib, avg_temp, avg_vib, temp_dev, vib_dev):
    """
    Multi-criteria anomaly detection logic
    
    Args:
        temp: Current temperature
        vib: Current vibration
        avg_temp: Rolling average temperature
        avg_vib: Rolling average vibration
        temp_dev: Temperature deviation from average
        vib_dev: Vibration deviation from average
    
    Returns:
        Alert status string
    """
    alerts = []
    
    # 1. High Temperature Detection
    if temp > TEMP_HIGH_THRESHOLD:
        alerts.append("🔥 CRITICAL: High Temperature")
    
    # 2. Sudden Temperature Spike Detection
    if temp_dev > TEMP_SPIKE_THRESHOLD:
        alerts.append("⚠️ WARNING: Sudden Temperature Spike")
    
    # 3. High Vibration Detection (using Rotational Speed as proxy)
    if vib > VIBRATION_HIGH_THRESHOLD:
        alerts.append("🔥 CRITICAL: Excessive Vibration")
    
    # 4. Sudden Vibration Spike Detection
    if vib_dev > VIBRATION_SPIKE_THRESHOLD:
        alerts.append("⚠️ WARNING: Sudden Vibration Spike")
    
    # Return status
    if alerts:
        return " | ".join(alerts)
    else:
        return "✅ Normal Operation"


def apply_anomaly_detection(processed_stream):
    """
    Apply anomaly detection to processed sensor data
    
    Args:
        processed_stream: Pathway table with processed sensor data and deviations
    
    Returns:
        Pathway table with anomaly alerts
    """
    alerts = processed_stream.select(
        machine_id=pw.this.machine_id,
        timestamp=pw.this.timestamp,
        temperature=pw.this.temperature,
        vibration=pw.this.vibration,
        avg_temp=pw.this.avg_temp,
        avg_vibration=pw.this.avg_vibration,
        temp_deviation=pw.this.temp_deviation,
        vib_deviation=pw.this.vib_deviation,
        status=pw.apply(
            detect_anomaly,
            pw.this.temperature,
            pw.this.vibration,
            pw.this.avg_temp,
            pw.this.avg_vibration,
            pw.this.temp_deviation,
            pw.this.vib_deviation
        )
    )
    
    return alerts


def filter_anomalies_only(alerts_stream):
    """
    Filter to show only anomalous conditions
    
    Args:
        alerts_stream: Pathway table with all alerts
    
    Returns:
        Pathway table with only anomaly alerts
    """
    anomalies = alerts_stream.filter(
        pw.this.status != "✅ Normal Operation"
    )
    
    return anomalies


def format_alert_output(alerts_stream):
    """
    Format alerts for console output
    
    Args:
        alerts_stream: Pathway table with alerts
    
    Returns:
        Formatted Pathway table for display
    """
    formatted = alerts_stream.select(
        Machine=pw.this.machine_id,
        Time=pw.this.timestamp,
        Temp=pw.apply(lambda t: f"{t:.1f}K", pw.this.temperature),
        Vibration=pw.apply(lambda v: f"{v:.0f}", pw.this.vibration),
        Avg_Temp=pw.apply(lambda t: f"{t:.1f}K" if t is not None else "N/A", pw.this.avg_temp),
        Temp_Dev=pw.apply(lambda d: f"{d:.1f}K", pw.this.temp_deviation),
        Alert=pw.this.status
    )
    
    return formatted
