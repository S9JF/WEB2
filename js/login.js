// Login Page JavaScript
// ต้องโหลด env.js และ api.js ก่อน

document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    if (api.isLoggedIn()) {
        window.location.href = '/Dashboard';
        return;
    }

    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(target).classList.add('active');

            // Clear messages
            hideError('login');
            hideError('register');
            hideSuccess('register');
        });
    });

    // Password toggle
    document.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            // Find the input field within the same input-wrapper
            const wrapper = this.closest('.input-wrapper');
            const input = wrapper.querySelector('input');
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;

            // Toggle icon
            const icon = this.querySelector('svg');
            if (type === 'text') {
                icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
            } else {
                icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
            }
        });
    });

    // Login form
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const submitBtn = loginForm.querySelector('.submit-btn');

        // Disable button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<svg class="spinner" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="30 70" style="animation: spin 1s linear infinite;"/></svg> Signing in...';

        hideError('login');

        const result = await api.login(email, password);

        if (result.success) {
            window.location.href = '/Dashboard';
        } else {
            showError('login', result.error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Sign In <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
        }
    });

    // Register form
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const firstName = document.getElementById('regFirstName').value;
        const lastName = document.getElementById('regLastName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        const submitBtn = registerForm.querySelector('.submit-btn');

        hideError('register');
        hideSuccess('register');

        // Validate passwords match
        if (password !== confirmPassword) {
            showError('register', 'Passwords do not match');
            return;
        }

        // Validate password length
        if (password.length < 6) {
            showError('register', 'Password must be at least 6 characters');
            return;
        }

        // Disable button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<svg class="spinner" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="30 70" style="animation: spin 1s linear infinite;"/></svg> Creating account...';

        const result = await api.register(firstName, lastName, email, password);

        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Account <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';

        if (result.success) {
            showSuccess('register', result.message);
            registerForm.reset();

            // Switch to login tab after 2 seconds
            setTimeout(() => {
                document.querySelector('[data-tab="login"]').click();
            }, 2000);
        } else {
            showError('register', result.error);
        }
    });
});

// Helper functions
function showError(form, message) {
    const errorEl = document.getElementById(form + 'Error');
    if (errorEl) {
        errorEl.querySelector('span').textContent = message;
        errorEl.classList.add('show');
    }
}

function hideError(form) {
    const errorEl = document.getElementById(form + 'Error');
    if (errorEl) {
        errorEl.classList.remove('show');
    }
}

function showSuccess(form, message) {
    const successEl = document.getElementById(form + 'Success');
    if (successEl) {
        successEl.querySelector('span').textContent = message;
        successEl.classList.add('show');
    }
}

function hideSuccess(form) {
    const successEl = document.getElementById(form + 'Success');
    if (successEl) {
        successEl.classList.remove('show');
    }
}

// Add spinner animation
const style = document.createElement('style');
style.textContent = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.spinner {
    animation: spin 1s linear infinite;
}
`;
document.head.appendChild(style);
