// Dashboard Page JavaScript
// ต้องโหลด env.js, api.js, thingsboard.js ก่อน

// Check authentication
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    // Load user info
    loadUserInfo();

    // Initialize charts
    initCharts();
    initWithSampleData();

    // Connect to ThingsBoard WebSocket
    connectToThingsBoard();
});

// Load user info into header
async function loadUserInfo() {
    // Fetch fresh user data from server to ensure it's up to date
    const freshUser = await api.getMe();
    if (freshUser) {
        // Update localStorage with fresh data
        localStorage.setItem('user', JSON.stringify(freshUser));
        api.user = freshUser;
    }

    const user = freshUser || api.getUser();
    if (user) {
        const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) {
            userAvatar.textContent = initials;
            if (user.avatarColor) {
                userAvatar.style.background = user.avatarColor;
            }
        }
        document.querySelector('.user-name').textContent = user.firstName || 'User';

        // Update profile modal
        if (document.querySelector('.modal-profile-avatar')) {
            document.querySelector('.modal-profile-avatar').textContent = initials;
            document.querySelector('.modal-profile-name').textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
            document.querySelector('.modal-profile-role').textContent = user.role || 'User';
        }

        // Update modal form inputs by ID
        const setInputValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '-';
        };
        setInputValue('profileFirstName', user.firstName);
        setInputValue('profileLastName', user.lastName);
        setInputValue('profileEmail', user.email);
        setInputValue('profileRole', user.role);
        setInputValue('profileDepartment', user.department);
        setInputValue('profilePhone', user.phone);

        // Show/hide admin link based on role
        const adminLink = document.getElementById('adminPanelLink');
        if (adminLink) {
            adminLink.style.display = user.role === 'admin' ? '' : 'none';
        }
    }
}

// Connect to ThingsBoard
async function connectToThingsBoard() {
    console.log('Attempting to connect to ThingsBoard WebSocket...');

    // Set up callbacks
    tbAPI.onVibrationData = (data) => {
        updateVibrationData(data);
        updateLastUpdateTime();
    };

    tbAPI.onPowerData = (data) => {
        updatePowerData(data);
        updateLastUpdateTime();
    };

    tbAPI.onServerData = (data) => {
        updateServerData(data);
        updateLastUpdateTime();
    };

    tbAPI.onConnectionChange = (isConnected) => {
        updateConnectionStatus(isConnected);
        console.log('WebSocket connection status:', isConnected ? 'Connected' : 'Disconnected');
    };

    // Connect
    const connected = await tbAPI.connect();

    if (!connected) {
        console.log('WebSocket connection failed. Using simulated data.');
        setInterval(simulateDataUpdate, 2000);
    }
}

// Tab Navigation
function switchMainTab(tabName) {
    document.querySelectorAll('.main-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (event && event.target) {
        event.target.closest('.main-tab').classList.add('active');
    }
    document.getElementById(tabName + '-tab').classList.add('active');

    document.querySelectorAll('.main-tab').forEach(tab => {
        if (tab.textContent.toLowerCase().includes(tabName)) {
            tab.classList.add('active');
        }
    });
}

// Profile Modal
function openProfileModal() {
    document.getElementById('profileModalOverlay').classList.add('active');
    document.getElementById('profileModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
    document.getElementById('profileModalOverlay').classList.remove('active');
    document.getElementById('profileModal').classList.remove('active');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProfileModal(); });

// Logout
async function logout() {
    await api.logout();
    window.location.href = '/Login';
}

// Charts
let vibrationData = { accel_x: [], accel_y: [], accel_z: [], velocity_x: [], velocity_y: [], velocity_z: [] };
let chartType = 'acceleration';
let vibrationChart, overviewChart, powerChart;
let powerHistory = [];

function getChartGridColor() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
}

function getChartTextColor() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? '#94a3b8' : '#6b7280';
}

function initCharts() {
    const gridColor = getChartGridColor();
    const textColor = getChartTextColor();

    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 15, font: { family: 'Outfit', size: 11 }, color: textColor } } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: textColor } },
                y: { grid: { color: gridColor }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: textColor } }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    };

    vibrationChart = new Chart(document.getElementById('vibrationChart'), {
        ...chartConfig,
        data: { labels: [], datasets: [
            { label: 'X-Axis', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 2, tension: 0.4, fill: true },
            { label: 'Y-Axis', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 2, tension: 0.4, fill: true },
            { label: 'Z-Axis', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 2, tension: 0.4, fill: true }
        ]}
    });

    overviewChart = new Chart(document.getElementById('overviewChart'), {
        ...chartConfig,
        data: { labels: [], datasets: [
            { label: 'Accel Z', data: [], borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 2, tension: 0.4, fill: true }
        ]}
    });

    powerChart = new Chart(document.getElementById('powerChart'), {
        ...chartConfig,
        data: { labels: [], datasets: [
            { label: 'Power (W)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 2, tension: 0.4, fill: true }
        ]}
    });
}

