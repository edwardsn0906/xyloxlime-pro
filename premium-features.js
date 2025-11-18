/**
 * XYLOCLIME PRO - PREMIUM FEATURES
 * High-value features that make the subscription worth it
 */

// ============================================================================
// PROJECT TEMPLATES LIBRARY
// Pre-configured templates for different construction types
// ============================================================================

class ProjectTemplatesLibrary {
    constructor() {
        this.templates = this.getTemplates();
    }

    getTemplates() {
        return {
            'commercial-concrete': {
                name: 'Commercial Concrete Work',
                icon: 'fa-building',
                description: 'Foundation, slabs, and structural concrete for commercial buildings',
                weatherCriteria: {
                    maxRain: 5,           // mm per day
                    maxWind: 40,          // km/h
                    minTemp: 4,           // °C (40°F) - concrete curing minimum
                    maxTemp: 35,          // °C (95°F) - too hot for curing
                    maxSnow: 0,           // No snow allowed
                    consecutiveDays: 3    // Need 3-day good weather windows
                },
                riskFactors: {
                    rain: 'HIGH',
                    temperature: 'HIGH',
                    wind: 'MEDIUM',
                    seasonal: 'HIGH'
                },
                tips: [
                    'Concrete needs temps above 40°F (4°C) to cure properly',
                    'Avoid pouring during rain or within 24hrs of predicted rain',
                    'Plan for curing blankets in cold weather',
                    'Schedule pours during stable weather windows'
                ],
                seasonalAdvice: {
                    winter: 'Use heated enclosures and curing blankets. Consider winter admixtures.',
                    spring: 'Watch for sudden temperature drops and rain. Best season for concrete.',
                    summer: 'Pour early morning to avoid extreme heat. Use retarders if needed.',
                    fall: 'Good conditions but watch for early freezes. Plan completion before winter.'
                }
            },
            'roofing': {
                name: 'Roofing Installation',
                icon: 'fa-home',
                description: 'Residential and commercial roofing projects',
                weatherCriteria: {
                    maxRain: 0,           // No rain allowed
                    maxWind: 30,          // km/h - safety limit for heights
                    minTemp: -5,          // °C - shingles get brittle below this
                    maxTemp: 40,          // °C - too hot for asphalt work
                    maxSnow: 0,           // No snow/ice
                    consecutiveDays: 2    // Need 2-day windows minimum
                },
                riskFactors: {
                    rain: 'CRITICAL',
                    temperature: 'MEDIUM',
                    wind: 'CRITICAL',
                    seasonal: 'MEDIUM'
                },
                tips: [
                    'No work during rain or high winds (safety critical)',
                    'Asphalt shingles require temps above 40°F (4°C)',
                    'Wind speeds above 20mph create safety hazards',
                    'Check 24-hour forecast before starting each section',
                    'Have tarps ready for unexpected weather'
                ],
                seasonalAdvice: {
                    winter: 'Challenging but possible. Use proper adhesives. Very limited workable days.',
                    spring: 'Good season but watch for storms. Be ready to tarp quickly.',
                    summer: 'Best season for roofing. Work early morning to avoid extreme heat.',
                    fall: 'Excellent season. Complete before winter. Watch for early cold snaps.'
                }
            },
            'excavation': {
                name: 'Excavation & Earthwork',
                icon: 'fa-truck-monster',
                description: 'Site preparation, grading, trenching, and excavation',
                weatherCriteria: {
                    maxRain: 10,          // Can work in light rain
                    maxWind: 50,          // Higher tolerance
                    minTemp: -10,         // Can work in cold
                    maxTemp: 45,          // Equipment can handle heat
                    maxSnow: 5,           // cm - light snow OK
                    consecutiveDays: 1    // Day-by-day work possible
                },
                riskFactors: {
                    rain: 'MEDIUM',
                    temperature: 'LOW',
                    wind: 'LOW',
                    seasonal: 'MEDIUM'
                },
                tips: [
                    'Heavy rain creates muddy, unsafe conditions',
                    'Soil conditions vary greatly with moisture',
                    'Equipment can get stuck in saturated soil',
                    'Plan drainage and dewatering ahead of rain',
                    'Frost depth affects winter excavation'
                ],
                seasonalAdvice: {
                    winter: 'Frost can make excavation difficult. Budget extra time and equipment.',
                    spring: 'Watch for saturated ground. May need dewatering equipment.',
                    summer: 'Excellent conditions. Dry soil is easier to work.',
                    fall: 'Good conditions before ground freezes. Complete drainage work.'
                }
            },
            'exterior-painting': {
                name: 'Exterior Painting',
                icon: 'fa-paint-roller',
                description: 'Exterior painting and coating applications',
                weatherCriteria: {
                    maxRain: 0,           // No rain before/during/after
                    maxWind: 25,          // Spray painting limit
                    minTemp: 10,          // °C (50°F) - paint won't cure below
                    maxTemp: 32,          // °C (90°F) - too hot for proper drying
                    maxSnow: 0,
                    consecutiveDays: 3    // Need dry weather before, during, after
                },
                riskFactors: {
                    rain: 'CRITICAL',
                    temperature: 'HIGH',
                    wind: 'HIGH',
                    seasonal: 'CRITICAL'
                },
                tips: [
                    'Need 48 hours of dry weather after painting',
                    'Morning dew can delay start time',
                    'Ideal temps: 50-85°F (10-29°C)',
                    'High winds affect spray application quality',
                    'Humidity above 85% slows drying significantly'
                ],
                seasonalAdvice: {
                    winter: 'Not recommended. Paint won\'t cure properly in cold.',
                    spring: 'Watch for morning dew and afternoon storms.',
                    summer: 'Best season but avoid extreme heat. Work morning/evening.',
                    fall: 'Excellent season. Stable temps and low humidity.'
                }
            },
            'landscaping': {
                name: 'Landscaping & Grounds',
                icon: 'fa-seedling',
                description: 'Planting, irrigation, hardscaping, and grounds work',
                weatherCriteria: {
                    maxRain: 15,          // Can work around light rain
                    maxWind: 40,
                    minTemp: 0,           // °C - can work in cold
                    maxTemp: 38,          // °C - heat safety limit
                    maxSnow: 2,           // cm
                    consecutiveDays: 1
                },
                riskFactors: {
                    rain: 'LOW',
                    temperature: 'MEDIUM',
                    wind: 'LOW',
                    seasonal: 'HIGH'
                },
                tips: [
                    'Planting season critical for success',
                    'Avoid working soil when too wet (compaction)',
                    'Sod installation needs immediate watering',
                    'Trees/shrubs best planted spring or fall',
                    'Hardscaping can proceed in varied weather'
                ],
                seasonalAdvice: {
                    winter: 'Limited planting. Focus on hardscaping and planning.',
                    spring: 'Prime planting season. High demand period.',
                    summer: 'Planting challenging - needs intensive watering.',
                    fall: 'Excellent planting season. Plants establish before winter.'
                }
            },
            'hvac-outdoor': {
                name: 'HVAC Outdoor Installation',
                icon: 'fa-wind',
                description: 'Outdoor HVAC unit installation and ductwork',
                weatherCriteria: {
                    maxRain: 3,
                    maxWind: 35,
                    minTemp: -5,
                    maxTemp: 38,
                    maxSnow: 5,
                    consecutiveDays: 1
                },
                riskFactors: {
                    rain: 'MEDIUM',
                    temperature: 'LOW',
                    wind: 'MEDIUM',
                    seasonal: 'LOW'
                },
                tips: [
                    'Protect equipment from moisture during install',
                    'Electrical work requires dry conditions',
                    'Refrigerant lines affected by extreme temps',
                    'Plan for equipment staging and protection'
                ],
                seasonalAdvice: {
                    winter: 'Possible but challenging. Heating installs in demand.',
                    spring: 'Good season. Beat the summer cooling rush.',
                    summer: 'Peak season for cooling installs. High demand.',
                    fall: 'Good season before winter heating demands.'
                }
            },
            'asphalt-paving': {
                name: 'Asphalt Paving',
                icon: 'fa-road',
                description: 'Parking lots, driveways, and roadway paving',
                weatherCriteria: {
                    maxRain: 0,
                    maxWind: 30,
                    minTemp: 10,          // °C (50°F) - asphalt won't compact below
                    maxTemp: 35,
                    maxSnow: 0,
                    consecutiveDays: 2
                },
                riskFactors: {
                    rain: 'CRITICAL',
                    temperature: 'CRITICAL',
                    wind: 'LOW',
                    seasonal: 'HIGH'
                },
                tips: [
                    'Asphalt requires warm, dry conditions',
                    'Ground must be dry before paving',
                    'Minimum air temp: 50°F (10°C)',
                    'Avoid paving before predicted rain',
                    'Early morning not ideal - ground may be damp'
                ],
                seasonalAdvice: {
                    winter: 'Not possible in most climates. Asphalt won\'t compact.',
                    spring: 'Season starts when temps stabilize above 50°F.',
                    summer: 'Prime paving season. Best asphalt conditions.',
                    fall: 'Good season but closing window. Complete before freeze.'
                }
            },
            'general-construction': {
                name: 'General Construction',
                icon: 'fa-hard-hat',
                description: 'Mixed commercial/residential construction projects',
                weatherCriteria: {
                    maxRain: 8,
                    maxWind: 40,
                    minTemp: 0,
                    maxTemp: 38,
                    maxSnow: 3,
                    consecutiveDays: 2
                },
                riskFactors: {
                    rain: 'MEDIUM',
                    temperature: 'MEDIUM',
                    wind: 'MEDIUM',
                    seasonal: 'MEDIUM'
                },
                tips: [
                    'Different phases have different weather requirements',
                    'Plan weather-sensitive tasks during stable periods',
                    'Have backup indoor tasks for bad weather',
                    'Protect materials and work areas from moisture',
                    'Schedule inspections during good weather windows'
                ],
                seasonalAdvice: {
                    winter: 'Focus on interior work. Exterior work weather-dependent.',
                    spring: 'Ramp up exterior work. Watch for storms.',
                    summer: 'Peak construction season. Manage heat safety.',
                    fall: 'Push to complete exterior before winter.'
                }
            }
        };
    }

