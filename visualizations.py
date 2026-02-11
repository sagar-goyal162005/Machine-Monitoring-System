"""
Real-Time Visualization Module
Creates interactive charts and graphs for anomaly detection
"""
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
from datetime import datetime
import os


class Visualizer:
    """Creates visualizations for predictive maintenance system"""
    
    def __init__(self, output_dir="output/visualizations"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # Set style
        sns.set_style("whitegrid")
        plt.rcParams['figure.figsize'] = (12, 6)
        plt.rcParams['font.size'] = 10
    
    def plot_temperature_distribution(self, data, save=True):
        """Plot temperature distribution with threshold line"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        # Histogram
        ax1.hist(data['temperature'], bins=50, color='skyblue', edgecolor='black', alpha=0.7)
        ax1.axvline(x=320, color='red', linestyle='--', linewidth=2, label='Critical Threshold (320K)')
        ax1.set_xlabel('Temperature (K)')
        ax1.set_ylabel('Frequency')
        ax1.set_title('Temperature Distribution')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Box plot
        ax2.boxplot(data['temperature'], vert=True)
        ax2.axhline(y=320, color='red', linestyle='--', linewidth=2, label='Critical Threshold')
        ax2.set_ylabel('Temperature (K)')
        ax2.set_title('Temperature Box Plot')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save:
            filepath = os.path.join(self.output_dir, 'temperature_distribution.png')
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"✅ Saved: {filepath}")
        
        plt.close()
        return fig
    
    def plot_vibration_analysis(self, data, save=True):
        """Plot vibration (rotational speed) analysis"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        # Histogram
        ax1.hist(data['vibration'], bins=50, color='coral', edgecolor='black', alpha=0.7)
        ax1.axvline(x=2000, color='red', linestyle='--', linewidth=2, label='Critical Threshold (2000 RPM)')
        ax1.set_xlabel('Rotational Speed (RPM)')
        ax1.set_ylabel('Frequency')
        ax1.set_title('Vibration Distribution')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Scatter plot
        sample = data.sample(min(1000, len(data)))
        scatter = ax2.scatter(sample['temperature'], sample['vibration'], 
                            c=sample['vibration'], cmap='coolwarm', alpha=0.6)
        ax2.axhline(y=2000, color='red', linestyle='--', linewidth=2, alpha=0.5)
        ax2.set_xlabel('Temperature (K)')
        ax2.set_ylabel('Rotational Speed (RPM)')
        ax2.set_title('Temperature vs Vibration')
        plt.colorbar(scatter, ax=ax2, label='RPM')
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save:
            filepath = os.path.join(self.output_dir, 'vibration_analysis.png')
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"✅ Saved: {filepath}")
        
        plt.close()
        return fig
    
    def plot_alert_timeline(self, alerts, save=True):
        """Plot alerts over time"""
        # Categorize alerts
        alerts['alert_type'] = alerts['Alert'].apply(lambda x: 
            'Critical' if 'CRITICAL' in str(x) else 
            'Warning' if 'WARNING' in str(x) else 'Normal'
        )
        
        # Create timeline
        fig, ax = plt.subplots(figsize=(14, 6))
        
        for alert_type, color in [('Critical', 'red'), ('Warning', 'orange'), ('Normal', 'green')]:
            subset = alerts[alerts['alert_type'] == alert_type]
            if len(subset) > 0:
                ax.scatter(subset['Time'], subset['Machine'], 
                          label=alert_type, color=color, alpha=0.6, s=20)
        
        ax.set_xlabel('Time')
        ax.set_ylabel('Machine ID')
        ax.set_title('Alert Timeline by Machine')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save:
            filepath = os.path.join(self.output_dir, 'alert_timeline.png')
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"✅ Saved: {filepath}")
        
        plt.close()
        return fig
    
    def plot_anomaly_heatmap(self, alerts, save=True):
        """Create heatmap of anomaly frequency by machine"""
        # Count alerts per machine
        alerts['alert_type'] = alerts['Alert'].apply(lambda x: 
            'Critical' if 'CRITICAL' in str(x) else 
            'Warning' if 'WARNING' in str(x) else 'Normal'
        )
        
        # Pivot table
        pivot = alerts.pivot_table(
            index='Machine',
            columns='alert_type',
            aggfunc='size',
            fill_value=0
        )
        
        # Select top 30 machines with most issues
        if 'Critical' in pivot.columns:
            top_machines = pivot.nlargest(30, 'Critical').index
        elif 'Warning' in pivot.columns:
            top_machines = pivot.nlargest(30, 'Warning').index
        else:
            top_machines = pivot.index[:30]
        
        pivot_top = pivot.loc[top_machines]
        
        # Create heatmap
        fig, ax = plt.subplots(figsize=(10, 12))
        sns.heatmap(pivot_top, annot=True, fmt='g', cmap='YlOrRd', 
                   cbar_kws={'label': 'Alert Count'}, ax=ax)
        ax.set_title('Alert Frequency by Machine (Top 30)')
        ax.set_xlabel('Alert Type')
        ax.set_ylabel('Machine ID')
        
        plt.tight_layout()
        
        if save:
            filepath = os.path.join(self.output_dir, 'anomaly_heatmap.png')
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"✅ Saved: {filepath}")
        
        plt.close()
        return fig
    
    def plot_summary_dashboard(self, data, alerts, save=True):
        """Create comprehensive summary dashboard"""
        fig = plt.figure(figsize=(16, 10))
        gs = fig.add_gridspec(3, 3, hspace=0.3, wspace=0.3)
        
        # 1. Alert Distribution Pie Chart
        ax1 = fig.add_subplot(gs[0, 0])
        alert_counts = alerts['Alert'].apply(lambda x: 
            'Critical' if 'CRITICAL' in str(x) else 
            'Warning' if 'WARNING' in str(x) else 'Normal'
        ).value_counts()
        colors = ['#ff4444' if 'Critical' == x else '#ffaa00' if 'Warning' == x else '#44ff44' 
                 for x in alert_counts.index]
        ax1.pie(alert_counts.values, labels=alert_counts.index, autopct='%1.1f%%',
               colors=colors, startangle=90)
        ax1.set_title('Alert Distribution')
        
        # 2. Temperature over time (sample)
        ax2 = fig.add_subplot(gs[0, 1:])
        sample_machines = data['machine_id'].unique()[:5]
        for machine in sample_machines:
            machine_data = data[data['machine_id'] == machine].head(100)
            ax2.plot(machine_data['timestamp'], machine_data['temperature'], 
                    label=f'Machine {machine}', alpha=0.7)
        ax2.axhline(y=320, color='red', linestyle='--', linewidth=2, alpha=0.5)
        ax2.set_xlabel('Time')
        ax2.set_ylabel('Temperature (K)')
        ax2.set_title('Temperature Trends (Sample Machines)')
        ax2.legend(fontsize=8)
        ax2.grid(True, alpha=0.3)
        
        # 3. Temperature histogram
        ax3 = fig.add_subplot(gs[1, 0])
        ax3.hist(data['temperature'], bins=30, color='skyblue', edgecolor='black', alpha=0.7)
        ax3.axvline(x=320, color='red', linestyle='--', linewidth=2)
        ax3.set_xlabel('Temperature (K)')
        ax3.set_ylabel('Frequency')
        ax3.set_title('Temperature Distribution')
        ax3.grid(True, alpha=0.3)
        
        # 4. Vibration histogram
        ax4 = fig.add_subplot(gs[1, 1])
        ax4.hist(data['vibration'], bins=30, color='coral', edgecolor='black', alpha=0.7)
        ax4.axvline(x=2000, color='red', linestyle='--', linewidth=2)
        ax4.set_xlabel('Rotational Speed (RPM)')
        ax4.set_ylabel('Frequency')
        ax4.set_title('Vibration Distribution')
        ax4.grid(True, alpha=0.3)
        
        # 5. Scatter plot
        ax5 = fig.add_subplot(gs[1, 2])
        sample = data.sample(min(500, len(data)))
        scatter = ax5.scatter(sample['temperature'], sample['vibration'], 
                            c=sample['vibration'], cmap='coolwarm', alpha=0.5, s=10)
        ax5.set_xlabel('Temperature (K)')
        ax5.set_ylabel('Rotational Speed (RPM)')
        ax5.set_title('Temp vs Vibration')
        plt.colorbar(scatter, ax=ax5, label='RPM')
        
        # 6. Statistics table
        ax6 = fig.add_subplot(gs[2, :])
        ax6.axis('off')
        
        stats_data = [
            ['Metric', 'Value'],
            ['─' * 30, '─' * 30],
            ['Total Machines', f"{data['machine_id'].nunique():,}"],
            ['Total Readings', f"{len(data):,}"],
            ['Avg Temperature', f"{data['temperature'].mean():.2f} K"],
            ['Max Temperature', f"{data['temperature'].max():.2f} K"],
            ['Avg Vibration', f"{data['vibration'].mean():.2f} RPM"],
            ['Max Vibration', f"{data['vibration'].max():.2f} RPM"],
            ['Critical Alerts', f"{len(alerts[alerts['Alert'].str.contains('CRITICAL', na=False)]):,}"],
            ['Warning Alerts', f"{len(alerts[alerts['Alert'].str.contains('WARNING', na=False)]):,}"],
            ['Anomaly Rate', f"{(len(alerts[~alerts['Alert'].str.contains('Normal', na=False)]) / len(data) * 100):.2f}%"],
        ]
        
        table = ax6.table(cellText=stats_data, cellLoc='left', loc='center',
                         colWidths=[0.4, 0.4])
        table.auto_set_font_size(False)
        table.set_fontsize(10)
        table.scale(1, 2)
        
        # Style header
        for i in range(2):
            table[(0, i)].set_facecolor('#4CAF50')
            table[(0, i)].set_text_props(weight='bold', color='white')
        
        fig.suptitle('Predictive Maintenance System - Summary Dashboard', 
                    fontsize=16, fontweight='bold', y=0.98)
        
        if save:
            filepath = os.path.join(self.output_dir, 'summary_dashboard.png')
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"✅ Saved: {filepath}")
        
        plt.close()
        return fig
    
    def generate_all_visualizations(self, data_path, alerts_path):
        """Generate all visualizations"""
        print("=" * 70)
        print("📊 Generating Visualizations")
        print("=" * 70)
        print()
        
        # Load data
        data = pd.read_csv(data_path)
        alerts = pd.read_csv(alerts_path)
        
        print(f"📂 Loaded {len(data):,} sensor readings")
        print(f"📂 Loaded {len(alerts):,} alert records")
        print()
        
        # Generate visualizations
        print("🎨 Creating visualizations...")
        self.plot_temperature_distribution(data)
        self.plot_vibration_analysis(data)
        self.plot_alert_timeline(alerts)
        self.plot_anomaly_heatmap(alerts)
        self.plot_summary_dashboard(data, alerts)
        
        print()
        print("=" * 70)
        print(f"✅ All visualizations saved to: {self.output_dir}")
        print("=" * 70)


if __name__ == "__main__":
    viz = Visualizer()
    viz.generate_all_visualizations(
        data_path="data/sensor_data.csv",
        alerts_path="output/alerts_windows.csv"
    )
