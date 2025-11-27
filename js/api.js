// API Service - เชื่อมต่อกับ Backend
// ต้องโหลด env.js ก่อน

class APIService {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
    }

    // Get auth header
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    // Save auth data
    saveAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    // Clear auth data
    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    // Check if logged in
    isLoggedIn() {
        return !!this.token;
    }

    // Get current user
    getUser() {
        return this.user;
    }

    // =====================================================
    // AUTH APIs
    // =====================================================

    async login(email, password) {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.LOGIN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            this.saveAuth(data.token, data.user);
            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async register(firstName, lastName, email, password) {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.REGISTER}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName, email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            return { success: true, message: data.message };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.LOGOUT}`, {
                method: 'POST',
                headers: this.getHeaders()
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        this.clearAuth();
    }

    async getMe() {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.ME}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearAuth();
                    window.location.href = '/Login';
                }
                throw new Error('Failed to get user');
            }

            return await response.json();
        } catch (error) {
            return null;
        }
    }

    // Get current user with activity stats from API
    async getCurrentUser() {
        return await this.getMe();
    }

    // =====================================================
    // USER APIs
    // =====================================================

    async getUsers() {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.USERS}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to get users');
            return await response.json();
        } catch (error) {
            console.error('Get users error:', error);
            return [];
        }
    }

    async getUserById(id) {
        if (!id) {
            console.warn('getUserById called without id');
            return null;
        }
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.USERS}/${id}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to get user');
            return await response.json();
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    async createUser(userData) {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.USERS}`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create user');
            return { success: true, user: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateUser(id, userData) {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.USERS}/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to update user');
            return { success: true, user: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteUser(id) {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.USERS}/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete user');
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateProfile(userData) {
        const user = this.getUser();
        if (!user?.id) return { success: false, error: 'User not logged in' };

        const result = await this.updateUser(user.id, userData);
        if (result.success) {
            // Update local user data
            const updatedUser = { ...this.user, ...userData };
            this.user = updatedUser;
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        return result;
    }

    async changePassword(currentPassword, newPassword) {
        const user = this.getUser();
        if (!user?.id) return { success: false, error: 'User not logged in' };

        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.USERS}/${user.id}${ENV.ENDPOINTS.CHANGE_PASSWORD}`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to change password');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getUserActivities(id) {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.USERS}/${id}/activities`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to get activities');
            return await response.json();
        } catch (error) {
            console.error('Get activities error:', error);
            return [];
        }
    }

    // =====================================================
    // STATS API
    // =====================================================

    async getStats() {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.STATS}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to get stats');
            return await response.json();
        } catch (error) {
            console.error('Get stats error:', error);
            return null;
        }
    }

    // =====================================================
    // ALERTS APIs
    // =====================================================

    async getAlerts() {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.ALERTS}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to get alerts');
            return await response.json();
        } catch (error) {
            console.error('Get alerts error:', error);
            return [];
        }
    }

    async acknowledgeAlert(id) {
        try {
            const response = await fetch(`${ENV.API_URL}${ENV.ENDPOINTS.ALERTS}/${id}/acknowledge`, {
                method: 'POST',
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to acknowledge alert');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Create global API instance
const api = new APIService();

// Auth guard - redirect to login if not authenticated
function requireAuth() {
    if (!api.isLoggedIn()) {
        window.location.href = '/Login';
        return false;
    }
    return true;
}

// Admin guard - redirect if not admin
function requireAdmin() {
    if (!requireAuth()) return false;
    const user = api.getUser();
    if (user.role !== 'admin') {
        alert('Admin access required');
        window.location.href = '/Dashboard';
        return false;
    }
    return true;
}
