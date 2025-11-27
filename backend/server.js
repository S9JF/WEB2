const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Middleware
app.use(cors());
app.use(express.json());

// =====================================================
// CLEAN URLs (without .html extension)
// =====================================================

// Redirect root to Login page
app.get('/', (req, res) => {
    res.redirect('/Login');
});

// Redirect old .html URLs to clean URLs
const htmlPages = ['Login', 'Dashboard', 'Admin', 'Profile', 'WaterTreatment', 'MotorDashboard'];
htmlPages.forEach(page => {
    app.get(`/${page}.html`, (req, res) => {
        res.redirect(301, `/${page}`);
    });
});

// Clean URL routes - serve HTML files without extension
htmlPages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, '..', `${page}.html`));
    });
    // Also handle lowercase
    if (page.toLowerCase() !== page) {
        app.get(`/${page.toLowerCase()}`, (req, res) => {
            res.redirect(301, `/${page}`);
        });
    }
});

// Serve static files (HTML, CSS, JS) - after clean URL routes
app.use(express.static(path.join(__dirname, '..')));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'factory-iot-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// =====================================================
// AUTH MIDDLEWARE
// =====================================================
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if session exists and not expired
        const session = await pool.query(
            'SELECT * FROM user_sessions WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (session.rows.length === 0) {
            return res.status(401).json({ error: 'Session expired or invalid' });
        }

        req.user = decoded;
        req.token = token;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// =====================================================
