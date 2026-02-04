// Centralized version management
// This file is automatically updated by the system
const APP_VERSION = 'v.2.1';

// Auto-inject version badge if it exists
document.addEventListener('DOMContentLoaded', () => {
    const versionBadge = document.querySelector('.version-badge');
    if (versionBadge) {
        versionBadge.textContent = APP_VERSION;
    }
});
