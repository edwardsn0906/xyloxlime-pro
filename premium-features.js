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
                // Custom risk weighting for this project type
                riskWeights: {
                    precipitation: 0.35,  // Higher weight - rain critically affects concrete
                    temperature: 0.35,    // Higher weight - temperature crucial for curing
                    wind: 0.15,           // Lower weight - wind less critical
                    workability: 0.15     // Lower weight - more flexible scheduling around conditions
                },
                // Template-specific workability thresholds
                workabilityThresholds: {
                    criticalMinTemp: 4,   // °C (40°F) - absolute minimum for pour
                    idealMinTemp: 10,     // °C (50°F) - ideal pour temp
                    maxTemp: 35,          // °C (95°F) - too hot
                    maxRain: 1,           // mm - any rain stops pour
                    maxWind: 40,          // km/h - high wind tolerance
                    maxSnow: 0            // cm - no snow allowed
                },
                // Key performance indicators specific to concrete work
                kpis: [
                    { metric: 'Pour Windows', description: 'Consecutive days with temp >40°F and no rain', unit: 'days' },
                    { metric: 'Curing Risk Days', description: 'Days where post-pour temps drop below freezing', unit: 'days' },
                    { metric: 'Heat Mitigation Days', description: 'Days requiring cooling measures (>90°F)', unit: 'days' }
                ],
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
                // Custom risk weighting - wind and rain are critical for roofing safety
                riskWeights: {
                    precipitation: 0.40,  // Critical - any rain stops work
                    temperature: 0.15,    // Medium - workable in wide temp range
                    wind: 0.35,           // Critical - safety hazard at heights
                    workability: 0.10     // Low - can adapt to short weather windows
                },
                workabilityThresholds: {
                    criticalMinTemp: -5,  // °C (23°F) - shingles become brittle
                    idealMinTemp: 4,      // °C (40°F) - ideal for adhesive seal
                    maxTemp: 40,          // °C (104°F) - too hot to handle materials
                    maxRain: 0,           // mm - zero tolerance for rain
                    maxWind: 30,          // km/h - safety limit for elevated work
                    maxSnow: 0            // cm - no snow/ice allowed
                },
                kpis: [
                    { metric: 'Safe Work Windows', description: 'Days with no rain, wind <30km/h, temp >23°F', unit: 'days' },
                    { metric: 'High Wind Days', description: 'Days with unsafe wind speeds for roofing', unit: 'days' },
                    { metric: 'Emergency Tarp Days', description: 'Days with sudden weather requiring tarping', unit: 'days' }
                ],
                tips: [
                    'No work during rain or high winds (important for safety)',
                    'Asphalt shingles work best with temps above 40°F (4°C)',
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
                riskWeights: {
                    precipitation: 0.50,  // Highest weight - saturated soil stops work
                    temperature: 0.15,    // Low - equipment works in wide temp range
                    wind: 0.10,           // Lowest - high wind tolerance
                    workability: 0.25     // Medium - soil conditions matter
                },
                workabilityThresholds: {
                    criticalMinTemp: -10, // °C (14°F) - frost depth issues
                    idealMinTemp: 5,      // °C (41°F) - ideal soil conditions
                    maxTemp: 45,          // °C (113°F) - equipment/operator heat limit
                    maxRain: 15,          // mm - heavy rain creates mud
                    maxWind: 50,          // km/h - high tolerance
                    maxSnow: 5            // cm - light snow workable
                },
                kpis: [
                    { metric: 'Dry Work Days', description: 'Days with <10mm rain for optimal soil conditions', unit: 'days' },
                    { metric: 'Saturated Soil Days', description: 'Days with soil too wet for equipment', unit: 'days' },
                    { metric: 'Frost Days', description: 'Days with frozen ground requiring special equipment', unit: 'days' }
                ],
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
                riskWeights: {
                    precipitation: 0.40,  // Critical - ruins uncured paint
                    temperature: 0.30,    // High - narrow temp range for curing
                    wind: 0.20,           // Medium - affects spray quality
                    workability: 0.10     // Low - short windows acceptable
                },
                workabilityThresholds: {
                    criticalMinTemp: 10,  // °C (50°F) - minimum cure temp
                    idealMinTemp: 15,     // °C (59°F) - ideal application temp
                    maxTemp: 32,          // °C (90°F) - too hot for quality
                    maxRain: 0,           // mm - zero tolerance
                    maxWind: 25,          // km/h - affects spray pattern
                    maxSnow: 0            // cm - no moisture allowed
                },
                kpis: [
                    { metric: 'Paint Windows', description: '3+ consecutive dry days with ideal temps (50-85°F)', unit: 'windows' },
                    { metric: 'Cure Risk Days', description: 'Days where rain within 48hrs ruins fresh paint', unit: 'days' },
                    { metric: 'Application Days', description: 'Days meeting temp + precipitation + wind requirements', unit: 'days' }
                ],
                tips: [
                    'Need 48 hours of dry weather after painting',
                    'Morning dew can delay start time (not calculated)',
                    'Ideal temps: 50-85°F (10-29°C)',
                    'High winds affect spray application quality',
                    'Note: Humidity data not currently included in analysis'
                ],
                seasonalAdvice: {
                    winter: 'Not recommended. Paint won\'t cure properly in cold.',
                    spring: 'Watch for morning dew and afternoon storms.',
                    summer: 'Best season but avoid extreme heat. Work morning/evening.',
                    fall: 'Excellent season. Stable temps and less rain.'
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
                riskWeights: {
                    precipitation: 0.25,  // Medium - some work rain-tolerant
                    temperature: 0.20,    // Medium - seasonal planting matters
                    wind: 0.10,           // Low - high wind tolerance
                    workability: 0.45     // High - seasonal timing critical for plant success
                },
                workabilityThresholds: {
                    criticalMinTemp: 0,   // °C (32°F) - ground must not be frozen
                    idealMinTemp: 10,     // °C (50°F) - ideal planting temp
                    maxTemp: 38,          // °C (100°F) - heat stress for plants/workers
                    maxRain: 15,          // mm - moderate rain workable
                    maxWind: 40,          // km/h - good tolerance
                    maxSnow: 2            // cm - light snow OK
                },
                kpis: [
                    { metric: 'Planting Windows', description: 'Days with ideal temps (50-80°F) for plant establishment', unit: 'days' },
                    { metric: 'Soil Workability', description: 'Days with appropriate moisture (not too wet/dry)', unit: 'days' },
                    { metric: 'Heat Stress Days', description: 'Days requiring intensive watering for new plants', unit: 'days' }
                ],
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
                riskWeights: {
                    precipitation: 0.30,  // Medium - electrical work sensitive
                    temperature: 0.20,    // Low - refrigerant work has wide range
                    wind: 0.25,           // Medium - affects heavy equipment lifts
                    workability: 0.25     // Medium - flexible scheduling
                },
                workabilityThresholds: {
                    criticalMinTemp: -5,  // °C (23°F) - refrigerant work limit
                    idealMinTemp: 10,     // °C (50°F) - ideal working temp
                    maxTemp: 38,          // °C (100°F) - equipment/worker heat limit
                    maxRain: 3,           // mm - light rain OK with protection
                    maxWind: 35,          // km/h - crane/lift operations
                    maxSnow: 5            // cm - light snow workable
                },
                kpis: [
                    { metric: 'Install Days', description: 'Days with dry conditions for electrical connections', unit: 'days' },
                    { metric: 'Equipment Protection', description: 'Days requiring tarps/covers during install', unit: 'days' },
                    { metric: 'Refrigerant Work', description: 'Days with temps ideal for charging system', unit: 'days' }
                ],
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
                    maxTemp: 43.33,       // °C (110°F) - dangerous heat
                    maxSnow: 0,
                    consecutiveDays: 2
                },
                riskFactors: {
                    rain: 'CRITICAL',
                    temperature: 'CRITICAL',
                    wind: 'LOW',
                    seasonal: 'HIGH'
                },
                riskWeights: {
                    precipitation: 0.40,  // Critical - ruins paving quality
                    temperature: 0.40,    // Critical - narrow temp window for compaction
                    wind: 0.05,           // Very low - minimal wind impact
                    workability: 0.15     // Low - short season but flexible within it
                },
                workabilityThresholds: {
                    criticalMinTemp: 10,  // °C (50°F) - absolute minimum for compaction
                    idealMinTemp: 15,     // °C (59°F) - ideal paving temp
                    maxTemp: 43.33,       // °C (110°F) - dangerous heat (worker safety, not material limit)
                    maxRain: 0,           // mm - zero tolerance
                    maxWind: 30,          // km/h - good tolerance
                    maxSnow: 0            // cm - no moisture allowed
                },
                kpis: [
                    { metric: 'Paving Windows', description: '2+ consecutive dry days with temps 50-90°F', unit: 'windows' },
                    { metric: 'Ground Dry Days', description: 'Days with dry substrate for quality bond', unit: 'days' },
                    { metric: 'Compaction Days', description: 'Days with optimal temps for asphalt compaction', unit: 'days' }
                ],
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
                riskWeights: {
                    precipitation: 0.30,  // Standard weight - balanced impact
                    temperature: 0.25,    // Standard weight - moderate impact
                    wind: 0.20,           // Standard weight - moderate impact
                    workability: 0.25     // Standard weight - balanced scheduling
                },
                workabilityThresholds: {
                    criticalMinTemp: 0,   // °C (32°F) - general cold-weather methods
                    idealMinTemp: 10,     // °C (50°F) - ideal working temp
                    maxTemp: 38,          // °C (100°F) - heat safety limit
                    maxRain: 8,           // mm - moderate rain workable for some tasks
                    maxWind: 40,          // km/h - standard wind tolerance
                    maxSnow: 3            // cm - light snow manageable
                },
                kpis: [
                    { metric: 'Exterior Work Days', description: 'Days suitable for outdoor construction activities', unit: 'days' },
                    { metric: 'Interior Fallback Days', description: 'Weather-delayed days requiring indoor work', unit: 'days' },
                    { metric: 'Inspection Windows', description: 'Dry days suitable for inspections and quality checks', unit: 'days' }
                ],
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

        // Calculate consistent contingency recommendation (same as in app.js)
        const totalProjectDays = analysis.actualProjectDays || 365;
        const heavyRain = analysis.heavyRainDays || 0;
        const workStoppingCold = analysis.extremeColdDays || 0;
        const heavySnow = analysis.heavySnowDays || 0;
        const grossStoppageDays = heavyRain + workStoppingCold + heavySnow;
        const estimatedOverlap = Math.round(grossStoppageDays * 0.25);
        const netStoppageDays = grossStoppageDays - estimatedOverlap;
        const directStoppagePercent = ((netStoppageDays / totalProjectDays) * 100).toFixed(1);

        let recommendedContingency = '';
        if (netStoppageDays === 0) {
            recommendedContingency = '10%';
        } else {
            const minContingency = Math.ceil(parseFloat(directStoppagePercent) * 1.3);
            const maxContingency = Math.ceil(parseFloat(directStoppagePercent) * 1.5);
            recommendedContingency = `${minContingency}-${maxContingency}%`;
        }

        // Analyze risk levels (pass contingency to all methods)
        this.analyzeRainRisk(analysis, recommendations, recommendedContingency);
        this.analyzeTemperatureRisk(analysis, recommendations);
        this.analyzeWindRisk(analysis, recommendations);
        this.analyzeSeasonalRisk(analysis, project, recommendations);
        this.analyzeWorkableDays(analysis, project, recommendations, recommendedContingency);
        this.generateSchedulingInsights(analysis, project, recommendations);

        return recommendations;
    }

    analyzeRainRisk(analysis, recommendations, recommendedContingency) {
        const rainyDays = analysis.rainyDays || 0;
        const heavyRainDays = analysis.heavyRainDays || 0;
        // CRITICAL FIX: Must use actual project duration, not default 90
        const totalDays = analysis.totalDays || analysis.actualProjectDays || 365;

        console.log(`[RECOMMENDATIONS] Rain analysis: ${rainyDays} rainy days / ${totalDays} total days = ${Math.round(rainyDays/totalDays*100)}%`);

        const heavyRainPercent = (heavyRainDays / totalDays) * 100;

        // Heavy rain impact - scaled by severity
        if (heavyRainPercent > 15) {
            // >15% = critical (>55 days/year)
            recommendations.critical.push({
                icon: 'fa-cloud-showers-heavy',
                title: 'High Heavy Rain Risk',
                message: `Expect ${heavyRainDays} days with heavy rain (>15mm), ${Math.round(heavyRainPercent)}% of project duration. Significant impact expected.`,
                action: `Add ${recommendedContingency} contingency time for weather delays (includes rain impact)`,
                priority: 'high'
            });
        } else if (heavyRainPercent > 8) {
            // 8-15% = moderate (30-55 days/year)
            recommendations.important.push({
                icon: 'fa-cloud-showers-heavy',
                title: 'Moderate Heavy Rain Impact',
                message: `Expect ${heavyRainDays} days with heavy rain (>15mm), ${Math.round(heavyRainPercent)}% of project duration. Manageable with planning.`,
                action: `Schedule contingency: ${recommendedContingency} (includes rain impact)`,
                priority: 'medium'
            });
        }

        if (rainyDays > totalDays * 0.35) {
            recommendations.important.push({
                icon: 'fa-umbrella',
                title: 'Frequent Rain Expected',
                message: `${rainyDays} rainy days expected (${Math.round(rainyDays/totalDays*100)}% of project duration). Note: Light rain days (<10mm) are workable with standard precautions.`,
                action: 'Plan for drainage, equipment protection, and alternate tasks',
                priority: 'medium'
            });
        }

        if (rainyDays > 0) {
            recommendations.helpful.push({
                icon: 'fa-tarp',
                title: 'Weather Protection',
                message: 'Invest in tarps, tent systems, and dehumidifiers for rainy periods',
                action: 'Allocate budget for weather protection equipment based on project scope',
                priority: 'low'
            });
        }
    }

    analyzeTemperatureRisk(analysis, recommendations) {
        const freezingDays = analysis.freezingDays || 0;
        const workStoppingCold = analysis.extremeColdDays || 0;
        const extremeHeatDays = analysis.extremeHeatDays || 0;
        const avgLow = analysis.avgTempMin;
        const totalDays = analysis.totalDays || analysis.actualProjectDays || 365;

        // EXTREME cold stoppage (≤-18°C / ≤0°F) is true work stoppage
        if (workStoppingCold > totalDays * 0.05) {
            // >5% extreme cold stoppage = significant
            const coldMethodsDays = analysis.coldWeatherMethodsDays || 0;
            recommendations.critical.push({
                icon: 'fa-snowflake',
                title: 'Work-Stopping Cold Expected',
                message: `${workStoppingCold} days expected ≤-18°C (≤0°F) requiring work stoppage. ${coldMethodsDays} additional days (0-23°F) workable with cold-weather methods. Concrete pours and major construction halted during extreme cold.`,
                action: 'Plan for heated enclosures, winter additives, and extended cure times',
                priority: 'high'
            });
        } else if (freezingDays > 20) {
            // Freezing but workable with precautions
            recommendations.important.push({
                icon: 'fa-snowflake',
                title: 'Freezing Conditions Expected',
                message: `${freezingDays} days below freezing (most workable with precautions). ${workStoppingCold} days require work stoppage (≤-18°C / ≤0°F).`,
                action: 'Plan for cold-weather methods: heated blankets, winter mix concrete',
                priority: 'medium'
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
                message: `${highWindDays} days with winds ≥30 km/h (≥19 mph). Affects roofing, crane work, painting.`,
                action: 'Schedule wind-sensitive tasks during calm periods. Have backup plans.',
                priority: 'medium'
            });
        }
    }

    analyzeSeasonalRisk(analysis, project, recommendations) {
        const startDate = new Date(project.startDate);
        const endDate = new Date(project.endDate);
        const startMonth = startDate.getMonth(); // 0-11

        // Winter start warning (Nov-Feb in Northern Hemisphere) - DATA-DRIVEN
        if (startMonth >= 10 || startMonth <= 1) {
            // Check actual winter workability from monthly breakdown
            const winterMonths = [10, 11, 0, 1]; // Nov, Dec, Jan, Feb
            let winterWorkability = null;

            if (analysis.monthlyBreakdown && analysis.monthlyBreakdown.length > 0) {
                const winterMonthsData = analysis.monthlyBreakdown.filter(m => winterMonths.includes(m.monthIndex));
                if (winterMonthsData.length > 0) {
                    const avgWinterWorkability = winterMonthsData.reduce((sum, m) => sum + parseInt(m.workablePercent || 0), 0) / winterMonthsData.length;
                    winterWorkability = Math.round(avgWinterWorkability);
                }
            }

            // Only warn if winter months actually have low workability (<70%)
            if (winterWorkability !== null && winterWorkability < 70) {
                recommendations.important.push({
                    icon: 'fa-calendar-alt',
                    title: 'Winter Start Timing',
                    message: `Project starts during winter months. Winter workability averages ${winterWorkability}% (below optimal).`,
                    action: 'Consider pushing start date to March-April for better weather windows, or plan for winter construction methods',
                    priority: 'medium'
                });
            }
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

    analyzeWorkableDays(analysis, project, recommendations, recommendedContingency) {
        const totalDays = Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24));
        const workableDays = analysis.workableDays || analysis.optimalDays || totalDays * 0.7;
        const workablePercent = (workableDays / totalDays) * 100;

        if (workablePercent < 60) {
            recommendations.critical.push({
                icon: 'fa-exclamation-triangle',
                title: 'Low Workable Days',
                message: `Only ${Math.round(workablePercent)}% of days expected to be workable (${Math.round(workableDays)} of ${totalDays} days)`,
                action: `Add ${recommendedContingency} contingency time to schedule (calculated from work-stoppage days)`,
                priority: 'high'
            });
        } else if (workablePercent < 75) {
            recommendations.important.push({
                icon: 'fa-calendar-times',
                title: 'Moderate Workable Days',
                message: `${Math.round(workablePercent)}% of days expected to be workable (${Math.round(workableDays)} of ${totalDays} days)`,
                action: `Add ${recommendedContingency} contingency time to account for weather delays`,
                priority: 'medium'
            });
        } else {
            recommendations.insights.push({
                icon: 'fa-thumbs-up',
                title: 'Good Weather Window',
                message: `${Math.round(workablePercent)}% of days expected to be workable - favorable conditions!`,
                action: `Weather contingency of ${recommendedContingency} recommended (calculated from work-stoppage analysis)`,
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
