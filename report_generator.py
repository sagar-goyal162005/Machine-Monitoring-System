"""
HTML Report Generator
Creates professional HTML reports for predictive maintenance analysis
"""
import pandas as pd
from datetime import datetime
import os
import base64


class ReportGenerator:
    """Generates comprehensive HTML reports"""
    
    def __init__(self, output_dir="output/reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def encode_image(self, image_path):
        """Encode image to base64 for embedding"""
        if os.path.exists(image_path):
            with open(image_path, 'rb') as f:
                return base64.b64encode(f.read()).decode()
        return None
    
    def generate_html_report(self, data_path, alerts_path):
        """Generate comprehensive HTML report"""
        
        # Load data
        data = pd.read_csv(data_path)
        alerts = pd.read_csv(alerts_path)
        
        # Calculate statistics
        total_machines = data['machine_id'].nunique()
        total_readings = len(data)
        
        critical_alerts = len(alerts[alerts['Alert'].str.contains('CRITICAL', na=False)])
        warning_alerts = len(alerts[alerts['Alert'].str.contains('WARNING', na=False)])
        normal_readings = len(alerts[alerts['Alert'].str.contains('Normal', na=False)])
        
        anomaly_rate = ((critical_alerts + warning_alerts) / total_readings * 100)
        health_score = 100 - anomaly_rate
        
        avg_temp = data['temperature'].mean()
        max_temp = data['temperature'].max()
        min_temp = data['temperature'].min()
        
        avg_vib = data['vibration'].mean()
        max_vib = data['vibration'].max()
        min_vib = data['vibration'].min()
        
        # Get top anomalies
        top_anomalies = alerts[
            (alerts['Alert'].str.contains('CRITICAL', na=False)) |
            (alerts['Alert'].str.contains('WARNING', na=False))
        ].head(20)
        
        # Get visualization images
        viz_dir = "output/visualizations"
        images = {}
        for img_name in ['summary_dashboard', 'temperature_distribution', 
                        'vibration_analysis', 'alert_timeline', 'anomaly_heatmap']:
            img_path = os.path.join(viz_dir, f'{img_name}.png')
            encoded = self.encode_image(img_path)
            if encoded:
                images[img_name] = f"data:image/png;base64,{encoded}"
        
        # Generate HTML
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Predictive Maintenance System - Analysis Report</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }}
        
        .header h1 {{
            font-size: 2.5rem;
            margin-bottom: 10px;
        }}
        
        .header p {{
            font-size: 1.2rem;
            opacity: 0.9;
        }}
        
        .metrics {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        
        .metric-card {{
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }}
        
        .metric-card h3 {{
            font-size: 0.9rem;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 10px;
        }}
        
        .metric-card .value {{
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }}
        
        .metric-card.critical .value {{
            color: #ff4444;
        }}
        
        .metric-card.warning .value {{
            color: #ffaa00;
        }}
        
        .metric-card.success .value {{
            color: #44ff44;
        }}
        
        .section {{
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }}
        
        .section h2 {{
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }}
        
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin: 20px 0;
        }}
        
        .stat-item {{
            display: flex;
            justify-content: space-between;
            padding: 10px;
            background: #f9f9f9;
            border-radius: 5px;
        }}
        
        .stat-label {{
            font-weight: 600;
            color: #666;
        }}
        
        .stat-value {{
            color: #333;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        
        th {{
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
        }}
        
        td {{
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }}
        
        tr:hover {{
            background: #f5f5f5;
        }}
        
        .alert-critical {{
            color: #ff4444;
            font-weight: bold;
        }}
        
        .alert-warning {{
            color: #ffaa00;
            font-weight: bold;
        }}
        
        .visualization {{
            width: 100%;
            margin: 20px 0;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }}
        
        .footer {{
            text-align: center;
            padding: 20px;
            color: #666;
            margin-top: 30px;
        }}
        
        @media print {{
            body {{
                background: white;
            }}
            .container {{
                max-width: 100%;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🔧 Predictive Maintenance System</h1>
            <p>AI-Powered Real-Time Anomaly Detection Report</p>
            <p style="font-size: 0.9rem; margin-top: 10px;">Generated: {datetime.now().strftime('%B %d, %Y at %H:%M:%S')}</p>
        </div>
        
        <!-- KPI Metrics -->
        <div class="metrics">
            <div class="metric-card">
                <h3>🏭 Total Machines</h3>
                <div class="value">{total_machines:,}</div>
            </div>
            <div class="metric-card">
                <h3>📊 Total Readings</h3>
                <div class="value">{total_readings:,}</div>
            </div>
            <div class="metric-card critical">
                <h3>🔥 Critical Alerts</h3>
                <div class="value">{critical_alerts:,}</div>
            </div>
            <div class="metric-card warning">
                <h3>⚠️ Warnings</h3>
                <div class="value">{warning_alerts:,}</div>
            </div>
            <div class="metric-card success">
                <h3>💚 System Health</h3>
                <div class="value">{health_score:.1f}%</div>
            </div>
        </div>
        
        <!-- Executive Summary -->
        <div class="section">
            <h2>📋 Executive Summary</h2>
            <p style="margin-bottom: 20px;">
                This report provides a comprehensive analysis of the predictive maintenance system 
                monitoring <strong>{total_machines:,} machines</strong> across <strong>{total_readings:,} sensor readings</strong>.
                The system detected <strong>{critical_alerts + warning_alerts:,} anomalies</strong> ({anomaly_rate:.2f}% anomaly rate),
                enabling proactive maintenance to prevent potential failures.
            </p>
            
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">🌡️ Avg Temperature:</span>
                    <span class="stat-value">{avg_temp:.2f} K ({avg_temp - 273.15:.2f}°C)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🌡️ Max Temperature:</span>
                    <span class="stat-value">{max_temp:.2f} K ({max_temp - 273.15:.2f}°C)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📳 Avg Vibration:</span>
                    <span class="stat-value">{avg_vib:.2f} RPM</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📳 Max Vibration:</span>
                    <span class="stat-value">{max_vib:.2f} RPM</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">✅ Normal Readings:</span>
                    <span class="stat-value">{normal_readings:,} ({normal_readings/total_readings*100:.1f}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🚨 Anomaly Rate:</span>
                    <span class="stat-value">{anomaly_rate:.2f}%</span>
                </div>
            </div>
        </div>
        
        <!-- Detection Criteria -->
        <div class="section">
            <h2>🎯 Detection Criteria</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">🔥 Critical Temperature:</span>
                    <span class="stat-value">> 320 K (47°C)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">⚠️ Temperature Spike:</span>
                    <span class="stat-value">> 15 K deviation</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🔥 Excessive Vibration:</span>
                    <span class="stat-value">> 2000 RPM</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">⚠️ Vibration Spike:</span>
                    <span class="stat-value">> 500 RPM deviation</span>
                </div>
            </div>
        </div>
        
        <!-- Summary Dashboard -->
        {f'<div class="section"><h2>📊 Summary Dashboard</h2><img src="{images["summary_dashboard"]}" class="visualization" alt="Summary Dashboard"></div>' if 'summary_dashboard' in images else ''}
        
        <!-- Top Critical Alerts -->
        <div class="section">
            <h2>🚨 Top Critical Alerts</h2>
            {f'''<table>
                <thead>
                    <tr>
                        <th>Machine ID</th>
                        <th>Time</th>
                        <th>Temperature</th>
                        <th>Vibration</th>
                        <th>Alert Status</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join([f'''<tr>
                        <td>{row.get("Machine", "N/A")}</td>
                        <td>{row.get("Time", "N/A")}</td>
                        <td>{row.get("Temp", "N/A")}</td>
                        <td>{row.get("Vibration", "N/A")}</td>
                        <td class="{'alert-critical' if 'CRITICAL' in str(row.get('Alert', '')) else 'alert-warning'}">{row.get("Alert", "N/A")}</td>
                    </tr>''' for _, row in top_anomalies.iterrows()])}
                </tbody>
            </table>''' if len(top_anomalies) > 0 else '<p>✅ No critical alerts detected. All systems operating normally.</p>'}
        </div>
        
        <!-- Visualizations -->
        {f'<div class="section"><h2>🌡️ Temperature Analysis</h2><img src="{images["temperature_distribution"]}" class="visualization" alt="Temperature Analysis"></div>' if 'temperature_distribution' in images else ''}
        
        {f'<div class="section"><h2>📳 Vibration Analysis</h2><img src="{images["vibration_analysis"]}" class="visualization" alt="Vibration Analysis"></div>' if 'vibration_analysis' in images else ''}
        
        {f'<div class="section"><h2>📅 Alert Timeline</h2><img src="{images["alert_timeline"]}" class="visualization" alt="Alert Timeline"></div>' if 'alert_timeline' in images else ''}
        
        {f'<div class="section"><h2>🔥 Anomaly Heatmap</h2><img src="{images["anomaly_heatmap"]}" class="visualization" alt="Anomaly Heatmap"></div>' if 'anomaly_heatmap' in images else ''}
        
        <!-- Recommendations -->
        <div class="section">
            <h2>💡 Recommendations</h2>
            <ul style="line-height: 2;">
                <li><strong>Immediate Action:</strong> Inspect machines with critical temperature or vibration alerts</li>
                <li><strong>Preventive Maintenance:</strong> Schedule maintenance for machines showing warning patterns</li>
                <li><strong>Monitoring:</strong> Increase monitoring frequency for high-risk machines</li>
                <li><strong>Threshold Tuning:</strong> Review and adjust detection thresholds based on operating conditions</li>
                <li><strong>Training:</strong> Ensure maintenance teams are familiar with alert categories and responses</li>
            </ul>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <p>🚀 <strong>Real-Time Predictive Maintenance System</strong></p>
            <p>Powered by AI & Streaming Analytics | Built for Hack for Green Bharat 2026</p>
            <p style="margin-top: 10px; font-size: 0.9rem;">
                Report generated on {datetime.now().strftime('%B %d, %Y at %H:%M:%S')}
            </p>
        </div>
    </div>
</body>
</html>
"""
        
        # Save report
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_path = os.path.join(self.output_dir, f'maintenance_report_{timestamp}.html')
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Also save as latest
        latest_path = os.path.join(self.output_dir, 'latest_report.html')
        with open(latest_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return report_path, latest_path


def generate_report():
    """Main function to generate report"""
    print("=" * 70)
    print("📄 Generating HTML Report")
    print("=" * 70)
    print()
    
    generator = ReportGenerator()
    
    try:
        report_path, latest_path = generator.generate_html_report(
            data_path="data/sensor_data.csv",
            alerts_path="output/alerts_windows.csv"
        )
        
        print(f"✅ Report generated successfully!")
        print(f"📁 Saved to: {report_path}")
        print(f"📁 Latest: {latest_path}")
        print()
        print("💡 Open the HTML file in your browser to view the report")
        print("=" * 70)
        
        return report_path
        
    except Exception as e:
        print(f"❌ Error generating report: {e}")
        return None


if __name__ == "__main__":
    generate_report()
