"""
Data Ingestion Module
Handles real-time streaming ingestion of sensor data
"""
import pathway as pw


class SensorSchema(pw.Schema):
    """Schema for sensor data stream"""
    machine_id: int
    temperature: float
    vibration: float
    timestamp: int


def ingest_sensor_data(csv_path: str, mode: str = "streaming"):
    """
    Ingest sensor data from CSV in streaming mode
    
    Args:
        csv_path: Path to the CSV file
        mode: 'streaming' for real-time or 'static' for batch
    
    Returns:
        Pathway table with sensor data
    """
    # Read CSV with schema mapping
    # AI4I dataset columns mapped to our schema:
    # UDI -> machine_id
    # Air temperature [K] -> temperature (converted to Celsius)
    # Rotational speed [rpm] / 1000 -> vibration (normalized)
    # UDI -> timestamp (using row ID as timestamp)
    
    sensor_stream = pw.io.csv.read(
        csv_path,
        schema=SensorSchema,
        mode=mode,
        autocommit_duration_ms=1000  # Process updates every 1 second
    )
    
    return sensor_stream


def filter_valid_readings(sensor_stream):
    """
    Filter out invalid sensor readings
    
    Args:
        sensor_stream: Pathway table with sensor data
    
    Returns:
        Filtered Pathway table
    """
    filtered = sensor_stream.filter(
        (pw.this.temperature > 0) &
        (pw.this.vibration >= 0)
    )
    
    return filtered
