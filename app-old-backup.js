/**
 * METEORYX PRO - Professional Weather Intelligence Platform
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
        this.STORAGE_KEY = 'meteoryx_terms_acceptance';
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
// SESSION MANAGER (for future scalability)
// ============================================================================

class SessionManager {
    constructor() {
        this.SESSION_KEY = 'meteoryx_session';
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

class MeteoryxPro {
    constructor() {
        // Managers
        this.termsManager = new TermsManager();
        this.sessionManager = new SessionManager();

        // Application state
        this.map = null;
        this.selectedLocation = null;
        this.currentProject = null;
        this.weatherData = null;
        this.apiKey = localStorage.getItem('meteoryx_apiKey') || '';
        this.charts = {};
        this.lastSearchTime = 0;

        // Load projects
        try {
            this.projects = JSON.parse(localStorage.getItem('meteoryx_projects') || '[]');
            if (!Array.isArray(this.projects)) {
                console.warn('Invalid projects data, resetting');
                this.projects = [];
                localStorage.removeItem('meteoryx_projects');
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.projects = [];
            localStorage.removeItem('meteoryx_projects');
        }

        this.init();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    init() {
        console.log('[METEORYX] Initializing application...');
        this.sessionManager.logAction('app_init', { version: '1.0.0' });

        // Check terms acceptance
        if (!this.termsManager.hasAcceptedTerms()) {
            this.showTermsScreen();
        } else {
            this.showMainApp();
        }

        // Initialize main app components
        this.initializeMap();
        this.bindEvents();
        this.loadSavedProjects();
        this.setDefaultDates();
        this.updateAcceptanceDate();
    }

    showTermsScreen() {
        document.getElementById('termsScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        this.bindTermsEvents();
    }

    showMainApp() {
        document.getElementById('termsScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
    }

    // ========================================================================
    // TERMS ACCEPTANCE HANDLING
    // ========================================================================

    bindTermsEvents() {
        // Track checkbox states
        const checkboxes = document.querySelectorAll('.ack-checkbox');
        const acceptBtn = document.getElementById('acceptTermsBtn');

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                acceptBtn.disabled = !allChecked;
            });
        });

        // Accept button
        acceptBtn.addEventListener('click', () => {
            if (this.termsManager.recordAcceptance()) {
                this.sessionManager.logAction('terms_accepted', {
                    version: this.termsManager.TERMS_VERSION
                });
                this.showMainApp();
                this.updateAcceptanceDate();
            } else {
                alert('Failed to record terms acceptance. Please try again.');
            }
        });

        // Decline button
        document.getElementById('declineTermsBtn').addEventListener('click', () => {
            this.sessionManager.logAction('terms_declined', {});
            alert('You must accept the Terms of Service to use Meteoryx Pro.');
        });

        // View full terms
        document.getElementById('viewFullTerms').addEventListener('click', (e) => {
            e.preventDefault();
            this.showFullTermsModal();
        });

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
            this.map = L.map('map').setView([39.8283, -98.5795], 4);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);

            this.map.on('click', (e) => {
                this.selectLocation(e.latlng.lat, e.latlng.lng);
            });

            this.selectedMarker = null;
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
        if (!query.trim()) return;

        const now = Date.now();
        if (now - this.lastSearchTime < 1000) {
            console.log('Rate limit: Please wait before searching again');
            return;
        }
        this.lastSearchTime = now;

        const sanitizedQuery = this.sanitizeHTML(query.trim().substring(0, 200));

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sanitizedQuery)}&limit=1`, {
                headers: {
                    'User-Agent': 'Meteoryx Pro Weather Analysis Platform'
                }
            });

            if (!response.ok) {
                throw new Error('Location search failed');
            }

            const data = await response.json();

            if (data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);

                this.map.setView([lat, lng], 10);
                this.selectLocation(lat, lng);
            } else {
                alert('Location not found. Please try a different search term.');
            }
        } catch (error) {
            console.error('Location search failed:', error);
            alert('Location search failed. Please try again.');
        }
    }

    // ========================================================================
    // EVENT BINDING
    // ========================================================================

    bindEvents() {
        // Location search
        const locationSearch = document.getElementById('locationSearch');
        locationSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchLocation(locationSearch.value);
            }
        });

        // Analyze button
        document.getElementById('analyzeBtn').addEventListener('click', () => {
            this.analyzeWeatherData();
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
    }

    // ========================================================================
    // WEATHER ANALYSIS
    // ========================================================================

    async analyzeWeatherData() {
        this.sessionManager.logAction('analysis_started', {});

        if (!this.selectedLocation) {
            alert('Please select a location on the map or search for an address.');
            return;
        }

        const projectName = document.getElementById('projectName').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        const nameValidation = this.validateProjectName(projectName);
        if (!nameValidation.valid) {
            alert(nameValidation.error);
            return;
        }

        if (!startDate || !endDate) {
            alert('Please select start and end dates.');
            return;
        }

        const dateValidation = this.validateDates(startDate, endDate);
        if (!dateValidation.valid) {
            alert(dateValidation.error);
            return;
        }

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
            this.updateDashboard(analysis);

            document.getElementById('setupPanel').classList.add('hidden');
            document.getElementById('dashboardPanel').classList.remove('hidden');
            document.getElementById('loadingSpinner').classList.add('hidden');

            this.sessionManager.logAction('analysis_completed', {
                projectId: this.currentProject.id
            });

        } catch (error) {
            console.error('Weather analysis failed:', error);
            alert(`Failed to analyze weather data. Error: ${error.message}`);
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
        // Aggregate historical data
        const allTempsMax = [];
        const allTempsMin = [];
        const allPrecipitation = [];
        const allSnowfall = [];
        const allWindspeed = [];

        historicalData.forEach(yearData => {
            const daily = yearData.data.daily;
            allTempsMax.push(...daily.temperature_2m_max);
            allTempsMin.push(...daily.temperature_2m_min);
            allPrecipitation.push(...daily.precipitation_sum);
            allSnowfall.push(...daily.snowfall_sum);
            allWindspeed.push(...daily.windspeed_10m_max);
        });

        // Calculate statistics
        const avgTempMax = this.average(allTempsMax);
        const avgTempMin = this.average(allTempsMin);
        const totalPrecip = this.sum(allPrecipitation);
        const totalSnowfall = this.sum(allSnowfall);

        // Count weather event days (averaged across years)
        const yearsCount = historicalData.length;
        const freezingDays = Math.round(allTempsMin.filter(t => t <= 0).length / yearsCount);
        const rainyDays = Math.round(allPrecipitation.filter(p => p > 1).length / yearsCount);
        const snowyDays = Math.round(allSnowfall.filter(s => s > 0).length / yearsCount);
        const extremeHeatDays = Math.round(allTempsMax.filter(t => t >= 37.7).length / yearsCount); // 100°F
        const extremeColdDays = Math.round(allTempsMin.filter(t => t <= -17.7).length / yearsCount); // 0°F

        // Calculate optimal days
        const optimalDays = Math.round(allTempsMax.filter((t, i) => {
            return t >= 15 && t <= 30 && allPrecipitation[i] < 1 && allWindspeed[i] < 30;
        }).length / yearsCount);

        return {
            avgTempMax: avgTempMax.toFixed(1),
            avgTempMin: avgTempMin.toFixed(1),
            totalPrecip: totalPrecip.toFixed(1),
            totalSnowfall: totalSnowfall.toFixed(1),
            freezingDays,
            rainyDays,
            snowyDays,
            extremeHeatDays,
            extremeColdDays,
            optimalDays,
            yearsAnalyzed: yearsCount
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

    // ========================================================================
    // UI UPDATES
    // ========================================================================

    updateDashboard(analysis) {
        document.getElementById('projectInfoName').textContent = this.currentProject.name;
        document.getElementById('projectInfoLocation').textContent = this.currentProject.locationName;
        document.getElementById('projectInfoDates').textContent =
            `${this.currentProject.startDate} to ${this.currentProject.endDate}`;

        document.getElementById('freezingDays').textContent = analysis.freezingDays;
        document.getElementById('rainyDays').textContent = analysis.rainyDays;
        document.getElementById('snowyDays').textContent = analysis.snowyDays;
        document.getElementById('optimalDays').textContent = analysis.optimalDays;
        document.getElementById('yearsAnalyzed').textContent = analysis.yearsAnalyzed;

        this.createDailyChart();
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

    // ========================================================================
    // PROJECT MANAGEMENT
    // ========================================================================

    saveProject(project) {
        const existingIndex = this.projects.findIndex(p => p.id === project.id);
        if (existingIndex >= 0) {
            this.projects[existingIndex] = project;
        } else {
            this.projects.unshift(project);
        }

        // Limit to 50 projects
        if (this.projects.length > 50) {
            this.projects = this.projects.slice(0, 50);
        }

        try {
            localStorage.setItem('meteoryx_projects', JSON.stringify(this.projects));
            this.loadSavedProjects();
            this.sessionManager.logAction('project_saved', { projectId: project.id });
        } catch (error) {
            console.error('Failed to save project:', error);
            alert('Warning: Project could not be saved to local storage.');
        }
    }

    loadSavedProjects() {
        const container = document.getElementById('savedProjectsList');
        if (!container) return;

        container.innerHTML = '';

        if (this.projects.length === 0) {
            container.innerHTML = '<p style="color: var(--steel-silver); font-size: 0.9rem; padding: 1rem;">No saved projects yet</p>';
            return;
        }

        this.projects.slice(0, 10).forEach(project => {
            const item = document.createElement('div');
            item.className = 'project-item';
            item.style.cssText = 'padding: 0.8rem; background: rgba(30, 58, 95, 0.3); border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem; transition: all 0.2s;';
            item.innerHTML = `
                <div style="color: var(--electric-cyan); font-weight: 600; margin-bottom: 0.3rem;">${this.sanitizeHTML(project.name)}</div>
                <div style="color: var(--steel-silver); font-size: 0.85rem;">${project.startDate} - ${project.endDate}</div>
            `;
            item.addEventListener('click', () => this.loadProject(project.id));
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(0, 212, 255, 0.2)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'rgba(30, 58, 95, 0.3)';
            });
            container.appendChild(item);
        });
    }

    loadProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        this.currentProject = project;
        this.weatherData = project.historicalData;
        this.updateDashboard(project.analysis);

        document.getElementById('setupPanel').classList.add('hidden');
        document.getElementById('dashboardPanel').classList.remove('hidden');

        this.sessionManager.logAction('project_loaded', { projectId });
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
}

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.meteoryxApp = new MeteoryxPro();
    });
} else {
    window.meteoryxApp = new MeteoryxPro();
}

console.log('[METEORYX PRO] Application loaded successfully');
