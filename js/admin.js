// Admin Page JavaScript
// ต้องโหลด env.js และ api.js ก่อน

let allUsers = [];
let filteredUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAdmin()) return;
    loadUserInfo();
    await loadStats();
    await loadUsers();
});

function loadUserInfo() {
    const user = api.getUser();
    if (user) {
        const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';
        const avatarEl = document.querySelector('.user-avatar-header');
        const nameEl = document.querySelector('.user-name');
        if (avatarEl) avatarEl.textContent = initials;
        if (nameEl) nameEl.textContent = user.firstName || 'Admin';
    }
}

async function loadStats() {
    const stats = await api.getStats();
    if (stats) {
        document.getElementById('totalUsers').textContent = stats.total_users || 0;
        document.getElementById('activeUsers').textContent = stats.active_users || 0;
        document.getElementById('pendingUsers').textContent = stats.pending_users || 0;
        document.getElementById('adminUsers').textContent = stats.admin_users || 0;
    }
}

async function loadUsers() {
    allUsers = await api.getUsers();
    filteredUsers = [...allUsers];
    renderUsers();
}

function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-secondary);">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = filteredUsers.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background: ${user.avatarColor || '#6b7280'}">${user.avatar || 'U'}</div>
                    <div class="user-info">
                        <div class="name">${user.name || `${user.firstName} ${user.lastName}`}</div>
                        <div class="email">${user.email}</div>
                    </div>
                </div>
            </td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td>${user.department || '-'}</td>
            <td class="last-active-cell">${user.lastActive || 'Never'}</td>
            <td><span class="status-badge ${user.status}"><span class="status-dot"></span>${user.status}</span></td>
            <td>
                <div class="action-btns">
                    ${user.status === 'pending' ? `<button class="action-btn approve" onclick="approveUser(${user.id})" title="Approve"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>` : ''}
                    <button class="action-btn edit" onclick="editUser(${user.id})" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="action-btn delete" onclick="deleteUser(${user.id})" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterUsers() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const role = document.getElementById('roleFilter').value;
    const status = document.getElementById('statusFilter').value;

    filteredUsers = allUsers.filter(user => {
        const matchSearch = user.name?.toLowerCase().includes(search) || user.email?.toLowerCase().includes(search);
        const matchRole = !role || user.role === role;
        const matchStatus = !status || user.status === status;
        return matchSearch && matchRole && matchStatus;
    });
    renderUsers();
}

async function approveUser(id) {
    if (!confirm('Approve this user?')) return;
    const result = await api.updateUser(id, { status: 'active', role: 'operator' });
    if (result.success) {
        showToast('User approved successfully', 'success');
        await loadStats();
        await loadUsers();
    } else {
        showToast(result.error, 'error');
    }
}

let editingUserId = null;

function editUser(id) {
    const user = allUsers.find(u => u.id === id);
    if (!user) return;
    editingUserId = id;
    document.getElementById('editFirstName').value = user.firstName || '';
    document.getElementById('editLastName').value = user.lastName || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editPhone').value = user.phone || '';
    document.getElementById('editDepartment').value = user.department || '';
    document.getElementById('editRole').value = user.role || 'operator';
    document.getElementById('editStatus').value = user.status || 'active';
    openModal('editUserModal');
}

async function saveUserEdit() {
    if (!editingUserId) return;
    const data = {
        firstName: document.getElementById('editFirstName').value,
        lastName: document.getElementById('editLastName').value,
        phone: document.getElementById('editPhone').value,
        department: document.getElementById('editDepartment').value,
        role: document.getElementById('editRole').value,
        status: document.getElementById('editStatus').value
    };
    const result = await api.updateUser(editingUserId, data);
    if (result.success) {
        showToast('User updated successfully', 'success');
        closeModal('editUserModal');
        await loadStats();
        await loadUsers();
    } else {
        showToast(result.error, 'error');
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const result = await api.deleteUser(id);
    if (result.success) {
        showToast('User deleted successfully', 'success');
        await loadStats();
        await loadUsers();
    } else {
        showToast(result.error, 'error');
    }
}

function openAddUserModal() {
    document.getElementById('addUserForm').reset();
    openModal('addUserModal');
}

async function addUser() {
    const data = {
        firstName: document.getElementById('addFirstName').value,
        lastName: document.getElementById('addLastName').value,
        email: document.getElementById('addEmail').value,
        password: document.getElementById('addPassword').value,
        phone: document.getElementById('addPhone').value,
        department: document.getElementById('addDepartment').value,
        role: document.getElementById('addRole').value,
        status: 'active'
    };
    const result = await api.createUser(data);
    if (result.success) {
        showToast('User created successfully', 'success');
        closeModal('addUserModal');
        await loadStats();
        await loadUsers();
    } else {
        showToast(result.error, 'error');
    }
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

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
