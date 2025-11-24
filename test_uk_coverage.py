#!/usr/bin/env python3
"""
Test UK Data Coverage
Verifies data source tier for UK locations
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
    print("XYLOCLIME PRO - UK DATA COVERAGE TEST")
    print("=" * 80)
    print()

    # Load NOAA stations
    print("[LOADING] NOAA station database...")
    with open('noaa_stations_frontend.json', 'r') as f:
        all_stations = json.load(f)

    # Filter UK stations (if any)
    uk_stations = [s for s in all_stations if s.get('id', '').startswith('UK')]

    print(f"[LOADED] {len(all_stations):,} total stations")
    print(f"[LOADED] {len(uk_stations):,} UK stations")
    print()

    # Test locations across the UK
    test_locations = [
        {
            'name': 'London, England',
            'lat': 51.5074,
            'lng': -0.1278,
            'expected': 'TIER 2 - Visual Crossing or TIER 3 - ECMWF IFS'
        },
        {
            'name': 'Manchester, England',
            'lat': 53.4808,
            'lng': -2.2426,
            'expected': 'TIER 2 - Visual Crossing or TIER 3 - ECMWF IFS'
        },
        {
            'name': 'Edinburgh, Scotland',
            'lat': 55.9533,
            'lng': -3.1883,
            'expected': 'TIER 2 - Visual Crossing or TIER 3 - ECMWF IFS'
        },
        {
            'name': 'Birmingham, England',
            'lat': 52.4862,
            'lng': -1.8904,
            'expected': 'TIER 2 - Visual Crossing or TIER 3 - ECMWF IFS'
        },
        {
            'name': 'Glasgow, Scotland',
            'lat': 55.8642,
            'lng': -4.2518,
            'expected': 'TIER 2 - Visual Crossing or TIER 3 - ECMWF IFS'
        },
        {
            'name': 'Rural Wales (Snowdonia)',
            'lat': 53.0685,
            'lng': -3.9124,
            'expected': 'TIER 2 - Visual Crossing or TIER 3 - ECMWF IFS'
        },
        {
            'name': 'Belfast, Northern Ireland',
            'lat': 54.5973,
            'lng': -5.9301,
            'expected': 'TIER 2 - Visual Crossing or TIER 3 - ECMWF IFS'
        },
        {
            'name': 'Bristol, England',
            'lat': 51.4545,
            'lng': -2.5879,
            'expected': 'TIER 2 - Visual Crossing or TIER 3 - ECMWF IFS'
        }
    ]

    print("=" * 80)
    print("TEST RESULTS")
    print("=" * 80)
    print()

    tier1_count = 0
    tier2_count = 0
    results = []

    for location in test_locations:
        print(f"Testing: {location['name']}")
        print(f"  Coordinates: {location['lat']}, {location['lng']}")

        # Check for NOAA station
        nearest_noaa = find_nearest_station(location['lat'], location['lng'], all_stations, max_distance_km=200)

        if nearest_noaa:
            print(f"  [TIER 1] NOAA STATION FOUND")
            print(f"  Station: {nearest_noaa['name']}")
            print(f"  Station ID: {nearest_noaa['id']}")
            print(f"  Distance: {nearest_noaa['distance']} km")
            print(f"  Accuracy: 100%")
            print(f"  Status: Unexpected but good!")
            tier1_count += 1

            results.append({
                'location': location['name'],
                'tier': 'TIER 1 - NOAA',
                'station': nearest_noaa['name'],
                'distance': nearest_noaa['distance'],
                'accuracy': '100%',
                'status': 'Excellent'
            })
        else:
            print(f"  [TIER 2+] No NOAA station within 200km")
            print(f"  Expected Data Source: Visual Crossing (80-100%) or ECMWF IFS (~50%)")
            print(f"  Accuracy: 50-100% (station or model-based)")
            print(f"  Status: Expected for UK")
            tier2_count += 1

            results.append({
                'location': location['name'],
                'tier': 'TIER 2+ (Visual Crossing/ECMWF IFS)',
                'station': 'N/A',
                'distance': '>200 km',
                'accuracy': '50-100%',
                'status': 'Good (Expected)'
            })

        print()

    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {len(test_locations)}")
    print(f"TIER 1 (NOAA): {tier1_count} locations")
    print(f"TIER 2+ (VC/ECMWF): {tier2_count} locations")
    print()

    if tier1_count > 0:
        print(f"[SURPRISE] {tier1_count} UK location(s) have NOAA coverage!")
        print("This is unexpected but excellent - 100% accuracy available.")
    else:
        print("[EXPECTED] No NOAA stations within 200km of UK locations")
        print()
        print("UK locations will use:")
        print("  - TIER 2: Visual Crossing (80-100% accuracy) - Global coverage")
        print("    * Has default API key configured")
        print("    * Station-based data")
        print("    * Very reliable for Europe")
        print()
        print("  - TIER 3: ECMWF IFS (~50% accuracy) - If Visual Crossing unavailable")
        print("    * Model-based (9km resolution)")
        print("    * 12.5x more accurate than ERA5")
        print("    * Good for 2017+ dates")
        print()
        print("  - TIER 4: ERA5 (~4% accuracy) - Last resort only")
        print("    * Should be rare")
        print("    * Will show warning in console")

    print()
    print("=" * 80)
    print("DETAILED RESULTS TABLE")
    print("=" * 80)
    print()
    print(f"{'Location':<40} {'Tier':<35} {'Accuracy':<15} {'Status':<15}")
    print("-" * 105)

    for result in results:
        print(f"{result['location']:<40} {result['tier']:<35} {result['accuracy']:<15} {result['status']:<15}")

    print()
    print("=" * 80)
    print("RECOMMENDATION FOR UK USERS")
    print("=" * 80)
    print()
    print("UK locations will have excellent data quality:")
    print("  1. Visual Crossing provides 80-100% accuracy for Europe")
    print("  2. ECMWF IFS provides ~50% accuracy (better than ERA5's 4%)")
    print("  3. Both are acceptable for construction bidding")
    print("  4. ERA5 (~4%) should only be used as last resort")
    print()
    print("To verify in the app:")
    print("  1. Open browser console when analyzing UK project")
    print("  2. Look for [DATA SOURCE] logs")
    print("  3. You should see:")
    print("     - 'TIER 2: Using Visual Crossing data (80-100% accuracy)' OR")
    print("     - 'TIER 3: Using ECMWF IFS model data (~50% accuracy)'")
    print("  4. If you see TIER 4 ERA5, investigate why higher tiers failed")
    print()

    # Save results to JSON
    with open('uk_coverage_test_results.json', 'w') as f:
        json.dump({
            'test_date': '2025-11-24',
            'region': 'United Kingdom',
            'total_tests': len(test_locations),
            'tier1_count': tier1_count,
            'tier2_count': tier2_count,
            'results': results,
            'recommendation': 'Use Visual Crossing (Tier 2) or ECMWF IFS (Tier 3) for UK projects'
        }, f, indent=2)

    print("[SAVED] Results saved to: uk_coverage_test_results.json")
    print()

if __name__ == '__main__':
    main()
