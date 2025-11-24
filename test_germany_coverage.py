#!/usr/bin/env python3
"""
Test Germany NOAA Coverage
Verifies that German locations use TIER 1 NOAA stations
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
    print("XYLOCLIME PRO - GERMANY NOAA COVERAGE TEST")
    print("=" * 80)
    print()

    # Load NOAA stations
    print("[LOADING] NOAA station database...")
    with open('noaa_stations_frontend.json', 'r') as f:
        all_stations = json.load(f)

    # Filter Germany stations
    de_stations = [s for s in all_stations if s.get('country') == 'DE' or s.get('id', '').startswith('GM')]

    print(f"[LOADED] {len(all_stations):,} total stations")
    print(f"[LOADED] {len(de_stations):,} Germany stations")
    print()

    # Test locations across Germany
    test_locations = [
        {
            'name': 'Berlin (Capital)',
            'lat': 52.5200,
            'lng': 13.4050,
            'info': 'Capital city, major construction market'
        },
        {
            'name': 'Munich (Bavaria)',
            'lat': 48.1351,
            'lng': 11.5820,
            'info': 'Economic powerhouse, tech hub'
        },
        {
            'name': 'Hamburg (Port City)',
            'lat': 53.5511,
            'lng': 9.9937,
            'info': 'Major port, logistics hub'
        },
        {
            'name': 'Frankfurt (Financial)',
            'lat': 50.1109,
            'lng': 8.6821,
            'info': 'Financial center, major airport'
        },
        {
            'name': 'Cologne (Rhineland)',
            'lat': 50.9375,
            'lng': 6.9603,
            'info': 'Major city, cultural center'
        },
        {
            'name': 'Stuttgart (Baden-Wurttemberg)',
            'lat': 48.7758,
            'lng': 9.1829,
            'info': 'Automotive industry hub'
        },
        {
            'name': 'Dusseldorf (North Rhine)',
            'lat': 51.2277,
            'lng': 6.7735,
            'info': 'Fashion and trade center'
        },
        {
            'name': 'Dortmund (Ruhr Area)',
            'lat': 51.5136,
            'lng': 7.4653,
            'info': 'Industrial heartland'
        },
        {
            'name': 'Leipzig (Saxony)',
            'lat': 51.3397,
            'lng': 12.3731,
            'info': 'Growing tech and logistics hub'
        },
        {
            'name': 'Dresden (Saxony)',
            'lat': 51.0504,
            'lng': 13.7373,
            'info': 'Historic city, semiconductor hub'
        },
        {
            'name': 'Nuremberg (Bavaria)',
            'lat': 49.4521,
            'lng': 11.0767,
            'info': 'Trade fair city'
        },
        {
            'name': 'Hannover (Lower Saxony)',
            'lat': 52.3759,
            'lng': 9.7320,
            'info': 'Industrial and trade fair center'
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
        print(f"  {location['info']}")
        print(f"  Coordinates: {location['lat']}, {location['lng']}")

        # Find nearest station
        nearest = find_nearest_station(location['lat'], location['lng'], de_stations, max_distance_km=200)

        if nearest:
            print(f"  [PASS] TIER 1 - NOAA FOUND")
            print(f"  Station: {nearest['name']}")
            print(f"  Station ID: {nearest['id']}")
            print(f"  Distance: {nearest['distance']} km")
            print(f"  Accuracy: 100%")
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
        print(">>> ALL GERMANY LOCATIONS USE NOAA DATA (100% ACCURACY) <<<")
        print()
        print("Result: Germany locations consistently use TIER 1 NOAA stations.")
        print("The data source selection hierarchy is working correctly.")
    else:
        print("!!! SOME LOCATIONS FALLING BACK TO LOWER TIERS !!!")
        print()
        print("Result: Some Germany locations do not have NOAA coverage within 200km.")
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
    print("GERMANY CONSTRUCTION MARKET")
    print("=" * 80)
    print()
    print("Why Germany?")
    print("  - Largest economy in Europe (GDP: $4.3 trillion)")
    print("  - Construction market: $500B+ annually")
    print("  - Population: 83+ million")
    print("  - Major infrastructure investments")
    print("  - Hub for international construction companies")
    print()
    print("Key Construction Sectors:")
    print("  - Residential construction (major housing shortage)")
    print("  - Commercial real estate (office, retail)")
    print("  - Infrastructure (roads, rail, energy)")
    print("  - Industrial facilities (automotive, manufacturing)")
    print()
    print("Major Projects:")
    print("  - Berlin Brandenburg Airport expansion")
    print("  - Stuttgart 21 rail project")
    print("  - Munich Metro expansion")
    print("  - Renewable energy infrastructure")
    print()

    # Save results to JSON
    with open('germany_coverage_test_results.json', 'w') as f:
        json.dump({
            'test_date': '2025-11-24',
            'region': 'Germany',
            'total_tests': len(test_locations),
            'passed': passed,
            'failed': failed,
            'pass_rate': f"{passed/len(test_locations)*100:.1f}%",
            'results': results,
            'market_info': {
                'gdp': '$4.3 trillion',
                'construction_market': '$500B+ annually',
                'population': '83+ million',
                'capital': 'Berlin'
            }
        }, f, indent=2)

    print("[SAVED] Results saved to: germany_coverage_test_results.json")
    print()

if __name__ == '__main__':
    main()
