/**
 * Sample Project Data for Demo and New User Experience
 * Provides realistic pre-configured projects users can load instantly
 */

class SampleDataManager {
    constructor() {
        this.samples = this.generateSampleProjects();
    }

    generateSampleProjects() {
        return {
            'commercial-concrete-miami': {
                id: 'sample-commercial-concrete-miami',
                name: 'Miami Office Complex - Concrete Foundation',
                location: {
                    lat: 25.7617,
                    lng: -80.1918
                },
                locationName: 'Miami, FL',
                startDate: '2024-02-01',
                endDate: '2024-05-31',
                createdAt: '2024-01-15T10:30:00Z',
                isPrediction: true,
                templateId: 'commercial-concrete',
                riskScore: 42,
                historicalData: this.generateMiamiConcreteData(),
                analysis: this.generateMiamiConcreteAnalysis()
            },
            'roofing-seattle': {
                id: 'sample-roofing-seattle',
                name: 'Seattle Commercial Roofing - Phase 2',
                location: {
                    lat: 47.6062,
                    lng: -122.3321
                },
                locationName: 'Seattle, WA',
                startDate: '2024-06-15',
                endDate: '2024-09-30',
                createdAt: '2024-05-20T14:15:00Z',
                isPrediction: true,
                templateId: 'roofing',
                riskScore: 28,
                historicalData: this.generateSeattleRoofingData(),
                analysis: this.generateSeattleRoofingAnalysis()
            },
            'highway-paving-phoenix': {
                id: 'sample-highway-paving-phoenix',
                name: 'Phoenix Highway 101 Resurfacing',
                location: {
                    lat: 33.4484,
                    lng: -112.0740
                },
                locationName: 'Phoenix, AZ',
                startDate: '2024-10-01',
                endDate: '2024-12-15',
                createdAt: '2024-09-10T09:00:00Z',
                isPrediction: true,
                templateId: 'asphalt-paving',
                riskScore: 18,
                historicalData: this.generatePhoenixPavingData(),
                analysis: this.generatePhoenixPavingAnalysis()
            },
            'excavation-chicago': {
                id: 'sample-excavation-chicago',
                name: 'Chicago Distribution Center - Site Preparation',
                location: {
                    lat: 41.8781,
                    lng: -87.6298
                },
                locationName: 'Chicago, IL',
                startDate: '2024-11-20',
                endDate: '2025-02-28',
                createdAt: '2024-10-15T11:00:00Z',
                isPrediction: true,
                templateId: 'excavation',
                riskScore: 68,
                historicalData: this.generateChicagoExcavationData(),
                analysis: this.generateChicagoExcavationAnalysis()
            }
        };
    }

    // ========================================================================
    // MIAMI CONCRETE PROJECT DATA
    // ========================================================================

    generateMiamiConcreteData() {
        // Simulated 120 days of weather data for Miami (Feb-May)
        const dates = this.generateDateRange('2024-02-01', '2024-05-31');

        return {
            latitude: 25.7617,
            longitude: -80.1918,
            daily: {
                time: dates,
                temperature_2m_max: this.generateTemperatureData(dates.length, 22, 32, 2),
                temperature_2m_min: this.generateTemperatureData(dates.length, 16, 24, 1.5),
                precipitation_sum: this.generatePrecipitationData(dates.length, 0.3, [30, 40, 50, 55]), // Higher in Apr-May
                snowfall_sum: new Array(dates.length).fill(0),
                windspeed_10m_max: this.generateWindData(dates.length, 15, 35, 5)
            }
        };
    }

    generateMiamiConcreteAnalysis() {
        return {
            totalDays: 120,
            workableDays: 87,
            nonWorkableDays: 33,
            workablePercentage: 72.5,
            averageTemp: 25.8,
            totalPrecipitation: 285.4,
            totalSnowfall: 0,
            avgWindSpeed: 22.3,
            extremeEvents: [
                { date: '2024-03-15', type: 'Heavy Rain', value: '45mm', severity: 'high' },
                { date: '2024-04-22', type: 'Heavy Rain', value: '52mm', severity: 'high' },
                { date: '2024-05-08', type: 'High Winds', value: '42 km/h', severity: 'medium' },
                { date: '2024-05-18', type: 'Heavy Rain', value: '38mm', severity: 'high' }
            ],
            dataQuality: {
                completeness: 100,
                hasGaps: false,
                warnings: []
            },
            monthlyBreakdown: [
                { month: 'February', workable: 23, nonWorkable: 5, total: 28 },
                { month: 'March', workable: 24, nonWorkable: 7, total: 31 },
                { month: 'April', workable: 21, nonWorkable: 9, total: 30 },
                { month: 'May', workable: 19, nonWorkable: 12, total: 31 }
            ]
        };
    }

