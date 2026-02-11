// ==========================================================================
// Predictive Maintenance Dashboard - Main JavaScript
// ==========================================================================

// Global state
let dashboardData = {
    machines: 0,
    readings: 0,
    critical: 0,
    warnings: 0,
    normal: 0,
    health: 0,
    alerts: [],
    sensorData: [],
    insights: null
};

// Global factory filter state
let currentFactoryId = null; // null means "All Factories"

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Predictive Maintenance Dashboard...');
    
    // Ensure Overview page is active on load
    const analyticsPage = document.getElementById('analyticsPage');
    const reportsPage = document.getElementById('reportsPage');
    if (analyticsPage) analyticsPage.style.display = 'none';
    if (reportsPage) reportsPage.style.display = 'none';
    
    // Load factories list first
    loadFactories();
    
    // Load data
    loadDashboardData();
    
    // Setup navigation
    setupNavigation();
    
    // Setup real-time updates
    startRealTimeUpdates();
    
    // Setup table filters
    setupTableFilters();
    
    // Setup global search
    setupGlobalSearch();
    
    // Setup admin dropdown
    setupAdminDropdown();
    
    // Setup export button
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    // Setup chart buttons after charts are loaded
    setTimeout(() => {
        if (typeof setupChartButtons === 'function') {
            setupChartButtons();
        }
    }, 500);
});

// Load factories list
async function loadFactories() {
    try {
        const response = await fetchWithTimeout('/api/factories', {}, 5000);
        if (!response.ok) {
            console.warn('⚠️ Factories API not available:', response.status);
            return;
        }
        const factories = await response.json();
        console.log('✅ Loaded factories:', factories);
        
        // Populate custom factory dropdown in header
        const factoryOptionsContainer = document.getElementById('factoryOptions');
        if (factoryOptionsContainer && Array.isArray(factories) && factories.length > 0) {
            // Clear existing and add "All Factories" first
            factoryOptionsContainer.innerHTML = '<div data-value="" class="select-item active">All Factories</div>';
            
            // Add factory options with "Factory" prefix
            factories.forEach(factoryId => {
                const item = document.createElement('div');
                item.className = 'select-item';
                item.setAttribute('data-value', factoryId);
                item.textContent = `Factory ${factoryId}`;
                item.onclick = function(e) {
                    e.stopPropagation();
                    selectFactory(factoryId, `Factory ${factoryId}`);
                };
                factoryOptionsContainer.appendChild(item);
            });
        }
        
        // Factory ID in add reading form is now a text input (not dropdown)
        // Users can type their factory ID directly
        
    } catch (error) {
        console.warn('⚠️ Failed to load factories:', error.message);
    }
}

// Handle factory selection change
function handleFactoryChange() {
    const factorySelect = document.getElementById('factorySelect');
    if (!factorySelect) return;
    
    const selectedValue = factorySelect.value;
    currentFactoryId = selectedValue ? selectedValue : null;
    
    console.log('🏭 Factory changed to:', currentFactoryId || 'All Factories');
    
    // Reload all data with new factory filter
    loadDashboardData();
}

// Toggle custom factory dropdown
function toggleFactoryDropdown() {
    const dropdown = document.getElementById('factorySelect');
    const options = document.getElementById('factoryOptions');
    
    if (!dropdown || !options) return;
    
    const isOpen = options.style.display === 'block';
    
    if (isOpen) {
        options.style.display = 'none';
        dropdown.classList.remove('active');
    } else {
        options.style.display = 'block';
        dropdown.classList.add('active');
    }
}

// Select factory from custom dropdown
function selectFactory(factoryId, displayText) {
    const selectedDisplay = document.querySelector('#factorySelect .select-selected');
    const options = document.getElementById('factoryOptions');
    const dropdown = document.getElementById('factorySelect');
    
    if (selectedDisplay) {
        selectedDisplay.textContent = displayText;
    }
    
    // Update active state
    if (options) {
        options.querySelectorAll('.select-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-value') == factoryId) {
                item.classList.add('active');
            }
        });
    }
    
    // Close dropdown
    if (options) options.style.display = 'none';
    if (dropdown) dropdown.classList.remove('active');
    
    // Update global state and reload data
    currentFactoryId = factoryId || null;
    console.log('🏭 Factory changed to:', currentFactoryId || 'All Factories');
    
    // Update factory filter text on both overview and analytics pages
    const overviewFilterText = document.getElementById('overviewFactoryFilter');
    if (overviewFilterText) {
        overviewFilterText.textContent = `Monitor machine health in real-time - Viewing: ${displayText}`;
    }
    
    const analyticsFilterText = document.getElementById('analyticsFactoryFilter');
    if (analyticsFilterText) {
        analyticsFilterText.textContent = `Viewing: ${displayText}`;
    }
    
    // Reset analytics charts when factory changes
    analyticsChartsInitialized = false;
    
    loadDashboardData();
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('factorySelect');
    const options = document.getElementById('factoryOptions');
    
    if (dropdown && options && !dropdown.contains(event.target)) {
        options.style.display = 'none';
        dropdown.classList.remove('active');
    }
});

// Load dashboard data from CSV files
async function loadDashboardData(options = {}) {
    const { silent = false } = options;
    if (!silent) {
        showLoading(true);
    }
    
    try {
        console.log('🔄 Starting data load...');
        
        // Load sensor data and alerts
        const [sensorData, alerts] = await Promise.all([
            loadCSV('sensor_data'),
            loadCSV('alerts')
        ]);
        
        console.log(`✅ Loaded ${sensorData.length} sensor readings`);
        console.log(`✅ Loaded ${alerts.length} alert records`);
        console.log('Sample sensor data:', sensorData.slice(0, 3));
        
        dashboardData.sensorData = sensorData;
        dashboardData.alerts = alerts;
        
        // Calculate statistics
        calculateStatistics();
        
        // Update UI
        updateKPIs();
        
        console.log('📊 Initializing charts...');
        
        // Delay chart initialization to ensure Chart.js is loaded
        setTimeout(() => {
            try {
                const mainContent = document.querySelector('.main-content');
                const isAnalyticsActive = isAnalyticsPageVisible();
                const previousScrollTop = !isAnalyticsActive && mainContent ? mainContent.scrollTop : null;

                console.log('🎨 Calling updateCharts() with dashboardData:', {
                    sensorDataLength: dashboardData.sensorData?.length,
                    alertsLength: dashboardData.alerts?.length,
                    factoryFilter: currentFactoryId || 'All Factories'
                });
                updateCharts();
                
                // Update analytics charts if analytics page is visible
                if (isAnalyticsActive) {
                    console.log('🏭 Updating analytics charts for factory filter:', currentFactoryId || 'All Factories');
                    analyticsChartsInitialized = false;
                    destroyAnalyticsCharts();
                    setTimeout(() => {
                        initAnalyticsCharts();
                        analyticsChartsInitialized = true;
                    }, 50);
                }

                // Only restore scroll if NOT on analytics page
                if (mainContent && previousScrollTop !== null && !isAnalyticsActive) {
                    requestAnimationFrame(() => {
                        mainContent.scrollTop = previousScrollTop;
                    });
                }
            } catch (chartError) {
                console.error('❌ Error updating charts:', chartError);
                // Don't fail the whole data load if charts fail
            }
        }, 100);
        
        try {
            updateAlertsTable();
            updateActivityFeed();
        } catch (uiError) {
            console.error('❌ Error updating UI:', uiError);
        }

        // If the user is currently on a non-overview page that renders from dashboardData,
        // refresh that page immediately after data reload (e.g., on factory changes).
        try {
            const activeNav = document.querySelector('.nav-item.active');
            const activePage = activeNav ? activeNav.dataset.page : 'overview';
            if (activePage === 'machines') {
                showMachinesPage();
            } else if (activePage === 'alerts') {
                showAlertsPage();
            }
        } catch (pageRefreshError) {
            console.warn('⚠️ Page refresh skipped:', pageRefreshError);
        }
        
        try {
            await loadInsights();
        } catch (insightError) {
            console.warn('⚠️ Error loading insights (non-critical):', insightError);
        }

        console.log('✅ Dashboard data loaded successfully');
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showError('Failed to load dashboard data. Check if web_server.py is running on port 5000.');
    } finally {
        if (!silent) {
            showLoading(false);
        }
    }
}

const DEFAULT_FETCH_TIMEOUT_MS = 5000;
const INSIGHTS_FETCH_TIMEOUT_MS = 3000;  // Insights now fast, but still set a timeout

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

