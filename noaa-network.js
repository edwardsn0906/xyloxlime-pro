/**
 * NOAA GLOBAL STATION NETWORK
 * Manages 4,940 high-quality NOAA weather stations worldwide
 * Provides accurate snowfall, temperature, and precipitation data
 * Coverage: United States, Canada, and international locations
 */

class NOAAStationNetwork {
    constructor() {
        this.stations = [];
        this.cities = [];
        this.loaded = false;
        this.loading = null;
    }

    /**
     * Load NOAA station database from JSON file
     * @returns {Promise<boolean>} Success status
     */
    async loadStations() {
        if (this.loaded) {
            return true;
        }

        if (this.loading) {
            return this.loading;
        }

        this.loading = (async () => {
            try {
                console.log('[NOAA Network] Loading comprehensive station database...');

                const response = await fetch('noaa_stations_frontend.json');
                if (!response.ok) {
                    throw new Error(`Failed to load station database: ${response.status}`);
                }

                this.stations = await response.json();
                console.log(`[NOAA Network] Loaded ${this.stations.length} high-quality stations`);

                // Load city database
                try {
                    const cityResponse = await fetch('us_cities_with_stations.json');
                    if (cityResponse.ok) {
                        this.cities = await cityResponse.json();
                        console.log(`[NOAA Network] Loaded ${this.cities.length} pre-mapped cities`);
                    }
                } catch (error) {
                    console.warn('[NOAA Network] City database not found, cities unavailable');
                }

                this.loaded = true;
                return true;
            } catch (error) {
                console.error('[NOAA Network] Failed to load station database:', error);
                this.loaded = false;
                return false;
            } finally {
                this.loading = null;
            }
        })();

        return this.loading;
    }

    /**
     * Find nearest NOAA station using Haversine formula
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} maxDistanceKm - Maximum search radius in km
     * @returns {object|null} Nearest station or null
     */
    async findNearestStation(lat, lng, maxDistanceKm = 100) {
        await this.loadStations();

        if (this.stations.length === 0) {
            console.warn('[NOAA Network] No stations loaded');
            return null;
        }

        let nearestStation = null;
        let minDistance = Infinity;

        for (const station of this.stations) {
            const distance = this.calculateDistance(lat, lng, station.lat, station.lng);

            if (distance < minDistance && distance <= maxDistanceKm) {
                minDistance = distance;
                nearestStation = {
                    ...station,
                    distance: Math.round(distance * 10) / 10 // Round to 1 decimal
                };
            }
        }

        if (nearestStation) {
            console.log(`[NOAA Network] Found station: ${nearestStation.name} (${nearestStation.distance}km away)`);
        } else {
            console.log(`[NOAA Network] No station found within ${maxDistanceKm}km`);
        }

        return nearestStation;
    }

    /**
     * Find multiple nearest stations
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} count - Number of stations to return
     * @param {number} maxDistanceKm - Maximum search radius
     * @returns {Array} Array of nearest stations
     */
    async findNearestStations(lat, lng, count = 5, maxDistanceKm = 200) {
        await this.loadStations();

        if (this.stations.length === 0) {
            return [];
        }

        // Calculate distance for all stations
        const stationsWithDistance = this.stations.map(station => ({
            ...station,
            distance: this.calculateDistance(lat, lng, station.lat, station.lng)
        }));

        // Filter by max distance and sort
        const nearbyStations = stationsWithDistance
            .filter(s => s.distance <= maxDistanceKm)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count)
            .map(s => ({
                ...s,
                distance: Math.round(s.distance * 10) / 10
            }));

        console.log(`[NOAA Network] Found ${nearbyStations.length} stations within ${maxDistanceKm}km`);

        return nearbyStations;
    }

    /**
     * Get city by name
     * @param {string} cityName - City name (e.g., "New York, NY")
     * @returns {object|null} City object with station info
     */
    async getCity(cityName) {
        await this.loadStations();

        const city = this.cities.find(c => c.name === cityName);
        return city || null;
    }

    /**
     * Get all available cities
     * @returns {Array} Array of city objects
     */
    async getAllCities() {
        await this.loadStations();
        return this.cities;
    }

    /**
     * Calculate distance between two points using Haversine formula
     * @param {number} lat1 - First point latitude
     * @param {number} lng1 - First point longitude
     * @param {number} lat2 - Second point latitude
     * @param {number} lng2 - Second point longitude
     * @returns {number} Distance in kilometers
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLng/2) * Math.sin(dLng/2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * Get coverage statistics
     * @returns {object} Network statistics
     */
    async getStats() {
        await this.loadStations();

        // Count by country
        const byCountry = {};
        for (const station of this.stations) {
            byCountry[station.country] = (byCountry[station.country] || 0) + 1;
        }

        return {
            totalStations: this.stations.length,
            totalCities: this.cities.length,
            coverage: 'Global (US, Canada, and international)',
            dataQuality: 'High (2024+ data)',
            countryCount: Object.keys(byCountry).length,
            topCountries: Object.entries(byCountry)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([country, count]) => ({ country, count }))
        };
    }
}

// Global instance
const noaaNetwork = new NOAAStationNetwork();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NOAAStationNetwork;
}
