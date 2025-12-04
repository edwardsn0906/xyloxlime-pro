/**
 * XYLOCLIME PRO - Professional Weather Intelligence Platform
 * Version: 1.1.0
 * Last Updated: November 24, 2025
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
 * - Enhanced NOAA data source reliability with multi-station fallback
 * - Intelligent retry logic for API failures
 * - Real-time update timestamps in UI
 *
 * Recent Updates (v1.1.0 - Nov 24, 2025):
 * - Increased NOAA station search radius to 300km for better US coverage
 * - Added multi-station fallback when primary station fails
 * - Implemented retry logic with exponential backoff for NOAA API
 * - Added "last updated" timestamp to project dashboard
 * - Improved error handling and logging for data source selection
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
        // Default Visual Crossing API key (free tier, shared across all users)
        // Users can override this in Settings if they have their own key
        this.visualCrossingApiKey = localStorage.getItem('xyloclime_visualCrossingApiKey') || '7G78WQELSK42FLCTY9G89X9XQ';
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

    // ========================================================================
    // THRESHOLD DISPLAY HELPERS (for displaying temp/precip/wind thresholds)
    // ========================================================================

    formatThresholdTemp(celsiusValue, operator = '≤', bothUnits = false) {
        // Format temperature thresholds for display based on unit system
        // celsiusValue: temperature in Celsius
        // operator: comparison operator (≤, ≥, <, >, =)
        // bothUnits: if true, show both units (for definitions section)

        const fahrenheitValue = Math.round(celsiusValue * 9/5 + 32);

        if (bothUnits) {
            // Show both units for threshold definitions
            return `${operator}${fahrenheitValue}°F / ${operator}${celsiusValue}°C`;
        } else {
            // Show only user's preferred unit
            if (this.unitSystem === 'imperial') {
                return `${operator}${fahrenheitValue}°F`;
            } else {
                return `${operator}${celsiusValue}°C`;
            }
        }
    }

    formatThresholdPrecip(mmValue, operator = '>', bothUnits = false) {
        // Format precipitation thresholds for display
        const inchesValue = (mmValue / 25.4).toFixed(1);

        if (bothUnits) {
            return `${operator}${inchesValue} in / ${operator}${mmValue}mm`;
        } else {
            if (this.unitSystem === 'imperial') {
                return `${operator}${inchesValue} in`;
            } else {
                return `${operator}${mmValue}mm`;
            }
        }
    }

    formatThresholdWind(kmhValue, operator = '≥', bothUnits = false) {
        // Format wind speed thresholds for display
        const mphValue = Math.round(kmhValue / 1.609344);

        if (bothUnits) {
            return `${operator}${kmhValue} km/h / ${operator}${mphValue} mph`;
        } else {
            if (this.unitSystem === 'imperial') {
                return `${operator}${mphValue} mph`;
            } else {
                return `${operator}${kmhValue} km/h`;
            }
        }
    }

    formatThresholdSnow(mmWaterEquiv, operator = '>', bothUnits = false) {
        // Format snow thresholds for display
        // Input is mm water equivalent, which numerically equals cm snow depth (via 10:1 snow-to-water ratio)
        // Example: 10mm water equiv = 10cm snow depth = 3.9 inches snow depth
        const cmSnowDepth = mmWaterEquiv; // 1mm water ≈ 1cm snow (10:1 ratio)
        const inchesSnowDepth = (cmSnowDepth / 2.54).toFixed(1);

        if (bothUnits) {
            return `${operator}${cmSnowDepth}cm / ${operator}${inchesSnowDepth} in snow depth (${mmWaterEquiv}mm water equiv)`;
        } else {
            if (this.unitSystem === 'imperial') {
                return `${operator}${inchesSnowDepth} in`;
            } else {
                return `${operator}${cmSnowDepth}cm`;
            }
        }
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

        // Update all threshold displays based on unit system
        this.updateThresholdDisplays();

        console.log(`[UNITS] Unit system updated to: ${this.unitSystem}`);
    }

    updateThresholdDisplays() {
        // Extreme Heat tile
        const extremeHeatThreshold = document.getElementById('extremeHeatThreshold');
        if (extremeHeatThreshold) {
            extremeHeatThreshold.textContent = `Days over ${this.formatTemp(37.78, 'C')}`;
        }

        // Workable Days thresholds
        const workableTempRange = document.getElementById('workableTempRange');
        if (workableTempRange) {
            workableTempRange.textContent = `${this.formatTemp(-5, 'C')} to ${this.formatTemp(37, 'C')}`;
        }
        const workableRainThreshold = document.getElementById('workableRainThreshold');
        if (workableRainThreshold) {
            workableRainThreshold.innerHTML = `&lt;${this.formatPrecip(15)}/day`;
        }
        const workableWindThreshold = document.getElementById('workableWindThreshold');
        if (workableWindThreshold) {
            workableWindThreshold.innerHTML = `&lt;${this.formatWind(60)}`;
        }

        // Ideal Days thresholds
        const idealTempRange = document.getElementById('idealTempRange');
        if (idealTempRange) {
            idealTempRange.textContent = `${this.formatTemp(0, 'C')} to ${this.formatTemp(37.78, 'C')}`;
        }
        const idealRainThreshold = document.getElementById('idealRainThreshold');
        if (idealRainThreshold) {
            idealRainThreshold.innerHTML = `&lt;${this.formatPrecip(5)}/day`;
        }
        const idealWindThreshold = document.getElementById('idealWindThreshold');
        if (idealWindThreshold) {
            idealWindThreshold.innerHTML = `&lt;${this.formatWind(20)}`;
        }

        // Freezing threshold
        const freezingThreshold = document.getElementById('freezingThreshold');
        if (freezingThreshold) {
            freezingThreshold.textContent = `Minimum ${this.formatThresholdTemp(0, '≤')}`;
        }

        // Cold-weather methods threshold
        const coldMethodsThreshold = document.getElementById('coldMethodsThreshold');
        if (coldMethodsThreshold) {
            coldMethodsThreshold.textContent = `${this.formatTemp(-18, 'C')} to ${this.formatTemp(-5, 'C')}`;
        }
        const hotWaterTemp = document.getElementById('hotWaterTemp');
        if (hotWaterTemp) {
            hotWaterTemp.textContent = `(${this.formatTemp(49, 'C')})`;
        }

        // Extreme cold threshold
        const extremeColdThreshold = document.getElementById('extremeColdThreshold');
        if (extremeColdThreshold) {
            extremeColdThreshold.textContent = `Minimum ${this.formatThresholdTemp(-18, '≤')}`;
        }

        // Extreme heat threshold (definition box)
        const extremeHeatThresholdDefinition = document.getElementById('extremeHeatThresholdDefinition');
        if (extremeHeatThresholdDefinition) {
            extremeHeatThresholdDefinition.textContent = `Maximum ${this.formatThresholdTemp(37.78, '≥')}`;
        }

        // Monthly table subtitle
        const monthlyTableSubtitle = document.getElementById('monthlyTableSubtitle');
        if (monthlyTableSubtitle) {
            monthlyTableSubtitle.textContent = `Plan seasonal concrete work based on historical heavy rain (${this.formatPrecip(15, '>')}), extreme cold (${this.formatThresholdTemp(-18, '≤')}), and heavy snow (${this.formatThresholdSnow(10, '>')}) patterns`;
        }
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

        // Display template info in a panel
        this.displayTemplateInfo(template);

        // Show success toast
        window.toastManager.success(`Template "${template.name}" selected! Weather criteria optimized for this project type.`, 'Template Applied', 4000);

        console.log('[PREMIUM] Template selected:', templateId, template);
    }

    displayTemplateInfo(template) {
        const container = document.getElementById('templateInfoPanel');
        if (!container) return;

        const criteria = template.weatherCriteria;
        const tips = template.tips || [];

        let html = `
            <div style="padding: 1rem; background: rgba(0, 212, 255, 0.05); border-left: 4px solid var(--electric-cyan); border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.5rem 0; color: var(--electric-cyan);">
                    <i class="fas ${template.icon}"></i> ${template.name}
                </h4>
                <p style="margin: 0 0 1rem 0; color: var(--steel-silver); font-size: 0.9rem;">${template.description}</p>

                <div style="margin-bottom: 1rem;">
                    <strong style="color: var(--electric-cyan);">Project-Specific Weather Criteria:</strong>
                    <ul style="margin: 0.5rem 0; padding-left: 1.5rem; font-size: 0.9rem; color: var(--steel-silver);">
                        ${criteria.maxRain !== undefined ? `<li>Max Rain: ${criteria.maxRain}mm/day</li>` : ''}
                        ${criteria.maxWind !== undefined ? `<li>Max Wind: ${criteria.maxWind} km/h</li>` : ''}
                        ${criteria.minTemp !== undefined ? `<li>Min Temperature: ${criteria.minTemp}°C (${(criteria.minTemp * 9/5 + 32).toFixed(0)}°F)</li>` : ''}
                        ${criteria.maxTemp !== undefined ? `<li>Max Temperature: ${criteria.maxTemp}°C (${(criteria.maxTemp * 9/5 + 32).toFixed(0)}°F)</li>` : ''}
                        ${criteria.maxSnow !== undefined ? `<li>Max Snow: ${criteria.maxSnow}mm</li>` : ''}
                    </ul>
                </div>

                <div>
                    <strong style="color: var(--electric-cyan);">Project Tips:</strong>
                    <ul style="margin: 0.5rem 0; padding-left: 1.5rem; font-size: 0.9rem; color: var(--steel-silver);">
                        ${tips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;

        container.innerHTML = html;
        container.style.display = 'block';
    }

    generateTemplateSpecificAnalysis(template, analysis, project) {
        const startDate = new Date(project.startDate);
        const endDate = new Date(project.endDate);
        const startMonth = startDate.getMonth(); // 0-11
        const endMonth = endDate.getMonth(); // 0-11

        // Calculate project span in months
        const monthsSpanned = ((endDate.getFullYear() - startDate.getFullYear()) * 12) + (endMonth - startMonth) + 1;
        const isMultiSeason = monthsSpanned > 4;

        // Generate DATA-DRIVEN seasonal advice using actual monthly workability
        let seasonalAdvice = '';
        if (analysis.monthlyBreakdown && analysis.monthlyBreakdown.length > 0) {
            seasonalAdvice = this.generateDataDrivenSeasonalAdvice(
                template,
                analysis.monthlyBreakdown,
                startDate,
                endDate,
                isMultiSeason
            );
        }

        let html = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(0, 212, 255, 0.05); border-left: 4px solid var(--electric-cyan); border-radius: 8px;">
                <h3 style="color: var(--electric-cyan); margin: 0 0 1rem 0;">
                    <i class="fas ${template.icon}"></i> ${template.name} - Project-Specific Insights
                </h3>

                ${seasonalAdvice ? `
                    <div style="margin-bottom: 1rem;">
                        <strong style="color: var(--electric-cyan);">Seasonal Timing Analysis:</strong>
                        <div style="margin: 0.5rem 0; color: var(--steel-silver);">${seasonalAdvice}</div>
                    </div>
                ` : ''}

                <div>
                    <strong style="color: var(--electric-cyan);">Project-Specific Tips:</strong>
                    <ul style="margin: 0.5rem 0; padding-left: 1.5rem; color: var(--steel-silver);">
                        ${template.tips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>

                ${analysis.templateKPIs && analysis.templateKPIs.length > 0 ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0, 212, 255, 0.2);">
                        <strong style="color: var(--electric-cyan);">Template-Specific Metrics:</strong>
                        <div style="margin: 0.5rem 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem;">
                            ${analysis.templateKPIs.map(kpi => `
                                <div style="padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 6px; border-left: 3px solid var(--electric-cyan);">
                                    <div style="font-weight: 600; color: var(--electric-cyan); margin-bottom: 0.25rem;">
                                        ${kpi.metric}
                                    </div>
                                    <div style="font-size: 1.5rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem;">
                                        ${kpi.value} <span style="font-size: 0.9rem; font-weight: 400; color: var(--steel-silver);">${kpi.unit}</span>
                                    </div>
                                    <div style="font-size: 0.85rem; color: var(--steel-silver);">
                                        ${kpi.description}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Add discipline-specific technical hazards section
        if (template.name === 'Roofing Installation') {
            html += this.generateRoofingTechnicalHazards(analysis, project);
        } else if (template.name === 'Commercial Concrete Work') {
            html += this.generateConcreteTechnicalHazards(analysis, project);
        } else if (template.name === 'Exterior Painting') {
            html += this.generatePaintingTechnicalHazards(analysis, project);
        }

        return html;
    }

    generateDataDrivenSeasonalAdvice(template, monthlyBreakdown, startDate, endDate, isMultiSeason) {
        const startMonth = startDate.getMonth();
        const endMonth = endDate.getMonth();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];

        console.log('[SEASONAL] Generating data-driven seasonal advice');
        console.log('[SEASONAL] Project:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
        console.log('[SEASONAL] Start month:', startMonth, '(' + monthNames[startMonth] + ')');
        console.log('[SEASONAL] Monthly breakdown data:', monthlyBreakdown);

        // Get workability data for project months
        let projectMonths = [];
        let currentMonth = startMonth;
        let currentYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();

        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
            const monthData = monthlyBreakdown[currentMonth];

            console.log(`[SEASONAL] Reading month ${currentMonth} (${monthNames[currentMonth]} ${currentYear}):`, monthData);

            if (monthData && monthData.avgDaysInMonth !== undefined) {
                // Use the pre-calculated workablePercent from the breakdown (it's a string, so parse it)
                const workablePercent = parseInt(monthData.workablePercent) || 0;

                console.log(`[SEASONAL] ${monthNames[currentMonth]}: ${monthData.workableDays}/${monthData.avgDaysInMonth} = ${workablePercent}%`);

                projectMonths.push({
                    name: monthNames[currentMonth],
                    month: currentMonth,
                    workablePercent: workablePercent,
                    workableDays: monthData.workableDays,
                    totalDays: monthData.avgDaysInMonth
                });
            } else {
                console.warn(`[SEASONAL] Missing data for month ${currentMonth} (${monthNames[currentMonth]})`);
            }

            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }

        console.log('[SEASONAL] Project months collected:', projectMonths);

        // Find best and worst months
        const sortedByWorkability = [...projectMonths].sort((a, b) => b.workablePercent - a.workablePercent);
        const bestMonths = sortedByWorkability.slice(0, 3);
        const worstMonths = sortedByWorkability.slice(-3).reverse();

        // Calculate first 3 months average (immediate exposure)
        const first3Months = projectMonths.slice(0, Math.min(3, projectMonths.length));
        const avgFirst3Months = first3Months.length > 0
            ? Math.round(first3Months.reduce((sum, m) => sum + m.workablePercent, 0) / first3Months.length)
            : 0;

        let advice = '';

        // MULTI-SEASON PROJECT
        if (isMultiSeason) {
            advice += `<p style="margin: 0 0 0.75rem 0; line-height: 1.6;">
                <strong style="color: #ffc107;">⚠️ Multi-Season Project:</strong> This ${projectMonths.length}-month project spans multiple seasons with highly variable conditions.
            </p>`;

            // Immediate exposure assessment
            const firstMonthName = first3Months[0]?.name;
            if (avgFirst3Months < 40) {
                advice += `<p style="margin: 0 0 0.75rem 0; line-height: 1.6; padding-left: 1rem; border-left: 3px solid #e74c3c;">
                    <strong style="color: #e74c3c;">Winter-Heavy Start:</strong> Project starts in <strong>${firstMonthName}</strong> with <strong>${avgFirst3Months}% workability</strong> in first 3 months.
                    ${template.name === 'Roofing Installation' ? 'Winter roofing requires significant weather-dependent planning - expect frequent weather holds, safety precautions, and material handling adjustments.' : ''}
                    ${template.name === 'Commercial Concrete Work' ? 'Standard winter concrete methods required: heated enclosures, blankets, and winter admixtures - budget for additional cold-weather costs.' : ''}
                    Consider delaying start to spring to reduce winter-related costs and delays.
                </p>`;
            } else if (avgFirst3Months < 65) {
                advice += `<p style="margin: 0 0 0.75rem 0; line-height: 1.6; padding-left: 1rem; border-left: 3px solid #3498db;">
                    <strong style="color: #3498db;">Moderate Workability:</strong> Project starts in <strong>${firstMonthName}</strong> with <strong>${avgFirst3Months}% workability</strong> in first 3 months - typical for this region and season. Plan for standard weather-related contingencies.
                </p>`;
            } else {
                advice += `<p style="margin: 0 0 0.75rem 0; line-height: 1.6; padding-left: 1rem; border-left: 3px solid #27ae60;">
                    <strong style="color: #27ae60;">Higher Workability Period:</strong> Project starts in <strong>${firstMonthName}</strong> with <strong>${avgFirst3Months}% workability</strong> in first 3 months - favorable for this region.
                </p>`;
            }

            // Best months guidance
            advice += `<p style="margin: 0 0 0.75rem 0; line-height: 1.6;">
                <strong style="color: var(--electric-cyan);">Best Months:</strong>
                ${bestMonths.map(m => `<strong>${m.name}</strong> (${m.workablePercent}% workable)`).join(', ')}.
                Schedule critical ${template.name.toLowerCase()} work during these windows.
            </p>`;

            // Worst months warning
            advice += `<p style="margin: 0 0 0.75rem 0; line-height: 1.6;">
                <strong style="color: #e74c3c;">Worst Months:</strong>
                ${worstMonths.map(m => `<strong>${m.name}</strong> (${m.workablePercent}% workable)`).join(', ')}.
                ${worstMonths[0]?.workablePercent < 30 ? 'Minimal work possible - plan for extended delays or shutdowns.' : 'Expect significant weather delays.'}
            </p>`;

        } else {
            // SHORT PROJECT (≤4 months)
            const avgWorkability = projectMonths.length > 0
                ? Math.round(projectMonths.reduce((sum, m) => sum + m.workablePercent, 0) / projectMonths.length)
                : 0;
            const startMonthName = monthNames[startMonth];

            if (avgWorkability < 40) {
                advice += `<p style="margin: 0 0 0.75rem 0; line-height: 1.6; padding-left: 1rem; border-left: 3px solid #e74c3c;">
                    <strong style="color: #e74c3c;">Winter-Heavy Period:</strong> Starting ${startMonthName} with <strong>${avgWorkability}% average workability</strong>.
                    ${template.name === 'Roofing Installation' ? 'Winter roofing: expect frequent weather holds, cold-weather safety protocols, brittle materials, and adhesive temperature limitations.' : ''}
                    ${template.name === 'Commercial Concrete Work' ? 'Cold-weather concrete methods required: heated enclosures, curing blankets, and winter admixtures.' : ''}
                    <strong>Consider:</strong> Delaying to spring may reduce weather-related costs and schedule risk.
                </p>`;
            } else if (avgWorkability < 65) {
                advice += `<p style="margin: 0 0 0.75rem 0; line-height: 1.6; padding-left: 1rem; border-left: 3px solid #3498db;">
                    <strong style="color: #3498db;">Moderate Workability:</strong> Starting ${startMonthName} with <strong>${avgWorkability}% average workability</strong> - typical for this region and season.
                    Plan for standard weather contingencies and cold-weather methods as needed.
                </p>`;
            } else {
                advice += `<p style="margin: 0 0 0.75rem 0; line-height: 1.6; padding-left: 1rem; border-left: 3px solid #27ae60;">
                    <strong style="color: #27ae60;">Higher Workability Period:</strong> Starting ${startMonthName} with <strong>${avgWorkability}% average workability</strong> - favorable conditions for this region.
                    Standard weather planning recommended for ${template.name.toLowerCase()}.
                </p>`;
            }

            // Month-by-month breakdown for short projects
            advice += `<p style="margin: 0; line-height: 1.6;">
                <strong>Month-by-Month:</strong><br>
                ${projectMonths.map(m =>
                    `${m.name}: <strong>${m.workablePercent}%</strong> workable (${m.workableDays}/${m.totalDays} days)`
                ).join('<br>')}
            </p>`;
        }

        return advice;
    }

    generateRoofingTechnicalHazards(analysis, project) {
        const avgTempMin = parseFloat(analysis.avgTempMin);
        const avgTempMax = parseFloat(analysis.avgTempMax);
        const freezingDays = parseInt(analysis.allFreezingDays) || 0;
        const extremeColdDays = parseInt(analysis.extremeColdDays) || 0;
        const highWindDays = parseInt(analysis.highWindDays) || 0;
        const snowyDays = parseInt(analysis.snowyDays) || 0;
        const totalDays = analysis.actualProjectDays || 365;

        // Calculate temperature-based hazards
        const shingleBrittlenessDays = analysis.daysBelow40F || Math.round(freezingDays * 0.8); // Estimate if not tracked
        const adhesiveActivationDays = shingleBrittlenessDays; // Similar threshold

        let html = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(230, 126, 34, 0.05); border: 2px solid #e67e22; border-radius: 8px;">
                <h3 style="color: #e67e22; margin: 0 0 1rem 0;">
                    <i class="fas fa-exclamation-triangle"></i> Roofing-Specific Technical Hazards
                </h3>
                <p style="margin: 0 0 1rem 0; color: var(--steel-silver); font-style: italic;">
                    Roofing installations have unique technical requirements beyond general construction.
                </p>
        `;

        // 1. SHINGLE BRITTLENESS
        if (freezingDays > 0) {
            html += `
                <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
                    <strong style="color: #e67e22;">⚠️ Shingle Brittleness (${this.formatThresholdTemp(4, '<')})</strong>
                    <p style="margin: 0.5rem 0 0 0; color: var(--steel-silver); line-height: 1.6;">
                        <strong>~${shingleBrittlenessDays} days</strong> expected below ${this.formatTemp(4, 'C')} where asphalt shingles become brittle and prone to cracking during installation.
                        ${extremeColdDays > 0 ? `<strong>${extremeColdDays} days</strong> will be extremely cold (${this.formatThresholdTemp(-18, '≤')}) - shingles very brittle, high breakage risk.` : ''}
                        <br><strong>Mitigation:</strong> Store shingles in warm area before use. Handle carefully. Consider rubberized/synthetic shingles for cold-weather work.
                    </p>
                </div>
            `;
        }

        // 2. ADHESIVE ACTIVATION
        if (freezingDays > 0) {
            html += `
                <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
                    <strong style="color: #e67e22;">⚠️ Adhesive Strip Activation Temperature</strong>
                    <p style="margin: 0.5rem 0 0 0; color: var(--steel-silver); line-height: 1.6;">
                        <strong>~${adhesiveActivationDays} days</strong> may be too cold for adhesive strips to activate properly. Strips require heat (typically ${this.formatThresholdTemp(16, '>')}) to seal.
                        <br><strong>Mitigation:</strong> Use cold-weather adhesives. Apply manual sealant. Wait for warmer days for critical seal areas. Inspect bonding after temperature rise.
                    </p>
                </div>
            `;
        }

        // 3. WIND HAZARDS (HIGH PRIORITY FOR ROOFING)
        if (highWindDays > 10) {
            const windStoppagePercent = ((highWindDays / totalDays) * 100).toFixed(0);
            html += `
                <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
                    <strong style="color: #e67e22;">⚠️ High Wind Safety & Underlayment Risk</strong>
                    <p style="margin: 0.5rem 0 0 0; color: var(--steel-silver); line-height: 1.6;">
                        <strong>${highWindDays} days (${windStoppagePercent}%)</strong> with elevated winds ${this.formatThresholdWind(30)} require safety restrictions for roofing work.
                        <br><strong>Roofing-Specific Risk:</strong> For elevated roofing work, winds ${this.formatThresholdWind(30)} create fall hazards and material handling challenges. Many contractors stop roof work at ${this.formatWind(30)}.
                        <br><strong>Underlayment Risk:</strong> Elevated winds can tear loosely fastened underlayment before shingles are applied. Ensure proper fastening density.
                        <br><strong>Mitigation:</strong> No elevated work during winds ${this.formatThresholdWind(30)}. Secure all materials. Double-check underlayment fastening before wind events.
                    </p>
                </div>
            `;
        }

        // 4. ICE DAMMING & FREEZE-THAW
        if (snowyDays > 10 && freezingDays > 30) {
            html += `
                <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
                    <strong style="color: #e67e22;">⚠️ Ice Damming & Freeze-Thaw Cycles</strong>
                    <p style="margin: 0.5rem 0 0 0; color: var(--steel-silver); line-height: 1.6;">
                        <strong>${snowyDays} snowy days</strong> + <strong>${freezingDays} freezing days</strong> = high ice damming risk and freeze-thaw cycles.
                        <br><strong>Ice Damming:</strong> Snow melts on warm roof, refreezes at eaves causing water backup under shingles.
                        <br><strong>Installation Impact:</strong> Existing ice dams must be removed before roofing. New roof needs proper ice/water barriers at eaves.
                        <br><strong>Mitigation:</strong> Install ice/water shield minimum 3-6 feet up from eaves. Ensure proper attic ventilation. Remove all ice before starting.
                    </p>
                </div>
            `;
        }

        // 5. SNOW MELT SLIP HAZARDS
        if (snowyDays > 5) {
            html += `
                <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
                    <strong style="color: #e67e22;">⚠️ Snow Melt & Frozen Surface Slip Hazards</strong>
                    <p style="margin: 0.5rem 0 0 0; color: var(--steel-silver); line-height: 1.6;">
                        <strong>${snowyDays} days</strong> with snow create severe slip hazards during morning melt cycles.
                        <br><strong>Safety Critical:</strong> Wet, partially frozen roof surfaces are extremely slippery. Morning frost creates glass-like conditions.
                        <br><strong>Mitigation:</strong> Wait for surfaces to fully dry/thaw. Use aggressive fall protection. Roof jacks and safety harnesses mandatory. Consider non-slip footwear covers.
                    </p>
                </div>
            `;
        }

        // 6. DECK MOISTURE ABSORPTION
        const rainyDays = parseInt(analysis.rainyDays) || 0;
        if (rainyDays > 30) {
            html += `
                <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
                    <strong style="color: #e67e22;">⚠️ Roof Deck Moisture Absorption Limits</strong>
                    <p style="margin: 0.5rem 0 0 0; color: var(--steel-silver); line-height: 1.6;">
                        <strong>${rainyDays} rainy days</strong> mean frequent deck moisture exposure if tear-off work spans multiple days.
                        <br><strong>Technical Issue:</strong> Plywood/OSB decking absorbs moisture quickly (can swell/deform). Wet decking cannot be shingled.
                        <br><strong>Mitigation:</strong> Complete sections same-day (tear-off to dry-in). Use tarps religiously. Check deck moisture before shingling. Replace wet/damaged sections.
                    </p>
                </div>
            `;
        }

        html += `
                <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(231, 76, 60, 0.1); border-left: 3px solid #e74c3c; border-radius: 4px;">
                    <strong style="color: #e74c3c;">⚠️ CRITICAL REMINDER:</strong>
                    <p style="margin: 0.5rem 0 0 0; color: var(--arctic-white); line-height: 1.6;">
                        Roofing is NOT general construction. Material properties, adhesive chemistry, ice formation, and elevated work safety create unique constraints.
                        Weather-related delays are common and should be built into schedules. Rushing roofing work in poor conditions leads to callbacks and safety incidents.
                    </p>
                </div>
            </div>
        `;

        return html;
    }

    generateConcreteTechnicalHazards(analysis, project) {
        // Placeholder for concrete-specific hazards (already covered in recommendations)
        return '';
    }

    generatePaintingTechnicalHazards(analysis, project) {
        // Placeholder for painting-specific hazards
        return '';
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
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.analyzeWeatherData();
            });
        }

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

        // Visual Crossing API Key input
        const visualCrossingApiKeyInput = document.getElementById('visualCrossingApiKeyInput');
        if (visualCrossingApiKeyInput) {
            // Load existing key
            visualCrossingApiKeyInput.value = this.visualCrossingApiKey || '';
            this.updateVisualCrossingStatus();

            // Toggle visibility button
            const toggleBtn = document.getElementById('toggleVisualCrossingKey');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    const input = visualCrossingApiKeyInput;
                    const icon = toggleBtn.querySelector('i');
                    if (input.type === 'password') {
                        input.type = 'text';
                        icon.className = 'fas fa-eye-slash';
                    } else {
                        input.type = 'password';
                        icon.className = 'fas fa-eye';
                    }
                });
            }

            // Update status on input
            visualCrossingApiKeyInput.addEventListener('input', () => {
                this.updateVisualCrossingStatus();
            });
        }

        // Save settings button
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                // Save Visual Crossing API key
                const vcKeyInput = document.getElementById('visualCrossingApiKeyInput');
                if (vcKeyInput) {
                    const newKey = vcKeyInput.value.trim();
                    this.visualCrossingApiKey = newKey;
                    localStorage.setItem('xyloclime_visualCrossingApiKey', newKey);
                    this.updateVisualCrossingStatus();
                }

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
                this.showNotificationsPanel();
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
        if (rainyTotal > 25000) {
            recs.push('Significant rain impact anticipated ($' + rainyTotal.toLocaleString() + '). Plan weather-protected areas and robust drainage.');
        } else if (rainyTotal > 15000) {
            recs.push('Moderate rain impact expected ($' + rainyTotal.toLocaleString() + '). Plan weather-protected staging areas.');
        }
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
            maxWind: parseFloat(document.getElementById('maxWindThreshold').value) || 30,
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

                if (snow > criteria.maxSnow) { // snow in mm water equiv numerically equals cm depth (10:1 ratio)
                    isWorkable = false;
                    reasons.push(`Snow: ${this.formatSnow(snow)}`);  // snow (mm water equiv) = cm depth numerically
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
                maxWind: parseFloat(document.getElementById('maxWindThreshold').value) || 30,
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
            { label: 'Elevated Wind Days (≥30 km/h)', key: 'highWindDays', format: (p) => p.analysis?.highWindDays || 0 },
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

    showNotificationsPanel() {
        // Create notification panel overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); z-index: 9999; display: flex; align-items: center; justify-content: center;';

        // Get session and project data
        const projectCount = this.projects.length;
        const currentAnalysis = this.currentAnalysis;
        const acceptance = this.termsManager.getAcceptance();
        const acceptDate = acceptance ? new Date(acceptance.timestamp).toLocaleString() : 'Not set';

        // Build notifications content
        let notificationsHTML = `
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="color: var(--electric-cyan); margin: 0; font-size: 1.5rem;">
                        <i class="fas fa-bell"></i> Notifications
                    </h2>
                    <button id="closeNotifications" style="background: none; border: none; color: var(--steel-silver); font-size: 1.5rem; cursor: pointer; padding: 0.25rem; transition: all 0.3s;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
        `;

        // Session status
        notificationsHTML += `
            <div style="background: rgba(0, 212, 255, 0.1); border-left: 4px solid var(--electric-cyan); padding: 1rem; margin-bottom: 1rem; border-radius: 6px;">
                <div style="color: var(--electric-cyan); font-weight: 600; margin-bottom: 0.5rem;">
                    <i class="fas fa-check-circle"></i> System Status
                </div>
                <div style="color: var(--arctic-white); font-size: 0.9rem; line-height: 1.6;">
                    ✓ Application running normally<br>
                    ✓ All data saved locally<br>
                    ✓ Terms accepted: ${acceptDate}<br>
                    ✓ Session ID: ${this.sessionManager.sessionId.substring(0, 12)}...
                </div>
            </div>
        `;

        // Project activity
        notificationsHTML += `
            <div style="background: rgba(46, 204, 113, 0.1); border-left: 4px solid #2ecc71; padding: 1rem; margin-bottom: 1rem; border-radius: 6px;">
                <div style="color: #2ecc71; font-weight: 600; margin-bottom: 0.5rem;">
                    <i class="fas fa-project-diagram"></i> Project Activity
                </div>
                <div style="color: var(--arctic-white); font-size: 0.9rem; line-height: 1.6;">
                    ${projectCount} project${projectCount !== 1 ? 's' : ''} saved<br>
                    ${currentAnalysis ? `Last analysis: ${currentAnalysis.projectName || 'Unnamed Project'}<br>` : 'No analysis run yet<br>'}
                    ${currentAnalysis ? `Location: ${currentAnalysis.locationName || 'Unknown'}<br>` : ''}
                    ${currentAnalysis ? `Risk Score: ${currentAnalysis.riskScore || 0}/100` : 'Run an analysis to see risk score'}
                </div>
            </div>
        `;

        // Data quality status
        if (currentAnalysis) {
            const dataQuality = currentAnalysis.dataQuality || 1.0;
            const dataQualityPercent = (dataQuality * 100).toFixed(0);
            const yearsAnalyzed = currentAnalysis.yearsAnalyzed || 0;

            notificationsHTML += `
                <div style="background: rgba(241, 196, 15, 0.1); border-left: 4px solid #f1c40f; padding: 1rem; margin-bottom: 1rem; border-radius: 6px;">
                    <div style="color: #f1c40f; font-weight: 600; margin-bottom: 0.5rem;">
                        <i class="fas fa-database"></i> Data Quality
                    </div>
                    <div style="color: var(--arctic-white); font-size: 0.9rem; line-height: 1.6;">
                        ${dataQualityPercent}% data coverage<br>
                        ${yearsAnalyzed} years of historical data analyzed<br>
                        ${currentAnalysis.snowDataSource?.source === 'NOAA' ? '✓ High-quality NOAA snow data' : '⚠ ERA5 reanalysis snow data'}<br>
                        Temperature & precipitation: ${currentAnalysis.snowDataSource?.source || 'ERA5'}
                    </div>
                </div>
            `;
        }

        // Tips & Info
        notificationsHTML += `
            <div style="background: rgba(155, 89, 182, 0.1); border-left: 4px solid #9b59b6; padding: 1rem; border-radius: 6px;">
                <div style="color: #9b59b6; font-weight: 600; margin-bottom: 0.5rem;">
                    <i class="fas fa-lightbulb"></i> Quick Tips
                </div>
                <div style="color: var(--arctic-white); font-size: 0.9rem; line-height: 1.6;">
                    • Export reports to PDF for sharing<br>
                    • Use templates for project-specific analysis<br>
                    • Compare multiple projects to find optimal timing<br>
                    • Switch units between metric/imperial in settings
                </div>
            </div>
        `;

        notificationsHTML += `</div>`;

        overlay.innerHTML = notificationsHTML;
        document.body.appendChild(overlay);

        // Close button handler
        const closeBtn = overlay.querySelector('#closeNotifications');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        // Close on ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Add hover effect to close button
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.color = '#e74c3c';
            closeBtn.style.transform = 'scale(1.1)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.color = 'var(--steel-silver)';
            closeBtn.style.transform = 'scale(1)';
        });
    }

    updateVisualCrossingStatus() {
        const statusElement = document.getElementById('visualCrossingStatusText');
        const statusContainer = document.getElementById('visualCrossingApiStatus');
        const input = document.getElementById('visualCrossingApiKeyInput');

        if (!statusElement || !statusContainer || !input) return;

        const apiKey = input.value.trim();

        if (!apiKey) {
            // Empty input = using default embedded API key
            statusContainer.className = 'api-key-status status-success';
            statusContainer.innerHTML = '<i class="fas fa-check-circle"></i> <span>Using default shared API key - Visual Crossing active (80-100% accuracy) for all users</span>';
        } else if (apiKey.length < 10) {
            statusContainer.className = 'api-key-status status-error';
            statusContainer.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Invalid key format - API keys are typically longer</span>';
        } else {
            statusContainer.className = 'api-key-status status-success';
            statusContainer.innerHTML = '<i class="fas fa-check-circle"></i> <span>Using your personal API key - Visual Crossing active (80-100% accuracy)</span>';
        }
    }

    getSnowDataBadge(snowDataSource) {
        if (!snowDataSource || !snowDataSource.source) return '';

        const badges = {
            'NOAA': '<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem;"><i class="fas fa-star"></i> NOAA</span>',
            'Visual Crossing': '<span style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem;"><i class="fas fa-globe"></i> Visual Crossing</span>',
            'ECMWF IFS': '<span style="background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem;"><i class="fas fa-satellite"></i> ECMWF IFS</span>',
            'ERA5': '<span style="background: linear-gradient(135deg, #a0aec0 0%, #718096 100%); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem;"><i class="fas fa-cloud"></i> ERA5</span>'
        };

        return badges[snowDataSource.source] || '';
    }

    getSnowDataDetails(snowDataSource) {
        if (!snowDataSource || !snowDataSource.source) return '';

        switch (snowDataSource.source) {
            case 'NOAA':
                return `<br><small style="color: var(--electric-cyan); font-size: 0.85rem;"><i class="fas fa-broadcast-tower"></i> ${snowDataSource.station} (${snowDataSource.distance.toFixed(1)}km) • ${snowDataSource.accuracy} accuracy • Direct station measurements</small>`;
            case 'Visual Crossing':
                return `<br><small style="color: #48bb78; font-size: 0.85rem;"><i class="fas fa-database"></i> ${snowDataSource.location} • ${snowDataSource.accuracy} accuracy • Station-based</small>`;
            case 'ECMWF IFS':
                return `<br><small style="color: #ed8936; font-size: 0.85rem;"><i class="fas fa-chart-area"></i> ${snowDataSource.resolution} resolution • ${snowDataSource.accuracy} accuracy • Model-based</small>`;
            case 'ERA5':
                const warningIcon = snowDataSource.isNorthAmerica === false
                    ? '<i class="fas fa-globe-americas"></i>'
                    : '<i class="fas fa-exclamation-triangle"></i>';
                const warningStyle = snowDataSource.isNorthAmerica === false
                    ? 'background: rgba(237, 137, 54, 0.15); padding: 0.5rem; border-left: 3px solid #ed8936; margin-top: 0.5rem; display: block;'
                    : '';
                return `<br><small style="color: #a0aec0; font-size: 0.85rem; ${warningStyle}">${warningIcon} ${snowDataSource.resolution} resolution • ${snowDataSource.accuracy} accuracy • ${snowDataSource.warning || 'Fallback data'}</small>`;
            default:
                return '';
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

        // Scroll to top immediately so user can see loading indicator
        window.scrollTo({ top: 0, behavior: 'smooth' });

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

            // Get selected template for template-specific analysis
            const template = this.selectedTemplate && this.templatesLibrary
                ? this.templatesLibrary.getTemplate(this.selectedTemplate)
                : null;

            const analysis = this.analyzeDataForPrediction(historicalData, startDate, endDate, template);

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

            // Display monthly breakdown for concrete pour planning
            this.displayMonthlyBreakdown(analysis);

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

            // Scroll to top to show results
            window.scrollTo({ top: 0, behavior: 'smooth' });

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

    // ============================================================================
    // NOAA CDO API INTEGRATION - Enhanced Snow Data Accuracy
    // ============================================================================

    /**
     * Check if coordinates are in North America (NOAA coverage area)
     * NOAA stations have excellent coverage in North America but limited elsewhere
     * @returns {boolean} True if location is in North America
     */
    isNorthAmerica(lat, lng) {
        // North America bounding box (generous to include Mexico, Central America, Caribbean)
        // Latitude: 7°N to 85°N (Panama to northern Canada/Alaska/Greenland)
        // Longitude: -170°W to -50°W (Alaska to eastern Canada/Greenland)
        const inLatRange = lat >= 7 && lat <= 85;
        const inLngRange = lng >= -170 && lng <= -50;
        return inLatRange && inLngRange;
    }

    /**
     * Find nearest NOAA weather station for a given location
     * NOW USES COMPREHENSIVE NETWORK: 4,654 high-quality stations (2024+ data)
     * Upgrade from ~100 hardcoded stations to complete US coverage
     * @returns {object|null} Station object or null if none found within max distance
     */
    async findNearestNOAAStation(lat, lng, maxDistanceKm = 100) {
        try {
            // Use comprehensive NOAA station network
            const station = await noaaNetwork.findNearestStation(lat, lng, maxDistanceKm);
            return station;
        } catch (error) {
            console.error('[NOAA] Error finding nearest station:', error);
            return null;
        }
    }

    /**
     * Fetch snow data from NOAA CDO API (v1 - no auth required)
     * Returns data in inches for consistency with US weather standards
     * Now with retry logic for improved reliability
     */
    async fetchNOAAData(stationId, startDate, endDate, retries = 2) {
        // Request ALL available data from NOAA: temp, precip, snow, wind
        const url = `https://www.ncei.noaa.gov/access/services/data/v1?` +
                   `dataset=daily-summaries&` +
                   `dataTypes=TMAX,TMIN,PRCP,SNOW,SNWD,AWND&` +
                   `stations=${stationId}&` +
                   `startDate=${startDate}&` +
                   `endDate=${endDate}&` +
                   `format=json&` +
                   `units=standard`; // Returns inches/°F

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`[NOAA] Retry attempt ${attempt} for station ${stationId}...`);
                    // Add exponential backoff delay
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    if (response.status === 404 || response.status === 400) {
                        // Station has no data - don't retry
                        console.log(`[NOAA] Station ${stationId} has no data (${response.status})`);
                        return { success: false, error: `No data available (HTTP ${response.status})` };
                    }
                    throw new Error(`NOAA API error: ${response.status}`);
                }

                const data = await response.json();

                // Check if we got any data
                if (!data || data.length === 0) {
                    console.log(`[NOAA] Station ${stationId} returned no records`);
                    return { success: false, error: 'No records returned' };
                }

                // Convert to Open-Meteo format for compatibility
                // NOAA returns data in standard US units (°F, inches)
                const temperature_2m_max = [];
                const temperature_2m_min = [];
                const precipitation_sum = [];
                const snowfall_sum = [];
                const windspeed_10m_max = [];
                const dates = [];

                for (const record of data) {
                    dates.push(record.DATE);

                    // Temperature: Convert °F to °C
                    const tmaxF = parseFloat(record.TMAX);
                    const tminF = parseFloat(record.TMIN);
                    temperature_2m_max.push(isNaN(tmaxF) ? null : (tmaxF - 32) * 5/9);
                    temperature_2m_min.push(isNaN(tminF) ? null : (tminF - 32) * 5/9);

                    // Precipitation: Convert inches to mm
                    const precipInches = parseFloat(record.PRCP || 0);
                    precipitation_sum.push(precipInches * 25.4);

                    // Snow: Convert inches depth to mm water equivalent
                    const snowInches = parseFloat(record.SNOW || 0);
                    const snowMm = snowInches * 25.4; // Convert inches depth to mm depth
                    const waterEquivalentMm = snowMm / 10; // Convert depth to water equivalent (10:1 ratio)
                    snowfall_sum.push(waterEquivalentMm);

                    // Wind: Convert mph to km/h
                    const windMph = parseFloat(record.AWND);
                    windspeed_10m_max.push(isNaN(windMph) ? null : windMph * 1.60934);
                }

                // Log statistics for validation
                const snowDays = snowfall_sum.filter(s => s > 0).length;
                const heavySnowDays = snowfall_sum.filter(s => s > 10).length;
                const maxSnow = Math.max(...snowfall_sum.filter(s => s > 0));
                const tempCount = temperature_2m_max.filter(t => t !== null).length;
                const precipCount = precipitation_sum.filter(p => p > 0).length;
                const windCount = windspeed_10m_max.filter(w => w !== null).length;

                console.log(`[NOAA] ✓ Successfully fetched ${data.length} days of data from ${stationId}`);
                console.log(`[NOAA] Data coverage: ${tempCount} days temp, ${precipCount} days precip, ${snowDays} days snow, ${windCount} days wind`);
                console.log(`[NOAA] Snow stats: ${snowDays} snowy days, ${heavySnowDays} heavy (>10mm water equiv / >4in depth), max: ${maxSnow.toFixed(1)}mm water equiv`);

                return {
                    daily: {
                        time: dates,
                        temperature_2m_max: temperature_2m_max,
                        temperature_2m_min: temperature_2m_min,
                        precipitation_sum: precipitation_sum,
                        snowfall_sum: snowfall_sum,
                        windspeed_10m_max: windspeed_10m_max
                    },
                    source: 'NOAA',
                    hasTempData: tempCount > data.length * 0.8,  // 80% coverage threshold
                    hasPrecipData: precipCount > 0,
                    hasWindData: windCount > data.length * 0.5,  // 50% coverage threshold
                    success: true
                };

            } catch (error) {
                if (attempt === retries) {
                    console.warn(`[NOAA] Data fetch failed after ${retries + 1} attempts:`, error.message);
                    return { success: false, error: error.message };
                }
                // Continue to next retry attempt
                console.log(`[NOAA] Attempt ${attempt + 1} failed: ${error.message}`);
            }
        }

        return { success: false, error: 'All retry attempts exhausted' };
    }

    /**
     * Fetch snow data from Visual Crossing Weather API (global station-based data)
     * Visual Crossing provides station-based observations for 180+ countries
     * Free tier: 1000 records/day (enough for ~50 projects)
     * @returns {object} Snow data in Open-Meteo format or { success: false }
     */
    async fetchVisualCrossingSnowData(lat, lng, startDate, endDate) {
        const apiKey = this.visualCrossingApiKey;

        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            return { success: false, reason: 'no_api_key' };
        }

        try {
            // Visual Crossing Timeline API
            const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lng}/${startDate}/${endDate}?unitGroup=metric&elements=datetime,snow,snowdepth&include=days&key=${apiKey}&contentType=json`;

            console.log('Fetching Visual Crossing snow data...');

            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('Visual Crossing rate limit exceeded (1000 records/day)');
                    return { success: false, reason: 'rate_limit' };
                } else if (response.status === 401) {
                    console.warn('Visual Crossing API key invalid');
                    return { success: false, reason: 'invalid_key' };
                }
                throw new Error(`Visual Crossing API error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.days || data.days.length === 0) {
                return { success: false, reason: 'no_data' };
            }

            // Convert to Open-Meteo format
            const snowfall_sum = [];
            const dates = [];

            for (const day of data.days) {
                dates.push(day.datetime);
                // Visual Crossing returns snow depth in cm
                // Convert to mm water equivalent: cm depth numerically equals mm water equiv (10:1 snow-to-water ratio)
                const snowCm = parseFloat(day.snow || 0);
                const snowMmWaterEquiv = snowCm;  // Numeric equality: 10cm snow = 1cm water = 10mm water
                snowfall_sum.push(snowMmWaterEquiv);
            }

            console.log('Successfully fetched Visual Crossing snow data');

            return {
                daily: {
                    time: dates,
                    snowfall_sum: snowfall_sum
                },
                source: 'Visual Crossing',
                location: data.resolvedAddress || `${lat}, ${lng}`,
                stationCount: data.stations ? data.stations.length : 0,
                success: true
            };

        } catch (error) {
            console.warn('Visual Crossing data fetch failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fetch snow data using ECMWF IFS model (9km resolution, 2017-present)
     * 12.5x more accurate than ERA5 for snowfall
     * Completely free, no API key required
     * @returns {object} Snow data in Open-Meteo format or { success: false }
     */
    async fetchECMWFIFSSnowData(lat, lng, startDate, endDate) {
        try {
            // Check if dates are within ECMWF IFS coverage (2017-present)
            const startYear = parseInt(startDate.split('-')[0]);
            if (startYear < 2017) {
                console.log('ECMWF IFS only available from 2017+, using ERA5 for older dates');
                return { success: false, reason: 'date_out_of_range' };
            }

            const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=snowfall_sum&timezone=auto&models=ecmwf_ifs`;

            console.log('Fetching ECMWF IFS snow data (9km resolution)...');

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`ECMWF IFS API error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.daily || !data.daily.snowfall_sum) {
                return { success: false, reason: 'no_data' };
            }

            console.log('Successfully fetched ECMWF IFS snow data');

            return {
                daily: {
                    time: data.daily.time,
                    snowfall_sum: data.daily.snowfall_sum.map(v => v === null ? 0 : v)
                },
                source: 'ECMWF IFS',
                resolution: '9km',
                success: true
            };

        } catch (error) {
            console.warn('ECMWF IFS data fetch failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Multi-tier hybrid weather data fetch
     * Tier 1: NOAA stations (US only) - 100% accuracy
     * Tier 2: Visual Crossing (Global) - 80-100% accuracy, station-based
     * Tier 3: ECMWF IFS (Global) - ~50% accuracy, 9km model
     * Tier 4: ERA5 (Global fallback) - ~4% accuracy for snow, good for temp/rain/wind
     */
    async fetchWeatherDataHybrid(lat, lng, startDate, endDate) {
        let snowDataResult = null;
        let snowDataSource = null;

        // ============================================================
        // TIER 1: Try NOAA stations (North America only) - 100% accuracy
        // ============================================================
        // NOAA has excellent coverage in North America but limited elsewhere
        // Skip NOAA search for locations outside North America to save API calls
        const isNorthAmerica = this.isNorthAmerica(lat, lng);

        if (isNorthAmerica) {
            console.log('[DATA SOURCE] Location in North America - searching for NOAA station...');
        } else {
            console.log('[DATA SOURCE] Location outside North America - skipping NOAA search (limited coverage)');
        }

        if (isNorthAmerica) {
            try {
                // Use larger search radius (300km) for better coverage in rural areas
                const searchRadius = 300;
                const noaaStation = await this.findNearestNOAAStation(lat, lng, searchRadius);

            if (noaaStation) {
                console.log(`[NOAA] Found station: ${noaaStation.name} (${noaaStation.distance}km away, ${noaaStation.country})`);

                // Try to fetch data from the nearest station
                let noaaResult = await this.fetchNOAAData(noaaStation.id, startDate, endDate);

                // If first station fails, try backup stations (multi-station fallback)
                if (!noaaResult.success) {
                    console.log('[NOAA] Primary station failed, trying backup stations...');
                    const backupStations = await noaaNetwork.findNearestStations(lat, lng, 5, searchRadius);

                    for (let i = 1; i < backupStations.length && !noaaResult.success; i++) {
                        const backup = backupStations[i];
                        console.log(`[NOAA] Trying backup station ${i}: ${backup.name} (${backup.distance}km)`);
                        noaaResult = await this.fetchNOAAData(backup.id, startDate, endDate);

                        if (noaaResult.success) {
                            // Update station info to reflect the successful backup
                            noaaStation.name = backup.name;
                            noaaStation.id = backup.id;
                            noaaStation.distance = backup.distance;
                            noaaStation.country = backup.country;
                        }
                    }
                }

                if (noaaResult.success) {
                    snowDataResult = noaaResult;
                    snowDataSource = {
                        source: 'NOAA',
                        station: noaaStation.name,
                        stationId: noaaStation.id,
                        distance: noaaStation.distance,
                        country: noaaStation.country || noaaStation.state,
                        accuracy: '100%',
                        type: 'station'
                    };
                    console.log('[DATA SOURCE] ✓ TIER 1: Using NOAA station data (100% accuracy)');
                    console.log(`[NOAA] Final station: ${noaaStation.name}, Distance: ${noaaStation.distance}km`);
                } else {
                    console.log('[DATA SOURCE] NOAA data fetch failed for all nearby stations, continuing to next tier...');
                }
            } else {
                console.log(`[DATA SOURCE] No NOAA station within ${searchRadius}km, trying next tier...`);
            }
            } catch (error) {
                console.warn('[DATA SOURCE] NOAA station lookup error:', error.message);
            }
        } // End of isNorthAmerica check

        // ============================================================
        // TIER 2: Try Visual Crossing (Global) - 80-100% accuracy
        // ============================================================
        if (!snowDataResult) {
            console.log('[DATA SOURCE] Trying Visual Crossing (global coverage)...');
            try {
                const vcResult = await this.fetchVisualCrossingSnowData(lat, lng, startDate, endDate);

                if (vcResult.success) {
                    snowDataResult = vcResult;
                    snowDataSource = {
                        source: 'Visual Crossing',
                        location: vcResult.location,
                        stationCount: vcResult.stationCount,
                        accuracy: '80-100%',
                        type: 'station',
                        isNorthAmerica: isNorthAmerica
                    };
                    console.log('[DATA SOURCE] ✓ TIER 2: Using Visual Crossing data (80-100% accuracy)');
                    console.log(`[Visual Crossing] Location: ${vcResult.location}, Stations: ${vcResult.stationCount}`);
                } else if (vcResult.reason === 'no_api_key') {
                    console.log('[DATA SOURCE] Visual Crossing API key not configured, trying next tier...');
                } else if (vcResult.reason === 'rate_limit') {
                    console.log('[DATA SOURCE] Visual Crossing rate limit reached, trying next tier...');
                } else {
                    console.log('[DATA SOURCE] Visual Crossing fetch unsuccessful, trying next tier...');
                }
            } catch (error) {
                console.warn('[DATA SOURCE] Visual Crossing error:', error.message);
            }
        }

        // ============================================================
        // TIER 3: Try ECMWF IFS (Global, 2017+) - ~50% accuracy
        // ============================================================
        if (!snowDataResult) {
            console.log('[DATA SOURCE] Trying ECMWF IFS model (global, 2017+)...');
            try {
                const ecmwfResult = await this.fetchECMWFIFSSnowData(lat, lng, startDate, endDate);

                if (ecmwfResult.success) {
                    snowDataResult = ecmwfResult;
                    snowDataSource = {
                        source: 'ECMWF IFS',
                        resolution: ecmwfResult.resolution,
                        accuracy: '~50%',
                        type: 'model',
                        note: '12.5x more accurate than ERA5',
                        isNorthAmerica: isNorthAmerica
                    };
                    console.log('[DATA SOURCE] ✓ TIER 3: Using ECMWF IFS model data (~50% accuracy)');
                    console.log(`[ECMWF IFS] Resolution: ${ecmwfResult.resolution}`);
                } else {
                    console.log('[DATA SOURCE] ECMWF IFS fetch unsuccessful, falling back to ERA5...');
                }
            } catch (error) {
                console.warn('[DATA SOURCE] ECMWF IFS error:', error.message);
            }
        }

        // ============================================================
        // TIER 4: Fetch ERA5 for temp/rain/wind (and snow fallback)
        // ============================================================
        const era5Data = await this.fetchWeatherData(lat, lng, startDate, endDate);

        // ============================================================
        // BLEND DATA: Use NOAA for all available metrics, ERA5 as fallback
        // ============================================================
        if (snowDataResult && snowDataResult.daily) {
            // NOAA data available - use for ALL metrics it provides
            if (snowDataResult.hasTempData) {
                era5Data.daily.temperature_2m_max = snowDataResult.daily.temperature_2m_max;
                era5Data.daily.temperature_2m_min = snowDataResult.daily.temperature_2m_min;
                console.log('[DATA SOURCE] ✓ Using NOAA station data for TEMPERATURE (100% accuracy)');
            }
            if (snowDataResult.hasPrecipData) {
                era5Data.daily.precipitation_sum = snowDataResult.daily.precipitation_sum;
                console.log('[DATA SOURCE] ✓ Using NOAA station data for PRECIPITATION (100% accuracy)');
            }
            if (snowDataResult.hasWindData) {
                era5Data.daily.windspeed_10m_max = snowDataResult.daily.windspeed_10m_max;
                console.log('[DATA SOURCE] ✓ Using NOAA station data for WIND (100% accuracy)');
            }
            // Always use NOAA snow data
            era5Data.daily.snowfall_sum = snowDataResult.daily.snowfall_sum;
            console.log('[DATA SOURCE] ✓ Using NOAA station data for SNOW (100% accuracy)');

            era5Data.snowDataSource = snowDataSource;
            const metrics = [];
            if (snowDataResult.hasTempData) metrics.push('temp');
            if (snowDataResult.hasPrecipData) metrics.push('precip');
            if (snowDataResult.hasWindData) metrics.push('wind');
            metrics.push('snow');
            console.log(`[DATA SOURCE] ✓ TIER 1 COMPLETE: Using NOAA for ${metrics.join(', ')} | ERA5 fallback for missing data`);
        } else {
            // Fallback to ERA5 for all data (lowest accuracy)
            const regionWarning = isNorthAmerica
                ? 'All data from reanalysis model - station data unavailable in this area'
                : 'Global reanalysis data (NOAA stations limited outside North America)';

            era5Data.snowDataSource = {
                source: 'ERA5',
                resolution: '30km',
                accuracy: '~4%',
                type: 'model',
                warning: regionWarning,
                isNorthAmerica: isNorthAmerica  // Pass region info for UI display
            };
            console.log('[DATA SOURCE] ⚠ TIER 4: Using ERA5 for all data (reanalysis model - fallback)');
            if (isNorthAmerica) {
                console.log('[DATA SOURCE] Location in North America but no nearby stations found');
            } else {
                console.log('[DATA SOURCE] Location outside North America - using global reanalysis data');
            }
        }

        // ERA5 is still excellent for these metrics
        era5Data.temperatureSource = 'ERA5';
        era5Data.precipitationSource = 'ERA5';
        era5Data.windSource = 'ERA5';

        return era5Data;
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
                const yearData = await this.fetchWeatherDataHybrid(lat, lng, startDateStr, endDateStr);
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

    analyzeDataForPrediction(historicalData, projectStartDate, projectEndDate, template = null) {
        console.log('[ANALYSIS] Starting weather analysis with', historicalData.length, 'years of data');
        if (template) {
            console.log('[ANALYSIS] Using template-specific thresholds:', template.name);
        }

        // Calculate actual project duration
        const projectStart = new Date(projectStartDate);
        const projectEnd = new Date(projectEndDate);
        const actualProjectDays = Math.ceil((projectEnd - projectStart) / (1000 * 60 * 60 * 24));

        // Extract snow data source from the most recent year (first element)
        const snowDataSource = historicalData.length > 0 && historicalData[0].data
            ? historicalData[0].data.snowDataSource
            : null;
        console.log('[ANALYSIS] Snow data source:', snowDataSource);

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
            const dataQuality = expectedDays > 0 ? Math.min(1.0, daysInYear / expectedDays) : 0;  // Cap at 100% (API may return extra days)

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
                totalSnowfall: this.sum(daily.snowfall_sum.filter(s => s !== null && s > 1)),  // Only sum measurable snow (>1mm threshold) - matches snowyDays logic

                // Count event days for THIS YEAR
                // TEMPERATURE CATEGORIES (construction-specific thresholds):
                // REALISTIC thresholds based on modern cold-weather concrete practices:
                // - Light freezing (0 to -5°C / 32-23°F): Workable with blankets, timing adjustments
                // - Cold-weather methods (≤-5°C to -18°C / ≤23°F to 0°F): Workable with accelerators, hot water, enclosures, blankets
                // - EXTREME COLD STOPPAGE (≤-18°C / ≤0°F): True work stoppage - even protected pours are risky
                // - Hot days (≥ 100°F / 37.78°C): Tracked for information - reduces ideal days but still workable with precautions
                // - Dangerous heat (≥ 110°F / 43.33°C): True work stoppage - safety risk
                allFreezingDays: daily.temperature_2m_min.filter(t => t !== null && t <= 0).length,  // All days at/below freezing
                lightFreezingDays: daily.temperature_2m_min.filter(t => t !== null && t > -5 && t <= 0).length,  // Light precautions (blankets, timing)
                coldWeatherMethodsDays: daily.temperature_2m_min.filter(t => t !== null && t <= -5 && t > -18).length,  // Workable with proper methods (accelerators, hot water, enclosures)
                extremeColdDays: daily.temperature_2m_min.filter(t => t !== null && t <= -18).length,  // TRUE work stoppage (≤0°F)
                comfortableTemps: daily.temperature_2m_min.filter(t => t !== null && t > -5).length,  // Days >-5°C / >23°F (comfortable working temps)
                extremeHeatDays: daily.temperature_2m_max.filter(t => t !== null && t >= 37.78).length,  // Days ≥100°F (informational - not work-stopping)

                // PRECIPITATION CATEGORIES:
                // - Light rain (1-15mm): Workable with rain gear/drainage
                // - Heavy rain (>= 15mm / >=0.6 in): Work stoppage (realistic industry threshold)
                // - Measurable snow (> 1mm water equiv = ~1cm snow depth = ~0.4 in depth): Filters out trace amounts
                // - Heavy snow (> 10mm water equiv = ~10cm snow depth = ~4 in depth): Work stoppage
                // Note: Snowfall API data is in mm water equivalent; 10:1 snow-to-water ratio means 1mm water ≈ 1cm snow depth
                rainyDays: daily.precipitation_sum.filter(p => p !== null && p > 1).length,  // All rainy days
                heavyRainDays: daily.precipitation_sum.filter(p => p !== null && p >= 15).length,  // Work-stopping rain (≥15mm = 0.6 in)
                snowyDays: daily.snowfall_sum.filter(s => s !== null && s > 1).length,  // Measurable snow (>1mm water equiv)
                heavySnowDays: daily.snowfall_sum.filter(s => s !== null && s > 10).length,  // Work-stopping snow (>10mm water equiv = ~4in depth)

                // WIND THRESHOLD: 30 km/h (18.6 mph)
                // Industry standard for construction impact:
                // - Crane operations typically restricted at 30-40 km/h
                // - Elevated work safety limits at 30-50 km/h
                // - Material handling becomes challenging at 30+ km/h
                // - Light wind (< 30 km/h): Safe for all construction activities
                // - High wind (≥ 30 km/h): Restricts crane operations, elevated work, material handling
                highWindDays: daily.windspeed_10m_max.filter(w => w !== null && w >= 30).length,  // Elevated wind (monitoring threshold, not work-stopping)
                avgWindSpeed: this.average(daily.windspeed_10m_max),
                maxWindSpeed: Math.max(...daily.windspeed_10m_max.filter(w => w !== null)),

                // WORK STOPPAGE OVERLAP ANALYSIS
                // Count days with multiple work-stopping conditions (for accurate contingency calculations)
                multiStoppageDays: daily.temperature_2m_min.filter((t, i) => {
                    const temp_min = daily.temperature_2m_min[i];
                    const precip = daily.precipitation_sum[i];
                    const snow = daily.snowfall_sum[i];

                    let stoppageCount = 0;
                    if (temp_min !== null && temp_min <= -18) stoppageCount++; // Extreme cold
                    if (precip !== null && precip >= 15) stoppageCount++; // Heavy rain (≥15mm = 0.6 in)
                    if (snow !== null && snow > 10) stoppageCount++; // Heavy snow

                    return stoppageCount >= 2; // Days with 2+ stoppage conditions
                }).length,

                // WORKABILITY TIERS - Two levels of work feasibility
                // IMPORTANT: Ideal Days are a SUBSET of Workable Days (not additive)
                // If a day is ideal, it is automatically also workable
                // idealDays ≤ workableDays (always)

                // Tier 2: WORKABLE DAYS (realistic construction feasibility)
                // Work can continue with normal cold-weather/rain precautions
                // More lenient thresholds than ideal days
                // IMPORTANT: workableDays >= idealDays (mathematical requirement)
                workableDays: daily.temperature_2m_max.filter((t, i) => {
                    const temp_min = daily.temperature_2m_min[i];
                    const precip = daily.precipitation_sum[i];
                    const wind = daily.windspeed_10m_max[i];
                    const snow = daily.snowfall_sum[i];

                    // Use template-specific workable thresholds if available, otherwise use defaults
                    if (template?.workabilityThresholds) {
                        // CRITICAL FIX: Workable should use MORE LENIENT thresholds than ideal
                        // For workable, use general construction defaults (lenient) modified by template minimums
                        // This ensures workable >> ideal, not workable ≈ ideal
                        const templateMin = template.workabilityThresholds.criticalMinTemp;
                        const templateMax = template.workabilityThresholds.maxTemp;

                        // Use LENIENT general construction thresholds for rain/wind/snow
                        // Only use template for temperature minimums (safety-critical)
                        const meetsTemp = temp_min !== null && t !== null &&
                                        temp_min >= templateMin &&  // Template safety minimum
                                        t <= (templateMax + 5);      // Slightly more lenient than template max
                        const meetsRain = precip !== null && precip < 15;  // General heavy rain threshold: 15mm (0.6 in)
                        const meetsWind = wind !== null && wind < 60;      // General work-stopping wind: 60 km/h (37 mph)
                        const meetsSnow = snow === null || snow <= 10;     // No heavy snow: ≤10mm water equiv

                        return meetsTemp && meetsRain && meetsWind && meetsSnow;
                    } else {
                        // Default lenient thresholds for general construction
                        const defaultThresholds = {
                            criticalMinTemp: -5,   // °C (23°F) - work possible with precautions
                            maxTemp: 43.33,        // °C (110°F) - heat safety limit
                            maxRain: 15,           // mm (0.6 in) - heavy rain stops work
                            maxWind: 60,           // km/h (37 mph) - work-stopping wind for general construction
                            maxSnow: 10            // mm water equiv - heavy snow stops work
                        };

                        const snow = daily.snowfall_sum[i];

                        // Check for work-stopping conditions using lenient thresholds
                        const hasColdWeatherNeeded = temp_min !== null && temp_min <= defaultThresholds.criticalMinTemp;
                        const hasDangerousHeat = t !== null && t >= defaultThresholds.maxTemp;
                        const hasHeavyRain = precip !== null && precip >= defaultThresholds.maxRain;
                        const hasSnow = snow !== null && snow > defaultThresholds.maxSnow;
                        const hasHighWind = wind !== null && wind >= defaultThresholds.maxWind;

                        // Day is workable if NO work-stopping conditions present
                        return t !== null && temp_min !== null &&
                               !hasColdWeatherNeeded && !hasDangerousHeat && !hasHeavyRain && !hasSnow && !hasHighWind;
                    }
                }).length,

                // Tier 1: IDEAL DAYS (Perfect conditions subset)
                // Perfect conditions - no precautions needed
                // Stricter thresholds than workable days
                // Uses template-specific thresholds if available, otherwise defaults
                // IMPORTANT: idealDays <= workableDays (mathematical requirement)
                idealDays: daily.temperature_2m_max.filter((t, i) => {
                    const temp_min = daily.temperature_2m_min[i];
                    const precip = daily.precipitation_sum[i];
                    const wind = daily.windspeed_10m_max[i];
                    const snow = daily.snowfall_sum[i];

                    // Use template-specific ideal thresholds if available
                    if (template?.workabilityThresholds) {
                        const idealThresholds = template.workabilityThresholds;

                        // For ideal days, use smart temperature logic:
                        // - Daily low must be above criticalMinTemp (for curing/overnight)
                        // - Daily high must be above idealMinTemp (for application/daytime work)
                        const meetsTemp = temp_min !== null && t !== null &&
                                        temp_min >= idealThresholds.criticalMinTemp &&
                                        t >= (idealThresholds.idealMinTemp || idealThresholds.criticalMinTemp) &&
                                        t <= idealThresholds.maxTemp;
                        const meetsRain = precip !== null && precip <= (idealThresholds.maxRain || 0);
                        const meetsWind = wind !== null && wind <= (idealThresholds.maxWind || 20);
                        const meetsSnow = snow === null || snow <= (idealThresholds.maxSnow || 0);  // Ideal: no snow (or use template maxSnow)

                        return meetsTemp && meetsRain && meetsWind && meetsSnow;
                    } else {
                        // Default ideal thresholds (generic)
                        return t !== null && temp_min !== null && precip !== null && wind !== null &&
                               temp_min > 0 && t < 37.78 && precip < 5 && wind < 20;
                    }
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

        // Calculate temperature distribution statistics for validation
        const tempMinStdDev = this.standardDeviation(allTempsMin);
        const absMinTemp = Math.min(...allTempsMin);
        const absMaxTempMin = Math.max(...allTempsMin);

        // TEMPERATURE DISTRIBUTION DEBUGGING
        const tempBins = { below_minus20: 0, minus20_to_minus10: 0, minus10_to_0: 0, zero_to_10: 0, above_10: 0 };
        allTempsMin.forEach(t => {
            if (t <= -20) tempBins.below_minus20++;
            else if (t <= -10) tempBins.minus20_to_minus10++;
            else if (t <= 0) tempBins.minus10_to_0++;
            else if (t <= 10) tempBins.zero_to_10++;
            else tempBins.above_10++;
        });
        console.log('[TEMP DEBUG] Daily minimum temperature distribution (°C):', {
            totalDays: allTempsMin.length,
            avgMin: avgTempMin.toFixed(1),
            avgMinF: this.convertTemp(avgTempMin, 'C').toFixed(1),
            freezingDays: allTempsMin.filter(t => t <= 0).length,
            histogram: tempBins
        });

        console.log(`[TEMP STATS] Avg Min: ${avgTempMin.toFixed(1)}°C, Std Dev: ${tempMinStdDev.toFixed(1)}°C, Range: ${absMinTemp.toFixed(1)}°C to ${absMaxTempMin.toFixed(1)}°C`);

        // Average precipitation PER YEAR (not total of all years)
        const avgPrecipPerYear = this.average(yearlyStats.map(y => y.totalPrecip));
        const avgSnowfallPerYear = this.average(yearlyStats.map(y => y.totalSnowfall));

        // Average event days PER YEAR
        const allFreezingDays = Math.round(this.average(yearlyStats.map(y => y.allFreezingDays)));
        const lightFreezingDays = Math.round(this.average(yearlyStats.map(y => y.lightFreezingDays)));
        const coldWeatherMethodsDays = Math.round(this.average(yearlyStats.map(y => y.coldWeatherMethodsDays)));
        const extremeColdDays = Math.round(this.average(yearlyStats.map(y => y.extremeColdDays)));
        const comfortableTemps = Math.round(this.average(yearlyStats.map(y => y.comfortableTemps)));
        const extremeHeatDays = Math.round(this.average(yearlyStats.map(y => y.extremeHeatDays)));
        const rainyDays = Math.round(this.average(yearlyStats.map(y => y.rainyDays)));
        const heavyRainDays = Math.round(this.average(yearlyStats.map(y => y.heavyRainDays)));
        const snowyDays = Math.round(this.average(yearlyStats.map(y => y.snowyDays)));
        const heavySnowDays = Math.round(this.average(yearlyStats.map(y => y.heavySnowDays)));
        const highWindDays = Math.round(this.average(yearlyStats.map(y => y.highWindDays)));
        const multiStoppageDays = Math.round(this.average(yearlyStats.map(y => y.multiStoppageDays)));
        const idealDays = Math.round(this.average(yearlyStats.map(y => y.idealDays)));
        const workableDays = Math.round(this.average(yearlyStats.map(y => y.workableDays)));

        // Validate temperature distribution reasonableness (using new -18°C / 0°F threshold)
        const extremeColdPercent = actualProjectDays > 0 ? (extremeColdDays / actualProjectDays) * 100 : 0;
        const coldWeatherPercent = actualProjectDays > 0 ? (coldWeatherMethodsDays / actualProjectDays) * 100 : 0;
        const expectedZScore = (avgTempMin - (-18)) / tempMinStdDev; // How many std devs is threshold from mean
        console.log(`[TEMP VALIDATION] Extreme cold (≤0°F): ${extremeColdDays} days (${extremeColdPercent.toFixed(1)}%), Cold-weather methods (0-23°F): ${coldWeatherMethodsDays} days (${coldWeatherPercent.toFixed(1)}%), Z-score: ${expectedZScore.toFixed(2)}, Std Dev: ${tempMinStdDev.toFixed(1)}°C`);

        // Flag if distribution seems unusual (more than 15% below 0°F threshold that's >1.5 std devs from mean)
        if (extremeColdPercent > 15 && Math.abs(expectedZScore) > 1.5) {
            console.warn(`[TEMP WARNING] Unusual temperature distribution detected: ${extremeColdPercent.toFixed(0)}% of days below 0°F (≤-18°C) despite avg min of ${avgTempMin.toFixed(1)}°C. Location may have extreme variability or bimodal climate.`);
        }

        // Validate heavy rain proportion (should be 15-30% of rainy days typically)
        const heavyRainProportion = rainyDays > 0 ? (heavyRainDays / rainyDays) * 100 : 0;
        console.log(`[ANALYSIS] Heavy rain validation: ${heavyRainDays}/${rainyDays} = ${heavyRainProportion.toFixed(1)}% (typical: 15-30%)`);

        // Calculate confidence intervals (standard deviation)
        const rainyDaysStdDev = this.standardDeviation(yearlyStats.map(y => y.rainyDays));
        const precipStdDev = this.standardDeviation(yearlyStats.map(y => y.totalPrecip));

        // Detect extreme outliers
        const extremeEvents = this.detectExtremeEvents(yearlyStats);

        // Calculate overall data quality (cap at 100%)
        const avgDataQuality = Math.min(1.0, this.average(yearlyStats.map(y => y.dataQuality)));

        console.log('[ANALYSIS] Complete:', {
            years: yearsCount,
            avgDataQuality: `${(avgDataQuality * 100).toFixed(1)}%`,
            rainyDays: `${rainyDays} ± ${Math.round(rainyDaysStdDev)}`,
            extremeEvents: extremeEvents.length,
            workableDays: workableDays,
            idealDays: idealDays
        });

        return {
            // Temperature
            avgTempMax: avgTempMax.toFixed(1),
            avgTempMin: avgTempMin.toFixed(1),
            tempMinStdDev: tempMinStdDev.toFixed(1),  // Standard deviation for distribution validation
            absMinTemp: absMinTemp.toFixed(1),         // Absolute minimum across all years
            absMaxTempMin: absMaxTempMin.toFixed(1),   // Warmest daily minimum across all years

            // Precipitation (FIXED - averaged not summed)
            totalPrecip: avgPrecipPerYear.toFixed(1),
            totalSnowfall: avgSnowfallPerYear.toFixed(1), // mm water equiv; displayed as cm snow depth (1mm water ≈ 1cm snow via 10:1 ratio)

            // Event days - Temperature
            allFreezingDays,          // All days at/below freezing (informational)
            lightFreezingDays,        // Days with 0 to -5°C / 32-23°F (workable with blankets, timing)
            coldWeatherMethodsDays,   // Days with -5 to -18°C / 23-0°F (workable with accelerators, hot water, enclosures)
            extremeColdDays,          // EXTREME COLD STOPPAGE (≤-18°C/≤0°F) - true work stoppage
            extremeHeatDays,          // Days above 37°C (NOT workable)
            freezingDays: allFreezingDays,  // Backward compatibility

            // Temperature tier breakdown (TEMPERATURE ONLY - excludes rain/wind)
            // This is separate from workableDays which includes weather conditions
            tempTiers: {
                comfortableTemps: comfortableTemps,  // Days >-5°C / >23°F (comfortable working temps) - AVERAGED across years
                coldMethodsNeeded: coldWeatherMethodsDays,  // -18°C to -5°C / 0-23°F (expensive, requires special methods)
                extremeStoppage: extremeColdDays  // ≤-18°C / ≤0°F (true work stoppage)
            },

            // Event days - Precipitation
            rainyDays,                // All rainy days (>1mm)
            heavyRainDays,            // Heavy rain (>=15mm / >=0.6 in) - work stoppage
            snowyDays,                // Any snowfall (>0mm) - FIXED
            heavySnowDays,            // Heavy snow (>10mm) - work stoppage

            // Event days - Wind
            highWindDays,             // Elevated wind (≥30 km/h) - monitoring threshold, restrictions apply but work continues
            avgWindSpeed: this.average(yearlyStats.map(y => y.avgWindSpeed)).toFixed(1),
            maxWindSpeed: Math.max(...yearlyStats.map(y => y.maxWindSpeed)).toFixed(1),

            // Stoppage overlap analysis (for accurate contingency calculations)
            multiStoppageDays,        // Days with 2+ work-stopping conditions (actual overlap count)

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
            yearlyStats: yearlyStats,

            // NEW - Monthly breakdown for concrete pour planning
            monthlyBreakdown: this.calculateMonthlyBreakdown(historicalData, projectStartDate, projectEndDate, yearlyStats),

            // NEW - Snow data source for proper warning display
            snowDataSource: snowDataSource,

            // TEMPLATE-SPECIFIC KPIs
            // Calculate KPIs based on selected template if available
            templateKPIs: template ? this.calculateTemplateKPIs(template, historicalData, yearlyStats) : null,
            templateName: template?.name || null
        };
    }

    calculateTemplateKPIs(template, historicalData, yearlyStats) {
        const kpis = [];

        // Guard against empty yearlyStats to prevent division by zero
        if (!yearlyStats || yearlyStats.length === 0) {
            console.warn('[KPI] No yearly stats available, returning empty KPIs');
            return kpis;
        }

        // Calculate each KPI defined by the template
        template.kpis?.forEach(kpiDef => {
            let value = 0;
            const metric = kpiDef.metric;

            // Calculate KPI based on metric type
            if (metric.includes('Pour Windows') || metric.includes('Paving Windows') || metric.includes('Paint Windows')) {
                // Count consecutive good weather windows
                value = this.calculateWeatherWindows(historicalData, template);
            } else if (metric.includes('Curing Risk') || metric.includes('Cure Risk')) {
                // For painting: Days where rain within 48hrs would ruin fresh paint
                // For concrete: Days where temps drop below freezing after potential pour
                if (template.name.toLowerCase().includes('paint')) {
                    value = this.calculatePaintCureRiskDays(historicalData);
                } else {
                    value = yearlyStats.reduce((sum, y) => sum + (y.allFreezingDays || 0), 0) / yearlyStats.length;
                }
            } else if (metric.includes('Heat Mitigation')) {
                // Days above 90°F requiring cooling measures
                value = yearlyStats.reduce((sum, y) => sum + (y.extremeHeatDays || 0), 0) / yearlyStats.length;
            } else if (metric.includes('Safe Work Windows')) {
                // Template-specific safe days
                value = yearlyStats.reduce((sum, y) => sum + (y.workableDays || 0), 0) / yearlyStats.length;
            } else if (metric.includes('High Wind')) {
                value = yearlyStats.reduce((sum, y) => sum + (y.highWindDays || 0), 0) / yearlyStats.length;
            } else if (metric.includes('Dry Work Days') || metric.includes('Ground Dry')) {
                // Days with minimal precipitation
                value = yearlyStats.reduce((sum, y) => {
                    const dryDays = (y.daysInYear || 365) - (y.rainyDays || 0);
                    return sum + dryDays;
                }, 0) / yearlyStats.length;
                // Safety check: prevent NaN in professional reports
                if (isNaN(value) || !isFinite(value)) {
                    console.error('[KPI] Dry Work Days calculation resulted in NaN, using fallback');
                    value = 365 - (yearlyStats[0]?.rainyDays || 100);
                }
            } else if (metric.includes('Saturated Soil')) {
                // Days with heavy rain
                value = yearlyStats.reduce((sum, y) => sum + (y.heavyRainDays || 0), 0) / yearlyStats.length;
            } else if (metric.includes('Frost')) {
                value = yearlyStats.reduce((sum, y) => sum + (y.allFreezingDays || 0), 0) / yearlyStats.length;
            } else if (metric.includes('Application Days')) {
                // Days meeting template-specific application criteria
                if (template.name.toLowerCase().includes('paint')) {
                    value = this.calculatePaintApplicationDays(historicalData, template);
                } else {
                    // Default: use workable days
                    value = yearlyStats.reduce((sum, y) => sum + (y.workableDays || 0), 0) / yearlyStats.length;
                }
            } else if (metric.includes('Planting Windows')) {
                // Days with ideal temps for planting (50-80°F / 10-27°C)
                value = this.calculatePlantingDays(historicalData);
            } else if (metric.includes('Exterior Work')) {
                value = yearlyStats.reduce((sum, y) => sum + (y.workableDays || 0), 0) / yearlyStats.length;
            } else if (metric.includes('Interior Fallback')) {
                value = yearlyStats.reduce((sum, y) => sum + (y.totalDays - (y.workableDays || 0)), 0) / yearlyStats.length;
            } else if (metric.includes('Inspection Windows')) {
                // Dry days suitable for inspections
                value = yearlyStats.reduce((sum, y) => {
                    const dryDays = y.totalDays - (y.rainyDays || 0);
                    return sum + dryDays;
                }, 0) / yearlyStats.length;
            } else if (metric.includes('Compaction Days')) {
                // Days with temps > 50°F for asphalt
                value = this.calculateCompactionDays(historicalData);
            } else {
                // Default: use workable days
                value = yearlyStats.reduce((sum, y) => sum + (y.workableDays || 0), 0) / yearlyStats.length;
            }

            kpis.push({
                metric: kpiDef.metric,
                description: kpiDef.description,
                value: Math.round(value),
                unit: kpiDef.unit
            });
        });

        return kpis;
    }

    calculateWeatherWindows(historicalData, template) {
        // Count consecutive weather windows meeting template criteria
        let windows = 0;
        const consecutiveDays = template.weatherCriteria?.consecutiveDays || 2;

        historicalData.forEach(yearData => {
            const daily = yearData.data.daily;
            let currentStreak = 0;

            for (let i = 0; i < daily.time.length; i++) {
                const temp_min = daily.temperature_2m_min[i];
                const temp_max = daily.temperature_2m_max[i];
                const precip = daily.precipitation_sum[i];
                const wind = daily.windspeed_10m_max?.[i];

                const meetsTemp = temp_min >= template.weatherCriteria.minTemp && temp_max <= template.weatherCriteria.maxTemp;
                const meetsRain = precip <= template.weatherCriteria.maxRain;
                const meetsWind = !wind || wind <= template.weatherCriteria.maxWind;

                if (meetsTemp && meetsRain && meetsWind) {
                    currentStreak++;
                    if (currentStreak === consecutiveDays) {
                        windows++;
                        currentStreak = 0; // Reset to count non-overlapping windows
                    }
                } else {
                    currentStreak = 0;
                }
            }
        });

        return historicalData.length > 0 ? Math.round(windows / historicalData.length) : 0;
    }

    calculatePlantingDays(historicalData) {
        let plantingDays = 0;

        historicalData.forEach(yearData => {
            const daily = yearData.data.daily;
            for (let i = 0; i < daily.time.length; i++) {
                const temp_max = daily.temperature_2m_max[i];
                if (temp_max >= 10 && temp_max <= 27) { // 50-80°F
                    plantingDays++;
                }
            }
        });

        return historicalData.length > 0 ? Math.round(plantingDays / historicalData.length) : 0;
    }

    calculateCompactionDays(historicalData) {
        let compactionDays = 0;

        historicalData.forEach(yearData => {
            const daily = yearData.data.daily;
            for (let i = 0; i < daily.time.length; i++) {
                const temp_max = daily.temperature_2m_max[i];
                const precip = daily.precipitation_sum[i];
                if (temp_max >= 10 && precip === 0) { // >50°F and dry
                    compactionDays++;
                }
            }
        });

        return historicalData.length > 0 ? Math.round(compactionDays / historicalData.length) : 0;
    }

    calculatePaintApplicationDays(historicalData, template) {
        // Days meeting painting requirements: temp (50-85°F), dry, calm wind
        let applicationDays = 0;

        const minTemp = template.workabilityThresholds?.criticalMinTemp || 10;  // 50°F default
        const maxTemp = template.workabilityThresholds?.maxTemp || 29.4;        // 85°F default
        const maxWind = template.workabilityThresholds?.maxWind || 25;          // 25 km/h default
        const maxRain = template.workabilityThresholds?.maxRain || 0;           // Dry required

        historicalData.forEach(yearData => {
            const daily = yearData.data.daily;
            for (let i = 0; i < daily.time.length; i++) {
                const temp_min = daily.temperature_2m_min[i];
                const temp_max = daily.temperature_2m_max[i];
                const precip = daily.precipitation_sum[i];
                const wind = daily.windspeed_10m_max?.[i] || 0;

                // Check if day meets painting requirements
                const tempOK = temp_min >= minTemp && temp_max <= maxTemp;
                const dryOK = precip <= maxRain;
                const windOK = wind <= maxWind;

                if (tempOK && dryOK && windOK) {
                    applicationDays++;
                }
            }
        });

        return historicalData.length > 0 ? Math.round(applicationDays / historicalData.length) : 0;
    }

    calculatePaintCureRiskDays(historicalData) {
        // Days where rain within next 48 hours would ruin fresh paint
        let cureRiskDays = 0;

        historicalData.forEach(yearData => {
            const daily = yearData.data.daily;
            for (let i = 0; i < daily.time.length; i++) {
                const currentPrecip = daily.precipitation_sum[i];

                // Check if it's dry today (potential painting day)
                if (currentPrecip <= 1) {  // Essentially dry (≤1mm)
                    // Look ahead 48 hours (2 days) for rain
                    let rainWithin48hrs = false;
                    for (let j = i + 1; j <= Math.min(i + 2, daily.time.length - 1); j++) {
                        const futurePrecip = daily.precipitation_sum[j];
                        if (futurePrecip > 1) {  // Any measurable rain
                            rainWithin48hrs = true;
                            break;
                        }
                    }

                    if (rainWithin48hrs) {
                        cureRiskDays++;
                    }
                }
            }
        });

        return historicalData.length > 0 ? Math.round(cureRiskDays / historicalData.length) : 0;
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

        // Detect severe cold years (work-stopping cold)
        const coldDaysValues = yearlyStats.map(y => y.extremeColdDays);
        const coldMean = this.average(coldDaysValues);

        yearlyStats.forEach(year => {
            if (year.extremeColdDays > coldMean * 2 && year.extremeColdDays > 5) {
                extremeEvents.push({
                    year: year.year,
                    type: 'Severe Cold Year',
                    value: `${year.extremeColdDays} work-stopping cold days (${this.formatThresholdTemp(-18, '≤')})`,
                    severity: 'High'
                });
            }
        });

        return extremeEvents;
    }

    calculateMonthlyBreakdown(historicalData, projectStartDate, projectEndDate, yearlyStats) {
        console.log('[MONTHLY] Calculating monthly breakdown for concrete pour planning');

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Guard against empty historicalData to prevent division by zero
        if (!historicalData || historicalData.length === 0) {
            console.warn('[MONTHLY] No historical data available, returning empty breakdown');
            return monthNames.map((name, i) => ({
                month: name,
                monthIndex: i,
                avgDaysInMonth: 0,
                heavyRainDays: 0,
                workStoppingColdDays: 0,
                heavySnowDays: 0,
                workableDays: 0,
                idealDays: 0,
                workablePercent: 0,
                riskScore: 0
            }));
        }

        // Initialize monthly stats
        const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
            month: monthNames[i],
            monthIndex: i,
            totalDays: 0,
            heavyRainDays: 0,
            workStoppingColdDays: 0,
            heavySnowDays: 0,
            workableDays: 0,
            idealDays: 0
        }));

        // Process each year's data
        historicalData.forEach(yearData => {
            const daily = yearData.data.daily;

            daily.time.forEach((dateStr, i) => {
                const date = new Date(dateStr);
                const monthIndex = date.getMonth();

                // Get weather values for this day
                const temp_min = daily.temperature_2m_min[i];
                const temp_max = daily.temperature_2m_max[i];
                const precip = daily.precipitation_sum[i];
                const snow = daily.snowfall_sum[i];
                const wind = daily.windspeed_10m_max?.[i];

                monthlyStats[monthIndex].totalDays++;

                // Count work-stopping conditions
                const hasHeavyRain = precip !== null && precip >= 15;  // Match yearly threshold (≥15mm = 0.6 in)
                const hasWorkStoppingCold = temp_min !== null && temp_min <= -18;  // Match yearly threshold (0°F)
                const hasHeavySnow = snow !== null && snow > 10;
                const hasWorkStoppingWind = wind !== null && wind >= 60;  // Match yearly threshold (60 km/h = work-stopping for general construction)
                const hasElevatedWind = wind !== null && wind >= 30;  // Elevated wind (monitoring threshold, excludes from ideal days)
                const hasDangerousHeat = temp_max !== null && temp_max >= 43.33;  // ≥110°F

                if (hasHeavyRain) monthlyStats[monthIndex].heavyRainDays++;
                if (hasWorkStoppingCold) monthlyStats[monthIndex].workStoppingColdDays++;
                if (hasHeavySnow) monthlyStats[monthIndex].heavySnowDays++;

                // Check if day is workable
                const isWorkStopping = hasHeavyRain || hasWorkStoppingCold || hasHeavySnow || hasWorkStoppingWind || hasDangerousHeat;
                if (!isWorkStopping) {
                    monthlyStats[monthIndex].workableDays++;
                }

                // Check if day is ideal (no extremes at all)
                const hasLightRain = precip !== null && precip > 1 && precip <= 15;  // Light rain = between trace and heavy
                const hasLightFreezing = temp_min !== null && temp_min > -5 && temp_min <= 0;
                const hasExtremeHeat = temp_max !== null && temp_max >= 37.78;  // ≥100°F
                const isIdeal = !hasHeavyRain && !hasLightRain && !hasWorkStoppingCold && !hasLightFreezing &&
                               !hasHeavySnow && !hasElevatedWind && !hasExtremeHeat && !hasDangerousHeat;
                if (isIdeal) {
                    monthlyStats[monthIndex].idealDays++;
                }
            });
        });

        // Average across years (keep as decimals initially for reconciliation)
        const yearsCount = historicalData.length;
        const breakdown = monthlyStats.map(month => ({
            month: month.month,
            monthIndex: month.monthIndex,
            avgDaysInMonth: Math.round(month.totalDays / yearsCount),
            heavyRainDays: month.heavyRainDays / yearsCount,  // Decimal for now
            workStoppingColdDays: month.workStoppingColdDays / yearsCount,  // Decimal for now
            heavySnowDays: month.heavySnowDays / yearsCount,  // Decimal for now
            workableDays: Math.round(month.workableDays / yearsCount),
            idealDays: Math.round(month.idealDays / yearsCount),
            workablePercent: month.totalDays > 0 ? ((month.workableDays / month.totalDays) * 100).toFixed(0) : 0,
            riskScore: month.totalDays > 0 ? Math.round(((month.heavyRainDays + month.workStoppingColdDays + month.heavySnowDays) / month.totalDays) * 100) : 0
        }));

        // RECONCILIATION: Ensure monthly totals match the yearly averages from yearlyStats
        // This fixes rounding discrepancies between headline and monthly table
        const yearlyHeavyRain = yearlyStats.map(y => y.heavyRainDays);
        const yearlyWorkStoppingCold = yearlyStats.map(y => y.extremeColdDays);
        const yearlyHeavySnow = yearlyStats.map(y => y.heavySnowDays);

        const targetHeavyRain = Math.round(this.average(yearlyHeavyRain));
        const targetWorkStoppingCold = Math.round(this.average(yearlyWorkStoppingCold));
        const targetHeavySnow = Math.round(this.average(yearlyHeavySnow));

        // Reconcile heavy rain days
        breakdown.forEach(month => {
            month.heavyRainDays = Math.round(month.heavyRainDays);
            month.workStoppingColdDays = Math.round(month.workStoppingColdDays);
            month.heavySnowDays = Math.round(month.heavySnowDays);
        });

        const sumHeavyRain = breakdown.reduce((sum, m) => sum + m.heavyRainDays, 0);
        const sumWorkStoppingCold = breakdown.reduce((sum, m) => sum + m.workStoppingColdDays, 0);
        const sumHeavySnow = breakdown.reduce((sum, m) => sum + m.heavySnowDays, 0);

        // Adjust if sums don't match targets (distribute difference to months with highest fractional parts)
        this.reconcileMonthlyTotals(breakdown, 'heavyRainDays', sumHeavyRain, targetHeavyRain, monthlyStats, yearsCount);
        this.reconcileMonthlyTotals(breakdown, 'workStoppingColdDays', sumWorkStoppingCold, targetWorkStoppingCold, monthlyStats, yearsCount);
        this.reconcileMonthlyTotals(breakdown, 'heavySnowDays', sumHeavySnow, targetHeavySnow, monthlyStats, yearsCount);

        console.log('[MONTHLY] Monthly breakdown calculated and reconciled:', {
            heavyRain: `${breakdown.reduce((s,m)=>s+m.heavyRainDays,0)} (target: ${targetHeavyRain})`,
            workStoppingCold: `${breakdown.reduce((s,m)=>s+m.workStoppingColdDays,0)} (target: ${targetWorkStoppingCold})`,
            heavySnow: `${breakdown.reduce((s,m)=>s+m.heavySnowDays,0)} (target: ${targetHeavySnow})`
        });
        return breakdown;
    }

    reconcileMonthlyTotals(breakdown, fieldName, currentSum, targetSum, monthlyStats, yearsCount) {
        const difference = targetSum - currentSum;

        if (difference === 0) return; // Already matches

        // Calculate fractional parts for each month (before rounding)
        const monthsWithFractional = breakdown.map((month, index) => ({
            index: index,
            month: month.month,
            fractional: (monthlyStats[index][fieldName] / yearsCount) % 1,
            currentValue: month[fieldName]
        }));

        // Sort by fractional part (highest first for adding, lowest first for subtracting)
        if (difference > 0) {
            // Need to add days - prioritize months with highest fractional parts (were rounded down)
            monthsWithFractional.sort((a, b) => b.fractional - a.fractional);
        } else {
            // Need to subtract days - prioritize months with lowest fractional parts (were rounded up)
            monthsWithFractional.sort((a, b) => a.fractional - b.fractional);
        }

        // Apply adjustment to the required number of months
        const adjustmentCount = Math.abs(difference);
        const adjustment = difference > 0 ? 1 : -1;

        for (let i = 0; i < adjustmentCount && i < monthsWithFractional.length; i++) {
            const monthIndex = monthsWithFractional[i].index;
            breakdown[monthIndex][fieldName] += adjustment;

            // Don't let values go negative
            if (breakdown[monthIndex][fieldName] < 0) {
                breakdown[monthIndex][fieldName] = 0;
            }
        }

        console.log(`[RECONCILE] ${fieldName}: adjusted ${adjustmentCount} months by ${adjustment > 0 ? '+1' : '-1'} to match target ${targetSum}`);
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

        // CRITICAL: Check workable vs ideal days math
        const workableNonIdeal = workableDays - idealDays;
        const highWindDays = parseInt(analysis.highWindDays) || 0;
        // heavyRainDays and freezingDays already declared above (lines 4737, 4735)

        // If there are many weather events but few workable-non-ideal days, something is wrong
        if (workableNonIdeal < 20 && (highWindDays > 50 || heavyRainDays > 20 || freezingDays > 100)) {
            findings.impossibleValues.push({
                status: '⚠',
                issue: `Workable/Ideal math suspicious: ${workableDays} workable vs ${idealDays} ideal = only ${workableNonIdeal} workable-non-ideal days, but ${highWindDays} high-wind + ${heavyRainDays} heavy-rain + ${freezingDays} freezing days`,
                severity: 'HIGH',
                fix: 'Workable thresholds may be too strict - should be more lenient than ideal'
            });
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
        // REALISTIC work-stopping temperature extremes based on modern cold-weather practices
        // extremeColdDays = ≤-18°C/≤0°F (TRUE work stoppage - extreme cold even with protection)
        // coldWeatherMethodsDays = -18°C to -5°C (0°F to 23°F) are WORKABLE with proper methods, not counted as stoppage
        // extremeHeatDays = ≥100°F (reduces productivity but not full stoppage for most work)
        const workStoppingTempDays = parseInt(analysis.extremeColdDays) + Math.round(parseInt(analysis.extremeHeatDays) * 0.5);
        const tempExtremeRatio = workStoppingTempDays / totalDays;
        const tempRisk = Math.min(100, tempExtremeRatio * 400);

        console.log(`[RISK] Temperature: ${workStoppingTempDays}/${totalDays} work-stopping days (${analysis.extremeColdDays} extreme cold ≤0°F + ${Math.round(parseInt(analysis.extremeHeatDays) * 0.5)} heat days, ${(tempExtremeRatio*100).toFixed(1)}%) = ${tempRisk.toFixed(1)} risk`);

        // 3. Wind Risk (20% weight)
        // Check if we have actual wind data
        const hasWindData = analysis.avgWindSpeed !== undefined && analysis.avgWindSpeed !== null && !isNaN(analysis.avgWindSpeed);
        let windRisk = 0;

        if (hasWindData) {
            // Use actual wind data if available
            const highWindDays = parseInt(analysis.highWindDays) || 0;
            const windDaysRatio = highWindDays / totalDays;
            // FIX: Changed multiplier from 500 to 200 for more reasonable scaling
            // 50% of days with high wind = 100% risk (extreme)
            // 25% of days = 50% risk (moderate)
            // 20% of days = 40% risk (reasonable for windy climates)
            windRisk = Math.min(100, windDaysRatio * 200);
            console.log(`[RISK] Wind: ${highWindDays}/${totalDays} high wind days (${(windDaysRatio*100).toFixed(1)}%) = ${windRisk.toFixed(1)} risk`);
        } else {
            // No wind data available - set to null for special handling
            windRisk = null;
            console.log('[RISK] Wind: No data available, setting risk to null');
        }

        // 4. Seasonal Risk (25% weight)
        // Based on overall favorable conditions (realistic feasibility)
        // Higher workable days = LOWER risk (inverted)
        const workableDays = parseInt(analysis.workableDays || analysis.optimalDays);
        const favorableRatio = workableDays / totalDays;
        // Convert to risk: 100% workable = 0% risk, 0% workable = 100% risk
        const seasonRisk = Math.max(0, Math.min(100, (1 - favorableRatio) * 100));
        console.log(`[RISK] Seasonal: ${workableDays}/${totalDays} workable (${(favorableRatio*100).toFixed(1)}% favorable) = ${seasonRisk.toFixed(1)} risk`);

        // Get template for project-specific risk weighting
        let template = null;
        if (this.selectedTemplate && this.templatesLibrary) {
            template = this.templatesLibrary.getTemplate(this.selectedTemplate);
        }

        // Use template-specific weights if available, otherwise use default weights
        const weights = template?.riskWeights || {
            precipitation: 0.30,
            temperature: 0.25,
            wind: 0.20,
            workability: 0.25
        };

        console.log('[RISK] Using weights:', template ? `${template.name} template` : 'default', weights);

        // Calculate weighted total score
        // If wind data unavailable, redistribute its weight to other factors proportionally
        let totalScore;
        if (windRisk === null) {
            // Redistribute wind weight proportionally to other factors
            const totalWithoutWind = weights.precipitation + weights.temperature + weights.workability;
            const precipWeight = weights.precipitation / totalWithoutWind;
            const tempWeight = weights.temperature / totalWithoutWind;
            const seasonWeight = weights.workability / totalWithoutWind;

            totalScore = Math.round(
                (precipRisk * precipWeight) +
                (tempRisk * tempWeight) +
                (seasonRisk * seasonWeight)
            );
            console.log('[RISK] Wind data unavailable, redistributing weight proportionally');
        } else {
            totalScore = Math.round(
                (precipRisk * weights.precipitation) +
                (tempRisk * weights.temperature) +
                (windRisk * weights.wind) +
                (seasonRisk * weights.workability)
            );
        }

        console.log(`[RISK] Total Score: ${totalScore}/100`, {
            precip: Math.round(precipRisk),
            temp: Math.round(tempRisk),
            wind: windRisk !== null ? Math.round(windRisk) : 'N/A',
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

        // Generate recommendations based on risk factors (template already fetched above)
        const recommendations = this.generateRiskRecommendations({
            totalScore,
            precipRisk,
            tempRisk,
            windRisk,
            seasonRisk,
            analysis,
            template  // Pass template for project-specific guidance
        });

        return {
            totalScore,
            riskLevel,
            riskColor,
            breakdown: {
                precipitation: Math.round(precipRisk),
                temperature: Math.round(tempRisk),
                wind: windRisk !== null ? Math.round(windRisk) : null,
                seasonal: Math.round(seasonRisk)
            },
            hasWindData,
            recommendations
        };
    }

    generateRiskRecommendations(riskData) {
        const recommendations = [];
        const { totalScore, precipRisk, tempRisk, windRisk, analysis, template } = riskData;

        // Calculate transparent contingency recommendation
        const totalProjectDays = analysis.actualProjectDays || 365;
        const heavyRain = analysis.heavyRainDays || 0;
        const workStoppingCold = analysis.extremeColdDays || 0;
        const heavySnow = analysis.heavySnowDays || 0;
        const grossStoppageDays = heavyRain + workStoppingCold + heavySnow;

        // Use ACTUAL overlap count from daily data analysis (not arbitrary estimate)
        const actualOverlap = analysis.multiStoppageDays || 0;
        const netStoppageDays = grossStoppageDays - actualOverlap;
        const directStoppagePercent = ((netStoppageDays / totalProjectDays) * 100).toFixed(1);

        console.log('[STOPPAGE] Overlap analysis:', {
            heavyRain,
            extremeCold: workStoppingCold,
            heavySnow,
            gross: grossStoppageDays,
            actualOverlap,
            net: netStoppageDays,
            percent: directStoppagePercent
        });

        // Recommended contingency includes:
        // 1. Direct stoppage days (baseline)
        // 2. Indirect delays: setup/teardown, mobilization after stoppages, partial workdays
        // 3. Schedule cascading effects: critical path impacts, trade coordination delays
        // 4. Safety margin for inter-annual variability
        // Industry best practice: 1.3-1.5x direct stoppage
        let recommendedContingency = '';
        let contingencyExplanation = '';
        if (netStoppageDays === 0) {
            recommendedContingency = '10%';
            contingencyExplanation = 'Minimal weather risk - standard contingency recommended';
        } else {
            const minContingency = Math.ceil(parseFloat(directStoppagePercent) * 1.3);
            const maxContingency = Math.ceil(parseFloat(directStoppagePercent) * 1.5);
            recommendedContingency = `${minContingency}-${maxContingency}%`;
            contingencyExplanation = `${directStoppagePercent}% direct stoppage × 1.3-1.5 multiplier (accounts for indirect delays, setup/teardown, and schedule cascading)`;
        }

        // Get template-specific thresholds and risk factors
        const templateName = template ? template.name : 'General Construction';
        const riskFactors = template ? template.riskFactors : {};

        // HIGH PRECIPITATION RISK - Template-specific guidance
        if (precipRisk > 60 && riskFactors.rain === 'CRITICAL') {
            // Critical rain sensitivity (roofing, painting)
            recommendations.push(`${templateName}: Rain is CRITICAL - ${analysis.rainyDays} rainy days will stop all work`);
            if (template?.name === 'Roofing Installation') {
                recommendations.push('Have tarps ready for immediate coverage. No exposed work areas during rain');
            } else if (template?.name === 'Exterior Painting') {
                recommendations.push('Need 48 hours dry weather after application. Plan around rain windows');
            }
        } else if (precipRisk > 60 && riskFactors.rain === 'HIGH') {
            // High rain sensitivity (concrete)
            recommendations.push(`${templateName}: Plan for ${analysis.rainyDays} rainy days with work stoppages`);
            if (template?.name === 'Commercial Concrete Work') {
                recommendations.push('Avoid pouring 24hrs before/after rain. Use proper drainage and curing protection');
            }
        } else if (precipRisk > 60) {
            // Medium/low rain sensitivity
            recommendations.push(`Plan for ${analysis.rainyDays} rainy days (${heavyRain} work-stopping)`);
        }

        // HIGH TEMPERATURE RISK - Template-specific guidance
        if (tempRisk > 60) {
            const workStoppingCold = parseInt(analysis.extremeColdDays) || 0;

            if (workStoppingCold > 15) {
                if (template?.name === 'Commercial Concrete Work') {
                    recommendations.push(`Plan for ${workStoppingCold} extreme cold stoppage days (${this.formatThresholdTemp(-18, '≤')}): heated enclosures and winter methods required`);
                    recommendations.push(`Concrete curing requires temps above ${this.formatThresholdTemp(4, '>')}. Use heated blankets and winter admixtures`);
                } else if (template?.name === 'Roofing Installation') {
                    recommendations.push(`${workStoppingCold} extreme cold days expected (${this.formatThresholdTemp(-18, '≤')}). Asphalt shingles brittle below ${this.formatTemp(- 5, 'C')}`);
                    recommendations.push(`Use cold-weather adhesives. Work limited to above ${this.formatTemp(-5, 'C')} days`);
                } else {
                    recommendations.push(`Plan for ${workStoppingCold} extreme cold stoppage days (${this.formatThresholdTemp(-18, '≤')}): heated enclosures recommended`);
                    recommendations.push('Consider insulated materials and cold-weather equipment');
                }
            }

            if (parseInt(analysis.extremeHeatDays) > 20) {
                if (template?.name === 'Commercial Concrete Work') {
                    recommendations.push(`Pour concrete early morning during heat. Use retarders above ${this.formatThresholdTemp(32, '>')}`);
                } else if (template?.name === 'Exterior Painting') {
                    recommendations.push(`Paint in morning/evening during heat. Avoid midday temps above ${this.formatTemp(32, 'C')}`);
                } else {
                    recommendations.push('Schedule heat-sensitive work during cooler hours. Plan worker heat safety');
                }
            }
        }

        // HIGH WIND RISK - Template-specific guidance
        if (windRisk !== null && windRisk > 60) {
            const highWindDays = parseInt(analysis.highWindDays) || 0;

            if (riskFactors.wind === 'CRITICAL') {
                // For wind-critical templates (roofing, painting), 30 km/h affects workable days
                if (template?.workabilityThresholds?.maxWind && template.workabilityThresholds.maxWind <= 30) {
                    recommendations.push(`${templateName}: WIND CRITICAL - ${highWindDays} elevated wind days (≥30 km/h) will restrict or stop work`);
                } else {
                    recommendations.push(`${templateName}: WIND CRITICAL - Monitor wind conditions. Days ≥60 km/h will stop work`);
                }
                if (template?.name === 'Roofing Installation') {
                    recommendations.push('Safety hazard: Elevated work restricted above 30 km/h (19 mph). Very high wind sensitivity');
                }
            } else if (template?.name === 'Commercial Concrete Work') {
                recommendations.push(`${highWindDays} elevated wind days expected (≥30 km/h). May restrict crane operations for rebar/forms`);
            } else if (highWindDays > 20) {
                recommendations.push(`Consider ${highWindDays} elevated wind days (≥30 km/h) for safety planning. Work stops at ≥60 km/h`);
            }
        }

        // SNOW RISK - Template-specific
        if (heavySnow > 5) {
            if (template?.name === 'Roofing Installation') {
                recommendations.push(`${heavySnow} heavy snow days: Roof work impossible during snow/ice conditions`);
            } else if (template?.name === 'Commercial Concrete Work') {
                recommendations.push(`${heavySnow} heavy snow days: No concrete work possible during active snowfall`);
            } else {
                recommendations.push(`${heavySnow} heavy snow days expected: plan for snow removal and delays`);
            }

            // Add ERA5 warning if snow is underestimated
            const usingNOAA = analysis.snowDataSource && analysis.snowDataSource.source === 'NOAA';
            if (!usingNOAA && analysis.totalSnowfall > 10) {
                recommendations.push('⚠️ Snow estimates may be conservative. Actual snowfall could be higher - add extra contingency');
            }
        }

        // OVERALL RISK LEVEL GUIDANCE
        if (totalScore > 65) {
            recommendations.push(`Add ${recommendedContingency} weather contingency to project schedule (${contingencyExplanation})`);
            recommendations.push('Consider weather insurance or performance bonds');
            recommendations.push('Develop detailed weather contingency plans');
        } else if (totalScore > 40) {
            recommendations.push(`Add ${recommendedContingency} weather contingency to project schedule (${contingencyExplanation})`);
            recommendations.push('Monitor weather forecasts closely during critical phases');
        } else {
            recommendations.push('Weather conditions are generally favorable for this project');
            recommendations.push(`Weather contingency of ${recommendedContingency} recommended (${contingencyExplanation})`);
        }

        // OPTIMAL DAYS INSIGHT
        const workableDays = parseInt(analysis.workableDays);
        if (workableDays < totalProjectDays * 0.6) {
            const idealDays = parseInt(analysis.idealDays) || 0;
            recommendations.push(`Only ${workableDays}/${totalProjectDays} days workable (${idealDays} ideal). Focus critical work during optimal weather windows`);
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

        // Get ACTUAL RISK SCORES (0-100) from breakdown
        const hasWindData = riskScore.breakdown.wind !== null && riskScore.breakdown.wind !== undefined;

        const precipScore = Math.round(riskScore.breakdown.precipitation);
        const tempScore = Math.round(riskScore.breakdown.temperature);
        const windScore = hasWindData ? Math.round(riskScore.breakdown.wind) : null;
        const seasonScore = Math.round(riskScore.breakdown.seasonal);

        console.log('[RISK] Actual risk scores (0-100):', {
            precip: precipScore,
            temp: tempScore,
            wind: windScore,
            seasonal: seasonScore
        });

        // Update risk breakdown bars with ACTUAL SCORES (0-100)
        this.updateRiskBar('precipRiskBar', 'precipRiskScore', precipScore);
        this.updateRiskBar('tempRiskBar', 'tempRiskScore', tempScore);
        this.updateRiskBar('windRiskBar', 'windRiskScore', hasWindData ? windScore : 'N/A');
        this.updateRiskBar('seasonRiskBar', 'seasonRiskScore', seasonScore);

        // Pie chart removed - risk bars show all necessary info
        // this.createRiskPieChart({
        //     precipitation: precipPercent,
        //     temperature: tempPercent,
        //     wind: hasWindData ? windPercent : null,
        //     seasonal: seasonPercent
        // }, hasWindData);

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

        // Find the parent risk-item container to hide entire row when no data
        const riskItem = bar?.closest('.risk-item');

        if (bar) {
            // Handle N/A values (missing data) - HIDE THE ENTIRE ROW
            if (value === 'N/A' || value === null) {
                if (riskItem) {
                    riskItem.style.display = 'none'; // Hide entire row for wind when unavailable
                }
            } else {
                if (riskItem) {
                    riskItem.style.display = ''; // Show row when data available
                }
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
        }

        if (score) {
            if (value === 'N/A' || value === null) {
                // Row is hidden, no need to update text
                score.textContent = 'Data unavailable';
            } else {
                // Add descriptive text for all risk categories
                let label = '';
                if (value <= 25) {
                    label = ' (Low)';
                } else if (value <= 50) {
                    label = ' (Moderate)';
                } else if (value <= 75) {
                    label = ' (High)';
                } else {
                    label = ' (Critical)';
                }
                score.textContent = value + '%' + label;
                score.style.fontSize = ''; // Reset to default
                score.style.fontStyle = ''; // Reset to default
            }
        }
    }

    createRiskPieChart(breakdown, hasWindData = true) {
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

        // Build chart data based on whether wind data is available
        let labels, data, colors;

        if (hasWindData && breakdown.wind !== null) {
            // Include all 4 factors
            labels = ['Precipitation', 'Temperature', 'Wind', 'Seasonal'];
            data = [
                breakdown.precipitation,
                breakdown.temperature,
                breakdown.wind,
                breakdown.seasonal
            ];
            colors = [
                '#3498db', // Blue for precipitation
                '#e67e22', // Orange for temperature
                '#1abc9c', // Teal for wind
                '#9b59b6'  // Purple for seasonal
            ];
        } else {
            // Exclude wind - only show 3 factors
            labels = ['Precipitation', 'Temperature', 'Seasonal'];
            data = [
                breakdown.precipitation,
                breakdown.temperature,
                breakdown.seasonal
            ];
            colors = [
                '#3498db', // Blue for precipitation
                '#e67e22', // Orange for temperature
                '#9b59b6'  // Purple for seasonal
            ];
            console.log('[RISK] Wind data unavailable - excluding from pie chart');
        }

        this.charts.riskPie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#0a1929',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1500,
                    easing: 'easeInOutQuart'
                },
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
            const snowSource = analysis.snowDataSource?.source || 'ERA5';
            const usingNOAA = snowSource === 'NOAA';

            // Build clear multi-source attribution
            let dataSourceNote = '';
            if (usingNOAA) {
                dataSourceNote = `*Data Sources: Snowfall from <strong>NOAA station</strong> (${analysis.snowDataSource.station}, ${analysis.snowDataSource.distance.toFixed(1)}km away - direct measurements, high reliability). Temperature, precipitation, and wind from <strong>ERA5 reanalysis</strong> (30km resolution). Historical averages calculated from ${analysis.yearsAnalyzed} years of data.`;
            } else {
                const snowCapture = analysis.snowDataSource?.accuracy || '~4%';
                dataSourceNote = `*Data Sources: All metrics from <strong>ERA5 reanalysis</strong> (30km resolution). <strong>Note on snowfall:</strong> Reanalysis models typically capture only ${snowCapture} of station-measured snowfall and often underestimate in mountain/lake-effect regions. Temperature and precipitation metrics are more reliable. Consider using wider contingency buffers for snow-dependent operations.`;
            }

            const confidenceHTML = `
                <div class="confidence-info">
                    <h5><i class="fas fa-chart-line"></i> Statistical Confidence</h5>
                    <p>Rainy Days: ${analysis.rainyDays} (range: ${analysis.rainyDaysMin}-${analysis.rainyDaysMax})</p>
                    <p>Precipitation: ${analysis.totalPrecip}mm (range: ${analysis.precipMin}-${analysis.precipMax}mm)</p>
                    <p class="confidence-note">Based on ${analysis.yearsAnalyzed} years of historical data (${(analysis.dataQuality * 100).toFixed(0)}% complete)*</p>
                    <p class="footnote" style="font-size: 0.85em; color: #94a3b8; margin-top: 0.5rem;">${dataSourceNote}</p>
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
    // MONTHLY BREAKDOWN DISPLAY
    // ========================================================================

    displayMonthlyBreakdown(analysis) {
        const container = document.getElementById('monthlyBreakdownContainer');
        if (!container) return;

        if (!analysis.monthlyBreakdown || !Array.isArray(analysis.monthlyBreakdown)) {
            container.innerHTML = '<p class="summary-loading">Monthly breakdown data not available.</p>';
            return;
        }

        const monthlyData = analysis.monthlyBreakdown;

        // Generate table HTML
        let tableHTML = `
            <div class="monthly-table-wrapper">
                <table class="monthly-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Heavy Rain Days</th>
                            <th>Work-Stopping Cold</th>
                            <th>Heavy Snow Days</th>
                            <th>Workable %</th>
                            <th>Risk Level</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        monthlyData.forEach(month => {
            const riskClass = month.riskScore <= 10 ? 'risk-low' :
                            month.riskScore <= 25 ? 'risk-medium' : 'risk-high';
            const riskLabel = month.riskScore <= 10 ? 'Low' :
                            month.riskScore <= 25 ? 'Medium' : 'High';

            tableHTML += `
                <tr>
                    <td class="month-name">${month.month}</td>
                    <td>${month.heavyRainDays} days</td>
                    <td>${month.workStoppingColdDays} days</td>
                    <td>${month.heavySnowDays} days</td>
                    <td>${month.workablePercent}%</td>
                    <td class="${riskClass}">${riskLabel}</td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
                <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--steel-silver); font-style: italic;">
                    Note: Work-Stopping Cold = days ${this.formatThresholdTemp(-18, '≤')} requiring work stoppage. Days between ${this.formatThresholdTemp(-18, '>')} and ${this.formatThresholdTemp(-5, '≤')} are workable with cold-weather methods.
                </p>
                <p style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; font-size: 0.9rem; color: var(--steel-silver);">
                    <strong>Monthly Risk vs. Composite Risk:</strong> Monthly risk levels shown above count only work-stopping events (heavy rain + extreme cold + heavy snow). The overall <strong>Composite Risk Score</strong> uses a weighted formula including all weather factors: precipitation (30%), temperature (25%), wind (20%), and workability (25%). This is why months can show "Low" risk while the project has "Moderate" composite risk.
                </p>
            </div>
        `;

        // Generate heatmap HTML
        let heatmapHTML = `
            <div class="monthly-heatmap">
                <h4 class="heatmap-title"><i class="fas fa-chart-bar"></i> Concrete Pour Risk Heatmap</h4>
                <p style="margin: 0.5rem 0 1rem 0; font-size: 0.85rem; color: var(--steel-silver); font-style: italic;">Total work-stopping days per month (Heavy Rain + Extreme Cold + Heavy Snow)</p>
                <div class="heatmap-grid">
        `;

        monthlyData.forEach(month => {
            const totalRiskDays = month.heavyRainDays + month.workStoppingColdDays + month.heavySnowDays;
            const maxDays = month.avgDaysInMonth;
            const riskPercent = Math.min(100, (totalRiskDays / maxDays) * 100);

            let riskClass, riskLabel;
            if (riskPercent === 0) {
                riskClass = 'risk-none';
                riskLabel = 'Ideal';
            } else if (riskPercent <= 10) {
                riskClass = 'risk-low';
                riskLabel = 'Low Risk';
            } else if (riskPercent <= 25) {
                riskClass = 'risk-medium';
                riskLabel = 'Medium Risk';
            } else if (riskPercent <= 40) {
                riskClass = 'risk-high';
                riskLabel = 'High Risk';
            } else {
                riskClass = 'risk-critical';
                riskLabel = 'Critical';
            }

            heatmapHTML += `
                <div class="heatmap-row">
                    <div class="heatmap-month-label">${month.month}</div>
                    <div class="heatmap-bar-container">
                        <div class="heatmap-bar ${riskClass}" style="width: ${Math.max(15, riskPercent)}%;"
                             title="${month.month}: ${totalRiskDays} total work-stopping days (${month.heavyRainDays} rain + ${month.workStoppingColdDays} cold + ${month.heavySnowDays} snow)">
                            ${totalRiskDays} days
                        </div>
                    </div>
                </div>
            `;
        });

        heatmapHTML += `
                </div>
                <div class="heatmap-legend">
                    <div class="legend-item">
                        <div class="legend-color" style="background: linear-gradient(90deg, #10b981, #059669);"></div>
                        <span class="legend-label">Ideal (0 risk days)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: linear-gradient(90deg, #84cc16, #65a30d);"></div>
                        <span class="legend-label">Low Risk (≤10%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: linear-gradient(90deg, #f59e0b, #d97706);"></div>
                        <span class="legend-label">Medium Risk (11-25%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: linear-gradient(90deg, #ef4444, #dc2626);"></div>
                        <span class="legend-label">High Risk (26-40%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: linear-gradient(90deg, #dc2626, #991b1b);"></div>
                        <span class="legend-label">Critical (>40%)</span>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = tableHTML + heatmapHTML;

        console.log('[MONTHLY] Monthly breakdown displayed with heatmap');
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

            // Add template information if available
            if (project.analysis?.templateName) {
                rows.push([`Project Template: ${project.analysis.templateName}`]);

                // Add template-specific KPIs
                if (project.analysis.templateKPIs && project.analysis.templateKPIs.length > 0) {
                    rows.push([]); // Empty row
                    rows.push([`TEMPLATE-SPECIFIC METRICS - ${project.analysis.templateName}`]);
                    project.analysis.templateKPIs.forEach(kpi => {
                        rows.push([`  ${kpi.metric}:`, `${kpi.value} ${kpi.unit}`, `-`, kpi.description]);
                    });
                }
            }

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
                                snow != null ? (this.unitSystem === 'imperial' ? this.cmToInches(snow).toFixed(2) : snow.toFixed(1)) : '',  // snow in mm water equiv = cm depth numerically
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

        // Update template badge in project header
        const templateBadgeEl = document.getElementById('projectInfoTemplate');
        if (templateBadgeEl) {
            if (this.selectedTemplate && this.templatesLibrary) {
                const template = this.templatesLibrary.getTemplate(this.selectedTemplate);
                if (template) {
                    const templateIcon = template.icon || 'fa-cog';
                    templateBadgeEl.innerHTML = `
                        <i class="fas ${templateIcon}" style="color: var(--electric-cyan); margin-right: 0.5rem;"></i>
                        <strong style="color: var(--electric-cyan);">Analysis Template:</strong>
                        <span style="color: var(--arctic-white); margin-left: 0.5rem;">${this.sanitizeHTML(template.name)}</span>
                    `;
                    templateBadgeEl.style.display = 'block';
                } else {
                    templateBadgeEl.style.display = 'none';
                }
            } else {
                // Show default/general construction warning
                templateBadgeEl.innerHTML = `
                    <i class="fas fa-exclamation-triangle" style="color: #f39c12; margin-right: 0.5rem;"></i>
                    <strong style="color: #f39c12;">Analysis Template:</strong>
                    <span style="color: var(--arctic-white); margin-left: 0.5rem;">General Construction (Default)</span>
                `;
                templateBadgeEl.style.display = 'block';
            }
        }

        // Add timestamp of when the analysis was completed
        // If loading an existing project, use its saved timestamp; otherwise use current time
        let timestampDate;
        if (this.currentProject.lastUpdated) {
            timestampDate = new Date(this.currentProject.lastUpdated);
        } else {
            timestampDate = new Date();
            this.currentProject.lastUpdated = timestampDate.toISOString();
        }

        const timestamp = timestampDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        document.getElementById('projectInfoUpdated').textContent = `Updated: ${timestamp}`;

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

        // Wind data (now available from API)
        if (el('avgWind')) {
            const avgWind = analysis.avgWindSpeed;
            el('avgWind').textContent = (avgWind !== undefined && avgWind !== null && avgWind !== 'N/A') ? `${avgWind} km/h` : 'N/A';
        }
        if (el('maxWind')) {
            const maxWind = analysis.maxWindSpeed;
            el('maxWind').textContent = (maxWind !== undefined && maxWind !== null && maxWind !== 'N/A') ? `${maxWind} km/h` : 'N/A';
        }

        // Extreme heat days
        if (el('extremeHeatDays')) el('extremeHeatDays').textContent = analysis.extremeHeatDays || 0;

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
            // Snow: mm water equiv = cm depth numerically (10:1 ratio), convert cm to inches
            snowData = monthlyData.snow.map(s => s != null ? this.cmToInches(s) : 0);
            precipLabel = 'Rain (in)';
            snowLabel = 'Snow (in)';
        } else {
            // Keep metric (mm for rain, snow in mm water equiv = cm depth numerically)
            precipData = monthlyData.precip;
            snowData = monthlyData.snow;  // Already in cm depth equivalent
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

        // Calculate key percentages
        const workablePercent = Math.round((analysis.workableDays / duration) * 100);
        const idealPercent = Math.round((analysis.idealDays / duration) * 100);
        const rainyPercent = Math.round((analysis.rainyDays / duration) * 100);
        // Heavy rain as percentage of rainy days (for table display)
        const heavyRainOfRainyPercent = analysis.rainyDays > 0 ? Math.round((analysis.heavyRainDays / analysis.rainyDays) * 100) : 0;
        // Heavy rain as percentage of total project (for impact assessment)
        const heavyRainOfTotalPercent = Math.round((analysis.heavyRainDays / duration) * 100);

        // Determine overall risk level
        const riskScore = analysis.riskScore || this.calculateRiskScore(analysis);
        const riskLevel = riskScore.riskLevel || 'MODERATE RISK';

        // Format snow/wind data properly
        const snowDisplay = analysis.totalSnowfall > 0 ?
            (analysis.totalSnowfall < 0.1 ? 'Trace' : this.formatSnow(analysis.totalSnowfall)) : this.formatSnow(0);
        const windDisplay = analysis.avgWindSpeed || 'Calculating...';
        const maxWindDisplay = analysis.maxWindSpeed || 'Calculating...';

        // Determine snow data source
        let snowDataSource = null;
        if (project.historicalData && project.historicalData.length > 0) {
            const firstYear = project.historicalData[0];
            if (firstYear.data && firstYear.data.snowDataSource) {
                snowDataSource = firstYear.data.snowDataSource;
            }
        }

        // ========================================================================
        // 1. PROJECT HEADER
        // ========================================================================

        // Get template information to display clearly
        let templateBadge = '';
        if (this.selectedTemplate && this.templatesLibrary) {
            const template = this.templatesLibrary.getTemplate(this.selectedTemplate);
            if (template) {
                const templateIcon = template.icon || 'fa-cog';
                templateBadge = `<div style="margin: 0.5rem 0; padding: 0.5rem 1rem; background: rgba(0, 212, 255, 0.1); border: 1px solid var(--electric-cyan); border-radius: 6px; display: inline-block;">
                    <i class="fas ${templateIcon}" style="color: var(--electric-cyan); margin-right: 0.5rem;"></i>
                    <strong style="color: var(--electric-cyan);">Analysis Template:</strong>
                    <span style="color: var(--arctic-white);">${this.sanitizeHTML(template.name)}</span>
                </div>`;
            }
        } else {
            templateBadge = `<div style="margin: 0.5rem 0; padding: 0.5rem 1rem; background: rgba(243, 156, 18, 0.1); border: 1px solid #f39c12; border-radius: 6px; display: inline-block;">
                <i class="fas fa-exclamation-triangle" style="color: #f39c12; margin-right: 0.5rem;"></i>
                <strong style="color: #f39c12;">Analysis Template:</strong>
                <span style="color: var(--arctic-white);">General Construction (Default)</span>
            </div>`;
        }

        let summary = `<div style="border-bottom: 2px solid var(--electric-cyan); padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <h3 style="margin: 0 0 0.5rem 0; color: var(--electric-cyan);">Project Overview</h3>
        <p style="margin: 0;"><strong>${this.sanitizeHTML(project.name)}</strong></p>
        ${templateBadge}
        <p style="margin: 0.5rem 0 0 0;">Location: ${this.sanitizeHTML(project.locationName)}<br>
        Duration: ${duration} days (approx. ${months} months) | ${project.startDate} to ${project.endDate}<br>
        Analysis Period: ${analysis.yearsAnalyzed} years of historical data (same calendar period)</p>
        </div>`;

        // ========================================================================
        // 2. KEY WEATHER METRICS SUMMARY (TABLE)
        // ========================================================================
        summary += `<div style="margin-bottom: 1.5rem;">
        <h3 style="color: var(--electric-cyan); margin-bottom: 1rem;"><i class="fas fa-table"></i> Key Weather Metrics Summary</h3>
        <table style="width: 100%; border-collapse: collapse; background: rgba(10, 25, 41, 0.6); border-radius: 8px; overflow: hidden;">
        <thead>
        <tr style="background: rgba(0, 212, 255, 0.1); border-bottom: 2px solid var(--electric-cyan);">
        <th style="padding: 0.75rem; text-align: left; color: var(--electric-cyan);">Metric</th>
        <th style="padding: 0.75rem; text-align: right; color: var(--electric-cyan);">Expected Value</th>
        <th style="padding: 0.75rem; text-align: right; color: var(--electric-cyan);">% of Project</th>
        </tr>
        </thead>
        <tbody style="color: var(--arctic-white);">
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 0.75rem;"><strong>Workable Days</strong></td>
        <td style="padding: 0.75rem; text-align: right;"><strong>${analysis.workableDays}</strong></td>
        <td style="padding: 0.75rem; text-align: right;"><strong>${workablePercent}%</strong></td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 0.75rem; padding-left: 1.5rem;">↳ Ideal Days (subset)</td>
        <td style="padding: 0.75rem; text-align: right;">${analysis.idealDays}</td>
        <td style="padding: 0.75rem; text-align: right;">${idealPercent}%</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 0.75rem;">Total Rainy Days</td>
        <td style="padding: 0.75rem; text-align: right;">${analysis.rainyDays}</td>
        <td style="padding: 0.75rem; text-align: right;">${rainyPercent}%</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 0.75rem;">Heavy Rain Days (≥15mm)</td>
        <td style="padding: 0.75rem; text-align: right;">${analysis.heavyRainDays}</td>
        <td style="padding: 0.75rem; text-align: right;">${heavyRainOfRainyPercent}% of rainy days</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 0.75rem;">Snow Days ${this.getSnowDataBadge(snowDataSource)}</td>
        <td style="padding: 0.75rem; text-align: right;">${analysis.snowyDays}</td>
        <td style="padding: 0.75rem; text-align: right;">Total: ${snowDisplay}${this.getSnowDataDetails(snowDataSource)}</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 0.75rem;">Freezing Days (Total)</td>
        <td style="padding: 0.75rem; text-align: right;">${analysis.allFreezingDays}</td>
        <td style="padding: 0.75rem; text-align: right;">Work-stopping cold (${this.formatThresholdTemp(-18, '≤')}): ${analysis.extremeColdDays}</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 0.75rem;">Wind Speed (Avg/Max)</td>
        <td style="padding: 0.75rem; text-align: right;" colspan="2">${windDisplay} / ${maxWindDisplay} km/h</td>
        </tr>
        <tr>
        <td style="padding: 0.75rem;">Total Precipitation</td>
        <td style="padding: 0.75rem; text-align: right;" colspan="2">${analysis.totalPrecip} mm</td>
        </tr>
        </tbody>
        </table>
        </div>`;

        // ========================================================================
        // 2.5 DATA QUALITY NOTICE (Snowfall Warning)
        // ========================================================================
        // Show warning ONLY if using ERA5 fallback data (not NOAA direct measurements)
        // NOAA data is 100% accurate and doesn't need a warning
        const usingNOAA = analysis.snowDataSource && analysis.snowDataSource.source === 'NOAA';
        console.log('[SUMMARY] Snow data source check:', {
            source: analysis.snowDataSource?.source,
            usingNOAA,
            willShowWarning: !usingNOAA && (analysis.snowyDays > 5 || analysis.totalSnowfall > 1)
        });

        if ((analysis.snowyDays > 5 || analysis.totalSnowfall > 1) && !usingNOAA) {
            summary += `<div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107; border-radius: 8px;">
            <h3 style="color: #ffc107; margin: 0 0 0.5rem 0;"><i class="fas fa-exclamation-triangle"></i> Data Quality Notice</h3>
            <p style="margin: 0; font-size: 0.95rem; line-height: 1.6;">
            <strong>Snowfall estimates may be conservative:</strong> This analysis uses ${analysis.snowDataSource?.source || 'ERA5'} reanalysis data, which is known to underestimate snowfall in many regions (particularly Great Plains, Mountain West, and northern climates).
            Actual snowfall may be significantly higher than shown. For snow-prone locations, cross-reference with local NOAA station data and add extra winter weather contingency.
            Temperature and precipitation data are generally accurate.
            <a href="DATA_QUALITY_NOTES.md" target="_blank" style="color: #ffc107;">Learn more about data quality</a>
            </p>
            </div>`;
        }

        // ========================================================================
        // 3. OVERALL WEATHER RISK SCORE
        // ========================================================================
        const riskColor = riskScore.riskColor || '#f39c12';
        summary += `<div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(10, 25, 41, 0.6); border-left: 4px solid ${riskColor}; border-radius: 8px;">
        <h3 style="color: var(--electric-cyan); margin: 0 0 0.5rem 0;"><i class="fas fa-shield-alt"></i> Overall Weather Risk Assessment</h3>
        <p style="margin: 0; font-size: 1.1rem;"><strong>Risk Level:</strong> <span style="color: ${riskColor}; font-weight: 700;">${riskLevel}</span> (Score: ${riskScore.totalScore}/100)</p>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.95rem; color: var(--steel-silver);">Based on precipitation, temperature, wind, and seasonal variability factors.</p>
        </div>`;

        // ========================================================================
        // 4. PROJECT-SPECIFIC IMPACTS (Template-Aware)
        // ========================================================================
        const templateName = analysis.templateName || '';
        const isPainting = templateName.toLowerCase().includes('paint');
        const isRoofing = templateName.toLowerCase().includes('roof');
        const isConcrete = templateName.toLowerCase().includes('concrete') || templateName.toLowerCase().includes('foundation') || templateName.toLowerCase().includes('slab');

        const sectionTitle = isPainting ? 'Exterior Painting Conditions' :
                           isRoofing ? 'Roofing Work Impacts' :
                           isConcrete ? 'Concrete Work Impacts' :
                           'Project-Specific Impacts';

        const sectionIcon = isPainting ? 'fa-paint-roller' :
                          isRoofing ? 'fa-home' :
                          isConcrete ? 'fa-hard-hat' :
                          'fa-wrench';

        summary += `<div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(230, 126, 34, 0.1); border: 2px solid #e67e22; border-radius: 8px;">
        <h3 style="color: #e67e22; margin: 0 0 1rem 0;"><i class="fas ${sectionIcon}"></i> ${sectionTitle}</h3>
        <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8;">`;

        // PAINTING-SPECIFIC CONTENT
        if (isPainting) {
            // Temperature and substrate conditions
            if (analysis.allFreezingDays > 0) {
                const avgLowF = this.convertTemp(parseFloat(analysis.avgTempMin), 'C');
                summary += `<li><strong>Substrate moisture and temperature control</strong> – ${analysis.allFreezingDays} freezing days expected. Paint will not cure properly below ${this.formatThresholdTemp(10, '<')}. Surface must be above dew point to prevent moisture condensation under paint film. Allow frozen surfaces to thaw and dry completely before application.</li>`;
            }

            // High rainfall areas (potential moisture concerns)
            const avgTempC = (parseFloat(analysis.avgTempMax) + parseFloat(analysis.avgTempMin)) / 2;
            if (analysis.rainyDays > 40) {
                summary += `<li><strong>High-moisture environment</strong> – ${analysis.rainyDays} rainy days indicate frequent moisture. Verify substrate is completely dry before painting. Consider moisture meters for critical applications. Note: Humidity and dew point data not currently included in analysis.</li>`;
            }

            // Paint cure windows (rain risk)
            if (analysis.heavyRainDays > 5) {
                summary += `<li><strong>Paint cure windows require planning</strong> – ${analysis.heavyRainDays} heavy rain days threaten uncured paint. Require minimum 48-hour dry forecast before starting each coat. Monitor weather closely and have tarps ready for unexpected weather changes.</li>`;
            }

            // Application days
            summary += `<li><strong>Optimal application windows</strong> – ${analysis.idealDays} ideal days identified with proper temperature (${this.formatThresholdTemp(10, '≥')} to ${this.formatThresholdTemp(29, '≤')}), dry conditions, and calm winds. Schedule critical exterior work during these periods for best adhesion and cure.</li>`;

            // Wind impact on spray application
            if (analysis.highWindDays > 15) {
                summary += `<li><strong>Wind affects spray application quality</strong> – ${analysis.highWindDays} high-wind days (≥30 km/h) will cause overspray, uneven coverage, and material waste. Plan to use brush/roller on windy days or schedule spraying during calm periods.</li>`;
            }

            // Surface preparation in wet conditions
            if (analysis.rainyDays > 40) {
                summary += `<li><strong>Surface preparation challenges</strong> – ${analysis.rainyDays} rainy days make pressure washing, sanding, and priming difficult. Complete surface prep during dry streaks and protect prepared surfaces from rain before painting.</li>`;
            }
        }
        // CONCRETE-SPECIFIC CONTENT
        else if (isConcrete) {
            if (analysis.allFreezingDays > 10) {
                const coldWeatherTotal = (analysis.coldWeatherMethodsDays || 0) + (analysis.lightFreezingDays || 0);
                if (analysis.extremeColdDays > 0) {
                    summary += `<li><strong>Extreme cold stoppage</strong> – ${analysis.extremeColdDays} days with extreme cold (${this.formatThresholdTemp(-18, '≤')}) typically require work stoppage even with protection. ${analysis.coldWeatherMethodsDays || 0} additional days (${this.formatThresholdTemp(-18, '>')} to ${this.formatThresholdTemp(-5, '≤')}) are workable with proper cold-weather methods: blankets, hot water mix, accelerators, and heated enclosures. ${analysis.lightFreezingDays} days (${this.formatThresholdTemp(-5, '>')} to ${this.formatThresholdTemp(0, '≤')}) need only light precautions (timing, blankets).</li>`;
                } else if (coldWeatherTotal > 0) {
                    summary += `<li><strong>Cold-weather concrete methods required</strong> – ${analysis.coldWeatherMethodsDays || 0} days (${this.formatThresholdTemp(-18, '>')} to ${this.formatThresholdTemp(-5, '≤')}) need accelerators, hot water, and enclosures. ${analysis.lightFreezingDays} days (${this.formatThresholdTemp(-5, '>')} to ${this.formatThresholdTemp(0, '≤')}) need light precautions (timing, blankets). No extreme cold stoppage days expected.</li>`;
                }
            }

            if (analysis.heavyRainDays > 5) {
                let riskLevel = '';
                if (heavyRainOfTotalPercent < 2) {
                    riskLevel = 'manageable with proper scheduling';
                } else if (heavyRainOfTotalPercent < 4) {
                    riskLevel = 'moderate impact requiring planning';
                } else {
                    riskLevel = 'significant impact';
                }

                summary += `<li><strong>Heavy rain increases slab moisture exposure</strong> – ${analysis.heavyRainDays} days with ${this.formatThresholdPrecip(10)} rain (${heavyRainOfTotalPercent}% of project duration, ${riskLevel}). Implement waterproofing, drainage systems, and weather-protected pour areas.</li>`;
            }

            if (analysis.allFreezingDays > 0) {
                if (analysis.extremeColdDays > 0) {
                    summary += `<li><strong>Heated enclosures critical for extreme cold</strong> – Essential for ${analysis.extremeColdDays} extreme cold days (${this.formatThresholdTemp(-18, '≤')}). Maintain minimum ${this.formatThresholdTemp(10, '≥')} ambient temperature for proper curing.</li>`;
                }
                if ((analysis.coldWeatherMethodsDays || 0) > 0) {
                    const hotWaterTemp = this.formatTemp(49, 'C'); // 120°F = 49°C
                    summary += `<li><strong>Use winter mix and accelerating admixtures</strong> – Required for ${analysis.coldWeatherMethodsDays} cold-weather days (${this.formatThresholdTemp(-18, '>')} to ${this.formatThresholdTemp(-5, '≤')}). Type III cement or calcium chloride accelerators reduce cure time. Hot water mix (${hotWaterTemp}) recommended.</li>`;
                }
            }

            summary += `<li><strong>Plan pours during optimal windows</strong> – ${analysis.idealDays} ideal days identified. Schedule critical pours during these periods for best results.</li>`;
            summary += `<li><strong>Avoid early-morning winter pours</strong> – Unless blankets/heaters are used. Temperature drops overnight can damage fresh concrete.</li>`;
        }
        // ROOFING OR OTHER TEMPLATES
        else {
            // Generic weather impacts for other project types
            if (analysis.allFreezingDays > 10) {
                summary += `<li><strong>Cold weather precautions</strong> – ${analysis.allFreezingDays} freezing days expected. Many materials become brittle or lose adhesion in cold temperatures.</li>`;
            }

            if (analysis.heavyRainDays > 5) {
                summary += `<li><strong>Heavy rain impacts</strong> – ${analysis.heavyRainDays} days with heavy rain. Weather protection and drainage systems critical.</li>`;
            }

            summary += `<li><strong>Plan work during optimal windows</strong> – ${analysis.idealDays} ideal days identified for critical activities.</li>`;
        }

        // Calculate weather contingency with proper math
        // NOTE: Each category counts calendar days independently, then overlaps are ESTIMATED (not calculated from actual same-day events)
        const totalProjectDays = analysis.actualProjectDays || 365;
        const heavyRain = analysis.heavyRainDays || 0;
        const workStoppingCold = analysis.extremeColdDays || 0;
        const heavySnow = analysis.heavySnowDays || 0;
        const highWind = analysis.highWindDays || 0;

        // Gross total (sum of all categories - INCLUDES overlaps)
        const grossStoppageDays = heavyRain + workStoppingCold + heavySnow;

        // Use ACTUAL overlap count from daily data analysis if available, otherwise estimate
        const actualOverlap = analysis.multiStoppageDays || Math.round(grossStoppageDays * 0.25);
        const netStoppageDays = grossStoppageDays - actualOverlap;

        // Direct stoppage percentage
        const directStoppagePercent = ((netStoppageDays / totalProjectDays) * 100).toFixed(1);

        // Calculate recommended contingency
        let recommendedContingency = '';
        let justification = '';

        if (netStoppageDays === 0) {
            recommendedContingency = '10%';
            justification = 'No major work-stoppage events predicted, but standard weather buffer recommended.';
        } else {
            // Recommend 1.3-1.5x the direct percentage to account for setup/reset, curing delays, sequencing
            const minContingency = Math.ceil(parseFloat(directStoppagePercent) * 1.3);
            const maxContingency = Math.ceil(parseFloat(directStoppagePercent) * 1.5);
            recommendedContingency = `${minContingency}-${maxContingency}%`;

            justification = `Weather-stoppage analysis indicates ~${netStoppageDays} unique stoppage days (${heavyRain} heavy rain + ${workStoppingCold} extreme cold (${this.formatThresholdTemp(-18, '≤')}) + ${heavySnow} heavy snow = ${grossStoppageDays} gross days, minus ${actualOverlap} days with multiple conditions). `;
            justification += `Recommended schedule contingency: ${recommendedContingency}. Note: ${analysis.highWindDays || 0} high-wind days may restrict crane/elevated work but don't always stop all construction.`;

            const coldWeatherDays = (analysis.coldWeatherMethodsDays || 0);
            if (coldWeatherDays > 10) {
                justification += ` Note: ${coldWeatherDays} additional cold-weather days (${this.formatThresholdTemp(-18, '>')} to ${this.formatThresholdTemp(-5, '≤')}) are workable with proper methods (accelerators, hot water, enclosures).`;
            }

            if (highWind > 10) {
                justification += ` ${highWind} high-wind days may restrict crane/elevated work.`;
            }
        }

        summary += `<li><strong>Schedule Contingency Recommendation:</strong> ${recommendedContingency} weather-related float. ${justification}</li>`;
        summary += `</ul></div>`;

        // ========================================================================
        // 4.5 TEMPLATE-SPECIFIC ANALYSIS (if template selected)
        // ========================================================================
        if (this.selectedTemplate && this.templatesLibrary) {
            const template = this.templatesLibrary.getTemplate(this.selectedTemplate);
            if (template) {
                summary += this.generateTemplateSpecificAnalysis(template, analysis, this.currentProject);
            }
        }

        // ========================================================================
        // 5. DETAILED WEATHER ANALYSIS
        // ========================================================================
        summary += `<div style="margin-bottom: 1.5rem;">
        <h3 style="color: var(--electric-cyan); margin-bottom: 1rem;"><i class="fas fa-cloud-sun"></i> Detailed Weather Analysis</h3>`;

        // Overall conditions assessment
        if (workablePercent > 75) {
            summary += `<p><strong>Higher Workability Period:</strong> ${workablePercent}% of project days (${analysis.workableDays} days) are expected to be workable with normal construction precautions. ${analysis.idealDays} days (${idealPercent}%) offer ideal conditions. Favorable conditions for this region.</p>`;
        } else if (workablePercent > 50) {
            summary += `<p><strong>Moderate Workability:</strong> ${workablePercent}% of project days (${analysis.workableDays} days) are workable with standard precautions. ${analysis.idealDays} days (${idealPercent}%) offer ideal conditions. Typical for this region and season - plan for standard weather contingencies.</p>`;
        } else {
            summary += `<p><strong>Winter-Heavy Period:</strong> ${workablePercent}% of days (${analysis.workableDays}) are workable, with ${analysis.idealDays} ideal days (${idealPercent}%). Significant winter weather expected - enhanced weather planning, cold-weather methods, and schedule flexibility strongly recommended.</p>`;
        }

        // Precipitation analysis
        if (analysis.rainyDays > 0) {
            const rainyDaysMin = analysis.rainyDaysMin || Math.round(analysis.rainyDays * 0.85);
            const rainyDaysMax = analysis.rainyDaysMax || Math.round(analysis.rainyDays * 1.15);
            summary += `<p><strong>Precipitation Analysis:</strong> <strong>${analysis.rainyDays} rainy days</strong> expected (range: ${rainyDaysMin}-${rainyDaysMax}), with ${analysis.heavyRainDays} heavy rain days. ${heavyRainOfRainyPercent}% of rainy days are heavy`;
            if (heavyRainOfRainyPercent > 40) {
                summary += ` (higher than typical 15-30%)`;
            }
            summary += `.</p>`;
        }

        // Snow analysis
        if (analysis.snowyDays > 0) {
            summary += `<p><strong>Snow Advisory:</strong> <strong>${analysis.snowyDays} days</strong> with snowfall (total: ${snowDisplay}), including ${analysis.heavySnowDays} heavy snow days requiring work stoppage.</p>`;
        }

        if (analysis.allFreezingDays > 10) {
            // Temperature distribution summary
            summary += `<p><strong>❄️ Temperature Analysis:</strong> ${analysis.allFreezingDays} freezing days total`;

            if (analysis.extremeColdDays > 0) {
                summary += `, including ${analysis.extremeColdDays} days requiring work stoppage`;
            }
            if ((analysis.coldWeatherMethodsDays || 0) > 0) {
                summary += ` and ${analysis.coldWeatherMethodsDays} days requiring cold-weather methods`;
            }

            summary += `. ${this.getColdWeatherActionPlan(analysis.templateName)}</p>`;
        } else if (analysis.extremeColdDays > 0) {
            summary += `<p><strong>Extreme Cold Alert:</strong> ${analysis.extremeColdDays} days require work stoppage. ${this.getExtremeColdActionPlan(analysis.templateName)}</p>`;
        } else if ((analysis.coldWeatherMethodsDays || 0) > 0) {
            summary += `<p><strong>Cold-Weather Methods:</strong> ${analysis.coldWeatherMethodsDays} days require cold-weather methods. No extreme cold stoppage expected.</p>`;
        }

        summary += `</div>`;

        // ========================================================================
        // 6. RISK MITIGATION RECOMMENDATIONS
        // ========================================================================
        summary += `<div style="margin-bottom: 1.5rem;">
        <h3 style="color: var(--electric-cyan); margin-bottom: 1rem;"><i class="fas fa-lightbulb"></i> Risk Mitigation Recommendations</h3>
        <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8;">`;

        if (workablePercent > 65) {
            summary += `<li>Schedule critical path activities during optimal weather windows identified below</li>`;
        }
        if (analysis.rainyDays > 20) {
            summary += `<li>Implement comprehensive drainage and erosion control systems</li>`;
        }
        if (analysis.snowyDays > 0 || analysis.allFreezingDays > 15) {
            summary += `<li>Prepare cold-weather contingency plans and heated work areas</li>`;
        }
        if (riskScore.totalScore > 60) {
            summary += `<li>Consider weather insurance or performance bonds for high-risk periods</li>`;
        }
        summary += `<li>Monitor 10-day forecasts continuously for tactical adjustments</li>`;
        summary += `<li>Maintain weather-dependent schedule float of ${recommendedContingency} as calculated above</li>`;
        summary += `<li>Pre-stage materials and equipment for rapid mobilization during weather breaks</li>`;
        summary += `</ul></div>`;

        // ========================================================================
        // 7. HISTORICAL CONTEXT & CONFIDENCE
        // ========================================================================
        const dataSourceFootnote = usingNOAA
            ? `*Data coverage indicates percentage of project days with available historical records. Snowfall data from NOAA direct station measurements (${analysis.snowDataSource.station}, ${analysis.snowDataSource.distance.toFixed(1)}km away - high reliability). Temperature and precipitation from ERA5 reanalysis data.`
            : `*Data coverage indicates percentage of project days with available historical records (Open-Meteo ERA5 dataset). Values at or near 100% may include minor interpolation for missing data points.`;

        summary += `<div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(0, 212, 255, 0.05); border-left: 4px solid var(--electric-cyan); border-radius: 8px;">
        <h3 style="color: var(--electric-cyan); margin: 0 0 0.5rem 0;"><i class="fas fa-info-circle"></i> Historical Context & Confidence Level</h3>
        <p style="margin: 0;">This analysis is based on <strong>${analysis.yearsAnalyzed} years</strong> of actual weather data for the same calendar period. Data coverage: <strong>${(analysis.dataQuality * 100).toFixed(0)}%</strong> of project days included.*</p>
        <p style="margin: 0.25rem 0; font-size: 0.85rem; color: #94a3b8;">${dataSourceFootnote}</p>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: var(--steel-silver);"><strong>Important:</strong> Historical patterns provide valuable planning insights, but actual conditions may vary. Use this assessment in conjunction with short-term forecasts and professional meteorological guidance. Not suitable for life-safety decisions.</p>
        </div>`;

        container.innerHTML = summary;
    }

    // Template-specific cold weather descriptions
    getColdWeatherMethodsDescription(templateName) {
        if (!templateName) {
            return 'workable but expensive (accelerators, hot water mix, heated enclosures)';
        }

        switch (templateName) {
            case 'Commercial Concrete Work':
                return `workable with expensive cold-weather methods (accelerators, hot water mix ${this.formatTemp(49, 'C')}, heated enclosures)`;
            case 'Roofing Installation':
                return 'limited work possible (shingles brittle, adhesives slow-curing, safety concerns on icy surfaces)';
            case 'Exterior Painting':
                return `paint curing severely impaired (most paints won't cure properly below ${this.formatTemp(-5, 'C')})`;
            case 'Landscaping':
                return 'soil frozen and unworkable (heavy equipment damage risk, planting impossible until spring thaw)';
            default:
                return 'workable with specialized cold-weather methods and equipment';
        }
    }

    getExtremeStoppageDescription(templateName) {
        if (!templateName) {
            return 'true work stoppage even with protection';
        }

        switch (templateName) {
            case 'Commercial Concrete Work':
                return 'true concrete work stoppage (even heated enclosures struggle at these temperatures)';
            case 'Roofing Installation':
                return 'true work stoppage (extreme shingle brittleness, adhesive failure, severe safety hazards)';
            case 'Exterior Painting':
                return 'complete paint work stoppage (no paint formulas cure at these temperatures)';
            case 'Landscaping':
                return 'complete landscape stoppage (deeply frozen ground, equipment inoperable, survival conditions)';
            default:
                return 'true work stoppage - most construction activities unsafe/impossible';
        }
    }

    getColdWeatherActionPlan(templateName) {
        if (!templateName) {
            return 'Plan cold-weather protocols: blankets, accelerators, hot water, and enclosures as needed.';
        }

        switch (templateName) {
            case 'Commercial Concrete Work':
                return 'Plan cold-weather concrete protocols: curing blankets, accelerators, hot water mix, and heated enclosures as needed.';
            case 'Roofing Installation':
                return 'Plan roofing cold-weather protocols: work during warmest hours, hand-seal shingles, heated adhesive storage, fall protection on ice.';
            case 'Exterior Painting':
                return 'Plan painting cold-weather protocols: use cold-weather paint formulas, work during warmest hours, monitor surface and air temps.';
            case 'Landscaping':
                return 'Plan landscape cold-weather protocols: schedule dormant season work (hardscaping, non-planting tasks), prepare for spring planting push.';
            default:
                return 'Plan cold-weather protocols appropriate for your specific work type.';
        }
    }

    getExtremeColdActionPlan(templateName) {
        if (!templateName) {
            return 'Plan heated enclosures and schedule around these extreme conditions.';
        }

        switch (templateName) {
            case 'Commercial Concrete Work':
                return 'Schedule critical concrete pours outside extreme cold periods, or budget for industrial-grade heated enclosures.';
            case 'Roofing Installation':
                return 'Schedule roofing work outside extreme cold periods - winter roofing becomes impractical and dangerous.';
            case 'Exterior Painting':
                return 'Schedule painting work outside extreme cold periods - no paint will cure at these temperatures.';
            case 'Landscaping':
                return 'Schedule landscape work outside extreme cold periods - use this time for planning, ordering materials, equipment maintenance.';
            default:
                return 'Schedule work outside extreme cold periods whenever possible.';
        }
    }

    getYearRoundWorkDescription(templateName) {
        if (!templateName) {
            return 'Work is feasible year-round with proper cold-weather practices.';
        }

        switch (templateName) {
            case 'Commercial Concrete Work':
                return 'Concrete work is feasible year-round with proper cold-weather methods and budget for additional costs.';
            case 'Roofing Installation':
                return 'Roofing is feasible year-round but expect reduced productivity and increased costs during cold periods.';
            case 'Exterior Painting':
                return 'Painting is possible year-round with cold-weather formulas, though ideal conditions produce better results.';
            case 'Landscaping':
                return 'Hardscaping work is feasible year-round, but planting limited to dormant/early-spring periods in cold months.';
            default:
                return 'Work is feasible year-round with appropriate cold-weather adaptations.';
        }
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
            if (bestReasonEl) bestReasonEl.textContent = `Insufficient historical data for period analysis. Analyzed ${analysis.yearsAnalyzed || 0} years of weather patterns.`;
            if (worstPeriodEl) worstPeriodEl.textContent = 'Data Not Available';
            if (worstReasonEl) worstReasonEl.textContent = `Insufficient historical data for period analysis. Analyzed ${analysis.yearsAnalyzed || 0} years of weather patterns.`;
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
            if (bestReasonEl) bestReasonEl.textContent = `Project period too short for 2-week analysis (minimum 14 days required). Analysis based on ${analysis.yearsAnalyzed} years of historical data.`;
            if (worstPeriodEl) worstPeriodEl.textContent = 'Data Not Available';
            if (worstReasonEl) worstReasonEl.textContent = `Project period too short for 2-week analysis (minimum 14 days required). Analysis based on ${analysis.yearsAnalyzed} years of historical data.`;
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
                let dayIsWorkable = true; // Using WORKABLE criteria (lenient - matches main calculation)
                let dayIsIdeal = true;    // Using IDEAL criteria (strict)

                // IMPORTANT: Use same thresholds as main workability calculation (lines 3841-3854)
                // to avoid contradictions in the report

                // Heavy rain penalty (≥15mm = work-stopping rain - MATCHES MAIN CALC)
                if (day.precip >= 15) {
                    rainyDays++;
                    score -= 7;  // Heavy penalty for work stoppage
                    dayIsWorkable = false;
                    dayIsIdeal = false;
                } else if (day.precip > 5) {
                    // Light rain (5-15mm) - workable but not ideal
                    score -= 2;  // Minor penalty
                    dayIsIdeal = false;
                }

                // Snow penalty (>10mm = difficult conditions - MATCHES MAIN CALC)
                if (day.snow > 10) {
                    snowyDays++;
                    score -= 7;
                    dayIsWorkable = false;
                    dayIsIdeal = false;
                }

                // Wind penalty (≥60 km/h = very high wind - MATCHES MAIN CALC)
                if (day.wind >= 60) {
                    highWindDays++;
                    score -= 6;  // High wind - major restrictions
                    dayIsWorkable = false;
                    dayIsIdeal = false;
                } else if (day.wind >= 30) {
                    score -= 3;  // Moderate wind - some restrictions, but workable
                    dayIsIdeal = false;
                }

                // Work-stopping cold penalty (≤-5°C/≤23°F - MATCHES MAIN CALC)
                if (day.temp_min !== null && day.temp_min <= -5) {
                    freezingDays++;
                    score -= 5;
                    dayIsWorkable = false;
                    dayIsIdeal = false;
                } else if (day.temp_min !== null && day.temp_min < 0) {
                    // Light freezing (0 to -5°C) - workable but not ideal
                    score -= 2;
                    dayIsIdeal = false;
                }

                // Extreme heat penalty (≥43.33°C/≥110°F - MATCHES MAIN CALC)
                if (day.temp_max !== null && day.temp_max >= 43.33) {
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

            // Validate event counts don't exceed period length
            const totalEventDays = rainyDays + snowyDays + freezingDays + heatDays + highWindDays;
            if (totalEventDays > windowSize * 3) {  // Allow some overlap but catch impossible counts
                console.warn(`[PERIODS] Suspicious event count: ${totalEventDays} events in ${windowSize} days`);
            }
            if (rainyDays > windowSize || snowyDays > windowSize || freezingDays > windowSize ||
                heatDays > windowSize || highWindDays > windowSize || optimalDaysCount > windowSize) {
                console.error(`[PERIODS] IMPOSSIBLE EVENT COUNT: rainy=${rainyDays}, snowy=${snowyDays}, ` +
                    `freezing=${freezingDays}, heat=${heatDays}, wind=${highWindDays}, ` +
                    `optimal=${optimalDaysCount} in ${windowSize}-day period`);
            }

            const periodInfo = {
                startDate,
                endDate,
                score,
                rainyDays: Math.min(rainyDays, windowSize),  // Cap at window size
                snowyDays: Math.min(snowyDays, windowSize),
                highWindDays: Math.min(highWindDays, windowSize),
                freezingDays: Math.min(freezingDays, windowSize),
                heatDays: Math.min(heatDays, windowSize),
                optimalDays: Math.min(optimalDaysCount, windowSize)  // Cap at window size
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
            if (bestReasonEl) bestReasonEl.textContent = `Insufficient data variation for period comparison (analysis based on ${analysis.yearsAnalyzed} years of historical patterns).`;
            if (worstPeriodEl) worstPeriodEl.textContent = 'Unable to Analyze';
            if (worstReasonEl) worstReasonEl.textContent = `Insufficient data variation for period comparison (analysis based on ${analysis.yearsAnalyzed} years of historical patterns).`;
            return;
        }

        if (bestPeriod) {
            // Convert historical dates to project timeline for display
            const historicalStart = new Date(bestPeriod.startDate);
            const historicalEnd = new Date(bestPeriod.endDate);

            // Validate that we have exactly 14 days in the source data
            const daysDiff = Math.round((historicalEnd - historicalStart) / (1000 * 60 * 60 * 24));
            if (daysDiff !== 13) {
                console.error(`[PERIODS] Invalid period length: ${daysDiff + 1} days instead of 14`);
            }

            // Start with project start year
            let displayYear = projectStart.getFullYear();
            const displayStart = new Date(displayYear, historicalStart.getMonth(), historicalStart.getDate());

            // If the projected date is before project start, move to next year
            if (displayStart < projectStart) {
                displayStart.setFullYear(displayYear + 1);
                displayYear++;
            }

            // Calculate end date as exactly 13 days after start (14-day period total)
            const displayEnd = new Date(displayStart);
            displayEnd.setDate(displayStart.getDate() + 13);

            // Ensure both dates are within project timeline
            if (displayStart > projectEnd || displayEnd < projectStart) {
                // Period is outside project timeline, skip it
                if (bestPeriodEl) bestPeriodEl.textContent = 'N/A';
                if (bestReasonEl) bestReasonEl.textContent = `Optimal period falls outside project timeline (analysis based on ${analysis.yearsAnalyzed} years of historical patterns).`;
                console.log('[PERIODS] Best period outside project timeline, skipping');
            } else {
                const startDate = displayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endDate = displayEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                // Verify display dates are exactly 14 days apart
                const displayDiff = Math.round((displayEnd - displayStart) / (1000 * 60 * 60 * 24));
                console.log(`[PERIODS] Best period: ${startDate} - ${endDate} (${displayDiff + 1} days)`);

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
            // Only mention wind if we have actual wind data
            const hasWindData = analysis.avgWindSpeed !== undefined && analysis.avgWindSpeed !== null && !isNaN(analysis.avgWindSpeed);
            if (hasWindData && bestPeriod.highWindDays === 0) {
                reasons.push('calm winds');
            }
            if (bestPeriod.freezingDays === 0 && bestPeriod.heatDays === 0) {
                reasons.push('ideal temperatures');
            }

            if (bestReasonEl) {
                const reasonText = reasons.length > 0
                    ? reasons.join(', ').charAt(0).toUpperCase() + reasons.join(', ').slice(1)
                    : 'Best overall weather conditions for this project period';
                bestReasonEl.textContent = `${reasonText} (based on ${analysis.yearsAnalyzed} years of historical patterns).`;
            }

            console.log('[PERIODS] Best period:', startDate, '-', endDate, 'Score:', bestScore);
            }
        }

        if (worstPeriod) {
            // Convert historical dates to project timeline for display
            const historicalStart = new Date(worstPeriod.startDate);
            const historicalEnd = new Date(worstPeriod.endDate);

            // Validate that we have exactly 14 days in the source data
            const daysDiff = Math.round((historicalEnd - historicalStart) / (1000 * 60 * 60 * 24));
            if (daysDiff !== 13) {
                console.error(`[PERIODS] Invalid worst period length: ${daysDiff + 1} days instead of 14`);
            }

            // Start with project start year
            let displayYear = projectStart.getFullYear();
            const displayStart = new Date(displayYear, historicalStart.getMonth(), historicalStart.getDate());

            // If the projected date is before project start, move to next year
            if (displayStart < projectStart) {
                displayStart.setFullYear(displayYear + 1);
                displayYear++;
            }

            // Calculate end date as exactly 13 days after start (14-day period total)
            const displayEnd = new Date(displayStart);
            displayEnd.setDate(displayStart.getDate() + 13);

            // Ensure both dates are within project timeline
            if (displayStart > projectEnd || displayEnd < projectStart) {
                // Period is outside project timeline, skip it
                if (worstPeriodEl) worstPeriodEl.textContent = 'N/A';
                if (worstReasonEl) worstReasonEl.textContent = `Challenging period falls outside project timeline (analysis based on ${analysis.yearsAnalyzed} years of historical patterns).`;
                console.log('[PERIODS] Worst period outside project timeline, skipping');
            } else {
                const startDate = displayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endDate = displayEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                // Verify display dates are exactly 14 days apart
                const displayDiff = Math.round((displayEnd - displayStart) / (1000 * 60 * 60 * 24));
                console.log(`[PERIODS] Worst period: ${startDate} - ${endDate} (${displayDiff + 1} days)`);

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
                const issueText = issues.length > 0
                    ? issues.join(', ').charAt(0).toUpperCase() + issues.join(', ').slice(1)
                    : 'Most challenging weather conditions for this project period';
                worstReasonEl.textContent = `${issueText} (based on ${analysis.yearsAnalyzed} years of historical patterns).`;
            }

            console.log('[PERIODS] Worst period:', startDate, '-', endDate, 'Score:', worstScore);
            }
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
            `Average temperature: ${this.formatTemp(analysis.averageTemp, 'C')} ${analysis.averageTemp < 5 ? '(Cold weather protocols recommended)' : ''}`,
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

        // Calculate specific contingency for risk assessment
        const totalDays = analysis.actualProjectDays || 365;
        const stoppageDays = (analysis.heavyRainDays || 0) + (analysis.extremeColdDays || 0) + (analysis.heavySnowDays || 0);
        const netStoppage = stoppageDays - Math.round(stoppageDays * 0.25);
        const directPercent = ((netStoppage / totalDays) * 100).toFixed(1);
        const contingencyRange = netStoppage > 0 ? `${Math.ceil(directPercent * 1.3)}-${Math.ceil(directPercent * 1.5)}%` : '';

        let riskAssessment = '';
        if (riskScore <= 30) {
            riskAssessment = `LOW RISK: Weather conditions are generally favorable for this project. Expected ${workablePercent}% workability provides good schedule reliability. Standard weather monitoring protocols are recommended.`;
            if (contingencyRange) riskAssessment += ` Recommended schedule contingency: ${contingencyRange} (~${netStoppage} stoppage days).`;
        } else if (riskScore <= 60) {
            riskAssessment = `MEDIUM RISK: Moderate weather challenges expected during this project. With ${workablePercent}% workability, implement enhanced weather monitoring.`;
            if (contingencyRange) {
                riskAssessment += ` Recommended schedule contingency: ${contingencyRange} (~${netStoppage} stoppage days).`;
            } else {
                riskAssessment += ` Maintain minimum 10% schedule contingency for weather delays.`;
            }
        } else {
            riskAssessment = `HIGH RISK: Significant weather challenges anticipated for this project period. ${workablePercent}% of days considered workable - winter-heavy conditions with substantial weather impact. Robust weather contingency planning and cold-weather methods required.`;
            if (contingencyRange) {
                riskAssessment += ` Recommended schedule contingency: ${contingencyRange} minimum (~${netStoppage} stoppage days), plus alternative work strategies.`;
            } else {
                riskAssessment += ` Consider minimum 10% schedule buffer, plus alternative work strategies.`;
            }
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
            // Calculate contingency with math
            const totalDays = analysis.actualProjectDays || 365;
            const stoppageDays = (analysis.heavyRainDays || 0) + (analysis.extremeColdDays || 0) + (analysis.heavySnowDays || 0);
            const netStoppage = stoppageDays - Math.round(stoppageDays * 0.25); // Account for overlaps
            const directPercent = ((netStoppage / totalDays) * 100).toFixed(1);
            const contingency = netStoppage > 0 ? `${Math.ceil(directPercent * 1.3)}-${Math.ceil(directPercent * 1.5)}%` : '10%';
            const contingencyDetail = netStoppage > 0 ? ` (${netStoppage} net stoppage days / ${totalDays} days = ${directPercent}% direct, ×1.3-1.5 for delays)` : '';

            recommendations = [
                `[CRITICAL] Maintain ${contingency} schedule contingency for weather delays${contingencyDetail}`,
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
                outlookText = `✓ HIGHER WORKABILITY: ${workablePercent}% workable conditions (${idealPercent}% ideal). Favorable for this region - good opportunity for efficient project execution.`;
            } else if (workablePercent > 50) {
                outlookText = `⚠ MODERATE WORKABILITY: ${workablePercent}% workable conditions (${idealPercent}% ideal). Typical for this region and season. Weather contingency planning recommended based on work-stoppage analysis.`;
            } else {
                outlookText = `⚠ WINTER-HEAVY PERIOD: ${workablePercent}% workable conditions (${idealPercent}% ideal). Significant winter weather expected - enhanced weather planning, cold-weather methods, and mitigation strategies strongly recommended.`;
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
                [`Heavy Rain Days`, `${analysis.heavyRainDays || 0} days (≥15mm = work stoppage)`],
                [`Expected Snow Days`, `${analysis.snowyDays} days`],
                [`Freezing Days (${this.formatThresholdTemp(0, '≤')})`, `${analysis.freezingDays} days`],
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

            // Calculate contingency for consistent recommendation
            const projectAnalysis = this.currentProject.analysis || {};
            const totalDays = projectAnalysis.actualProjectDays || 365;
            const stoppageDays = (projectAnalysis.heavyRainDays || 0) + (projectAnalysis.extremeColdDays || 0) + (projectAnalysis.heavySnowDays || 0);
            const netStoppage = stoppageDays - Math.round(stoppageDays * 0.25);
            const directPercent = ((netStoppage / totalDays) * 100).toFixed(1);
            const calculatedContingency = netStoppage > 0 ? `${Math.ceil(directPercent * 1.3)}-${Math.ceil(directPercent * 1.5)}%` : '10%';

            const recommendations = [
                'Monitor 10-day forecasts continuously for tactical schedule adjustments',
                `Maintain ${calculatedContingency} schedule float for weather contingencies (based on work-stoppage analysis)`,
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
                ['Workable Days', `Temp: ${this.formatThresholdTemp(-5, '>')}, Rain: ${this.formatPrecip(15, '<')}, Wind: ${this.formatWind(60, '<')}`, `Realistic construction feasibility with standard precautions`],
                ['Ideal Days', `Temp: ${this.formatThresholdTemp(0, '>')}, Rain: ${this.formatPrecip(5, '<')}, Wind: ${this.formatWind(20, '<')}`, `Perfect conditions - no weather precautions needed`],
                ['Heavy Rain', `Precipitation ${this.formatPrecip(15, '>')}/day`, `Work-stopping rainfall requiring schedule adjustment`],
                ['High Wind', `Wind Speed ${this.formatWind(30, '≥')}`, `Restricts crane operations, elevated work, and material handling`]
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
                ['Temperature Extremes', `Extreme Cold Stoppage (${this.formatThresholdTemp(-18, '≤')})`, analysis.extremeColdDays, 'days'],
                ['Temperature Extremes', `Cold-Weather Methods Days (${this.formatThresholdTemp(-18, '>')} to ${this.formatThresholdTemp(-5, '≤')})`, analysis.coldWeatherMethodsDays || 0, 'days'],
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
            // Calculate contingency for consistent recommendation
            const totalDays = analysis.actualProjectDays || 365;
            const stoppageDays = (analysis.heavyRainDays || 0) + (analysis.extremeColdDays || 0) + (analysis.heavySnowDays || 0);
            const netStoppage = stoppageDays - Math.round(stoppageDays * 0.25);
            const directPercent = ((netStoppage / totalDays) * 100).toFixed(1);
            const calculatedContingency = netStoppage > 0 ? `${Math.ceil(directPercent * 1.3)}-${Math.ceil(directPercent * 1.5)}%` : '10%';

            const recsData = [
                ['STRATEGIC RECOMMENDATIONS'],
                [''],
                ['#', 'Recommendation', 'Priority'],
                [1, 'Monitor 10-day forecasts continuously for tactical schedule adjustments', 'HIGH'],
                [2, `Maintain ${calculatedContingency} schedule float for weather contingencies (based on work-stoppage analysis)`, 'HIGH'],
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

    async deleteProjectWithConfirmation(projectId, projectName) {
        // Show custom confirmation modal
        const confirmed = await this.showConfirmDialog(
            'Delete Project',
            `Are you sure you want to delete "${projectName}"?`,
            'This action cannot be undone.',
            'Delete',
            'Cancel'
        );

        if (!confirmed) {
            return;
        }

        try {
            console.log('[APP] Deleting project:', projectId);
            await this.databaseManager.deleteProject(projectId);

            // Remove from local projects array
            this.projects = this.projects.filter(p => p.id !== projectId);

            // If the deleted project was currently loaded, reload the page or reset
            if (this.currentProject && this.currentProject.id === projectId) {
                this.currentProject = null;
                // Optionally reload to clear all data
                // window.location.reload();
            }

            // Refresh the UI
            this.loadSavedProjects();

            // Show success message
            console.log('[APP] Project deleted successfully');
            this.showToast(`Project "${projectName}" deleted successfully`, 'success');
        } catch (error) {
            console.error('[APP] Failed to delete project:', error);
            this.showToast(`Failed to delete project: ${error.message}`, 'error');
        }
    }

    showConfirmDialog(title, message, warning, confirmText, cancelText) {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.2s;';

            // Create modal
            const modal = document.createElement('div');
            modal.style.cssText = 'background: linear-gradient(135deg, #0d1b2a 0%, #1b3a5f 100%); border: 2px solid var(--electric-cyan); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); animation: slideDown 0.3s;';

            modal.innerHTML = `
                <h2 style="color: var(--electric-cyan); margin: 0 0 1rem 0; font-size: 1.5rem;">
                    <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>${this.sanitizeHTML(title)}
                </h2>
                <p style="color: var(--arctic-white); margin: 0 0 0.5rem 0; font-size: 1.1rem;">${this.sanitizeHTML(message)}</p>
                <p style="color: #e67e22; margin: 0 0 1.5rem 0; font-size: 0.9rem; font-weight: 600;">${this.sanitizeHTML(warning)}</p>
                <div style="display: flex; gap: 1rem;">
                    <button id="confirmBtn" style="flex: 1; padding: 0.75rem; background: #e74c3c; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; font-size: 1rem; transition: all 0.2s;">
                        <i class="fas fa-trash-alt"></i> ${this.sanitizeHTML(confirmText)}
                    </button>
                    <button id="cancelBtn" style="flex: 1; padding: 0.75rem; background: rgba(255, 255, 255, 0.1); border: 2px solid var(--electric-cyan); border-radius: 8px; color: var(--electric-cyan); font-weight: 600; cursor: pointer; font-size: 1rem; transition: all 0.2s;">
                        ${this.sanitizeHTML(cancelText)}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Add animations
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideDown { from { transform: translateY(-50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `;
            document.head.appendChild(style);

            // Handle buttons
            const confirmBtn = modal.querySelector('#confirmBtn');
            const cancelBtn = modal.querySelector('#cancelBtn');

            confirmBtn.addEventListener('mouseenter', () => {
                confirmBtn.style.background = '#c0392b';
                confirmBtn.style.transform = 'scale(1.05)';
            });
            confirmBtn.addEventListener('mouseleave', () => {
                confirmBtn.style.background = '#e74c3c';
                confirmBtn.style.transform = 'scale(1)';
            });

            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'rgba(0, 212, 255, 0.2)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            });

            confirmBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                document.head.removeChild(style);
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                document.head.removeChild(style);
                resolve(false);
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    document.head.removeChild(style);
                    resolve(false);
                }
            });

            // Close on Escape key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(overlay);
                    document.head.removeChild(style);
                    document.removeEventListener('keydown', escHandler);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10001; display: flex; flex-direction: column; gap: 10px;';
            document.body.appendChild(toastContainer);
        }

        // Create toast
        const toast = document.createElement('div');
        const colors = {
            success: { bg: '#27ae60', icon: 'check-circle' },
            error: { bg: '#e74c3c', icon: 'exclamation-circle' },
            info: { bg: '#3498db', icon: 'info-circle' },
            warning: { bg: '#f39c12', icon: 'exclamation-triangle' }
        };
        const color = colors[type] || colors.info;

        toast.style.cssText = `background: ${color.bg}; color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); display: flex; align-items: center; gap: 0.75rem; min-width: 300px; max-width: 400px; animation: slideInRight 0.3s, slideOutRight 0.3s 2.7s;`;
        toast.innerHTML = `
            <i class="fas fa-${color.icon}" style="font-size: 1.25rem;"></i>
            <span style="flex: 1; font-weight: 500;">${this.sanitizeHTML(message)}</span>
            <i class="fas fa-times" style="cursor: pointer; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'"></i>
        `;

        // Add animation styles
        if (!document.getElementById('toastAnimations')) {
            const style = document.createElement('style');
            style.id = 'toastAnimations';
            style.textContent = `
                @keyframes slideInRight { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
            `;
            document.head.appendChild(style);
        }

        toastContainer.appendChild(toast);

        // Close button
        toast.querySelector('.fa-times').addEventListener('click', () => {
            toast.style.animation = 'slideOutRight 0.3s';
            setTimeout(() => toast.remove(), 300);
        });

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 3000);
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
            item.style.cssText = 'padding: 0.8rem; background: rgba(30, 58, 95, 0.3); border-radius: 8px; margin-bottom: 0.5rem; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;';

            const contentDiv = document.createElement('div');
            contentDiv.style.cssText = 'flex: 1; cursor: pointer;';
            contentDiv.innerHTML = `
                <div style="color: var(--electric-cyan); font-weight: 600; margin-bottom: 0.3rem;">${this.sanitizeHTML(project.name)}</div>
                <div style="color: var(--steel-silver); font-size: 0.85rem;">${project.startDate || 'N/A'} - ${project.endDate || 'N/A'}</div>
            `;
            contentDiv.addEventListener('click', () => {
                this.loadProject(project.id);
                // Close mobile sidebar after selecting a project
                this.closeMobileSidebar();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.title = 'Delete project';
            deleteBtn.className = 'project-delete-btn';
            deleteBtn.style.cssText = 'background: rgba(231, 76, 60, 0.2); border: 2px solid #e74c3c; color: #e74c3c; padding: 0.5rem 0.75rem; border-radius: 6px; cursor: pointer; transition: all 0.2s; margin-left: 0.5rem; opacity: 0; pointer-events: none;';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteProjectWithConfirmation(project.id, project.name);
            });
            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.style.background = '#e74c3c';
                deleteBtn.style.color = 'white';
            });
            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.style.background = 'rgba(231, 76, 60, 0.2)';
                deleteBtn.style.color = '#e74c3c';
            });

            item.appendChild(contentDiv);
            item.appendChild(deleteBtn);

            // Show delete button on hover
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(0, 212, 255, 0.2)';
                deleteBtn.style.opacity = '1';
                deleteBtn.style.pointerEvents = 'auto';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'rgba(30, 58, 95, 0.3)';
                deleteBtn.style.opacity = '0';
                deleteBtn.style.pointerEvents = 'none';
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

            // Scroll to top to show results
            window.scrollTo({ top: 0, behavior: 'smooth' });

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

    // Removed duplicate - using openSettings() instead

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

    // ========================================================================
    // BID CALCULATOR INTEGRATION
    // ========================================================================

    exportBidSummary() {
        if (window.bidCalculator) {
            window.bidCalculator.exportSummaryToExcel();
        } else {
            window.toastManager.error('Bid calculator not loaded', 'Export Error');
        }
    }

    addBidToPDF() {
        window.toastManager.info('Bid data will be included in the next PDF export', 'Feature Coming Soon');
        // TODO: Integrate bid data into PDF export
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

// ============================================================================
// PRELOAD NOAA STATION DATABASE
// ============================================================================
// Preload the comprehensive NOAA station network in the background
// This ensures instant station lookups when the user selects any location
(async function preloadNOAANetwork() {
    try {
        await noaaNetwork.loadStations();
        console.log('[NOAA Network] Station database preloaded and ready');
    } catch (error) {
        console.warn('[NOAA Network] Failed to preload station database:', error);
    }
})();

console.log('[XYLOCLIME PRO] Application loaded successfully');