    getTemplate(templateId) {
        return this.templates[templateId] || null;
    }

    getAllTemplates() {
        return Object.keys(this.templates).map(id => ({
            id,
            ...this.templates[id]
        }));
    }

    applyTemplate(templateId, projectName, startDate, endDate) {
        const template = this.getTemplate(templateId);
        if (!template) return null;

        return {
            name: projectName || template.name,
            templateId: templateId,
            templateName: template.name,
            startDate,
            endDate,
            weatherCriteria: { ...template.weatherCriteria },
            riskFactors: { ...template.riskFactors },
            tips: [...template.tips],
            seasonalAdvice: { ...template.seasonalAdvice }
        };
    }
}

// ============================================================================
// SMART RECOMMENDATIONS ENGINE
// AI-like recommendations based on weather data and risk analysis
// ============================================================================

class SmartRecommendations {
    constructor() {
        this.templates = new ProjectTemplatesLibrary();
    }

    generateRecommendations(analysis, project) {
        const recommendations = {
            critical: [],
            important: [],
            helpful: [],
            insights: []
        };

        // Analyze risk levels
        this.analyzeRainRisk(analysis, recommendations);
        this.analyzeTemperatureRisk(analysis, recommendations);
        this.analyzeWindRisk(analysis, recommendations);
        this.analyzeSeasonalRisk(analysis, project, recommendations);
        this.analyzeWorkableDays(analysis, project, recommendations);
        this.generateSchedulingInsights(analysis, project, recommendations);

        return recommendations;
    }

