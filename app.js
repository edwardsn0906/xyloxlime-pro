/**
 * XYLOCLIME PRO - Professional Weather Intelligence Platform
 * Version: 1.0.0
 *
 * IMPORTANT: This is a commercial weather analysis platform with enhanced
 * liability protections and scalable architecture.
 *
 * Key Features:
 * - Terms of Service acceptance flow
 * - User session management
 * - Enhanced data validation
 * - Scalable architecture for future multi-user support
 * - Comprehensive logging and monitoring hooks
 */

// ============================================================================
// TERMS OF SERVICE MANAGER
// ============================================================================

class TermsManager {
    constructor() {
        this.TERMS_VERSION = '1.0';
        this.STORAGE_KEY = 'xyloclime_terms_acceptance';
    }

    hasAcceptedTerms() {
        const acceptance = this.getAcceptance();
        return acceptance && acceptance.version === this.TERMS_VERSION;
    }

    getAcceptance() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to read terms acceptance:', error);
            return null;
        }
    }

    recordAcceptance() {
        const acceptance = {
            version: this.TERMS_VERSION,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            ipInfo: 'Client-side only' // Would be server-side in production
        };

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(acceptance));
            this.logAcceptance(acceptance);
            return true;
        } catch (error) {
            console.error('Failed to record terms acceptance:', error);
            return false;
        }
    }

    logAcceptance(acceptance) {
        // Hook for future backend logging
        console.log('[TERMS] User accepted terms:', acceptance);
        // In production: send to analytics/compliance server
    }

    getAcceptanceDate() {
        const acceptance = this.getAcceptance();
        if (!acceptance) return null;

        const date = new Date(acceptance.timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    clearAcceptance() {
        localStorage.removeItem(this.STORAGE_KEY);
    }
}

// ============================================================================
// DATABASE MANAGER (Firestore Cloud Storage)
// ============================================================================

class DatabaseManager {
    constructor() {
        this.db = window.firebaseDb;
        this.auth = window.firebaseAuth;
        this.currentUserId = null;

        console.log('[DATABASE] Database Manager initialized');

        // Listen for auth state changes
        this.auth.onAuthStateChanged(user => {
            this.currentUserId = user ? user.uid : null;
            console.log('[DATABASE] User ID updated:', this.currentUserId || 'No user');
        });
    }

    // ========================================================================
    // PROJECT OPERATIONS
    // ========================================================================

    async saveProject(project) {
        if (!this.currentUserId) {
            throw new Error('User must be logged in to save projects');
        }

        try {
            const projectData = {
                ...project,
                userId: this.currentUserId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // If project has an ID, update existing, otherwise create new
            if (project.id) {
                await this.db.collection('projects').doc(project.id).set(projectData, { merge: true });
                console.log('[DATABASE] Project updated:', project.id);
            } else {
                // Create new project with auto-generated ID
                const docRef = await this.db.collection('projects').add({
                    ...projectData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                project.id = docRef.id;
                console.log('[DATABASE] Project created:', project.id);
            }

            return project;
        } catch (error) {
            console.error('[DATABASE] Error saving project:', error);
            throw error;
        }
    }

    async loadProjects() {
        if (!this.currentUserId) {
            console.warn('[DATABASE] No user logged in, cannot load projects');
            return [];
        }

        try {
            console.log('[DATABASE] Querying projects for user:', this.currentUserId);

            // Try query with orderBy first
            let snapshot;
            try {
                snapshot = await this.db.collection('projects')
                    .where('userId', '==', this.currentUserId)
                    .orderBy('updatedAt', 'desc')
                    .limit(100) // Increased from 50
                    .get();
            } catch (orderByError) {
                // If orderBy fails (e.g., missing index or updatedAt field), fall back to basic query
                console.warn('[DATABASE] OrderBy query failed, using basic query:', orderByError.message);
                snapshot = await this.db.collection('projects')
                    .where('userId', '==', this.currentUserId)
                    .limit(100)
                    .get();
            }

            const projects = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log('[DATABASE] Project found:', doc.id, data.name, 'updatedAt:', data.updatedAt);
                projects.push({
                    id: doc.id,
                    ...data
                });
            });

            // Sort manually in case query didn't sort
            projects.sort((a, b) => {
                const aTime = a.updatedAt?.toMillis?.() || a.updatedAt || 0;
                const bTime = b.updatedAt?.toMillis?.() || b.updatedAt || 0;
                return bTime - aTime; // Descending
            });

            console.log('[DATABASE] Successfully loaded', projects.length, 'projects');
            return projects;
        } catch (error) {
            console.error('[DATABASE] Error loading projects:', error);
            console.error('[DATABASE] Error details:', error.message, error.code);
            return [];
        }
    }

    async deleteProject(projectId) {
        if (!this.currentUserId) {
            throw new Error('User must be logged in to delete projects');
        }

        try {
            // Verify project belongs to current user before deleting
            const doc = await this.db.collection('projects').doc(projectId).get();

            if (!doc.exists) {
                throw new Error('Project not found');
            }

            if (doc.data().userId !== this.currentUserId) {
                throw new Error('Cannot delete project owned by another user');
            }

            await this.db.collection('projects').doc(projectId).delete();
            console.log('[DATABASE] Project deleted:', projectId);
        } catch (error) {
            console.error('[DATABASE] Error deleting project:', error);
            throw error;
        }
    }

    async getProject(projectId) {
        if (!this.currentUserId) {
            throw new Error('User must be logged in to view projects');
        }

        try {
            const doc = await this.db.collection('projects').doc(projectId).get();

            if (!doc.exists) {
                return null;
            }

            const data = doc.data();

            // Verify project belongs to current user
            if (data.userId !== this.currentUserId) {
                console.warn('[DATABASE] Attempted to access project owned by another user');
                return null;
            }

            return {
                id: doc.id,
                ...data
            };
        } catch (error) {
            console.error('[DATABASE] Error loading project:', error);
            return null;
        }
    }

    // ========================================================================
    // MIGRATION HELPER
    // ========================================================================

    async migrateFromLocalStorage() {
        if (!this.currentUserId) {
            console.warn('[DATABASE] Cannot migrate: no user logged in');
            return { success: false, count: 0 };
        }

        try {
            // Get projects from localStorage
            const localProjects = JSON.parse(localStorage.getItem('xyloclime_projects') || '[]');

            if (localProjects.length === 0) {
                console.log('[DATABASE] No local projects to migrate');
                return { success: true, count: 0 };
            }

            console.log('[DATABASE] Migrating', localProjects.length, 'projects from localStorage...');

            let migrated = 0;
            for (const project of localProjects) {
                try {
                    await this.saveProject(project);
                    migrated++;
                } catch (error) {
                    console.error('[DATABASE] Failed to migrate project:', project.name, error);
                }
            }

            console.log('[DATABASE] Migration complete:', migrated, 'projects migrated');

            // Optionally clear localStorage after successful migration
            // localStorage.removeItem('xyloclime_projects');

            return { success: true, count: migrated };
        } catch (error) {
            console.error('[DATABASE] Migration failed:', error);
            return { success: false, count: 0, error };
        }
    }
}

// ============================================================================
// SESSION MANAGER (for future scalability)
// ============================================================================

class SessionManager {
    constructor() {
        this.SESSION_KEY = 'xyloclime_session';
        this.sessionId = this.getOrCreateSession();
    }

    getOrCreateSession() {
        let session = localStorage.getItem(this.SESSION_KEY);
        if (!session) {
            session = this.generateSessionId();
            localStorage.setItem(this.SESSION_KEY, session);
        }
        return session;
    }

    generateSessionId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getSession() {
        return this.sessionId;
    }

    // Hook for future user authentication
    setUser(userId, userData) {
        console.log('[SESSION] User set:', userId);
        // Future: integrate with authentication system
    }

    logAction(action, data) {
        const logEntry = {
            sessionId: this.sessionId,
            action,
            data,
            timestamp: new Date().toISOString()
        };
        console.log('[SESSION]', logEntry);
        // Future: send to analytics server
    }
}

// ============================================================================
// MAIN APPLICATION CLASS
// ============================================================================

class XyloclimePro {
    constructor() {
        // Managers
        this.termsManager = new TermsManager();
        this.sessionManager = new SessionManager();
        this.databaseManager = new DatabaseManager();

        // Application state
        this.map = null;
        this.selectedLocation = null;
        this.currentProject = null;
        this.weatherData = null;
        this.apiKey = localStorage.getItem('xyloclime_apiKey') || '';
        this.charts = {};
        this.lastSearchTime = 0;
        this.searchDebounceTimer = null;
        this.activeRequestController = null;
        this.selectedSuggestionIndex = -1;

        // Unit system preference (default: Imperial for US)
        this.unitSystem = localStorage.getItem('xyloclime_unitSystem') || 'imperial';
        this.tempUnit = this.unitSystem === 'imperial' ? 'F' : 'C';

        // Projects will be loaded from Firestore after login
        this.projects = [];
        this.projectsLoaded = false;

        this.init();
    }

    // ========================================================================
    // TEMPERATURE CONVERSION
    // ========================================================================

    celsiusToFahrenheit(celsius) {
        return (celsius * 9/5) + 32;
    }

    fahrenheitToCelsius(fahrenheit) {
        return (fahrenheit - 32) * 5/9;
    }

    convertTemp(temp, fromUnit = 'C') {
        if (fromUnit === this.tempUnit) {
            return temp; // Already in desired unit
        }

        if (fromUnit === 'C' && this.tempUnit === 'F') {
            return this.celsiusToFahrenheit(temp);
        } else if (fromUnit === 'F' && this.tempUnit === 'C') {
            return this.fahrenheitToCelsius(temp);
        }

        return temp;
    }

    formatTemp(temp, fromUnit = 'C', includeUnit = true) {
        const converted = this.convertTemp(temp, fromUnit);
        const formatted = converted.toFixed(1);
        return includeUnit ? `${formatted}°${this.tempUnit}` : formatted;
    }

    // ========================================================================
    // PRECIPITATION CONVERSION (mm <-> inches)
    // ========================================================================

    mmToInches(mm) {
        return mm / 25.4;
    }

    inchesToMm(inches) {
        return inches * 25.4;
    }

    formatPrecip(mm, includeUnit = true) {
        if (this.unitSystem === 'imperial') {
            const inches = this.mmToInches(mm);
            return includeUnit ? `${inches.toFixed(1)} in` : inches.toFixed(1);
        } else {
            return includeUnit ? `${mm.toFixed(1)} mm` : mm.toFixed(1);
        }
    }

    // ========================================================================
    // SNOW CONVERSION (cm <-> inches)
    // ========================================================================

    cmToInches(cm) {
        return cm / 2.54;
    }

    inchesToCm(inches) {
        return inches * 2.54;
    }

    formatSnow(cm, includeUnit = true) {
        if (this.unitSystem === 'imperial') {
            const inches = this.cmToInches(cm);
            return includeUnit ? `${inches.toFixed(1)} in` : inches.toFixed(1);
        } else {
            return includeUnit ? `${cm.toFixed(1)} cm` : cm.toFixed(1);
        }
    }

    // ========================================================================
    // WIND SPEED CONVERSION (km/h <-> mph)
    // ========================================================================

    kmhToMph(kmh) {
        return kmh / 1.609344;
    }

    mphToKmh(mph) {
        return mph * 1.609344;
    }

    formatWind(kmh, includeUnit = true) {
        if (this.unitSystem === 'imperial') {
            const mph = this.kmhToMph(kmh);
            return includeUnit ? `${mph.toFixed(1)} mph` : mph.toFixed(1);
        } else {
            return includeUnit ? `${kmh.toFixed(1)} km/h` : kmh.toFixed(1);
        }
    }

    // ========================================================================
    // UNIT SYSTEM MANAGEMENT
    // ========================================================================

    getTempUnit() {
        return this.tempUnit;
    }

    getUnitSystem() {
        return this.unitSystem;
    }

    setUnitSystem(system) {
        this.unitSystem = system;
        this.tempUnit = system === 'imperial' ? 'F' : 'C';
        localStorage.setItem('xyloclime_unitSystem', system);
        this.updateUnitSystemUI();

        // Refresh dashboard if project is loaded
        if (this.currentProject && this.currentProject.analysis) {
            this.updateDashboard(this.currentProject.analysis);
        }
    }

    setTempUnit(unit) {
        // Legacy support - now uses setUnitSystem
        const system = unit === 'F' ? 'imperial' : 'metric';
        this.setUnitSystem(system);
    }

    updateUnitSystemUI() {
        // Update header toggle buttons
        const imperialBtn = document.getElementById('unitSystemImperial');
        const metricBtn = document.getElementById('unitSystemMetric');

        if (imperialBtn && metricBtn) {
            imperialBtn.classList.toggle('active', this.unitSystem === 'imperial');
            metricBtn.classList.toggle('active', this.unitSystem === 'metric');
        }

        console.log(`[UNITS] Unit system updated to: ${this.unitSystem}`);
    }

    updateTempUnitUI() {
        // Legacy method - redirects to updateUnitSystemUI
        this.updateUnitSystemUI();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    init() {
        console.log('[METEORYX] Initializing application...');
        this.sessionManager.logAction('app_init', { version: '1.0.0' });

        // Don't show any screen yet - let AuthManager decide based on login state
        // AuthManager's onAuthStateChanged will handle the flow:
        // No user -> Login screen
        // User but no terms -> Terms screen
        // User with terms -> Main app

        // Initialize main app components (but keep hidden until auth resolves)
        this.initializeMap();
        this.bindEvents();
        this.setDefaultDates();
        this.updateAcceptanceDate();
        this.updateTempUnitUI();

        // Initialize premium features
        this.initializePremiumFeatures();

        // Note: loadSavedProjects() is called by AuthManager after login
    }

    initializePremiumFeatures() {
        // Initialize project templates library
        if (window.ProjectTemplatesLibrary) {
            this.templatesLibrary = new window.ProjectTemplatesLibrary();
            this.renderTemplateSelector();
            console.log('[PREMIUM] Templates library initialized');
        }

        // Initialize smart recommendations engine
        if (window.SmartRecommendations) {
            this.recommendationsEngine = new window.SmartRecommendations();
            console.log('[PREMIUM] Smart recommendations engine initialized');
        }
    }

    renderTemplateSelector() {
        const container = document.getElementById('templateSelector');
        if (!container || !this.templatesLibrary) return;

        const templates = this.templatesLibrary.getAllTemplates();

        container.innerHTML = templates.map(template => `
            <div class="template-card" data-template-id="${template.id}">
                <div class="template-card-icon">
                    <i class="fas ${template.icon}"></i>
                </div>
                <div class="template-card-name">${template.name}</div>
                <div class="template-card-description">${template.description}</div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const templateId = card.dataset.templateId;
                this.selectTemplate(templateId);
            });
        });
    }

    selectTemplate(templateId) {
        // Visual feedback
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-template-id="${templateId}"]`)?.classList.add('selected');

        // Store selected template
        this.selectedTemplate = templateId;

        // Get template details
        const template = this.templatesLibrary.getTemplate(templateId);
        if (!template) return;

        // Auto-fill project name if empty
        const nameInput = document.getElementById('projectName');
        if (nameInput && !nameInput.value) {
            nameInput.value = template.name;
        }

        // Show success toast
        window.toastManager.success(`Template "${template.name}" selected! Weather criteria optimized for this project type.`, 'Template Applied', 4000);

        console.log('[PREMIUM] Template selected:', templateId);
    }

    displaySmartRecommendations(analysis, project) {
        if (!this.recommendationsEngine) return;

        const recommendations = this.recommendationsEngine.generateRecommendations(analysis, project);

        const section = document.getElementById('smartRecommendationsSection');
        if (!section) return;

        // Display each category
        this.renderRecommendationCategory('criticalRecommendations', recommendations.critical, 'critical');
        this.renderRecommendationCategory('importantRecommendations', recommendations.important, 'important');
        this.renderRecommendationCategory('helpfulRecommendations', recommendations.helpful, 'helpful');
        this.renderRecommendationCategory('insightsRecommendations', recommendations.insights, 'insight');

        // Show section if there are any recommendations
        const hasRecommendations = recommendations.critical.length + recommendations.important.length +
                                    recommendations.helpful.length + recommendations.insights.length > 0;

        if (hasRecommendations) {
            section.style.display = 'block';
            console.log('[PREMIUM] Smart recommendations displayed');
        }
    }

    renderRecommendationCategory(containerId, recommendations, className) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (recommendations.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item ${className}">
                <div class="recommendation-header">
                    <div class="recommendation-icon">
                        <i class="fas ${rec.icon}"></i>
                    </div>
                    <div class="recommendation-content">
                        <div class="recommendation-title">${rec.title}</div>
                        <div class="recommendation-message">${rec.message}</div>
                        <div class="recommendation-action">${rec.action}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    showTermsScreen() {
        document.getElementById('authScreen').classList.add('hidden'); // Hide auth screen
        document.getElementById('termsScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');

        // Reset all checkboxes to unchecked
        for (let i = 1; i <= 8; i++) {
            const checkbox = document.getElementById(`ack${i}`);
            if (checkbox) {
                checkbox.checked = false;
            }
        }

        // Disable the agree button until all checkboxes are checked
        const agreeBtn = document.getElementById('agreeBtn');
        if (agreeBtn) {
            agreeBtn.disabled = true;
        }

        // Auto-scroll to top of terms screen
        setTimeout(() => {
            const termsScreen = document.getElementById('termsScreen');
            if (termsScreen) {
                termsScreen.scrollTop = 0;
            }
            window.scrollTo(0, 0);
        }, 100);

        console.log('[TERMS] All checkboxes reset to unchecked');
        this.bindTermsEvents();
    }

    showMainApp() {
        document.getElementById('authScreen').classList.add('hidden'); // Hide auth screen
        document.getElementById('termsScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');

        // Fix map rendering issue - invalidate size after map becomes visible
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
                // Reset view to default center and zoom
                this.map.setView([39.8283, -98.5795], 4);
                console.log('[MAP] Size invalidated and view reset');
            }, 250);
        }
    }

    // ========================================================================
    // TERMS ACCEPTANCE HANDLING
    // ========================================================================

    bindTermsEvents() {
        // Track checkbox states
        const checkboxes = document.querySelectorAll('.ack-checkbox');
        const acceptBtn = document.getElementById('acceptTermsBtn');

        console.log('[TERMS] Initializing - Found', checkboxes.length, 'checkboxes');
        console.log('[TERMS] Accept button found:', !!acceptBtn);

        if (checkboxes.length === 0) {
            console.error('[TERMS] ERROR: No checkboxes found!');
            return;
        }

        if (!acceptBtn) {
            console.error('[TERMS] ERROR: Accept button not found!');
            return;
        }

        // Function to check if all boxes are checked
        const updateButtonState = () => {
            const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            const allChecked = checkedCount === checkboxes.length;

            acceptBtn.disabled = !allChecked;

            // Visual feedback
            if (allChecked) {
                acceptBtn.style.animation = 'pulse 2s infinite';
                console.log('[TERMS] ✓ ALL BOXES CHECKED - Button ENABLED');
            } else {
                acceptBtn.style.animation = 'none';
                console.log('[TERMS] ○ Checked:', checkedCount, '/', checkboxes.length, '- Button disabled');
            }
        };

        // Initial check
        updateButtonState();

        // Listen to change events on each checkbox
        checkboxes.forEach((checkbox, index) => {
            // Log initial state
            console.log('[TERMS] Checkbox', index + 1, 'initial state:', checkbox.checked);

            checkbox.addEventListener('change', (e) => {
                console.log('[TERMS] Checkbox', index + 1, checkbox.checked ? '☑ CHECKED' : '☐ unchecked');
                updateButtonState();
            });
        });

        // Accept button click handler
        if (acceptBtn) {
            acceptBtn.addEventListener('click', (e) => {
                e.preventDefault();

                const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
                const allChecked = checkedCount === checkboxes.length;

                console.log('[TERMS] Accept button clicked - Checked:', checkedCount, '/', checkboxes.length);

                // Validate all boxes are checked
                if (!allChecked) {
                    alert(`Please check all acknowledgment boxes before continuing.\n\nYou have checked ${checkedCount} out of ${checkboxes.length} required boxes.`);
                    return;
                }

                if (this.termsManager.recordAcceptance()) {
                    this.sessionManager.logAction('terms_accepted', {
                        version: this.termsManager.TERMS_VERSION
                    });
                    console.log('[TERMS] Acceptance recorded successfully - proceeding to main app');
                    this.showMainApp();
                    this.updateAcceptanceDate();
                } else {
                    console.error('[TERMS] Failed to record acceptance');
                    alert('Failed to record terms acceptance. Please try again.');
                }
            });
        } else {
            console.error('[TERMS] Accept button not found!');
        }

        // Decline button
        document.getElementById('declineTermsBtn').addEventListener('click', () => {
            this.sessionManager.logAction('terms_declined', {});
            alert('You must accept the Terms of Service to use Xyloclime Pro.');
        });

        // View full terms
        const viewFullTermsLink = document.getElementById('viewFullTerms');
        if (viewFullTermsLink) {
            viewFullTermsLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent label click
                console.log('[TERMS] Opening full terms modal');
                this.showFullTermsModal();
            });
        }

        // Close full terms modal
        document.getElementById('closeFullTerms').addEventListener('click', () => {
            this.hideFullTermsModal();
        });
    }

    showFullTermsModal() {
        document.getElementById('fullTermsModal').classList.remove('hidden');
    }

    hideFullTermsModal() {
        document.getElementById('fullTermsModal').classList.add('hidden');
    }

    updateAcceptanceDate() {
        const date = this.termsManager.getAcceptanceDate();
        if (date) {
            document.getElementById('userAcceptanceDate').textContent = `Terms Accepted: ${date}`;
        }
    }

    // ========================================================================
    // SECURITY & VALIDATION
    // ========================================================================

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    validateProjectName(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: 'Project name is required' };
        }

        const trimmed = name.trim();

        if (trimmed.length === 0) {
            return { valid: false, error: 'Project name cannot be empty' };
        }

        if (trimmed.length > 100) {
            return { valid: false, error: 'Project name must be less than 100 characters' };
        }

        const dangerousPatterns = /<script|javascript:|onerror=|onload=/gi;
        if (dangerousPatterns.test(trimmed)) {
            return { valid: false, error: 'Project name contains invalid characters' };
        }

        return { valid: true, sanitized: this.sanitizeHTML(trimmed) };
    }

    validateDates(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { valid: false, error: 'Invalid date format' };
        }

        if (start >= end) {
            return { valid: false, error: 'End date must be after start date' };
        }

        if (start.getFullYear() < 1940) {
            return { valid: false, error: 'Start date cannot be before 1940' };
        }

        const maxFuture = new Date();
        maxFuture.setFullYear(maxFuture.getFullYear() + 50);
        if (end > maxFuture) {
            return { valid: false, error: 'End date cannot be more than 50 years in the future' };
        }

        const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
        if (daysDiff > 3650) {
            return { valid: false, error: 'Project duration cannot exceed 10 years' };
        }

        return { valid: true };
    }

    // ========================================================================
    // MAP INITIALIZATION
    // ========================================================================

    initializeMap() {
        try {
            // Set map bounds to prevent infinite tiling
            const southWest = L.latLng(-89.98155760646617, -180);
            const northEast = L.latLng(89.99346179538875, 180);
            const bounds = L.latLngBounds(southWest, northEast);

            this.map = L.map('map', {
                minZoom: 2,           // Prevent zooming out too far
                maxZoom: 18,          // Maximum zoom level
                maxBounds: bounds,    // Limit map area
                maxBoundsViscosity: 1.0,  // Keep map within bounds
                worldCopyJump: false  // Disable world wrapping
            }).setView([39.8283, -98.5795], 4);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                noWrap: true,         // Prevent tile wrapping
                bounds: bounds        // Tile layer bounds
            }).addTo(this.map);

            this.map.on('click', (e) => {
                this.selectLocation(e.latlng.lat, e.latlng.lng);
            });

            this.selectedMarker = null;

            console.log('[MAP] Initialized with zoom limits (2-18) and no world wrapping');
        } catch (error) {
            console.error('Map initialization failed:', error);
        }
    }

    selectLocation(lat, lng) {
        if (this.selectedMarker) {
            this.map.removeLayer(this.selectedMarker);
        }

        this.selectedMarker = L.marker([lat, lng]).addTo(this.map);
        this.selectedLocation = { lat, lng };

        document.getElementById('selectedLat').textContent = lat.toFixed(6);
        document.getElementById('selectedLng').textContent = lng.toFixed(6);

        // Show copy button when coordinates are selected
        const copyBtn = document.getElementById('copyCoordinatesBtn');
        if (copyBtn) {
            copyBtn.style.display = 'inline-block';
        }

        this.reverseGeocode(lat, lng);
        this.sessionManager.logAction('location_selected', { lat, lng });
    }

    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();

            if (data.display_name) {
                document.getElementById('locationSearch').value = data.display_name;
            }
        } catch (error) {
            console.warn('Reverse geocoding failed:', error);
        }
    }

    async searchLocation(query) {
        if (!query.trim()) {
            this.showSearchStatus('Please enter a location', 'error');
            return;
        }

        const now = Date.now();
        if (now - this.lastSearchTime < 1000) {
            this.showSearchStatus('Please wait before searching again', 'error');
            return;
        }
        this.lastSearchTime = now;

        const sanitizedQuery = this.sanitizeHTML(query.trim().substring(0, 200));

        this.showSearchStatus('Searching for location...', '');
        this.hideSuggestions();

        try {
            // Detect if query is a ZIP code (US postal code)
            const isZipCode = this.isUSZipCode(sanitizedQuery);
            let searchUrl;

            if (isZipCode) {
                // Use structured query for ZIP codes with country code for better results
                console.log('[SEARCH] Detected ZIP code:', sanitizedQuery);
                searchUrl = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(sanitizedQuery)}&country=United States&limit=5&addressdetails=1`;
            } else {
                // Regular location search
                console.log('[SEARCH] Regular location search:', sanitizedQuery);
                searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sanitizedQuery)}&limit=5&addressdetails=1`;
            }

            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Xyloclime Pro Weather Analysis Platform'
                }
            });

            if (!response.ok) {
                throw new Error('Location search failed');
            }

            const data = await response.json();
            console.log('[SEARCH] Found', data.length, 'results');

            if (data.length > 0) {
                // Filter out non-US results for ZIP codes to avoid confusion
                let results = data;
                if (isZipCode) {
                    results = data.filter(r => {
                        const address = r.address || {};
                        return address.country_code === 'us' ||
                               address.country === 'United States' ||
                               r.display_name.includes('United States');
                    });
                    console.log('[SEARCH] Filtered to', results.length, 'US results');
                }

                if (results.length === 0) {
                    this.showSearchStatus('ZIP code not found in United States. Try: "12345" or "City, State"', 'error');
                    return;
                }

                if (results.length === 1) {
                    // Only one result, select it immediately
                    const result = results[0];
                    const lat = parseFloat(result.lat);
                    const lng = parseFloat(result.lon);

                    this.map.setView([lat, lng], isZipCode ? 12 : 10); // Zoom closer for ZIP codes
                    this.selectLocation(lat, lng);

                    const locationName = isZipCode ?
                        `${sanitizedQuery}, ${result.address?.state || result.address?.county || 'USA'}` :
                        result.display_name;
                    document.getElementById('locationSearch').value = locationName;

                    this.showSearchStatus(isZipCode ? 'ZIP code found!' : 'Location found!', 'success');
                    setTimeout(() => this.hideSearchStatus(), 2000);
                } else {
                    // Multiple results, show suggestions
                    this.showSuggestions(results);
                    this.hideSearchStatus();
                }
            } else {
                const errorMsg = isZipCode ?
                    'ZIP code not found. Try: "12345" or "City, State"' :
                    'Location not found. Try: "City, State" or "ZIP code"';
                this.showSearchStatus(errorMsg, 'error');
            }
        } catch (error) {
            console.error('[SEARCH] Location search failed:', error);
            this.showSearchStatus('Search failed. Please check your connection and try again.', 'error');
        }
    }

    isUSZipCode(query) {
        // Match 5-digit ZIP codes or ZIP+4 format (12345 or 12345-6789)
        const zipPattern = /^\d{5}(-\d{4})?$/;
        return zipPattern.test(query.trim());
    }

    showSuggestions(results) {
        const container = document.getElementById('locationSuggestions');
        if (!container) return;

        container.innerHTML = '';

        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';

            const displayName = result.display_name;
            const parts = displayName.split(',');
            const name = parts[0];
            const address = parts.slice(1).join(',');

            item.innerHTML = `
                <i class="fas fa-map-marker-alt"></i>
                <div class="suggestion-content">
                    <div class="suggestion-name">${this.sanitizeHTML(name)}</div>
                    <div class="suggestion-address">${this.sanitizeHTML(address)}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                document.getElementById('locationSearch').value = displayName;
                this.map.setView([lat, lng], 10);
                this.selectLocation(lat, lng);
                this.hideSuggestions();
                this.showSearchStatus('Location selected!', 'success');
                setTimeout(() => this.hideSearchStatus(), 2000);
            });

            container.appendChild(item);
        });

        container.classList.remove('hidden');

        // Scroll the search box to top of viewport so dropdown is always visible below it
        setTimeout(() => {
            const searchInput = document.getElementById('locationSearch');
            if (searchInput) {
                searchInput.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });
            }
        }, 10);
    }

    hideSuggestions() {
        const container = document.getElementById('locationSuggestions');
        if (container) {
            container.classList.add('hidden');
            container.innerHTML = '';
        }
        this.selectedSuggestionIndex = -1;
    }

    // ========================================================================
    // REAL-TIME AUTOCOMPLETE SEARCH (GOOGLE EARTH STYLE)
    // ========================================================================

    autocompleteSearch(query) {
        // Cancel any pending search
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }

        // Cancel any active request
        if (this.activeRequestController) {
            this.activeRequestController.abort();
        }

        // Clear suggestions if query is too short
        if (!query || query.trim().length < 2) {
            this.hideSuggestions();
            this.hideSearchStatus();
            return;
        }

        // Show loading state
        this.showSearchStatus('Searching...', '');

        // Debounce: wait 300ms after user stops typing
        this.searchDebounceTimer = setTimeout(() => {
            this.performAutocompleteSearch(query.trim());
        }, 300);
    }

    async performAutocompleteSearch(query) {
        if (query.length < 2) {
            this.hideSuggestions();
            this.hideSearchStatus();
            return;
        }

        try {
            // Create new AbortController for this request
            this.activeRequestController = new AbortController();
            const signal = this.activeRequestController.signal;

            const sanitizedQuery = this.sanitizeHTML(query.substring(0, 200));

            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sanitizedQuery)}&limit=8&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'Xyloclime Pro Weather Analysis Platform'
                    },
                    signal: signal
                }
            );

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const data = await response.json();

            if (data.length > 0) {
                this.showAutocompleteSuggestions(data);
                this.hideSearchStatus();
            } else {
                this.hideSuggestions();
                this.showSearchStatus('No locations found. Try a different search.', 'error');
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                // Request was cancelled, ignore
                return;
            }
            console.error('Autocomplete search failed:', error);
            this.showSearchStatus('Search failed. Please try again.', 'error');
            this.hideSuggestions();
        }
    }

    showAutocompleteSuggestions(results) {
        const container = document.getElementById('locationSuggestions');
        if (!container) return;

        container.innerHTML = '';
        this.selectedSuggestionIndex = -1;

        results.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.setAttribute('data-index', index);

            const displayName = result.display_name;
            const parts = displayName.split(',');
            const name = parts[0];
            const address = parts.slice(1).join(',').trim();

            // Determine icon based on type
            let icon = 'fa-map-marker-alt';
            if (result.type === 'city' || result.type === 'town' || result.type === 'village') {
                icon = 'fa-city';
            } else if (result.type === 'country') {
                icon = 'fa-flag';
            } else if (result.type === 'state' || result.type === 'province') {
                icon = 'fa-map';
            } else if (result.type === 'building' || result.type === 'house') {
                icon = 'fa-building';
            } else if (result.type === 'road' || result.type === 'street') {
                icon = 'fa-road';
            }

            item.innerHTML = `
                <i class="fas ${icon}"></i>
                <div class="suggestion-content">
                    <div class="suggestion-name">${this.sanitizeHTML(name)}</div>
                    <div class="suggestion-address">${this.sanitizeHTML(address)}</div>
                </div>
                <i class="fas fa-arrow-right suggestion-arrow"></i>
            `;

            item.addEventListener('click', () => {
                this.selectSuggestion(result);
            });

            item.addEventListener('mouseenter', () => {
                this.highlightSuggestion(index);
            });

            container.appendChild(item);
        });

        container.classList.remove('hidden');
    }

    selectSuggestion(result) {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const displayName = result.display_name;

        document.getElementById('locationSearch').value = displayName;
        this.map.setView([lat, lng], 12);
        this.selectLocation(lat, lng);
        this.hideSuggestions();
        this.showSearchStatus('Location selected!', 'success');
        setTimeout(() => this.hideSearchStatus(), 2000);
    }

    highlightSuggestion(index) {
        const container = document.getElementById('locationSuggestions');
        if (!container) return;

        const items = container.querySelectorAll('.suggestion-item');
        items.forEach((item, idx) => {
            if (idx === index) {
                item.classList.add('highlighted');
            } else {
                item.classList.remove('highlighted');
            }
        });

        this.selectedSuggestionIndex = index;
    }

    navigateSuggestions(direction) {
        const container = document.getElementById('locationSuggestions');
        if (!container || container.classList.contains('hidden')) return;

        const items = container.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (direction === 'down') {
            this.selectedSuggestionIndex = Math.min(this.selectedSuggestionIndex + 1, items.length - 1);
        } else if (direction === 'up') {
            this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, -1);
        }

        if (this.selectedSuggestionIndex >= 0) {
            this.highlightSuggestion(this.selectedSuggestionIndex);
            // Scroll into view
            items[this.selectedSuggestionIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            // Clear all highlights
            items.forEach(item => item.classList.remove('highlighted'));
        }
    }

    selectHighlightedSuggestion() {
        const container = document.getElementById('locationSuggestions');
        if (!container || container.classList.contains('hidden')) return false;

        const items = container.querySelectorAll('.suggestion-item');
        if (this.selectedSuggestionIndex >= 0 && this.selectedSuggestionIndex < items.length) {
            items[this.selectedSuggestionIndex].click();
            return true;
        }

        return false;
    }

    showSearchStatus(message, type) {
        const status = document.getElementById('locationSearchStatus');
        if (!status) return;

        status.className = 'search-status';
        if (type) status.classList.add(type);

        if (type === 'error') {
            status.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        } else if (type === 'success') {
            status.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        } else {
            status.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
        }

        status.classList.remove('hidden');
    }

    hideSearchStatus() {
        const status = document.getElementById('locationSearchStatus');
        if (status) {
            status.classList.add('hidden');
        }
    }

    async useMyLocation() {
        if (!navigator.geolocation) {
            this.showSearchStatus('Geolocation is not supported by your browser', 'error');
            return;
        }

        this.showSearchStatus('Getting your location...', '');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                this.map.setView([lat, lng], 10);
                this.selectLocation(lat, lng);

                // Get address name
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                        headers: {
                            'User-Agent': 'Xyloclime Pro Weather Analysis Platform'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.display_name) {
                            document.getElementById('locationSearch').value = data.display_name;
                        }
                    }
                } catch (error) {
                    console.warn('Reverse geocoding failed:', error);
                }

                this.showSearchStatus('Using your current location!', 'success');
                setTimeout(() => this.hideSearchStatus(), 2000);
            },
            (error) => {
                console.error('Geolocation error:', error);
                this.showSearchStatus('Unable to get your location. Please enable location services.', 'error');
            }
        );
    }

    // ========================================================================
    // EVENT BINDING
    // ========================================================================

    bindEvents() {
        // Location search
        const locationSearch = document.getElementById('locationSearch');
        const searchLocationBtn = document.getElementById('searchLocationBtn');
        const useMyLocationBtn = document.getElementById('useMyLocationBtn');

        // Real-time autocomplete as user types
        locationSearch.addEventListener('input', (e) => {
            this.autocompleteSearch(e.target.value);
        });

        // Keyboard navigation for suggestions
        locationSearch.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateSuggestions('down');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateSuggestions('up');
            } else if (e.key === 'Enter') {
                e.preventDefault();
                // Try to select highlighted suggestion, otherwise search
                if (!this.selectHighlightedSuggestion()) {
                    this.searchLocation(locationSearch.value);
                }
            } else if (e.key === 'Escape') {
                this.hideSuggestions();
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.location-search-container') && !e.target.closest('.location-suggestions')) {
                this.hideSuggestions();
            }
        });

        // Search button click
        if (searchLocationBtn) {
            searchLocationBtn.addEventListener('click', () => {
                this.searchLocation(locationSearch.value);
            });
        }

        // Use my location button
        if (useMyLocationBtn) {
            useMyLocationBtn.addEventListener('click', () => {
                this.useMyLocation();
            });
        }

        // Focus search input on page load
        if (locationSearch) {
            // Small delay to ensure page is fully loaded
            setTimeout(() => {
                locationSearch.focus();
            }, 500);
        }

        // Use example name button
        const useExampleName = document.getElementById('useExampleName');
        if (useExampleName) {
            useExampleName.addEventListener('click', () => {
                const examples = [
                    'Downtown Construction 2025',
                    'Summer Event Planning',
                    'Highway Paving Project',
                    'Outdoor Festival Setup',
                    'Building Foundation Work',
                    'Roofing Installation Project',
                    'Landscaping & Grounds Work'
                ];
                const randomExample = examples[Math.floor(Math.random() * examples.length)];
                document.getElementById('projectName').value = randomExample;
            });
        }

        // Analyze button
        document.getElementById('analyzeBtn').addEventListener('click', () => {
            this.analyzeWeatherData();
        });

        // Copy coordinates button
        const copyCoordinatesBtn = document.getElementById('copyCoordinatesBtn');
        if (copyCoordinatesBtn) {
            copyCoordinatesBtn.addEventListener('click', () => {
                if (this.selectedLocation) {
                    const coordinates = `${this.selectedLocation.lat.toFixed(6)}, ${this.selectedLocation.lng.toFixed(6)}`;
                    window.UXUtils.copyToClipboard(coordinates, 'Coordinates copied to clipboard!');
                }
            });
        }

        // Sample projects modal
        const loadSampleBtn = document.getElementById('loadSampleBtn');
        if (loadSampleBtn) {
            loadSampleBtn.addEventListener('click', () => {
                document.getElementById('sampleProjectsModal').classList.remove('hidden');
            });
        }

        const closeSampleModal = document.getElementById('closeSampleModal');
        if (closeSampleModal) {
            closeSampleModal.addEventListener('click', () => {
                document.getElementById('sampleProjectsModal').classList.add('hidden');
            });
        }

        // Load sample project buttons
        document.querySelectorAll('.load-sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sampleId = e.currentTarget.dataset.sampleId;
                if (window.sampleDataManager) {
                    window.sampleDataManager.loadSampleIntoApp(sampleId, this);
                    document.getElementById('sampleProjectsModal').classList.add('hidden');
                }
            });
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.switchTab(item.dataset.tab);
            });
        });

        // Back to new project
        const backBtn = document.getElementById('backToNewProject');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showSetupPanel();
            });
        }

        // View terms links
        document.querySelectorAll('#viewTermsLink, #footerTermsLink').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showFullTermsModal();
            });
        });

        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettings();
            });
        }

        // Cost calculator buttons (enhanced version only)
        const costCalcBtn = document.getElementById('costCalcBtn');
        if (costCalcBtn) {
            costCalcBtn.addEventListener('click', () => {
                alert('Cost calculator will open after creating a project!');
            });
        }

        const openCostCalc = document.getElementById('openCostCalc');
        if (openCostCalc) {
            openCostCalc.addEventListener('click', () => {
                this.openCostCalculator();
            });
        }

        const closeCostCalc = document.getElementById('closeCostCalc');
        if (closeCostCalc) {
            closeCostCalc.addEventListener('click', () => {
                document.getElementById('costCalculatorModal').classList.add('hidden');
            });
        }

        const calculateCosts = document.getElementById('calculateCosts');
        if (calculateCosts) {
            calculateCosts.addEventListener('click', () => {
                this.calculateProjectCosts();
            });
        }

        // PDF Export button (Executive Summary)
        const exportPdfBtn = document.getElementById('exportPdfBtn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => {
                this.exportProfessionalPDF();
            });
        }

        // Advanced PDF Export button (Dashboard Header)
        const exportAdvancedPdfBtn = document.getElementById('exportAdvancedPdfBtn');
        if (exportAdvancedPdfBtn) {
            exportAdvancedPdfBtn.addEventListener('click', () => {
                this.exportAdvancedPDF();
            });
        }

        // Excel Export button
        const exportExcelBtn = document.getElementById('exportExcelBtn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => {
                this.exportToExcel();
            });
        }

        // CSV Export button
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                this.exportCSV();
            });
        }

        // Temperature unit toggle (Header)
        const tempUnitCelsius = document.getElementById('tempUnitCelsius');
        const tempUnitFahrenheit = document.getElementById('tempUnitFahrenheit');

        if (tempUnitCelsius) {
            tempUnitCelsius.addEventListener('click', () => {
                this.setTempUnit('C');
            });
        }

        if (tempUnitFahrenheit) {
            tempUnitFahrenheit.addEventListener('click', () => {
                this.setTempUnit('F');
            });
        }

        // Unit system toggle (Imperial/Metric)
        const unitSystemImperial = document.getElementById('unitSystemImperial');
        const unitSystemMetric = document.getElementById('unitSystemMetric');

        if (unitSystemImperial) {
            unitSystemImperial.addEventListener('click', () => {
                this.setUnitSystem('imperial');
            });
        }

        if (unitSystemMetric) {
            unitSystemMetric.addEventListener('click', () => {
                this.setUnitSystem('metric');
            });
        }

        // Settings modal close button
        const closeSettingsModal = document.getElementById('closeSettingsModal');
        const settingsModal = document.getElementById('settingsModal');

        if (closeSettingsModal) {
            closeSettingsModal.addEventListener('click', () => {
                settingsModal.classList.add('hidden');
            });
        }

        // Temperature unit options in settings modal
        const settingTempC = document.getElementById('settingTempC');
        const settingTempF = document.getElementById('settingTempF');

        if (settingTempC) {
            settingTempC.addEventListener('click', () => {
                this.setTempUnit('C');
            });
        }

        if (settingTempF) {
            settingTempF.addEventListener('click', () => {
                this.setTempUnit('F');
            });
        }

        // Save settings button
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                settingsModal.classList.add('hidden');
                window.toastManager.success('Settings saved successfully!', 'Settings Saved');
            });
        }

        // Clear projects button
        const clearProjectsBtn = document.getElementById('clearProjectsBtn');
        if (clearProjectsBtn) {
            clearProjectsBtn.addEventListener('click', () => {
                if (confirm('⚠️ WARNING: Delete ALL Projects?\n\nThis will permanently delete all your saved projects. This action cannot be undone.\n\nAre you absolutely sure?')) {
                    this.projects = [];
                    localStorage.removeItem('xyloclime_projects');
                    this.loadSavedProjects();
                    this.updateSettingsInfo();
                    window.toastManager.success('All projects have been deleted', 'Projects Cleared');
                }
            });
        }

        // Project selector dropdown
        const projectSelector = document.getElementById('projectSelector');
        if (projectSelector) {
            projectSelector.addEventListener('change', (e) => {
                const value = e.target.value;
                if (value === 'new') {
                    this.showSetupPanel();
                } else if (value) {
                    this.loadProject(value);
                }
            });
        }

        // Notifications button
        const notificationsBtn = document.getElementById('notificationsBtn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                alert('Notifications:\n\n✓ System is running normally\n✓ All data saved locally\n✓ No issues detected\n\nNote: Real-time notifications coming in future version!');
            });
        }

        // User menu button
        const userMenuBtn = document.getElementById('userMenuBtn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => {
                const acceptance = this.termsManager.getAcceptance();
                const acceptDate = acceptance ? new Date(acceptance.timestamp).toLocaleString() : 'Unknown';
                const projectCount = this.projects.length;

                alert(`USER SESSION INFO\n\n` +
                      `Session ID: ${this.sessionManager.sessionId.substring(0, 8)}...\n` +
                      `Terms Accepted: ${acceptDate}\n` +
                      `Projects Saved: ${projectCount}\n` +
                      `Temperature Unit: °${this.tempUnit}\n` +
                      `Storage Used: ~${this.getStorageSize()}KB\n\n` +
                      `Click Settings (⚙️) to manage preferences.`);
            });
        }

        // Advanced Calculator Modal
        const openAdvancedCalc = document.getElementById('openAdvancedCalc');
        if (openAdvancedCalc) {
            openAdvancedCalc.addEventListener('click', () => {
                this.openAdvancedCalculator();
            });
        }

        const closeAdvancedCalc = document.getElementById('closeAdvancedCalc');
        if (closeAdvancedCalc) {
            closeAdvancedCalc.addEventListener('click', () => {
                document.getElementById('advancedCalcModal').classList.add('hidden');
            });
        }

        const calculateWorkableDaysBtn = document.getElementById('calculateWorkableDays');
        if (calculateWorkableDaysBtn) {
            calculateWorkableDaysBtn.addEventListener('click', () => {
                this.calculateWorkableDays();
            });
        }

        const saveTemplate = document.getElementById('saveTemplate');
        if (saveTemplate) {
            saveTemplate.addEventListener('click', () => {
                this.saveWorkableTemplate();
            });
        }

        // Compare Projects Modal
        const openCompareProjects = document.getElementById('openCompareProjects');
        if (openCompareProjects) {
            openCompareProjects.addEventListener('click', () => {
                this.openCompareProjects();
            });
        }

        const closeCompareProjects = document.getElementById('closeCompareProjects');
        if (closeCompareProjects) {
            closeCompareProjects.addEventListener('click', () => {
                document.getElementById('compareProjectsModal').classList.add('hidden');
            });
        }

        const runComparison = document.getElementById('runComparison');
        if (runComparison) {
            runComparison.addEventListener('click', () => {
                this.runProjectComparison();
            });
        }
    }

    getStorageSize() {
        try {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key) && key.startsWith('xyloclime_')) {
                    total += localStorage[key].length + key.length;
                }
            }
            return Math.round(total / 1024); // Convert to KB
        } catch (error) {
            return 0;
        }
    }

    openCostCalculator() {
        if (!this.currentProject) {
            window.toastManager.info('Create a project first by clicking "Analyze Weather Data"', 'No Project Selected');
            return;
        }

        const analysis = this.currentProject.analysis;

        // Populate day counts
        document.getElementById('rainyDaysCount').textContent = analysis.rainyDays || 0;
        document.getElementById('snowDaysCount').textContent = analysis.snowyDays || 0;
        document.getElementById('freezingDaysCount').textContent = analysis.freezingDays || 0;
        document.getElementById('heatDaysCount').textContent = analysis.extremeHeatDays || 0;
        document.getElementById('windDaysCount').textContent = 'N/A'; // Wind direction data not available from API

        const start = new Date(this.currentProject.startDate);
        const end = new Date(this.currentProject.endDate);
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        document.getElementById('totalDays').textContent = totalDays;

        // Show modal
        document.getElementById('costCalculatorModal').classList.remove('hidden');
    }

    calculateProjectCosts() {
        const analysis = this.currentProject.analysis;

        // Get cost inputs
        const costRainy = parseFloat(document.getElementById('costRainyDay').value) || 0;
        const costSnow = parseFloat(document.getElementById('costSnowDay').value) || 0;
        const costFreezing = parseFloat(document.getElementById('costFreezingDay').value) || 0;
        const costHeat = parseFloat(document.getElementById('costHeatDay').value) || 0;
        const costWind = parseFloat(document.getElementById('costHighWindDay').value) || 0;
        const costLabor = parseFloat(document.getElementById('costLaborDay').value) || 0;

        // Calculate costs
        const rainyDays = analysis.rainyDays || 0;
        const snowDays = analysis.snowyDays || 0;
        const freezeDays = analysis.freezingDays || 0;
        const heatDays = analysis.extremeHeatDays || 0;
        const windDays = 0; // Wind direction data not available from API

        const rainyTotal = rainyDays * costRainy;
        const snowTotal = snowDays * costSnow;
        const freezeTotal = freezeDays * costFreezing;
        const heatTotal = heatDays * costHeat;
        const windTotal = windDays * costWind;

        const start = new Date(this.currentProject.startDate);
        const end = new Date(this.currentProject.endDate);
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const laborTotal = totalDays * costLabor;

        const weatherTotal = rainyTotal + snowTotal + freezeTotal + heatTotal + windTotal;
        const grandTotal = weatherTotal + laborTotal;

        // Display results
        document.getElementById('totalWeatherCost').textContent = `$${weatherTotal.toLocaleString()}`;
        document.getElementById('totalLaborCost').textContent = `$${laborTotal.toLocaleString()}`;
        document.getElementById('grandTotalCost').textContent = `$${grandTotal.toLocaleString()}`;

        // Breakdown
        document.getElementById('rainyCalc').textContent = `${rainyDays} × $${costRainy.toLocaleString()}`;
        document.getElementById('rainyTotal').textContent = `$${rainyTotal.toLocaleString()}`;

        document.getElementById('snowCalc').textContent = `${snowDays} × $${costSnow.toLocaleString()}`;
        document.getElementById('snowTotal').textContent = `$${snowTotal.toLocaleString()}`;

        document.getElementById('freezeCalc').textContent = `${freezeDays} × $${costFreezing.toLocaleString()}`;
        document.getElementById('freezeTotal').textContent = `$${freezeTotal.toLocaleString()}`;

        document.getElementById('heatCalc').textContent = `${heatDays} × $${costHeat.toLocaleString()}`;
        document.getElementById('heatTotal').textContent = `$${heatTotal.toLocaleString()}`;

        document.getElementById('windCalc').textContent = `${windDays} × $${costWind.toLocaleString()}`;
        document.getElementById('windTotal').textContent = `$${windTotal.toLocaleString()}`;

        // Recommendations
        const recs = [];
        if (snowTotal > 10000) recs.push('High snow impact expected ($' + snowTotal.toLocaleString() + '). Consider winter construction methods.');
        if (rainyTotal > 15000) recs.push('Significant rain delays anticipated ($' + rainyTotal.toLocaleString() + '). Plan weather-protected areas.');
        if (analysis.optimalDays > 180) recs.push(`Excellent! ${analysis.optimalDays} optimal days. Schedule critical work during these periods.`);
        if (windTotal > 5000) recs.push('Wind costs significant ($' + windTotal.toLocaleString() + '). Avoid crane ops on high-wind days.');
        if (recs.length === 0) recs.push('Weather conditions appear favorable for construction. Monitor forecasts regularly.');

        document.getElementById('costRecommendations').innerHTML = '<ul>' + recs.map(r => `<li>${r}</li>`).join('') + '</ul>';

        // Show results
        document.getElementById('costResults').classList.remove('hidden');
    }

    // ========================================================================
    // ADVANCED WORKABLE DAYS CALCULATOR
    // ========================================================================

    openAdvancedCalculator() {
        if (!this.currentProject) {
            window.toastManager.info('Create a project first by clicking "Analyze Weather Data"', 'No Project Selected');
            return;
        }

        if (!this.weatherData || !Array.isArray(this.weatherData)) {
            window.toastManager.warning('Weather data is not available. Please run the analysis again.', 'Data Not Available');
            return;
        }

        console.log('[ADVANCED CALC] Opening Advanced Workable Days Calculator');

        // Update temperature unit display in the form
        document.querySelectorAll('.temp-unit-display').forEach(el => {
            el.textContent = this.tempUnit;
        });

        // Set default thresholds based on current unit
        const minTempInput = document.getElementById('minTempThreshold');
        const maxTempInput = document.getElementById('maxTempThreshold');

        if (this.tempUnit === 'C') {
            minTempInput.value = minTempInput.value == 32 ? 0 : minTempInput.value;
            maxTempInput.value = maxTempInput.value == 95 ? 35 : maxTempInput.value;
        } else {
            minTempInput.value = minTempInput.value == 0 ? 32 : minTempInput.value;
            maxTempInput.value = maxTempInput.value == 35 ? 95 : maxTempInput.value;
        }

        // Hide results initially
        document.getElementById('advancedCalcResults').classList.add('hidden');

        // Load saved templates
        this.loadSavedTemplates();

        // Show modal
        document.getElementById('advancedCalcModal').classList.remove('hidden');
    }

    calculateWorkableDays() {
        console.log('[ADVANCED CALC] Calculating workable days with custom criteria');

        // Get user-defined criteria
        const criteria = {
            maxRain: parseFloat(document.getElementById('maxRainThreshold').value) || 5,
            maxWind: parseFloat(document.getElementById('maxWindThreshold').value) || 50,
            minTemp: parseFloat(document.getElementById('minTempThreshold').value) || 0,
            maxTemp: parseFloat(document.getElementById('maxTempThreshold').value) || 35,
            maxSnow: parseFloat(document.getElementById('maxSnowThreshold').value) || 2,
            consecutiveDays: parseInt(document.getElementById('consecutiveDays').value) || 1
        };

        // Convert temperature thresholds to Celsius if user has Fahrenheit selected
        if (this.tempUnit === 'F') {
            criteria.minTemp = (criteria.minTemp - 32) * 5 / 9;
            criteria.maxTemp = (criteria.maxTemp - 32) * 5 / 9;
        }

        console.log('[ADVANCED CALC] Criteria:', criteria);

        // Process all daily data
        const dailyResults = [];
        const projectStart = new Date(this.currentProject.startDate);
        const projectEnd = new Date(this.currentProject.endDate);

        this.weatherData.forEach(yearData => {
            const daily = yearData.data.daily;
            if (!daily || !daily.time) return;

            daily.time.forEach((dateStr, index) => {
                const date = new Date(dateStr);

                // Only process dates within project range
                if (date < projectStart || date > projectEnd) return;

                const temp_max = daily.temperature_2m_max?.[index];
                const temp_min = daily.temperature_2m_min?.[index];
                const precip = daily.precipitation_sum?.[index] || 0;
                const snow = daily.snowfall_sum?.[index] || 0;
                const wind = daily.windspeed_10m_max?.[index] || 0;

                // Check if day is workable based on criteria
                let isWorkable = true;
                const reasons = [];

                if (precip > criteria.maxRain) {
                    isWorkable = false;
                    reasons.push(`Rain: ${this.formatPrecip(precip)}`);
                }

                if (snow / 10 > criteria.maxSnow) { // Convert mm to cm
                    isWorkable = false;
                    reasons.push(`Snow: ${this.formatSnow(snow / 10)}`);
                }

                if (wind > criteria.maxWind) {
                    isWorkable = false;
                    reasons.push(`Wind: ${this.formatWind(wind)}`);
                }

                if (temp_max != null && temp_max > criteria.maxTemp) {
                    isWorkable = false;
                    const displayTemp = this.convertTemp(temp_max, 'C');
                    reasons.push(`Too hot: ${displayTemp.toFixed(0)}°${this.tempUnit}`);
                }

                if (temp_min != null && temp_min < criteria.minTemp) {
                    isWorkable = false;
                    const displayTemp = this.convertTemp(temp_min, 'C');
                    reasons.push(`Too cold: ${displayTemp.toFixed(0)}°${this.tempUnit}`);
                }

                dailyResults.push({
                    date: dateStr,
                    isWorkable,
                    reasons: reasons.join(', ')
                });
            });
        });

        // Sort by date
        dailyResults.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate statistics
        const totalDays = dailyResults.length;
        const workableDays = dailyResults.filter(d => d.isWorkable).length;
        const unworkableDays = totalDays - workableDays;
        const workablePercentage = totalDays > 0 ? ((workableDays / totalDays) * 100).toFixed(1) : 0;

        // Find longest consecutive workable streak
        let longestStreak = 0;
        let currentStreak = 0;

        dailyResults.forEach(day => {
            if (day.isWorkable) {
                currentStreak++;
                longestStreak = Math.max(longestStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        });

        console.log('[ADVANCED CALC] Results:', {
            totalDays,
            workableDays,
            unworkableDays,
            workablePercentage,
            longestStreak
        });

        // Display results
        document.getElementById('totalWorkableDays').textContent = workableDays;
        document.getElementById('totalUnworkableDays').textContent = unworkableDays;
        document.getElementById('workablePercentage').textContent = `${workablePercentage}%`;
        document.getElementById('longestWorkableStreak').textContent = longestStreak;

        // Generate timeline visualization
        this.generateWorkableTimeline(dailyResults);

        // Show results
        document.getElementById('advancedCalcResults').classList.remove('hidden');
    }

    generateWorkableTimeline(dailyResults) {
        const container = document.getElementById('workableTimeline');
        container.innerHTML = '<h4><i class="fas fa-calendar"></i> Daily Timeline</h4>';

        // Group by month
        const monthGroups = {};
        dailyResults.forEach(day => {
            const date = new Date(day.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthGroups[monthKey]) {
                monthGroups[monthKey] = [];
            }
            monthGroups[monthKey].push(day);
        });

        // Create timeline HTML
        Object.keys(monthGroups).sort().forEach(monthKey => {
            const days = monthGroups[monthKey];
            const [year, month] = monthKey.split('-');
            const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

            const monthDiv = document.createElement('div');
            monthDiv.className = 'timeline-month';
            monthDiv.innerHTML = `<div class="timeline-month-label">${monthName}</div><div class="timeline-days"></div>`;

            const daysContainer = monthDiv.querySelector('.timeline-days');
            days.forEach(day => {
                const date = new Date(day.date);
                const dayDiv = document.createElement('div');
                dayDiv.className = `timeline-day ${day.isWorkable ? 'workable' : 'unworkable'}`;
                dayDiv.title = `${date.toLocaleDateString()}: ${day.isWorkable ? 'Workable' : day.reasons}`;
                dayDiv.textContent = date.getDate();
                daysContainer.appendChild(dayDiv);
            });

            container.appendChild(monthDiv);
        });
    }

    saveWorkableTemplate() {
        const templateName = document.getElementById('templateName').value.trim();

        if (!templateName) {
            window.toastManager.warning('Please enter a template name', 'Name Required');
            return;
        }

        // Get current criteria
        const template = {
            name: templateName,
            criteria: {
                maxRain: parseFloat(document.getElementById('maxRainThreshold').value) || 5,
                maxWind: parseFloat(document.getElementById('maxWindThreshold').value) || 50,
                minTemp: parseFloat(document.getElementById('minTempThreshold').value) || 0,
                maxTemp: parseFloat(document.getElementById('maxTempThreshold').value) || 35,
                maxSnow: parseFloat(document.getElementById('maxSnowThreshold').value) || 2,
                consecutiveDays: parseInt(document.getElementById('consecutiveDays').value) || 1
            },
            tempUnit: this.tempUnit,
            created: new Date().toISOString()
        };

        // Save to localStorage
        const templates = JSON.parse(localStorage.getItem('xyloclime_workable_templates') || '[]');
        templates.push(template);
        localStorage.setItem('xyloclime_workable_templates', JSON.stringify(templates));

        console.log('[ADVANCED CALC] Template saved:', templateName);

        window.toastManager.success(`Template "${templateName}" saved successfully!`, 'Template Saved');
        document.getElementById('templateName').value = '';

        this.loadSavedTemplates();
    }

    loadSavedTemplates() {
        const templates = JSON.parse(localStorage.getItem('xyloclime_workable_templates') || '[]');
        const templatesList = document.getElementById('templatesList');

        if (templates.length === 0) {
            templatesList.innerHTML = '<p>No templates saved yet</p>';
            return;
        }

        templatesList.innerHTML = templates.map((template, index) => `
            <div class="template-item">
                <div class="template-name"><i class="fas fa-file-alt"></i> ${template.name}</div>
                <div class="template-actions">
                    <button class="btn-small" onclick="app.loadTemplate(${index})">
                        <i class="fas fa-download"></i> Load
                    </button>
                    <button class="btn-small btn-danger" onclick="app.deleteTemplate(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    loadTemplate(index) {
        const templates = JSON.parse(localStorage.getItem('xyloclime_workable_templates') || '[]');
        const template = templates[index];

        if (!template) return;

        // Load criteria into form
        document.getElementById('maxRainThreshold').value = template.criteria.maxRain;
        document.getElementById('maxWindThreshold').value = template.criteria.maxWind;
        document.getElementById('minTempThreshold').value = template.criteria.minTemp;
        document.getElementById('maxTempThreshold').value = template.criteria.maxTemp;
        document.getElementById('maxSnowThreshold').value = template.criteria.maxSnow;
        document.getElementById('consecutiveDays').value = template.criteria.consecutiveDays;

        console.log('[ADVANCED CALC] Template loaded:', template.name);
        window.toastManager.success(`Template "${template.name}" loaded!`, 'Template Applied');
    }

    deleteTemplate(index) {
        const templates = JSON.parse(localStorage.getItem('xyloclime_workable_templates') || '[]');
        const templateName = templates[index]?.name;

        if (!confirm(`Delete template "${templateName}"?`)) return;

        templates.splice(index, 1);
        localStorage.setItem('xyloclime_workable_templates', JSON.stringify(templates));

        console.log('[ADVANCED CALC] Template deleted:', templateName);
        this.loadSavedTemplates();
    }

    // ========================================================================
    // COMPARE PROJECTS
    // ========================================================================

    openCompareProjects() {
        if (this.projects.length < 2) {
            window.toastManager.info('You need at least 2 saved projects to compare. Create more projects first!', 'Not Enough Projects');
            return;
        }

        console.log('[COMPARE] Opening project comparison');

        // Populate project dropdowns
        const selectors = ['compareProject1', 'compareProject2', 'compareProject3'];
        selectors.forEach(selectorId => {
            const select = document.getElementById(selectorId);
            select.innerHTML = '<option value="">Select project...</option>';

            this.projects.forEach((project, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = project.name || `Project ${index + 1}`;
                select.appendChild(option);
            });
        });

        // Hide results initially
        document.getElementById('comparisonResults').classList.add('hidden');

        // Show modal
        document.getElementById('compareProjectsModal').classList.remove('hidden');
    }

    runProjectComparison() {
        console.log('[COMPARE] Running project comparison');

        // Get selected projects
        const project1Index = document.getElementById('compareProject1').value;
        const project2Index = document.getElementById('compareProject2').value;
        const project3Index = document.getElementById('compareProject3').value;

        if (!project1Index || !project2Index) {
            window.toastManager.warning('Please select at least 2 projects to compare', 'Selection Required');
            return;
        }

        const selectedProjects = [
            this.projects[project1Index],
            this.projects[project2Index]
        ];

        if (project3Index) {
            selectedProjects.push(this.projects[project3Index]);
        }

        console.log('[COMPARE] Comparing projects:', selectedProjects.map(p => p.name));

        // Update headers
        document.getElementById('compareHeader1').textContent = selectedProjects[0].name || 'Project 1';
        document.getElementById('compareHeader2').textContent = selectedProjects[1].name || 'Project 2';

        const header3 = document.getElementById('compareHeader3');
        if (selectedProjects[2]) {
            header3.textContent = selectedProjects[2].name || 'Project 3';
            header3.classList.remove('hidden');
        } else {
            header3.classList.add('hidden');
        }

        // Generate comparison table
        this.generateComparisonTable(selectedProjects);

        // Show results
        document.getElementById('comparisonResults').classList.remove('hidden');
    }

    generateComparisonTable(projects) {
        const tbody = document.getElementById('comparisonTableBody');
        tbody.innerHTML = '';

        // Define metrics to compare
        const metrics = [
            { label: 'Location', key: 'location' },
            { label: 'Duration', key: 'duration', format: (p) => {
                const start = new Date(p.startDate);
                const end = new Date(p.endDate);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                return `${days} days`;
            }},
            { label: 'Overall Risk', key: 'riskScore', format: (p) => this.getRiskLabel(p.analysis?.riskScore || 0) },
            { label: 'Workable Days', key: 'workableDays', format: (p) => p.analysis?.workableDays || p.analysis?.optimalDays || 0 },
            { label: 'Ideal Days', key: 'idealDays', format: (p) => p.analysis?.idealDays || 0 },
            { label: 'Rainy Days', key: 'rainyDays', format: (p) => p.analysis?.rainyDays || 0 },
            { label: 'Heavy Rain Days', key: 'heavyRainDays', format: (p) => p.analysis?.heavyRainDays || 0 },
            { label: 'Snowy Days', key: 'snowyDays', format: (p) => p.analysis?.snowyDays || 0 },
            { label: 'Freezing Days', key: 'freezingDays', format: (p) => p.analysis?.freezingDays || 0 },
            { label: 'Extreme Heat Days', key: 'extremeHeatDays', format: (p) => p.analysis?.extremeHeatDays || 0 },
            { label: 'High Wind Days', key: 'highWindDays', format: (p) => p.analysis?.highWindDays || 0 },
            { label: 'Avg Temperature', key: 'avgTemp', format: (p) => {
                const temp = p.analysis?.avgTemp;
                return temp != null ? `${this.convertTemp(temp, 'C').toFixed(1)}°${this.tempUnit}` : 'N/A';
            }},
            { label: 'Total Precipitation', key: 'totalPrecip', format: (p) => {
                const precip = p.analysis?.totalPrecipitation;
                return precip != null ? this.formatPrecip(precip) : 'N/A';
            }},
            { label: 'Created', key: 'createdAt', format: (p) => new Date(p.createdAt).toLocaleDateString() }
        ];

        // Create rows
        metrics.forEach(metric => {
            const row = document.createElement('tr');

            // Metric label
            const labelCell = document.createElement('td');
            labelCell.textContent = metric.label;
            labelCell.style.fontWeight = 'bold';
            row.appendChild(labelCell);

            // Project values
            projects.forEach((project, index) => {
                const cell = document.createElement('td');
                const value = metric.format ? metric.format(project) : project[metric.key] || 'N/A';
                cell.textContent = value;

                // Highlight best/worst for numeric metrics
                if (metric.key === 'workableDays') {
                    const allValues = projects.map(p => p.analysis?.workableDays || p.analysis?.optimalDays || 0);
                    const maxValue = Math.max(...allValues);
                    if ((project.analysis?.workableDays || project.analysis?.optimalDays || 0) === maxValue && maxValue > 0) {
                        cell.style.background = 'rgba(0, 255, 0, 0.2)';
                        cell.style.fontWeight = 'bold';
                    }
                }

                row.appendChild(cell);
            });

            // Hide third column if only 2 projects
            if (projects.length === 2) {
                const thirdCell = document.createElement('td');
                thirdCell.classList.add('hidden');
                row.appendChild(thirdCell);
            }

            tbody.appendChild(row);
        });
    }

    getRiskLabel(score) {
        if (score <= 3) return '🟢 Low Risk';
        if (score <= 6) return '🟡 Medium Risk';
        return '🔴 High Risk';
    }

    // ========================================================================
    // SETTINGS
    // ========================================================================

    openSettings() {
        const modal = document.getElementById('settingsModal');
        if (!modal) return;

        this.updateSettingsInfo();
        modal.classList.remove('hidden');
    }

    updateSettingsInfo() {
        // Update project count
        const projectCount = document.getElementById('projectCount');
        if (projectCount) {
            const count = this.projects.length;
            projectCount.textContent = `${count} project${count !== 1 ? 's' : ''}`;
        }

        // Update terms acceptance date
        const termsAcceptanceDate = document.getElementById('termsAcceptanceDate');
        if (termsAcceptanceDate) {
            const acceptance = this.termsManager.getAcceptance();
            if (acceptance && acceptance.timestamp) {
                const date = new Date(acceptance.timestamp);
                termsAcceptanceDate.textContent = date.toLocaleDateString();
            } else {
                termsAcceptanceDate.textContent = 'Not set';
            }
        }
    }

    // ========================================================================
    // WEATHER ANALYSIS
    // ========================================================================

    async analyzeWeatherData() {
        this.sessionManager.logAction('analysis_started', {});

        if (!this.selectedLocation) {
            window.toastManager.warning('Please select a location on the map or search for an address first', 'Location Required');
            return;
        }

        const projectName = document.getElementById('projectName').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        const nameValidation = this.validateProjectName(projectName);
        if (!nameValidation.valid) {
            window.toastManager.error(nameValidation.error, 'Invalid Project Name');
            return;
        }

        if (!startDate || !endDate) {
            window.toastManager.warning('Please select both start and end dates for your project', 'Dates Required');
            return;
        }

        const dateValidation = this.validateDates(startDate, endDate);
        if (!dateValidation.valid) {
            window.toastManager.error(dateValidation.error, 'Invalid Date Range');
            return;
        }

        // Show loading indicators
        const progressInterval = window.LoadingManager.showProgress();
        window.LoadingManager.setButtonLoading('analyzeBtn', true);

        this.showLoading();

        try {
            const historicalData = await this.fetchHistoricalDataForPrediction(
                this.selectedLocation.lat,
                this.selectedLocation.lng,
                startDate,
                endDate
            );

            const analysis = this.analyzeDataForPrediction(historicalData, startDate, endDate);

            this.currentProject = {
                id: Date.now().toString(),
                name: nameValidation.sanitized,
                location: this.selectedLocation,
                locationName: this.sanitizeHTML(document.getElementById('locationSearch').value || 'Selected Location'),
                startDate,
                endDate,
                createdAt: new Date().toISOString(),
                historicalData,
                analysis,
                isPrediction: true
            };

            this.saveProject(this.currentProject);
            this.weatherData = historicalData;

            // Calculate and display risk score
            const riskScore = this.calculateRiskScore(analysis);
            this.currentProject.riskScore = riskScore;
            this.updateRiskDisplay(riskScore);

            // Display data quality warnings and extreme events
            this.displayDataQualityInfo(analysis);

            this.updateDashboard(analysis);

            // Display smart recommendations (premium feature)
            this.displaySmartRecommendations(analysis, this.currentProject);

            // Load bid support calculator (premium feature)
            if (window.bidCalculator) {
                window.bidCalculator.loadProjectData(analysis, this.currentProject);
            }

            document.getElementById('setupPanel').classList.add('hidden');
            document.getElementById('dashboardPanel').classList.remove('hidden');
            document.getElementById('loadingSpinner').classList.add('hidden');

            // Hide loading indicators
            window.LoadingManager.hideProgress(progressInterval);
            window.LoadingManager.setButtonLoading('analyzeBtn', false);

            // Show success toast
            window.toastManager.success(`Weather analysis complete for "${this.currentProject.name}"`, 'Analysis Complete', 3000);

            this.sessionManager.logAction('analysis_completed', {
                projectId: this.currentProject.id
            });

        } catch (error) {
            console.error('Weather analysis failed:', error);

            // Hide loading indicators
            window.LoadingManager.hideProgress(progressInterval);
            window.LoadingManager.setButtonLoading('analyzeBtn', false);

            // Show error toast
            window.toastManager.error(`Failed to analyze weather data: ${error.message}`, 'Analysis Failed', 7000);
            this.showSetupPanel();

            this.sessionManager.logAction('analysis_failed', {
                error: error.message
            });
        }
    }

    async fetchWeatherData(lat, lng, startDate, endDate) {
        let url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,windspeed_10m_max&timezone=auto`;

        if (this.apiKey) {
            url += `&apikey=${this.apiKey}`;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please wait and try again.');
                } else if (response.status === 400) {
                    throw new Error('Invalid request parameters.');
                } else if (response.status >= 500) {
                    throw new Error('Weather API temporarily unavailable.');
                }
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            if (!data.daily) {
                throw new Error('Invalid weather data received');
            }

            return data;

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Check your internet connection.');
            }
            throw error;
        }
    }

    async fetchHistoricalDataForPrediction(lat, lng, projectStartDate, projectEndDate) {
        const yearsToFetch = 5;
        const today = new Date();
        const historicalEndYear = today.getFullYear() - 1;

        const projectStart = new Date(projectStartDate);
        const projectEnd = new Date(projectEndDate);
        const projectStartMonth = projectStart.getMonth();
        const projectStartDay = projectStart.getDate();
        const projectEndMonth = projectEnd.getMonth();
        const projectEndDay = projectEnd.getDate();

        const allYearsData = [];

        for (let i = 0; i < yearsToFetch; i++) {
            const year = historicalEndYear - i;

            let historicalStart = new Date(year, projectStartMonth, projectStartDay);
            let historicalEnd = new Date(year + (projectEnd.getFullYear() - projectStart.getFullYear()),
                projectEndMonth, projectEndDay);

            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
            if (historicalEnd > fiveDaysAgo) {
                continue;
            }

            const startDateStr = historicalStart.toISOString().split('T')[0];
            const endDateStr = historicalEnd.toISOString().split('T')[0];

            try {
                const yearData = await this.fetchWeatherData(lat, lng, startDateStr, endDateStr);
                allYearsData.push({
                    year,
                    startDate: startDateStr,
                    endDate: endDateStr,
                    data: yearData
                });
            } catch (error) {
                console.warn(`Failed to fetch data for year ${year}:`, error);
            }
        }

        if (allYearsData.length === 0) {
            throw new Error('No historical data available for analysis');
        }

        return allYearsData;
    }

    analyzeDataForPrediction(historicalData, projectStartDate, projectEndDate) {
        console.log('[ANALYSIS] Starting weather analysis with', historicalData.length, 'years of data');

        // Calculate actual project duration
        const projectStart = new Date(projectStartDate);
        const projectEnd = new Date(projectEndDate);
        const actualProjectDays = Math.ceil((projectEnd - projectStart) / (1000 * 60 * 60 * 24));

        // Process each year SEPARATELY to avoid index mismatch (BUG FIX #2)
        const yearlyStats = [];
        const allTempsMax = [];
        const allTempsMin = [];
        let dataQualityWarnings = [];

        historicalData.forEach(yearData => {
            const daily = yearData.data.daily;
            const daysInYear = daily.time.length;

            // Data quality check
            const expectedDays = actualProjectDays;
            const dataQuality = daysInYear / expectedDays;

            if (dataQuality < 0.95) {
                dataQualityWarnings.push(`Year ${yearData.year}: Only ${daysInYear}/${expectedDays} days (${(dataQuality*100).toFixed(0)}% complete)`);
                console.warn(`[DATA QUALITY] Year ${yearData.year} has incomplete data: ${(dataQuality*100).toFixed(1)}%`);
            }

            // Calculate stats for THIS YEAR (prevents index mismatch)
            const yearStats = {
                year: yearData.year,
                daysInYear: daysInYear,
                dataQuality: dataQuality,

                // Temperature stats
                avgTempMax: this.average(daily.temperature_2m_max),
                avgTempMin: this.average(daily.temperature_2m_min),

                // Precipitation stats (for THIS YEAR only - FIX BUG #3)
                totalPrecip: this.sum(daily.precipitation_sum),
                totalSnowfall: this.sum(daily.snowfall_sum),

                // Count event days for THIS YEAR
                freezingDays: daily.temperature_2m_min.filter(t => t !== null && t <= 0).length,
                rainyDays: daily.precipitation_sum.filter(p => p !== null && p > 1).length,
                heavyRainDays: daily.precipitation_sum.filter(p => p !== null && p > 10).length, // NEW: Work-stopping rain
                snowyDays: daily.snowfall_sum.filter(s => s !== null && s > 0).length,
                highWindDays: daily.windspeed_10m_max.filter(w => w !== null && w > 50).length,
                extremeHeatDays: daily.temperature_2m_max.filter(t => t !== null && t >= 37.7).length,
                extremeColdDays: daily.temperature_2m_min.filter(t => t !== null && t <= -17.7).length,

                // WORKABILITY TIERS - Three levels of work feasibility

                // Tier 1: IDEAL DAYS (renamed from "optimal")
                // Perfect conditions - no precautions needed
                // - Temp: Not freezing (>0°C) and comfortable (<37.7°C)
                // - Rain: Minimal (<5mm)
                // - Wind: Calm (<50 km/h)
                idealDays: daily.temperature_2m_max.filter((t, i) => {
                    const temp_min = daily.temperature_2m_min[i];
                    const precip = daily.precipitation_sum[i];
                    const wind = daily.windspeed_10m_max[i];
                    return t !== null && temp_min !== null && precip !== null && wind !== null &&
                           temp_min > 0 && t < 37.7 && precip < 5 && wind < 50;
                }).length,

                // Tier 2: WORKABLE DAYS (NEW - realistic construction feasibility)
                // Work can continue with normal cold-weather/rain precautions
                // - Temp: Light freezing OK (>-5°C), not extreme heat (<37°C)
                // - Rain: Light rain OK (<10mm - heavy rain stops work)
                // - Wind: Moderate winds OK (<60 km/h)
                workableDays: daily.temperature_2m_max.filter((t, i) => {
                    const temp_min = daily.temperature_2m_min[i];
                    const precip = daily.precipitation_sum[i];
                    const wind = daily.windspeed_10m_max[i];
                    return t !== null && temp_min !== null && precip !== null && wind !== null &&
                           temp_min > -5 && t < 37 && precip < 10 && wind < 60;
                }).length
            };

            yearlyStats.push(yearStats);

            // Collect all temps for overall averages
            allTempsMax.push(...daily.temperature_2m_max.filter(t => t !== null));
            allTempsMin.push(...daily.temperature_2m_min.filter(t => t !== null));
        });

        // Calculate AVERAGES across years (FIX BUG #3 - average not sum)
        const yearsCount = yearlyStats.length;
        const avgTempMax = this.average(allTempsMax);
        const avgTempMin = this.average(allTempsMin);

        // Average precipitation PER YEAR (not total of all years)
        const avgPrecipPerYear = this.average(yearlyStats.map(y => y.totalPrecip));
        const avgSnowfallPerYear = this.average(yearlyStats.map(y => y.totalSnowfall));

        // Average event days PER YEAR
        const freezingDays = Math.round(this.average(yearlyStats.map(y => y.freezingDays)));
        const rainyDays = Math.round(this.average(yearlyStats.map(y => y.rainyDays)));
        const heavyRainDays = Math.round(this.average(yearlyStats.map(y => y.heavyRainDays)));
        const snowyDays = Math.round(this.average(yearlyStats.map(y => y.snowyDays)));
        const highWindDays = Math.round(this.average(yearlyStats.map(y => y.highWindDays)));
        const extremeHeatDays = Math.round(this.average(yearlyStats.map(y => y.extremeHeatDays)));
        const extremeColdDays = Math.round(this.average(yearlyStats.map(y => y.extremeColdDays)));
        const idealDays = Math.round(this.average(yearlyStats.map(y => y.idealDays)));
        const workableDays = Math.round(this.average(yearlyStats.map(y => y.workableDays)));

        // Calculate confidence intervals (standard deviation)
        const rainyDaysStdDev = this.standardDeviation(yearlyStats.map(y => y.rainyDays));
        const precipStdDev = this.standardDeviation(yearlyStats.map(y => y.totalPrecip));

        // Detect extreme outliers
        const extremeEvents = this.detectExtremeEvents(yearlyStats);

        // Calculate overall data quality
        const avgDataQuality = this.average(yearlyStats.map(y => y.dataQuality));

        console.log('[ANALYSIS] Complete:', {
            years: yearsCount,
            avgDataQuality: `${(avgDataQuality * 100).toFixed(1)}%`,
            rainyDays: `${rainyDays} ± ${Math.round(rainyDaysStdDev)}`,
            extremeEvents: extremeEvents.length
        });

        return {
            // Temperature
            avgTempMax: avgTempMax.toFixed(1),
            avgTempMin: avgTempMin.toFixed(1),

            // Precipitation (FIXED - averaged not summed)
            totalPrecip: avgPrecipPerYear.toFixed(1),
            totalSnowfall: (avgSnowfallPerYear / 10).toFixed(1), // Convert mm to cm

            // Event days
            freezingDays,
            rainyDays,
            heavyRainDays,
            snowyDays,
            highWindDays,
            extremeHeatDays,
            extremeColdDays,

            // Workability tiers
            idealDays,
            workableDays,
            optimalDays: idealDays, // Backward compatibility - map to idealDays

            // Metadata
            yearsAnalyzed: yearsCount,
            actualProjectDays: actualProjectDays, // ADDED for risk scoring fix

            // NEW - Confidence intervals
            rainyDaysMin: Math.max(0, Math.round(rainyDays - rainyDaysStdDev)),
            rainyDaysMax: Math.round(rainyDays + rainyDaysStdDev),
            rainyDaysConfidence: rainyDaysStdDev,

            precipMin: Math.max(0, (avgPrecipPerYear - precipStdDev)).toFixed(1),
            precipMax: (avgPrecipPerYear + precipStdDev).toFixed(1),

            // NEW - Data quality
            dataQuality: avgDataQuality,
            dataQualityWarnings: dataQualityWarnings,

            // NEW - Extreme events
            extremeEvents: extremeEvents,

            // NEW - Yearly breakdown for transparency
            yearlyStats: yearlyStats
        };
    }

    average(arr) {
        const filtered = arr.filter(n => n !== null && !isNaN(n));
        return filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) / filtered.length : 0;
    }

    sum(arr) {
        const filtered = arr.filter(n => n !== null && !isNaN(n));
        return filtered.reduce((a, b) => a + b, 0);
    }

    standardDeviation(arr) {
        const filtered = arr.filter(n => n !== null && !isNaN(n));
        if (filtered.length === 0) return 0;

        const mean = this.average(filtered);
        const squareDiffs = filtered.map(value => Math.pow(value - mean, 2));
        const avgSquareDiff = this.average(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    }

    detectExtremeEvents(yearlyStats) {
        const extremeEvents = [];

        // Detect precipitation outliers
        const precipValues = yearlyStats.map(y => y.totalPrecip);
        const precipMean = this.average(precipValues);
        const precipStdDev = this.standardDeviation(precipValues);

        // Only calculate Z-scores if standard deviation is non-zero
        if (precipStdDev > 0) {
            yearlyStats.forEach(year => {
                const zScore = Math.abs((year.totalPrecip - precipMean) / precipStdDev);
                if (zScore > 2) { // More than 2 standard deviations
                    extremeEvents.push({
                        year: year.year,
                        type: year.totalPrecip > precipMean ? 'Extremely Wet' : 'Extremely Dry',
                        value: `${year.totalPrecip.toFixed(0)}mm precipitation`,
                        severity: zScore > 3 ? 'Critical' : 'High'
                    });
                }
            });
        }

        // Detect temperature extremes
        const heatDaysValues = yearlyStats.map(y => y.extremeHeatDays);
        const heatMean = this.average(heatDaysValues);

        yearlyStats.forEach(year => {
            if (year.extremeHeatDays > heatMean * 2 && year.extremeHeatDays > 5) {
                extremeEvents.push({
                    year: year.year,
                    type: 'Heat Wave Year',
                    value: `${year.extremeHeatDays} extreme heat days`,
                    severity: 'High'
                });
            }
        });

        // Detect extreme cold years
        const coldDaysValues = yearlyStats.map(y => y.extremeColdDays);
        const coldMean = this.average(coldDaysValues);

        yearlyStats.forEach(year => {
            if (year.extremeColdDays > coldMean * 2 && year.extremeColdDays > 5) {
                extremeEvents.push({
                    year: year.year,
                    type: 'Extreme Cold Year',
                    value: `${year.extremeColdDays} extreme cold days`,
                    severity: 'High'
                });
            }
        });

        return extremeEvents;
    }

    findHistoricalExtremes() {
        // Find absolute maximum/minimum values from the actual weather data
        if (!this.currentProject || !this.currentProject.data) {
            return null;
        }

        const data = this.currentProject.data;
        let maxTemp = -Infinity;
        let minTemp = Infinity;
        let maxPrecip = 0;
        let maxSnow = 0;
        let maxWind = 0;
        let maxTempDate = null;
        let minTempDate = null;
        let maxPrecipDate = null;
        let maxSnowDate = null;
        let maxWindDate = null;

        // Scan through all daily data
        data.daily.time.forEach((date, i) => {
            const temp_max = data.daily.temperature_2m_max[i];
            const temp_min = data.daily.temperature_2m_min[i];
            const precip = data.daily.precipitation_sum[i];
            const snow = data.daily.snowfall_sum[i];
            const wind = data.daily.windspeed_10m_max[i];

            if (temp_max !== null && temp_max > maxTemp) {
                maxTemp = temp_max;
                maxTempDate = date;
            }
            if (temp_min !== null && temp_min < minTemp) {
                minTemp = temp_min;
                minTempDate = date;
            }
            if (precip !== null && precip > maxPrecip) {
                maxPrecip = precip;
                maxPrecipDate = date;
            }
            if (snow !== null && snow > maxSnow) {
                maxSnow = snow;
                maxSnowDate = date;
            }
            if (wind !== null && wind > maxWind) {
                maxWind = wind;
                maxWindDate = date;
            }
        });

        console.log('[EXTREMES] Historical maximums found:', {
            maxTemp: `${maxTemp}°C on ${maxTempDate}`,
            minTemp: `${minTemp}°C on ${minTempDate}`,
            maxPrecip: `${maxPrecip}mm on ${maxPrecipDate}`
        });

        return {
            maxTemp,
            minTemp,
            maxPrecip,
            maxSnow,
            maxWind,
            maxTempDate,
            minTempDate,
            maxPrecipDate,
            maxSnowDate,
            maxWindDate
        };
    }

    // ========================================================================
    // QUALITY ASSURANCE & VALIDATION SYSTEM
    // ========================================================================

    validateReport(project) {
        // Comprehensive QA validation of weather report data
        // Returns structured assessment with pass/fail verdicts and recommendations

        if (!project || !project.analysis) {
            return {
                verdict: 'Unrealistic',
                reason: 'No project or analysis data available',
                findings: {}
            };
        }

        const analysis = project.analysis;
        const totalDays = analysis.actualProjectDays || 365;

        console.log('[QA] Starting report validation...');

        // Results containers
        const findings = {
            internalConsistency: [],
            regionalRealism: [],
            missingData: [],
            impossibleValues: []
        };

        let criticalIssues = 0;
        let warnings = 0;

        // ===== INTERNAL CONSISTENCY CHECKS =====

        // Check 1: Workable days >= Ideal days (by definition)
        const workableDays = analysis.workableDays || analysis.optimalDays || 0;
        const idealDays = analysis.idealDays || analysis.optimalDays || 0;

        if (idealDays > workableDays) {
            findings.internalConsistency.push({
                status: '✗',
                issue: `Ideal days (${idealDays}) exceeds workable days (${workableDays})`,
                severity: 'CRITICAL',
                fix: 'Ideal days should always be ≤ workable days by definition'
            });
            criticalIssues++;
        } else {
            findings.internalConsistency.push({
                status: '✓',
                note: `Workable days (${workableDays}) ≥ Ideal days (${idealDays})`
            });
        }

        // Check 2: Sum of day categories <= total project days
        const rainyDays = parseInt(analysis.rainyDays) || 0;
        const snowyDays = parseInt(analysis.snowyDays) || 0;
        const freezingDays = parseInt(analysis.freezingDays) || 0;
        const extremeHeatDays = parseInt(analysis.extremeHeatDays) || 0;
        const heavyRainDays = parseInt(analysis.heavyRainDays) || 0;

        // Heavy rain days should be subset of rainy days
        if (heavyRainDays > rainyDays) {
            findings.internalConsistency.push({
                status: '✗',
                issue: `Heavy rain days (${heavyRainDays}) exceeds total rainy days (${rainyDays})`,
                severity: 'CRITICAL',
                fix: 'Heavy rain is a subset of all rainy days'
            });
            criticalIssues++;
        } else {
            findings.internalConsistency.push({
                status: '✓',
                note: `Heavy rain days (${heavyRainDays}) ≤ Rainy days (${rainyDays})`
            });
        }

        // Check 3: Workable + Challenging days should roughly equal total
        const workablePercent = Math.round((workableDays / totalDays) * 100);
        if (workableDays > totalDays) {
            findings.internalConsistency.push({
                status: '✗',
                issue: `Workable days (${workableDays}) exceeds project duration (${totalDays})`,
                severity: 'CRITICAL',
                fix: 'Calculation error in workable days'
            });
            criticalIssues++;
        } else if (workablePercent < 20) {
            findings.internalConsistency.push({
                status: '⚠',
                note: `Very low workable percentage (${workablePercent}%)`,
                severity: 'WARNING',
                context: 'This may be realistic for extreme winter projects'
            });
            warnings++;
        } else {
            findings.internalConsistency.push({
                status: '✓',
                note: `Workable days percentage (${workablePercent}%) is realistic`
            });
        }

        // Check 4: Temperature range sanity
        const avgTempMin = parseFloat(analysis.avgTempMin);
        const avgTempMax = parseFloat(analysis.avgTempMax);

        if (avgTempMin > avgTempMax) {
            findings.internalConsistency.push({
                status: '✗',
                issue: `Min temp (${avgTempMin}°C) > Max temp (${avgTempMax}°C)`,
                severity: 'CRITICAL',
                fix: 'Temperature calculation error'
            });
            criticalIssues++;
        } else if ((avgTempMax - avgTempMin) < 5) {
            findings.internalConsistency.push({
                status: '⚠',
                note: `Small daily temperature range (${(avgTempMax - avgTempMin).toFixed(1)}°C)`,
                severity: 'WARNING',
                context: 'Typical range is 10-15°C'
            });
            warnings++;
        } else {
            findings.internalConsistency.push({
                status: '✓',
                note: `Temperature range (${(avgTempMax - avgTempMin).toFixed(1)}°C) is normal`
            });
        }

        // Check 5: Years analyzed should be reasonable
        const yearsAnalyzed = analysis.yearsAnalyzed || 0;
        if (yearsAnalyzed < 3) {
            findings.internalConsistency.push({
                status: '⚠',
                note: `Low data coverage (${yearsAnalyzed} years)`,
                severity: 'WARNING',
                context: 'Recommend 8-10 years for statistical confidence'
            });
            warnings++;
        } else if (yearsAnalyzed >= 8) {
            findings.internalConsistency.push({
                status: '✓',
                note: `Good data coverage (${yearsAnalyzed} years)`
            });
        } else {
            findings.internalConsistency.push({
                status: '✓',
                note: `Adequate data coverage (${yearsAnalyzed} years)`
            });
        }

        // ===== REGIONAL REALISM CHECKS =====

        // Check latitude-based temperature sanity
        const latitude = project.latitude;
        const avgTemp = (avgTempMin + avgTempMax) / 2;

        // Define expected temperature ranges by latitude (very rough estimates)
        let tempRangeExpected = { min: -50, max: 50 }; // Default wide range

        if (Math.abs(latitude) < 23.5) {
            // Tropical (between tropics)
            tempRangeExpected = { min: 15, max: 40 };
        } else if (Math.abs(latitude) < 40) {
            // Subtropical
            tempRangeExpected = { min: -10, max: 45 };
        } else if (Math.abs(latitude) < 60) {
            // Temperate
            tempRangeExpected = { min: -30, max: 40 };
        } else {
            // Polar/Subpolar
            tempRangeExpected = { min: -50, max: 25 };
        }

        if (avgTemp < tempRangeExpected.min || avgTemp > tempRangeExpected.max) {
            findings.regionalRealism.push({
                status: '⚠',
                note: `Avg temp ${avgTemp.toFixed(1)}°C outside typical range for latitude ${latitude.toFixed(1)}°`,
                severity: 'WARNING',
                context: `Expected range: ${tempRangeExpected.min}°C to ${tempRangeExpected.max}°C`
            });
            warnings++;
        } else {
            findings.regionalRealism.push({
                status: '✓',
                note: `Temperature realistic for latitude ${latitude.toFixed(1)}°`
            });
        }

        // Check precipitation realism
        const totalPrecip = parseFloat(analysis.totalPrecip) || 0;
        const precipPerDay = totalPrecip / totalDays;

        // Extreme precipitation check
        if (totalPrecip > 3000) {
            // >3000mm/year is extremely wet (rainforest level)
            findings.regionalRealism.push({
                status: '⚠',
                note: `Very high precipitation (${totalPrecip.toFixed(0)}mm)`,
                severity: 'WARNING',
                context: 'This is rainforest-level precipitation - verify location'
            });
            warnings++;
        } else if (totalPrecip > 2000) {
            findings.regionalRealism.push({
                status: '✓',
                note: `High but realistic precipitation (${totalPrecip.toFixed(0)}mm)`
            });
        } else if (totalPrecip < 100 && totalDays > 300) {
            // Less than 100mm per year is extremely arid
            findings.regionalRealism.push({
                status: '⚠',
                note: `Very low precipitation (${totalPrecip.toFixed(0)}mm)`,
                severity: 'WARNING',
                context: 'Desert-level aridity - verify location'
            });
            warnings++;
        } else {
            findings.regionalRealism.push({
                status: '✓',
                note: `Precipitation realistic (${totalPrecip.toFixed(0)}mm)`
            });
        }

        // Check rainy days vs precipitation total consistency
        if (rainyDays > 0) {
            const avgPrecipPerRainyDay = totalPrecip / rainyDays;
            if (avgPrecipPerRainyDay > 100) {
                findings.regionalRealism.push({
                    status: '⚠',
                    note: `High precipitation per rainy day (${avgPrecipPerRainyDay.toFixed(1)}mm)`,
                    severity: 'WARNING',
                    context: 'Suggests very intense rainfall events - typical for tropical storms'
                });
                warnings++;
            } else if (avgPrecipPerRainyDay < 1 && rainyDays > 50) {
                findings.regionalRealism.push({
                    status: '⚠',
                    note: `Low precipitation per rainy day (${avgPrecipPerRainyDay.toFixed(1)}mm)`,
                    severity: 'WARNING',
                    context: 'Many rainy days but little total rain - verify data'
                });
                warnings++;
            } else {
                findings.regionalRealism.push({
                    status: '✓',
                    note: `Average rain per rainy day (${avgPrecipPerRainyDay.toFixed(1)}mm) is normal`
                });
            }
        }

        // Check freezing days vs latitude
        if (Math.abs(latitude) < 25 && freezingDays > 10) {
            findings.regionalRealism.push({
                status: '⚠',
                note: `Unusual: ${freezingDays} freezing days at tropical latitude ${latitude.toFixed(1)}°`,
                severity: 'WARNING',
                context: 'Verify elevation - may be high altitude location'
            });
            warnings++;
        } else if (Math.abs(latitude) > 55 && freezingDays === 0 && totalDays > 300) {
            findings.regionalRealism.push({
                status: '⚠',
                note: `Unusual: No freezing days at high latitude ${latitude.toFixed(1)}°`,
                severity: 'WARNING',
                context: 'Verify season - may be summer-only project'
            });
            warnings++;
        } else {
            findings.regionalRealism.push({
                status: '✓',
                note: `Freezing days (${freezingDays}) realistic for latitude ${latitude.toFixed(1)}°`
            });
        }

        // ===== MISSING OR WEAK DATA CHECKS =====

        // Check for essential metrics
        if (!analysis.avgTempMax || !analysis.avgTempMin) {
            findings.missingData.push('Temperature data incomplete');
        }

        if (!analysis.totalPrecip || analysis.totalPrecip === '0.0') {
            findings.missingData.push('Precipitation data missing or zero');
        }

        if (!analysis.workableDays && !analysis.optimalDays) {
            findings.missingData.push('Workability analysis missing');
        }

        if (!analysis.yearsAnalyzed || analysis.yearsAnalyzed < 1) {
            findings.missingData.push('Historical data years not recorded');
            criticalIssues++;
        }

        // Check for enhanced metrics
        if (!analysis.heavyRainDays && rainyDays > 0) {
            findings.missingData.push('Heavy rain days not calculated (recommend adding)');
        }

        if (!analysis.highWindDays) {
            findings.missingData.push('High wind days not calculated (recommend adding)');
        }

        if (!analysis.extremeEvents || analysis.extremeEvents.length === 0) {
            findings.missingData.push('No extreme events detected (may need more historical data)');
        }

        // ===== IMPOSSIBLE VALUES CHECKS =====

        // Check for negative values that should be positive
        if (workableDays < 0 || idealDays < 0 || rainyDays < 0 || snowyDays < 0) {
            findings.impossibleValues.push({
                status: '✗',
                issue: 'Negative day counts detected',
                severity: 'CRITICAL',
                fix: 'Check calculation logic'
            });
            criticalIssues++;
        }

        if (totalPrecip < 0 || analysis.totalSnowfall < 0) {
            findings.impossibleValues.push({
                status: '✗',
                issue: 'Negative precipitation values detected',
                severity: 'CRITICAL',
                fix: 'Check data processing'
            });
            criticalIssues++;
        }

        // Check for extreme outliers
        const extremes = this.findHistoricalExtremes();
        if (extremes) {
            if (extremes.maxTemp > 60 || extremes.maxTemp < -273) {
                findings.impossibleValues.push({
                    status: '✗',
                    issue: `Impossible max temperature: ${extremes.maxTemp}°C`,
                    severity: 'CRITICAL',
                    fix: 'Data corruption or unit conversion error'
                });
                criticalIssues++;
            }

            if (extremes.minTemp < -90 || extremes.minTemp > 60) {
                findings.impossibleValues.push({
                    status: '✗',
                    issue: `Impossible min temperature: ${extremes.minTemp}°C`,
                    severity: 'CRITICAL',
                    fix: 'Data corruption or unit conversion error'
                });
                criticalIssues++;
            }

            if (extremes.maxPrecip > 1000) {
                // >1000mm in a single day is extremely rare
                findings.impossibleValues.push({
                    status: '⚠',
                    issue: `Extreme daily precipitation: ${extremes.maxPrecip}mm`,
                    severity: 'WARNING',
                    context: 'Verify this extreme event (tropical storm level)'
                });
                warnings++;
            }
        }

        // ===== DETERMINE OVERALL VERDICT =====

        let verdict = 'Pass';
        let verdictReason = 'Report passes all critical checks';

        if (criticalIssues > 0) {
            verdict = 'Unrealistic';
            verdictReason = `${criticalIssues} critical issue(s) detected - report not suitable for use`;
        } else if (warnings > 3) {
            verdict = 'Needs Review';
            verdictReason = `${warnings} warning(s) detected - manual review recommended`;
        } else if (warnings > 0) {
            verdict = 'Pass';
            verdictReason = `Passes with ${warnings} minor warning(s)`;
        }

        // ===== GENERATE RECOMMENDATIONS =====

        const recommendations = [];

        if (findings.missingData.length > 0) {
            recommendations.push('Add missing metrics: ' + findings.missingData.join(', '));
        }

        if (yearsAnalyzed < 8) {
            recommendations.push('Increase historical data coverage to 8-10 years for better statistical confidence');
        }

        if (workablePercent < 50 && criticalIssues === 0) {
            recommendations.push('Low workability - consider adding ENSO/climate pattern context for this region');
        }

        if (!analysis.dataQuality || analysis.dataQuality < 0.9) {
            recommendations.push('Data quality below 90% - some days missing weather observations');
        }

        if (warnings > 2 && criticalIssues === 0) {
            recommendations.push('Multiple warnings detected - recommend manual review of regional climate norms');
        }

        if (recommendations.length === 0 && verdict === 'Pass') {
            recommendations.push('No improvements needed - report is comprehensive and accurate');
        }

        // ===== COMPILE FINAL REPORT =====

        const qaReport = {
            verdict,
            verdictReason,
            summary: {
                criticalIssues,
                warnings,
                checks: findings.internalConsistency.length + findings.regionalRealism.length,
                passed: findings.internalConsistency.filter(f => f.status === '✓').length +
                        findings.regionalRealism.filter(f => f.status === '✓').length
            },
            findings: {
                internalConsistency: findings.internalConsistency,
                regionalRealism: findings.regionalRealism,
                missingData: findings.missingData,
                impossibleValues: findings.impossibleValues
            },
            recommendations,
            timestamp: new Date().toISOString(),
            projectName: project.name,
            location: project.locationName,
            dateRange: `${project.startDate} to ${project.endDate}`
        };

        console.log('[QA] Validation complete:', verdict, '-', verdictReason);
        console.log('[QA] Critical issues:', criticalIssues, '| Warnings:', warnings);

        return qaReport;
    }

    // Format QA report as readable text
    formatQAReport(qaReport) {
        let output = [];

        output.push('═══════════════════════════════════════════════════════════');
        output.push('  XYLOCLIME PRO - WEATHER REPORT QUALITY ASSURANCE');
        output.push('═══════════════════════════════════════════════════════════');
        output.push('');
        output.push(`Project: ${qaReport.projectName}`);
        output.push(`Location: ${qaReport.location}`);
        output.push(`Date Range: ${qaReport.dateRange}`);
        output.push(`QA Timestamp: ${new Date(qaReport.timestamp).toLocaleString()}`);
        output.push('');
        output.push('───────────────────────────────────────────────────────────');
        output.push(`SUMMARY VERDICT: ${qaReport.verdict}`);
        output.push('───────────────────────────────────────────────────────────');
        output.push(qaReport.verdictReason);
        output.push('');
        output.push(`✓ Checks Passed: ${qaReport.summary.passed}/${qaReport.summary.checks}`);
        output.push(`⚠ Warnings: ${qaReport.summary.warnings}`);
        output.push(`✗ Critical Issues: ${qaReport.summary.criticalIssues}`);
        output.push('');

        // Internal Consistency
        output.push('───────────────────────────────────────────────────────────');
        output.push('INTERNAL CONSISTENCY FINDINGS:');
        output.push('───────────────────────────────────────────────────────────');
        qaReport.findings.internalConsistency.forEach(finding => {
            if (finding.issue) {
                output.push(`${finding.status} ${finding.issue}`);
                if (finding.fix) output.push(`   → Fix: ${finding.fix}`);
                if (finding.context) output.push(`   → Context: ${finding.context}`);
            } else {
                output.push(`${finding.status} ${finding.note}`);
            }
        });
        output.push('');

        // Regional Realism
        output.push('───────────────────────────────────────────────────────────');
        output.push('REGIONAL REALISM FINDINGS:');
        output.push('───────────────────────────────────────────────────────────');
        qaReport.findings.regionalRealism.forEach(finding => {
            if (finding.issue) {
                output.push(`${finding.status} ${finding.issue}`);
                if (finding.context) output.push(`   → ${finding.context}`);
            } else {
                output.push(`${finding.status} ${finding.note}`);
                if (finding.context) output.push(`   → ${finding.context}`);
            }
        });
        output.push('');

        // Missing Data
        if (qaReport.findings.missingData.length > 0) {
            output.push('───────────────────────────────────────────────────────────');
            output.push('MISSING OR WEAK DATA:');
            output.push('───────────────────────────────────────────────────────────');
            qaReport.findings.missingData.forEach(item => {
                output.push(`• ${item}`);
            });
            output.push('');
        }

        // Impossible Values
        if (qaReport.findings.impossibleValues.length > 0) {
            output.push('───────────────────────────────────────────────────────────');
            output.push('IMPOSSIBLE VALUES DETECTED:');
            output.push('───────────────────────────────────────────────────────────');
            qaReport.findings.impossibleValues.forEach(finding => {
                output.push(`${finding.status} ${finding.issue}`);
                if (finding.fix) output.push(`   → Fix: ${finding.fix}`);
                if (finding.context) output.push(`   → Context: ${finding.context}`);
            });
            output.push('');
        }

        // Recommendations
        output.push('───────────────────────────────────────────────────────────');
        output.push('RECOMMENDATIONS FOR IMPROVEMENT:');
        output.push('───────────────────────────────────────────────────────────');
        qaReport.recommendations.forEach(rec => {
            output.push(`• ${rec}`);
        });
        output.push('');
        output.push('═══════════════════════════════════════════════════════════');

        return output.join('\n');
    }

    // ========================================================================
    // RISK SCORING SYSTEM
    // ========================================================================

    calculateRiskScore(analysis) {
        // Calculate risk scores for each category (0-100 scale)

        // CRITICAL FIX: Use ACTUAL project duration, not hardcoded 365 days
        const totalDays = analysis.actualProjectDays || 365;
        console.log(`[RISK] Calculating risk for ${totalDays}-day project`);

        // 1. Precipitation Risk (30% weight)
        // More rainy/snowy days = higher risk
        const wetDays = parseInt(analysis.rainyDays) + parseInt(analysis.snowyDays);
        const wetDaysRatio = wetDays / totalDays;
        const precipRisk = Math.min(100, wetDaysRatio * 300);

        console.log(`[RISK] Precipitation: ${wetDays}/${totalDays} days (${(wetDaysRatio*100).toFixed(1)}%) = ${precipRisk.toFixed(1)} risk`);

        // 2. Temperature Risk (25% weight)
        // Extreme temps (freezing or heat) = higher risk
        const tempExtremeDays = parseInt(analysis.freezingDays) + parseInt(analysis.extremeHeatDays);
        const tempExtremeRatio = tempExtremeDays / totalDays;
        const tempRisk = Math.min(100, tempExtremeRatio * 400);

        // 3. Wind Risk (20% weight)
        // Based on workable conditions (realistic feasibility)
        const workableDays = parseInt(analysis.workableDays || analysis.optimalDays);
        const workableRatio = workableDays / totalDays;
        const windRisk = Math.max(0, 100 - (workableRatio * 200));

        // 4. Seasonal Risk (25% weight)
        // Based on overall favorable conditions (realistic feasibility)
        const favorableRatio = workableDays / totalDays;
        const seasonRisk = Math.max(0, 100 - (favorableRatio * 250));

        // Calculate weighted total score
        const totalScore = Math.round(
            (precipRisk * 0.30) +
            (tempRisk * 0.25) +
            (windRisk * 0.20) +
            (seasonRisk * 0.25)
        );

        console.log(`[RISK] Total Score: ${totalScore}/100`, {
            precip: Math.round(precipRisk),
            temp: Math.round(tempRisk),
            wind: Math.round(windRisk),
            season: Math.round(seasonRisk)
        });

        // Determine risk level
        let riskLevel, riskColor;
        if (totalScore <= 25) {
            riskLevel = 'LOW RISK';
            riskColor = '#27ae60';
        } else if (totalScore <= 50) {
            riskLevel = 'MODERATE RISK';
            riskColor = '#f39c12';
        } else if (totalScore <= 75) {
            riskLevel = 'HIGH RISK';
            riskColor = '#e67e22';
        } else {
            riskLevel = 'EXTREME RISK';
            riskColor = '#e74c3c';
        }

        // Generate recommendations based on risk factors
        const recommendations = this.generateRiskRecommendations({
            totalScore,
            precipRisk,
            tempRisk,
            windRisk,
            seasonRisk,
            analysis
        });

        return {
            totalScore,
            riskLevel,
            riskColor,
            breakdown: {
                precipitation: Math.round(precipRisk),
                temperature: Math.round(tempRisk),
                wind: Math.round(windRisk),
                seasonal: Math.round(seasonRisk)
            },
            recommendations
        };
    }

    generateRiskRecommendations(riskData) {
        const recommendations = [];
        const { totalScore, precipRisk, tempRisk, analysis } = riskData;

        // High precipitation risk
        if (precipRisk > 60) {
            recommendations.push('Consider waterproofing measures and drainage planning for frequent precipitation');
            recommendations.push(`Budget for ${analysis.rainyDays} rainy days with potential work stoppages`);
        }

        // High temperature risk
        if (tempRisk > 60) {
            if (parseInt(analysis.freezingDays) > 30) {
                recommendations.push('Plan for cold weather delays and heating requirements');
                recommendations.push('Consider insulated materials and cold-weather equipment');
            }
            if (parseInt(analysis.extremeHeatDays) > 20) {
                recommendations.push('Schedule heat-sensitive work during cooler months');
                recommendations.push('Plan for worker heat safety measures and hydration');
            }
        }

        // Overall high risk
        if (totalScore > 65) {
            recommendations.push('Add 15-25% contingency time to project schedule for weather delays');
            recommendations.push('Consider weather insurance or performance bonds');
            recommendations.push('Develop detailed weather contingency plans');
        }

        // Moderate risk
        if (totalScore > 40 && totalScore <= 65) {
            recommendations.push('Add 10-15% contingency time to project schedule');
            recommendations.push('Monitor weather forecasts closely during critical phases');
        }

        // Low risk
        if (totalScore <= 40) {
            recommendations.push('Weather conditions are generally favorable for this project');
            recommendations.push('Standard contingency planning (5-10%) should be sufficient');
        }

        // Optimal days insight
        if (parseInt(analysis.optimalDays) < 100) {
            recommendations.push(`Focus critical work during the ${analysis.optimalDays} optimal weather days identified`);
        }

        return recommendations;
    }

    updateRiskDisplay(riskScore) {
        // Update risk score card
        const riskScoreEl = document.getElementById('riskScore');
        const riskLevelEl = document.getElementById('riskLevel');

        if (riskScoreEl) {
            riskScoreEl.textContent = riskScore.totalScore;
            riskScoreEl.style.color = riskScore.riskColor;
        }

        if (riskLevelEl) {
            riskLevelEl.textContent = riskScore.riskLevel;
            riskLevelEl.style.color = riskScore.riskColor;
        }

        // Calculate relative contributions (percentages that add up to 100%)
        const precip = riskScore.breakdown.precipitation * 0.30; // weighted value
        const temp = riskScore.breakdown.temperature * 0.25;
        const wind = riskScore.breakdown.wind * 0.20;
        const seasonal = riskScore.breakdown.seasonal * 0.25;
        const total = precip + temp + wind + seasonal;

        // Calculate percentages of total risk
        const precipPercent = total > 0 ? Math.round((precip / total) * 100) : 25;
        const tempPercent = total > 0 ? Math.round((temp / total) * 100) : 25;
        const windPercent = total > 0 ? Math.round((wind / total) * 100) : 25;
        const seasonPercent = total > 0 ? Math.round((seasonal / total) * 100) : 25;

        console.log('[RISK] Relative contributions:', { precip: precipPercent, temp: tempPercent, wind: windPercent, seasonal: seasonPercent });

        // Update risk breakdown bars with relative percentages
        this.updateRiskBar('precipRiskBar', 'precipRiskScore', precipPercent);
        this.updateRiskBar('tempRiskBar', 'tempRiskScore', tempPercent);
        this.updateRiskBar('windRiskBar', 'windRiskScore', windPercent);
        this.updateRiskBar('seasonRiskBar', 'seasonRiskScore', seasonPercent);

        // Create pie chart for risk breakdown
        this.createRiskPieChart({
            precipitation: precipPercent,
            temperature: tempPercent,
            wind: windPercent,
            seasonal: seasonPercent
        });

        // Update recommendations
        const recommendationsList = document.getElementById('riskRecommendationsList');
        if (recommendationsList && riskScore.recommendations) {
            recommendationsList.innerHTML = riskScore.recommendations
                .map(rec => `<li>${this.sanitizeHTML(rec)}</li>`)
                .join('');
        }
    }

    updateRiskBar(barId, scoreId, value) {
        const bar = document.getElementById(barId);
        const score = document.getElementById(scoreId);

        if (bar) {
            bar.style.width = value + '%';
            // Use fixed colors for each risk type instead of value-based colors
            const colors = {
                precipRiskBar: 'linear-gradient(90deg, #3498db 0%, #2980b9 100%)', // Blue for precipitation
                tempRiskBar: 'linear-gradient(90deg, #e67e22 0%, #d35400 100%)',   // Orange for temperature
                windRiskBar: 'linear-gradient(90deg, #1abc9c 0%, #16a085 100%)',   // Teal for wind
                seasonRiskBar: 'linear-gradient(90deg, #9b59b6 0%, #8e44ad 100%)' // Purple for seasonal
            };
            bar.style.background = colors[barId] || 'linear-gradient(90deg, #00d4ff 0%, #0099cc 100%)';
        }

        if (score) {
            score.textContent = value + '%';
        }
    }

    createRiskPieChart(breakdown) {
        const canvas = document.getElementById('riskPieChart');
        if (!canvas) {
            console.warn('[RISK] Risk pie chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');

        // Destroy existing chart if it exists
        if (this.charts.riskPie) {
            this.charts.riskPie.destroy();
        }

        this.charts.riskPie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Precipitation', 'Temperature', 'Wind', 'Seasonal'],
                datasets: [{
                    data: [
                        breakdown.precipitation,
                        breakdown.temperature,
                        breakdown.wind,
                        breakdown.seasonal
                    ],
                    backgroundColor: [
                        '#3498db', // Blue for precipitation
                        '#e67e22', // Orange for temperature
                        '#1abc9c', // Teal for wind
                        '#9b59b6'  // Purple for seasonal
                    ],
                    borderColor: '#0a1929',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e8f4f8',
                            font: {
                                size: 12,
                                family: "'Rajdhani', sans-serif"
                            },
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(13, 27, 42, 0.95)',
                        titleColor: '#00d4ff',
                        bodyColor: '#e8f4f8',
                        borderColor: '#00d4ff',
                        borderWidth: 1,
                        padding: 12,
                        bodyFont: {
                            size: 14
                        },
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                return `${label}: ${value}% of total risk`;
                            }
                        }
                    }
                }
            }
        });

        console.log('[RISK] Pie chart created with relative contributions');
    }

    // ========================================================================
    // DATA QUALITY & WARNINGS DISPLAY
    // ========================================================================

    displayDataQualityInfo(analysis) {
        // Display data quality warnings
        const warningsContainer = document.getElementById('dataQualityWarnings');
        if (warningsContainer && analysis.dataQualityWarnings && analysis.dataQualityWarnings.length > 0) {
            const warningsHTML = `
                <div class="data-quality-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Data Quality Notice:</strong>
                    <ul>
                        ${analysis.dataQualityWarnings.map(w => `<li>${this.sanitizeHTML(w)}</li>`).join('')}
                    </ul>
                </div>
            `;
            warningsContainer.innerHTML = warningsHTML;
            warningsContainer.style.display = 'block';
        } else if (warningsContainer) {
            warningsContainer.style.display = 'none';
        }

        // Display extreme events
        const extremeEventsContainer = document.getElementById('extremeEventsInfo');
        if (extremeEventsContainer && analysis.extremeEvents && analysis.extremeEvents.length > 0) {
            const eventsHTML = `
                <div class="extreme-events-box">
                    <h4><i class="fas fa-bolt"></i> Extreme Weather Events Detected</h4>
                    <p class="extreme-events-intro">Historical data shows ${analysis.extremeEvents.length} extreme weather event(s) during this period:</p>
                    <ul class="extreme-events-list">
                        ${analysis.extremeEvents.map(event => `
                            <li class="extreme-event ${event.severity.toLowerCase()}">
                                <span class="event-year">${event.year}</span>
                                <span class="event-type">${this.sanitizeHTML(event.type)}</span>
                                <span class="event-value">${this.sanitizeHTML(event.value)}</span>
                                <span class="event-severity">${event.severity}</span>
                            </li>
                        `).join('')}
                    </ul>
                    <p class="extreme-events-note">
                        <i class="fas fa-info-circle"></i>
                        These represent statistically significant outliers. While uncommon, similar events may occur during your project period.
                    </p>
                </div>
            `;
            extremeEventsContainer.innerHTML = eventsHTML;
            extremeEventsContainer.style.display = 'block';
        } else if (extremeEventsContainer) {
            extremeEventsContainer.style.display = 'none';
        }

        // Display confidence intervals
        const confidenceContainer = document.getElementById('confidenceIntervals');
        if (confidenceContainer && analysis.rainyDaysConfidence) {
            const confidenceHTML = `
                <div class="confidence-info">
                    <h5><i class="fas fa-chart-line"></i> Statistical Confidence</h5>
                    <p>Rainy Days: ${analysis.rainyDays} (range: ${analysis.rainyDaysMin}-${analysis.rainyDaysMax})</p>
                    <p>Precipitation: ${analysis.totalPrecip}mm (range: ${analysis.precipMin}-${analysis.precipMax}mm)</p>
                    <p class="confidence-note">Based on ${analysis.yearsAnalyzed} years of historical data (${(analysis.dataQuality * 100).toFixed(0)}% complete)</p>
                </div>
            `;
            confidenceContainer.innerHTML = confidenceHTML;
            confidenceContainer.style.display = 'block';
        }

        console.log('[DATA QUALITY] Info displayed:', {
            warnings: analysis.dataQualityWarnings?.length || 0,
            extremeEvents: analysis.extremeEvents?.length || 0,
            dataQuality: `${(analysis.dataQuality * 100).toFixed(1)}%`
        });
    }

    // ========================================================================
    // CSV EXPORT
    // ========================================================================

    exportCSV() {
        if (!this.currentProject || !this.weatherData) {
            alert('Please create a project first');
            return;
        }

        try {
            const project = this.currentProject;
            const historicalData = this.weatherData;

            // Create CSV headers (unit-aware)
            const tempUnit = this.unitSystem === 'imperial' ? '°F' : '°C';
            const precipUnit = this.unitSystem === 'imperial' ? 'in' : 'mm';
            const snowUnit = this.unitSystem === 'imperial' ? 'in' : 'cm';
            const windUnit = this.unitSystem === 'imperial' ? 'mph' : 'km/h';

            const headers = [
                'Year',
                'Date',
                `Temperature Max (${tempUnit})`,
                `Temperature Min (${tempUnit})`,
                `Precipitation (${precipUnit})`,
                `Snowfall (${snowUnit})`,
                `Wind Speed (${windUnit})`
            ];

            // Create CSV rows
            const rows = [];

            // Add project info header
            rows.push([`Project: ${project.name}`]);
            rows.push([`Location: ${project.locationName}`]);
            rows.push([`Date Range: ${project.startDate} to ${project.endDate}`]);
            rows.push([`Years Analyzed: ${historicalData ? historicalData.length : 0}`]);
            rows.push([`Generated: ${new Date().toLocaleDateString()}`]);
            rows.push([]); // Empty row

            // Add column headers
            rows.push(headers);

            // Add data rows - iterate through all years
            if (historicalData && Array.isArray(historicalData)) {
                historicalData.forEach(yearData => {
                    const data = yearData.data;
                    if (data.daily && data.daily.time) {
                        data.daily.time.forEach((date, index) => {
                            const tempMax = data.daily.temperature_2m_max?.[index];
                            const tempMin = data.daily.temperature_2m_min?.[index];
                            const precip = data.daily.precipitation_sum?.[index];
                            const snow = data.daily.snowfall_sum?.[index];
                            const wind = data.daily.windspeed_10m_max?.[index];

                            // Convert values based on unit system
                            rows.push([
                                yearData.year,
                                date,
                                tempMax != null ? (this.unitSystem === 'imperial' ? this.convertTemp(tempMax, 'C').toFixed(1) : tempMax.toFixed(1)) : '',
                                tempMin != null ? (this.unitSystem === 'imperial' ? this.convertTemp(tempMin, 'C').toFixed(1) : tempMin.toFixed(1)) : '',
                                precip != null ? (this.unitSystem === 'imperial' ? this.mmToInches(precip).toFixed(2) : precip.toFixed(1)) : '',
                                snow != null ? (this.unitSystem === 'imperial' ? this.cmToInches(snow / 10).toFixed(2) : (snow / 10).toFixed(1)) : '',
                                wind != null ? (this.unitSystem === 'imperial' ? this.kmhToMph(wind).toFixed(1) : wind.toFixed(1)) : ''
                            ]);
                        });
                    }
                });
            }

            // Convert to CSV string
            const csvContent = rows
                .map(row => row.map(cell => {
                    // Escape quotes and wrap in quotes if contains comma
                    const cellStr = String(cell);
                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                        return '"' + cellStr.replace(/"/g, '""') + '"';
                    }
                    return cellStr;
                }).join(','))
                .join('\n');

            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `XyloclimePro_${project.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Show success message
            this.showToast('CSV exported successfully!', 'success');

            this.sessionManager.logAction('csv_exported', {
                projectId: project.id,
                rowCount: data.daily?.time?.length || 0
            });

        } catch (error) {
            console.error('CSV export failed:', error);
            alert('Error exporting CSV. Please try again.');
        }
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: var(--font-display);
            font-weight: 600;
            animation: slideInRight 0.3s ease-out;
        `;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            ${this.sanitizeHTML(message)}
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // ========================================================================
    // UI UPDATES
    // ========================================================================

    updateDashboard(analysis) {
        document.getElementById('projectInfoName').textContent = this.currentProject.name;
        document.getElementById('projectInfoLocation').textContent = this.currentProject.locationName;
        document.getElementById('projectInfoDates').textContent =
            `${this.currentProject.startDate} to ${this.currentProject.endDate}`;

        // Update enhanced summary cards
        const avgTemp = ((parseFloat(analysis.avgTempMax) + parseFloat(analysis.avgTempMin)) / 2);
        const el = (id) => document.getElementById(id);

        if (el('avgTemp')) el('avgTemp').textContent = this.formatTemp(avgTemp, 'C');
        if (el('avgTempMax')) el('avgTempMax').textContent = this.formatTemp(parseFloat(analysis.avgTempMax), 'C');
        if (el('avgTempMin')) el('avgTempMin').textContent = this.formatTemp(parseFloat(analysis.avgTempMin), 'C');
        if (el('rainyDays')) el('rainyDays').textContent = analysis.rainyDays;
        if (el('totalPrecip')) el('totalPrecip').textContent = this.formatPrecip(analysis.totalPrecip);
        if (el('heavyRainDays')) el('heavyRainDays').textContent = analysis.heavyRainDays;
        if (el('snowyDays')) el('snowyDays').textContent = analysis.snowyDays;
        if (el('totalSnow')) el('totalSnow').textContent = this.formatSnow(analysis.totalSnowfall);
        // Wind and humidity data not available from API - removed fake random data
        if (el('avgWind')) el('avgWind').textContent = 'N/A';
        if (el('maxWind')) el('maxWind').textContent = 'N/A';
        if (el('avgHumidity')) el('avgHumidity').textContent = 'N/A';

        // Update workability tiers
        if (el('workableDays')) el('workableDays').textContent = analysis.workableDays;
        if (el('idealDays')) el('idealDays').textContent = analysis.idealDays;
        if (el('yearsAnalyzed')) el('yearsAnalyzed').textContent = analysis.yearsAnalyzed;

        // Generate executive summary and periods
        this.generateExecutiveSummary(analysis);
        this.findBestWorstPeriods(analysis);

        this.createAllCharts();
    }

    createDailyChart() {
        const canvas = document.getElementById('dailyChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.charts.daily) {
            this.charts.daily.destroy();
        }

        // Simple example chart - enhance as needed
        this.charts.daily = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Avg Temperature (°C)',
                    data: [5, 7, 12, 18, 23, 28, 30, 29, 25, 18, 11, 6],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e8f4f8'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#8b9db8' },
                        grid: { color: 'rgba(0, 212, 255, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#8b9db8' },
                        grid: { color: 'rgba(0, 212, 255, 0.1)' }
                    }
                }
            }
        });
    }

    createAllCharts() {
        // Create charts using REAL data from API
        console.log('[CHARTS] Creating charts from actual weather data');

        this.createTemperatureChart(); // Real data from API
        this.createPrecipitationChart(); // Real data from API
        this.createWindChart(); // Real data from API
        this.createDistributionChart(); // Real data from analysis
        this.createComprehensiveChart(); // Real data from API
        this.createRadarChart(); // Real data from analysis
    }

    // Extract monthly data from historical weather data
    getMonthlyAverages() {
        if (!this.weatherData || !Array.isArray(this.weatherData)) {
            return null;
        }

        const monthlyData = {
            tempMax: new Array(12).fill(0).map(() => []),
            tempMin: new Array(12).fill(0).map(() => []),
            precip: new Array(12).fill(0).map(() => []),
            snow: new Array(12).fill(0).map(() => []),
            wind: new Array(12).fill(0).map(() => [])
        };

        // Process all years of data
        this.weatherData.forEach(yearData => {
            const daily = yearData.data.daily;
            if (!daily || !daily.time) return;

            daily.time.forEach((dateStr, index) => {
                const date = new Date(dateStr);
                const month = date.getMonth(); // 0-11

                // Collect data for this month
                if (daily.temperature_2m_max?.[index] != null) {
                    monthlyData.tempMax[month].push(daily.temperature_2m_max[index]);
                }
                if (daily.temperature_2m_min?.[index] != null) {
                    monthlyData.tempMin[month].push(daily.temperature_2m_min[index]);
                }
                if (daily.precipitation_sum?.[index] != null) {
                    monthlyData.precip[month].push(daily.precipitation_sum[index]);
                }
                if (daily.snowfall_sum?.[index] != null) {
                    monthlyData.snow[month].push(daily.snowfall_sum[index]);
                }
                if (daily.windspeed_10m_max?.[index] != null) {
                    monthlyData.wind[month].push(daily.windspeed_10m_max[index]);
                }
            });
        });

        // Calculate averages for each month
        const averages = {
            tempMax: monthlyData.tempMax.map(arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null),
            tempMin: monthlyData.tempMin.map(arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null),
            precip: monthlyData.precip.map(arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null),
            snow: monthlyData.snow.map(arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null),
            wind: monthlyData.wind.map(arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
        };

        return averages;
    }

    createTemperatureChart() {
        const canvas = document.getElementById('temperatureChart');
        if (!canvas) return;
        if (this.charts.temperature) this.charts.temperature.destroy();

        // Get REAL monthly data from API
        const monthlyData = this.getMonthlyAverages();
        if (!monthlyData) {
            console.warn('[CHART] No weather data available for temperature chart');
            return;
        }

        // Convert to user's preferred unit
        const maxTemps = monthlyData.tempMax.map(t => t != null ? this.convertTemp(t, 'C') : null);
        const minTemps = monthlyData.tempMin.map(t => t != null ? this.convertTemp(t, 'C') : null);

        this.charts.temperature = new Chart(canvas, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: `Max Temp (°${this.tempUnit})`,
                    data: maxTemps,
                    borderColor: '#ff6b35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    tension: 0.4
                }, {
                    label: `Min Temp (°${this.tempUnit})`,
                    data: minTemps,
                    borderColor: '#4dd0e1',
                    backgroundColor: 'rgba(77, 208, 225, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: { duration: 2000, easing: 'easeInOutQuart' },
                plugins: { legend: { labels: { color: '#e8f4f8' } } },
                scales: {
                    x: { ticks: { color: '#8b9db8' }, grid: { color: 'rgba(0, 212, 255, 0.1)' } },
                    y: {
                        ticks: {
                            color: '#8b9db8',
                            callback: function(value) { return value.toFixed(0); }
                        },
                        grid: { color: 'rgba(0, 212, 255, 0.1)' }
                    }
                }
            }
        });
    }

    createPrecipitationChart() {
        const canvas = document.getElementById('precipitationChart');
        if (!canvas) return;
        if (this.charts.precipitation) this.charts.precipitation.destroy();

        // Get REAL monthly data from API
        const monthlyData = this.getMonthlyAverages();
        if (!monthlyData) {
            console.warn('[CHART] No weather data available for precipitation chart');
            return;
        }

        // Convert data based on unit system
        let precipData, snowData, precipLabel, snowLabel;

        if (this.unitSystem === 'imperial') {
            // Convert mm to inches for rain
            precipData = monthlyData.precip.map(p => p != null ? this.mmToInches(p) : 0);
            // Convert mm to cm, then to inches for snow
            snowData = monthlyData.snow.map(s => s != null ? this.cmToInches(s / 10) : 0);
            precipLabel = 'Rain (in)';
            snowLabel = 'Snow (in)';
        } else {
            // Keep metric (mm for rain, cm for snow)
            precipData = monthlyData.precip;
            snowData = monthlyData.snow.map(s => s != null ? s / 10 : 0);
            precipLabel = 'Rain (mm)';
            snowLabel = 'Snow (cm)';
        }

        this.charts.precipitation = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: precipLabel,
                    data: precipData,
                    backgroundColor: 'rgba(77, 208, 225, 0.6)',
                    borderColor: '#4dd0e1',
                    borderWidth: 2
                }, {
                    label: snowLabel,
                    data: snowData,
                    backgroundColor: 'rgba(232, 244, 248, 0.6)',
                    borderColor: '#e8f4f8',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                animation: { duration: 1500, easing: 'easeOutBounce' },
                plugins: { legend: { labels: { color: '#e8f4f8' } } },
                scales: {
                    x: { ticks: { color: '#8b9db8' }, grid: { color: 'rgba(0, 212, 255, 0.1)' } },
                    y: { ticks: { color: '#8b9db8' }, grid: { color: 'rgba(0, 212, 255, 0.1)' } }
                }
            }
        });
    }

    createWindChart() {
        const canvas = document.getElementById('windChart');
        if (!canvas) return;
        if (this.charts.wind) this.charts.wind.destroy();

        // Get REAL monthly data from API
        const monthlyData = this.getMonthlyAverages();
        if (!monthlyData) {
            console.warn('[CHART] No weather data available for wind chart');
            return;
        }

        // Convert data based on unit system
        let windData, windLabel;

        if (this.unitSystem === 'imperial') {
            // Convert km/h to mph
            windData = monthlyData.wind.map(w => w != null ? this.kmhToMph(w) : 0);
            windLabel = 'Max Wind Speed (mph)';
        } else {
            // Keep metric (km/h)
            windData = monthlyData.wind;
            windLabel = 'Max Wind Speed (km/h)';
        }

        this.charts.wind = new Chart(canvas, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: windLabel,
                    data: windData,
                    borderColor: '#a0e7e5',
                    backgroundColor: 'rgba(160, 231, 229, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                animation: { duration: 2000 },
                plugins: { legend: { labels: { color: '#e8f4f8' } } },
                scales: {
                    x: { ticks: { color: '#8b9db8' }, grid: { color: 'rgba(0, 212, 255, 0.1)' } },
                    y: { ticks: { color: '#8b9db8' }, grid: { color: 'rgba(0, 212, 255, 0.1)' } }
                }
            }
        });
    }

    createDistributionChart() {
        const canvas = document.getElementById('distributionChart');
        if (!canvas) return;
        if (this.charts.distribution) this.charts.distribution.destroy();

        const analysis = this.currentProject.analysis;
        const start = new Date(this.currentProject.startDate);
        const end = new Date(this.currentProject.endDate);
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        this.charts.distribution = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Workable Days', 'Heavy Rain Days', 'Snow Days', 'Other'],
                datasets: [{
                    data: [
                        analysis.workableDays || 0,
                        analysis.heavyRainDays || 0,
                        analysis.snowyDays || 0,
                        totalDays - (analysis.workableDays || 0) - (analysis.heavyRainDays || 0) - (analysis.snowyDays || 0)
                    ],
                    backgroundColor: [
                        'rgba(0, 229, 204, 0.8)',
                        'rgba(77, 208, 225, 0.8)',
                        'rgba(232, 244, 248, 0.8)',
                        'rgba(139, 157, 184, 0.4)'
                    ],
                    borderColor: [
                        '#00e5cc',
                        '#4dd0e1',
                        '#e8f4f8',
                        '#8b9db8'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                animation: { animateRotate: true, duration: 2000 },
                plugins: {
                    legend: { labels: { color: '#e8f4f8' } }
                }
            }
        });
    }

    createComprehensiveChart() {
        const canvas = document.getElementById('comprehensiveChart');
        if (!canvas) return;
        if (this.charts.comprehensive) this.charts.comprehensive.destroy();

        // Get REAL monthly data from API
        const monthlyData = this.getMonthlyAverages();
        if (!monthlyData) {
            console.warn('[CHART] No weather data available for comprehensive chart');
            return;
        }

        // Calculate average temperature (mean of max and min)
        const avgTempData = monthlyData.tempMax.map((max, i) => {
            const min = monthlyData.tempMin[i];
            if (max != null && min != null) {
                const avgC = (max + min) / 2;
                return this.convertTemp(avgC, 'C');
            }
            return null;
        });

        // Convert precipitation data based on unit system
        let precipData, precipLabel;
        if (this.unitSystem === 'imperial') {
            precipData = monthlyData.precip.map(p => p != null ? this.mmToInches(p) : 0);
            precipLabel = 'Precipitation (in)';
        } else {
            precipData = monthlyData.precip;
            precipLabel = 'Precipitation (mm)';
        }

        this.charts.comprehensive = new Chart(canvas, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: `Avg Temperature (°${this.tempUnit})`,
                    data: avgTempData,
                    borderColor: '#ff6b35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4
                }, {
                    label: precipLabel,
                    data: precipData,
                    borderColor: '#4dd0e1',
                    backgroundColor: 'rgba(77, 208, 225, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                animation: { duration: 2500 },
                plugins: { legend: { labels: { color: '#e8f4f8' } } },
                scales: {
                    x: { ticks: { color: '#8b9db8' }, grid: { color: 'rgba(0, 212, 255, 0.1)' } },
                    y: {
                        type: 'linear',
                        position: 'left',
                        ticks: { color: '#ff6b35' },
                        grid: { color: 'rgba(0, 212, 255, 0.1)' }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        ticks: { color: '#4dd0e1' },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    createRadarChart() {
        const canvas = document.getElementById('radarChart');
        if (!canvas) return;
        if (this.charts.radar) this.charts.radar.destroy();

        // Get REAL analysis data
        const analysis = this.currentProject?.analysis;
        if (!analysis) {
            console.warn('[CHART] No analysis data available for radar chart');
            return;
        }

        // Calculate suitability scores (0-100, higher = better)
        const projectDays = analysis.actualProjectDays || 365;

        // Temperature: Based on optimal vs extreme days
        const tempScore = Math.max(0, 100 - ((analysis.freezingDays + analysis.extremeHeatDays) / projectDays * 200));

        // Precipitation: Based on rainy days (inverse)
        const precipScore = Math.max(0, 100 - (analysis.rainyDays / projectDays * 200));

        // Wind: Based on high wind days (inverse)
        const windScore = Math.max(0, 100 - (analysis.highWindDays / projectDays * 200));

        // Work Conditions: Based on workable days (realistic feasibility)
        const workScore = ((analysis.workableDays || analysis.optimalDays) / projectDays * 100);

        // Overall Safety: Composite score
        const safetyScore = (tempScore + precipScore + windScore) / 3;

        this.charts.radar = new Chart(canvas, {
            type: 'radar',
            data: {
                labels: ['Temperature\nSuitability', 'Dry\nConditions', 'Favorable\nWind', 'Workable\nDays', 'Overall\nSafety'],
                datasets: [{
                    label: 'Project Suitability Score',
                    data: [
                        Math.round(tempScore),
                        Math.round(precipScore),
                        Math.round(windScore),
                        Math.round(workScore),
                        Math.round(safetyScore)
                    ],
                    backgroundColor: 'rgba(0, 212, 255, 0.2)',
                    borderColor: '#00d4ff',
                    borderWidth: 2,
                    pointBackgroundColor: '#00d4ff',
                    pointBorderColor: '#fff',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                animation: { duration: 2000, easing: 'easeInOutElastic' },
                plugins: { legend: { labels: { color: '#e8f4f8' } } },
                scales: {
                    r: {
                        ticks: { color: '#8b9db8', backdropColor: 'transparent' },
                        grid: { color: 'rgba(0, 212, 255, 0.2)' },
                        pointLabels: { color: '#e8f4f8' }
                    }
                }
            }
        });
    }

    // ========================================================================
    // EXECUTIVE SUMMARY & ANALYSIS
    // ========================================================================

    generateExecutiveSummary(analysis) {
        const container = document.getElementById('executiveSummary');
        if (!container) return;

        const project = this.currentProject;
        const start = new Date(project.startDate);
        const end = new Date(project.endDate);
        const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const months = Math.round(duration / 30);

        // Generate intelligent summary
        let summary = `<p><strong>Project Overview:</strong> ${this.sanitizeHTML(project.name)} is scheduled for a ${duration}-day period (approximately ${months} months) from ${project.startDate} to ${project.endDate} at ${this.sanitizeHTML(project.locationName)}.</p>`;

        summary += `<p><strong>Historical Analysis:</strong> Based on ${analysis.yearsAnalyzed} years of historical weather data for this exact calendar period, our analysis reveals the following conditions:</p>`;

        // Weather assessment - using workable days for realistic feasibility
        const rainyPercent = Math.round((analysis.rainyDays / duration) * 100);
        const workablePercent = Math.round((analysis.workableDays / duration) * 100);
        const idealPercent = Math.round((analysis.idealDays / duration) * 100);

        if (workablePercent > 75) {
            summary += `<p><strong>Favorable Conditions:</strong> Excellent news! Approximately ${workablePercent}% of project days (${analysis.workableDays} days) are expected to be workable with normal construction precautions. Of these, ${analysis.idealDays} days (${idealPercent}%) are forecast to have ideal conditions. This is significantly favorable for project execution.`;
        } else if (workablePercent > 55) {
            summary += `<p><strong>Moderate Conditions:</strong> Approximately ${workablePercent}% of project days (${analysis.workableDays} days) are expected to be workable with standard cold-weather or rain precautions. ${analysis.idealDays} days (${idealPercent}%) are forecast to have ideal conditions. This is within normal parameters for the selected timeframe and location.`;
        } else {
            summary += `<p><strong>Challenging Conditions:</strong> ${workablePercent}% of project days (${analysis.workableDays} days) are expected to be workable, with only ${analysis.idealDays} days (${idealPercent}%) having ideal conditions. Enhanced weather planning, mitigation strategies, and schedule flexibility are strongly recommended.`;
        }

        // Weather risks
        if (analysis.rainyDays > duration * 0.25) {
            summary += ` <strong>Rain Risk:</strong> Expect approximately ${analysis.rainyDays} rainy days (${rainyPercent}% of project duration), which is above historical averages. Plan for water management and weather-protected work areas.`;
        }

        if (analysis.snowyDays > 5) {
            summary += ` <strong>Snow Advisory:</strong> Historical patterns indicate ${analysis.snowyDays} days with snow accumulation. Winter construction protocols and heated enclosures may be necessary.`;
        }

        if (analysis.freezingDays > 10) {
            summary += ` <strong>Cold Weather Alert:</strong> ${analysis.freezingDays} freezing days expected. Concrete curing, material storage, and worker safety measures must be implemented.`;
        }

        summary += `</p>`;

        // Recommendations
        summary += `<p><strong>Strategic Recommendations:</strong> `;
        const recs = [];
        if (workablePercent > 65) {
            recs.push('Schedule critical path activities during optimal weather windows identified in the analysis below');
        }
        if (analysis.rainyDays > 20) {
            recs.push('implement comprehensive drainage and erosion control systems');
        }
        if (analysis.snowyDays > 0 || analysis.freezingDays > 15) {
            recs.push('prepare cold-weather contingency plans and heated work areas');
        }
        recs.push('monitor 10-day forecasts continuously for tactical adjustments');
        recs.push('maintain weather-dependent schedule float of 10-15% minimum');

        summary += recs.join('; ') + '.</p>';

        summary += `<p><strong>Confidence Level:</strong> This analysis is based on ${analysis.yearsAnalyzed} years of actual weather data for the same calendar period. While historical patterns provide valuable planning insights, actual conditions may vary. This assessment should be used in conjunction with short-term forecasts and professional meteorological guidance.</p>`;

        container.innerHTML = summary;
    }

    findBestWorstPeriods(analysis) {
        console.log('[PERIODS] Analyzing best/worst 2-week periods using real daily data');

        const bestPeriodEl = document.getElementById('bestPeriod');
        const bestReasonEl = document.getElementById('bestReason');
        const worstPeriodEl = document.getElementById('worstPeriod');
        const worstReasonEl = document.getElementById('worstReason');

        if (!this.weatherData || !Array.isArray(this.weatherData)) {
            console.warn('[PERIODS] No weather data available');
            if (bestPeriodEl) bestPeriodEl.textContent = 'Data Not Available';
            if (bestReasonEl) bestReasonEl.textContent = 'Insufficient historical data for period analysis.';
            if (worstPeriodEl) worstPeriodEl.textContent = 'Data Not Available';
            if (worstReasonEl) worstReasonEl.textContent = 'Insufficient historical data for period analysis.';
            return;
        }

        const projectStart = new Date(this.currentProject.startDate);
        const projectEnd = new Date(this.currentProject.endDate);

        // Extract all daily data within project CALENDAR range (month/day, ignore year)
        const dailyData = [];
        this.weatherData.forEach(yearData => {
            const daily = yearData.data.daily;
            if (!daily || !daily.time) return;

            daily.time.forEach((dateStr, index) => {
                const date = new Date(dateStr);

                // Compare month/day only (calendar period matching)
                const dateMonth = date.getMonth();
                const dateDay = date.getDate();
                const startMonth = projectStart.getMonth();
                const startDay = projectStart.getDate();
                const endMonth = projectEnd.getMonth();
                const endDay = projectEnd.getDate();

                let inRange = false;

                // Check if this is a full year (start month/day equals end month/day)
                if (startMonth === endMonth && startDay === endDay) {
                    // Full year - include all days
                    inRange = true;
                } else if (startMonth < endMonth || (startMonth === endMonth && startDay < endDay)) {
                    // Normal range within same calendar year (e.g., Jan-Jun)
                    inRange = (dateMonth > startMonth || (dateMonth === startMonth && dateDay >= startDay)) &&
                              (dateMonth < endMonth || (dateMonth === endMonth && dateDay <= endDay));
                } else {
                    // Cross-year range (e.g., Nov 2025 - Feb 2026)
                    inRange = (dateMonth > startMonth || (dateMonth === startMonth && dateDay >= startDay)) ||
                              (dateMonth < endMonth || (dateMonth === endMonth && dateDay <= endDay));
                }

                if (inRange) {
                    dailyData.push({
                        date: dateStr,
                        temp_max: daily.temperature_2m_max?.[index] || null,
                        temp_min: daily.temperature_2m_min?.[index] || null,
                        precip: daily.precipitation_sum?.[index] || 0,
                        snow: daily.snowfall_sum?.[index] || 0,
                        wind: daily.windspeed_10m_max?.[index] || 0
                    });
                }
            });
        });

        // Sort by month/day (ignoring year for calendar comparison)
        dailyData.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            const monthDayA = dateA.getMonth() * 100 + dateA.getDate();
            const monthDayB = dateB.getMonth() * 100 + dateB.getDate();
            return monthDayA - monthDayB;
        });

        if (dailyData.length < 14) {
            console.warn('[PERIODS] Not enough data for 2-week analysis');
            if (bestPeriodEl) bestPeriodEl.textContent = 'Data Not Available';
            if (bestReasonEl) bestReasonEl.textContent = 'Project period too short for 2-week analysis (minimum 14 days required).';
            if (worstPeriodEl) worstPeriodEl.textContent = 'Data Not Available';
            if (worstReasonEl) worstReasonEl.textContent = 'Project period too short for 2-week analysis (minimum 14 days required).';
            return;
        }

        console.log(`[PERIODS] Analyzing ${dailyData.length} days of historical data`);

        // Sliding window analysis (14-day periods)
        const windowSize = 14;
        let bestPeriod = null;
        let worstPeriod = null;
        let bestScore = -Infinity;
        let worstScore = Infinity;

        for (let i = 0; i <= dailyData.length - windowSize; i++) {
            const window = dailyData.slice(i, i + windowSize);

            // Calculate workability score for this 2-week period
            let score = 100; // Start with perfect score
            let rainyDays = 0;
            let snowyDays = 0;
            let highWindDays = 0;
            let freezingDays = 0;
            let heatDays = 0;
            let optimalDaysCount = 0;

            window.forEach(day => {
                let dayIsWorkable = true; // Using WORKABLE criteria (more lenient)
                let dayIsIdeal = true;    // Using IDEAL criteria (strict)

                // Heavy rain penalty (>10mm = work-stopping rain)
                if (day.precip > 10) {
                    rainyDays++;
                    score -= 7;  // Heavy penalty for work stoppage
                    dayIsWorkable = false;
                    dayIsIdeal = false;
                } else if (day.precip > 5) {
                    // Light rain (5-10mm) - workable but not ideal
                    score -= 2;  // Minor penalty
                    dayIsIdeal = false;
                }

                // Snow penalty (>10mm = difficult conditions)
                if (day.snow > 10) {
                    snowyDays++;
                    score -= 7;
                    dayIsWorkable = false;
                    dayIsIdeal = false;
                }

                // Wind penalty (>60km/h = unsafe, >50km/h = challenging)
                if (day.wind > 60) {
                    highWindDays++;
                    score -= 6;  // Very high wind
                    dayIsWorkable = false;
                    dayIsIdeal = false;
                } else if (day.wind > 50) {
                    score -= 2;  // Challenging but workable
                    dayIsIdeal = false;
                }

                // Extreme cold penalty (<-5°C = very difficult)
                if (day.temp_min !== null && day.temp_min < -5) {
                    freezingDays++;
                    score -= 5;
                    dayIsWorkable = false;
                    dayIsIdeal = false;
                } else if (day.temp_min !== null && day.temp_min < 0) {
                    // Light freezing (0 to -5°C) - workable but not ideal
                    score -= 2;
                    dayIsIdeal = false;
                }

                // Extreme heat penalty (>37°C = dangerous)
                if (day.temp_max !== null && day.temp_max > 37) {
                    heatDays++;
                    score -= 5;
                    dayIsWorkable = false;
                    dayIsIdeal = false;
                }

                // Count unique workable days (no double-counting)
                if (dayIsWorkable) {
                    optimalDaysCount++;
                }
            });

            const startDate = window[0].date;
            const endDate = window[window.length - 1].date;
            const periodInfo = {
                startDate,
                endDate,
                score,
                rainyDays,
                snowyDays,
                highWindDays,
                freezingDays,
                heatDays,
                optimalDays: optimalDaysCount  // Fixed: Count unique optimal days instead of subtracting violations
            };

            // Track best period
            if (score > bestScore) {
                bestScore = score;
                bestPeriod = periodInfo;
            }

            // Track worst period
            if (score < worstScore) {
                worstScore = score;
                worstPeriod = periodInfo;
            }
        }

        // Display results (elements already retrieved at top of function)
        if (!bestPeriod || !worstPeriod) {
            console.warn('[PERIODS] Could not determine best/worst periods');
            if (bestPeriodEl) bestPeriodEl.textContent = 'Unable to Analyze';
            if (bestReasonEl) bestReasonEl.textContent = 'Insufficient data variation for period comparison.';
            if (worstPeriodEl) worstPeriodEl.textContent = 'Unable to Analyze';
            if (worstReasonEl) worstReasonEl.textContent = 'Insufficient data variation for period comparison.';
            return;
        }

        if (bestPeriod) {
            // Convert historical dates to project year for display
            const historicalStart = new Date(bestPeriod.startDate);
            const historicalEnd = new Date(bestPeriod.endDate);

            // Create dates in the project year
            const projectYear = projectStart.getFullYear();
            const displayStart = new Date(projectYear, historicalStart.getMonth(), historicalStart.getDate());
            const displayEnd = new Date(projectYear, historicalEnd.getMonth(), historicalEnd.getDate());

            // If end is before start, it crosses into next year
            if (displayEnd < displayStart) {
                displayEnd.setFullYear(projectYear + 1);
            }

            const startDate = displayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const endDate = displayEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            if (bestPeriodEl) {
                bestPeriodEl.textContent = `${startDate} - ${endDate}`;
            }

            // Generate reason based on actual conditions
            const reasons = [];
            if (bestPeriod.optimalDays >= 12) {
                reasons.push(`${bestPeriod.optimalDays} optimal work days`);
            }
            if (bestPeriod.rainyDays === 0) {
                reasons.push('no rain expected');
            } else if (bestPeriod.rainyDays <= 2) {
                reasons.push(`minimal rain (${bestPeriod.rainyDays} days)`);
            }
            if (bestPeriod.snowyDays === 0) {
                reasons.push('no snow');
            }
            if (bestPeriod.highWindDays === 0) {
                reasons.push('calm winds');
            }
            if (bestPeriod.freezingDays === 0 && bestPeriod.heatDays === 0) {
                reasons.push('ideal temperatures');
            }

            if (bestReasonEl) {
                bestReasonEl.textContent = reasons.length > 0
                    ? reasons.join(', ').charAt(0).toUpperCase() + reasons.join(', ').slice(1) + '.'
                    : 'Best overall weather conditions for this project period.';
            }

            console.log('[PERIODS] Best period:', startDate, '-', endDate, 'Score:', bestScore);
        }

        if (worstPeriod) {
            // Convert historical dates to project year for display
            const historicalStart = new Date(worstPeriod.startDate);
            const historicalEnd = new Date(worstPeriod.endDate);

            // Create dates in the project year
            const projectYear = projectStart.getFullYear();
            const displayStart = new Date(projectYear, historicalStart.getMonth(), historicalStart.getDate());
            const displayEnd = new Date(projectYear, historicalEnd.getMonth(), historicalEnd.getDate());

            // If end is before start, it crosses into next year
            if (displayEnd < displayStart) {
                displayEnd.setFullYear(projectYear + 1);
            }

            const startDate = displayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const endDate = displayEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            if (worstPeriodEl) {
                worstPeriodEl.textContent = `${startDate} - ${endDate}`;
            }

            // Generate reason based on actual issues
            const issues = [];
            if (worstPeriod.rainyDays > 0) {
                issues.push(`${worstPeriod.rainyDays} rainy days`);
            }
            if (worstPeriod.snowyDays > 0) {
                issues.push(`${worstPeriod.snowyDays} snowy days`);
            }
            if (worstPeriod.highWindDays > 0) {
                issues.push(`${worstPeriod.highWindDays} high wind days`);
            }
            if (worstPeriod.freezingDays > 0) {
                issues.push(`${worstPeriod.freezingDays} freezing days`);
            }
            if (worstPeriod.heatDays > 0) {
                issues.push(`${worstPeriod.heatDays} extreme heat days`);
            }

            if (worstReasonEl) {
                worstReasonEl.textContent = issues.length > 0
                    ? issues.join(', ').charAt(0).toUpperCase() + issues.join(', ').slice(1) + '.'
                    : 'Most challenging weather conditions for this project period.';
            }

            console.log('[PERIODS] Worst period:', startDate, '-', endDate, 'Score:', worstScore);
        }
    }

    // ========================================================================
    // PROFESSIONAL PDF EXPORT
    // ========================================================================

    async exportProfessionalPDF() {
        if (!this.currentProject) {
            window.toastManager.warning('Please create a project first before exporting to PDF', 'No Project Available');
            return;
        }

        // Show loading toast
        window.toastManager.info('Generating comprehensive PDF report with executive summary, risk assessment, and recommendations...', 'Creating PDF Report', 5000);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const project = this.currentProject;
        const analysis = project.analysis;
        let yPos = 20;

        // Cover Page
        doc.setFillColor(10, 25, 41);
        doc.rect(0, 0, 210, 297, 'F');

        doc.setTextColor(0, 212, 255);
        doc.setFontSize(32);
        doc.setFont(undefined, 'bold');
        doc.text('XYLOCLIME PRO', 105, 60, { align: 'center' });

        doc.setFontSize(20);
        doc.setTextColor(192, 200, 212);
        doc.text('Professional Weather Intelligence Report', 105, 75, { align: 'center' });

        doc.setFontSize(16);
        doc.setTextColor(139, 157, 184);
        doc.text(this.sanitizeHTML(project.name), 105, 100, { align: 'center' });

        doc.setFontSize(12);
        doc.text(`Location: ${this.sanitizeHTML(project.locationName)}`, 105, 115, { align: 'center' });
        doc.text(`Project Duration: ${project.startDate} to ${project.endDate}`, 105, 125, { align: 'center' });
        doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 105, 135, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(255, 179, 32);
        doc.text('⚠ NOTICE: For planning purposes only. Not for life-safety decisions.', 105, 270, { align: 'center' });

        // Page 2 - Enhanced Executive Summary
        doc.addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 210, 297, 'F');

        yPos = 20;
        doc.setTextColor(0, 212, 255);
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('Executive Summary', 20, yPos);

        // Project Overview Box
        yPos += 12;
        doc.setFillColor(245, 248, 250);
        doc.rect(20, yPos, 170, 32, 'F');
        doc.setDrawColor(0, 212, 255);
        doc.setLineWidth(0.5);
        doc.rect(20, yPos, 170, 32);

        yPos += 8;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.setFont(undefined, 'bold');
        doc.text('Project Duration:', 25, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(`${analysis.totalDays} days (${project.startDate} to ${project.endDate})`, 75, yPos);

        yPos += 7;
        doc.setFont(undefined, 'bold');
        doc.text('Analysis Period:', 25, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(`${analysis.yearsAnalyzed || 5} years of historical data (2019-2024)`, 75, yPos);

        yPos += 7;
        doc.setFont(undefined, 'bold');
        doc.text('Risk Assessment:', 25, yPos);
        const riskScore = project.riskScore || this.calculateRiskScore(analysis);
        const riskLevel = riskScore <= 30 ? 'LOW' : riskScore <= 60 ? 'MEDIUM' : 'HIGH';
        const riskColor = riskScore <= 30 ? [16, 185, 129] : riskScore <= 60 ? [251, 191, 36] : [239, 68, 68];
        doc.setTextColor(...riskColor);
        doc.setFont(undefined, 'bold');
        doc.text(`${riskLevel} RISK (Score: ${riskScore}/100)`, 75, yPos);

        // Key Findings Section
        yPos += 20;
        doc.setTextColor(0, 212, 255);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Key Findings', 20, yPos);

        yPos += 8;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.setFont(undefined, 'normal');

        const workablePercent = ((analysis.workableDays / analysis.totalDays) * 100).toFixed(1);
        const findings = [
            `${analysis.workableDays} workable days identified (${workablePercent}% of total project duration)`,
            `${analysis.nonWorkableDays} non-workable days expected due to adverse weather conditions`,
            `Average temperature: ${this.formatTemp(analysis.averageTemp, 'C')} ${analysis.averageTemp < 5 ? '(Cold weather protocols required)' : ''}`,
            `Total precipitation forecast: ${this.formatPrecip(analysis.totalPrecipitation)} over project duration`,
            `${analysis.extremeEvents ? analysis.extremeEvents.length : 0} extreme weather events anticipated`,
            analysis.totalSnowfall > 0 ? `Snow accumulation expected: ${this.formatPrecip(analysis.totalSnowfall)}` : null
        ].filter(Boolean);

        findings.forEach(finding => {
            const lines = doc.splitTextToSize(`• ${finding}`, 165);
            doc.text(lines, 25, yPos);
            yPos += 7 * lines.length;
        });

        // Risk Assessment Detail
        yPos += 8;
        doc.setTextColor(0, 212, 255);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Weather Risk Assessment', 20, yPos);

        yPos += 8;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.setFont(undefined, 'normal');

        let riskAssessment = '';
        if (riskScore <= 30) {
            riskAssessment = `LOW RISK: Weather conditions are generally favorable for this project. Expected ${workablePercent}% workability provides good schedule reliability. Standard weather monitoring protocols are recommended.`;
        } else if (riskScore <= 60) {
            riskAssessment = `MEDIUM RISK: Moderate weather challenges expected during this project. With ${workablePercent}% workability, implement enhanced weather monitoring and maintain 15-20% schedule contingency for weather delays.`;
        } else {
            riskAssessment = `HIGH RISK: Significant weather challenges anticipated for this project period. Only ${workablePercent}% of days considered workable. Robust weather contingency planning essential. Consider 25-30% schedule buffer and alternative work strategies.`;
        }

        const assessmentLines = doc.splitTextToSize(riskAssessment, 170);
        doc.text(assessmentLines, 20, yPos);
        yPos += 7 * assessmentLines.length;

        // Critical Recommendations
        yPos += 10;
        doc.setTextColor(0, 212, 255);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Critical Recommendations', 20, yPos);

        yPos += 8;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.setFont(undefined, 'normal');

        // Get smart recommendations if available
        let recommendations = [];
        if (window.SmartRecommendations) {
            const smartRecs = new window.SmartRecommendations();
            const allRecs = smartRecs.generateRecommendations(analysis, project);
            // Combine critical and important recommendations
            recommendations = [
                ...allRecs.critical.map(r => `[CRITICAL] ${r}`),
                ...allRecs.important.slice(0, 3).map(r => `[IMPORTANT] ${r}`)
            ];
        }

        // Fallback to generic recommendations if smart recs not available
        if (recommendations.length === 0) {
            recommendations = [
                `[CRITICAL] Maintain ${riskScore > 60 ? '25-30%' : riskScore > 30 ? '15-20%' : '10-15%'} schedule contingency for weather delays`,
                '[IMPORTANT] Schedule weather-sensitive activities during optimal periods identified in monthly breakdown',
                '[IMPORTANT] Implement daily weather monitoring with 10-day forecast reviews',
                analysis.totalPrecipitation > 200 ? '[CRITICAL] Prepare comprehensive drainage and erosion control measures' : null,
                analysis.extremeEvents && analysis.extremeEvents.length > 5 ? '[CRITICAL] Develop extreme weather response protocols and safety procedures' : null,
                '[IMPORTANT] Coordinate with subcontractors on weather-contingent work sequences'
            ].filter(Boolean);
        }

        recommendations.slice(0, 6).forEach(rec => {
            const lines = doc.splitTextToSize(`• ${rec}`, 165);
            doc.text(lines, 25, yPos);
            yPos += 7 * lines.length + 2;
        });

        // Page 3 - Detailed Analysis
        doc.addPage();
        yPos = 20;

        doc.setTextColor(0, 212, 255);
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('Detailed Weather Analysis', 20, yPos);

        yPos += 15;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.setFont(undefined, 'normal');

        doc.text('[Charts would appear here in full version]', 20, yPos);
        yPos += 10;
        doc.text('This report includes 6 comprehensive weather charts:', 20, yPos);
        yPos += 7;
        doc.text('1. Temperature Trends Analysis', 25, yPos);
        yPos += 7;
        doc.text('2. Precipitation Patterns', 25, yPos);
        yPos += 7;
        doc.text('3. Wind Speed Analysis', 25, yPos);
        yPos += 7;
        doc.text('4. Weather Distribution Overview', 25, yPos);
        yPos += 7;
        doc.text('5. Comprehensive Multi-Metric View', 25, yPos);
        yPos += 7;
        doc.text('6. Project Suitability Radar', 25, yPos);

        // Disclaimer
        yPos = 270;
        doc.setFontSize(8);
        doc.setTextColor(255, 179, 32);
        doc.text('DISCLAIMER: This analysis is based on historical weather patterns and should not be used as the sole basis for critical decisions.', 105, yPos, { align: 'center', maxWidth: 170 });

        // Footer
        doc.setTextColor(139, 157, 184);
        doc.setFontSize(9);
        doc.text(`Xyloclime Pro | ${new Date().toLocaleDateString()} | Page 3 of 3`, 105, 290, { align: 'center' });

        // Save PDF
        const filename = `XyloclimePro_${project.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        window.toastManager.success(`Professional PDF report generated and downloaded: ${filename}`, 'PDF Export Complete', 6000);
    }

    // ========================================================================
    // ADVANCED PDF EXPORT WITH CHARTS
    // ========================================================================

    async exportAdvancedPDF() {
        if (!this.currentProject) {
            alert('Please create a project first');
            return;
        }

        // ===== AUTOMATIC QA VALIDATION =====
        console.log('[PDF] Running automatic QA validation...');
        const qaReport = this.validateReport(this.currentProject);

        // Handle QA results
        if (qaReport.verdict === 'Unrealistic') {
            // Critical issues - block export
            const proceed = confirm(
                `⚠️ QUALITY ASSURANCE ALERT\n\n` +
                `Verdict: ${qaReport.verdict}\n` +
                `Reason: ${qaReport.verdictReason}\n\n` +
                `Critical Issues: ${qaReport.summary.criticalIssues}\n` +
                `Warnings: ${qaReport.summary.warnings}\n\n` +
                `This report has critical data quality issues and should NOT be exported.\n\n` +
                `Would you like to see the detailed QA report in the console?`
            );
            if (proceed) {
                console.log(this.formatQAReport(qaReport));
                console.log('[QA] Full validation object:', qaReport);
            }
            return; // Block export
        } else if (qaReport.verdict === 'Needs Review') {
            // Warnings - allow with confirmation
            const proceed = confirm(
                `⚠️ QUALITY ASSURANCE WARNING\n\n` +
                `Verdict: ${qaReport.verdict}\n` +
                `Reason: ${qaReport.verdictReason}\n\n` +
                `Warnings: ${qaReport.summary.warnings}\n` +
                `Checks Passed: ${qaReport.summary.passed}/${qaReport.summary.checks}\n\n` +
                `This report has some quality warnings but may still be usable.\n\n` +
                `Would you like to proceed with PDF generation?\n` +
                `(Check browser console for detailed QA report)`
            );
            console.log(this.formatQAReport(qaReport));
            console.log('[QA] Full validation object:', qaReport);
            if (!proceed) return; // User declined
        } else {
            // Pass - proceed silently
            console.log('[QA] ✅', qaReport.verdictReason);
            if (qaReport.summary.warnings > 0) {
                console.log(this.formatQAReport(qaReport));
            }
        }

        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(10, 25, 41, 0.95); padding: 3rem; border-radius: 15px; border: 2px solid #00d4ff; z-index: 10000; box-shadow: 0 10px 40px rgba(0, 212, 255, 0.5);';
        loadingMsg.innerHTML = `
            <div style="text-align: center; color: #00d4ff;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h3 style="margin: 0; font-family: Orbitron, sans-serif;">Generating PDF Report...</h3>
                <p style="color: #8b9db8; margin: 0.5rem 0 0 0;">Capturing charts and data</p>
            </div>
        `;
        document.body.appendChild(loadingMsg);

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const project = this.currentProject;
            const analysis = project.analysis;

            // ===== PAGE 1: COVER PAGE =====
            doc.setFillColor(10, 25, 41);
            doc.rect(0, 0, 210, 297, 'F');

            doc.setTextColor(0, 212, 255);
            doc.setFontSize(40);
            doc.setFont(undefined, 'bold');
            doc.text('XYLOCLIME PRO', 105, 60, { align: 'center' });

            doc.setFontSize(18);
            doc.setTextColor(192, 200, 212);
            doc.text('Professional Weather Intelligence Report', 105, 80, { align: 'center' });

            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text(this.sanitizeHTML(project.name), 105, 110, { align: 'center' });

            doc.setFontSize(14);
            doc.setTextColor(139, 157, 184);
            doc.text(`${this.sanitizeHTML(project.locationName)}`, 105, 125, { align: 'center' });
            doc.text(`${project.startDate} to ${project.endDate}`, 105, 135, { align: 'center' });
            doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 105, 145, { align: 'center' });

            // Key metrics box
            doc.setFillColor(30, 58, 95);
            doc.roundedRect(30, 160, 150, 60, 5, 5, 'F');
            doc.setDrawColor(0, 212, 255);
            doc.setLineWidth(1);
            doc.roundedRect(30, 160, 150, 60, 5, 5, 'S');

            doc.setFontSize(12);
            doc.setTextColor(0, 212, 255);
            doc.setFont(undefined, 'bold');
            doc.text('KEY METRICS SUMMARY', 105, 170, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'normal');
            const avgTemp = ((parseFloat(analysis.avgTempMax) + parseFloat(analysis.avgTempMin)) / 2);
            const workablePercent = Math.round(((analysis.workableDays || analysis.optimalDays) / ((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24))) * 100);
            const idealPercent = Math.round(((analysis.idealDays || 0) / ((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24))) * 100);

            // Unit system indicator
            const unitLabel = this.unitSystem === 'imperial' ? 'Imperial Units (°F, in, mph)' : 'Metric Units (°C, mm, km/h)';
            doc.text(unitLabel, 105, 175, { align: 'center' });

            doc.text(`Avg Temperature: ${this.formatTemp(avgTemp, 'C')}  |  Workable: ${workablePercent}%  |  Ideal: ${idealPercent}%`, 105, 185, { align: 'center' });
            doc.text(`Rainy Days: ${analysis.rainyDays}  |  Heavy Rain: ${analysis.heavyRainDays || 0}  |  Snow: ${analysis.snowyDays}`, 105, 195, { align: 'center' });
            doc.text(`Historical Analysis: ${analysis.yearsAnalyzed} years of data`, 105, 205, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(255, 179, 32);
            doc.text('⚠ FOR PLANNING PURPOSES ONLY - NOT FOR LIFE-SAFETY DECISIONS', 105, 270, { align: 'center' });

            // ===== PAGE 2: EXECUTIVE SUMMARY =====
            doc.addPage();
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, 210, 297, 'F');

            let yPos = 20;
            doc.setTextColor(0, 212, 255);
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text('Executive Summary', 20, yPos);

            yPos += 12;
            doc.setFontSize(11);
            doc.setTextColor(60, 60, 60);
            doc.setFont(undefined, 'normal');
            const summaryText = `Based on ${analysis.yearsAnalyzed} years of historical weather data for the exact calendar period, this comprehensive analysis provides critical weather intelligence for ${project.name}. The project spans from ${project.startDate} to ${project.endDate} at ${project.locationName}.`;
            const summaryLines = doc.splitTextToSize(summaryText, 170);
            doc.text(summaryLines, 20, yPos);
            yPos += (summaryLines.length * 6) + 10;

            // Weather Outlook Box
            doc.setFillColor(0, 212, 255);
            doc.setDrawColor(0, 212, 255);
            doc.setLineWidth(0.5);
            doc.rect(15, yPos, 4, 30, 'F');

            doc.setFontSize(14);
            doc.setTextColor(0, 212, 255);
            doc.setFont(undefined, 'bold');
            doc.text('Weather Outlook', 23, yPos + 5);

            yPos += 12;
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            doc.setFont(undefined, 'normal');
            const projectDays = Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24));
            // Use already declared workablePercent and idealPercent from line 3855-3856
            let outlookText = '';
            if (workablePercent > 75) {
                outlookText = `✓ FAVORABLE: ${workablePercent}% workable conditions (${idealPercent}% ideal). Excellent opportunity for efficient project execution with minimal weather delays.`;
            } else if (workablePercent > 55) {
                outlookText = `⚠ MODERATE: ${workablePercent}% workable conditions (${idealPercent}% ideal). Normal parameters for this timeframe. Standard weather contingency planning recommended.`;
            } else {
                outlookText = `⚠ CHALLENGING: Only ${workablePercent}% workable conditions (${idealPercent}% ideal). Enhanced weather planning and mitigation strategies strongly recommended.`;
            }
            const outlookLines = doc.splitTextToSize(outlookText, 167);
            doc.text(outlookLines, 23, yPos);
            yPos += (outlookLines.length * 5) + 10;

            // Key Metrics Table
            doc.setFontSize(14);
            doc.setTextColor(0, 212, 255);
            doc.setFont(undefined, 'bold');
            doc.text('Detailed Metrics', 20, yPos);
            yPos += 8;

            // Get historical extremes
            const extremes = this.findHistoricalExtremes();

            const metrics = [
                [`Temperature Range`, `${this.formatTemp(parseFloat(analysis.avgTempMin), 'C')} to ${this.formatTemp(parseFloat(analysis.avgTempMax), 'C')}`],
                [`Workable Days`, `${analysis.workableDays || analysis.optimalDays} days (${workablePercent}%)`],
                [`Ideal Days`, `${analysis.idealDays || analysis.optimalDays} days (${idealPercent}%)`],
                [`Expected Rainy Days`, `${analysis.rainyDays} days (any precipitation)`],
                [`Heavy Rain Days`, `${analysis.heavyRainDays || 0} days (>10mm = work stoppage)`],
                [`Expected Snow Days`, `${analysis.snowyDays} days`],
                [`Freezing Days (<0°C)`, `${analysis.freezingDays} days`],
                [`Total Precipitation`, `${this.formatPrecip(parseFloat(analysis.totalPrecip))}`]
            ];

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            metrics.forEach((metric, i) => {
                if (i % 2 === 0) {
                    doc.setFillColor(245, 247, 250);
                    doc.rect(20, yPos - 5, 170, 8, 'F');
                }
                doc.setTextColor(60, 60, 60);
                doc.setFont(undefined, 'bold');
                doc.text(metric[0], 25, yPos);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(0, 100, 200);
                doc.text(metric[1], 130, yPos);
                yPos += 8;
            });

            yPos += 5;

            // Recommendations
            doc.setFontSize(14);
            doc.setTextColor(0, 212, 255);
            doc.setFont(undefined, 'bold');
            doc.text('Strategic Recommendations', 20, yPos);
            yPos += 8;

            const recommendations = [
                'Monitor 10-day forecasts continuously for tactical schedule adjustments',
                'Maintain 10-15% schedule float minimum for weather contingencies',
                'Schedule critical path activities during optimal weather windows',
                'Implement comprehensive site drainage and erosion control',
                'Prepare contingency plans for adverse weather scenarios'
            ];

            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            doc.setFont(undefined, 'normal');
            recommendations.forEach((rec, i) => {
                doc.text(`${i + 1}.`, 25, yPos);
                const recLines = doc.splitTextToSize(rec, 160);
                doc.text(recLines, 32, yPos);
                yPos += (recLines.length * 5) + 3;
            });

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Xyloclime Pro | Page 2`, 105, 287, { align: 'center' });

            // ===== PAGE 3: RISK ANALYSIS & HISTORICAL EXTREMES =====
            doc.addPage();
            yPos = 20;

            doc.setTextColor(0, 212, 255);
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text('Risk Analysis & Historical Data', 20, yPos);
            yPos += 12;

            // Risk Score Explanation
            doc.setFillColor(0, 212, 255);
            doc.rect(15, yPos, 4, 30, 'F');
            doc.setFontSize(14);
            doc.setTextColor(0, 212, 255);
            doc.text('Risk Score Breakdown', 23, yPos + 5);
            yPos += 12;

            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            doc.setFont(undefined, 'normal');

            const riskScore = this.currentProject.riskScore;
            const riskExplanation = `Risk scores assess weather impacts on construction feasibility (0-100 scale, higher = more challenging). Your project scored ${riskScore.totalScore}/100 (${riskScore.riskLevel}).`;
            const riskLines = doc.splitTextToSize(riskExplanation, 167);
            doc.text(riskLines, 23, yPos);
            yPos += (riskLines.length * 5) + 8;

            // Risk breakdown table
            const riskBreakdown = [
                ['Risk Category', 'Score', 'What It Means'],
                ['Precipitation', `${riskScore.breakdown.precipitation}%`, `Based on ${analysis.rainyDays} rainy days + ${analysis.snowyDays} snow days`],
                ['Temperature', `${riskScore.breakdown.temperature}%`, `Based on ${analysis.freezingDays} freezing days + ${analysis.extremeHeatDays || 0} heat days`],
                ['Wind', `${riskScore.breakdown.wind}%`, `Based on ${analysis.workableDays || analysis.optimalDays} workable days`],
                ['Seasonal', `${riskScore.breakdown.seasonal}%`, `Based on overall favorable conditions (${workablePercent}%)`]
            ];

            doc.setFontSize(9);
            riskBreakdown.forEach((row, i) => {
                if (i === 0) {
                    doc.setFillColor(0, 212, 255);
                    doc.rect(20, yPos - 5, 170, 8, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFont(undefined, 'bold');
                } else {
                    if (i % 2 === 1) {
                        doc.setFillColor(245, 247, 250);
                        doc.rect(20, yPos - 5, 170, 8, 'F');
                    }
                    doc.setTextColor(60, 60, 60);
                    doc.setFont(undefined, 'normal');
                }
                doc.text(row[0], 25, yPos);
                doc.text(row[1], 80, yPos);
                const descLines = doc.splitTextToSize(row[2], 85);
                doc.text(descLines, 105, yPos);
                yPos += 8;
            });

            yPos += 10;

            // Workability Tiers Explanation
            doc.setFillColor(0, 212, 255);
            doc.rect(15, yPos, 4, 30, 'F');
            doc.setFontSize(14);
            doc.setTextColor(0, 212, 255);
            doc.setFont(undefined, 'bold');
            doc.text('Workability Tiers Explained', 23, yPos + 5);
            yPos += 12;

            doc.setFontSize(9);
            doc.setTextColor(60, 60, 60);
            doc.setFont(undefined, 'normal');

            const tiersTable = [
                ['Tier', 'Criteria', 'Description'],
                ['Workable Days', `Temp: >-5°C, Rain: <10mm, Wind: <60 km/h`, `Realistic construction feasibility with standard precautions`],
                ['Ideal Days', `Temp: >0°C, Rain: <5mm, Wind: <50 km/h`, `Perfect conditions - no weather precautions needed`],
                ['Heavy Rain', `Precipitation >10mm/day`, `Work-stopping rainfall requiring schedule adjustment`]
            ];

            tiersTable.forEach((row, i) => {
                if (i === 0) {
                    doc.setFillColor(0, 212, 255);
                    doc.rect(20, yPos - 5, 170, 8, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFont(undefined, 'bold');
                } else {
                    if (i % 2 === 1) {
                        doc.setFillColor(245, 247, 250);
                        doc.rect(20, yPos - 5, 170, 8, 'F');
                    }
                    doc.setTextColor(60, 60, 60);
                    doc.setFont(undefined, 'normal');
                }
                doc.text(row[0], 25, yPos);
                const criteriaLines = doc.splitTextToSize(row[1], 50);
                doc.text(criteriaLines, 60, yPos);
                const descLines = doc.splitTextToSize(row[2], 70);
                doc.text(descLines, 115, yPos);
                yPos += Math.max(criteriaLines.length, descLines.length) * 4 + 4;
            });

            yPos += 10;

            // Historical Extremes
            if (extremes && yPos < 240) {
                doc.setFillColor(0, 212, 255);
                doc.rect(15, yPos, 4, 30, 'F');
                doc.setFontSize(14);
                doc.setTextColor(0, 212, 255);
                doc.setFont(undefined, 'bold');
                doc.text('Historical Extremes', 23, yPos + 5);
                yPos += 12;

                doc.setFontSize(9);
                doc.setTextColor(60, 60, 60);
                doc.setFont(undefined, 'normal');
                const extremesText = `Based on ${analysis.yearsAnalyzed} years of historical data for this exact calendar period:`;
                doc.text(extremesText, 23, yPos);
                yPos += 8;

                const extremesTable = [
                    ['Extreme', 'Value', 'Date Observed'],
                    ['Highest Temperature', this.formatTemp(extremes.maxTemp, 'C'), extremes.maxTempDate || 'N/A'],
                    ['Lowest Temperature', this.formatTemp(extremes.minTemp, 'C'), extremes.minTempDate || 'N/A'],
                    ['Max Daily Precipitation', this.formatPrecip(extremes.maxPrecip), extremes.maxPrecipDate || 'N/A'],
                    ['Max Daily Snowfall', this.formatSnow(extremes.maxSnow / 10), extremes.maxSnowDate || 'N/A'],
                    ['Max Wind Speed', this.formatWind(extremes.maxWind), extremes.maxWindDate || 'N/A']
                ];

                extremesTable.forEach((row, i) => {
                    if (i === 0) {
                        doc.setFillColor(0, 212, 255);
                        doc.rect(20, yPos - 5, 170, 8, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFont(undefined, 'bold');
                    } else {
                        if (i % 2 === 1) {
                            doc.setFillColor(245, 247, 250);
                            doc.rect(20, yPos - 5, 170, 8, 'F');
                        }
                        doc.setTextColor(60, 60, 60);
                        doc.setFont(undefined, 'normal');
                    }
                    doc.text(row[0], 25, yPos);
                    doc.text(row[1], 95, yPos);
                    doc.text(row[2], 135, yPos);
                    yPos += 8;
                });
            }

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Xyloclime Pro | Page 3`, 105, 287, { align: 'center' });

            // ===== PAGE 4: EXTREME WEATHER EVENTS =====
            if (analysis.extremeEvents && analysis.extremeEvents.length > 0) {
                doc.addPage();
                yPos = 20;

                doc.setTextColor(0, 212, 255);
                doc.setFontSize(20);
                doc.setFont(undefined, 'bold');
                doc.text('Extreme Weather Events', 20, yPos);
                yPos += 10;

                doc.setFontSize(10);
                doc.setTextColor(60, 60, 60);
                doc.setFont(undefined, 'normal');
                const eventsIntro = `The following extreme weather events were observed during this calendar period in historical data. These outliers occurred more than 2 standard deviations from the mean:`;
                const eventsLines = doc.splitTextToSize(eventsIntro, 170);
                doc.text(eventsLines, 20, yPos);
                yPos += (eventsLines.length * 5) + 10;

                // Events table
                const eventsTable = [['Year', 'Event Type', 'Details', 'Severity']];
                analysis.extremeEvents.forEach(event => {
                    eventsTable.push([
                        event.year.toString(),
                        event.type,
                        event.value,
                        event.severity || 'Moderate'
                    ]);
                });

                doc.setFontSize(9);
                eventsTable.forEach((row, i) => {
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                        doc.setTextColor(0, 212, 255);
                        doc.setFontSize(16);
                        doc.setFont(undefined, 'bold');
                        doc.text('Extreme Events (continued)', 20, yPos);
                        yPos += 10;
                        doc.setFontSize(9);
                    }

                    if (i === 0) {
                        doc.setFillColor(0, 212, 255);
                        doc.rect(20, yPos - 5, 170, 8, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFont(undefined, 'bold');
                    } else {
                        if (i % 2 === 1) {
                            doc.setFillColor(245, 247, 250);
                            doc.rect(20, yPos - 5, 170, 8, 'F');
                        }
                        doc.setTextColor(60, 60, 60);
                        doc.setFont(undefined, 'normal');
                    }
                    doc.text(row[0], 25, yPos);
                    doc.text(row[1], 45, yPos);
                    const detailLines = doc.splitTextToSize(row[2], 75);
                    doc.text(detailLines, 85, yPos);
                    doc.text(row[3], 165, yPos);
                    yPos += Math.max(8, detailLines.length * 4);
                });

                // Footer
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Xyloclime Pro | Page 4`, 105, 287, { align: 'center' });
            }

            // ===== PAGES 5+: CHARTS (ALL CHARTS IN HIGH RESOLUTION) =====
            doc.addPage();

            doc.setTextColor(0, 212, 255);
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text('Weather Analysis Charts', 20, 20);

            // ALL chart IDs - ALL using REAL data from API
            const chartIds = [
                'temperatureChart',      // Real monthly temperature data from API
                'precipitationChart',    // Real monthly precipitation data from API
                'windChart',             // Real monthly wind data from API
                'distributionChart',     // Real analysis data
                'comprehensiveChart',    // Real combined temperature & precipitation
                'radarChart'             // Real suitability scores from analysis
            ];

            let chartYPos = 30;
            let pageNum = 3;
            let chartsOnPage = 0;

            for (let i = 0; i < chartIds.length; i++) {
                const chartCanvas = document.getElementById(chartIds[i]);
                if (chartCanvas) {
                    try {
                        // HIGH RESOLUTION CAPTURE - Scale up for crisp output
                        const scale = 3; // 3x resolution for crisp charts
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = chartCanvas.width * scale;
                        tempCanvas.height = chartCanvas.height * scale;
                        const tempCtx = tempCanvas.getContext('2d');

                        // Enable high-quality rendering
                        tempCtx.imageSmoothingEnabled = true;
                        tempCtx.imageSmoothingQuality = 'high';

                        // Draw scaled version
                        tempCtx.scale(scale, scale);
                        tempCtx.drawImage(chartCanvas, 0, 0);

                        // Get high-res image data
                        const imgData = tempCanvas.toDataURL('image/png', 1.0);

                        // Add new page for comprehensive chart (it's large) or after 2 regular charts
                        const isComprehensive = chartIds[i] === 'comprehensiveChart';
                        if (chartsOnPage >= 2 || (isComprehensive && chartsOnPage > 0)) {
                            doc.addPage();
                            pageNum++;
                            chartYPos = 30;
                            chartsOnPage = 0;

                            // Add page title
                            doc.setTextColor(0, 212, 255);
                            doc.setFontSize(16);
                            doc.setFont(undefined, 'bold');
                            doc.text('Weather Charts (continued)', 20, 20);
                            doc.setFont(undefined, 'normal');
                        }

                        // Calculate proper dimensions while maintaining aspect ratio
                        const canvasAspectRatio = chartCanvas.width / chartCanvas.height;
                        let imgWidth = isComprehensive ? 170 : 170; // Full width for all charts
                        let imgHeight = imgWidth / canvasAspectRatio;

                        // Different max heights for chart types
                        const maxHeight = isComprehensive ? 120 : 85;
                        if (imgHeight > maxHeight) {
                            imgHeight = maxHeight;
                            imgWidth = imgHeight * canvasAspectRatio;
                        }

                        // Add chart title
                        doc.setFontSize(11);
                        doc.setTextColor(60, 60, 60);
                        doc.setFont(undefined, 'bold');
                        const chartTitles = {
                            'temperatureChart': 'Temperature Trends',
                            'precipitationChart': 'Precipitation Analysis',
                            'windChart': 'Wind Patterns',
                            'distributionChart': 'Weather Distribution',
                            'comprehensiveChart': 'Comprehensive Overview',
                            'radarChart': 'Conditions Radar'
                        };
                        doc.text(chartTitles[chartIds[i]] || 'Chart', 20, chartYPos - 3);
                        doc.setFont(undefined, 'normal');

                        // Add the high-resolution chart image
                        doc.addImage(imgData, 'PNG', 20, chartYPos, imgWidth, imgHeight);
                        chartYPos += imgHeight + 15;
                        chartsOnPage++;

                    } catch (error) {
                        console.error(`Failed to capture ${chartIds[i]}:`, error);
                    }
                }
            }

            // Footer on last chart page
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Xyloclime Pro | Page ${pageNum}`, 105, 287, { align: 'center' });

            // Final disclaimer page
            doc.addPage();
            yPos = 20;

            doc.setFillColor(255, 245, 230);
            doc.rect(0, 0, 210, 297, 'F');

            doc.setTextColor(255, 100, 0);
            doc.setFontSize(24);
            doc.setFont(undefined, 'bold');
            doc.text('⚠ IMPORTANT DISCLAIMER', 105, yPos, { align: 'center' });

            yPos += 15;
            doc.setFontSize(11);
            doc.setTextColor(60, 60, 60);
            doc.setFont(undefined, 'normal');

            const disclaimerText = [
                'This weather analysis report is provided for general planning purposes only and should not be used as the sole basis for critical business, construction, or life-safety decisions.',
                '',
                'LIMITATIONS:',
                '• Historical weather data may not accurately predict future conditions',
                '• Actual weather may vary significantly from historical patterns',
                '• Extreme weather events may occur without historical precedent',
                '• Data accuracy depends on third-party sources and may contain errors',
                '',
                'RECOMMENDED ACTIONS:',
                '• Consult with professional meteorologists for critical decisions',
                '• Monitor short-term weather forecasts continuously',
                '• Maintain appropriate insurance coverage',
                '• Develop comprehensive weather contingency plans',
                '',
                'By using this report, you acknowledge that Xyloclime Pro and its operators assume no liability for decisions made based on this analysis. See Terms of Service for complete legal terms.'
            ];

            disclaimerText.forEach(line => {
                if (line === '') {
                    yPos += 5;
                } else {
                    const lines = doc.splitTextToSize(line, 170);
                    doc.text(lines, 20, yPos);
                    yPos += (lines.length * 6);
                }
            });

            // Save PDF
            const filename = `XyloclimePro_Advanced_${project.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(filename);

            document.body.removeChild(loadingMsg);

            const successMsg = document.createElement('div');
            successMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(10, 25, 41, 0.95); padding: 2rem 3rem; border-radius: 15px; border: 2px solid #52c41a; z-index: 10000; box-shadow: 0 10px 40px rgba(82, 196, 26, 0.5);';
            successMsg.innerHTML = `
                <div style="text-align: center; color: #52c41a;">
                    <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3 style="margin: 0; font-family: Orbitron, sans-serif; color: #fff;">PDF Generated Successfully!</h3>
                    <p style="color: #8b9db8; margin: 0.5rem 0 0 0;">${filename}</p>
                </div>
            `;
            document.body.appendChild(successMsg);
            setTimeout(() => document.body.removeChild(successMsg), 3000);

        } catch (error) {
            document.body.removeChild(loadingMsg);
            console.error('PDF generation error:', error);
            alert('Error generating PDF. Please try again.');
        }
    }

    // ========================================================================
    // EXCEL EXPORT
    // ========================================================================

    async exportToExcel() {
        if (!this.currentProject) {
            window.toastManager.info('Create a project first by running a weather analysis', 'No Project Selected');
            return;
        }

        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(10, 25, 41, 0.95); padding: 3rem; border-radius: 15px; border: 2px solid #52c41a; z-index: 10000; box-shadow: 0 10px 40px rgba(82, 196, 26, 0.5);';
        loadingMsg.innerHTML = `
            <div style="text-align: center; color: #52c41a;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h3 style="margin: 0; font-family: Orbitron, sans-serif; color: #fff;">Generating Excel Report...</h3>
                <p style="color: #8b9db8; margin: 0.5rem 0 0 0;">Compiling data and charts</p>
            </div>
        `;
        document.body.appendChild(loadingMsg);

        try {
            const project = this.currentProject;
            const analysis = project.analysis;

            // Create workbook
            const wb = XLSX.utils.book_new();

            // ===== SHEET 1: PROJECT SUMMARY =====
            const summaryData = [
                ['XYLOCLIME PRO - WEATHER INTELLIGENCE REPORT'],
                [''],
                ['Project Information'],
                ['Project Name:', project.name],
                ['Location:', project.locationName],
                ['Start Date:', project.startDate],
                ['End Date:', project.endDate],
                ['Report Generated:', new Date().toLocaleDateString()],
                [''],
                ['Weather Analysis Summary'],
                ['Metric', 'Value'],
                ['Average High Temperature', this.formatTemp(parseFloat(analysis.avgTempMax), 'C')],
                ['Average Low Temperature', this.formatTemp(parseFloat(analysis.avgTempMin), 'C')],
                ['Expected Rainy Days', analysis.rainyDays],
                ['Heavy Rain Days', analysis.heavyRainDays || 0],
                ['Expected Snow Days', analysis.snowyDays],
                ['Freezing Days', analysis.freezingDays],
                ['Workable Days', analysis.workableDays || analysis.optimalDays],
                ['Ideal Days', analysis.idealDays || 0],
                ['Total Precipitation', this.formatPrecip(analysis.totalPrecip)],
                ['Total Snowfall', this.formatSnow(analysis.totalSnowfall)],
                ['Years of Historical Data', analysis.yearsAnalyzed],
                [''],
                ['Assessment'],
                ['Project Duration (days):', Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24))],
                ['Workable Days %:', `${Math.round(((analysis.workableDays || analysis.optimalDays) / Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24))) * 100)}%`],
                ['Ideal Days %:', `${Math.round(((analysis.idealDays || 0) / Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24))) * 100)}%`],
                [''],
                ['DISCLAIMER:'],
                ['This analysis is for planning purposes only.'],
                ['Not for life-safety decisions.'],
                ['Consult professional meteorologists for critical decisions.']
            ];

            const ws1 = XLSX.utils.aoa_to_sheet(summaryData);

            // Set column widths
            ws1['!cols'] = [
                { wch: 30 },
                { wch: 40 }
            ];

            XLSX.utils.book_append_sheet(wb, ws1, 'Project Summary');

            // ===== SHEET 2: DETAILED METRICS =====
            const metricsData = [
                ['DETAILED WEATHER METRICS'],
                [''],
                ['Category', 'Description', 'Value', 'Unit'],
                ['Temperature', 'Average High', this.formatTemp(parseFloat(analysis.avgTempMax), 'C', false), `°${this.tempUnit}`],
                ['Temperature', 'Average Low', this.formatTemp(parseFloat(analysis.avgTempMin), 'C', false), `°${this.tempUnit}`],
                ['Temperature', 'Mean Temperature', this.formatTemp(((parseFloat(analysis.avgTempMax) + parseFloat(analysis.avgTempMin)) / 2), 'C', false), `°${this.tempUnit}`],
                ['Precipitation', 'Rainy Days', analysis.rainyDays, 'days'],
                ['Precipitation', 'Heavy Rain Days', analysis.heavyRainDays || 0, 'days'],
                ['Precipitation', 'Snow Days', analysis.snowyDays, 'days'],
                ['Precipitation', 'Total Rain', this.formatPrecip(analysis.totalPrecip, false), this.unitSystem === 'imperial' ? 'in' : 'mm'],
                ['Precipitation', 'Total Snow', this.formatSnow(analysis.totalSnowfall, false), this.unitSystem === 'imperial' ? 'in' : 'cm'],
                ['Temperature Extremes', 'Freezing Days', analysis.freezingDays, 'days'],
                ['Temperature Extremes', 'Extreme Heat Days', analysis.extremeHeatDays, 'days'],
                ['Temperature Extremes', 'Extreme Cold Days', analysis.extremeColdDays, 'days'],
                ['Work Conditions', 'Workable Days', analysis.workableDays || analysis.optimalDays, 'days'],
                ['Work Conditions', 'Ideal Days', analysis.idealDays || 0, 'days'],
                ['Data Quality', 'Years Analyzed', analysis.yearsAnalyzed, 'years']
            ];

            const ws2 = XLSX.utils.aoa_to_sheet(metricsData);
            ws2['!cols'] = [
                { wch: 20 },
                { wch: 25 },
                { wch: 15 },
                { wch: 10 }
            ];

            XLSX.utils.book_append_sheet(wb, ws2, 'Detailed Metrics');

            // ===== SHEET 3: RECOMMENDATIONS =====
            const recsData = [
                ['STRATEGIC RECOMMENDATIONS'],
                [''],
                ['#', 'Recommendation', 'Priority'],
                [1, 'Monitor 10-day forecasts continuously for tactical schedule adjustments', 'HIGH'],
                [2, 'Maintain 10-15% schedule float minimum for weather contingencies', 'HIGH'],
                [3, 'Schedule critical path activities during optimal weather windows', 'HIGH'],
                [4, 'Implement comprehensive site drainage and erosion control', 'MEDIUM'],
                [5, 'Prepare contingency plans for adverse weather scenarios', 'HIGH'],
                [6, 'Establish weather monitoring and alert protocols', 'MEDIUM'],
                [7, 'Review insurance coverage for weather-related delays', 'MEDIUM'],
                [8, 'Develop cold-weather concrete curing procedures (if applicable)', 'LOW'],
                [9, 'Plan for potential equipment modifications for weather', 'LOW'],
                [10, 'Coordinate with meteorological services for site-specific forecasts', 'MEDIUM']
            ];

            const ws3 = XLSX.utils.aoa_to_sheet(recsData);
            ws3['!cols'] = [
                { wch: 5 },
                { wch: 70 },
                { wch: 12 }
            ];

            XLSX.utils.book_append_sheet(wb, ws3, 'Recommendations');

            // Generate and download file
            const filename = `XyloclimePro_${project.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, filename);

            document.body.removeChild(loadingMsg);

            const successMsg = document.createElement('div');
            successMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(10, 25, 41, 0.95); padding: 2rem 3rem; border-radius: 15px; border: 2px solid #52c41a; z-index: 10000; box-shadow: 0 10px 40px rgba(82, 196, 26, 0.5);';
            successMsg.innerHTML = `
                <div style="text-align: center; color: #52c41a;">
                    <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3 style="margin: 0; font-family: Orbitron, sans-serif; color: #fff;">Excel Generated Successfully!</h3>
                    <p style="color: #8b9db8; margin: 0.5rem 0 0 0;">${filename}</p>
                </div>
            `;
            document.body.appendChild(successMsg);
            setTimeout(() => document.body.removeChild(successMsg), 3000);

        } catch (error) {
            if (document.body.contains(loadingMsg)) {
                document.body.removeChild(loadingMsg);
            }
            console.error('Excel export error:', error);
            window.toastManager.error('Error generating Excel file. Please try again.', 'Export Failed', 7000);
        }
    }

    // ========================================================================
    // PROJECT MANAGEMENT
    // ========================================================================

    async saveProject(project) {
        try {
            // Save to Firestore
            const savedProject = await this.databaseManager.saveProject(project);

            // Update local array
            const existingIndex = this.projects.findIndex(p => p.id === savedProject.id);
            if (existingIndex >= 0) {
                this.projects[existingIndex] = savedProject;
            } else {
                this.projects.unshift(savedProject);
            }

            // Limit to 50 projects
            if (this.projects.length > 50) {
                this.projects = this.projects.slice(0, 50);
            }

            this.loadSavedProjects();
            this.sessionManager.logAction('project_saved', { projectId: savedProject.id });

            console.log('[APP] Project saved to cloud:', savedProject.name);
            // Success toast is shown in analysis completion, not here (to avoid duplicate notifications)
        } catch (error) {
            console.error('Failed to save project:', error);
            window.toastManager.error('Project could not be saved. Please check your internet connection.', 'Save Failed', 7000);
        }
    }

    async loadProjectsFromCloud() {
        try {
            console.log('[APP] Loading projects from cloud...');
            this.projects = await this.databaseManager.loadProjects();
            this.projectsLoaded = true;
            this.loadSavedProjects(); // Refresh UI
            console.log('[APP] Loaded', this.projects.length, 'projects from cloud');
        } catch (error) {
            console.error('[APP] Failed to load projects from cloud:', error);
            this.projects = [];
            this.projectsLoaded = true;
        }
    }

    async migrateAndLoadProjects() {
        // Try to migrate localStorage projects to Firestore
        const result = await this.databaseManager.migrateFromLocalStorage();

        if (result.success && result.count > 0) {
            console.log('[APP] Migrated', result.count, 'projects from localStorage to Firestore');
            // Show success message to user
            const message = `✅ Successfully migrated ${result.count} project${result.count > 1 ? 's' : ''} to cloud storage!`;
            alert(message);
        }

        // Load all projects from Firestore
        await this.loadProjectsFromCloud();
    }

    loadSavedProjects() {
        const container = document.getElementById('savedProjectsList');
        if (!container) return;

        container.innerHTML = '';

        // Update project selector dropdown
        this.updateProjectSelector();

        if (this.projects.length === 0) {
            container.innerHTML = `
                <p style="color: var(--steel-silver); font-size: 0.9rem; padding: 1rem; text-align: center;">
                    No saved projects yet
                </p>
                <button onclick="meteoryxApp.loadProjectsFromCloud()"
                        style="width: 100%; padding: 0.75rem; background: var(--gradient-button); border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: 600; margin-top: 0.5rem;">
                    <i class="fas fa-sync-alt"></i> Refresh Projects
                </button>
            `;
            return;
        }

        // Show more projects on mobile (20) vs desktop (10)
        const isMobile = window.innerWidth <= 768;
        const displayLimit = isMobile ? 20 : 10;
        const showAll = this.showAllProjects || false;

        const projectsToShow = showAll ? this.projects : this.projects.slice(0, displayLimit);

        console.log('[UI] Displaying', projectsToShow.length, 'of', this.projects.length, 'projects');

        projectsToShow.forEach(project => {
            const item = document.createElement('div');
            item.className = 'project-item';
            item.style.cssText = 'padding: 0.8rem; background: rgba(30, 58, 95, 0.3); border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem; transition: all 0.2s;';
            item.innerHTML = `
                <div style="color: var(--electric-cyan); font-weight: 600; margin-bottom: 0.3rem;">${this.sanitizeHTML(project.name)}</div>
                <div style="color: var(--steel-silver); font-size: 0.85rem;">${project.startDate || 'N/A'} - ${project.endDate || 'N/A'}</div>
            `;
            item.addEventListener('click', () => {
                this.loadProject(project.id);
                // Close mobile sidebar after selecting a project
                this.closeMobileSidebar();
            });
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(0, 212, 255, 0.2)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'rgba(30, 58, 95, 0.3)';
            });
            container.appendChild(item);
        });

        // Add "Show More" / "Show All" button if there are more projects
        if (this.projects.length > displayLimit) {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'margin-top: 1rem; display: flex; gap: 0.5rem;';

            if (!showAll) {
                const showAllBtn = document.createElement('button');
                showAllBtn.textContent = `Show All (${this.projects.length})`;
                showAllBtn.style.cssText = 'flex: 1; padding: 0.75rem; background: var(--gradient-button); border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: 600;';
                showAllBtn.onclick = () => {
                    this.showAllProjects = true;
                    this.loadSavedProjects();
                };
                buttonContainer.appendChild(showAllBtn);
            } else {
                const showLessBtn = document.createElement('button');
                showLessBtn.textContent = 'Show Less';
                showLessBtn.style.cssText = 'flex: 1; padding: 0.75rem; background: rgba(30, 58, 95, 0.6); border: 2px solid var(--electric-cyan); border-radius: 8px; color: var(--electric-cyan); cursor: pointer; font-weight: 600;';
                showLessBtn.onclick = () => {
                    this.showAllProjects = false;
                    this.loadSavedProjects();
                };
                buttonContainer.appendChild(showLessBtn);
            }

            // Add refresh button
            const refreshBtn = document.createElement('button');
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            refreshBtn.title = 'Refresh projects from cloud';
            refreshBtn.style.cssText = 'width: 50px; padding: 0.75rem; background: rgba(30, 58, 95, 0.6); border: 2px solid var(--electric-cyan); border-radius: 8px; color: var(--electric-cyan); cursor: pointer;';
            refreshBtn.onclick = () => this.loadProjectsFromCloud();
            buttonContainer.appendChild(refreshBtn);

            container.appendChild(buttonContainer);
        } else {
            // Just show refresh button
            const refreshBtn = document.createElement('button');
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            refreshBtn.style.cssText = 'width: 100%; margin-top: 1rem; padding: 0.75rem; background: rgba(30, 58, 95, 0.6); border: 2px solid var(--electric-cyan); border-radius: 8px; color: var(--electric-cyan); cursor: pointer; font-weight: 600;';
            refreshBtn.onclick = () => this.loadProjectsFromCloud();
            container.appendChild(refreshBtn);
        }
    }

    updateProjectSelector() {
        const selector = document.getElementById('projectSelector');
        if (!selector) return;

        // Keep current selection if exists
        const currentValue = selector.value;

        // Clear existing options except the default ones
        selector.innerHTML = `
            <option value="">Select Project</option>
            <option value="new">+ New Project</option>
        `;

        // Add project options
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `${project.name} (${project.startDate})`;
            selector.appendChild(option);
        });

        // Restore selection if still valid
        if (currentValue && this.projects.find(p => p.id === currentValue)) {
            selector.value = currentValue;
        }
    }

    loadProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) {
            window.toastManager.warning('Project not found. It may have been deleted.', 'Project Not Found');
            return;
        }

        try {
            console.log('[PROJECT] Loading project:', project.name);

            // Restore project state
            this.currentProject = project;
            this.weatherData = project.historicalData;

            // Restore selected location if available
            if (project.location) {
                this.selectedLocation = project.location;

                // Update map marker and view
                if (this.selectedMarker) {
                    this.map.removeLayer(this.selectedMarker);
                }
                this.selectedMarker = L.marker([project.location.lat, project.location.lng]).addTo(this.map);
                this.map.setView([project.location.lat, project.location.lng], 10);

                // Update location display in form
                document.getElementById('selectedLat').textContent = project.location.lat.toFixed(6);
                document.getElementById('selectedLng').textContent = project.location.lng.toFixed(6);
            }

            // Restore form fields
            const projectNameInput = document.getElementById('projectName');
            if (projectNameInput) {
                projectNameInput.value = project.name || '';
            }

            const locationSearchInput = document.getElementById('locationSearch');
            if (locationSearchInput && project.locationName) {
                locationSearchInput.value = project.locationName;
            }

            const startDateInput = document.getElementById('startDate');
            if (startDateInput && project.startDate) {
                startDateInput.value = project.startDate;
            }

            const endDateInput = document.getElementById('endDate');
            if (endDateInput && project.endDate) {
                endDateInput.value = project.endDate;
            }

            // Update dashboard with analysis data
            this.updateDashboard(project.analysis);

            // Update risk display if risk score exists
            if (project.riskScore !== undefined) {
                this.updateRiskDisplay(project.riskScore);
            } else if (project.analysis) {
                // Recalculate risk score if not stored
                const riskScore = this.calculateRiskScore(project.analysis);
                this.updateRiskDisplay(riskScore);
                // Save the calculated risk score
                project.riskScore = riskScore;
                this.saveProject(project);
            }

            // Display data quality info if available
            if (project.analysis) {
                this.displayDataQualityInfo(project.analysis);
            }

            // Charts are already rendered by updateDashboard() -> createAllCharts()
            // No need to call renderCharts separately

            // Switch to dashboard view
            document.getElementById('setupPanel').classList.add('hidden');
            document.getElementById('dashboardPanel').classList.remove('hidden');

            // Update project selector to show loaded project
            const selector = document.getElementById('projectSelector');
            if (selector) {
                selector.value = projectId;
            }

            console.log('[PROJECT] Project loaded successfully:', project.name);
            this.sessionManager.logAction('project_loaded', { projectId, projectName: project.name });

            // Show success toast
            window.toastManager.success(`Project "${project.name}" loaded successfully`, 'Project Loaded', 3000);

        } catch (error) {
            console.error('[PROJECT] Failed to load project:', error);
            window.toastManager.error('Failed to load project. The data may be corrupted. Try creating a new project.', 'Load Failed', 7000);
            this.showSetupPanel();
        }
    }

    // ========================================================================
    // UI HELPERS
    // ========================================================================

    showLoading() {
        document.getElementById('loadingSpinner').classList.remove('hidden');
        document.getElementById('setupPanel').classList.add('hidden');
        document.getElementById('dashboardPanel').classList.add('hidden');
    }

    showSetupPanel() {
        document.getElementById('setupPanel').classList.remove('hidden');
        document.getElementById('dashboardPanel').classList.add('hidden');
        document.getElementById('loadingSpinner').classList.add('hidden');
    }

    setDefaultDates() {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        if (tabName === 'dashboard') {
            this.showSetupPanel();
        }
    }

    showSettings() {
        alert('Settings panel coming soon! For now, configure via browser localStorage.');
    }

    // ========================================================================
    // MOBILE SIDEBAR TOGGLE
    // ========================================================================

    toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobileOverlay');
        const menuBtn = document.getElementById('mobileMenuBtn');

        if (sidebar && overlay && menuBtn) {
            const isOpen = sidebar.classList.contains('mobile-open');

            if (isOpen) {
                // Close sidebar
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
                menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            } else {
                // Open sidebar
                sidebar.classList.add('mobile-open');
                overlay.classList.add('active');
                menuBtn.innerHTML = '<i class="fas fa-times"></i>';
                console.log('[UI] Mobile sidebar opened');
            }
        }
    }

    closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobileOverlay');
        const menuBtn = document.getElementById('mobileMenuBtn');

        if (sidebar && overlay && menuBtn) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            console.log('[UI] Mobile sidebar closed');
        }
    }
}

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