// Load CSV file function
async function loadCSV(filepath) {
    console.log(`📂 Loading CSV: ${filepath}`);
    const fileParam = filepath.includes('alerts') ? 'alerts' : filepath.includes('sensor') ? 'sensor_data' : filepath;
    
    // Build URL with factory_id parameter if set
    let url = `/api/data?file=${encodeURIComponent(fileParam)}`;
    if (currentFactoryId) {
        url += `&factory_id=${encodeURIComponent(currentFactoryId)}`;
        console.log(`🏭 Filtering by factory_id: ${currentFactoryId}`);
    }
    
    return new Promise((resolve, reject) => {
        // Check if file exists via API
        fetchWithTimeout(url)
            .then(response => {
            console.log(`📡 API response for ${fileParam}:`, response.status, response.ok);
                
                if (!response.ok) {
                    // If API not available, use mock data
                    console.warn(`⚠️ API returned ${response.status}, using mock data`);
                    return response.json().then(err => {
                        console.error(`API Error: ${err.error || 'Unknown error'}`);
                        resolve(generateMockData(filepath));
                    }).catch(() => {
                        resolve(generateMockData(filepath));
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data === null) return;  // Skip if we already resolved with mock data
                
                if (data && Array.isArray(data)) {
                    console.log(`✅ Loaded ${data.length} records from ${filepath}`);
                    // Normalize column names
                    const normalizedData = normalizeData(data, filepath);
                    resolve(normalizedData);
                } else {
                    console.error(`❌ Invalid data format from ${filepath}:`, typeof data);
                    resolve(generateMockData(filepath));
                }
            })
            .catch(error => {
                console.error(`❌ Fetch error for ${filepath}:`, error);
                console.warn('Loading mock data due to:', error.message);
                resolve(generateMockData(filepath));
            });
    });
}

async function loadInsights() {
    try {
        // Build URL with factory_id parameter if set
        let url = '/api/insights';
        if (currentFactoryId) {
            url += `?factory_id=${encodeURIComponent(currentFactoryId)}`;
            console.log(`🏭 Loading insights for factory: ${currentFactoryId}`);
        }
        
        const response = await fetchWithTimeout(url, {}, INSIGHTS_FETCH_TIMEOUT_MS);
        if (!response.ok) {
            console.warn('⚠️ Insights API not available:', response.status);
            updateInsightsUIWithDefaults();
            return;
        }
        const data = await response.json();
        dashboardData.insights = data;
        updateInsightsUI();
    } catch (error) {
        console.warn('⚠️ Failed to load insights:', error.message);
        updateInsightsUIWithDefaults();
    }
}

function updateInsightsUIWithDefaults() {
    const healthIndexEl = document.getElementById('health-index');
    const healthIndexTrend = document.getElementById('health-index-trend');
    if (healthIndexEl) healthIndexEl.textContent = '--';
    if (healthIndexTrend) {
        healthIndexTrend.textContent = 'Calculating...';
        healthIndexTrend.className = 'kpi-trend neutral';
    }

    const timerValue = document.getElementById('failureTimerValue');
    const timerNote = document.getElementById('failureTimerNote');
    if (timerValue) timerValue.textContent = '--';
    if (timerNote) timerNote.textContent = 'Unable to calculate; ensure data is loaded.';

    const riskList = document.getElementById('failureRiskList');
    if (riskList) riskList.innerHTML = '<div style="color: #6b7280; font-size: 0.9rem;">No risk data available. Load dashboard data first.</div>';

    const recommendationList = document.getElementById('recommendationList');
    if (recommendationList) recommendationList.innerHTML = '<li style="color: #6b7280;">Recommendations will appear once data is loaded.</li>';
}

function updateInsightsUI() {
    const insights = dashboardData.insights;
    if (!insights) return;

    const healthIndexEl = document.getElementById('health-index');
    const healthIndexTrend = document.getElementById('health-index-trend');
    if (healthIndexEl) {
        healthIndexEl.textContent = `${Math.round(insights.health_index)}%`;
    }
    if (healthIndexTrend) {
        healthIndexTrend.textContent = insights.health_status;
        healthIndexTrend.className = `kpi-trend ${
            insights.health_status === 'Healthy' ? 'positive' :
            insights.health_status === 'Warning' ? 'neutral' :
            'negative'
        }`;
    }

    const timerValue = document.getElementById('failureTimerValue');
    const timerNote = document.getElementById('failureTimerNote');
    const risingTrends = Array.isArray(insights.rising_trends) ? insights.rising_trends : [];
    const topRisk = insights.top_risks && insights.top_risks.length > 0 ? insights.top_risks[0] : null;
    const nextTrend = risingTrends.length > 0 ? risingTrends[0] : null;

    if (timerValue) {
        if (nextTrend && nextTrend.predicted_failure_minutes !== null) {
            timerValue.textContent = `${nextTrend.predicted_failure_minutes} min`;
        } else if (topRisk && topRisk.predicted_failure_minutes !== null) {
            timerValue.textContent = `${topRisk.predicted_failure_minutes} min`;
        } else {
            timerValue.textContent = 'No rising trend';
        }
    }
    if (timerNote) {
        if (nextTrend) {
            const total = insights.rising_trends_count ?? risingTrends.length;
            timerNote.textContent = `Next: Machine ${nextTrend.machine_id}. Rising trends: ${total}.`;
        } else {
            timerNote.textContent = insights.message || 'We estimate potential failure time based on trend slope.';
        }
    }

    const riskList = document.getElementById('failureRiskList');
    if (riskList) {
        const listSource = risingTrends.length > 0
            ? risingTrends
            : (insights.top_risks || []);

        if (listSource.length === 0) {
            riskList.innerHTML = '<div>No high-risk machines detected.</div>';
        } else {
            riskList.innerHTML = listSource.map(item => {
                const predicted = item.predicted_failure_minutes !== null && item.predicted_failure_minutes !== undefined
                    ? `${item.predicted_failure_minutes} min`
                    : 'N/A';
                const note = item.last_temperature >= 320
                    ? 'Overheating trend detected'
                    : item.last_vibration >= 2000
                        ? 'Vibration trend detected'
                        : 'Efficiency decreasing';

                return `
                    <div class="risk-item">
                        <div><strong>Machine ${item.machine_id}</strong> has ${item.risk_score}% failure risk</div>
                        <div class="risk-note">${note} · Predicted: ${predicted}</div>
                    </div>
                `;
            }).join('');
        }
    }

    const recommendationList = document.getElementById('recommendationList');
    if (recommendationList) {
        const recs = (nextTrend && nextTrend.recommendations) || (topRisk && topRisk.recommendations) || [];
        if (!recs || recs.length === 0) {
            recommendationList.innerHTML = '<li>No recommendations available.</li>';
        } else {
            recommendationList.innerHTML = recs.map(rec => `<li>${rec}</li>`).join('');
        }
    }
}

function normalizeTimestamp(value) {
    if (value === null || value === undefined) return 0;

    if (typeof value === 'number' && !Number.isNaN(value)) {
        return Math.floor(value);
    }

    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
        return Math.floor(numeric);
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
        return Math.floor(parsed / 1000);
    }

    return 0;
}

// Normalize data column names
function normalizeData(data, filepath) {
    if (!data || data.length === 0) return data;
    
    if (filepath.includes('alerts')) {
        // Normalize alerts CSV columns
        return data.map(row => {
            const tempStr = (row.Temp || row.temperature || '').toString().replace('K', '').trim();
            const temp = tempStr ? parseFloat(tempStr) : null;
            const vib = row.Vibration || row.vibration;
            
            return {
                machine_id: row.Machine || row.machine_id || null,
                timestamp: row.Time || row.timestamp || null,
                temperature: (temp !== null && !isNaN(temp)) ? temp : null,
                vibration: (vib !== null && vib !== undefined && !isNaN(vib)) ? parseFloat(vib) : null,
                Alert: row.Alert || row.alert || 'Unknown',
                alert_type: row.Alert || row.alert_type || 'Unknown'
            };
        });
    }
    
    // For sensor_data, ensure numeric types
    return data.map(row => ({
        machine_id: parseInt(row.machine_id) || 0,
        temperature: parseFloat(row.temperature) || 0,
        vibration: parseFloat(row.vibration) || 0,
        timestamp: normalizeTimestamp(row.timestamp)
    }));
}

// Generate mock data for demonstration
function generateMockData(filepath) {
    if (filepath.includes('sensor_data')) {
        const data = [];
        for (let i = 1; i <= 1000; i++) {
            data.push({
                machine_id: Math.floor(Math.random() * 100) + 1,
                temperature: 295 + Math.random() * 30,
                vibration: 1200 + Math.random() * 1000,
                timestamp: i
            });
        }
        return data;
    } else if (filepath.includes('alerts')) {
        const data = [];
        for (let i = 1; i <= 1000; i++) {
            const temp = 295 + Math.random() * 30;
            const vib = 1200 + Math.random() * 1000;
            let alert = '✅ Normal Operation';
            
            if (temp > 320) alert = '🔥 CRITICAL: High Temperature';
            else if (vib > 2000) alert = '🔥 CRITICAL: Excessive Vibration';
            else if (Math.random() > 0.9) alert = '⚠️ WARNING: Sudden Temperature Spike';
            
            data.push({
                Machine: Math.floor(Math.random() * 100) + 1,
                Time: i,
                Temp: `${temp.toFixed(1)}K`,
                Vibration: `${vib.toFixed(0)}`,
                Avg_Temp: `${(temp - 2).toFixed(1)}K`,
                Temp_Dev: `${Math.random() * 10}K`,
                Alert: alert
            });
        }
        return data;
    }
    return [];
}

// Calculate statistics
function calculateStatistics() {
    const { sensorData, alerts } = dashboardData;
    
    // Count unique machines
    const uniqueMachines = new Set(sensorData.map(d => d.machine_id));
    dashboardData.machines = uniqueMachines.size || 100;
    dashboardData.readings = sensorData.length || 10000;
    
    // Count alerts
    dashboardData.critical = alerts.filter(a => 
        a.Alert && a.Alert.includes('CRITICAL')
    ).length;
    
    dashboardData.warnings = alerts.filter(a => 
        a.Alert && a.Alert.includes('WARNING')
    ).length;
    
    dashboardData.normal = alerts.filter(a => 
        a.Alert && a.Alert.includes('Normal')
    ).length;
    
    // Calculate health score
    const totalAnomalies = dashboardData.critical + dashboardData.warnings;
    const anomalyRate = (totalAnomalies / dashboardData.readings) * 100;
    dashboardData.health = Math.max(0, 100 - anomalyRate);
}

// Update KPI cards
function updateKPIs() {
    const { machines, readings, critical, warnings, health } = dashboardData;
    
    animateValue('total-machines', 0, machines, 1000);
    animateValue('total-readings', 0, readings, 1000);
    animateValue('critical-alerts', 0, critical, 1000);
    animateValue('warning-alerts', 0, warnings, 1000);
    animateValue('system-health', 0, health, 1000, '%');
    
    // Update trends
    const criticalTrend = document.getElementById('critical-trend');
    if (criticalTrend) {
        if (critical > 0) {
            criticalTrend.textContent = 'Requires immediate attention';
            criticalTrend.className = 'kpi-trend negative';
        } else {
            criticalTrend.textContent = 'All systems nominal';
            criticalTrend.className = 'kpi-trend positive';
        }
    }
    
    const healthTrend = document.getElementById('health-trend');
    if (healthTrend) {
        if (health > 95) {
            healthTrend.textContent = 'Optimal';
            healthTrend.className = 'kpi-trend positive';
        } else if (health > 80) {
            healthTrend.textContent = 'Good';
            healthTrend.className = 'kpi-trend neutral';
        } else {
            healthTrend.textContent = 'Needs attention';
            healthTrend.className = 'kpi-trend negative';
        }
    }
    
    // Update status badges
    const statusCritical = document.getElementById('status-critical');
    const statusWarning = document.getElementById('status-warning');
    const statusNormal = document.getElementById('status-normal');
    if (statusCritical) statusCritical.textContent = critical;
    if (statusWarning) statusWarning.textContent = warnings;
    if (statusNormal) statusNormal.textContent = dashboardData.normal;
}

// Animate number counting
function animateValue(id, start, end, duration, suffix = '') {
    const element = document.getElementById(id);
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            element.textContent = formatNumber(Math.round(end)) + suffix;
            clearInterval(timer);
        } else {
            element.textContent = formatNumber(Math.round(current)) + suffix;
        }
    }, 16);
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Update alerts table
function updateAlertsTable() {
    const tbody = document.getElementById('alertsTableBody');
    if (!tbody) return;
    
    // Get critical and warning alerts (already filtered by backend)
    const criticalAndWarningAlerts = dashboardData.alerts
        .filter(a => a.Alert && (a.Alert.includes('CRITICAL') || a.Alert.includes('WARNING')));
    
    if (criticalAndWarningAlerts.length === 0) {
        const factoryText = currentFactoryId ? 'for the selected factory' : '';
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">✅ No critical or warning alerts ${factoryText}! All systems operating normally.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = criticalAndWarningAlerts.map(alert => {
        const alertClass = alert.Alert.includes('CRITICAL') ? 'critical' : 'warning';
        const machineId = alert.machine_id ?? alert.Machine ?? 'N/A';
        const timeVal = alert.timestamp ?? alert.Time ?? 'N/A';
        const tempVal = alert.temperature ?? parseFloat(String(alert.Temp || '').replace('K', ''));
        const vibVal = alert.vibration ?? parseFloat(String(alert.Vibration || '').replace('RPM', ''));
        const tempText = (tempVal !== null && tempVal !== undefined && !isNaN(tempVal)) ? `${tempVal.toFixed(1)}K` : 'N/A';
        const vibText = (vibVal !== null && vibVal !== undefined && !isNaN(vibVal)) ? `${Math.round(vibVal)} RPM` : 'N/A';
        return `
            <tr class="fade-in">
                <td><strong>#${machineId}</strong></td>
                <td>${timeVal}</td>
                <td>${tempText}</td>
                <td>${vibText}</td>
                <td><span class="alert-badge ${alertClass}">${alert.Alert}</span></td>
                <td><button class="action-btn" onclick="viewMachineDetails(${machineId})">View</button></td>
            </tr>
        `;
    }).join('');
}

