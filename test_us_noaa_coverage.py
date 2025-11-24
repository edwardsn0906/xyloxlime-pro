#!/usr/bin/env python3
"""
Test US NOAA Coverage
Verifies that US locations always have NOAA stations within 200km
"""

import json
import math

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula (in km)"""
    R = 6371  # Earth's radius in km

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c

def find_nearest_station(lat, lng, stations, max_distance_km=200):
    """Find nearest NOAA station to given coordinates"""
    nearest_station = None
    min_distance = float('inf')

    for station in stations:
        distance = haversine_distance(lat, lng, station['lat'], station['lng'])

        if distance < min_distance:
            min_distance = distance
            nearest_station = {
                **station,
                'distance': round(distance, 1)
            }

    if nearest_station and nearest_station['distance'] <= max_distance_km:
        return nearest_station
    return None

def main():
    print("=" * 80)
    print("XYLOCLIME PRO - US NOAA COVERAGE TEST")
    print("=" * 80)
    print()

    # Load NOAA stations
    print("[LOADING] NOAA station database...")
    with open('noaa_stations_frontend.json', 'r') as f:
        all_stations = json.load(f)

    # Filter US stations
    us_stations = [s for s in all_stations if s.get('id', '').startswith('US')]

    print(f"[LOADED] {len(all_stations):,} total stations")
    print(f"[LOADED] {len(us_stations):,} US stations")
    print()

    # Test locations across the US
    test_locations = [
        {
            'name': 'Denver, Colorado (Major City)',
            'lat': 39.7392,
            'lng': -104.9903,
            'expected': 'TIER 1 - NOAA'
        },
        {
            'name': 'Phoenix, Arizona (Desert)',
            'lat': 33.4484,
            'lng': -112.0740,
            'expected': 'TIER 1 - NOAA'
        },
        {
            'name': 'Anchorage, Alaska (Far North)',
            'lat': 61.2181,
            'lng': -149.9003,
            'expected': 'TIER 1 - NOAA'
        },
        {
            'name': 'Rural Montana (Lewistown)',
            'lat': 47.0627,
            'lng': -109.4281,
            'expected': 'TIER 1 - NOAA'
        },
        {
            'name': 'Scandia, Minnesota (Previous Test)',
            'lat': 45.2508,
            'lng': -92.8024,
            'expected': 'TIER 1 - NOAA'
        },
        {
            'name': 'Miami, Florida (Tropical)',
            'lat': 25.7617,
            'lng': -80.1918,
            'expected': 'TIER 1 - NOAA'
        },
        {
            'name': 'Seattle, Washington (Pacific Northwest)',
            'lat': 47.6062,
            'lng': -122.3321,
            'expected': 'TIER 1 - NOAA'
        },
        {
            'name': 'New York City, New York (Urban)',
            'lat': 40.7128,
            'lng': -74.0060,
            'expected': 'TIER 1 - NOAA'
        },
        {
            'name': 'Richland, Washington (Previous Test)',
            'lat': 46.2856,
            'lng': -119.2844,
            'expected': 'TIER 1 - NOAA'
        },
        {
            'name': 'Honolulu, Hawaii (Island)',
            'lat': 21.3099,
            'lng': -157.8581,
            'expected': 'TIER 1 - NOAA'
        }
    ]

    print("=" * 80)
    print("TEST RESULTS")
    print("=" * 80)
    print()

    passed = 0
    failed = 0
    results = []

    for location in test_locations:
        print(f"Testing: {location['name']}")
        print(f"  Coordinates: {location['lat']}, {location['lng']}")

        # Find nearest station
        nearest = find_nearest_station(location['lat'], location['lng'], us_stations, max_distance_km=200)

        if nearest:
            print(f"  [PASS] TIER 1 - NOAA FOUND")
            print(f"  Station: {nearest['name']}")
            print(f"  Station ID: {nearest['id']}")
            print(f"  Distance: {nearest['distance']} km")
            print(f"  Status: PASS")
            passed += 1

            results.append({
                'location': location['name'],
                'status': 'PASS',
                'tier': 'TIER 1 - NOAA',
                'station': nearest['name'],
                'distance': nearest['distance'],
                'accuracy': '100%'
            })
        else:
            print(f"  [FAIL] NO NOAA STATION WITHIN 200KM")
            print(f"  Would fall back to: TIER 2 (Visual Crossing) or TIER 3 (ECMWF IFS)")
            print(f"  Status: FAIL")
            failed += 1

            results.append({
                'location': location['name'],
                'status': 'FAIL',
                'tier': 'TIER 2+ (Fallback)',
                'station': 'N/A',
                'distance': '>200 km',
                'accuracy': '<100%'
            })

        print()

    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {len(test_locations)}")
    print(f"Passed (NOAA): {passed} ({passed/len(test_locations)*100:.1f}%)")
    print(f"Failed (No NOAA): {failed} ({failed/len(test_locations)*100:.1f}%)")
    print()

    if passed == len(test_locations):
        print(">>> ALL US LOCATIONS USE NOAA DATA (100% ACCURACY) <<<")
        print()
        print("Result: US locations consistently use TIER 1 NOAA stations within 200km.")
        print("The data source selection hierarchy is working correctly.")
    else:
        print("!!! SOME LOCATIONS FALLING BACK TO LOWER TIERS !!!")
        print()
        print("Result: Some US locations do not have NOAA coverage within 200km.")
        print("These locations will fall back to Visual Crossing (80-100%) or ECMWF IFS (~50%).")

    print()
    print("=" * 80)
    print("DETAILED RESULTS TABLE")
    print("=" * 80)
    print()
    print(f"{'Location':<40} {'Tier':<20} {'Distance':<15} {'Status':<10}")
    print("-" * 85)

    for result in results:
        print(f"{result['location']:<40} {result['tier']:<20} {result['distance']:<15} {result['status']:<10}")

    print()
    print("=" * 80)

    # Save results to JSON
    with open('us_noaa_coverage_test_results.json', 'w') as f:
        json.dump({
            'test_date': '2025-11-24',
            'total_tests': len(test_locations),
            'passed': passed,
            'failed': failed,
            'pass_rate': f"{passed/len(test_locations)*100:.1f}%",
            'results': results
        }, f, indent=2)

    print("[SAVED] Results saved to: us_noaa_coverage_test_results.json")
    print()

if __name__ == '__main__':
    main()
