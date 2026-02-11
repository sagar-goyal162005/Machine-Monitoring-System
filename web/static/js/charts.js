// ==========================================================================
// Charts Configuration and Management
// ==========================================================================

let alertChart, statusChart, tempChart, vibrationChart;

// Initialize all charts when dashboard data is loaded
function updateCharts() {
    const factoryText = currentFactoryId ? `Factory ${currentFactoryId}` : 'All Factories';
    console.log(`\ud83c\udfa8 updateCharts() called - Updating overview charts for: ${factoryText}`, {
        sensorDataLength: dashboardData.sensorData?.length,
        alertsLength: dashboardData.alerts?.length,
        hasSensorData: !!dashboardData.sensorData,
        hasAlerts: !!dashboardData.alerts
    });
    
    initAlertChart();
    initStatusChart();
    initTemperatureChart();
    initVibrationChart();
    
    console.log('✅ All chart init functions called');
}

// Alert Distribution Pie Chart
function initAlertChart() {
    const ctx = document.getElementById('alertChart');
    if (!ctx) {
        console.warn('Alert chart canvas not found');
        return;
    }
    
    if (!window.Chart) {
        console.error('Chart.js not loaded');
        return;
    }
    
    const { critical, warnings, normal } = dashboardData;
    
    // Safety check for data
    if (critical === undefined || warnings === undefined || normal === undefined) {
        console.warn('Chart data not ready yet');
        return;
    }
    
    if (alertChart) {
        alertChart.destroy();
    }
    
    alertChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['🔥 Critical', '⚠️ Warning', '✅ Normal'],
            datasets: [{
                data: [critical, warnings, normal],
                backgroundColor: [
                    '#ef4444',
                    '#f59e0b',
                    '#10b981'
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 13,
                            family: 'Inter'
                        },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Machine Status Bar Chart
function initStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) {
        console.warn('Status chart canvas not found');
        return;
    }
    
    // Log factory filter context
    const factoryText = currentFactoryId ? `Factory ${currentFactoryId}` : 'All Factories';
    console.log(`Initializing machine status chart for: ${factoryText}`);
    
    if (!window.Chart) {
        console.error('Chart.js not loaded');
        return;
    }
    
    if (!dashboardData.alerts || dashboardData.alerts.length === 0) {
        console.warn('No alert data available for status chart');
        return;
    }
    
    // Group machines by status
    const machinesByStatus = {
        critical: 0,
        warning: 0,
        normal: 0
    };
    
    // Count unique machines in each category
    const machineStatus = new Map();
    dashboardData.alerts.forEach(alert => {
        const machine = alert.Machine || alert.machine_id;
        const alertText = alert.Alert || '';
        if (!machineStatus.has(machine)) {
            if (alertText.includes('CRITICAL')) {
                machineStatus.set(machine, 'critical');
            } else if (alertText.includes('WARNING')) {
                machineStatus.set(machine, 'warning');
            } else {
                machineStatus.set(machine, 'normal');
            }
        }
    });
    
    machineStatus.forEach(status => {
        if (status === 'critical') machinesByStatus.critical++;
        else if (status === 'warning') machinesByStatus.warning++;
        else machinesByStatus.normal++;
    });
    
    if (statusChart) {
        statusChart.destroy();
    }
    
    statusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Critical', 'Warning', 'Normal'],
            datasets: [{
                label: 'Number of Machines',
                data: [
                    machinesByStatus.critical,
                    machinesByStatus.warning,
                    machinesByStatus.normal
                ],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(16, 185, 129, 0.8)'
                ],
                borderColor: [
                    '#ef4444',
                    '#f59e0b',
                    '#10b981'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `Machines: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            family: 'Inter'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Inter',
                            weight: '600'
                        }
                    }
                }
            }
        }
    });
}

// Temperature Trends Line Chart (ApexCharts)
function initTemperatureChart() {
    const container = document.getElementById('tempChart');
    if (!container) {
        console.warn('Temperature chart container not found');
        return;
    }
    
    if (!window.ApexCharts) {
        console.error('ApexCharts not loaded');
        return;
    }
    
    let sourceData = dashboardData.sensorData || [];
    if (sourceData.length === 0 && dashboardData.alerts && dashboardData.alerts.length > 0) {
        sourceData = dashboardData.alerts
            .map(item => ({
                temperature: item.temperature ?? parseFloat(String(item.Temp || '').replace('K', ''))
            }))
            .filter(item => !isNaN(item.temperature));
    }
    if (sourceData.length === 0) {
        console.warn('No sensor data available for temperature chart');
        console.log('dashboardData:', dashboardData);
        return;
    }
    
    console.log(`Rendering temperature chart with ${sourceData.length} data points`);
    
    // Sample last 50 readings
    const sampleData = sourceData.slice(-50);
    
    const series = [{
        name: 'Temperature',
        data: sampleData.map((d, idx) => ({
            x: idx + 1,
            y: parseFloat(d.temperature)
        })).filter(point => !isNaN(point.y))
    }];
    
    if (series[0].data.length === 0) {
        console.warn('No valid temperature data points');
        return;
    }
    
    const options = {
        series: series,
        chart: {
            type: 'area',
            height: 300,
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: false
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
            colors: ['#667eea']
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.5,
                opacityFrom: 0.7,
                opacityTo: 0.1,
                stops: [0, 100]
            }
        },
        dataLabels: {
            enabled: false
        },
        xaxis: {
            type: 'numeric',
            title: {
                text: 'Time',
                style: {
                    fontSize: '12px',
                    fontWeight: 600
                }
            },
            labels: {
                formatter: function(val) {
                    return Math.round(val);
                }
            }
        },
        yaxis: {
            title: {
                text: 'Temperature (K)',
                style: {
                    fontSize: '12px',
                    fontWeight: 600
                }
            },
            labels: {
                formatter: function(val) {
                    return val.toFixed(1);
                }
            },
            min: 290,
            max: 330
        },
        annotations: {
            yaxis: [{
                y: 320,
                borderColor: '#ef4444',
                strokeDashArray: 5,
                label: {
                    text: 'Critical Threshold',
                    style: {
                        color: '#fff',
                        background: '#ef4444',
                        fontSize: '11px'
                    }
                }
            }]
        },
        colors: ['#667eea'],
        grid: {
            borderColor: '#f1f1f1',
            strokeDashArray: 3
        },
        tooltip: {
            theme: 'dark',
            x: {
                formatter: function(val) {
                    return 'Time: ' + val;
                }
            },
            y: {
                formatter: function(val) {
                    return val.toFixed(2) + ' K (' + (val - 273.15).toFixed(2) + '°C)';
                }
            }
        }
    };
    
    if (tempChart) {
        tempChart.destroy();
    }
    
    tempChart = new ApexCharts(container, options);
    tempChart.render();
}

// Vibration Analysis Line Chart (ApexCharts)
function initVibrationChart() {
    const container = document.getElementById('vibrationChart');
    if (!container) {
        console.warn('Vibration chart container not found');
        return;
    }
    
    if (!window.ApexCharts) {
        console.error('ApexCharts not loaded');
        return;
    }
    
    let sourceData = dashboardData.sensorData || [];
    if (sourceData.length === 0 && dashboardData.alerts && dashboardData.alerts.length > 0) {
        sourceData = dashboardData.alerts
            .map(item => ({
                vibration: item.vibration ?? parseFloat(String(item.Vibration || '').replace('RPM', ''))
            }))
            .filter(item => !isNaN(item.vibration));
    }
    if (sourceData.length === 0) {
        console.warn('No sensor data available for vibration chart');
        console.log('dashboardData:', dashboardData);
        return;
    }
    
    console.log(`Rendering vibration chart with ${sourceData.length} data points`);
    
    // Sample last 50 readings
    const sampleData = sourceData.slice(-50);
    
    const series = [{
        name: 'Vibration (RPM)',
        data: sampleData.map((d, idx) => ({
            x: idx + 1,
            y: parseFloat(d.vibration)
        })).filter(point => !isNaN(point.y))
    }];
    
    if (series[0].data.length === 0) {
        console.warn('No valid vibration data points');
        return;
    }
    
    const options = {
        series: series,
        chart: {
            type: 'area',
            height: 300,
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: false
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
            colors: ['#f59e0b']
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.5,
                opacityFrom: 0.7,
                opacityTo: 0.1,
                stops: [0, 100]
            }
        },
        dataLabels: {
            enabled: false
        },
        xaxis: {
            type: 'numeric',
            title: {
                text: 'Time',
                style: {
                    fontSize: '12px',
                    fontWeight: 600
                }
            },
            labels: {
                formatter: function(val) {
                    return Math.round(val);
                }
            }
        },
        yaxis: {
            title: {
                text: 'Rotational Speed (RPM)',
                style: {
                    fontSize: '12px',
                    fontWeight: 600
                }
            },
            labels: {
                formatter: function(val) {
                    return val.toFixed(0);
                }
            }
        },
        annotations: {
            yaxis: [{
                y: 2000,
                borderColor: '#ef4444',
                strokeDashArray: 5,
                label: {
                    text: 'Critical Threshold',
                    style: {
                        color: '#fff',
                        background: '#ef4444',
                        fontSize: '11px'
                    }
                }
            }]
        },
        colors: ['#f59e0b'],
        grid: {
            borderColor: '#f1f1f1',
            strokeDashArray: 3
        },
        tooltip: {
            theme: 'dark',
            x: {
                formatter: function(val) {
                    return 'Time: ' + val;
                }
            },
            y: {
                formatter: function(val) {
                    return val.toFixed(0) + ' RPM';
                }
            }
        }
    };
    
    if (vibrationChart) {
        vibrationChart.destroy();
    }
    
    vibrationChart = new ApexCharts(container, options);
    vibrationChart.render();
}

// Update charts with new data (for real-time updates)
function updateChartsWithNewData(newData) {
    const sourceData = dashboardData.sensorData || [];
    if (sourceData.length === 0) return;

    const sampleData = sourceData.slice(-50);
    const tempSeries = [{
        name: 'Temperature',
        data: sampleData
            .map((d, idx) => ({ x: idx + 1, y: parseFloat(d.temperature) }))
            .filter(point => !isNaN(point.y))
    }];
    const vibSeries = [{
        name: 'Vibration (RPM)',
        data: sampleData
            .map((d, idx) => ({ x: idx + 1, y: parseFloat(d.vibration) }))
            .filter(point => !isNaN(point.y))
    }];

    if (tempChart && tempSeries[0].data.length > 0) {
        tempChart.updateSeries(tempSeries);
    }

    if (vibrationChart && vibSeries[0].data.length > 0) {
        vibrationChart.updateSeries(vibSeries);
    }
}

// Setup chart button interactions
function setupChartButtons() {
    // Week/Month toggle for Alert Distribution
    const chartButtons = document.querySelectorAll('.chart-btn');
    chartButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active from siblings
            const siblings = this.parentElement.querySelectorAll('.chart-btn');
            siblings.forEach(s => s.classList.remove('active'));
            // Add active to clicked button
            this.classList.add('active');
            
            // Get chart type and time period
            const text = this.textContent.trim();
            if (text.includes('Week') || text.includes('Month')) {
                // Regenerate alert chart with different data
                // For now, just visual feedback - can implement data filtering later
                console.log('Chart period changed to:', text);
            }
        });
    });
}

console.log('✅ Charts JavaScript loaded');