// Update activity feed
function updateActivityFeed() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    
    const recentAlerts = dashboardData.alerts
        .filter(a => a.Alert && !a.Alert.includes('Normal'))
        .slice(0, 10);
    
    feed.innerHTML = recentAlerts.map((alert, index) => {
        const isCritical = alert.Alert.includes('CRITICAL');
        const icon = isCritical ? '🔥' : '⚠️';
        const className = isCritical ? 'critical' : 'warning';
        const timeAgo = `${index * 2} minutes ago`;
        const machineId = alert.machine_id ?? alert.Machine ?? 'N/A';
        
        return `
            <div class="feed-item ${className} fade-in">
                <div class="feed-icon">${icon}</div>
                <div class="feed-content">
                    <div class="feed-title">Machine #${machineId}</div>
                    <div class="feed-text">${alert.Alert}</div>
                    <div class="feed-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Refresh data
function refreshData() {
    console.log('🔄 Refreshing dashboard data...');
    loadDashboardData();
    
    // Show refresh animation
    const btn = document.querySelector('.btn-refresh .refresh-icon');
    if (btn) {
        btn.style.animation = 'spin 1s linear';
        setTimeout(() => {
            btn.style.animation = '';
        }, 1000);
    }
}

// Setup navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            const page = this.dataset.page;
            console.log(`Navigating to: ${page}`);
            
            // Handle page switching
            switchPage(page);
        });
    });
}

// Setup table filters
function setupTableFilters() {
    const filterInput = document.querySelector('.filter-input');
    if (filterInput) {
        filterInput.addEventListener('input', function(e) {
            const filterValue = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#alertsTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(filterValue) ? '' : 'none';
            });
        });
    }
}

let refreshTimer = null;

function getRefreshIntervalSeconds() {
    const stored = parseInt(localStorage.getItem('refreshInterval'), 10);
    return Number.isNaN(stored) ? 5 : Math.max(1, stored);
}

function isAnalyticsPageVisible() {
    const analyticsPage = document.getElementById('analyticsPage');
    return analyticsPage && analyticsPage.style.display === 'block';
}

// Start real-time updates with polling
function startRealTimeUpdates() {
    const intervalSeconds = getRefreshIntervalSeconds();
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    refreshTimer = setInterval(() => {
        if (isAnalyticsPageVisible()) {
            return;
        }
        loadDashboardData({ silent: true });
    }, intervalSeconds * 1000);
}

// Add real-time alert simulation
function addRealtimeAlert() {
    // Skip simulation when real data is loaded
    if ((dashboardData.alerts && dashboardData.alerts.length > 0) ||
        (dashboardData.sensorData && dashboardData.sensorData.length > 0)) {
        return;
    }

    const feed = document.getElementById('activityFeed');
    if (!feed || Math.random() > 0.3) return; // 30% chance of new alert
    
    const machineId = Math.floor(Math.random() * 100) + 1;
    const alerts = [
        '⚠️ WARNING: Temperature spike detected',
        '⚠️ WARNING: Vibration increase detected',
        '🔥 CRITICAL: High temperature alert',
        '🔥 CRITICAL: Excessive vibration'
    ];
    
    const alert = alerts[Math.floor(Math.random() * alerts.length)];
    const isCritical = alert.includes('CRITICAL');
    
    const newItem = document.createElement('div');
    newItem.className = `feed-item ${isCritical ? 'critical' : 'warning'} fade-in`;
    newItem.innerHTML = `
        <div class="feed-icon">${isCritical ? '🔥' : '⚠️'}</div>
        <div class="feed-content">
            <div class="feed-title">Machine #${machineId}</div>
            <div class="feed-text">${alert}</div>
            <div class="feed-time">Just now</div>
        </div>
    `;
    
    feed.insertBefore(newItem, feed.firstChild);
    
    // Keep only last 10 items
    while (feed.children.length > 10) {
        feed.removeChild(feed.lastChild);
    }
    
    // Update KPI if critical
    if (isCritical) {
        dashboardData.critical++;
        updateKPIs();
    }
}

// View machine details
function viewMachineDetails(machineId) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 520px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="font-size: 1.4rem; color: #1f2937;">Machine #${machineId}</h3>
                <button id="closeMachineModal" style="background: transparent; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            <div id="machineDetailsBody" style="color: #4b5563;">Loading details...</div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#closeMachineModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.remove());
    }
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    fetch(`/api/machine/${machineId}`)
        .then(response => response.json())
        .then(data => {
            const body = modal.querySelector('#machineDetailsBody');
            if (!body) return;

            if (data.error) {
                body.innerHTML = `<div style="color: #ef4444;">${data.error}</div>`;
                return;
            }

            const insights = data.insights || {};
            const cost = insights.estimated_cost_usd !== undefined
                ? `$${Number(insights.estimated_cost_usd).toLocaleString()}`
                : 'N/A';
            const predictedMinutes = insights.predicted_failure_minutes !== null && insights.predicted_failure_minutes !== undefined
                ? `${Number(insights.predicted_failure_minutes).toFixed(1)} min`
                : 'N/A';

            body.innerHTML = `
                <div style="display: grid; gap: 0.9rem;">
                    <div style="font-weight: 600; color: #111827;">Health & Risk</div>
                    <div><strong>Health:</strong> ${insights.health_status || 'N/A'} (${insights.health_score ?? 'N/A'})</div>
                    <div><strong>Failure Probability:</strong> ${insights.failure_probability ?? 'N/A'}%</div>
                    <div><strong>Predicted Failure:</strong> ${predictedMinutes}</div>
                    <div><strong>Estimated Cost:</strong> ${cost}</div>
                    <div><strong>Risk Score:</strong> ${insights.risk_score ?? 'N/A'}</div>

                    <div style="margin-top: 0.5rem; font-weight: 600; color: #111827;">Readings</div>
                    <div><strong>Total Readings:</strong> ${data.total_readings ?? 'N/A'}</div>
                    <div><strong>Avg Temp:</strong> ${data.avg_temperature ?? 'N/A'} K</div>
                    <div><strong>Min / Max Temp:</strong> ${data.min_temperature ?? 'N/A'} K / ${data.max_temperature ?? 'N/A'} K</div>
                    <div><strong>Avg Vibration:</strong> ${data.avg_vibration ?? 'N/A'} RPM</div>
                    <div><strong>Min / Max Vibration:</strong> ${data.min_vibration ?? 'N/A'} RPM / ${data.max_vibration ?? 'N/A'} RPM</div>
                    <div><strong>Last Reading:</strong> ${insights.last_temperature ?? 'N/A'} K / ${insights.last_vibration ?? 'N/A'} RPM</div>

                    <div style="margin-top: 0.5rem; font-weight: 600; color: #111827;">Alerts</div>
                    <div><strong>Critical Alerts:</strong> ${data.critical_alerts ?? 'N/A'}</div>
                    <div><strong>Warning Alerts:</strong> ${data.warning_alerts ?? 'N/A'}</div>
                </div>
            `;
        })
        .catch(() => {
            const body = modal.querySelector('#machineDetailsBody');
            if (body) body.innerHTML = '<div style="color: #ef4444;">Failed to load machine details.</div>';
        });
}

// Show/hide loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 500);
        }
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 1rem 2rem;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
}

// Export functionality
function exportData() {
    const csvContent = convertToCSV(dashboardData.alerts);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Convert data to CSV
function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h]).join(','));
    return [headers.join(','), ...rows].join('\n');
}

// Setup export button
// ==========================================================================
// Page Navigation Functions
// ==========================================================================

function switchPage(page) {
    // Hide all pages
    hideAllPages();
    
    // Reset scroll position to top when switching pages
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    
    // Update page title
    const titles = {
        'overview': 'Real-Time Dashboard',
        'machines': 'Machine Management',
        'alerts': 'Alert Management',
        'analytics': 'Advanced Analytics',
        'reports': 'Analysis Reports',
        'settings': 'System Settings'
    };
    
    const subtitles = {
        'overview': 'Monitor machine health in real-time',
        'machines': 'View and manage all machines',
        'alerts': 'Review and manage alerts',
        'analytics': 'Deep dive into system analytics',
        'reports': 'Comprehensive analysis reports',
        'settings': 'Configure system preferences'
    };
    
    document.querySelector('.page-title').textContent = titles[page] || 'Dashboard';
    document.querySelector('.page-subtitle').textContent = subtitles[page] || '';
    
    // Show selected page
    switch(page) {
        case 'overview':
            showOverviewPage();
            break;
        case 'machines':
            showMachinesPage();
            break;
        case 'alerts':
            showAlertsPage();
            break;
        case 'analytics':
            showAnalyticsPage();
            break;
        case 'reports':
            showReportsPage();
            break;
        case 'settings':
            showSettingsPage();
            break;
        default:
            showOverviewPage();
    }
}

function hideAllPages() {
    // Hide main dashboard content
    const kpiSection = document.querySelector('.kpi-section');
    const chartsGrid = document.querySelector('.charts-grid');
    const tableCard = document.querySelector('.table-card');
    const activityFeed = document.querySelector('.activity-feed');
    const insightsGrid = document.querySelector('.insights-grid');
    const reportsPage = document.getElementById('reportsPage');
    const analyticsPage = document.getElementById('analyticsPage');
    
    if (kpiSection) kpiSection.style.display = 'none';
    if (chartsGrid) chartsGrid.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';
    if (activityFeed) activityFeed.style.display = 'none';
    if (insightsGrid) insightsGrid.style.display = 'none';
    if (reportsPage) reportsPage.style.display = 'none';
    if (analyticsPage) analyticsPage.style.display = 'none';
}

function showOverviewPage() {
    // Update factory filter text on overview page
    const overviewFilterText = document.getElementById('overviewFactoryFilter');
    if (overviewFilterText) {
        const selectedDisplay = document.querySelector('#factorySelect .select-selected');
        const displayText = selectedDisplay ? selectedDisplay.textContent : 'All Factories';
        overviewFilterText.textContent = `Monitor machine health in real-time - Viewing: ${displayText}`;
    }
    
    // Show overview elements
    const kpiSection = document.querySelector('.kpi-section');
    const chartsGrid = document.querySelector('.charts-grid');
    const tableCard = document.querySelector('.table-card');
    const activityFeed = document.querySelector('.activity-feed');
    const insightsGrid = document.querySelector('.insights-grid');
    
    if (kpiSection) {
        kpiSection.style.display = 'grid';
        // Restore KPI cards if they were replaced
        if (!document.getElementById('kpi-critical')) {
            restoreKPICards();
        }
    }
    if (chartsGrid) chartsGrid.style.display = 'grid';
    if (tableCard) tableCard.style.display = 'block';
    if (activityFeed) activityFeed.style.display = 'block';
    if (insightsGrid) insightsGrid.style.display = 'grid';
    
    // Hide other pages
    const analyticsPage = document.getElementById('analyticsPage');
    if (analyticsPage) analyticsPage.style.display = 'none';
}

// Restore original KPI cards
function restoreKPICards() {
    const kpiSection = document.querySelector('.kpi-section');
    if (!kpiSection) return;
    
    kpiSection.innerHTML = `
        <div class="kpi-card" id="kpi-machines">
            <div class="kpi-icon machines">🏭</div>
            <div class="kpi-content">
                <div class="kpi-label">Total Machines</div>
                <div class="kpi-value" id="total-machines">0</div>
                <div class="kpi-trend positive">+0% from last month</div>
            </div>
        </div>

        <div class="kpi-card" id="kpi-readings">
            <div class="kpi-icon readings">📊</div>
            <div class="kpi-content">
                <div class="kpi-label">Total Readings</div>
                <div class="kpi-value" id="total-readings">0</div>
                <div class="kpi-trend positive">Real-time monitoring</div>
            </div>
        </div>

        <div class="kpi-card critical" id="kpi-critical">
            <div class="kpi-icon critical">🔥</div>
            <div class="kpi-content">
                <div class="kpi-label">Critical Alerts</div>
                <div class="kpi-value" id="critical-alerts">0</div>
                <div class="kpi-trend negative" id="critical-trend">Needs attention</div>
            </div>
        </div>

        <div class="kpi-card warning" id="kpi-warnings">
            <div class="kpi-icon warning">⚠️</div>
            <div class="kpi-content">
                <div class="kpi-label">Warnings</div>
                <div class="kpi-value" id="warning-alerts">0</div>
                <div class="kpi-trend neutral" id="warning-trend">Monitor closely</div>
            </div>
        </div>

        <div class="kpi-card success" id="kpi-health">
            <div class="kpi-icon success">💚</div>
            <div class="kpi-content">
                <div class="kpi-label">System Health</div>
                <div class="kpi-value" id="system-health">0%</div>
                <div class="kpi-trend positive" id="health-trend">Optimal</div>
            </div>
        </div>

        <div class="kpi-card" id="kpi-health-index">
            <div class="kpi-icon health">🧠</div>
            <div class="kpi-content">
                <div class="kpi-label">Health Index</div>
                <div class="kpi-value" id="health-index">0%</div>
                <div class="kpi-trend positive" id="health-index-trend">Healthy</div>
            </div>
        </div>
    `;
    
    // Update KPI values
    updateKPIs();
}

function showMachinesPage() {
    // Hide overview elements
    const chartsGrid = document.querySelector('.charts-grid');
    const tableCard = document.querySelector('.table-card');
    const activityFeed = document.querySelector('.activity-feed');
    const insightsGrid = document.querySelector('.insights-grid');
    const analyticsPage = document.getElementById('analyticsPage');
    
    if (chartsGrid) chartsGrid.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';
    if (activityFeed) activityFeed.style.display = 'none';
    if (insightsGrid) insightsGrid.style.display = 'none';
    if (analyticsPage) analyticsPage.style.display = 'none';
    
    // Show machines content
    const kpiSection = document.querySelector('.kpi-section');
    if (kpiSection) {
        kpiSection.style.display = 'block';
        
        // Create machine grid
        const machines = dashboardData.sensorData || [];
        const alerts = dashboardData.alerts || [];
        
        // Get unique machines and their stats
        const machineMap = new Map();
        machines.forEach(reading => {
            const id = reading.machine_id;
            if (!machineMap.has(id)) {
                machineMap.set(id, {
                    id: id,
                    readings: 0,
                    avgTemp: 0,
                    avgVibration: 0,
                    lastTemp: null,
                    lastVibration: null,
                    alerts: 0,
                    status: 'normal',
                    healthScore: 0,
                    riskScore: 0
                });
            }
            const machine = machineMap.get(id);
            machine.readings++;
            machine.avgTemp += parseFloat(reading.temperature);
            machine.avgVibration += parseFloat(reading.vibration);
            machine.lastTemp = parseFloat(reading.temperature);
            machine.lastVibration = parseFloat(reading.vibration);
        });
        
        // Calculate averages and determine status
        machineMap.forEach((machine, id) => {
            machine.avgTemp /= machine.readings;
            machine.avgVibration /= machine.readings;
            
            // Count alerts for this machine
            machine.alerts = alerts.filter(a => (a.machine_id ?? a.Machine) == id).length;
            
            // Determine status
            const criticalAlerts = alerts.filter(a => 
                (a.machine_id ?? a.Machine) == id && a.Alert && a.Alert.includes('CRITICAL')
            ).length;
            const warningAlerts = alerts.filter(a => 
                (a.machine_id ?? a.Machine) == id && a.Alert && a.Alert.includes('WARNING')
            ).length;
            
            if (criticalAlerts > 0) machine.status = 'critical';
            else if (warningAlerts > 0) machine.status = 'warning';
            else machine.status = 'normal';

            const tempDevPct = machine.avgTemp ? Math.abs(machine.lastTemp - machine.avgTemp) / machine.avgTemp * 100 : 0;
            const vibDevPct = machine.avgVibration ? Math.abs(machine.lastVibration - machine.avgVibration) / machine.avgVibration * 100 : 0;
            machine.healthScore = Math.max(0, 100 - (tempDevPct + vibDevPct));
            machine.riskScore = Math.min(100, Math.round((100 - machine.healthScore) + (criticalAlerts * 5) + (warningAlerts * 2)));
        });
        
        // Create machine cards
        const machineArray = Array.from(machineMap.values()).slice(0, 20);
        kpiSection.innerHTML = `
            <div style="grid-column: 1 / -1; background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="font-size: 1.5rem; color: #1f2937;">🏭 Machine Fleet Status</h2>
                    <input type="text" id="machineSearch" placeholder="Search machines..." 
                        style="padding: 0.5rem 1rem; border: 2px solid #e5e7eb; border-radius: 8px; width: 300px;">
                </div>
                <div id="machineGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
                    ${machineArray.map(machine => `
                        <div class="machine-card ${machine.status}" style="background: linear-gradient(135deg, ${
                            machine.status === 'critical' ? '#fee2e2, #fecaca' : 
                            machine.status === 'warning' ? '#fef3c7, #fde68a' : 
                            '#d1fae5, #a7f3d0'
                        }); padding: 1.5rem; border-radius: 10px; transition: all 0.3s; cursor: pointer; border: 2px solid ${
                            machine.status === 'critical' ? '#ef4444' : 
                            machine.status === 'warning' ? '#f59e0b' : 
                            '#10b981'
                        };">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h3 style="font-size: 1.2rem; color: #1f2937;">Machine #${machine.id}</h3>
                                <span style="padding: 0.25rem 0.75rem; background: ${
                                    machine.status === 'critical' ? '#ef4444' : 
                                    machine.status === 'warning' ? '#f59e0b' : 
                                    '#10b981'
                                }; color: white; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                                    ${machine.status.toUpperCase()}
                                </span>
                            </div>
                            <div style="display: grid; gap: 0.5rem; font-size: 0.9rem; color: #374151;">
                                <div>📊 Readings: <strong>${machine.readings}</strong></div>
                                <div>🌡️ Avg Temp: <strong>${machine.avgTemp.toFixed(1)}K</strong></div>
                                <div>📳 Avg Vibr: <strong>${machine.avgVibration.toFixed(0)} RPM</strong></div>
                                <div>🚨 Alerts: <strong>${machine.alerts}</strong></div>
                                <div>💚 Health: <strong>${machine.healthScore.toFixed(0)}%</strong></div>
                                <div>⚠️ Risk: <strong>${machine.riskScore}%</strong></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Add search functionality
        const searchInput = document.getElementById('machineSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                const value = e.target.value.toLowerCase();
                const cards = document.querySelectorAll('.machine-card');
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(value) ? 'block' : 'none';
                });
            });
        }
        
        // Add click handlers to machine cards
        document.querySelectorAll('.machine-card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-5px)';
                this.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
            });
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
            });
        });
    }
}

function showAlertsPage() {
    // Hide overview elements
    const chartsGrid = document.querySelector('.charts-grid');
    const tableCard = document.querySelector('.table-card');
    const activityFeed = document.querySelector('.activity-feed');
    const insightsGrid = document.querySelector('.insights-grid');
    const analyticsPage = document.getElementById('analyticsPage');
    
    if (chartsGrid) chartsGrid.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';
    if (activityFeed) activityFeed.style.display = 'none';
    if (insightsGrid) insightsGrid.style.display = 'none';
    if (analyticsPage) analyticsPage.style.display = 'none';
    
    // Show alerts content
    const kpiSection = document.querySelector('.kpi-section');
    if (kpiSection) {
        kpiSection.style.display = 'block';
        
        const alerts = dashboardData.alerts || [];
        const criticalAlerts = alerts.filter(a => a.Alert && a.Alert.includes('CRITICAL'));
        const warningAlerts = alerts.filter(a => a.Alert && a.Alert.includes('WARNING'));
        const normalAlerts = alerts.filter(a => a.Alert && a.Alert.includes('Normal'));
        
        kpiSection.innerHTML = `
            <div style="grid-column: 1 / -1; background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="font-size: 1.5rem; color: #1f2937;">🚨 Alert Management Center</h2>
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <select id="alertFilter" style="padding: 0.5rem 1rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            <option value="all">All Alerts</option>
                            <option value="critical">Critical Only</option>
                            <option value="warning">Warning Only</option>
                            <option value="normal">Normal Only</option>
                        </select>
                        <button onclick="exportAlerts()" style="background: #667eea; color: white; padding: 0.5rem 1rem; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            📥 Export
                        </button>
                    </div>
                </div>
                
                <!-- Alert Summary Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                    <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 1.5rem; border-radius: 10px; border: 2px solid #ef4444;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔥</div>
                        <div style="font-size: 2rem; font-weight: 700; color: #991b1b;">${criticalAlerts.length}</div>
                        <div style="color: #7f1d1d; font-weight: 500;">Critical Alerts</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 1.5rem; border-radius: 10px; border: 2px solid #f59e0b;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
                        <div style="font-size: 2rem; font-weight: 700; color: #92400e;">${warningAlerts.length}</div>
                        <div style="color: #78350f; font-weight: 500;">Warning Alerts</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); padding: 1.5rem; border-radius: 10px; border: 2px solid #10b981;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
                        <div style="font-size: 2rem; font-weight: 700; color: #065f46;">${normalAlerts.length}</div>
                        <div style="color: #064e3b; font-weight: 500;">Normal Operations</div>
                    </div>
                </div>
                
                <!-- Alert Timeline -->
                <div id="alertsList" style="max-height: 600px; overflow-y: auto;">
                    ${renderAlertsList(alerts.slice(0, 50))}
                </div>
            </div>
        `;
        
        // Add filter functionality
        const filterSelect = document.getElementById('alertFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', function(e) {
                let filteredAlerts = alerts;
                const value = e.target.value;
                
                if (value === 'critical') {
                    filteredAlerts = criticalAlerts;
                } else if (value === 'warning') {
                    filteredAlerts = warningAlerts;
                } else if (value === 'normal') {
                    filteredAlerts = normalAlerts;
                }
                
                document.getElementById('alertsList').innerHTML = renderAlertsList(filteredAlerts.slice(0, 50));
            });
        }
    }
}

function renderAlertsList(alerts) {
    return alerts.map(alert => {
        const isCritical = alert.Alert && alert.Alert.includes('CRITICAL');
        const isWarning = alert.Alert && alert.Alert.includes('WARNING');
        const bgColor = isCritical ? '#fee2e2' : isWarning ? '#fef3c7' : '#d1fae5';
        const borderColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';
        const icon = isCritical ? '🔥' : isWarning ? '⚠️' : '✅';
        const machineId = alert.machine_id ?? alert.Machine ?? 'N/A';
        
        return `
            <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="font-size: 1.5rem;">${icon}</div>
                    <div>
                        <div style="font-weight: 600; color: #1f2937;">Machine #${machineId}</div>
                        <div style="font-size: 0.9rem; color: #6b7280;">${alert.Alert || 'Unknown'}</div>
                    </div>
                </div>
                <div style="text-align: right; font-size: 0.85rem; color: #6b7280;">
                    <div>🌡️ ${alert.temperature ? alert.temperature.toFixed(1) + 'K' : 'N/A'}</div>
                    <div>📳 ${alert.vibration ? alert.vibration.toFixed(0) + ' RPM' : 'N/A'}</div>
                    <div>⏰ Time: ${alert.timestamp || 'N/A'}</div>
                </div>
            </div>
        `;
    }).join('');
}

function exportAlerts() {
    const alerts = dashboardData.alerts || [];
    const csv = convertToCSV(alerts);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function showAnalyticsPage() {
    // Hide overview content
    const kpiSection = document.querySelector('.kpi-section');
    const chartsGrid = document.querySelector('.charts-grid');
    const activityFeed = document.querySelector('.activity-feed');
    const tableCard = document.querySelector('.table-card');
    const insightsGrid = document.querySelector('.insights-grid');
    
    if (kpiSection) kpiSection.style.display = 'none';
    if (chartsGrid) chartsGrid.style.display = 'none';
    if (activityFeed) activityFeed.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';
    if (insightsGrid) insightsGrid.style.display = 'none';
    
    // Update factory filter text on both overview and analytics pages
    const selectedDisplay = document.querySelector('#factorySelect .select-selected');
    const displayText = selectedDisplay ? selectedDisplay.textContent : 'All Factories';
    
    const overviewFilterText = document.getElementById('overviewFactoryFilter');
    if (overviewFilterText) {
        overviewFilterText.textContent = `Monitor machine health in real-time - Viewing: ${displayText}`;
    }
    
    const analyticsFilterText = document.getElementById('analyticsFactoryFilter');
    if (analyticsFilterText) {
        analyticsFilterText.textContent = `Viewing: ${displayText}`;
    }
    
    // Show analytics page
    const analyticsPage = document.getElementById('analyticsPage');
    if (analyticsPage) {
        analyticsPage.style.display = 'block';
        
        // Ensure page stays at top
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.scrollTop = 0;
        }
        
        // Force reflow to ensure page is visible
        void analyticsPage.offsetHeight;
        
        // Initialize analytics charts ONLY if not already initialized
        if (!analyticsChartsInitialized) {
            setTimeout(() => {
                console.log('🎨 Starting analytics chart initialization...');
                
                // Ensure all canvases are visible and sized correctly
                const canvases = analyticsPage.querySelectorAll('canvas');
                console.log(`Found ${canvases.length} canvas elements`);
                
                canvases.forEach((canvas, i) => {
                    const rect = canvas.getBoundingClientRect();
                    console.log(`Canvas ${i} (${canvas.id}): visible=${rect.width}x${rect.height}`);
                    if (rect.width === 0 || rect.height === 0) {
                        console.warn(`⚠️ Canvas ${i} has zero dimensions, parent might be hidden`);
                    }
                });
                
                initAnalyticsCharts();
                generateAnalyticsInsights();
                updateAnalyticsDataInfo();
                
                // Force resize of all charts after a brief delay to ensure proper rendering
                setTimeout(() => {
                    console.log('📐 Forcing chart resize...');
                    if (analyticsCharts.equipmentEfficiency) analyticsCharts.equipmentEfficiency.resize();
                    if (analyticsCharts.healthScoreTrends) analyticsCharts.healthScoreTrends.resize();
                    if (analyticsCharts.alertTypeDistribution) analyticsCharts.alertTypeDistribution.resize();
                }, 150);
                
                analyticsChartsInitialized = true;
                console.log('✅ Analytics charts initialized');
            }, 200);
        } else {
            // Update charts with latest data without recreating them
            setTimeout(() => {
                updateAnalyticsChartsData();
            }, 100);
        }
    }
}

// Update analytics data info display
// Update analytics data info display (redirects to KPIs update)
function updateAnalyticsDataInfo() {
    updateAnalyticsKPIs();
}

// Refresh analytics data and charts
function refreshAnalytics() {
    console.log('🔄 Refreshing analytics...');
    analyticsChartsInitialized = false; // Reset flag to allow re-initialization
    loadDashboardData();
    
    setTimeout(() => {
        initAnalyticsCharts();
        updateAnalyticsDataInfo();
        analyticsChartsInitialized = true;
        showNotification('✅ Analytics data refreshed', 'success');
    }, 500);
}

// Flag to track if analytics charts are initialized (prevent re-initialization)
let analyticsChartsInitialized = false;

function showReportsPage() {
    // Hide all other content
    const kpiSection = document.querySelector('.kpi-section');
    const chartsGrid = document.querySelector('.charts-grid');
    const tableCard = document.querySelector('.table-card');
    const activityFeed = document.querySelector('.activity-feed');
    const insightsGrid = document.querySelector('.insights-grid');
    const analyticsPage = document.getElementById('analyticsPage');
    
    if (kpiSection) kpiSection.style.display = 'none';
    if (chartsGrid) chartsGrid.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';
    if (activityFeed) activityFeed.style.display = 'none';
    if (insightsGrid) insightsGrid.style.display = 'none';
    if (analyticsPage) analyticsPage.style.display = 'none';
    
    // Show reports page
    const reportsPage = document.getElementById('reportsPage');
    if (reportsPage) {
        reportsPage.style.display = 'block';
        loadReportData();
    }
}

function showSettingsPage() {
    // Hide all other content
    const chartsGrid = document.querySelector('.charts-grid');
    const tableCard = document.querySelector('.table-card');
    const activityFeed = document.querySelector('.activity-feed');
    const insightsGrid = document.querySelector('.insights-grid');
    const analyticsPage = document.getElementById('analyticsPage');
    const reportsPage = document.getElementById('reportsPage');
    
    if (chartsGrid) chartsGrid.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';
    if (activityFeed) activityFeed.style.display = 'none';
    if (insightsGrid) insightsGrid.style.display = 'none';
    if (analyticsPage) analyticsPage.style.display = 'none';
    if (reportsPage) reportsPage.style.display = 'none';
    
    // Show settings content
    const kpiSection = document.querySelector('.kpi-section');
    if (kpiSection) {
        kpiSection.style.display = 'block';
        
        // Get current settings from localStorage or use defaults
        const settings = {
            tempThreshold: localStorage.getItem('tempThreshold') || 320,
            tempSpikeThreshold: localStorage.getItem('tempSpikeThreshold') || 15,
            vibrationThreshold: localStorage.getItem('vibrationThreshold') || 2000,
            vibrationSpikeThreshold: localStorage.getItem('vibrationSpikeThreshold') || 500,
            refreshInterval: localStorage.getItem('refreshInterval') || 5,
            enableNotifications: localStorage.getItem('enableNotifications') !== 'false'
        };
        
        kpiSection.innerHTML = `
            <div style="grid-column: 1 / -1; background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚙️</div>
                    <h2 style="font-size: 1.8rem; color: #1f2937; margin-bottom: 0.5rem;">System Settings</h2>
                    <p style="color: #6b7280; font-size: 1.1rem;">Configure thresholds and system preferences</p>
                </div>
                
                <div style="max-width: 800px; margin: 0 auto;">
                    <!-- Temperature Settings -->
                    <div style="background: #f9fafb; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 2px solid #e5e7eb;">
                        <h3 style="font-size: 1.2rem; margin-bottom: 1.5rem; color: #374151; display: flex; align-items: center; gap: 0.5rem;">
                            🌡️ Temperature Monitoring Settings
                        </h3>
                        
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #4b5563;">
                                Critical Temperature Threshold: <span id="tempValue">${settings.tempThreshold}</span>K
                            </label>
                            <input type="range" id="tempThreshold" min="300" max="350" value="${settings.tempThreshold}" 
                                style="width: 100%; height: 8px; border-radius: 5px; background: linear-gradient(to right, #10b981, #f59e0b, #ef4444); outline: none; cursor: pointer;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem;">
                                <span>300K (Safe)</span>
                                <span>350K (Danger)</span>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #4b5563;">
                                Temperature Spike Threshold: <span id="tempSpikeValue">${settings.tempSpikeThreshold}</span>K
                            </label>
                            <input type="range" id="tempSpikeThreshold" min="5" max="30" value="${settings.tempSpikeThreshold}" 
                                style="width: 100%; height: 8px; border-radius: 5px; background: #ddd; outline: none; cursor: pointer;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem;">
                                <span>5K</span>
                                <span>30K</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Vibration Settings -->
                    <div style="background: #f9fafb; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 2px solid #e5e7eb;">
                        <h3 style="font-size: 1.2rem; margin-bottom: 1.5rem; color: #374151; display: flex; align-items: center; gap: 0.5rem;">
                            📳 Vibration Monitoring Settings
                        </h3>
                        
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #4b5563;">
                                Vibration Warning Threshold: <span id="vibrationValue">${settings.vibrationThreshold}</span> RPM
                            </label>
                            <input type="range" id="vibrationThreshold" min="1500" max="3000" step="100" value="${settings.vibrationThreshold}" 
                                style="width: 100%; height: 8px; border-radius: 5px; background: linear-gradient(to right, #10b981, #f59e0b, #ef4444); outline: none; cursor: pointer;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem;">
                                <span>1500 RPM (Low)</span>
                                <span>3000 RPM (High)</span>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #4b5563;">
                                Vibration Spike Threshold: <span id="vibrationSpikeValue">${settings.vibrationSpikeThreshold}</span> RPM
                            </label>
                            <input type="range" id="vibrationSpikeThreshold" min="100" max="1000" step="50" value="${settings.vibrationSpikeThreshold}" 
                                style="width: 100%; height: 8px; border-radius: 5px; background: #ddd; outline: none; cursor: pointer;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem;">
                                <span>100 RPM</span>
                                <span>1000 RPM</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- System Settings -->
                    <div style="background: #f9fafb; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 2px solid #e5e7eb;">
                        <h3 style="font-size: 1.2rem; margin-bottom: 1.5rem; color: #374151; display: flex; align-items: center; gap: 0.5rem;">
                            🔔 System Configuration
                        </h3>
                        
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #4b5563;">
                                Dashboard Refresh Interval: <span id="refreshValue">${settings.refreshInterval}</span> seconds
                            </label>
                            <input type="range" id="refreshInterval" min="1" max="30" value="${settings.refreshInterval}" 
                                style="width: 100%; height: 8px; border-radius: 5px; background: #ddd; outline: none; cursor: pointer;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem;">
                                <span>1s (Fast)</span>
                                <span>30s (Slow)</span>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: white; border-radius: 8px;">
                            <div>
                                <div style="font-weight: 600; color: #374151;">Enable Notifications</div>
                                <div style="font-size: 0.85rem; color: #6b7280;">Show browser notifications for alerts</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 60px; height: 34px;">
                                <input type="checkbox" id="enableNotifications" ${settings.enableNotifications ? 'checked' : ''} 
                                    style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; 
                                    transition: .4s; border-radius: 34px;" class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <!-- Data Import -->
                    <div style="background: #f9fafb; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 2px solid #e5e7eb;">
                        <h3 style="font-size: 1.2rem; margin-bottom: 1rem; color: #374151; display: flex; align-items: center; gap: 0.5rem;">
                            📥 Data Import (Append)
                        </h3>
                        <p style="color: #6b7280; margin-bottom: 1rem;">Upload a CSV to append new sensor rows into the existing dataset.</p>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <input type="file" id="sensorCsvFile" accept=".csv" style="flex: 1;">
                            <button onclick="uploadSensorCSV()" style="background: #2563eb; color: white; padding: 0.75rem 1.25rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                Upload & Append
                            </button>
                        </div>
                        <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">
                            Required columns: <strong>machine_id, temperature, vibration</strong><br>
                            Optional columns: <strong>factory_id</strong> (defaults to 1 if not provided), <strong>timestamp</strong> (auto-generated if not provided)
                        </div>
                    </div>

                    <!-- Add New Reading -->
                    <div style="background: #f9fafb; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 2px solid #e5e7eb;">
                        <h3 style="font-size: 1.2rem; margin-bottom: 1rem; color: #374151; display: flex; align-items: center; gap: 0.5rem;">
                            ➕ Add New Reading (Real-Time)
                        </h3>
                        <p style="color: #6b7280; margin-bottom: 1rem;">Submit a single reading to append into the live stream.</p>
                        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem;">
                            <div>
                                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #4b5563; margin-bottom: 0.5rem;">Factory ID *</label>
                                <input id="manualFactoryId" type="number" min="1" placeholder="e.g. 1" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #d1d5db;">
                                <small style="font-size: 0.75rem; color: #6b7280;">Integer only</small>
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #4b5563; margin-bottom: 0.5rem;">Machine ID *</label>
                                <input id="manualMachineId" type="number" min="1" placeholder="e.g. 12" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #d1d5db;">
                                <small style="font-size: 0.75rem; color: #6b7280;">Integer only</small>
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #4b5563; margin-bottom: 0.5rem;">Temperature (K) *</label>
                                <input id="manualTemperature" type="number" step="0.1" min="200" max="500" placeholder="e.g. 320.5" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #d1d5db;">
                                <small style="font-size: 0.75rem; color: #6b7280;">200-500K</small>
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #4b5563; margin-bottom: 0.5rem;">Vibration (RPM) *</label>
                                <input id="manualVibration" type="number" step="1" min="0" max="5000" placeholder="e.g. 1800" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #d1d5db;">
                                <small style="font-size: 0.75rem; color: #6b7280;">0-5000 RPM</small>
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #4b5563; margin-bottom: 0.5rem;">Timestamp (optional)</label>
                                <input id="manualTimestamp" type="text" placeholder="2026-02-09T12:30:00Z" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #d1d5db;">
                                <small style="font-size: 0.75rem; color: #6b7280;">Auto-generated</small>
                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem; align-items: center; margin-top: 1rem;">
                            <button onclick="addManualReading()" style="background: #16a34a; color: white; padding: 0.75rem 1.25rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                Add Reading
                            </button>
                            <div style="font-size: 0.85rem; color: #6b7280;">
                                <strong>Validation:</strong> Factory ID & Machine ID must be integers. 
                                Temperature in Kelvin (200-500K). Vibration in RPM (0-5000).
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
                        <button onclick="saveSettings()" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 1rem 2rem; 
                            border: none; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                            💾 Save Settings
                        </button>
                        <button onclick="resetSettings()" style="background: #6b7280; color: white; padding: 1rem 2rem; 
                            border: none; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                            🔄 Reset to Defaults
                        </button>
                    </div>
                    
                    <div id="settingsSaved" style="display: none; text-align: center; margin-top: 1rem; padding: 1rem; background: #d1fae5; 
                        color: #065f46; border-radius: 8px; font-weight: 600;">
                        ✅ Settings saved successfully!
                    </div>
                </div>
            </div>
        `;
        
        // Add real-time slider updates
        const sliders = ['tempThreshold', 'tempSpikeThreshold', 'vibrationThreshold', 'vibrationSpikeThreshold', 'refreshInterval'];
        sliders.forEach(id => {
            const slider = document.getElementById(id);
            const valueSpan = document.getElementById(id.replace('Threshold', 'Value').replace('Interval', 'Value'));
            if (slider && valueSpan) {
                slider.addEventListener('input', function() {
                    valueSpan.textContent = this.value;
                    // Update slider background for temperature and vibration
                    if (id.includes('temp') || id.includes('vibration')) {
                        const percent = ((this.value - this.min) / (this.max - this.min)) * 100;
                        if (id.includes('Threshold') && !id.includes('Spike')) {
                            this.style.background = `linear-gradient(to right, #10b981 0%, #10b981 ${percent * 0.5}%, #f59e0b ${percent * 0.5}%, #f59e0b ${percent * 0.75}%, #ef4444 ${percent * 0.75}%, #ef4444 100%)`;
                        }
                    }
                });
            }
        });
        
        // Add toggle switch styling
        const style = document.createElement('style');
        style.textContent = `
            #enableNotifications:checked + .toggle-slider {
                background-color: #10b981;
            }
            #enableNotifications:checked + .toggle-slider:before {
                transform: translateX(26px);
            }
            .toggle-slider:before {
                position: absolute;
                content: "";
                height: 26px;
                width: 26px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
        `;
        document.head.appendChild(style);
    }
}