    analyzeRainRisk(analysis, recommendations) {
        const rainyDays = analysis.rainyDays || 0;
        const heavyRainDays = analysis.heavyRainDays || 0;
        const totalDays = analysis.totalDays || 90;

        if (heavyRainDays > totalDays * 0.1) {
            recommendations.critical.push({
                icon: 'fa-cloud-showers-heavy',
                title: 'High Heavy Rain Risk',
                message: `Expect ${heavyRainDays} days with heavy rain (>10mm). This will cause significant delays.`,
                action: 'Add 15-20% contingency time for rain delays',
                priority: 'high'
            });
        }

        if (rainyDays > totalDays * 0.3) {
            recommendations.important.push({
                icon: 'fa-umbrella',
                title: 'Frequent Rain Expected',
                message: `${rainyDays} rainy days expected (${Math.round(rainyDays/totalDays*100)}% of project duration)`,
                action: 'Plan for drainage, equipment protection, and alternate tasks',
                priority: 'medium'
            });
        }

        if (rainyDays > 0) {
            recommendations.helpful.push({
                icon: 'fa-tarp',
                title: 'Weather Protection',
                message: 'Invest in tarps, tent systems, and dehumidifiers for rainy periods',
                action: 'Budget $2,000-5,000 for weather protection equipment',
                priority: 'low'
            });
        }
    }

