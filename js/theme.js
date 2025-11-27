// Theme Manager - Dark/Light Mode Toggle
// โหลดไฟล์นี้ก่อนไฟล์ JS อื่นๆ

(function() {
    // Load saved theme or default to 'dark'
    const savedTheme = localStorage.getItem('theme');
    const theme = savedTheme || 'dark'; // Default to dark theme

    // Apply theme immediately to prevent flash
    document.documentElement.setAttribute('data-theme', theme);
})();

// Toggle theme function
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Add transition class
    document.body.classList.add('transitioning');

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Dispatch event for other components (like 3D scenes)
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));

    // Update charts if they exist (for Dashboard)
    if (typeof updateChartsTheme === 'function') {
        updateChartsTheme(newTheme);
    }

    // Remove transition class after animation
    setTimeout(() => {
        document.body.classList.remove('transitioning');
    }, 300);
}

// Get current theme
function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only auto-switch if user hasn't manually set a preference
    if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
    }
});