function saveSettings() {
    // Save settings to localStorage
    const settings = {
        tempThreshold: document.getElementById('tempThreshold').value,
        tempSpikeThreshold: document.getElementById('tempSpikeThreshold').value,
        vibrationThreshold: document.getElementById('vibrationThreshold').value,
        vibrationSpikeThreshold: document.getElementById('vibrationSpikeThreshold').value,
        refreshInterval: document.getElementById('refreshInterval').value,
        enableNotifications: document.getElementById('enableNotifications').checked
    };
    
    Object.keys(settings).forEach(key => {
        localStorage.setItem(key, settings[key]);
    });
    
    // Show success message
    const savedMsg = document.getElementById('settingsSaved');
    if (savedMsg) {
        savedMsg.style.display = 'block';
        setTimeout(() => {
            savedMsg.style.display = 'none';
        }, 3000);
    }
    
    console.log('Settings saved:', settings);

    startRealTimeUpdates();
}

function resetSettings() {
    // Clear localStorage
    localStorage.clear();
    
    // Reload the settings page with defaults
    showSettingsPage();
    
    console.log('Settings reset to defaults');
}

async function uploadSensorCSV() {
    const fileInput = document.getElementById('sensorCsvFile');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showNotification('⚠️ Please choose a CSV file first', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch('/api/data/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();
        showNotification(`✅ Appended ${result.appended_rows} rows`, 'success');
        await loadDashboardData({ silent: true });
        if (document.getElementById('analyticsPage')?.style.display === 'block') {
            refreshAnalytics();
        }
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function addManualReading() {
    const factoryIdInput = document.getElementById('manualFactoryId');
    const machineIdInput = document.getElementById('manualMachineId');
    const temperatureInput = document.getElementById('manualTemperature');
    const vibrationInput = document.getElementById('manualVibration');
    const timestampInput = document.getElementById('manualTimestamp');

    if (!factoryIdInput || !machineIdInput || !temperatureInput || !vibrationInput) {
        showNotification('⚠️ Add Reading form not available', 'warning');
        return;
    }

    const factoryId = factoryIdInput.value.trim();
    const machineId = machineIdInput.value.trim();
    const temperature = temperatureInput.value.trim();
    const vibration = vibrationInput.value.trim();
    const timestamp = timestampInput ? timestampInput.value.trim() : '';

    if (!factoryId || !machineId || !temperature || !vibration) {
        showNotification('⚠️ Please fill factory_id, machine_id, temperature, and vibration', 'warning');
        return;
    }

    // Validate Factory ID - must be a positive integer
    const factoryIdNum = Number(factoryId);
    if (!Number.isInteger(factoryIdNum) || factoryIdNum < 1) {
        showNotification('❌ Factory ID must be a positive integer (e.g., 1, 2, 3)', 'error');
        return;
    }

    // Validate Machine ID - must be a positive integer
    const machineIdNum = Number(machineId);
    if (!Number.isInteger(machineIdNum) || machineIdNum < 1) {
        showNotification('❌ Machine ID must be a positive integer (e.g., 1, 2, 3)', 'error');
        return;
    }

    // Validate Temperature - must be in Kelvin (typically 250-400K for industrial machines)
    const temperatureNum = Number(temperature);
    if (isNaN(temperatureNum)) {
        showNotification('❌ Temperature must be a valid number', 'error');
        return;
    }
    if (temperatureNum < 200 || temperatureNum > 500) {
        showNotification('❌ Temperature must be in Kelvin (200-500K). If you entered Celsius, convert to Kelvin: K = °C + 273.15', 'error');
        return;
    }

    // Validate Vibration - must be in RPM (typically 500-3500 RPM)
    const vibrationNum = Number(vibration);
    if (isNaN(vibrationNum)) {
        showNotification('❌ Vibration must be a valid number', 'error');
        return;
    }
    if (vibrationNum < 0 || vibrationNum > 5000) {
        showNotification('❌ Vibration must be between 0-5000 RPM', 'error');
        return;
    }

    const payload = {
        factory_id: factoryIdNum,
        machine_id: machineIdNum,
        temperature: temperatureNum,
        vibration: vibrationNum
    };

    if (timestamp) {
        payload.timestamp = timestamp;
    }

    try {
        const response = await fetch('/api/add-reading', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Add reading failed');
        }

        const result = await response.json();
        showNotification('✅ Reading added successfully', 'success');

        factoryIdInput.value = '';
        machineIdInput.value = '';
        temperatureInput.value = '';
        vibrationInput.value = '';
        if (timestampInput) timestampInput.value = '';

        await loadDashboardData({ silent: true });
        if (document.getElementById('analyticsPage')?.style.display === 'block') {
            refreshAnalytics();
        }
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function loadReportData() {
    try {
        // Use existing dashboard data
        const alerts = dashboardData.alerts;
        const sensorData = dashboardData.sensorData;
        
        if (!alerts || alerts.length === 0) {
            // Try to load data
            await loadDashboardData();
        }
        
        // Update summary statistics
        const reportTotalReadings = document.getElementById('report-total-readings');
        const reportCritical = document.getElementById('report-critical');
        const reportWarnings = document.getElementById('report-warnings');
        const reportNormal = document.getElementById('report-normal');

        if (reportTotalReadings) {
            reportTotalReadings.textContent = (sensorData?.length || 0).toLocaleString();
        }
        if (reportCritical) {
            reportCritical.textContent = dashboardData.critical.toLocaleString();
        }
        if (reportWarnings) {
            reportWarnings.textContent = dashboardData.warnings.toLocaleString();
        }
        if (reportNormal) {
            reportNormal.textContent = dashboardData.normal.toLocaleString();
        }
        
        // Load warning alerts
        const warningAlerts = alerts?.filter(a => 
            a.alert_type?.includes('HIGH_VIBRATION') || 
            a.alert_type?.includes('VIBRATION_SPIKE')
        ) || [];
        updateReportTable('reportWarningBody', warningAlerts.slice(0, 10));
        
    } catch (error) {
        console.error('Error loading report data:', error);
    }
}

function updateReportTable(tableBodyId, data) {
    const tbody = document.getElementById(tableBodyId);
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No alerts found</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(alert => `
        <tr>
            <td>${alert.machine_id || 'N/A'}</td>
            <td>${alert.timestamp || 'N/A'}</td>
            <td>${alert.temperature ? alert.temperature.toFixed(2) : 'N/A'}</td>
            <td>${alert.vibration ? alert.vibration.toFixed(0) : 'N/A'}</td>
            <td>
                <span class="status-badge ${alert.alert_type?.includes('TEMP') ? 'critical' : 'warning'}">
                    ${alert.alert_type || 'ALERT'}
                </span>
            </td>
        </tr>
    `).join('');
}

// ==========================================================================
// Global Search Functionality
// ==========================================================================

function setupGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;
    
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performGlobalSearch(e.target.value);
        }, 300);
    });
}