    // ========================================================================
    // SEATTLE ROOFING PROJECT DATA
    // ========================================================================

    generateSeattleRoofingData() {
        const dates = this.generateDateRange('2024-06-15', '2024-09-30');

        return {
            latitude: 47.6062,
            longitude: -122.3321,
            daily: {
                time: dates,
                temperature_2m_max: this.generateTemperatureData(dates.length, 18, 28, 2),
                temperature_2m_min: this.generateTemperatureData(dates.length, 10, 16, 1.5),
                precipitation_sum: this.generatePrecipitationData(dates.length, 0.15, [15, 10, 12, 18]), // Dryer summer
                snowfall_sum: new Array(dates.length).fill(0),
                windspeed_10m_max: this.generateWindData(dates.length, 12, 28, 4)
            }
        };
    }

    generateSeattleRoofingAnalysis() {
        return {
            totalDays: 108,
            workableDays: 92,
            nonWorkableDays: 16,
            workablePercentage: 85.2,
            averageTemp: 20.4,
            totalPrecipitation: 142.8,
            totalSnowfall: 0,
            avgWindSpeed: 18.6,
            extremeEvents: [
                { date: '2024-07-08', type: 'Heavy Rain', value: '18mm', severity: 'medium' },
                { date: '2024-09-12', type: 'High Winds', value: '35 km/h', severity: 'medium' },
                { date: '2024-09-24', type: 'Heavy Rain', value: '22mm', severity: 'medium' }
            ],
            dataQuality: {
                completeness: 100,
                hasGaps: false,
                warnings: []
            },
            monthlyBreakdown: [
                { month: 'June', workable: 14, nonWorkable: 2, total: 16 },
                { month: 'July', workable: 28, nonWorkable: 3, total: 31 },
                { month: 'August', workable: 29, nonWorkable: 2, total: 31 },
                { month: 'September', workable: 21, nonWorkable: 9, total: 30 }
            ]
        };
    }

    // ========================================================================
    // PHOENIX PAVING PROJECT DATA
    // ========================================================================

    generatePhoenixPavingData() {
        const dates = this.generateDateRange('2024-10-01', '2024-12-15');

        return {
            latitude: 33.4484,
            longitude: -112.0740,
            daily: {
                time: dates,
                temperature_2m_max: this.generateTemperatureData(dates.length, 24, 32, 1.5),
                temperature_2m_min: this.generateTemperatureData(dates.length, 12, 18, 1),
                precipitation_sum: this.generatePrecipitationData(dates.length, 0.05, [3, 5, 8, 6]), // Very low rainfall
                snowfall_sum: new Array(dates.length).fill(0),
                windspeed_10m_max: this.generateWindData(dates.length, 10, 22, 3)
            }
        };
    }

    generatePhoenixPavingAnalysis() {
        return {
            totalDays: 76,
            workableDays: 72,
            nonWorkableDays: 4,
            workablePercentage: 94.7,
            averageTemp: 26.3,
            totalPrecipitation: 24.6,
            totalSnowfall: 0,
            avgWindSpeed: 14.8,
            extremeEvents: [
                { date: '2024-11-18', type: 'Light Rain', value: '8mm', severity: 'low' }
            ],
            dataQuality: {
                completeness: 100,
                hasGaps: false,
                warnings: []
            },
            monthlyBreakdown: [
                { month: 'October', workable: 30, nonWorkable: 1, total: 31 },
                { month: 'November', workable: 28, nonWorkable: 2, total: 30 },
                { month: 'December', workable: 14, nonWorkable: 1, total: 15 }
            ]
        };
    }

    // ========================================================================
    // CHICAGO EXCAVATION PROJECT DATA
    // ========================================================================

