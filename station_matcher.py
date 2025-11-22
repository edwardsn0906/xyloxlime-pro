"""
NOAA Station Matcher
Finds nearest weather stations based on geographic coordinates
"""

import json
import math
from typing import List, Dict, Tuple

class StationMatcher:
    """Find nearest NOAA stations for any US location"""

    def __init__(self, stations_file='noaa_snow_stations.json'):
        """Load station database"""
        with open(stations_file, 'r') as f:
            self.stations = json.load(f)

        print(f"[OK] Loaded {len(self.stations)} NOAA stations")

        # Filter for high-quality stations (full capability + recent data)
        self.quality_stations = [
            s for s in self.stations
            if s['has_temp'] and s['has_precip'] and s['has_snow']
            and any(dt.get('end', 0) >= 2024 for dt in s['data_types'].values())
        ]

        print(f"[OK] Found {len(self.quality_stations)} high-quality stations (2024+ data)")

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate distance between two points on Earth using Haversine formula
        Returns distance in miles
        """
        # Convert to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))

        # Earth's radius in miles
        r = 3956

        return c * r

    def find_nearest_stations(self, lat: float, lng: float, count: int = 5,
                             quality_only: bool = True) -> List[Dict]:
        """
        Find nearest weather stations to given coordinates

        Args:
            lat: Latitude
            lng: Longitude
            count: Number of stations to return
            quality_only: Only return stations with full data (temp+precip+snow)

        Returns:
            List of nearest stations with distance info
        """
        stations_to_search = self.quality_stations if quality_only else self.stations

        # Calculate distance to all stations
        stations_with_distance = []
        for station in stations_to_search:
            distance = self.haversine_distance(lat, lng, station['lat'], station['lng'])
            station_copy = station.copy()
            station_copy['distance_miles'] = round(distance, 1)
            stations_with_distance.append(station_copy)

        # Sort by distance and return closest N
        stations_with_distance.sort(key=lambda x: x['distance_miles'])
        return stations_with_distance[:count]

    def find_best_station(self, lat: float, lng: float) -> Dict:
        """
        Find single best station for a location

        Returns:
            Best station with distance info
        """
        nearest = self.find_nearest_stations(lat, lng, count=1, quality_only=True)
        return nearest[0] if nearest else None

    def get_coverage_report(self, lat: float, lng: float, radius_miles: int = 50) -> Dict:
        """
        Get coverage report for a location

        Args:
            lat: Latitude
            lng: Longitude
            radius_miles: Search radius in miles

        Returns:
            Coverage statistics for the area
        """
        all_stations = []
        for station in self.quality_stations:
            distance = self.haversine_distance(lat, lng, station['lat'], station['lng'])
            if distance <= radius_miles:
                station_copy = station.copy()
                station_copy['distance_miles'] = round(distance, 1)
                all_stations.append(station_copy)

        return {
            'location': {'lat': lat, 'lng': lng},
            'radius_miles': radius_miles,
            'stations_found': len(all_stations),
            'nearest_station_distance': round(all_stations[0]['distance_miles'], 1) if all_stations else None,
            'stations': sorted(all_stations, key=lambda x: x['distance_miles'])[:10]
        }


def test_major_cities():
    """Test station matching for major US cities"""

    test_cities = [
        {"name": "New York, NY", "lat": 40.7128, "lng": -74.0060},
        {"name": "Los Angeles, CA", "lat": 34.0522, "lng": -118.2437},
        {"name": "Chicago, IL", "lat": 41.8781, "lng": -87.6298},
        {"name": "Houston, TX", "lat": 29.7604, "lng": -95.3698},
        {"name": "Phoenix, AZ", "lat": 33.4484, "lng": -112.0740},
        {"name": "Denver, CO", "lat": 39.7392, "lng": -104.9903},
        {"name": "Seattle, WA", "lat": 47.6062, "lng": -122.3321},
        {"name": "Boston, MA", "lat": 42.3601, "lng": -71.0589},
        {"name": "Miami, FL", "lat": 25.7617, "lng": -80.1918},
        {"name": "Minneapolis, MN", "lat": 44.9778, "lng": -93.2650},
    ]

    print("\n" + "=" * 80)
    print("TESTING STATION COVERAGE FOR MAJOR US CITIES")
    print("=" * 80)

    matcher = StationMatcher()

    for city in test_cities:
        print(f"\n{city['name']}:")
        print("-" * 80)

        # Find nearest stations
        nearest = matcher.find_nearest_stations(city['lat'], city['lng'], count=3)

        for i, station in enumerate(nearest, 1):
            print(f"  #{i}: {station['name']} ({station['id']})")
            print(f"      Distance: {station['distance_miles']} miles")
            print(f"      Location: {station['lat']:.4f}, {station['lng']:.4f}")
            print(f"      Elevation: {station['elevation']} m")

            # Show data availability
            data_types = station['data_types']
            snow_range = f"{data_types.get('SNOW', {}).get('start', 'N/A')}-{data_types.get('SNOW', {}).get('end', 'N/A')}"
            print(f"      Snowfall data: {snow_range}")

    print("\n" + "=" * 80)


def create_city_database():
    """Create database of major US cities with nearest stations"""

    # Major US cities by population
    cities = [
        {"name": "New York, NY", "lat": 40.7128, "lng": -74.0060, "population": 8336817},
        {"name": "Los Angeles, CA", "lat": 34.0522, "lng": -118.2437, "population": 3979576},
        {"name": "Chicago, IL", "lat": 41.8781, "lng": -87.6298, "population": 2693976},
        {"name": "Houston, TX", "lat": 29.7604, "lng": -95.3698, "population": 2320268},
        {"name": "Phoenix, AZ", "lat": 33.4484, "lng": -112.0740, "population": 1680992},
        {"name": "Philadelphia, PA", "lat": 39.9526, "lng": -75.1652, "population": 1584064},
        {"name": "San Antonio, TX", "lat": 29.4241, "lng": -98.4936, "population": 1547253},
        {"name": "San Diego, CA", "lat": 32.7157, "lng": -117.1611, "population": 1423851},
        {"name": "Dallas, TX", "lat": 32.7767, "lng": -96.7970, "population": 1343573},
        {"name": "San Jose, CA", "lat": 37.3382, "lng": -121.8863, "population": 1021795},
        {"name": "Austin, TX", "lat": 30.2672, "lng": -97.7431, "population": 978908},
        {"name": "Jacksonville, FL", "lat": 30.3322, "lng": -81.6557, "population": 949611},
        {"name": "Fort Worth, TX", "lat": 32.7555, "lng": -97.3308, "population": 918915},
        {"name": "Columbus, OH", "lat": 39.9612, "lng": -82.9988, "population": 898553},
        {"name": "Charlotte, NC", "lat": 35.2271, "lng": -80.8431, "population": 885708},
        {"name": "San Francisco, CA", "lat": 37.7749, "lng": -122.4194, "population": 873965},
        {"name": "Indianapolis, IN", "lat": 39.7684, "lng": -86.1581, "population": 867125},
        {"name": "Seattle, WA", "lat": 47.6062, "lng": -122.3321, "population": 753675},
        {"name": "Denver, CO", "lat": 39.7392, "lng": -104.9903, "population": 715522},
        {"name": "Boston, MA", "lat": 42.3601, "lng": -71.0589, "population": 692600},
        {"name": "Nashville, TN", "lat": 36.1627, "lng": -86.7816, "population": 689447},
        {"name": "Detroit, MI", "lat": 42.3314, "lng": -83.0458, "population": 639111},
        {"name": "Portland, OR", "lat": 45.5152, "lng": -122.6784, "population": 652503},
        {"name": "Las Vegas, NV", "lat": 36.1699, "lng": -115.1398, "population": 641903},
        {"name": "Memphis, TN", "lat": 35.1495, "lng": -90.0490, "population": 633104},
        {"name": "Louisville, KY", "lat": 38.2527, "lng": -85.7585, "population": 617638},
        {"name": "Baltimore, MD", "lat": 39.2904, "lng": -76.6122, "population": 585708},
        {"name": "Milwaukee, WI", "lat": 43.0389, "lng": -87.9065, "population": 577222},
        {"name": "Albuquerque, NM", "lat": 35.0844, "lng": -106.6504, "population": 564559},
        {"name": "Tucson, AZ", "lat": 32.2226, "lng": -110.9747, "population": 548073},
        {"name": "Fresno, CA", "lat": 36.7378, "lng": -119.7871, "population": 542107},
        {"name": "Sacramento, CA", "lat": 38.5816, "lng": -121.4944, "population": 524943},
        {"name": "Kansas City, MO", "lat": 39.0997, "lng": -94.5786, "population": 508090},
        {"name": "Mesa, AZ", "lat": 33.4152, "lng": -111.8315, "population": 504258},
        {"name": "Atlanta, GA", "lat": 33.7490, "lng": -84.3880, "population": 498715},
        {"name": "Omaha, NE", "lat": 41.2565, "lng": -95.9345, "population": 486051},
        {"name": "Colorado Springs, CO", "lat": 38.8339, "lng": -104.8214, "population": 478961},
        {"name": "Raleigh, NC", "lat": 35.7796, "lng": -78.6382, "population": 474069},
        {"name": "Miami, FL", "lat": 25.7617, "lng": -80.1918, "population": 442241},
        {"name": "Virginia Beach, VA", "lat": 36.8529, "lng": -75.9780, "population": 459470},
        {"name": "Minneapolis, MN", "lat": 44.9778, "lng": -93.2650, "population": 429954},
        {"name": "Cleveland, OH", "lat": 41.4993, "lng": -81.6944, "population": 372624},
        {"name": "New Orleans, LA", "lat": 29.9511, "lng": -90.0715, "population": 383997},
        {"name": "Arlington, TX", "lat": 32.7357, "lng": -97.1081, "population": 398854},
        {"name": "Tampa, FL", "lat": 27.9506, "lng": -82.4572, "population": 399700},
        {"name": "Pittsburgh, PA", "lat": 40.4406, "lng": -79.9959, "population": 302971},
        {"name": "Cincinnati, OH", "lat": 39.1031, "lng": -84.5120, "population": 309317},
        {"name": "Buffalo, NY", "lat": 42.8864, "lng": -78.8784, "population": 278349},
        {"name": "Salt Lake City, UT", "lat": 40.7608, "lng": -111.8910, "population": 200567},
        {"name": "Boise, ID", "lat": 43.6150, "lng": -116.2023, "population": 235684},
    ]

    print("\n[*] Creating city-to-station database...")
    matcher = StationMatcher()

    city_database = []
    for city in cities:
        nearest_station = matcher.find_best_station(city['lat'], city['lng'])

        city_entry = {
            'name': city['name'],
            'lat': city['lat'],
            'lng': city['lng'],
            'population': city['population'],
            'nearest_station': {
                'id': nearest_station['id'],
                'name': nearest_station['name'],
                'distance_miles': nearest_station['distance_miles'],
                'lat': nearest_station['lat'],
                'lng': nearest_station['lng']
            }
        }

        city_database.append(city_entry)
        print(f"  {city['name']}: {nearest_station['name']} ({nearest_station['distance_miles']} mi)")

    # Save city database
    with open('us_cities_with_stations.json', 'w') as f:
        json.dump(city_database, f, indent=2)

    print(f"\n[OK] Saved us_cities_with_stations.json ({len(city_database)} cities)")

    return city_database


if __name__ == '__main__':
    # Test major cities
    test_major_cities()

    # Create city database
    print("\n" + "=" * 80)
    create_city_database()
    print("=" * 80)