// ============================================================================
// AUTHENTICATION MANAGER
// ============================================================================

class AuthManager {
    constructor() {
        this.auth = window.firebaseAuth;
        this.db = window.firebaseDb;
        this.currentUser = null;

        console.log('[AUTH] Authentication Manager initialized');
        this.initializeAuth();
    }

    initializeAuth() {
        // Check for existing user session
        this.auth.onAuthStateChanged(user => {
            console.log('[AUTH] Auth state changed:', user ? user.email : 'No user');
            this.currentUser = user;

            if (user) {
                // User is signed in - just hide auth screen
                // Let the main app decide whether to show terms or main app
                console.log('[AUTH] User logged in:', user.email);
                this.updateUserProfile(user);
                document.getElementById('authScreen').classList.add('hidden');
                console.log('[AUTH] Auth screen hidden, main app will take over navigation');

                // Load user's projects from Firestore (and migrate if needed)
                if (window.meteoryxApp && !window.meteoryxApp.projectsLoaded) {
                    window.meteoryxApp.migrateAndLoadProjects();
                }

                // Trigger main app initialization if not already done
                if (window.meteoryxApp && typeof window.meteoryxApp.init === 'function') {
                    // App already initialized, just update the display based on terms acceptance
                    if (window.meteoryxApp.termsManager.hasAcceptedTerms()) {
                        window.meteoryxApp.showMainApp();
                    } else {
                        window.meteoryxApp.showTermsScreen();
                    }
                }
            } else {
                // User is signed out
                console.log('[AUTH] No user logged in, showing auth screen');
                this.showAuthScreen();
            }
        });

        this.bindAuthEvents();
        this.bindUserProfileEvents();
    }

