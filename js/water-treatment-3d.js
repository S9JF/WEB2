// Water Treatment Plant 3D Visualization
// Using Three.js and GLTFLoader

let scene, camera, renderer, controls;
let model;
let motorData = {}; // Store real-time motor data
let statusLights = []; // Store status light meshes

function init() {
    // Scene setup
    scene = new THREE.Scene();

    // Set initial background based on theme
    updateSceneTheme();

    // Camera setup
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(2, 1, 2);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Controls setup
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2 + 0.2; // Allow more vertical rotation
    controls.target.set(0, 0, 0);
    controls.enablePan = true;
    controls.panSpeed = 1.0;
    controls.enableZoom = true;
    controls.zoomSpeed = 1.0;

    // Optional: Add axes helper for debugging
    // const axesHelper = new THREE.AxesHelper(20);
    // scene.add(axesHelper);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x4a4a4a, 0.6);
    scene.add(hemisphereLight);

    // Add fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-20, 15, -20);
    scene.add(fillLight);

    // Load GLTF Model
    loadModel();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();

    // Add loading indicator
    showLoadingMessage();
}

function loadModel() {
    const loader = new THREE.GLTFLoader();

    // Load the water treatment plant model
    loader.load(
        '/water_treatment_plant/scene.gltf',
        function (gltf) {
            model = gltf.scene;

            // Enable shadows for all meshes
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Get bounding box
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            console.log('Model size:', size);
            console.log('Model center:', center);

            // Center the model at origin
            model.position.x = -center.x;
            model.position.y = -center.y;
            model.position.z = -center.z;

            // Scale to fit in view (target size ~15 units)
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 15;
            const scale = targetSize / maxDim;
            model.scale.setScalar(scale);

            console.log('Model scale:', scale);

            scene.add(model);

            // Adjust camera to view the model from higher angle
            const scaledSize = maxDim * scale;
            const distance = scaledSize * 0.8;
            camera.position.set(0, distance * 0.3, distance);
            camera.lookAt(0, 2, 0);
            controls.target.set(0, 2, 0);
            controls.update();

            // Remove loading message
            hideLoadingMessage();

            // Add motor position markers after model loads
            addMotorMarkers();

            // Setup hover tooltip
            setupTooltip();

            // Connect to ThingsBoard WebSocket
            connectToThingsBoard();

            console.log('Water Treatment Plant model loaded successfully!');
            console.log('Camera position:', camera.position);
        },
        function (xhr) {
            const percentComplete = (xhr.loaded / xhr.total) * 100;
            updateLoadingMessage(`Loading model: ${Math.round(percentComplete)}%`);
            console.log(`Loading: ${Math.round(percentComplete)}%`);
        },
        function (error) {
            console.error('Error loading model:', error);
            hideLoadingMessage();
            showErrorMessage('Failed to load 3D model. Please check the file path.');
        }
    );
}