    analyzeTemperatureRisk(analysis, recommendations) {
        const freezingDays = analysis.freezingDays || 0;
        const extremeHeatDays = analysis.extremeHeatDays || 0;
        const avgLow = analysis.avgTempMin;

        if (freezingDays > 7) {
            recommendations.critical.push({
                icon: 'fa-snowflake',
                title: 'Significant Freezing Risk',
                message: `${freezingDays} days expected below freezing. This affects concrete, paint, and equipment.`,
                action: 'Plan for heated enclosures, winter additives, and extended cure times',
                priority: 'high'
            });
        }

        if (extremeHeatDays > 5) {
            recommendations.important.push({
                icon: 'fa-temperature-high',
                title: 'Extreme Heat Days',
                message: `${extremeHeatDays} days expected above 100°F (38°C). Worker safety critical.`,
                action: 'Implement heat safety protocol: water stations, shade, frequent breaks',
                priority: 'medium'
            });
        }

        if (avgLow < 5) {
            recommendations.helpful.push({
                icon: 'fa-thermometer-quarter',
                title: 'Cold Weather Strategy',
                message: 'Average lows near freezing. Morning start times may need adjustment.',
                action: 'Consider 8am-9am start times instead of 7am to let temps rise',
                priority: 'low'
            });
        }
    }

    analyzeWindRisk(analysis, recommendations) {
        const highWindDays = analysis.highWindDays || 0;
        const hasWindData = analysis.avgWindSpeed !== undefined && analysis.avgWindSpeed !== null;

        // Only show wind recommendations if we have actual wind data
        if (hasWindData && highWindDays > 3) {
            recommendations.important.push({
                icon: 'fa-wind',
                title: 'High Wind Days Expected',
                message: `${highWindDays} days with winds >30mph. Affects roofing, crane work, painting.`,
                action: 'Schedule wind-sensitive tasks during calm periods. Have backup plans.',
                priority: 'medium'
            });
        }
    }

    analyzeSeasonalRisk(analysis, project, recommendations) {
        const startDate = new Date(project.startDate);
        const endDate = new Date(project.endDate);
        const startMonth = startDate.getMonth(); // 0-11

        // Winter start warning (Nov-Feb in Northern Hemisphere)
        if (startMonth >= 10 || startMonth <= 1) {
            recommendations.important.push({
                icon: 'fa-calendar-alt',
                title: 'Winter Start Timing',
                message: 'Project starts during winter months. Workable days will be limited.',
                action: 'Consider pushing start date to March-April for better weather windows',
                priority: 'medium'
            });
        }

        // Spring start (best time)
        if (startMonth >= 2 && startMonth <= 4) {
            recommendations.insights.push({
                icon: 'fa-check-circle',
                title: 'Optimal Start Timing',
                message: 'Spring start provides best weather conditions for most construction.',
                action: 'Good timing! Take advantage of the stable weather window.',
                priority: 'positive'
            });
        }

        // Check if project spans multiple seasons
        const monthsDuration = (endDate - startDate) / (1000 * 60 * 60 * 24 * 30);
        if (monthsDuration > 6) {
            recommendations.helpful.push({
                icon: 'fa-calendar-check',
                title: 'Multi-Season Project',
                message: 'Project spans multiple seasons. Plan phase transitions carefully.',
                action: 'Schedule weather-sensitive phases during favorable seasons',
                priority: 'low'
            });
        }
    }

