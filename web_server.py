"""
Flask Web Server for Predictive Maintenance Dashboard
Serves the modern web UI and provides REST API endpoints
"""
from flask import Flask, render_template, jsonify, send_from_directory, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
import json
from datetime import datetime

try:
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
except ImportError:  # pragma: no cover - optional dependency
    LogisticRegression = None
    StandardScaler = None

app = Flask(__name__, 
            static_folder='web/static',
            template_folder='web')
CORS(app)  # Enable CORS for development

# Configuration
DATA_DIR = 'data'
OUTPUT_DIR = 'output'
AI4I_PATH = os.path.join(DATA_DIR, 'ai4i2020.csv')

ML_MODEL = None
ML_SCALER = None
ML_FEATURES = None
ML_FEATURE_MEANS = None


def get_alerts_path():
    """Return the best available alerts file path."""
    pathway_path = os.path.join(OUTPUT_DIR, 'alerts.csv')
    windows_path = os.path.join(OUTPUT_DIR, 'alerts_windows.csv')
    if os.path.exists(pathway_path):
        return pathway_path
    return windows_path


def load_sensor_data():
    """Load sensor data CSV or return empty DataFrame with expected columns."""
    sensor_path = os.path.join(DATA_DIR, 'sensor_data.csv')
    if not os.path.exists(sensor_path):
        return pd.DataFrame(columns=['machine_id', 'temperature', 'vibration', 'timestamp'])
    df = pd.read_csv(sensor_path)
    df = normalize_sensor_dataframe(df)

    for column in ['machine_id', 'temperature', 'vibration']:
        if column in df.columns:
            df[column] = coerce_numeric_series(df[column])

    if 'factory_id' in df.columns:
        # Keep factory_id comparable to query params (int) even if CSV has strings
        df['factory_id'] = coerce_numeric_series(df['factory_id']).astype('Int64')

    if 'timestamp' not in df.columns:
        df['timestamp'] = range(1, len(df) + 1)
    else:
        df['timestamp'] = coerce_numeric_series(df['timestamp'])
        if df['timestamp'].isna().any():
            next_ts = get_next_timestamp(df)
            missing_count = df['timestamp'].isna().sum()
            df.loc[df['timestamp'].isna(), 'timestamp'] = range(next_ts, next_ts + missing_count)

    return df


def load_alerts_data():
    """Load alerts CSV with fallback for missing files."""
    alerts_path = get_alerts_path()
    if not os.path.exists(alerts_path):
        return pd.DataFrame(columns=['Machine', 'Alert'])
    return pd.read_csv(alerts_path)


def dataframe_to_records(df):
    """Convert DataFrame to JSON-safe records (no NaN values)."""
    if df is None:
        return []
    cleaned = df.astype(object).where(pd.notnull(df), None)
    return cleaned.to_dict('records')


