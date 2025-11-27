// Profile Page JavaScript
// ต้องโหลด env.js และ api.js ก่อน

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;
    loadProfile();
    await loadActivityStats();
});

function loadProfile() {
    currentUser = api.getUser();
    if (!currentUser) return;

    // Update sidebar
    const initials = `${currentUser.firstName?.[0] || ''}${currentUser.lastName?.[0] || ''}`.toUpperCase() || 'U';
    document.querySelector('.profile-avatar').childNodes[0].textContent = initials;
    document.querySelector('.profile-name').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    document.querySelector('.profile-role').textContent = formatRole(currentUser.role);

    // Update form
    document.getElementById('profileFirstName').value = currentUser.firstName || '';
    document.getElementById('profileLastName').value = currentUser.lastName || '';
    document.getElementById('profileEmail').value = currentUser.email || '';
    document.getElementById('profilePhone').value = currentUser.phone || '';
    document.getElementById('profileDepartment').value = currentUser.department || '';
    document.getElementById('profileRole').value = formatRole(currentUser.role);
}

function formatRole(role) {
    const roles = {
        'admin': 'System Administrator',
        'manager': 'Manager',
        'engineer': 'Engineer',
        'technician': 'Technician',
        'operator': 'Operator'
    };
    return roles[role] || role || 'User';
}

async function loadActivityStats() {
    try {
        const userData = await api.getCurrentUser();
        if (!userData) return;

        const statItems = document.querySelectorAll('.stat-item');
        if (statItems.length >= 4) {
            // Total Logins
            statItems[0].querySelector('.stat-value').textContent = userData.loginCount || 0;

            // Active Time - format minutes nicely
            const minutes = userData.totalActiveMinutes || 0;
            let activeTimeStr = '-';
            if (minutes > 0) {
                if (minutes < 60) {
                    activeTimeStr = `${minutes}m`;
                } else if (minutes < 1440) {
                    activeTimeStr = `${Math.floor(minutes / 60)}h`;
                } else {
                    activeTimeStr = `${Math.floor(minutes / 1440)}d`;
                }
            }
            statItems[1].querySelector('.stat-value').textContent = activeTimeStr;

            // Alerts Handled
            statItems[2].querySelector('.stat-value').textContent = userData.alertsHandled || 0;

            // Response Rate
            statItems[3].querySelector('.stat-value').textContent = userData.alertsHandled > 0 ? `${userData.responseRate || 0}%` : '-';
        }
    } catch (error) {
        console.error('Failed to load activity stats:', error);
    }
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + '-tab').classList.add('active');
}

function toggleEdit() {
    const form = document.getElementById('profileForm');
    const inputs = form.querySelectorAll('input:not([readonly])');
    const saveButtons = document.getElementById('saveButtons');
    const editBtn = document.querySelector('.edit-btn');

    inputs.forEach(input => {
        input.disabled = !input.disabled;
    });

    if (saveButtons.style.display === 'none') {
        saveButtons.style.display = 'flex';
        editBtn.style.display = 'none';
    }
}

async function saveProfile() {
    const data = {
        firstName: document.getElementById('profileFirstName').value,
        lastName: document.getElementById('profileLastName').value,
        phone: document.getElementById('profilePhone').value,
        department: document.getElementById('profileDepartment').value
    };

    const result = await api.updateProfile(data);

    if (result.success) {
        showToast('Profile updated successfully', 'success');
        cancelEdit();
        await loadProfile();
    } else {
        showToast(result.error, 'error');
    }
}

function cancelEdit() {
    const form = document.getElementById('profileForm');
    const inputs = form.querySelectorAll('input:not([readonly])');
    const saveButtons = document.getElementById('saveButtons');
    const editBtn = document.querySelector('.edit-btn');

    inputs.forEach(input => {
        input.disabled = true;
    });

    saveButtons.style.display = 'none';
    editBtn.style.display = 'flex';

    // Reset values
    loadProfile();
}

async function updatePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all password fields', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    const result = await api.changePassword(currentPassword, newPassword);

    if (result.success) {
        showToast('Password updated successfully', 'success');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    } else {
        showToast(result.error, 'error');
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function logout() {
    await api.logout();
    window.location.href = '/Login';
}
