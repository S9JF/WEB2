// ThingsBoard API Service with WebSocket Real-Time Support
// ต้องโหลด env.js ก่อน

class ThingsBoardAPI {
    constructor() {
        this.token = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.webSocket = null;
        this.cmdId = 0;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;

        // Callbacks for data updates
        this.onVibrationData = null;
        this.onPowerData = null;
        this.onServerData = null;
        this.onConnectionChange = null;

        // Track device ID to motor ID mapping
        this.deviceToMotorMap = new Map();
        this.subscriptionIdToDevice = new Map();
    }

    // Login and get JWT token
    async login() {
        try {
            console.log('Logging in to ThingsBoard...');
            const response = await fetch(`${ENV.TB_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    username: ENV.TB_USERNAME,
                    password: ENV.TB_PASSWORD
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Login failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            this.token = data.token;
            this.refreshToken = data.refreshToken;
            this.tokenExpiry = this.getTokenExpiry(data.token);

            console.log('ThingsBoard login successful');
            return true;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    // Decode JWT token to get expiry time
    getTokenExpiry(token) {
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload));
            return decoded.exp * 1000;
        } catch (e) {
            return Date.now() + (2 * 60 * 60 * 1000);
        }
    }

    // Connect to WebSocket for real-time data
    connectWebSocket() {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        if (!this.token) {
            console.error('No token available for WebSocket connection');
            return;
        }

        console.log('Connecting to WebSocket...');
        this.webSocket = new WebSocket(ENV.TB_WS_URL);

        this.webSocket.onopen = () => {
            console.log('✅ WebSocket connected!');
            this.isConnected = true;
            this.reconnectAttempts = 0;

            if (this.onConnectionChange) {
                this.onConnectionChange(true);
            }

            // Authenticate with token
            console.log('🔐 Sending authentication...');
            this.sendAuthCommand();

            // Wait a bit for auth, then subscribe
            setTimeout(() => {
                console.log('🔔 Subscribing to all motor devices...');
                // Subscribe to all motor devices
                this.subscribeToAllMotors();

                // Subscribe to server monitor
                this.subscribeToDevice(ENV.DEVICES.SERVER_MONITOR, 'server', null);

                console.log('✅ All subscriptions sent. Waiting for data...');
            }, 1000);
        };

        this.webSocket.onmessage = (event) => {
            this.handleWebSocketMessage(event.data);
        };

        this.webSocket.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
            this.isConnected = false;

            if (this.onConnectionChange) {
                this.onConnectionChange(false);
            }

            // Attempt to reconnect
            this.attemptReconnect();
        };

        this.webSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    // Send authentication command
    sendAuthCommand() {
        const authCmd = {
            authCmd: {
                cmdId: this.cmdId++,
                token: this.token
            }
        };
        this.webSocket.send(JSON.stringify(authCmd));
        console.log('Auth command sent');
    }

    // Subscribe to all motors
    subscribeToAllMotors() {
        ENV.DEVICES.MOTORS.forEach(motor => {
            // Subscribe to power meter
            const cmdId = this.cmdId++;
            this.subscribeToDevice(motor.powerMeterId, 'power', motor.id, cmdId);
            this.deviceToMotorMap.set(motor.powerMeterId, motor.id);
            this.subscriptionIdToDevice.set(cmdId, { deviceId: motor.powerMeterId, type: 'power', motorId: motor.id });

            // Subscribe to vibration sensor
            const vibCmdId = this.cmdId++;
            this.subscribeToDevice(motor.vibrationId, 'vibration', motor.id, vibCmdId);
            this.deviceToMotorMap.set(motor.vibrationId, motor.id);
            this.subscriptionIdToDevice.set(vibCmdId, { deviceId: motor.vibrationId, type: 'vibration', motorId: motor.id });
        });
    }

    // Subscribe to device telemetry
    subscribeToDevice(deviceId, type, motorId, cmdId) {
        const subscribeCmd = {
            cmds: [{
                entityType: 'DEVICE',
                entityId: deviceId,
                scope: 'LATEST_TELEMETRY',
                cmdId: cmdId || this.cmdId++,
                type: 'TIMESERIES'
            }]
        };
        this.webSocket.send(JSON.stringify(subscribeCmd));
        const motorInfo = motorId ? ` (Motor ${motorId})` : '';
        console.log(`Subscribed to ${type} device: ${deviceId}${motorInfo}`);
    }

    // Handle incoming WebSocket messages
    handleWebSocketMessage(rawData) {
        try {
            const data = JSON.parse(rawData);

            // DEBUG: Log all incoming messages
            console.log('📡 WebSocket message received:', data);

            // Check for subscription updates
            if (data.subscriptionId !== undefined && data.data) {
                console.log('✅ Subscription data received for subscriptionId:', data.subscriptionId);
                this.processSubscriptionData(data);
            }

            // Check for error responses
            if (data.errorCode) {
                console.error('❌ WebSocket error:', data.errorCode, data.errorMsg);
                if (data.errorCode === 401) {
                    // Token expired, re-authenticate
                    this.refreshAndReconnect();
                }
            }
        } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
        }
    }

    // Process subscription data and route to callbacks
    processSubscriptionData(message) {
        const data = message.data;
        const subscriptionId = message.subscriptionId;

        // DEBUG: Log subscription mapping info
        console.log('🔍 Processing subscriptionId:', subscriptionId);
        console.log('🔍 Subscription map:', Array.from(this.subscriptionIdToDevice.entries()));

        // Convert WebSocket data format to match our expected format
        const formattedData = {};
        for (const [key, values] of Object.entries(data)) {
            if (Array.isArray(values) && values.length > 0) {
                formattedData[key] = values.map(v => ({
                    ts: v[0],
                    value: v[1]
                }));
            }
        }

        console.log('📊 Formatted data keys:', Object.keys(formattedData));

        // Get motor info from subscription mapping
        const subInfo = this.subscriptionIdToDevice.get(subscriptionId);
        const motorId = subInfo ? subInfo.motorId : null;

        console.log('🎯 Motor ID for this data:', motorId);

        // Determine which device this data is from based on keys
        const keys = Object.keys(formattedData);

        if (keys.some(k => ENV.KEYS.VIBRATION.includes(k))) {
            console.log('🌊 Vibration data detected for Motor', motorId);
            if (this.onVibrationData) {
                this.onVibrationData(formattedData, motorId);
            }
        }

        if (keys.some(k => ENV.KEYS.POWER_METER.includes(k))) {
            console.log('⚡ Power data detected for Motor', motorId);
            if (this.onPowerData) {
                this.onPowerData(formattedData, motorId);
            }
        }

        if (keys.some(k => ENV.KEYS.SERVER_MONITOR.includes(k))) {
            console.log('🖥️ Server monitor data detected');
            if (this.onServerData) {
                this.onServerData(formattedData);
            }
        }
    }

    // Attempt to reconnect WebSocket
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(async () => {
            // Refresh token if needed
            const tokenValid = await this.ensureValidToken();
            if (tokenValid) {
                this.connectWebSocket();
            }
        }, this.reconnectDelay);
    }

    // Refresh token and reconnect
    async refreshAndReconnect() {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
            this.disconnectWebSocket();
            this.connectWebSocket();
        }
    }

    // Refresh access token
    async refreshAccessToken() {
        if (!this.refreshToken) {
            return await this.login();
        }

        try {
            const response = await fetch(`${ENV.TB_URL}/api/auth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    refreshToken: this.refreshToken
                })
            });

            if (!response.ok) {
                return await this.login();
            }

            const data = await response.json();
            this.token = data.token;
            this.refreshToken = data.refreshToken;
            this.tokenExpiry = this.getTokenExpiry(data.token);

            console.log('Token refreshed successfully');
            return true;
        } catch (error) {
            console.error('Token refresh error:', error);
            return await this.login();
        }
    }

    // Ensure valid token
    async ensureValidToken() {
        if (!this.token || Date.now() >= (this.tokenExpiry - 5 * 60 * 1000)) {
            if (this.refreshToken) {
                return await this.refreshAccessToken();
            } else {
                return await this.login();
            }
        }
        return true;
    }

    // Disconnect WebSocket
    disconnectWebSocket() {
        if (this.webSocket) {
            this.webSocket.close();
            this.webSocket = null;
            this.isConnected = false;
        }
    }

    // Initialize and connect
    async connect() {
        const loggedIn = await this.login();
        if (loggedIn) {
            this.connectWebSocket();
            return true;
        }
        return false;
    }

    // Check connection status
    isWebSocketConnected() {
        return this.isConnected && this.webSocket && this.webSocket.readyState === WebSocket.OPEN;
    }
}

// Create global API instance
const tbAPI = new ThingsBoardAPI();
