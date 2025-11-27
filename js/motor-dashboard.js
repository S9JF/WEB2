// Motor Dashboard - Real-time monitoring and analytics
// Requires: env.js, thingsboard.js, Chart.js

let motorId = null;
let motorConfig = null;
let charts = {};

// Get motor ID from URL
function getMotorIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('id')) || 1;
}

// Initialize dashboard
async function initDashboard() {
    motorId = getMotorIdFromURL();
    motorConfig = ENV.getMotorConfig(motorId);

    if (!motorConfig) {
        alert('Motor not found!');
        window.location.href = '/WaterTreatment';
        return;
    }

    // Set motor name and status
    document.getElementById('motor-name').textContent = `Pump ${motorId < 10 ? '0' + motorId : motorId}`;
    updateStatus(motorConfig.status);

    // Initialize charts
    initCharts();

    // Connect to ThingsBoard
    await connectToThingsBoard();
}

// Update status badge
function updateStatus(status) {
    const badge = document.getElementById('status-badge');
    badge.className = 'status-badge status-' + status;
    badge.textContent = status.toUpperCase();

    // Update health score based on status
    const healthScores = {
        'normal': 95,
        'warning': 65,
        'abnormal': 35
    };

    const healthMessages = {
        'normal': 'ระบบทำงานปกติ<br>ไม่มีปัญหา',
        'warning': 'ตลับลูกปืนเริ่มสึก<br>แนะนำ: เปลี่ยนภายใน 30 วัน',
        'abnormal': 'ตลับลูกปืนชำรุดมาก<br>แนะนำ: เปลี่ยนทันที'
    };

    updateHealthScore(healthScores[status], healthMessages[status]);
}

// Update health score
function updateHealthScore(percentage, message) {
    const ring = document.getElementById('health-ring');
    const percentageEl = document.getElementById('health-percentage');
    const messageEl = document.getElementById('health-message');

    // Calculate stroke dashoffset (339.29 is the circumference)
    const circumference = 339.29;
    const offset = circumference - (percentage / 100) * circumference;

    ring.style.strokeDashoffset = offset;
    percentageEl.textContent = percentage + '%';
    messageEl.innerHTML = message;

    // Change color based on percentage
    if (percentage >= 80) {
        ring.style.stroke = '#10B981'; // Green
    } else if (percentage >= 50) {
        ring.style.stroke = '#F59E0B'; // Amber
    } else {
        ring.style.stroke = '#EF4444'; // Red
    }
}

// Initialize charts
function initCharts() {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: '#94a3b8'
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: '#334155'
                },
                ticks: {
                    color: '#94a3b8'
                }
            },
            y: {
                grid: {
                    color: '#334155'
                },
                ticks: {
                    color: '#94a3b8'
                }
            }
        }
    };

    // Vibration Chart
    const vibrationCtx = document.getElementById('vibrationChart').getContext('2d');
    charts.vibration = new Chart(vibrationCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Velocity X',
                    data: [],
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Velocity Y',
                    data: [],
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Velocity Z',
                    data: [],
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: commonOptions
    });

    // Power Chart
    const powerCtx = document.getElementById('powerChart').getContext('2d');
    charts.power = new Chart(powerCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Active Power (kW)',
                data: [],
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: commonOptions
    });

    // Temperature Chart
    const tempCtx = document.getElementById('tempChart').getContext('2d');
    charts.temperature = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature (°C)',
                data: [],
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: commonOptions
    });
}

// Connect to ThingsBoard
async function connectToThingsBoard() {
    console.log(`Connecting to ThingsBoard for Motor ${motorId}...`);

    try {
        if (typeof tbAPI === 'undefined') {
            console.error('ThingsBoard API not loaded');
            return;
        }

        const connected = await tbAPI.connect();
        if (!connected) {
            console.error('Failed to connect to ThingsBoard');
            return;
        }

        console.log('Connected to ThingsBoard!');

        // Subscribe to motor data (filter by motorId)
        tbAPI.onVibrationData = (data, dataMotorId) => {
            if (dataMotorId === motorId) {
                updateVibrationData(data);
            }
        };

        tbAPI.onPowerData = (data, dataMotorId) => {
            if (dataMotorId === motorId) {
                updatePowerData(data);
            }
        };

    } catch (error) {
        console.error('Error connecting to ThingsBoard:', error);
    }
}

// Update vibration data
function updateVibrationData(data) {
    const velocity_x = parseFloat(data.velocity_x?.[0]?.value) || 0;
    const velocity_y = parseFloat(data.velocity_y?.[0]?.value) || 0;
    const velocity_z = parseFloat(data.velocity_z?.[0]?.value) || 0;
    const vib_temp = parseFloat(data.vib_temp?.[0]?.value) || 0;

    // Update metric cards
    const avgVibration = Math.abs((velocity_x + velocity_y + velocity_z) / 3);
    document.getElementById('vibration-value').textContent = avgVibration.toFixed(2);
    document.getElementById('temp-value').textContent = vib_temp.toFixed(1);

    // Update chart
    const now = new Date().toLocaleTimeString();
    if (charts.vibration.data.labels.length > 20) {
        charts.vibration.data.labels.shift();
        charts.vibration.data.datasets[0].data.shift();
        charts.vibration.data.datasets[1].data.shift();
        charts.vibration.data.datasets[2].data.shift();
    }

    charts.vibration.data.labels.push(now);
    charts.vibration.data.datasets[0].data.push(velocity_x);
    charts.vibration.data.datasets[1].data.push(velocity_y);
    charts.vibration.data.datasets[2].data.push(velocity_z);
    charts.vibration.update('none');

    // Update temperature chart
    if (charts.temperature.data.labels.length > 20) {
        charts.temperature.data.labels.shift();
        charts.temperature.data.datasets[0].data.shift();
    }
    charts.temperature.data.labels.push(now);
    charts.temperature.data.datasets[0].data.push(vib_temp);
    charts.temperature.update('none');
}

// Update power data
function updatePowerData(data) {
    const current = parseFloat(data.current?.[0]?.value) || 0;
    const voltage = parseFloat(data.voltage?.[0]?.value) || 0;
    const power = parseFloat(data.active_power?.[0]?.value) || 0;
    const powerFactor = parseFloat(data.power_factor?.[0]?.value) || 0;
    const energyCost = parseFloat(data.energy_cost?.[0]?.value) || 0;

    // Update metric cards
    document.getElementById('current-value').textContent = current.toFixed(2);
    document.getElementById('voltage-value').textContent = voltage.toFixed(1);
    document.getElementById('power-value').textContent = (power / 1000).toFixed(2);
    document.getElementById('pf-value').textContent = powerFactor.toFixed(2);
    document.getElementById('cost-value').textContent = energyCost.toFixed(2);

    // Update power chart
    const now = new Date().toLocaleTimeString();
    if (charts.power.data.labels.length > 20) {
        charts.power.data.labels.shift();
        charts.power.data.datasets[0].data.shift();
    }
    charts.power.data.labels.push(now);
    charts.power.data.datasets[0].data.push(power / 1000);
    charts.power.update('none');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initDashboard);