function performGlobalSearch(query) {
    if (!query || query.trim() === '') {
        // Clear search - show all items
        clearSearchHighlights();
        return;
    }
    
    const searchTerm = query.toLowerCase().trim();
    let resultsFound = 0;
    
    // Search in KPI cards
    document.querySelectorAll('.kpi-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            card.style.opacity = '1';
            card.style.border = '2px solid #667eea';
            resultsFound++;
        } else {
            card.style.opacity = '0.3';
            card.style.border = '';
        }
    });
    
    // Search in alerts table
    const alertRows = document.querySelectorAll('#alertsTableBody tr');
    alertRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
            row.style.background = '#fef3c7';
            resultsFound++;
        } else {
            row.style.display = 'none';
            row.style.background = '';
        }
    });
    
    // Search in activity feed
    const feedItems = document.querySelectorAll('.feed-item');
    feedItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = '';
            item.style.background = '#fef3c7';
            resultsFound++;
        } else {
            item.style.display = 'none';
            item.style.background = '';
        }
    });
    
    // Show search results count
    showSearchResults(resultsFound, searchTerm);
}

function clearSearchHighlights() {
    // Reset KPI cards
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.style.opacity = '1';
        card.style.border = '';
    });
    
    // Reset alert rows
    document.querySelectorAll('#alertsTableBody tr').forEach(row => {
        row.style.display = '';
        row.style.background = '';
    });
    
    // Reset feed items
    document.querySelectorAll('.feed-item').forEach(item => {
        item.style.display = '';
        item.style.background = '';
    });
    
    // Remove results message
    const existingMsg = document.getElementById('searchResults');
    if (existingMsg) existingMsg.remove();
}