function addMotorMarkers() {
    // Define motor positions based on actual GLTF model coordinates
    const motorPositions = [
        { x: 6.8, y: -1.5, z: 2.67, motorId: 1, label: 'Motor 1: Basin 1 Aerator' },
        { x: 6.8, y: -1.5, z: 0.9, motorId: 2, label: 'Motor 2: Basin 2 Aerator' },
        { x: 6.8, y: -1.5, z: -0.9, motorId: 3, label: 'Motor 3: Basin 3 Aerator' },
        { x: 6.8, y: -1.5, z: -2.67, motorId: 4, label: 'Motor 4: Basin 4 Aerator' },
        { x: 4.7, y: -1.5, z: -0.58, motorId: 5, label: 'Motor 5: Basin 5 Aerator' },
        { x: 4.7, y: -1.5, z: 0.58, motorId: 6, label: 'Motor 6: Basin 6 Aerator' },
        { x: -0.9, y: -1.5, z: 0.58, motorId: 7, label: 'Motor 7: Basin 7 Aerator' },
        { x: -3.5, y: -1.5, z: 0.58, motorId: 8, label: 'Motor 8: Basin 8 Aerator' },
        { x: -3.2, y: -1.5, z: -0.58, motorId: 9, label: 'Motor 9: Basin 9 Aerator' }
    ];

    // Load 3D motor model for each position
    const loader = new THREE.GLTFLoader();

    motorPositions.forEach((pos, index) => {
        loader.load(
            '/water_pump/scene.gltf',
            function (gltf) {
                const motorModel = gltf.scene.clone();

                // Enable shadows
                motorModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // Set position
                motorModel.position.set(pos.x, pos.y, pos.z);

                // Scale the motor model appropriately
                motorModel.scale.setScalar(1.0);

                motorModel.name = pos.label;
                motorModel.userData.motorId = pos.motorId;

                // Add to scene
                scene.add(motorModel);

                // Add status light above motor
                addStatusLight(pos.x, pos.y + 0.5, pos.z, pos.motorId);

                console.log(`Added motor model ${index + 1}: ${pos.label} at (${pos.x}, ${pos.y}, ${pos.z})`);
            },
            undefined,
            function (error) {
                console.error(`Error loading motor model for ${pos.label}:`, error);
                // Fallback to red sphere if model fails to load
                const markerGeometry = new THREE.SphereGeometry(0.1, 16, 16);
                const markerMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff0000
                });
                const marker = new THREE.Mesh(markerGeometry, markerMaterial);
                marker.position.set(pos.x, pos.y, pos.z);
                marker.name = pos.label;
                marker.userData.motorId = pos.motorId;
                scene.add(marker);

                // Add status light even for fallback
                addStatusLight(pos.x, pos.y + 0.5, pos.z, pos.motorId);
            }
        );
    });
}

// Add status light indicator above motor
function addStatusLight(x, y, z, motorId) {
    // Get motor config from ENV
    const motorConfig = ENV.getMotorConfig(motorId);
    const status = motorConfig ? motorConfig.status : 'normal';

    // Status colors
    const statusColors = {
        'normal': 0x10B981,    // Green
        'warning': 0xF59E0B,   // Amber
        'abnormal': 0xEF4444   // Red
    };

    // Create glowing sphere
    const lightGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const lightMaterial = new THREE.MeshStandardMaterial({
        color: statusColors[status],
        emissive: statusColors[status],
        emissiveIntensity: 0.8,
        metalness: 0.3,
        roughness: 0.2
    });

    const statusLight = new THREE.Mesh(lightGeometry, lightMaterial);
    statusLight.position.set(x, y, z);
    statusLight.userData.motorId = motorId;
    statusLight.userData.status = status;
    statusLight.name = `StatusLight_Motor${motorId}`;

    // Add point light for glow effect
    const pointLight = new THREE.PointLight(statusColors[status], 1, 3);
    pointLight.position.set(x, y, z);
    scene.add(pointLight);

    scene.add(statusLight);
    statusLights.push({ light: statusLight, pointLight: pointLight, motorId: motorId });

    console.log(`Added status light for Motor ${motorId}: ${status}`);
}

// Update status light color
function updateStatusLight(motorId, newStatus) {
    const statusColors = {
        'normal': 0x10B981,
        'warning': 0xF59E0B,
        'abnormal': 0xEF4444
    };

    const lightObj = statusLights.find(l => l.motorId === motorId);
    if (lightObj) {
        const color = statusColors[newStatus];
        lightObj.light.material.color.setHex(color);
        lightObj.light.material.emissive.setHex(color);
        lightObj.light.userData.status = newStatus;
        lightObj.pointLight.color.setHex(color);
    }
}