    generateChicagoExcavationData() {
        // Simulated 100 days of weather data for Chicago (Nov-Feb winter)
        const dates = this.generateDateRange('2024-11-20', '2025-02-28');

        return {
            latitude: 41.8781,
            longitude: -87.6298,
            daily: {
                time: dates,
                temperature_2m_max: this.generateTemperatureData(dates.length, -8, 8, 5), // Cold winter temps
                temperature_2m_min: this.generateTemperatureData(dates.length, -15, 2, 4),
                precipitation_sum: this.generatePrecipitationData(dates.length, 0.25, [8, 12, 10, 8]), // Nov, Dec, Jan, Feb
                snowfall_sum: this.generateSnowfallData(dates.length, 0.15, [15, 25, 30, 20]), // Heavy snow in Dec-Jan
                windspeed_10m_max: this.generateWindData(dates.length, 20, 50, 10) // Windy city!
            }
        };
    }

    generateChicagoExcavationAnalysis() {
        return {
            totalDays: 100,
            actualProjectDays: 100,
            workableDays: 58,
            nonWorkableDays: 42,
            workablePercentage: 58.3,
            avgTempMax: -0.5,
            avgTempMin: -7.2,
            totalPrecip: 95.6,
            totalSnowfall: 48.3,
            avgWindSpeed: 32.8,
            maxWindSpeed: 52.1,
            extremeEvents: [
                { year: 2020, type: 'Heavy Snow', value: '35mm snowfall', severity: 'High' },
                { year: 2021, type: 'Extreme Cold', value: '-18°C minimum', severity: 'High' },
                { year: 2023, type: 'High Wind', value: '55 km/h sustained', severity: 'Moderate' }
            ],
            rainyDays: 22,
            heavyRainDays: 8,
            snowyDays: 18,
            heavySnowDays: 6,
            allFreezingDays: 78,
            lightFreezingDays: 45,
            extremeColdDays: 33, // ≤-5°C - work stopping cold
            extremeHeatDays: 0,
            highWindDays: 38, // ≥30 km/h
            idealDays: 12,
            optimalDays: 12,
            freezingDays: 78,
            yearsAnalyzed: 5,
            dataQuality: 0.99,
            dataQualityWarnings: [],
            rainyDaysMin: 18,
            rainyDaysMax: 26,
            rainyDaysConfidence: 4,
            precipMin: 82.3,
            precipMax: 108.9,
            monthlyBreakdown: [
                { month: 'November', monthIndex: 10, avgDaysInMonth: 10, heavyRainDays: 1, workStoppingColdDays: 2, heavySnowDays: 0, workableDays: 7, idealDays: 3, workablePercent: 70, riskScore: 30 },
                { month: 'December', monthIndex: 11, avgDaysInMonth: 31, heavyRainDays: 2, workStoppingColdDays: 10, heavySnowDays: 2, workableDays: 17, idealDays: 3, workablePercent: 55, riskScore: 45 },
                { month: 'January', monthIndex: 0, avgDaysInMonth: 31, heavyRainDays: 3, workStoppingColdDays: 14, heavySnowDays: 3, workableDays: 15, idealDays: 4, workablePercent: 48, riskScore: 65 },
                { month: 'February', monthIndex: 1, avgDaysInMonth: 28, heavyRainDays: 2, workStoppingColdDays: 7, heavySnowDays: 1, workableDays: 19, idealDays: 2, workablePercent: 68, riskScore: 36 }
            ]
        };
    }

    // ========================================================================
    // DATA GENERATION UTILITIES
    // ========================================================================

    generateSnowfallData(count, baseChance, monthlyIntensity) {
        const snowfall = [];
        const daysPerMonth = Math.ceil(count / monthlyIntensity.length);

        for (let i = 0; i < count; i++) {
            const monthIndex = Math.floor(i / daysPerMonth);
            const intensity = monthlyIntensity[monthIndex] || 5;

            // Random chance of snow with realistic clustering
            if (Math.random() < baseChance) {
                // Some days have heavy snow
                const amount = Math.random() < 0.15
                    ? intensity * (1.2 + Math.random() * 1.5) // Heavy snow
                    : Math.random() * intensity; // Normal snow
                snowfall.push(parseFloat(amount.toFixed(1)));
            } else {
                snowfall.push(0);
            }
        }

        return snowfall;
    }

    generateDateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }

    generateTemperatureData(count, minTemp, maxTemp, variance) {
        const temps = [];
        for (let i = 0; i < count; i++) {
            // Create realistic temperature variations with seasonal trends
            const seasonalTrend = Math.sin((i / count) * Math.PI) * 3;
            const randomVariance = (Math.random() - 0.5) * variance * 2;
            const baseTemp = minTemp + (maxTemp - minTemp) * 0.5;
            const temp = baseTemp + seasonalTrend + randomVariance;
            temps.push(Math.max(minTemp, Math.min(maxTemp, temp)));
        }
        return temps;
    }

    generatePrecipitationData(count, baseChance, monthlyIntensity) {
        const precipitation = [];
        const daysPerMonth = Math.ceil(count / monthlyIntensity.length);

        for (let i = 0; i < count; i++) {
            const monthIndex = Math.floor(i / daysPerMonth);
            const intensity = monthlyIntensity[monthIndex] || 10;

            // Random chance of rain with realistic clustering
            if (Math.random() < baseChance) {
                // Some days have heavy rain
                const amount = Math.random() < 0.1
                    ? intensity * (1.5 + Math.random() * 2) // Heavy rain
                    : Math.random() * intensity; // Normal rain
                precipitation.push(parseFloat(amount.toFixed(1)));
            } else {
                precipitation.push(0);
            }
        }

        return precipitation;
    }

    generateWindData(count, minWind, maxWind, variance) {
        const winds = [];
        for (let i = 0; i < count; i++) {
            const baseWind = minWind + (maxWind - minWind) * 0.4;
            const randomVariance = Math.random() * variance;
            const wind = baseWind + randomVariance;
            winds.push(Math.max(minWind, Math.min(maxWind, wind)));
        }
        return winds;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    getAllSamples() {
        return Object.values(this.samples).map(sample => ({
            id: sample.id,
            name: sample.name,
            locationName: sample.locationName,
            startDate: sample.startDate,
            endDate: sample.endDate,
            riskScore: sample.riskScore,
            workablePercentage: sample.analysis.workablePercentage,
            templateId: sample.templateId
        }));
    }

    getSample(id) {
        // Find by full ID or short ID
        const sample = this.samples[id] || Object.values(this.samples).find(s => s.id === id);
        return sample ? JSON.parse(JSON.stringify(sample)) : null; // Deep clone
    }

    loadSampleIntoApp(sampleId, app) {
        const sample = this.getSample(sampleId);
        if (!sample) {
            console.error(`Sample project not found: ${sampleId}`);
            return false;
        }

        // Load the sample project into the app
        app.currentProject = sample;
        app.weatherData = sample.historicalData;
        app.selectedLocation = sample.location;

        // Update UI
        document.getElementById('projectName').value = sample.name;
        document.getElementById('locationSearch').value = sample.locationName;
        document.getElementById('startDate').value = sample.startDate;
        document.getElementById('endDate').value = sample.endDate;

        // Update map marker
        if (app.marker) {
            app.marker.setLatLng([sample.location.lat, sample.location.lng]);
        } else if (app.map) {
            app.marker = L.marker([sample.location.lat, sample.location.lng]).addTo(app.map);
        }

        // Center map on location
        if (app.map) {
            app.map.setView([sample.location.lat, sample.location.lng], 10);
        }

        // Display dashboard with sample data
        app.updateRiskDisplay(sample.riskScore);
        app.displayDataQualityInfo(sample.analysis);
        app.updateDashboard(sample.analysis);

        // Display smart recommendations if available
        if (app.displaySmartRecommendations) {
            app.displaySmartRecommendations(sample.analysis, sample);
        }

        // Switch to dashboard view
        document.getElementById('setupPanel').classList.add('hidden');
        document.getElementById('dashboardPanel').classList.remove('hidden');

        // Show success toast
        if (window.toastManager) {
            window.toastManager.success(
                `Sample project "${sample.name}" loaded successfully. Explore the analysis!`,
                'Demo Project Loaded',
                5000
            );
        }

        // Scroll to top to show results
        window.scrollTo({ top: 0, behavior: 'smooth' });

        console.log('[SAMPLE] Sample project loaded:', sample.name);

        return true;
    }
}

// Initialize sample data manager globally
window.sampleDataManager = new SampleDataManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SampleDataManager;
}
