/**
 * Bid Support Calculator - Weather Risk Contingency Estimator
 * Helps construction professionals price weather risk into bids
 */

class BidSupportCalculator {
    constructor() {
        this.calculator = null;
        this.currentAnalysis = null;
        this.currentProject = null;
        this.lastResults = null; // Store last calculation results for export
    }

    initialize() {
        // Find calculator element
        this.calculator = document.getElementById('bidCalculator');
        if (!this.calculator) {
            console.warn('Bid calculator element not found');
            return;
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Calculate button
        const calculateBtn = document.getElementById('calculateBidContingency');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.calculateContingency());
        }

        // Real-time updates on input changes
        const inputs = [
            'bidBaseLabor',
            'bidBaseMaterials',
            'bidBaseEquipment',
            'bidDailyOverhead',
            'bidDelayPenalty',
            'bidLaborMultiplier'
        ];

        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    // Clear results when inputs change
                    this.clearResults();
                });
            }
        });
    }

    loadProjectData(analysis, project) {
        this.currentAnalysis = analysis;
        this.currentProject = project;

        // Auto-populate some fields based on project duration
        const dailyOverhead = document.getElementById('bidDailyOverhead');
        if (dailyOverhead && !dailyOverhead.value) {
            // Estimate $2000/day average overhead
            dailyOverhead.value = '2000';
        }

        // Show the calculator section
        if (this.calculator) {
            this.calculator.classList.remove('hidden');
            this.calculator.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    calculateContingency() {
        if (!this.currentAnalysis || !this.currentProject) {
            window.toastManager.warning('Please run a weather analysis first', 'No Analysis Data');
            return;
        }

        // Get input values
        const baseLabor = parseFloat(document.getElementById('bidBaseLabor')?.value || 0);
        const baseMaterials = parseFloat(document.getElementById('bidBaseMaterials')?.value || 0);
        const baseEquipment = parseFloat(document.getElementById('bidBaseEquipment')?.value || 0);
        const dailyOverhead = parseFloat(document.getElementById('bidDailyOverhead')?.value || 2000);
        const delayPenalty = parseFloat(document.getElementById('bidDelayPenalty')?.value || 0);
        const laborMultiplier = parseFloat(document.getElementById('bidLaborMultiplier')?.value || 1.5);

        // Validate inputs
        if (baseLabor === 0 && baseMaterials === 0 && baseEquipment === 0) {
            window.toastManager.error('Please enter at least one base cost (labor, materials, or equipment)', 'Missing Cost Data');
            return;
        }

        // Calculate base bid
        const baseBid = baseLabor + baseMaterials + baseEquipment;

        // Weather risk analysis
        const riskScore = this.currentProject.riskScore || 0;
        const totalDays = Math.max(1, this.currentAnalysis.totalDays || 1);
        const workablePercent = (this.currentAnalysis.workableDays / totalDays) * 100;
        const nonWorkableDays = this.currentAnalysis.nonWorkableDays;

        // Calculate weather delay estimates
        const estimatedDelayDays = this.estimateDelayDays(nonWorkableDays, riskScore);
        const weatherDelayRange = {
            min: Math.floor(estimatedDelayDays * 0.7),
            likely: estimatedDelayDays,
            max: Math.ceil(estimatedDelayDays * 1.5)
        };

        // Calculate contingency costs
        const delayOverheadCost = weatherDelayRange.likely * dailyOverhead;
        const delayLaborCost = (baseLabor * (estimatedDelayDays / totalDays)) * laborMultiplier;
        const delayPenaltyCost = delayPenalty * weatherDelayRange.likely;
        const remobilizationCost = this.estimateRemobilizationCost(this.currentAnalysis, baseEquipment);

        const totalWeatherContingency = delayOverheadCost + delayLaborCost + delayPenaltyCost + remobilizationCost;

        // Calculate contingency percentage
        const safeBid = Math.max(1, baseBid || 1);
        const contingencyPercent = (totalWeatherContingency / safeBid) * 100;

        // Recommended markup range
        const recommendedMarkup = this.getRecommendedMarkup(riskScore, workablePercent);

        // Store results for export
        this.lastResults = {
            baseBid,
            baseLabor,
            baseMaterials,
            baseEquipment,
            totalWeatherContingency,
            contingencyPercent,
            weatherDelayRange,
            delayOverheadCost,
            delayLaborCost,
            delayPenaltyCost,
            remobilizationCost,
            recommendedMarkup,
            riskScore,
            workablePercent,
            totalBidWithContingency: baseBid + totalWeatherContingency,
            dailyOverhead,
            delayPenalty,
            laborMultiplier
        };

        // Display results
        this.displayResults(this.lastResults);

        // Show success toast
        window.toastManager.success('Bid contingency calculated successfully! Review recommendations below.', 'Calculation Complete', 4000);
    }

    estimateDelayDays(nonWorkableDays, riskScore) {
        // Not all non-workable days cause project delays due to:
        // - Work buffering
        // - Parallel activities
        // - Weekend recovery

        let delayFactor;
        if (riskScore <= 30) {
            delayFactor = 0.3; // Low risk - good management can absorb most delays
        } else if (riskScore <= 60) {
            delayFactor = 0.5; // Medium risk - moderate delay impact
        } else {
            delayFactor = 0.7; // High risk - most non-workable days cause delays
        }

        return Math.round(nonWorkableDays * delayFactor);
    }

    estimateRemobilizationCost(analysis, baseEquipment) {
        // Estimate cost of demobilizing/remobilizing equipment for weather delays
        // Typically 2-5% of equipment costs

        const extremeEvents = analysis.extremeEvents?.length || 0;
        let remobFactor;

        if (extremeEvents > 10) {
            remobFactor = 0.05; // High remobilization likely
        } else if (extremeEvents > 5) {
            remobFactor = 0.03; // Moderate remobilization
        } else {
            remobFactor = 0.02; // Minimal remobilization
        }

        return baseEquipment * remobFactor;
    }

    getRecommendedMarkup(riskScore, workablePercent) {
        // Industry-standard markup recommendations based on weather risk
        if (riskScore <= 30 && workablePercent >= 80) {
            return { min: 10, recommended: 12, max: 15, confidence: 'High' };
        } else if (riskScore <= 60 && workablePercent >= 65) {
            return { min: 15, recommended: 18, max: 22, confidence: 'Medium' };
        } else {
            return { min: 20, recommended: 25, max: 30, confidence: 'Low' };
        }
    }

    displayResults(results) {
        const resultsContainer = document.getElementById('bidResults');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="bid-results-grid">
                <!-- Summary Card -->
                <div class="bid-result-card summary-card">
                    <h3><i class="fas fa-calculator"></i> Bid Summary</h3>
                    <div class="bid-summary-item">
                        <span class="label">Base Bid (Labor + Materials + Equipment):</span>
                        <span class="value">$${results.baseBid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="bid-summary-item weather-contingency">
                        <span class="label">Weather Contingency:</span>
                        <span class="value">+$${results.totalWeatherContingency.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="bid-summary-item contingency-percent">
                        <span class="label">Contingency Percentage:</span>
                        <span class="value">${results.contingencyPercent.toFixed(1)}%</span>
                    </div>
                    <div class="bid-summary-item total">
                        <span class="label">Total Bid with Weather Contingency:</span>
                        <span class="value total-value">$${results.totalBidWithContingency.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>

                <!-- Delay Forecast Card -->
                <div class="bid-result-card">
                    <h3><i class="fas fa-clock"></i> Weather Delay Forecast</h3>
                    <div class="delay-range">
                        <div class="delay-scenario">
                            <span class="scenario-label">Best Case:</span>
                            <span class="scenario-value">${results.weatherDelayRange.min} days</span>
                        </div>
                        <div class="delay-scenario likely">
                            <span class="scenario-label">Most Likely:</span>
                            <span class="scenario-value">${results.weatherDelayRange.likely} days</span>
                        </div>
                        <div class="delay-scenario">
                            <span class="scenario-label">Worst Case:</span>
                            <span class="scenario-value">${results.weatherDelayRange.max} days</span>
                        </div>
                    </div>
                    <p class="delay-note">
                        <i class="fas fa-info-circle"></i>
                        Based on ${Math.round(results.workablePercent)}% workable days and risk score of ${results.riskScore}/100
                    </p>
                </div>

                <!-- Cost Breakdown Card -->
                <div class="bid-result-card">
                    <h3><i class="fas fa-chart-pie"></i> Contingency Breakdown</h3>
                    <div class="cost-breakdown">
                        <div class="breakdown-row">
                            <span class="breakdown-label">
                                <i class="fas fa-building"></i> Delay Overhead
                            </span>
                            <span class="breakdown-value">$${results.delayOverheadCost.toLocaleString()}</span>
                        </div>
                        <div class="breakdown-row">
                            <span class="breakdown-label">
                                <i class="fas fa-users"></i> Extended Labor
                            </span>
                            <span class="breakdown-value">$${results.delayLaborCost.toLocaleString()}</span>
                        </div>
                        ${results.delayPenaltyCost > 0 ? `
                        <div class="breakdown-row">
                            <span class="breakdown-label">
                                <i class="fas fa-exclamation-triangle"></i> Delay Penalties
                            </span>
                            <span class="breakdown-value">$${results.delayPenaltyCost.toLocaleString()}</span>
                        </div>
                        ` : ''}
                        <div class="breakdown-row">
                            <span class="breakdown-label">
                                <i class="fas fa-truck"></i> Remobilization
                            </span>
                            <span class="breakdown-value">$${results.remobilizationCost.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <!-- Markup Recommendations Card -->
                <div class="bid-result-card recommendations-card">
                    <h3><i class="fas fa-lightbulb"></i> Markup Recommendations</h3>
                    <div class="markup-recommendation">
                        <div class="markup-confidence ${results.recommendedMarkup.confidence.toLowerCase()}-confidence">
                            Schedule Confidence: ${results.recommendedMarkup.confidence}
                        </div>
                        <div class="markup-range">
                            <div class="markup-item">
                                <span>Conservative:</span>
                                <span class="markup-percent">${results.recommendedMarkup.min}%</span>
                            </div>
                            <div class="markup-item recommended">
                                <span>Recommended:</span>
                                <span class="markup-percent">${results.recommendedMarkup.recommended}%</span>
                            </div>
                            <div class="markup-item">
                                <span>Aggressive:</span>
                                <span class="markup-percent">${results.recommendedMarkup.max}%</span>
                            </div>
                        </div>
                        <p class="markup-note">
                            Apply markup to base bid + weather contingency for final bid price
                        </p>
                    </div>
                </div>
            </div>

            <div class="bid-actions">
                <button class="btn-export-bid" onclick="meteoryxApp.exportBidSummary()">
                    <i class="fas fa-file-export"></i> Export Bid Summary
                </button>
                <button class="btn-add-to-pdf" onclick="meteoryxApp.addBidToPDF()">
                    <i class="fas fa-file-pdf"></i> Include in PDF Report
                </button>
            </div>
        `;

        resultsContainer.classList.remove('hidden');
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    clearResults() {
        const resultsContainer = document.getElementById('bidResults');
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
        }
    }

    exportSummaryToExcel() {
        if (!this.lastResults) {
            window.toastManager.warning('Please calculate bid contingency first', 'No Results');
            return;
        }

        if (typeof XLSX === 'undefined') {
            window.toastManager.error('Excel export library not loaded', 'Export Error');
            return;
        }

        const results = this.lastResults;
        const projectName = this.currentProject?.name || 'Weather Bid Analysis';
        const location = this.currentAnalysis?.locationName || 'Unknown Location';
        const dateRange = this.currentProject ?
            `${this.currentProject.startDate} to ${this.currentProject.endDate}` :
            'Unknown';

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Sheet 1: Bid Summary
        const summaryData = [
            ['WEATHER-BASED BID CONTINGENCY ANALYSIS'],
            ['Project:', projectName],
            ['Location:', location],
            ['Project Period:', dateRange],
            ['Generated:', new Date().toLocaleString()],
            [],
            ['BASE BID BREAKDOWN'],
            ['Labor:', `$${results.baseLabor.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Materials:', `$${results.baseMaterials.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Equipment:', `$${results.baseEquipment.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Base Bid Total:', `$${results.baseBid.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            [],
            ['WEATHER CONTINGENCY BREAKDOWN'],
            ['Delay Overhead Cost:', `$${results.delayOverheadCost.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Delay Labor Cost:', `$${results.delayLaborCost.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Delay Penalty Cost:', `$${results.delayPenaltyCost.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Remobilization Cost:', `$${results.remobilizationCost.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Total Weather Contingency:', `$${results.totalWeatherContingency.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Contingency Percentage:', `${results.contingencyPercent.toFixed(1)}%`],
            [],
            ['FINAL BID'],
            ['Total Bid with Weather Contingency:', `$${results.totalBidWithContingency.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            [],
            ['WEATHER DELAY FORECAST'],
            ['Best Case Scenario:', `${results.weatherDelayRange.min} days`],
            ['Most Likely Scenario:', `${results.weatherDelayRange.likely} days`],
            ['Worst Case Scenario:', `${results.weatherDelayRange.max} days`],
            [],
            ['RISK ASSESSMENT'],
            ['Weather Risk Score:', `${results.riskScore}/100`],
            ['Workable Days:', `${results.workablePercent.toFixed(1)}%`],
            [],
            ['RECOMMENDED MARKUP'],
            ['Minimum:', `${results.recommendedMarkup.min}%`],
            ['Recommended:', `${results.recommendedMarkup.recommended}%`],
            ['Maximum:', `${results.recommendedMarkup.max}%`],
            ['Confidence Level:', results.recommendedMarkup.confidence]
        ];

        const ws = XLSX.utils.aoa_to_sheet(summaryData);

        // Set column widths
        ws['!cols'] = [
            {wch: 30},
            {wch: 20}
        ];

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Bid Summary');

        // Sheet 2: Calculation Inputs
        const inputsData = [
            ['CALCULATION INPUTS'],
            [],
            ['Base Labor Cost:', `$${results.baseLabor.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Base Materials Cost:', `$${results.baseMaterials.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Base Equipment Cost:', `$${results.baseEquipment.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Daily Overhead Rate:', `$${results.dailyOverhead.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Delay Penalty (per day):', `$${results.delayPenalty.toLocaleString('en-US', {minimumFractionDigits: 2})}`],
            ['Labor Delay Multiplier:', results.laborMultiplier],
            [],
            ['WEATHER ANALYSIS INPUTS'],
            ['Project Risk Score:', `${results.riskScore}/100`],
            ['Workable Days Percentage:', `${results.workablePercent.toFixed(1)}%`]
        ];

        const ws2 = XLSX.utils.aoa_to_sheet(inputsData);
        ws2['!cols'] = [{wch: 30}, {wch: 20}];
        XLSX.utils.book_append_sheet(wb, ws2, 'Inputs');

        // Export file
        const filename = `Bid_Contingency_${projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);

        window.toastManager.success(`Exported bid summary to ${filename}`, 'Export Successful');
    }
}

// Initialize bid calculator globally
window.bidCalculator = new BidSupportCalculator();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.bidCalculator.initialize();
});