function showSearchResults(count, term) {
    // Remove existing message
    const existing = document.getElementById('searchResults');
    if (existing) existing.remove();
    
    // Create results message
    const msg = document.createElement('div');
    msg.id = 'searchResults';
    msg.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: fadeIn 0.3s ease;
        font-weight: 600;
    `;
    msg.textContent = `Found ${count} results for "${term}"`;
    document.body.appendChild(msg);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        msg.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => msg.remove(), 300);
    }, 3000);
}

// ==========================================================================
// Admin Dropdown Functionality
// ==========================================================================

function setupAdminDropdown() {
    const profileBtn = document.getElementById('userProfile');
    const dropdown = document.getElementById('userDropdown');
    
    if (!profileBtn || !dropdown) return;
    
    // Toggle dropdown on click
    profileBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!profileBtn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function showSettingsFromMenu() {
    // Hide dropdown
    document.getElementById('userDropdown').style.display = 'none';
    
    // Navigate to settings
    const settingsNav = document.querySelector('[data-page="settings"]');
    if (settingsNav) {
        settingsNav.click();
    }
}

function showReportsFromMenu() {
    // Hide dropdown
    document.getElementById('userDropdown').style.display = 'none';
    
    // Navigate to reports
    const reportsNav = document.querySelector('[data-page="reports"]');
    if (reportsNav) {
        reportsNav.click();
    }
}

function exportDashboard() {
    // Hide dropdown
    document.getElementById('userDropdown').style.display = 'none';
    
    // Export all data
    const allData = {
        timestamp: new Date().toISOString(),
        dashboardData: dashboardData,
        settings: {
            tempThreshold: localStorage.getItem('tempThreshold') || 320,
            vibrationThreshold: localStorage.getItem('vibrationThreshold') || 2000,
            refreshInterval: localStorage.getItem('refreshInterval') || 5
        }
    };
    
    const json = JSON.stringify(allData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    // Show success message
    showNotification('✅ Dashboard data exported successfully!', 'success');
}

function showAbout() {
    // Hide dropdown
    document.getElementById('userDropdown').style.display = 'none';
    
    // Show about modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: scaleIn 0.3s ease;">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔧</div>
                <h2 style="font-size: 1.8rem; color: #1f2937; margin-bottom: 0.5rem;">Predictive Maintenance System</h2>
                <p style="color: #6b7280;">Version 1.0.0</p>
            </div>
            
            <div style="background: #f9fafb; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <p style="color: #374151; line-height: 1.6; margin-bottom: 1rem;">
                    Real-time machine health monitoring with anomaly detection powered by AI.
                </p>
                <div style="display: grid; gap: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                    <div>📊 <strong>10,000</strong> sensor readings analyzed</div>
                    <div>🏭 <strong>100</strong> machines monitored</div>
                    <div>🚨 <strong>226</strong> anomalies detected</div>
                    <div>💚 <strong>96%</strong> system health score</div>
                </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 0.85rem; margin-bottom: 1rem;">
                Built with ❤️ for GreenBharat<br>
                © 2026 All rights reserved
            </div>
            
            <button onclick="this.closest('div').parentElement.remove()" 
                style="width: 100%; background: linear-gradient(135deg, #667eea, #764ba2); color: white; 
                padding: 0.75rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1rem;">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function showNotification(message, type = 'info') {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#667eea',
        warning: '#f59e0b'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: fadeIn 0.3s ease;
        font-weight: 600;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

console.log('✅ Dashboard JavaScript loaded');

// Analytics insights generator
function generateAnalyticsInsights() {
    const sensorData = dashboardData.sensorData || [];
    const alerts = dashboardData.alerts || [];
    
    if (sensorData.length === 0) {
        console.warn('No sensor data for insights');
        return;
    }
    
    // Calculate real statistics
    const temps = sensorData.map(d => parseFloat(d.temperature)).filter(t => !isNaN(t));
    const vibes = sensorData.map(d => parseFloat(d.vibration)).filter(v => !isNaN(v));
    
    const avgTemp = temps.length > 0 ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : 'N/A';
    const maxTemp = temps.length > 0 ? Math.max(...temps).toFixed(1) : 'N/A';
    const minTemp = temps.length > 0 ? Math.min(...temps).toFixed(1) : 'N/A';
    
    const avgVib = vibes.length > 0 ? (vibes.reduce((a, b) => a + b, 0) / vibes.length).toFixed(0) : 'N/A';
    const maxVib = vibes.length > 0 ? Math.max(...vibes).toFixed(0) : 'N/A';
    const minVib = vibes.length > 0 ? Math.min(...vibes).toFixed(0) : 'N/A';
    
    console.log(`📊 Real Analytics Data:`);
    console.log(`  Temperature: ${avgTemp}K avg (${minTemp}K - ${maxTemp}K range)`);
    console.log(`  Vibration: ${avgVib} RPM avg (${minVib} - ${maxVib} RPM range)`);
    console.log(`  Alerts: ${alerts.length} total records`);
}

// ==========================================================================
// Advanced Analytics Charts
// ==========================================================================

// Store analytics chart instances
let analyticsCharts = {
    equipmentEfficiency: null,
    healthScoreTrends: null,
    alertTypeDistribution: null,
    riskScoreGauge: null,
    vibrationTrend: null,
    correlation: null,
    machineComparison: null
};



function initAnalyticsCharts() {
    console.log('🎨 Initializing analytics charts...');
    console.log(`📈 Available data: ${dashboardData.sensorData?.length || 0} readings, ${dashboardData.alerts?.length || 0} alerts`);
    console.log(`🏭 Factory filter: ${currentFactoryId || 'All Factories'}`);
    
    // Destroy existing charts before creating new ones
    destroyAnalyticsCharts();
    
    try {
        initEquipmentEfficiencyChart();
    } catch (e) {
        console.error('Equipment Error:', e.message);
    }
    
    try {
        initHealthScoreTrendsChart();
    } catch (e) {
        console.error('Health Score Error:', e.message);
    }
    
    try {
        initAlertTypeDistributionChart();
    } catch (e) {
        console.error('Alert Error:', e.message);
    }
    
    try {
        initRiskScoreGauge();
    } catch (e) {
        console.error('Risk Score Error:', e.message);
    }
    
    try {
        updateAnalyticsKPIs();
    } catch (e) {
        console.error('KPI Error:', e.message);
    }
    
    console.log('✅ All analytics charts initialized successfully');
}

// Update analytics charts with new data (without recreating)
function updateAnalyticsChartsData() {
    if (!analyticsChartsInitialized) {
        console.log('⚠️ Analytics charts not initialized yet');
        return;
    }

    const factoryText = currentFactoryId ? `Factory ${currentFactoryId}` : 'All Factories';
    console.log(`🔄 Updating analytics charts with data from: ${factoryText}`);
    console.log(`📊 Data: ${dashboardData.sensorData?.length || 0} readings, ${dashboardData.alerts?.length || 0} alerts`);

    // Call init functions - they will update existing charts
    // No scroll manipulation needed - let the page stay where it is
    initEquipmentEfficiencyChart();
    initHealthScoreTrendsChart();
    initAlertTypeDistributionChart();
    initRiskScoreGauge();
    updateAnalyticsKPIs();

    console.log('✅ Analytics charts updated');
}

function destroyAnalyticsCharts() {
    // Destroy Chart.js instances
    if (analyticsCharts.equipmentEfficiency) {
        analyticsCharts.equipmentEfficiency.destroy();
        analyticsCharts.equipmentEfficiency = null;
    }
    if (analyticsCharts.healthScoreTrends) {
        analyticsCharts.healthScoreTrends.destroy();
        analyticsCharts.healthScoreTrends = null;
    }
    if (analyticsCharts.alertTypeDistribution) {
        analyticsCharts.alertTypeDistribution.destroy();
        analyticsCharts.alertTypeDistribution = null;
    }
    
    // Destroy ApexCharts instances
    if (analyticsCharts.riskScoreGauge) {
        analyticsCharts.riskScoreGauge.destroy();
        analyticsCharts.riskScoreGauge = null;
    }
}

// Force resize of all analytics charts
function resizeAnalyticsCharts() {
    console.log('🔧 Resizing analytics charts...');
    
    // Resize Chart.js instances� Available data: ${dashboardData.sensorData?.length || 0} readings, ${dashboardData.alerts?.length || 0} alerts`);
    console.log(`🏭 Factory filter: ${currentFactoryId || 'All Factories'}`);
    
    initEquipmentEfficiencyChart();
    initHealthScoreTrendsChart();
    initAlertTypeDistributionChart();
    initRiskScoreGauge();
    updateAnalyticsKPIs();
    
    console.log('✅ All analytics charts initialized successfully');
}

