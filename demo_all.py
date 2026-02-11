"""
🎯 Complete Demo Script - Generates Everything!
Perfect for hackathon demonstrations
"""
import subprocess
import time
import os
import webbrowser

def print_banner(text):
    """Print a styled banner"""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80 + "\n")

def run_command(description, command, wait=True):
    """Run a command with progress indication"""
    print(f"🚀 {description}...")
    if wait:
        result = subprocess.run(command, shell=True, capture_output=False)
        if result.returncode == 0:
            print(f"   ✅ {description} completed!")
        else:
            print(f"   ⚠️  {description} had issues")
        return result.returncode == 0
    else:
        subprocess.Popen(command, shell=True)
        print(f"   ▶️  {description} started in background")
        return True

def main():
    print_banner("🎯 PREDICTIVE MAINTENANCE SYSTEM - COMPLETE DEMO")
    print("This script will:")
    print("  1. ✅ Verify data exists")
    print("  2. 📊 Generate visualizations")
    print("  3. 📄 Create HTML report")
    print("  4. 🌐 Start web server")
    print("  5. 🚀 Open dashboard in browser")
    print()
    input("Press ENTER to start...")
    
    # Step 1: Check data files
    print_banner("STEP 1: Checking Data Files")
    
    sensor_file = "data/sensor_data.csv"
    alerts_file = "output/alerts_windows.csv"
    
    if not os.path.exists(sensor_file):
        print(f"❌ {sensor_file} not found!")
        print("   Running preprocessing...")
        run_command("Data preprocessing", "python preprocess_data.py")
    else:
        print(f"✅ {sensor_file} found")
    
    if not os.path.exists(alerts_file):
        print(f"❌ {alerts_file} not found!")
        print("   Running analysis...")
        run_command("System analysis", "python main_windows.py")
    else:
        print(f"✅ {alerts_file} found")
    
    time.sleep(1)
    
    # Step 2: Generate visualizations
    print_banner("STEP 2: Generating Visualizations")
    success = run_command("Creating charts and graphs", "python visualizations.py")
    time.sleep(1)
    
    # Step 3: Generate HTML report
    print_banner("STEP 3: Creating Professional HTML Report")
    success = run_command("Generating executive report", "python report_generator.py")
    time.sleep(1)
    
    # Step 4: Show what was created
    print_banner("📊 GENERATED FILES")
    
    print("📁 Visualizations (in output/visualizations/):")
    viz_dir = "output/visualizations"
    if os.path.exists(viz_dir):
        for file in os.listdir(viz_dir):
            if file.endswith('.png'):
                print(f"   ✅ {file}")
    
    print("\n📁 Reports (in output/reports/):")
    report_dir = "output/reports"
    if os.path.exists(report_dir):
        for file in os.listdir(report_dir):
            if file.endswith('.html'):
                print(f"   ✅ {file}")
    
    print("\n📁 Data Files:")
    print(f"   ✅ data/sensor_data.csv")
    print(f"   ✅ output/alerts_windows.csv")
    
    time.sleep(2)
    
    # Step 5: Options menu
    print_banner("🎯 WHAT WOULD YOU LIKE TO DO?")
    print("1. 🌐 Start Web Dashboard (Modern UI)")
    print("2. 📄 Open HTML Report")
    print("3. 🖼️  Open Visualizations Folder")
    print("4. � Do Everything (All at once!)")
    print("5. Exit")
    
    choice = input("\nEnter your choice (1-5): ").strip()
    
    if choice == "1":
        print_banner("🌐 Starting Web Dashboard")
        print("Dashboard will open at: http://localhost:5000")
        print("Press CTRL+C in terminal to stop the server")
        time.sleep(2)
        webbrowser.open("http://localhost:5000")
        run_command("Web server", "python web_server.py", wait=True)
    
    elif choice == "2":
        print_banner("📄 Opening HTML Report")
        report_path = "output/reports/latest_report.html"
        if os.path.exists(report_path):
            webbrowser.open(os.path.abspath(report_path))
            print(f"✅ Opened: {report_path}")
        else:
            print(f"❌ Report not found: {report_path}")
    
    elif choice == "3":
        print_banner("🖼️  Opening Visualizations Folder")
        viz_path = "output/visualizations"
        if os.path.exists(viz_path):
            os.startfile(os.path.abspath(viz_path))
            print(f"✅ Opened: {viz_path}")
        else:
            print(f"❌ Folder not found: {viz_path}")
    
    elif choice == "4":
        print_banner("� LAUNCHING EVERYTHING!")
        
        # Open HTML report
        report_path = "output/reports/latest_report.html"
        if os.path.exists(report_path):
            webbrowser.open(os.path.abspath(report_path))
            time.sleep(1)
        
        # Open visualizations folder
        viz_path = "output/visualizations"
        if os.path.exists(viz_path):
            os.startfile(os.path.abspath(viz_path))
            time.sleep(1)
        
        # Start web server
        print("\n🌐 Starting web server...")
        print("   URL: http://localhost:5000")
        time.sleep(2)
        webbrowser.open("http://localhost:5000")
        
        print("\nPress CTRL+C to stop the web server")
        
        run_command("Web dashboard server", "python web_server.py", wait=True)
    
    else:
        print("\n👋 Goodbye!")
    
    print_banner("✨ DEMO COMPLETE")
    print("🏆 Your predictive maintenance system is ready for the hackathon!")
    print("\n📚 For more info, check:")
    print("   - FEATURES_GUIDE.md")
    print("   - RUN_GUIDE.md")
    print("   - README_IMPLEMENTATION.md")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        print("👋 Goodbye!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        input("\nPress ENTER to exit...")
