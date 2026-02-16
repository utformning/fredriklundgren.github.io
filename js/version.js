// Automatic version management system
// Loads version from version.json and updates UI dynamically

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fetch version from version.json
        const response = await fetch('version.json');
        const versionData = await response.json();

        // Format version string
        const versionString = `v.${versionData.version}`;
        const footerVersionString = `Version ${versionData.version}`;

        // Update all version badges on the page (navbar)
        const versionBadges = document.querySelectorAll('.version-badge, #version-badge');
        versionBadges.forEach(badge => {
            badge.textContent = versionString;
            badge.title = `Version ${versionData.version}\nLast updated: ${new Date(versionData.lastUpdated).toLocaleString('sv-SE')}`;
        });

        // Update footer version display
        const footerVersionElements = document.querySelectorAll('.footer-version, #footer-version');
        footerVersionElements.forEach(element => {
            element.textContent = footerVersionString;
            element.title = `${versionData.description}\nLast updated: ${new Date(versionData.lastUpdated).toLocaleString('sv-SE')}`;
        });

        // Update browser title if needed
        const titleVersion = document.querySelector('title');
        if (titleVersion && !titleVersion.textContent.includes(versionString)) {
            // Optionally add version to title (commented out by default)
            // titleVersion.textContent += ` (${versionString})`;
        }

        // Log version to console for debugging
        console.log(`📦 App Version: ${versionData.version}`);
        console.log(`🕐 Last Updated: ${new Date(versionData.lastUpdated).toLocaleString('sv-SE')}`);
        console.log(`📝 Description: ${versionData.description}`);

    } catch (error) {
        console.warn('⚠️  Could not load version information:', error);
        // Fallback to default version
        const versionBadges = document.querySelectorAll('.version-badge, #version-badge');
        versionBadges.forEach(badge => {
            badge.textContent = 'v.2.2.1';
        });

        const footerVersionElements = document.querySelectorAll('.footer-version, #footer-version');
        footerVersionElements.forEach(element => {
            element.textContent = 'Version 2.2.1';
        });
    }
});