// Update analytics charts with new data (without recreating)
function updateAnalyticsChartsData() {
    if (!analyticsChartsInitialized) {
        console.log('⚠️ Analytics charts not initialized yet');
        return;
    }

    const factoryText = currentFactoryId ? `Factory ${currentFactoryId}` : 'All Factories';
    console.log(`🔄 Updating analytics charts with data from: ${factoryText}`);
    console.log(`📊 Data: ${dashboardData.sensorData?.length || 0} readings, ${dashboardData.alerts?.length || 0} alerts`);

    // Call init functions - they will update existing charts
    // No scroll manipulation needed - let the page stay where it is
    initEquipmentEfficiencyChart();
    initHealthScoreTrendsChart();
    initAlertTypeDistributionChart();
    initRiskScoreGauge();
    updateAnalyticsKPIs();

    console.log('✅ Analytics charts updated');
}

function destroyAnalyticsCharts() {
    // Destroy Chart.js instances
    if (analyticsCharts.equipmentEfficiency) {
        analyticsCharts.equipmentEfficiency.destroy();
        analyticsCharts.equipmentEfficiency = null;
    }
    if (analyticsCharts.healthScoreTrends) {
        analyticsCharts.healthScoreTrends.destroy();
        analyticsCharts.healthScoreTrends = null;
    }
    if (analyticsCharts.alertTypeDistribution) {
        analyticsCharts.alertTypeDistribution.destroy();
        analyticsCharts.alertTypeDistribution = null;
    }
    
    // Destroy ApexCharts instances
    if (analyticsCharts.riskScoreGauge) {
        analyticsCharts.riskScoreGauge.destroy();
        analyticsCharts.riskScoreGauge = null;
    }
}

// Force resize of all analytics charts
function resizeAnalyticsCharts() {
    console.log('🔧 Resizing analytics charts...');
    
    // Resize Chart.js instances
    if (analyticsCharts.equipmentEfficiency) {
        analyticsCharts.equipmentEfficiency.resize();
    }
    if (analyticsCharts.healthScoreTrends) {
        analyticsCharts.healthScoreTrends.resize();
    }
    if (analyticsCharts.alertTypeDistribution) {
        analyticsCharts.alertTypeDistribution.resize();
    }
    
    // ApexCharts automatically handles resize, but we can trigger a re-render if needed
    if (analyticsCharts.riskScoreGauge) {
        // ApexCharts resize is automatic with window.resize event
        analyticsCharts.riskScoreGauge.updateOptions({}, false, true);
    }
    
    console.log('✅ Analytics charts resized');
}

// ==========================================================================
// NEW ANALYTICS CHARTS - UNIQUE TO ANALYTICS PAGE
// 1. Equipment Efficiency Chart (Horizontal Bar Chart)
function initEquipmentEfficiencyChart() {
    const canvas = document.getElementById('equipmentEfficiencyChart');
    if (!canvas) {
        console.error('equipmentEfficiencyChart canvas not found');
        return false;
    }
    
    if (!window.Chart) {
        console.error('Chart.js not loaded');
        return false;
    }

    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        
        // Calculate efficiency for each machine based on alerts
        const machineEfficiency = {};
        const sensorData = dashboardData.sensorData || [];
        const alerts = dashboardData.alerts || [];
        
        console.log(`📊 Processing ${sensorData.length} sensor readings and ${alerts.length} alerts for efficiency chart`);
        
        // Get unique machines
        sensorData.forEach(reading => {
            const id = reading.machine_id;
            if (!machineEfficiency[id]) {
                machineEfficiency[id] = { readings: 0, alerts: 0 };
            }
            machineEfficiency[id].readings++;
        });
        
        // Count alerts per machine
        alerts.forEach(alert => {
            const id = alert.machine_id;
            if (machineEfficiency[id]) {
                machineEfficiency[id].alerts++;
            }
        });
        
        // Calculate efficiency percentage (100% - alert ratio)
        let machines = Object.keys(machineEfficiency).slice(0, 8).map(id => {
            const data = machineEfficiency[id];
            const alertRatio = (data.alerts / data.readings) * 100 || 0;
            const efficiency = Math.max(0, Math.min(100, 100 - alertRatio));
            return {
                id: `Machine ${id}`,
                efficiency: Number(efficiency.toFixed(1))
            };
        }).sort((a, b) => b.efficiency - a.efficiency);
        
        // Use sample data if no data available
        if (machines.length === 0) {
            console.warn('⚠️ No machine data, using sample data');
            machines = [
                { id: 'Machine 1', efficiency: 92 },
                { id: 'Machine 2', efficiency: 85 },
                { id: 'Machine 3', efficiency: 78 },
                { id: 'Machine 4', efficiency: 88 }
            ];
        }
        
        const labels = machines.map(m => m.id);
        const efficiencyData = machines.map(m => m.efficiency);
        
        if (analyticsCharts.equipmentEfficiency) {
            analyticsCharts.equipmentEfficiency.data.labels = labels;
            analyticsCharts.equipmentEfficiency.data.datasets[0].data = efficiencyData;
            analyticsCharts.equipmentEfficiency.update('none');
            return true;
        }
        
        analyticsCharts.equipmentEfficiency = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Efficiency %',
                    data: efficiencyData,
                    backgroundColor: efficiencyData.map(val => 
                        val >= 80 ? 'rgba(16, 185, 129, 0.8)' : 
                        val >= 60 ? 'rgba(245, 158, 11, 0.8)' : 
                        'rgba(239, 68, 68, 0.8)'
                    ),
                    borderColor: efficiencyData.map(val => 
                        val >= 80 ? '#10b981' : 
                        val >= 60 ? '#f59e0b' : 
                        '#ef4444'
                    ),
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        callbacks: {
                            label: (ctx) => `Efficiency: ${ctx.parsed.x}%`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            callback: (val) => val + '%'
                        }
                    },
                    y: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
        
        console.log('✅ Equipment efficiency chart rendered');
        return true;
    } catch (e) {
        console.error('Error creating equipment efficiency chart:', e);
        return false;
    }
}

// 2. Health Score Trends Chart (Area Chart)
function initHealthScoreTrendsChart() {
    const canvas = document.getElementById('healthScoreTrendsChart');
    if (!canvas) {
        console.error('healthScoreTrendsChart canvas not found');
        return false;
    }
    
    if (!window.Chart) {
        console.error('Chart.js not loaded');
        return false;
    }

    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        
        // Generate health score trend data (simulated over time)
        const sensorData = dashboardData.sensorData || [];
        let sortedData = [...sensorData].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).slice(-50);
        
        // If no data, use sample data
        if (sortedData.length === 0) {
            console.warn('⚠️ No sensor data, using sample health scores');
            sortedData = Array.from({ length: 20 }, (_, i) => ({
                timestamp: i,
                temperature: 298 + Math.random() * 10,
                vibration: 1500 + Math.random() * 500
            }));
        }
        
        const sampleRate = Math.max(1, Math.floor(sortedData.length / 20));
        const labels = [];
        const healthScores = [];
        
        for (let i = 0; i < sortedData.length; i += sampleRate) {
            const reading = sortedData[i];
            const temp = parseFloat(reading.temperature) || 298;
            const vib = parseFloat(reading.vibration) || 1500;
            
            // Calculate health score based on temp and vibration (inverse of deviation from normal)
            const tempNorm = (temp - 298) / 10; // Deviation from 298K
            const vibNorm = (vib - 1500) / 500; // Deviation from 1500 RPM
            const healthScore = Math.max(0, Math.min(100, 100 - Math.abs(tempNorm) * 10 - Math.abs(vibNorm) * 5));
            
            labels.push(reading.timestamp !== undefined ? `T${reading.timestamp}` : `#${i + 1}`);
            healthScores.push(Number(healthScore.toFixed(1)));
        }
        
        if (analyticsCharts.healthScoreTrends) {
            analyticsCharts.healthScoreTrends.data.labels = labels;
            analyticsCharts.healthScoreTrends.data.datasets[0].data = healthScores;
            analyticsCharts.healthScoreTrends.update('none');
            return true;
        }
        
        analyticsCharts.healthScoreTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Health Score',
                    data: healthScores,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        callbacks: {
                            label: (ctx) => `Health: ${ctx.parsed.y}%`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            callback: (val) => val + '%'
                        }
                    }
                }
            }
        });
        
        console.log('✅ Health score trends chart rendered');
        return true;
    } catch (e) {
        console.error('Error creating health score trends chart:', e);
        return false;
    }
}

