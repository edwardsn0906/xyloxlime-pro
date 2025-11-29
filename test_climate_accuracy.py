"""
NOAA Climate Data Accuracy Test
Tests real NOAA station data against known climate patterns
"""

from noaa_data_fetcher import NOAADataFetcher
from station_matcher import StationMatcher
from datetime import datetime

# Test locations with known climate characteristics
TEST_LOCATIONS = [
    {
        'name': 'Buffalo, NY',
        'lat': 42.8864,
        'lng': -78.8784,
        'climate': 'Lake Effect Snow Belt',
        'expected': {
            'annual_snow_range': (90, 110),  # inches
            'snow_season': '2023-11-01 to 2024-04-30',
            'typical_season_snow': (60, 100)  # inches for Nov-Apr
        }
    },
    {
        'name': 'Denver, CO',
        'lat': 39.7392,
        'lng': -104.9903,
        'climate': 'High Plains Semi-Arid',
        'expected': {
            'annual_snow_range': (50, 70),  # inches
            'snow_season': '2023-11-01 to 2024-04-30',
            'typical_season_snow': (40, 60)
        }
    },
    {
        'name': 'Miami, FL',
        'lat': 25.7617,
        'lng': -80.1918,
        'climate': 'Tropical/Subtropical',
        'expected': {
            'annual_snow_range': (0, 0),  # No snow ever!
            'snow_season': '2023-11-01 to 2024-04-30',
            'typical_season_snow': (0, 0)
        }
    },
    {
        'name': 'Chicago, IL',
        'lat': 41.8781,
        'lng': -87.6298,
        'climate': 'Continental',
        'expected': {
            'annual_snow_range': (35, 45),  # inches
            'snow_season': '2023-11-01 to 2024-04-30',
            'typical_season_snow': (30, 40)
        }
    },
    {
        'name': 'Phoenix, AZ',
        'lat': 33.4484,
        'lng': -112.0740,
        'climate': 'Hot Desert',
        'expected': {
            'annual_snow_range': (0, 0),  # Trace amounts only
            'snow_season': '2023-11-01 to 2024-04-30',
            'typical_season_snow': (0, 0.5)  # Usually 0
        }
    },
    {
        'name': 'Minneapolis, MN',
        'lat': 44.9778,
        'lng': -93.2650,
        'climate': 'Humid Continental - Cold',
        'expected': {
            'annual_snow_range': (45, 60),  # inches
            'snow_season': '2023-11-01 to 2024-04-30',
            'typical_season_snow': (35, 50)
        }
    },
    {
        'name': 'Seattle, WA',
        'lat': 47.6062,
        'lng': -122.3321,
        'climate': 'Marine West Coast',
        'expected': {
            'annual_snow_range': (5, 10),  # inches (very light)
            'snow_season': '2023-11-01 to 2024-04-30',
            'typical_season_snow': (3, 8)
        }
    },
    {
        'name': 'Boston, MA',
        'lat': 42.3601,
        'lng': -71.0589,
        'climate': 'Humid Continental - Coastal',
        'expected': {
            'annual_snow_range': (40, 50),  # inches
            'snow_season': '2023-11-01 to 2024-04-30',
            'typical_season_snow': (35, 45)
        }
    }
]

