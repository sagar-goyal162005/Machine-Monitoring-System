"""
🚀 Quick Start - Launch Everything Automatically!
No menus, no questions - just runs!
"""
import subprocess
import time
import os
import webbrowser

def print_banner(text):
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80 + "\n")

print_banner("🚀 PREDICTIVE MAINTENANCE SYSTEM - AUTO START")

# Check if data exists, if not create it
if not os.path.exists("data/sensor_data.csv"):
    print("📊 Preparing data...")
    subprocess.run("python preprocess_data.py", shell=True)

if not os.path.exists("output/alerts_windows.csv"):
    print("🔍 Running analysis...")
    subprocess.run("python main_windows.py", shell=True)

# Generate visualizations
print("📊 Creating visualizations...")
subprocess.run("python visualizations.py", shell=True, capture_output=True)

# Generate report
print("📄 Generating report...")
subprocess.run("python report_generator.py", shell=True, capture_output=True)

print_banner("✅ EVERYTHING READY!")
print("🌐 Starting web dashboard at http://localhost:5000")
print("📄 Opening HTML report in browser...")
print("🖼️  Opening visualizations folder...")
print("\nPress CTRL+C to stop the server\n")

time.sleep(2)

# Open report
report_path = os.path.abspath("output/reports/latest_report.html")
if os.path.exists(report_path):
    webbrowser.open(report_path)
    time.sleep(1)

# Open visualizations folder
viz_path = os.path.abspath("output/visualizations")
if os.path.exists(viz_path):
    os.startfile(viz_path)
    time.sleep(1)

# Start web server and open browser
webbrowser.open("http://localhost:5000")
time.sleep(1)

print_banner("🎯 WEB DASHBOARD STARTING...")
subprocess.run("python web_server.py", shell=True)