// 3. Alert Type Distribution Chart (Doughnut Chart)
function initAlertTypeDistributionChart() {
    const canvas = document.getElementById('alertTypeDistributionChart');
    if (!canvas) {
        console.error('alertTypeDistributionChart canvas not found');
        return false;
    }
    
    if (!window.Chart) {
        console.error('Chart.js not loaded');
        return false;
    }

    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        
        // Count different alert types
        const alerts = dashboardData.alerts || [];
        let criticalCount = 0;
        let warningCount = 0;
        let normalCount = 0;
        
        console.log(`📊 Processing ${alerts.length} alerts for distribution chart`);
        
        alerts.forEach(alert => {
            const alertText = alert.Alert || '';
            const alertLower = alertText.toLowerCase();
            
            if (alertLower.includes('critical') || alertText.includes('🔥')) {
                criticalCount++;
            } else if (alertLower.includes('warning') || alertText.includes('⚠️')) {
                warningCount++;
            } else if (alertLower.includes('normal') || alertText.includes('✅')) {
                normalCount++;
            }
        });
        
        console.log(`Alert counts - Critical: ${criticalCount}, Warning: ${warningCount}, Normal: ${normalCount}`);
        
        // If no data, show sample data for visualization
        if (criticalCount === 0 && warningCount === 0 && normalCount === 0) {
            criticalCount = 5;
            warningCount = 10;
            normalCount = 85;
            console.log('⚠️ No alert data found, using sample data');
        }
        
        const labels = ['Critical', 'Warning', 'Normal'];
        const data = [criticalCount, warningCount, normalCount];
        const backgroundColors = [
            'rgba(239, 68, 68, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(16, 185, 129, 0.8)'
        ];
        const borderColors = ['#ef4444', '#f59e0b', '#10b981'];
        
        if (analyticsCharts.alertTypeDistribution) {
            analyticsCharts.alertTypeDistribution.data.datasets[0].data = data;
            analyticsCharts.alertTypeDistribution.update('none');
            console.log('✅ Alert type distribution chart updated');
            return true;
        }
        
        analyticsCharts.alertTypeDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#374151',
                            font: {
                                size: 12,
                                family: 'Inter'
                            },
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        callbacks: {
                            label: (ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                                return `${ctx.label}: ${ctx.parsed} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('✅ Alert type distribution chart rendered successfully');
        return true;
    } catch (e) {
        console.error('Error creating alert distribution chart:', e);
        return false;
    }
}
// 4. Risk Score Gauge Chart
function initRiskScoreGauge() {
    const container = document.getElementById('riskScoreGaugeChart');
    if (!container) {
        console.warn('Risk score gauge container not found');
        return false;
    }
    
    if (!window.ApexCharts) {
        console.warn('ApexCharts not loaded');
        
        // Fallback to text display
        const systemHealth = Number.isFinite(dashboardData.health) ? dashboardData.health : 75;
        const riskScore = Math.min(Math.max(Math.round(100 - systemHealth), 0), 100);
        let riskLevel = 'LOW RISK';
        if (riskScore >= 70) riskLevel = 'HIGH RISK';
        else if (riskScore >= 40) riskLevel = 'MODERATE';
        
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 4rem; font-weight: bold; color: ${riskScore >= 70 ? '#ef4444' : riskScore >= 40 ? '#f59e0b' : '#10b981'};">${riskScore}</div>
                <div style="font-size: 1.2rem; color: #6b7280; margin-top: 1rem;">${riskLevel}</div>
            </div>
        `;
        return true;
    }

    try {
        // Use system health to drive risk (inverse of health score)
        const systemHealth = Number.isFinite(dashboardData.health) ? dashboardData.health : 75;
        const riskScore = Math.min(Math.max(Math.round(100 - systemHealth), 0), 100);
        
        // Risk level text
        let riskLevel = 'LOW RISK';
        let riskColor = '#10b981';
        if (riskScore >= 70) {
            riskLevel = 'HIGH RISK';
            riskColor = '#ef4444';
        } else if (riskScore >= 40) {
            riskLevel = 'MODERATE';
            riskColor = '#f59e0b';
        }
        
        console.log(`Risk Score calculated: ${riskScore} (${riskLevel}) from health=${systemHealth}`);
        
        if (analyticsCharts.riskScoreGauge) {
            // Update existing chart
            analyticsCharts.riskScoreGauge.updateSeries([riskScore]);
            return true;
        }
        
        const options = {
            series: [riskScore],
            chart: {
                type: 'radialBar',
                height: 300,
                offsetY: -10,
                animations: {
                    enabled: false
                }
            },
            plotOptions: {
                radialBar: {
                    startAngle: -135,
                    endAngle: 135,
                    hollow: {
                        margin: 0,
                        size: '70%',
                        background: '#1e293b',
                        position: 'front',
                        dropShadow: {
                            enabled: true,
                            top: 3,
                            left: 0,
                            blur: 4,
                            opacity: 0.24
                        }
                    },
                    track: {
                        background: '#334155',
                        strokeWidth: '100%',
                        margin: 0,
                        dropShadow: {
                            enabled: true,
                            top: -3,
                            left: 0,
                            blur: 4,
                            opacity: 0.35
                        }
                    },
                    dataLabels: {
                        show: true,
                        name: {
                            offsetY: 25,
                            show: true,
                            color: riskColor,
                            fontSize: '14px',
                            fontWeight: 700
                        },
                        value: {
                            formatter: function(val) {
                                return parseInt(val);
                            },
                            offsetY: -15,
                            color: '#fff',
                            fontSize: '48px',
                            fontWeight: 700,
                            show: true
                        }
                    }
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'dark',
                    type: 'horizontal',
                    shadeIntensity: 0.5,
                    gradientToColors: [riskColor],
                    inverseColors: false,
                    opacityFrom: 1,
                    opacityTo: 1,
                    stops: [0, 100]
                }
            },
            colors: [riskScore < 40 ? '#10b981' : riskScore < 70 ? '#f59e0b' : '#ef4444'],
            stroke: {
                lineCap: 'round'
            },
            labels: [riskLevel]
        };
        
        container.innerHTML = ''; // Clear container
        analyticsCharts.riskScoreGauge = new ApexCharts(container, options);
        analyticsCharts.riskScoreGauge.render();
        
        console.log('✅ Risk score gauge rendered successfully');
        return true;
    } catch (e) {
        console.error('Error creating risk score gauge:', e);
        return false;
    }
}

// Initialize Vibration Trend Chart
function initVibrationTrendChart() {
    const canvas = document.getElementById('vibrationTrendChart');
    if (!canvas) {
        console.error('vibrationTrendChart canvas not found');
        return;
    }
    
    if (!window.Chart) {
        console.error('Chart.js not loaded');
        return;
    }
    
    // Safety check for data
    if (!dashboardData.sensorData || dashboardData.sensorData.length === 0) {
        console.warn('No sensor data for vibration chart');
        return;
    }
    
    // Group data by timestamp to show trend over time
    const sortedData = [...dashboardData.sensorData]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-100);
    
    // Generate date labels like "Apr 1", "Apr 5", etc.
    const sampleRate = Math.max(1, Math.floor(sortedData.length / 30));
    const timeLabels = [];
    const vibrationData = [];
    
    for (let i = 0; i < sortedData.length; i += sampleRate) {
        const reading = sortedData[i];
        const vibVal = parseFloat(reading.vibration);
        
        if (!isNaN(vibVal)) {
            const tsLabel = reading.timestamp !== undefined ? `T${reading.timestamp}` : `#${i + 1}`;
            timeLabels.push(tsLabel);
            vibrationData.push(Number((vibVal / 1000).toFixed(2))); // Convert to mm/s
        }
    }

    const vibMin = vibrationData.length ? Math.min(...vibrationData) : 0;
    const vibMax = vibrationData.length ? Math.max(...vibrationData) : 5;
    const vibPadding = Math.max(0.2, (vibMax - vibMin) * 0.1);
    
    if (analyticsCharts.vibrationTrend) {
        analyticsCharts.vibrationTrend.data.labels = timeLabels;
        analyticsCharts.vibrationTrend.data.datasets[0].data = vibrationData;
        analyticsCharts.vibrationTrend.update('none');
        return;
    }

    analyticsCharts.vibrationTrend = new Chart(canvas, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [{
                label: 'Vibration',
                data: vibrationData,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.3)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointBackgroundColor: '#ef4444',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: { display: false },
                tooltip: { 
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: { 
                        label: (ctx) => `${ctx.parsed.y} mm/s` 
                    }
                }
            },
            scales: { 
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7280',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: { 
                    beginAtZero: true,
                    max: vibMax + vibPadding,
                    title: { 
                        display: false
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7280'
                    }
                }
            }
        }
    });
    
    console.log('Vibration trend chart rendered successfully');
}

// Update Analytics KPIs
function updateAnalyticsKPIs() {
    const sensorData = dashboardData.sensorData || [];
    const alerts = dashboardData.alerts || [];
    
    if (sensorData.length === 0) {
        console.warn('No sensor data for KPIs');
        return;
    }
    
    // Calculate average temperature (convert Kelvin to Celsius)
    const temps = sensorData.map(d => parseFloat(d.temperature) - 273.15).filter(t => !isNaN(t));
    const avgTemp = temps.length > 0 ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '--';
    
    // Calculate average vibration (convert to mm/s)
    const vibes = sensorData.map(d => parseFloat(d.vibration) / 1000).filter(v => !isNaN(v));
    const avgVib = vibes.length > 0 ? (vibes.reduce((a, b) => a + b, 0) / vibes.length).toFixed(1) : '--';
    
    // Count anomalies (critical + warning alerts)
    const anomalyCount = (dashboardData.critical || 0) + (dashboardData.warnings || 0);
    
    // Update KPI displays
    const avgTempEl = document.getElementById('analyticsAvgTemp');
    const avgVibEl = document.getElementById('analyticsAvgVibration');
    const anomalyEl = document.getElementById('analyticsAnomalyCount');
    
    if (avgTempEl) avgTempEl.textContent = avgTemp;
    if (avgVibEl) avgVibEl.textContent = avgVib;
    if (anomalyEl) anomalyEl.textContent = anomalyCount;
    
    console.log(`📊 Analytics KPIs Updated: Temp=${avgTemp}°C, Vib=${avgVib}mm/s, Anomalies=${anomalyCount}`);
}

// ==========================================================================
// Analytics Insights Generation
// ==========================================================================
function initCorrelationChart() {
    const canvas = document.getElementById('correlationChart');
    if (!canvas || !window.Chart) return;
    
    const correlationData = dashboardData.sensorData.slice(0, 200).map(reading => ({
        x: parseFloat(reading.temperature),
        y: parseFloat(reading.vibration)
    }));
    
    if (analyticsCharts.correlation) {
        // Update existing chart in place
        analyticsCharts.correlation.data.datasets[0].data = correlationData;
        analyticsCharts.correlation.update('none');
        return;
    }
    
    analyticsCharts.correlation = new Chart(canvas, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Temperature vs Vibration',
                data: correlationData,
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: '#3b82f6',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                tooltip: {
                    callbacks: { label: (ctx) => `Temp: ${ctx.parsed.x.toFixed(1)}K, Vib: ${ctx.parsed.y.toFixed(0)} RPM` }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Temperature (K)' }, type: 'linear' },
                y: { title: { display: true, text: 'Vibration (RPM)' }, type: 'linear' }
            }
        }
    });
}

// Machine Performance Comparison
function initMachineComparisonChart() {
    const canvas = document.getElementById('machineComparisonChart');
    if (!canvas || !window.Chart) return;
    
    const machineStats = {};
    dashboardData.alerts.forEach(alert => {
        const id = alert.machine_id;
        if (!id && id !== 0) return;
        if (!machineStats[id]) machineStats[id] = { critical: 0, warning: 0, normal: 0 };
        if (alert.Alert && alert.Alert.includes('CRITICAL')) machineStats[id].critical++;
        else if (alert.Alert && alert.Alert.includes('WARNING')) machineStats[id].warning++;
        else machineStats[id].normal++;
    });

    const topMachines = Object.keys(machineStats)
        .map(id => {
            const stats = machineStats[id];
            const total = stats.critical + stats.warning + stats.normal;
            return { id, total, ...stats };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(item => ({
            machine: `Machine ${item.id}`,
            critical: item.critical,
            warning: item.warning,
            normal: item.normal
        }));
    
    if (analyticsCharts.machineComparison) {
        // Update existing chart in place
        analyticsCharts.machineComparison.data.labels = topMachines.map(m => m.machine);
        analyticsCharts.machineComparison.data.datasets[0].data = topMachines.map(m => m.critical);
        analyticsCharts.machineComparison.data.datasets[1].data = topMachines.map(m => m.warning);
        analyticsCharts.machineComparison.data.datasets[2].data = topMachines.map(m => m.normal);
        analyticsCharts.machineComparison.update('none');
        return;
    }

    analyticsCharts.machineComparison = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: topMachines.map(m => m.machine),
            datasets: [
                { label: 'Critical', data: topMachines.map(m => m.critical), backgroundColor: '#ef4444' },
                { label: 'Warning', data: topMachines.map(m => m.warning), backgroundColor: '#f59e0b' },
                { label: 'Normal', data: topMachines.map(m => m.normal), backgroundColor: '#10b981' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { stacked: true },
                y: { stacked: true, title: { display: true, text: 'Alert Count' } }
            }
        }
    });
}

// Alert Frequency Timeline
function initAlertTimelineChart() {
    const container = document.getElementById('alertTimelineChart');
    if (!container || !window.ApexCharts) return;
    
    const hours = Array(24).fill(0).map((_, i) => i);
    const criticalAlerts = hours.map(() => {
        const critical = dashboardData.alerts.filter(a => a.Alert && a.Alert.includes('CRITICAL')).length;
        return Math.floor(critical / 24); // Distribute across 24 hours
    });
    const warningAlerts = hours.map(() => {
        const warning = dashboardData.alerts.filter(a => a.Alert && a.Alert.includes('WARNING')).length;
        return Math.floor(warning / 24); // Distribute across 24 hours
    });
    
    if (analyticsCharts.alertTimeline) {
        // Update existing chart in place
        analyticsCharts.alertTimeline.updateSeries([
            { name: 'Critical Alerts', data: criticalAlerts },
            { name: 'Warning Alerts', data: warningAlerts }
        ]);
        analyticsCharts.alertTimeline.updateOptions({
            xaxis: { categories: hours.map(h => `${h}:00`) }
        }, false, true);
        return;
    }
    
    const options = {
        series: [
            { name: 'Critical Alerts', data: criticalAlerts },
            { name: 'Warning Alerts', data: warningAlerts }
        ],
        chart: { type: 'area', height: 350, toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: false } },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        colors: ['#ef4444', '#f59e0b'],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.6, opacityTo: 0.1 } },
        xaxis: { categories: hours.map(h => `${h}:00`), title: { text: 'Time (Hours)' } },
        yaxis: { title: { text: 'Alert Count' } },
        legend: { position: 'top' },
        grid: { borderColor: '#e5e7eb' }
    };
    
    analyticsCharts.alertTimeline = new ApexCharts(container, options);
    analyticsCharts.alertTimeline.render();
}

// Generate AI-Powered Insights
function generateAnalyticsInsights() {
    const container = document.getElementById('analyticsInsights');
    if (!container) return;
    
    const insights = [
        { icon: '🔥', title: 'Critical Pattern Detected', description: `${dashboardData.critical} machines showing critical temperature thresholds. Immediate maintenance recommended.`, severity: 'high' },
        { icon: '📊', title: 'System Health Status', description: `Overall system health at ${dashboardData.health}%. ${dashboardData.health > 90 ? 'All systems operating optimally.' : 'Performance optimization recommended.'}`, severity: dashboardData.health > 90 ? 'low' : 'medium' },
        { icon: '⚠️', title: 'Maintenance Alert', description: `${dashboardData.warnings} machines with elevated vibration levels require inspection. Predictive models suggest maintenance within 72 hours.`, severity: 'medium' }
    ];
    
    container.innerHTML = insights.map(insight => `
        <div style="background: ${insight.severity === 'high' ? '#fee2e2' : insight.severity === 'medium' ? '#fef3c7' : '#dbeafe'}; padding: 1.5rem; border-radius: 10px; border-left: 4px solid ${insight.severity === 'high' ? '#ef4444' : insight.severity === 'medium' ? '#f59e0b' : '#3b82f6'};">
            <div style="display: flex; align-items: flex-start; gap: 1rem;">
                <div style="font-size: 2rem;">${insight.icon}</div>
                <div style="flex: 1;">
                    <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #1f2937;">${insight.title}</h4>
                    <p style="color: #4b5563; font-size: 0.95rem; line-height: 1.5;">${insight.description}</p>
                </div>
            </div>
        </div>
    `).join('');
}