    analyzeWorkableDays(analysis, project, recommendations) {
        const totalDays = Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24));
        const workableDays = analysis.workableDays || analysis.optimalDays || totalDays * 0.7;
        const workablePercent = (workableDays / totalDays) * 100;

        if (workablePercent < 60) {
            recommendations.critical.push({
                icon: 'fa-exclamation-triangle',
                title: 'Low Workable Days',
                message: `Only ${Math.round(workablePercent)}% of days expected to be workable (${Math.round(workableDays)} of ${totalDays} days)`,
                action: 'Add 40-50% contingency time to schedule or shift project timeline',
                priority: 'high'
            });
        } else if (workablePercent < 75) {
            recommendations.important.push({
                icon: 'fa-calendar-times',
                title: 'Moderate Workable Days',
                message: `${Math.round(workablePercent)}% of days expected to be workable (${Math.round(workableDays)} of ${totalDays} days)`,
                action: 'Add 20-30% contingency time to account for weather delays',
                priority: 'medium'
            });
        } else {
            recommendations.insights.push({
                icon: 'fa-thumbs-up',
                title: 'Good Weather Window',
                message: `${Math.round(workablePercent)}% of days expected to be workable - favorable conditions!`,
                action: 'Standard 10-15% contingency should be sufficient',
                priority: 'positive'
            });
        }
    }

    generateSchedulingInsights(analysis, project, recommendations) {
        const startDate = new Date(project.startDate);
        const endDate = new Date(project.endDate);

        // Generate month-by-month breakdown
        const monthlyRisk = this.calculateMonthlyRisk(analysis, startDate, endDate);

        if (monthlyRisk.bestMonth) {
            recommendations.insights.push({
                icon: 'fa-calendar-day',
                title: 'Best Weather Month',
                message: `${monthlyRisk.bestMonth.name} shows the best weather conditions`,
                action: `Schedule critical/weather-sensitive phases during ${monthlyRisk.bestMonth.name}`,
                priority: 'positive'
            });
        }

        if (monthlyRisk.worstMonth) {
            recommendations.insights.push({
                icon: 'fa-calendar-times',
                title: 'Challenging Weather Month',
                message: `${monthlyRisk.worstMonth.name} shows the most challenging conditions`,
                action: `Plan indoor/covered work during ${monthlyRisk.worstMonth.name}`,
                priority: 'negative'
            });
        }
    }

    calculateMonthlyRisk(analysis, startDate, endDate) {
        // Use actual monthly breakdown from analysis if available
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        let bestMonth = null;
        let worstMonth = null;
        let bestWorkablePercent = -1;
        let worstWorkablePercent = 101;

        // If we have monthly breakdown data, use it
        if (analysis.monthlyBreakdown && Array.isArray(analysis.monthlyBreakdown)) {
            analysis.monthlyBreakdown.forEach(monthData => {
                const workablePercent = (monthData.workable / monthData.total) * 100;

                if (workablePercent > bestWorkablePercent) {
                    bestWorkablePercent = workablePercent;
                    bestMonth = { name: monthData.month, workablePercent };
                }
                if (workablePercent < worstWorkablePercent) {
                    worstWorkablePercent = workablePercent;
                    worstMonth = { name: monthData.month, workablePercent };
                }
            });

            // Don't show if they're the same month OR if there's only one month
            if (bestMonth && worstMonth && bestMonth.name === worstMonth.name) {
                // If only one month, don't show best/worst
                return { bestMonth: null, worstMonth: null };
            }

            // Don't show if difference is negligible (<10%)
            if (Math.abs(bestWorkablePercent - worstWorkablePercent) < 10) {
                return { bestMonth: null, worstMonth: null };
            }
        }

        return { bestMonth, worstMonth };
    }
}

// Make available globally
window.ProjectTemplatesLibrary = ProjectTemplatesLibrary;
window.SmartRecommendations = SmartRecommendations;

console.log('[PREMIUM] Premium features loaded successfully');
