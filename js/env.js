// Environment Configuration
// โหลดไฟล์นี้ก่อน script อื่นๆ ใน HTML

const ENV = {
    // Backend API (Factory IoT Web)
    API_URL: 'https://www.sittui-iotlab.online/api',

    // ThingsBoard Configuration
    TB_URL: 'https://tb.sittui-iotlab.online',
    TB_WS_URL: 'wss://tb.sittui-iotlab.online/api/ws',
    TB_USERNAME: 'tenant@thingsboard.org',
    TB_PASSWORD: '114990_Thanawat',

    // Device IDs - 9 Motors (each has PowerMeter + Vibration)
    DEVICES: {
        MOTORS: [
            {
                id: 1,
                powerMeterId: '477540a0-cbae-11f0-bef6-8f80a62bf6a0',
                vibrationId: '477d08d0-cbae-11f0-bef6-8f80a62bf6a0',
                status: 'normal' // normal, warning, abnormal
            },
            {
                id: 2,
                powerMeterId: '47928ca0-cbae-11f0-bef6-8f80a62bf6a0',
                vibrationId: '47921771-cbae-11f0-bef6-8f80a62bf6a0',
                status: 'normal'
            },
            {
                id: 3,
                powerMeterId: '4791a240-cbae-11f0-bef6-8f80a62bf6a0',
                vibrationId: '47915420-cbae-11f0-bef6-8f80a62bf6a0',
                status: 'normal'
            },
            {
                id: 4,
                powerMeterId: '478e6df0-cbae-11f0-bef6-8f80a62bf6a0',
                vibrationId: '479042b0-cbae-11f0-bef6-8f80a62bf6a0',
                status: 'warning'
            },
            {
                id: 5,
                powerMeterId: '47921770-cbae-11f0-bef6-8f80a62bf6a0',
                vibrationId: '47943a50-cbae-11f0-bef6-8f80a62bf6a0',
                status: 'warning'
            },
            {
                id: 6,
                powerMeterId: '479301d0-cbae-11f0-bef6-8f80a62bf6a0',
                vibrationId: '479b1820-cbae-11f0-bef6-8f80a62bf6a0',
                status: 'warning'
            },
            {
                id: 7,
                powerMeterId: '47b5f320-cbae-11f0-bef6-8f80a62bf6a0',
                vibrationId: '4784a9f0-cbae-11f0-bef6-8f80a62bf6a0',
                status: 'abnormal'
            },
            {
                id: 8,
                powerMeterId: '47b5f321-cbae-11f0-bef6-8f80a62bf6a0',
                vibrationId: '47e20c30-cbae-11f0-bef6-8f80a62bf6a0',
                status: 'abnormal'
            },
            {
                id: 9,
                powerMeterId: '315f9b70-cbaf-11f0-bef6-8f80a62bf6a0',
                vibrationId: '31671580-cbaf-11f0-bef6-8f80a62bf6a0',
                status: 'normal'
            }
        ],
        SERVER_MONITOR: '96212c00-c3a2-11f0-acc6-23bfa2fab24c'
    },

    // Telemetry Keys
    KEYS: {
        VIBRATION: ['accel_x', 'accel_y', 'accel_z', 'velocity_x', 'velocity_y', 'velocity_z', 'vib_temp'],
        POWER_METER: ['active_power', 'current', 'energy_cost', 'frequency', 'power_factor', 'total_energy', 'voltage'],
        SERVER_MONITOR: ['cpu_temp', 'cpu_usage', 'disk_total_gb', 'disk_usage_percent', 'disk_used_gb', 'ram_total_mb', 'ram_usage_percent', 'ram_used_mb']
    },

    // API Endpoints
    ENDPOINTS: {
        // Auth
        LOGIN: '/auth/login',
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
        ME: '/auth/me',

        // Users
        USERS: '/users',
        CHANGE_PASSWORD: '/change-password',

        // Alerts
        ALERTS: '/alerts',

        // Stats
        STATS: '/stats'
    }
};

// Helper function to get motor config by ID
ENV.getMotorConfig = function(motorId) {
    return this.DEVICES.MOTORS.find(m => m.id === motorId);
};

// Freeze to prevent modifications
Object.freeze(ENV);
Object.freeze(ENV.KEYS);
Object.freeze(ENV.ENDPOINTS);