// Setup hover tooltip for motors
function setupTooltip() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'motor-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-family: 'Inter', -apple-system, sans-serif;
        pointer-events: none;
        display: none;
        z-index: 1000;
        min-width: 200px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
    `;
    document.body.appendChild(tooltip);

    // Mouse move handler
    renderer.domElement.addEventListener('mousemove', (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        let foundMotor = false;
        for (let i = 0; i < intersects.length; i++) {
            const object = intersects[i].object;

            // Check if object or parent has motorId
            let motorId = object.userData.motorId;
            if (!motorId && object.parent) {
                motorId = object.parent.userData.motorId;
            }

            if (motorId) {
                foundMotor = true;
                const motorConfig = ENV.getMotorConfig(motorId);
                const data = motorData[motorId] || {};

                // Get status badge color
                const statusBadgeColors = {
                    'normal': '#10B981',
                    'warning': '#F59E0B',
                    'abnormal': '#EF4444'
                };
                const badgeColor = statusBadgeColors[motorConfig?.status || 'normal'];
                const statusText = (motorConfig?.status || 'normal').toUpperCase();

                // Build tooltip content
                tooltip.innerHTML = `
                    <div style="margin-bottom: 8px;">
                        <strong style="font-size: 14px;">Pump ${motorId < 10 ? '0' + motorId : motorId}</strong>
                        <span style="background: ${badgeColor}; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">${statusText}</span>
                    </div>
                    <div style="color: #d1d5db; font-size: 12px; line-height: 1.6;">
                        <div>Current: <strong style="color: white;">${data.current || '-- '} A</strong></div>
                        <div>Temp: <strong style="color: white;">${data.temp || '--'} °C</strong></div>
                        <div>Vibration: <strong style="color: white;">±${data.vibration || '--'}</strong></div>
                    </div>
                    <div style="margin-top: 8px; font-size: 11px; color: #9ca3af;">
                        Click for details →
                    </div>
                `;

                tooltip.style.display = 'block';
                tooltip.style.left = (event.clientX + 15) + 'px';
                tooltip.style.top = (event.clientY + 15) + 'px';

                // Change cursor
                renderer.domElement.style.cursor = 'pointer';
                break;
            }
        }

        if (!foundMotor) {
            tooltip.style.display = 'none';
            renderer.domElement.style.cursor = 'default';
        }
    });

    // Click handler to navigate to motor dashboard
    renderer.domElement.addEventListener('click', (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        for (let i = 0; i < intersects.length; i++) {
            const object = intersects[i].object;
            let motorId = object.userData.motorId;
            if (!motorId && object.parent) {
                motorId = object.parent.userData.motorId;
            }

            if (motorId) {
                console.log(`Navigating to Motor ${motorId} dashboard`);
                window.location.href = `/MotorDashboard?id=${motorId}`;
                break;
            }
        }
    });
}

function addLabels() {
    // You can add CSS2D labels here to identify different parts
    // For now, we'll skip this and just show the model
}

function showLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-message';
    loadingDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 18px;
        font-family: Arial, sans-serif;
        z-index: 1000;
    `;
    loadingDiv.textContent = 'Loading 3D Model...';
    document.body.appendChild(loadingDiv);
}

function updateLoadingMessage(message) {
    const loadingDiv = document.getElementById('loading-message');
    if (loadingDiv) {
        loadingDiv.textContent = message;
    }
}

function hideLoadingMessage() {
    const loadingDiv = document.getElementById('loading-message');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(220, 38, 38, 0.9);
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 16px;
        font-family: Arial, sans-serif;
        z-index: 1000;
        max-width: 400px;
        text-align: center;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    controls.update();

    // Pulsing animation for warning and abnormal status lights
    const time = Date.now() * 0.003;
    statusLights.forEach(lightObj => {
        const status = lightObj.light.userData.status;
        if (status === 'warning' || status === 'abnormal') {
            // Pulsing effect
            const pulseIntensity = 0.5 + Math.sin(time * (status === 'abnormal' ? 3 : 2)) * 0.3;
            lightObj.light.material.emissiveIntensity = pulseIntensity;
            lightObj.pointLight.intensity = pulseIntensity * 1.5;
        }
    });

    renderer.render(scene, camera);
}

// Theme support functions
function updateSceneTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const skyColor = isDark ? 0x1e293b : 0x87ceeb;
    scene.background = new THREE.Color(skyColor);
}

// Listen for theme changes
window.addEventListener('themeChanged', () => {
    updateSceneTheme();
});