// AUTH ROUTES
// =====================================================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;

        // Check if user exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user with pending status
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, status, avatar_color)
             VALUES ($1, $2, $3, $4, 'pending', 'pending', $5)
             RETURNING id, email, first_name, last_name, role, status`,
            [email, passwordHash, firstName, lastName, getRandomColor()]
        );

        res.status(201).json({
            message: 'Registration successful. Please wait for admin approval.',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get user
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Check status
        if (user.status === 'pending') {
            return res.status(403).json({ error: 'Account pending approval. Please wait for admin.' });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({ error: 'Account is inactive. Contact admin.' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.first_name,
                lastName: user.last_name
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Create session
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await pool.query(
            `INSERT INTO user_sessions (user_id, token, ip_address, user_agent, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.id, token, req.ip, req.headers['user-agent'], expiresAt]
        );

        // Update last login and login count
        await pool.query(
            'UPDATE users SET last_login = NOW(), last_active_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1',
            [user.id]
        );

        // Log activity
        await pool.query(
            `INSERT INTO user_activity_logs (user_id, activity_type, description, ip_address, user_agent)
             VALUES ($1, 'login', $2, $3, $4)`,
            [user.id, `Logged in from ${req.headers['user-agent']}`, req.ip, req.headers['user-agent']]
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                department: user.department,
                avatarColor: user.avatar_color
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        // Delete session
        await pool.query('DELETE FROM user_sessions WHERE token = $1', [req.token]);

        // Log activity
        await pool.query(
            `INSERT INTO user_activity_logs (user_id, activity_type, description, ip_address)
             VALUES ($1, 'logout', 'User logged out', $2)`,
            [req.user.id, req.ip]
        );

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, email, first_name, last_name, phone, department, role, status, avatar_color, created_at, last_login, last_active_at, login_count, total_active_minutes, alerts_handled
             FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Calculate response rate (alerts handled / total alerts assigned - simplified to 95% for now)
        const responseRate = user.alerts_handled > 0 ? 95 : 0;

        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            department: user.department,
            role: user.role,
            status: user.status,
            avatarColor: user.avatar_color,
            createdAt: user.created_at,
            lastLogin: user.last_login,
            lastActiveAt: user.last_active_at,
            loginCount: user.login_count || 0,
            totalActiveMinutes: user.total_active_minutes || 0,
            alertsHandled: user.alerts_handled || 0,
            responseRate: responseRate
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// =====================================================
// USER ROUTES (Admin)
// =====================================================

// Get all users
app.get('/api/users', authenticateToken, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, email, first_name, last_name, phone, department, role, status, avatar_color, created_at, last_login, last_active_at, login_count, total_active_minutes, alerts_handled
             FROM users ORDER BY created_at DESC`
        );

        const users = result.rows.map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            name: `${user.first_name} ${user.last_name}`,
            phone: user.phone,
            department: user.department,
            role: user.role,
            status: user.status,
            avatarColor: user.avatar_color,
            avatar: `${user.first_name[0]}${user.last_name[0]}`.toUpperCase(),
            lastActive: user.last_active_at ? getTimeAgo(user.last_active_at) : 'Never',
            lastActiveAt: user.last_active_at,
            loginCount: user.login_count || 0,
            totalActiveMinutes: user.total_active_minutes || 0,
            alertsHandled: user.alerts_handled || 0
        }));

        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get user by ID
app.get('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        // Users can only view their own profile, admins can view all
        if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            `SELECT id, email, first_name, last_name, phone, department, role, status, avatar_color, created_at, last_login
             FROM users WHERE id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            department: user.department,
            role: user.role,
            status: user.status,
            avatarColor: user.avatar_color
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Create user (Admin)
app.post('/api/users', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, department, role, status } = req.body;

        const passwordHash = await bcrypt.hash(password || 'password123', 10);

        const result = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, phone, department, role, status, avatar_color)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, email, first_name, last_name, role, status`,
            [email, passwordHash, firstName, lastName, phone, department, role || 'operator', status || 'active', getRandomColor()]
        );

        // Log activity
        await pool.query(
            `INSERT INTO user_activity_logs (user_id, activity_type, description, ip_address)
             VALUES ($1, 'user_created', $2, $3)`,
            [req.user.id, `Created user: ${email}`, req.ip]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Users can only update their own profile (limited fields), admins can update all
        if (req.user.role !== 'admin' && req.user.id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { firstName, lastName, phone, department, role, status } = req.body;

        // Get current user data first
        const currentUser = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (currentUser.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const current = currentUser.rows[0];

        let query, params;

        if (req.user.role === 'admin') {
            // Admin can update all fields - use COALESCE to keep existing values if not provided
            query = `UPDATE users SET
                     first_name = COALESCE($1, first_name),
                     last_name = COALESCE($2, last_name),
                     phone = COALESCE($3, phone),
                     department = COALESCE($4, department),
                     role = COALESCE($5, role),
                     status = COALESCE($6, status)
                     WHERE id = $7 RETURNING id, email, first_name, last_name, role, status`;
            params = [
                firstName || current.first_name,
                lastName || current.last_name,
                phone !== undefined ? phone : current.phone,
                department !== undefined ? department : current.department,
                role || current.role,
                status || current.status,
                userId
            ];
        } else {
            // Regular users can only update basic info
            query = `UPDATE users SET
                     first_name = COALESCE($1, first_name),
                     last_name = COALESCE($2, last_name),
                     phone = COALESCE($3, phone)
                     WHERE id = $4 RETURNING id, email, first_name, last_name, role, status`;
            params = [
                firstName || current.first_name,
                lastName || current.last_name,
                phone !== undefined ? phone : current.phone,
                userId
            ];
        }

        const result = await pool.query(query, params);

        // Log activity
        await pool.query(
            `INSERT INTO user_activity_logs (user_id, activity_type, description, ip_address)
             VALUES ($1, 'user_updated', $2, $3)`,
            [req.user.id, `Updated user ID: ${userId}`, req.ip]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (Admin)
app.delete('/api/users/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Prevent self-delete
        if (req.user.id === userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING email', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log activity
        await pool.query(
            `INSERT INTO user_activity_logs (user_id, activity_type, description, ip_address)
             VALUES ($1, 'user_deleted', $2, $3)`,
            [req.user.id, `Deleted user: ${result.rows[0].email}`, req.ip]
        );

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Change password
app.post('/api/users/:id/change-password', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Users can only change their own password
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { currentPassword, newPassword } = req.body;

        // Get current password hash
        const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password (skip for admin changing others' passwords)
        if (req.user.id === userId) {
            const validPassword = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
            if (!validPassword) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

        // Log activity
        await pool.query(
            `INSERT INTO user_activity_logs (user_id, activity_type, description, ip_address)
             VALUES ($1, 'password_change', 'Password changed', $2)`,
            [userId, req.ip]
        );

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// =====================================================
// ACTIVITY LOG ROUTES
// =====================================================

// Get activity logs for a user
app.get('/api/users/:id/activities', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Users can only view their own activities, admins can view all
        if (req.user.role !== 'admin' && req.user.id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            `SELECT id, activity_type, description, ip_address, created_at
             FROM user_activity_logs WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 50`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get activities error:', error);
        res.status(500).json({ error: 'Failed to get activities' });
    }
});

// =====================================================
// ALERTS ROUTES
// =====================================================

// Get all alerts
app.get('/api/alerts', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.*, u.first_name, u.last_name
             FROM alerts a
             LEFT JOIN users u ON a.acknowledged_by = u.id
             ORDER BY a.created_at DESC LIMIT 100`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ error: 'Failed to get alerts' });
    }
});