def normalize_sensor_dataframe(df):
    """Normalize sensor CSV column names to expected format."""
    rename_map = {
        'Machine': 'machine_id',
        'machine': 'machine_id',
        'Temp': 'temperature',
        'temp': 'temperature',
        'Temperature': 'temperature',
        'Vibration': 'vibration',
        'vib': 'vibration',
        'Time': 'timestamp',
        'time': 'timestamp',
        'Factory': 'factory_id',
        'factory': 'factory_id',
        'FactoryID': 'factory_id',
        'factory_ID': 'factory_id'
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
    return df


def coerce_numeric_series(series):
    """Coerce a pandas Series to numeric with NaN for invalid values."""
    return pd.to_numeric(series, errors='coerce')


def coerce_timestamp_value(value, fallback):
    """Normalize a timestamp value to an integer epoch seconds or fallback."""
    if value is None:
        return fallback

    if isinstance(value, (int, float)) and not pd.isna(value):
        return int(value)

    numeric_value = pd.to_numeric(value, errors='coerce')
    if not pd.isna(numeric_value):
        return int(numeric_value)

    parsed = pd.to_datetime(value, errors='coerce')
    if pd.isna(parsed):
        return fallback
    return int(parsed.timestamp())


def get_next_timestamp(existing_df):
    """Return the next numeric timestamp based on existing data."""
    if existing_df is None or existing_df.empty or 'timestamp' not in existing_df.columns:
        return 1

    numeric_ts = coerce_numeric_series(existing_df['timestamp'])
    max_ts = int(numeric_ts.max()) if numeric_ts.notna().any() else 0
    return max_ts + 1


def train_failure_model():
    """Train a simple logistic regression model on AI4I data."""
    global ML_MODEL, ML_SCALER, ML_FEATURES, ML_FEATURE_MEANS

    if LogisticRegression is None or StandardScaler is None:
        print('[WARN] scikit-learn not installed; ML model disabled.')
        return False

    if not os.path.exists(AI4I_PATH):
        print(f'[WARN] AI4I dataset not found: {AI4I_PATH}')
        return False

    df = pd.read_csv(AI4I_PATH)
    if 'Machine failure' not in df.columns:
        print('[WARN] AI4I dataset missing Machine failure column.')
        return False

    target = df['Machine failure']
    numeric_df = df.select_dtypes(include=[np.number]).copy()
    if 'Machine failure' in numeric_df.columns:
        numeric_df = numeric_df.drop(columns=['Machine failure'])
    if 'UDI' in numeric_df.columns:
        numeric_df = numeric_df.drop(columns=['UDI'])

    if numeric_df.empty:
        print('[WARN] No numeric features available for ML model.')
        return False

    feature_means = numeric_df.mean().to_dict()
    X = numeric_df.fillna(feature_means)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = LogisticRegression(max_iter=1000, solver='liblinear')
    model.fit(X_scaled, target)

    ML_MODEL = model
    ML_SCALER = scaler
    ML_FEATURES = list(numeric_df.columns)
    ML_FEATURE_MEANS = feature_means

    print(f'[INFO] Trained failure model with {len(ML_FEATURES)} features.')
    return True


def ensure_failure_model():
    """Ensure ML model is trained and ready."""
    if ML_MODEL is None:
        return train_failure_model()
    return True


def build_feature_vector(temperature, vibration):
    """Build a feature vector aligned to the trained model feature set."""
    if ML_FEATURES is None or ML_FEATURE_MEANS is None:
        return None

    feature_values = {name: ML_FEATURE_MEANS.get(name, 0) for name in ML_FEATURES}

    if 'Air temperature [K]' in feature_values:
        feature_values['Air temperature [K]'] = temperature
    if 'Rotational speed [rpm]' in feature_values:
        feature_values['Rotational speed [rpm]'] = vibration

    return pd.DataFrame([[feature_values[name] for name in ML_FEATURES]], columns=ML_FEATURES)


def predict_failure_probability(temperature, vibration):
    """Return failure probability using the trained ML model, if available."""
    if not ensure_failure_model():
        return None

    feature_vector = build_feature_vector(temperature, vibration)
    if feature_vector is None:
        return None

    scaled_vector = ML_SCALER.transform(feature_vector)
    probability = ML_MODEL.predict_proba(scaled_vector)[0][1]
    return float(round(probability * 100, 2))


def estimate_maintenance_cost(health_score, failure_probability, health_status):
    """Estimate maintenance cost in USD using health and failure probability."""
    base_cost = 10000
    severity_multiplier = {
        'Healthy': 0.3,
        'Warning': 0.8,
        'Critical': 1.6
    }.get(health_status, 1.0)

    health_risk = max(0, 100 - health_score) / 100
    if failure_probability is None:
        combined_risk = health_risk
    else:
        failure_risk = max(0, min(100, failure_probability)) / 100
        combined_risk = (failure_risk * 0.6) + (health_risk * 0.4)

    estimated_cost = base_cost * combined_risk * severity_multiplier
    return float(round(estimated_cost, 2))


def calculate_machine_insights(sensor_data, alerts_data, machine_id):
    """Compute health, risk, and recommendations for a single machine."""
    machine_data = sensor_data[sensor_data['machine_id'] == machine_id].copy()
    if machine_data.empty:
        return None

    machine_data = machine_data.sort_values('timestamp')
    avg_temp = float(machine_data['temperature'].mean())
    avg_vib = float(machine_data['vibration'].mean())
    last_row = machine_data.iloc[-1]
    last_temp = float(last_row['temperature'])
    last_vib = float(last_row['vibration'])
    failure_probability = predict_failure_probability(last_temp, last_vib)

    min_temp = float(machine_data['temperature'].min())
    max_temp = float(machine_data['temperature'].max())
    min_vib = float(machine_data['vibration'].min())
    max_vib = float(machine_data['vibration'].max())

    temp_range = max_temp - min_temp
    vib_range = max_vib - min_vib
    temp_std = float(machine_data['temperature'].std()) if len(machine_data) > 1 else 0
    vib_std = float(machine_data['vibration'].std()) if len(machine_data) > 1 else 0

    temp_norm = (last_temp - min_temp) / temp_range if temp_range else 0
    vib_norm = (last_vib - min_vib) / vib_range if vib_range else 0

    temp_z = abs((last_temp - avg_temp) / temp_std) if temp_std else 0
    vib_z = abs((last_vib - avg_vib) / vib_std) if vib_std else 0

    z_risk = min(1, (temp_z / 3) * 0.6 + (vib_z / 3) * 0.4)
    range_risk = (temp_norm * 0.6) + (vib_norm * 0.4)
    risk = max(z_risk, range_risk)
    health_score = 100 * (1 - risk)
    if health_score < 0:
        health_score = 0
    if health_score > 100:
        health_score = 100

    if health_score > 80:
        health_status = 'Healthy'
    elif health_score > 60:
        health_status = 'Warning'
    else:
        health_status = 'Critical'

    estimated_cost = estimate_maintenance_cost(health_score, failure_probability, health_status)

    alerts_machine_col = 'Machine' if 'Machine' in alerts_data.columns else 'machine_id'
    machine_alerts = alerts_data[alerts_data[alerts_machine_col] == machine_id]
    critical_count = len(machine_alerts[machine_alerts['Alert'].str.contains('CRITICAL', na=False)])
    warning_count = len(machine_alerts[machine_alerts['Alert'].str.contains('WARNING', na=False)])

    risk_score = min(100, round((100 - health_score) + (critical_count * 5) + (warning_count * 2)))

    recent_window = machine_data.tail(10)
    temp_slope = 0
    vib_slope = 0
    if len(recent_window) >= 2:
        temp_slope = (recent_window['temperature'].iloc[-1] - recent_window['temperature'].iloc[0]) / (len(recent_window) - 1)
        vib_slope = (recent_window['vibration'].iloc[-1] - recent_window['vibration'].iloc[0]) / (len(recent_window) - 1)

    temp_threshold = 320
    vib_threshold = 2000
    temp_minutes = (temp_threshold - last_temp) / temp_slope if temp_slope > 0 else None
    vib_minutes = (vib_threshold - last_vib) / vib_slope if vib_slope > 0 else None
    candidate_minutes = [m for m in [temp_minutes, vib_minutes] if m is not None and m >= 0]
    predicted_minutes = min(candidate_minutes) if candidate_minutes else None

    recommendations = []
    if last_temp >= temp_threshold:
        recommendations.append('Check cooling system')
    if last_vib >= vib_threshold:
        recommendations.append('Inspect bearing components')
    if temp_slope > 0 or vib_slope > 0:
        recommendations.append('Reduce load temporarily')
    if risk_score >= 70:
        recommendations.append('Schedule maintenance within 48 hours')
    if not recommendations:
        recommendations.append('Continue routine monitoring')

    return {
        'machine_id': int(machine_id),
        'health_score': round(health_score, 2),
        'health_status': health_status,
        'risk_score': int(risk_score),
        'failure_probability': failure_probability,
        'estimated_cost_usd': estimated_cost,
        'predicted_failure_minutes': round(predicted_minutes, 1) if predicted_minutes is not None else None,
        'avg_temperature': round(avg_temp, 2),
        'avg_vibration': round(avg_vib, 2),
        'last_temperature': round(last_temp, 2),
        'last_vibration': round(last_vib, 2),
        'recommendations': recommendations
    }

@app.route('/')
def index():
    """Serve the main dashboard"""
    return send_from_directory('web', 'index.html')

@app.route('/api/factories')
def get_factories():
    """Get list of unique factory IDs"""
    try:
        sensor_data = load_sensor_data()
        if 'factory_id' in sensor_data.columns:
            numeric_factory_ids = pd.to_numeric(sensor_data['factory_id'], errors='coerce')
            factories = sorted(numeric_factory_ids.dropna().astype(int).unique().tolist())
            return jsonify(factories)
        return jsonify([])
    except Exception as e:
        print(f"[ERROR] Error getting factories: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/data')
def get_data():
    """API endpoint to get sensor data or alerts"""
    file_param = request.args.get('file', '')
    factory_id = request.args.get('factory_id', None)
    
    try:
        print(f"[DEBUG] API /api/data called with file_param={file_param}, factory_id={factory_id}")
        
        if file_param in ['sensor_data', 'sensor'] or 'sensor_data' in file_param:
            df = load_sensor_data()
            # Filter by factory_id if provided
            if factory_id and 'factory_id' in df.columns:
                try:
                    factory_id_int = int(factory_id)
                    df = df[df['factory_id'] == factory_id_int]
                    print(f"[DEBUG] Filtered to factory {factory_id_int}: {len(df)} rows")
                except ValueError:
                    pass
            print(f"[DEBUG] Loaded {len(df)} rows from sensor_data.csv")
            data = dataframe_to_records(df)
            return jsonify(data)
        if file_param in ['alerts', 'alert'] or 'alerts' in file_param:
            filepath = get_alerts_path()
        else:
            return jsonify({'error': 'Invalid file parameter'}), 400
        
        print(f"[DEBUG] Loading from: {filepath}")
        if not os.path.exists(filepath):
            print(f"[ERROR] File not found: {filepath}")
            return jsonify({'error': f'File not found: {filepath}'}), 404
        
        # Read CSV and convert to JSON (replace NaN with None for valid JSON)
        df = pd.read_csv(filepath)
        print(f"[DEBUG] Loaded {len(df)} rows from {filepath}")
        
        # Filter alerts by factory_id if provided
        if factory_id:
            try:
                factory_id_int = int(factory_id)
                # Load sensor data to get machines in this factory
                sensor_data = load_sensor_data()
                if 'factory_id' in sensor_data.columns:
                    factory_machines = sensor_data[sensor_data['factory_id'] == factory_id_int]['machine_id'].unique()
                    alerts_machine_col = 'Machine' if 'Machine' in df.columns else 'machine_id'
                    if alerts_machine_col in df.columns:
                        df = df[df[alerts_machine_col].isin(factory_machines)]
                        print(f"[DEBUG] Filtered alerts to factory {factory_id_int}: {len(df)} rows")
            except ValueError:
                pass
        
        data = dataframe_to_records(df)

        return jsonify(data)
    
    except Exception as e:
        error_msg = f"Error loading {file_param}: {str(e)}"
        print(f"[ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/statistics')
def get_statistics():
    """Get dashboard statistics"""
    try:
        factory_id = request.args.get('factory_id', None)
        
        # Load data
        sensor_data = load_sensor_data()
        alerts = load_alerts_data()
        
        # Filter by factory_id if provided
        if factory_id and 'factory_id' in sensor_data.columns:
            try:
                factory_id_int = int(factory_id)
                sensor_data = sensor_data[sensor_data['factory_id'] == factory_id_int]
                # Filter alerts based on machines in this factory
                factory_machines = sensor_data['machine_id'].unique()
                alerts_machine_col = 'Machine' if 'Machine' in alerts.columns else 'machine_id'
                if alerts_machine_col in alerts.columns:
                    alerts = alerts[alerts[alerts_machine_col].isin(factory_machines)]
                print(f"[DEBUG] Statistics filtered to factory {factory_id_int}")
            except ValueError:
                pass
        
        # Calculate statistics
        stats = {
            'total_machines': int(sensor_data['machine_id'].nunique()),
            'total_readings': len(sensor_data),
            'critical_alerts': len(alerts[alerts['Alert'].str.contains('CRITICAL', na=False)]),
            'warning_alerts': len(alerts[alerts['Alert'].str.contains('WARNING', na=False)]),
            'normal_readings': len(alerts[alerts['Alert'].str.contains('Normal', na=False)]),
            'avg_temperature': float(sensor_data['temperature'].mean()) if len(sensor_data) > 0 else 0,
            'max_temperature': float(sensor_data['temperature'].max()) if len(sensor_data) > 0 else 0,
            'avg_vibration': float(sensor_data['vibration'].mean()) if len(sensor_data) > 0 else 0,
            'max_vibration': float(sensor_data['vibration'].max()) if len(sensor_data) > 0 else 0,
            'timestamp': datetime.now().isoformat()
        }
        
        # Calculate health score
        total_anomalies = stats['critical_alerts'] + stats['warning_alerts']
        anomaly_rate = (total_anomalies / stats['total_readings']) * 100
        stats['system_health'] = round(max(0, 100 - anomaly_rate), 2)
        stats['anomaly_rate'] = round(anomaly_rate, 2)
        
        return jsonify(stats)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/add-reading', methods=['POST'])
def add_reading():
    """Append a single sensor reading into sensor_data.csv"""
    try:
        payload = request.get_json(silent=True) or {}

        factory_id = payload.get('factory_id')
        machine_id = payload.get('machine_id')
        temperature = payload.get('temperature')
        vibration = payload.get('vibration')
        timestamp = payload.get('timestamp')

        if factory_id is None or machine_id is None or temperature is None or vibration is None:
            return jsonify({'error': 'factory_id, machine_id, temperature, vibration are required'}), 400

        try:
            factory_id = int(factory_id)
            machine_id = int(machine_id)
            temperature = float(temperature)
            vibration = float(vibration)
        except (TypeError, ValueError):
            return jsonify({'error': 'factory_id and machine_id must be int; temperature and vibration must be numeric'}), 400

        sensor_path = os.path.join(DATA_DIR, 'sensor_data.csv')
        if os.path.exists(sensor_path):
            existing = pd.read_csv(sensor_path)
            existing = normalize_sensor_dataframe(existing)
            # Ensure factory_id column exists
            if 'factory_id' not in existing.columns:
                existing['factory_id'] = 1  # Default factory_id for existing data
            next_ts = get_next_timestamp(existing)
        else:
            existing = pd.DataFrame(columns=['machine_id', 'temperature', 'vibration', 'timestamp', 'factory_id'])
            next_ts = 1

        timestamp_value = coerce_timestamp_value(timestamp, next_ts)

        new_row = pd.DataFrame([
            {
                'machine_id': machine_id,
                'temperature': temperature,
                'vibration': vibration,
                'timestamp': timestamp_value,
                'factory_id': factory_id
            }
        ])

        final_df = pd.concat([existing, new_row], ignore_index=True)
        os.makedirs(DATA_DIR, exist_ok=True)
        final_df.to_csv(sensor_path, index=False)

        new_row = new_row.replace({np.nan: None})
        return jsonify({
            'status': 'ok',
            'added': new_row.to_dict('records')[0],
            'total_rows': len(final_df)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/alerts/recent')
def get_recent_alerts():
    """Get recent critical alerts"""
    try:
        factory_id = request.args.get('factory_id', None)
        
        alerts = load_alerts_data()
        sensor_data = load_sensor_data()
        
        # Filter by factory_id if provided
        if factory_id and 'factory_id' in sensor_data.columns:
            try:
                factory_id_int = int(factory_id)
                factory_machines = sensor_data[sensor_data['factory_id'] == factory_id_int]['machine_id'].unique()
                alerts_machine_col = 'Machine' if 'Machine' in alerts.columns else 'machine_id'
                if alerts_machine_col in alerts.columns:
                    alerts = alerts[alerts[alerts_machine_col].isin(factory_machines)]
                print(f"[DEBUG] Recent alerts filtered to factory {factory_id_int}")
            except ValueError:
                pass
        
        # Filter critical and warning alerts
        critical_alerts = alerts[
            (alerts['Alert'].str.contains('CRITICAL', na=False)) |
            (alerts['Alert'].str.contains('WARNING', na=False))
        ].head(50)

        return jsonify(dataframe_to_records(critical_alerts))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/machine/<int:machine_id>')
def get_machine_details(machine_id):
    """Get details for a specific machine"""
    try:
        sensor_data = load_sensor_data()
        alerts = load_alerts_data()
        alerts_machine_col = 'Machine' if 'Machine' in alerts.columns else 'machine_id'
        
        # Filter data for this machine
        machine_data = sensor_data[sensor_data['machine_id'] == machine_id]
        machine_alerts = alerts[alerts[alerts_machine_col] == machine_id]
        
        if len(machine_data) == 0:
            return jsonify({'error': 'Machine not found'}), 404
        
        insights = calculate_machine_insights(sensor_data, alerts, machine_id)

        recent_readings = dataframe_to_records(machine_data.tail(20))
        recent_alerts = dataframe_to_records(machine_alerts.tail(10))
        
        details = {
            'machine_id': machine_id,
            'total_readings': len(machine_data),
            'avg_temperature': float(machine_data['temperature'].mean()),
            'max_temperature': float(machine_data['temperature'].max()),
            'min_temperature': float(machine_data['temperature'].min()),
            'avg_vibration': float(machine_data['vibration'].mean()),
            'max_vibration': float(machine_data['vibration'].max()),
            'min_vibration': float(machine_data['vibration'].min()),
            'critical_alerts': len(machine_alerts[machine_alerts['Alert'].str.contains('CRITICAL', na=False)]),
            'warning_alerts': len(machine_alerts[machine_alerts['Alert'].str.contains('WARNING', na=False)]),
            'recent_readings': recent_readings,
            'recent_alerts': recent_alerts,
            'insights': insights
        }
        
        return jsonify(details)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/<format>')
def export_data(format):
    """Export data in various formats"""
    try:
        alerts = load_alerts_data()
        
        if format == 'json':
            return jsonify(dataframe_to_records(alerts))
        elif format == 'csv':
            return alerts.to_csv(index=False), 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename=alerts_export_{datetime.now().strftime("%Y%m%d")}.csv'
            }
        else:
            return jsonify({'error': 'Invalid format. Use json or csv'}), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/visualization/<filename>')
def get_visualization(filename):
    """Serve visualization images"""
    try:
        viz_dir = os.path.join(OUTPUT_DIR, 'visualizations')
        
        if not os.path.exists(viz_dir):
            return jsonify({'error': 'Visualizations directory not found'}), 404
        
        return send_from_directory(viz_dir, filename)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/insights')
def get_insights():
    """Get system-level insights and top machine risks (fast version)"""
    try:
        factory_id = request.args.get('factory_id', None)
        print(f"[DEBUG] /api/insights started with factory_id={factory_id}")
        
        sensor_data = load_sensor_data()
        alerts = load_alerts_data()
        
        # Filter by factory_id if provided
        if factory_id and 'factory_id' in sensor_data.columns:
            try:
                factory_id_int = int(factory_id)
                sensor_data = sensor_data[sensor_data['factory_id'] == factory_id_int]
                # Filter alerts based on machines in this factory
                factory_machines = sensor_data['machine_id'].unique()
                alerts_machine_col = 'Machine' if 'Machine' in alerts.columns else 'machine_id'
                if alerts_machine_col in alerts.columns:
                    alerts = alerts[alerts[alerts_machine_col].isin(factory_machines)]
                print(f"[DEBUG] Insights filtered to factory {factory_id_int}")
            except ValueError:
                pass

        if sensor_data.empty:
            print("[WARN] sensor_data is empty")
            return jsonify({
                'health_index': 0,
                'health_status': 'Critical',
                'top_risks': [],
                'generated_at': datetime.now().isoformat(),
                'message': 'No sensor data available'
            })

        # Quick calculation: use simple statistics instead of per-machine insights
        avg_temp = float(sensor_data['temperature'].mean())
        max_temp = float(sensor_data['temperature'].max())
        avg_vibration = float(sensor_data['vibration'].mean())
        max_vibration = float(sensor_data['vibration'].max())
        
        # Count critical/warning alerts
        critical_count = len(alerts[alerts['Alert'].str.contains('CRITICAL', na=False)]) if 'Alert' in alerts.columns else 0
        warning_count = len(alerts[alerts['Alert'].str.contains('WARNING', na=False)]) if 'Alert' in alerts.columns else 0
        
        # Calculate overall health
        anomaly_rate = ((critical_count + warning_count) / len(alerts)) * 100 if len(alerts) > 0 else 0
        health_score = max(0, 100 - anomaly_rate)
        
        status = 'Healthy' if health_score >= 90 else 'Warning' if health_score >= 70 else 'Critical'
        
        # Build insights for all machines
        machine_insights = []
        for machine_id in sensor_data['machine_id'].dropna().unique():
            try:
                machine_id_int = int(machine_id)
            except (TypeError, ValueError):
                continue

            insight = calculate_machine_insights(sensor_data, alerts, machine_id_int)
            if insight:
                machine_insights.append(insight)

        rising_trends = [
            item for item in machine_insights
            if item.get('predicted_failure_minutes') is not None
        ]
        rising_trends.sort(key=lambda item: item.get('predicted_failure_minutes', 0))

        top_risks = sorted(
            machine_insights,
            key=lambda item: item.get('risk_score', 0),
            reverse=True
        )[:5]
        
        result = {
            'health_index': round(health_score, 2),
            'health_status': status,
            'top_risks': top_risks,
            'rising_trends': rising_trends,
            'rising_trends_count': len(rising_trends),
            'total_machines': len(machine_insights),
            'generated_at': datetime.now().isoformat(),
            'message': 'System-wide insights calculated from aggregated data.'
        }
        print(
            f"[DEBUG] /api/insights completed in <1s: health={health_score}, "
            f"risks={len(top_risks)}, trends={len(rising_trends)}"
        )
        return jsonify(result)

    except Exception as e:
        error_msg = f"Error in /api/insights: {str(e)}"
        print(f"[ERROR] {error_msg}")
        import traceback
        traceback.print_exc()
        # Return a fallback response instead of 500
        return jsonify({
            'health_index': 0,
            'health_status': 'Unknown',
            'top_risks': [],
            'generated_at': datetime.now().isoformat(),
            'message': 'Insights calculation failed. Showing fallback data.'
        }), 200  # 200 instead of 500 so frontend doesn't fail


@app.route('/api/data/upload', methods=['POST'])
def upload_sensor_data():
    """Append uploaded CSV rows into sensor_data.csv"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400

        incoming = pd.read_csv(file)
        incoming = normalize_sensor_dataframe(incoming)

        required_cols = {'machine_id', 'temperature', 'vibration'}
        if not required_cols.issubset(set(incoming.columns)):
            return jsonify({'error': 'CSV must include machine_id, temperature, vibration columns'}), 400

        sensor_path = os.path.join(DATA_DIR, 'sensor_data.csv')
        if os.path.exists(sensor_path):
            existing = pd.read_csv(sensor_path)
            existing = normalize_sensor_dataframe(existing)
            # Ensure factory_id column exists in existing data
            if 'factory_id' not in existing.columns:
                existing['factory_id'] = 1
            max_timestamp = get_next_timestamp(existing) - 1
        else:
            existing = pd.DataFrame(columns=['machine_id', 'temperature', 'vibration', 'timestamp', 'factory_id'])
            max_timestamp = 0

        # Handle factory_id: default to 1 if not provided
        if 'factory_id' not in incoming.columns:
            incoming['factory_id'] = 1
            print(f"[INFO] factory_id not in CSV, defaulting to 1 for {len(incoming)} rows")

        if 'timestamp' not in incoming.columns:
            incoming['timestamp'] = range(int(max_timestamp) + 1, int(max_timestamp) + 1 + len(incoming))
        else:
            incoming['timestamp'] = coerce_numeric_series(incoming['timestamp'])
            if incoming['timestamp'].isna().any():
                start_ts = int(max_timestamp) + 1
                incoming.loc[incoming['timestamp'].isna(), 'timestamp'] = range(
                    start_ts,
                    start_ts + incoming['timestamp'].isna().sum()
                )

        final_df = pd.concat([existing, incoming], ignore_index=True)
        os.makedirs(DATA_DIR, exist_ok=True)
        final_df.to_csv(sensor_path, index=False)

        return jsonify({
            'status': 'ok',
            'appended_rows': len(incoming),
            'total_rows': len(final_df)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/dashboard')
def dashboard():
    """Streamlit dashboard redirect"""
    return '<html><body><h1>Streamlit Dashboard</h1><p>Run: <code>streamlit run dashboard.py</code></p></body></html>'

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(e):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error'}), 500

def check_data_files():
    """Check if required data files exist"""
    sensor_file = os.path.join(DATA_DIR, 'sensor_data.csv')
    alerts_file = get_alerts_path()
    
    if not os.path.exists(sensor_file):
        print(f"[!] Warning: {sensor_file} not found")
        print("    Run: python preprocess_data.py")
        return False
    
    if not os.path.exists(alerts_file):
        print(f"[!] Warning: {alerts_file} not found")
        print("    Run: python main_windows.py")
        return False
    
    return True

if __name__ == '__main__':
    print("=" * 70)
    print("[*] Starting Predictive Maintenance Dashboard Server")
    print("=" * 70)
    print()
    
    # Check data files
    if check_data_files():
        print("[OK] Data files found")
    else:
        print("[!] Some data files are missing. Dashboard may not display all data.")
    
    port = int(os.getenv('PORT', '5000'))

    print()
    print(f"[INFO] Dashboard URL: http://localhost:{port}")
    print("[API] Endpoints:")
    print("      - GET /api/data?file=sensor_data")
    print("      - GET /api/data?file=alerts")
    print("      - GET /api/statistics")
    print("      - GET /api/insights")
    print("      - POST /api/data/upload")
    print("      - POST /api/add-reading")
    print("      - GET /api/alerts/recent")
    print("      - GET /api/machine/<id>")
    print("      - GET /api/export/<format>")
    print()
    print("Press CTRL+C to stop the server")
    print("=" * 70)
    print()
    
    # Run server
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True,
        use_reloader=False
    )
