"""
Processing Module
Handles real-time data processing with sliding windows and feature engineering
"""
import pathway as pw


def compute_rolling_statistics(sensor_stream, window_duration: int = 10, hop: int = 1):
    """
    Compute rolling window statistics for sensor data
    
    Args:
        sensor_stream: Pathway table with sensor data
        window_duration: Duration of the sliding window (number of records)
        hop: How often to compute the window
    
    Returns:
        Pathway table with rolling statistics
    """
    # Group by machine_id and compute rolling averages
    windowed = sensor_stream.groupby(pw.this.machine_id).reduce(
        machine_id=pw.this.machine_id,
        avg_temp=pw.reducers.avg(pw.this.temperature),
        max_temp=pw.reducers.max(pw.this.temperature),
        min_temp=pw.reducers.min(pw.this.temperature),
        avg_vibration=pw.reducers.avg(pw.this.vibration),
        max_vibration=pw.reducers.max(pw.this.vibration),
        count=pw.reducers.count()
    )
    
    return windowed


def join_with_statistics(sensor_stream, statistics):
    """
    Join current sensor readings with rolling statistics
    
    Args:
        sensor_stream: Pathway table with sensor data
        statistics: Pathway table with rolling statistics
    
    Returns:
        Joined Pathway table
    """
    joined = sensor_stream.join(
        statistics,
        pw.this.machine_id == statistics.machine_id
    ).select(
        machine_id=pw.this.machine_id,
        temperature=pw.this.temperature,
        vibration=pw.this.vibration,
        timestamp=pw.this.timestamp,
        avg_temp=statistics.avg_temp,
        max_temp=statistics.max_temp,
        avg_vibration=statistics.avg_vibration,
        max_vibration=statistics.max_vibration
    )
    
    return joined


def calculate_deviation(joined_stream):
    """
    Calculate temperature and vibration deviation from averages
    
    Args:
        joined_stream: Pathway table with sensor data and statistics
    
    Returns:
        Pathway table with deviation metrics
    """
    with_deviation = joined_stream.select(
        *pw.this,
        temp_deviation=pw.apply(
            lambda t, avg: abs(t - avg) if avg is not None else 0,
            pw.this.temperature,
            pw.this.avg_temp
        ),
        vib_deviation=pw.apply(
            lambda v, avg: abs(v - avg) if avg is not None else 0,
            pw.this.vibration,
            pw.this.avg_vibration
        )
    )
    
    return with_deviation