// Acknowledge alert
app.post('/api/alerts/:id/acknowledge', authenticateToken, async (req, res) => {
    try {
        const alertId = parseInt(req.params.id);

        const result = await pool.query(
            `UPDATE alerts SET is_acknowledged = true, acknowledged_by = $1, acknowledged_at = NOW()
             WHERE id = $2 RETURNING *`,
            [req.user.id, alertId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        // Update user's alerts_handled count
        await pool.query(
            'UPDATE users SET alerts_handled = COALESCE(alerts_handled, 0) + 1 WHERE id = $1',
            [req.user.id]
        );

        // Log activity
        await pool.query(
            `INSERT INTO user_activity_logs (user_id, activity_type, description, ip_address)
             VALUES ($1, 'alert_acknowledged', $2, $3)`,
            [req.user.id, `Acknowledged alert ID: ${alertId}`, req.ip]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Acknowledge alert error:', error);
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});

// =====================================================
// EQUIPMENT ROUTES (Water Treatment)
// =====================================================

// Get all equipment
app.get('/api/equipment', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, type, location, device_id, is_mock, status, created_at
             FROM equipment ORDER BY id`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get equipment error:', error);
        res.status(500).json({ error: 'Failed to get equipment' });
    }
});

// Get equipment by ID with latest telemetry
app.get('/api/equipment/:id', authenticateToken, async (req, res) => {
    try {
        const equipResult = await pool.query(
            'SELECT * FROM equipment WHERE id = $1',
            [req.params.id]
        );

        if (equipResult.rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }

        const equipment = equipResult.rows[0];

        // Get latest telemetry
        const telemetryResult = await pool.query(
            `SELECT * FROM equipment_telemetry
             WHERE equipment_id = $1
             ORDER BY recorded_at DESC LIMIT 1`,
            [req.params.id]
        );

        res.json({
            ...equipment,
            telemetry: telemetryResult.rows[0] || null
        });
    } catch (error) {
        console.error('Get equipment error:', error);
        res.status(500).json({ error: 'Failed to get equipment' });
    }
});

// Update equipment status
app.put('/api/equipment/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['running', 'stopped', 'warning', 'error'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = await pool.query(
            'UPDATE equipment SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update equipment status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// =====================================================
// STATS ROUTES (Admin Dashboard)
// =====================================================

app.get('/api/stats', authenticateToken, adminOnly, async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_users,
                COUNT(*) FILTER (WHERE status = 'active') as active_users,
                COUNT(*) FILTER (WHERE role = 'admin') as admin_users
            FROM users
        `);

        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getRandomColor() {
    const colors = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(date).toLocaleDateString();
}

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Factory IoT Backend running on port ${PORT}`);
    console.log(`Static files served from: ${path.join(__dirname, '..')}`);
});

// Cleanup expired sessions periodically
setInterval(async () => {
    try {
        await pool.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
    } catch (error) {
        console.error('Session cleanup error:', error);
    }
}, 60 * 60 * 1000); // Every hour