// Connect to ThingsBoard and subscribe to motor data
async function connectToThingsBoard() {
    console.log('Connecting to ThingsBoard for motor data...');

    try {
        // Use existing ThingsBoard API instance
        if (typeof tbAPI === 'undefined') {
            console.error('ThingsBoard API not loaded. Make sure thingsboard.js is included.');
            return;
        }

        // Connect to ThingsBoard
        const connected = await tbAPI.connect();
        if (!connected) {
            console.error('Failed to connect to ThingsBoard');
            return;
        }

        console.log('Connected to ThingsBoard successfully!');

        // Subscribe to motor data updates (now includes motorId)
        tbAPI.onVibrationData = (data, motorId) => {
            if (motorId) {
                updateMotorDataFromVibration(data, motorId);
            }
        };

        tbAPI.onPowerData = (data, motorId) => {
            if (motorId) {
                updateMotorDataFromPower(data, motorId);
            }
        };

    } catch (error) {
        console.error('Error connecting to ThingsBoard:', error);
    }
}

// Update motor data from vibration sensor
function updateMotorDataFromVibration(data, motorId) {
    // Extract values from ThingsBoard format and parse to float
    const accel_x = parseFloat(data.accel_x?.[0]?.value) || 0;
    const accel_y = parseFloat(data.accel_y?.[0]?.value) || 0;
    const accel_z = parseFloat(data.accel_z?.[0]?.value) || 0;
    const velocity_x = parseFloat(data.velocity_x?.[0]?.value) || 0;
    const velocity_y = parseFloat(data.velocity_y?.[0]?.value) || 0;
    const velocity_z = parseFloat(data.velocity_z?.[0]?.value) || 0;
    const vib_temp = parseFloat(data.vib_temp?.[0]?.value) || 0;

    // Calculate average vibration
    const avgVibration = Math.abs((velocity_x + velocity_y + velocity_z) / 3);

    // Update data for specific motor
    if (!motorData[motorId]) motorData[motorId] = {};
    motorData[motorId].vibration = avgVibration.toFixed(2);
    motorData[motorId].temp = vib_temp.toFixed(1);

    console.log(`Motor ${motorId} vibration data updated:`, motorData[motorId]);
}

// Update motor data from power meter
function updateMotorDataFromPower(data, motorId) {
    const current = parseFloat(data.current?.[0]?.value) || 0;
    const voltage = parseFloat(data.voltage?.[0]?.value) || 0;
    const power = parseFloat(data.active_power?.[0]?.value) || 0;
    const powerFactor = parseFloat(data.power_factor?.[0]?.value) || 0;

    // Update data for specific motor
    if (!motorData[motorId]) motorData[motorId] = {};
    motorData[motorId].current = current.toFixed(2);
    motorData[motorId].voltage = voltage.toFixed(1);
    motorData[motorId].power = power.toFixed(2);
    motorData[motorId].powerFactor = powerFactor.toFixed(2);

    // Calculate status based on sensor values
    updateMotorStatus(motorId, motorData[motorId]);

    console.log(`Motor ${motorId} power data updated:`, motorData[motorId]);
}

// Calculate and update motor status based on sensor data
function updateMotorStatus(motorId, data) {
    const current = parseFloat(data.current) || 0;
    const temp = parseFloat(data.temp) || 0;
    const vibration = parseFloat(data.vibration) || 0;
    const powerFactor = parseFloat(data.powerFactor) || 0;

    let newStatus = 'normal';

    // Abnormal conditions
    if (current > 16 || temp > 45 || vibration > 2.0 || (powerFactor > 0 && powerFactor < 0.70)) {
        newStatus = 'abnormal';
    }
    // Warning conditions
    else if (current > 12 || temp > 35 || vibration > 1.0 || (powerFactor > 0 && powerFactor < 0.85)) {
        newStatus = 'warning';
    }

    // Update status light if changed
    const motorConfig = ENV.getMotorConfig(motorId);
    if (motorConfig && motorConfig.status !== newStatus) {
        motorConfig.status = newStatus;
        updateStatusLight(motorId, newStatus);
        console.log(`Motor ${motorId} status changed to: ${newStatus}`);
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);