function setChartType(type) {
    chartType = type;
    document.querySelectorAll('.widget-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    updateCharts();
}

function updateCharts() {
    const labels = [], dataX = [], dataY = [], dataZ = [];
    const sourceX = chartType === 'acceleration' ? vibrationData.accel_x : vibrationData.velocity_x;
    const sourceY = chartType === 'acceleration' ? vibrationData.accel_y : vibrationData.velocity_y;
    const sourceZ = chartType === 'acceleration' ? vibrationData.accel_z : vibrationData.velocity_z;
    const maxPoints = 15, startIdx = Math.max(0, sourceX.length - maxPoints);

    for (let i = startIdx; i < sourceX.length; i++) {
        labels.push(new Date(sourceX[i].ts).toLocaleTimeString());
        dataX.push(parseFloat(sourceX[i].value));
        dataY.push(parseFloat(sourceY[i]?.value || 0));
        dataZ.push(parseFloat(sourceZ[i]?.value || 0));
    }

    vibrationChart.data.labels = labels;
    vibrationChart.data.datasets[0].data = dataX;
    vibrationChart.data.datasets[1].data = dataY;
    vibrationChart.data.datasets[2].data = dataZ;
    vibrationChart.data.datasets[0].label = chartType === 'acceleration' ? 'X (g)' : 'X (mm/s)';
    vibrationChart.data.datasets[1].label = chartType === 'acceleration' ? 'Y (g)' : 'Y (mm/s)';
    vibrationChart.data.datasets[2].label = chartType === 'acceleration' ? 'Z (g)' : 'Z (mm/s)';
    vibrationChart.update('none');

    overviewChart.data.labels = labels;
    overviewChart.data.datasets[0].data = dataZ;
    overviewChart.update('none');

    const powerLabels = powerHistory.slice(-15).map(p => new Date(p.ts).toLocaleTimeString());
    const powerData = powerHistory.slice(-15).map(p => p.value);
    powerChart.data.labels = powerLabels;
    powerChart.data.datasets[0].data = powerData;
    powerChart.update('none');
}

function updateVibrationData(data) {
    if (data.accel_x) { vibrationData.accel_x.push(...data.accel_x); document.getElementById('accelX').textContent = parseFloat(data.accel_x[0].value).toFixed(3); }
    if (data.accel_y) { vibrationData.accel_y.push(...data.accel_y); document.getElementById('accelY').textContent = parseFloat(data.accel_y[0].value).toFixed(3); }
    if (data.accel_z) { vibrationData.accel_z.push(...data.accel_z); document.getElementById('accelZ').textContent = parseFloat(data.accel_z[0].value).toFixed(3); }
    if (data.velocity_x) { vibrationData.velocity_x.push(...data.velocity_x); document.getElementById('velX').textContent = parseFloat(data.velocity_x[0].value).toFixed(3); }
    if (data.velocity_y) { vibrationData.velocity_y.push(...data.velocity_y); document.getElementById('velY').textContent = parseFloat(data.velocity_y[0].value).toFixed(3); }
    if (data.velocity_z) { vibrationData.velocity_z.push(...data.velocity_z); document.getElementById('velZ').textContent = parseFloat(data.velocity_z[0].value).toFixed(3); }
    if (data.vib_temp) {
        const temp = parseFloat(data.vib_temp[0].value).toFixed(1);
        document.getElementById('vibTempValue').innerHTML = temp + '<span class="metric-unit">°C</span>';
        document.getElementById('tempValueDisplay').textContent = temp + '°C';
    }
    updateCharts();
}

function updatePowerData(data) {
    if (data.voltage) { const v = parseFloat(data.voltage[0].value).toFixed(1); document.getElementById('voltageValue').innerHTML = v + '<span class="metric-unit">V</span>'; document.getElementById('voltageValue2').innerHTML = v + '<span class="metric-unit">V</span>'; }
    if (data.current) { const c = parseFloat(data.current[0].value).toFixed(1); document.getElementById('currentValue').innerHTML = c + '<span class="metric-unit">A</span>'; document.getElementById('currentValue2').innerHTML = c + '<span class="metric-unit">A</span>'; }
    if (data.active_power) { const p = parseFloat(data.active_power[0].value).toFixed(1); document.getElementById('powerValue').innerHTML = p + '<span class="metric-unit">W</span>'; document.getElementById('powerValue2').innerHTML = p + '<span class="metric-unit">W</span>'; powerHistory.push({ ts: Date.now(), value: parseFloat(p) }); }
    if (data.frequency) document.getElementById('frequencyValue').textContent = parseFloat(data.frequency[0].value).toFixed(1) + ' Hz';
    if (data.power_factor) document.getElementById('pfValue').textContent = parseFloat(data.power_factor[0].value).toFixed(3);
    if (data.total_energy) document.getElementById('totalEnergyValue').textContent = parseFloat(data.total_energy[0].value).toFixed(2) + ' kWh';
    if (data.energy_cost) document.getElementById('energyCostValue').textContent = parseFloat(data.energy_cost[0].value).toFixed(2) + ' ฿';
}

function updateServerData(data) {
    if (data.cpu_usage) document.getElementById('headerCpuValue').textContent = parseFloat(data.cpu_usage[0].value).toFixed(1) + '%';
    if (data.cpu_temp) document.getElementById('headerTempValue').textContent = parseFloat(data.cpu_temp[0].value).toFixed(1) + '°C';
    if (data.ram_usage_percent) document.getElementById('headerRamValue').textContent = parseFloat(data.ram_usage_percent[0].value).toFixed(1) + '%';
    if (data.disk_usage_percent) document.getElementById('headerDiskValue').textContent = parseFloat(data.disk_usage_percent[0].value).toFixed(1) + '%';
}

function updateLastUpdateTime() {
    document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
}

function updateConnectionStatus(isConnected) {
    const statusDots = document.querySelectorAll('.status-dot');
    statusDots.forEach(dot => {
        if (isConnected) {
            dot.classList.add('status-online');
            dot.classList.remove('status-offline');
        } else {
            dot.classList.remove('status-online');
            dot.classList.add('status-offline');
        }
    });
}

// Simulate data for fallback
function simulateDataUpdate() {
    updateVibrationData({
        accel_x: [{ ts: Date.now(), value: (Math.random() * 0.02 - 0.01).toFixed(6) }],
        accel_y: [{ ts: Date.now(), value: (Math.random() * 0.02 - 0.01).toFixed(6) }],
        accel_z: [{ ts: Date.now(), value: (-0.98 + Math.random() * 0.02).toFixed(6) }],
        velocity_x: [{ ts: Date.now(), value: (Math.random() * 0.5).toFixed(6) }],
        velocity_y: [{ ts: Date.now(), value: (Math.random() * 0.5).toFixed(6) }],
        velocity_z: [{ ts: Date.now(), value: (Math.random() * 0.5).toFixed(6) }],
        vib_temp: [{ ts: Date.now(), value: (28 + Math.random() * 2).toFixed(2) }]
    });
    updatePowerData({
        voltage: [{ ts: Date.now(), value: (228 + Math.random() * 4).toFixed(1) }],
        current: [{ ts: Date.now(), value: (2.0 + Math.random() * 0.3).toFixed(1) }],
        active_power: [{ ts: Date.now(), value: (45 + Math.random() * 10).toFixed(1) }],
        frequency: [{ ts: Date.now(), value: (49.9 + Math.random() * 0.2).toFixed(1) }],
        power_factor: [{ ts: Date.now(), value: (0.98 + Math.random() * 0.02).toFixed(3) }],
        total_energy: [{ ts: Date.now(), value: (0.5 + Math.random() * 0.2).toFixed(2) }],
        energy_cost: [{ ts: Date.now(), value: (1.8 + Math.random() * 0.3).toFixed(4) }]
    });
    updateServerData({
        cpu_temp: [{ ts: Date.now(), value: (35 + Math.random() * 10).toFixed(2) }],
        cpu_usage: [{ ts: Date.now(), value: (3 + Math.random() * 15).toFixed(1) }],
        ram_usage_percent: [{ ts: Date.now(), value: (20 + Math.random() * 15).toFixed(1) }],
        disk_usage_percent: [{ ts: Date.now(), value: (8 + Math.random() * 2).toFixed(1) }]
    });
    updateLastUpdateTime();
}

function initWithSampleData() {
    for (let i = 0; i < 12; i++) {
        vibrationData.accel_x.push({ ts: Date.now() - (12 - i) * 2000, value: (Math.random() * 0.02 - 0.01).toFixed(6) });
        vibrationData.accel_y.push({ ts: Date.now() - (12 - i) * 2000, value: (Math.random() * 0.02 - 0.01).toFixed(6) });
        vibrationData.accel_z.push({ ts: Date.now() - (12 - i) * 2000, value: (-0.98 + Math.random() * 0.02).toFixed(6) });
        vibrationData.velocity_x.push({ ts: Date.now() - (12 - i) * 2000, value: (Math.random() * 0.5).toFixed(6) });
        vibrationData.velocity_y.push({ ts: Date.now() - (12 - i) * 2000, value: (Math.random() * 0.5).toFixed(6) });
        vibrationData.velocity_z.push({ ts: Date.now() - (12 - i) * 2000, value: (Math.random() * 0.5).toFixed(6) });
        powerHistory.push({ ts: Date.now() - (12 - i) * 2000, value: 45 + Math.random() * 10 });
    }
    updateCharts();
    updateLastUpdateTime();
}

// Update charts theme when toggling dark/light mode
function updateChartsTheme() {
    const gridColor = getChartGridColor();
    const textColor = getChartTextColor();

    const charts = [vibrationChart, overviewChart, powerChart];
    charts.forEach(chart => {
        if (chart) {
            chart.options.scales.x.grid.color = gridColor;
            chart.options.scales.y.grid.color = gridColor;
            chart.options.scales.x.ticks.color = textColor;
            chart.options.scales.y.ticks.color = textColor;
            chart.options.plugins.legend.labels.color = textColor;
            chart.update('none');
        }
    });
}