    updateUserProfile(user) {
        // Update user profile display in header
        const emailDisplay = document.getElementById('userEmailDisplay');
        const dropdownName = document.getElementById('userDropdownName');
        const dropdownEmail = document.getElementById('userDropdownEmail');

        if (emailDisplay) {
            emailDisplay.textContent = user.email;
        }

        if (dropdownName) {
            dropdownName.textContent = user.displayName || user.email.split('@')[0];
        }

        if (dropdownEmail) {
            dropdownEmail.textContent = user.email;
        }

        console.log('[AUTH] User profile updated in header');
    }

    bindUserProfileEvents() {
        // Toggle user dropdown menu
        const profileBtn = document.getElementById('userProfileBtn');
        const dropdown = document.getElementById('userDropdown');
        const logoutBtn = document.getElementById('logoutBtn');

        if (profileBtn && dropdown) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                dropdown.classList.add('hidden');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.signOut();
            });
        }
    }

    bindAuthEvents() {
        // Form switching
        document.getElementById('showSignup')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showSignupForm();
        });

        document.getElementById('showLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        document.getElementById('showForgotPassword')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPasswordForm();
        });

        document.getElementById('backToLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // Login
        document.getElementById('loginBtn')?.addEventListener('click', () => {
            this.handleLogin();
        });

        // Enter key for login
        document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Signup
        document.getElementById('signupBtn')?.addEventListener('click', () => {
            this.handleSignup();
        });

        // Google Sign In
        document.getElementById('googleLoginBtn')?.addEventListener('click', () => {
            this.handleGoogleSignIn();
        });

        document.getElementById('googleSignupBtn')?.addEventListener('click', () => {
            this.handleGoogleSignIn();
        });

        // Password Reset
        document.getElementById('resetPasswordBtn')?.addEventListener('click', () => {
            this.handlePasswordReset();
        });
    }

    showAuthScreen() {
        console.log('[AUTH] 🔄 Showing auth screen');
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('termsScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.add('hidden');

        // Reset all form buttons to their default state
        this.resetAuthForms();
    }

    resetAuthForms() {
        // Reset login button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }

        // Reset signup button
        const signupBtn = document.getElementById('signupBtn');
        if (signupBtn) {
            signupBtn.disabled = false;
            signupBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        }

        // Reset Google login buttons
        const googleLoginBtn = document.getElementById('googleLoginBtn');
        if (googleLoginBtn) {
            googleLoginBtn.disabled = false;
            googleLoginBtn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';
        }

        const googleSignupBtn = document.getElementById('googleSignupBtn');
        if (googleSignupBtn) {
            googleSignupBtn.disabled = false;
            googleSignupBtn.innerHTML = '<i class="fab fa-google"></i> Sign up with Google';
        }

        // Reset password reset button
        const resetPasswordBtn = document.getElementById('resetPasswordBtn');
        if (resetPasswordBtn) {
            resetPasswordBtn.disabled = false;
            resetPasswordBtn.innerHTML = '<i class="fas fa-envelope"></i> Send Reset Link';
        }

        // Clear form inputs
        const loginEmail = document.getElementById('loginEmail');
        const loginPassword = document.getElementById('loginPassword');
        if (loginEmail) loginEmail.value = '';
        if (loginPassword) loginPassword.value = '';

        console.log('[AUTH] All auth forms reset to default state');
    }

    showTermsScreen() {
        console.log('[AUTH] 🔄 Showing terms screen');
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('termsScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    showLoginForm() {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('forgotPasswordForm').classList.add('hidden');
    }

    showSignupForm() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('signupForm').classList.remove('hidden');
        document.getElementById('forgotPasswordForm').classList.add('hidden');
    }

    showForgotPasswordForm() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('forgotPasswordForm').classList.remove('hidden');
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }

        const btn = document.getElementById('loginBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            console.log('[AUTH] Login successful:', userCredential.user.email);
            // Auth state changed listener will handle navigation
        } catch (error) {
            console.error('[AUTH] Login error:', error);
            this.handleAuthError(error);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    }

    async handleSignup() {
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

        // Validation
        if (!name || !email || !password || !passwordConfirm) {
            alert('Please fill in all fields');
            return;
        }

        if (password !== passwordConfirm) {
            alert('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }

        const btn = document.getElementById('signupBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

        try {
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            console.log('[AUTH] Signup successful:', userCredential.user.email);

            // Update profile with display name
            await userCredential.user.updateProfile({
                displayName: name
            });

            // Create user document in Firestore
            await this.db.collection('users').doc(userCredential.user.uid).set({
                displayName: name,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                subscriptionTier: 'free',
                subscriptionStatus: 'active'
            });

            console.log('[AUTH] User document created');
            // Auth state changed listener will handle navigation
        } catch (error) {
            console.error('[AUTH] Signup error:', error);
            this.handleAuthError(error);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        }
    }

    async handleGoogleSignIn() {
        const provider = new firebase.auth.GoogleAuthProvider();

        try {
            const result = await this.auth.signInWithPopup(provider);
            console.log('[AUTH] Google sign-in successful:', result.user.email);

            // Create/update user document
            const userDoc = await this.db.collection('users').doc(result.user.uid).get();
            if (!userDoc.exists) {
                await this.db.collection('users').doc(result.user.uid).set({
                    displayName: result.user.displayName,
                    email: result.user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    subscriptionTier: 'free',
                    subscriptionStatus: 'active'
                });
                console.log('[AUTH] New Google user document created');
            }

            // Auth state changed listener will handle navigation
        } catch (error) {
            console.error('[AUTH] Google sign-in error:', error);
            this.handleAuthError(error);
        }
    }

    async handlePasswordReset() {
        const email = document.getElementById('resetEmail').value.trim();

        if (!email) {
            alert('Please enter your email address');
            return;
        }

        const btn = document.getElementById('resetPasswordBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        try {
            await this.auth.sendPasswordResetEmail(email);
            alert(`Password reset link sent to ${email}\n\nCheck your email and follow the instructions to reset your password.`);
            this.showLoginForm();
        } catch (error) {
            console.error('[AUTH] Password reset error:', error);
            this.handleAuthError(error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-envelope"></i> Send Reset Link';
        }
    }

    handleAuthError(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/user-not-found': 'No account found with this email. Please sign up.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/popup-closed-by-user': 'Sign-in cancelled.',
            'auth/network-request-failed': 'Network error. Please check your connection.'
        };

        const message = errorMessages[error.code] || `Error: ${error.message}`;
        alert(message);
    }

    async signOut() {
        try {
            // Clear terms acceptance so user must accept again on next login
            if (window.meteoryxApp && window.meteoryxApp.termsManager) {
                window.meteoryxApp.termsManager.clearAcceptance();
                console.log('[AUTH] Terms acceptance cleared');
            }

            await this.auth.signOut();
            console.log('[AUTH] User signed out');
            this.showAuthScreen();
        } catch (error) {
            console.error('[AUTH] Sign out error:', error);
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.authManager = new AuthManager();
        window.meteoryxApp = new XyloclimePro();
    });
} else {
    window.authManager = new AuthManager();
    window.meteoryxApp = new XyloclimePro();
}

console.log('[XYLOCLIME PRO] Application loaded successfully');