def test_location_accuracy():
    """Test NOAA data accuracy for diverse climate zones"""

    print("\n" + "=" * 80)
    print("NOAA CLIMATE DATA ACCURACY TEST")
    print("Testing 8 diverse US climate zones")
    print("=" * 80)

    matcher = StationMatcher()
    fetcher = NOAADataFetcher()

    results = []

    for location in TEST_LOCATIONS:
        print(f"\n{'='*80}")
        print(f"TESTING: {location['name']} ({location['climate']})")
        print(f"{'='*80}")

        # Find nearest station
        station = matcher.find_best_station(location['lat'], location['lng'])

        if not station:
            print(f"[ERROR] No station found for {location['name']}")
            results.append({
                'location': location['name'],
                'status': 'NO STATION',
                'accuracy': None
            })
            continue

        print(f"\n[STATION] {station['name']} ({station['id']})")
        print(f"[DISTANCE] {station['distance_miles']} miles away")
        print(f"[ELEVATION] {station['elevation']} meters")

        # Fetch snow season data (Nov 2023 - Apr 2024)
        season_data = fetcher.fetch_snowfall_season(station['id'], 2023)

        if 'error' in season_data:
            print(f"[ERROR] Failed to fetch data: {season_data['error']}")
            results.append({
                'location': location['name'],
                'station': station['name'],
                'status': 'FETCH FAILED',
                'accuracy': None
            })
            continue

        # Get actual snowfall
        actual_snow = season_data.get('total_snowfall', 0)
        expected_min, expected_max = location['expected']['typical_season_snow']

        print(f"\n[RESULTS]")
        print(f"  Expected Range: {expected_min}-{expected_max}\"")
        print(f"  Actual:         {actual_snow}\"")

        # Calculate accuracy
        in_range = expected_min <= actual_snow <= expected_max

        # Allow 20% margin for climate variability
        margin = (expected_max - expected_min) * 0.2
        tolerance_min = expected_min - margin
        tolerance_max = expected_max + margin
        within_tolerance = tolerance_min <= actual_snow <= tolerance_max

        if in_range:
            status = "[OK] PERFECT - Within expected range"
            accuracy = "EXCELLENT"
        elif within_tolerance:
            status = "[OK] GOOD - Within tolerance (climate variability)"
            accuracy = "GOOD"
        else:
            diff = min(abs(actual_snow - expected_min), abs(actual_snow - expected_max))
            status = f"[!!] REVIEW - Outside range by {diff:.1f}\""
            accuracy = "NEEDS REVIEW"

        print(f"  Status:         {status}")

        # Additional metrics
        if 'days_with_snow' in season_data:
            print(f"\n[DETAILS]")
            print(f"  Snow Days:      {season_data['days_with_snow']}")
            print(f"  Max Daily Snow: {season_data.get('max_daily', 'N/A')}\"")

            if 'biggest_storms' in season_data and season_data['biggest_storms']:
                print(f"  Biggest Storm:  {season_data['biggest_storms'][0]['date']} - {season_data['biggest_storms'][0]['amount']}\"")

        results.append({
            'location': location['name'],
            'climate': location['climate'],
            'station': station['name'],
            'distance': station['distance_miles'],
            'expected': f"{expected_min}-{expected_max}\"",
            'actual': f"{actual_snow}\"",
            'status': status,
            'accuracy': accuracy
        })

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    excellent = sum(1 for r in results if r['accuracy'] == 'EXCELLENT')
    good = sum(1 for r in results if r['accuracy'] == 'GOOD')
    review = sum(1 for r in results if r['accuracy'] == 'NEEDS REVIEW')
    failed = sum(1 for r in results if r['accuracy'] is None)

    total = len(results)

    print(f"\nResults:")
    print(f"  [OK] Excellent:    {excellent}/{total} ({excellent/total*100:.1f}%)")
    print(f"  [OK] Good:         {good}/{total} ({good/total*100:.1f}%)")
    print(f"  [!!] Needs Review: {review}/{total} ({review/total*100:.1f}%)")
    print(f"  [XX] Failed:       {failed}/{total} ({failed/total*100:.1f}%)")

    print(f"\n[OVERALL] Success Rate: {(excellent + good)/total*100:.1f}%")

    # Detailed table
    print("\n" + "=" * 80)
    print("DETAILED RESULTS")
    print("=" * 80)

    for r in results:
        if r['accuracy']:
            print(f"\n{r['location']} ({r['climate']})")
            print(f"  Station:  {r['station']} ({r['distance']} mi)")
            print(f"  Expected: {r['expected']}")
            print(f"  Actual:   {r['actual']}")
            print(f"  {r['status']}")

    print("\n" + "=" * 80)

    if (excellent + good) >= total * 0.8:
        print("[SUCCESS] 80%+ accuracy achieved - NOAA integration validated!")
    elif (excellent + good) >= total * 0.6:
        print("[GOOD] 60%+ accuracy - System working well with some variability")
    else:
        print("[REVIEW] <60% accuracy - Investigation needed")

    print("=" * 80 + "\n")

    return results

if __name__ == '__main__':
    test_location_accuracy()
