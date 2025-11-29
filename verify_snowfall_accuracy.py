"""
Snowfall Accuracy Verification
Tests NOAA data against known major snowstorms
"""

from noaa_data_fetcher import NOAADataFetcher
from station_matcher import StationMatcher

# Known major snowstorms for verification (using recent events with reliable data)
KNOWN_SNOWSTORMS = [
    {
        'name': 'Winter Storm Elliott (Dec 2022)',
        'location': 'Buffalo, NY',
        'lat': 42.8864,
        'lng': -78.8784,
        'date_range': ('2022-12-23', '2022-12-26'),
        'expected_snow': '50.0',  # Buffalo got hammered
        'tolerance': 5.0
    },
    {
        'name': 'Colorado Bomb Cyclone (March 2021)',
        'location': 'Denver, CO',
        'lat': 39.7392,
        'lng': -104.9903,
        'date_range': ('2021-03-13', '2021-03-15'),
        'expected_snow': '27.1',
        'tolerance': 3.0
    },
    {
        'name': 'Northeast Winter Storm (Feb 2021)',
        'location': 'New York, NY',
        'lat': 40.7128,
        'lng': -74.0060,
        'date_range': ('2021-02-01', '2021-02-02'),
        'expected_snow': '17.2',
        'tolerance': 2.0
    },
    {
        'name': 'Pacific Northwest Snow (Feb 2019)',
        'location': 'Seattle, WA',
        'lat': 47.6062,
        'lng': -122.3321,
        'date_range': ('2019-02-08', '2019-02-10'),
        'expected_snow': '8.9',
        'tolerance': 2.0
    },
    {
        'name': 'Minneapolis Blizzard (April 2018)',
        'location': 'Minneapolis, MN',
        'lat': 44.9778,
        'lng': -93.2650,
        'date_range': ('2018-04-14', '2018-04-15'),
        'expected_snow': '13.0',
        'tolerance': 2.0
    }
]


def verify_snowstorm_accuracy():
    """Verify NOAA data against known major snowstorms"""

    print("\n" + "=" * 80)
    print("SNOWFALL ACCURACY VERIFICATION TEST")
    print("Testing against known major snowstorms")
    print("=" * 80)

    matcher = StationMatcher()
    fetcher = NOAADataFetcher()

    results = []

    for storm in KNOWN_SNOWSTORMS:
        print(f"\n{storm['name']}")
        print(f"Location: {storm['location']}")
        print(f"Date: {storm['date_range'][0]} to {storm['date_range'][1]}")
        print(f"Expected: {storm['expected_snow']}\" +/- {storm['tolerance']}\"")
        print("-" * 80)

        # Find nearest station
        nearest = matcher.find_best_station(storm['lat'], storm['lng'])
        print(f"Station: {nearest['name']} ({nearest['id']})")
        print(f"Distance: {nearest['distance_miles']} miles")

        # Fetch data
        data = fetcher.fetch_daily_data(
            nearest['id'],
            storm['date_range'][0],
            storm['date_range'][1],
            data_types=['SNOW', 'SNWD', 'TMAX', 'TMIN']
        )

        if not data['records']:
            print("[ERROR] No data available for this period")
            results.append({
                'storm': storm['name'],
                'status': 'NO DATA',
                'expected': storm['expected_snow'],
                'actual': None
            })
            continue

        # Calculate total snow
        total_snow = 0
        daily_breakdown = []

        for record in data['records']:
            if 'SNOW' in record and record['SNOW'] and record['SNOW'] != '':
                snow_amt = float(record['SNOW'])
                total_snow += snow_amt
                if snow_amt > 0:
                    daily_breakdown.append({
                        'date': record['DATE'],
                        'snow': snow_amt,
                        'temp_max': record.get('TMAX', 'N/A'),
                        'temp_min': record.get('TMIN', 'N/A')
                    })

        # Show daily breakdown
        print(f"\nDaily Breakdown:")
        for day in daily_breakdown:
            print(f"  {day['date']}: {day['snow']}\" (Temp: {day['temp_max']}deg/{day['temp_min']}degF)")

        # Calculate accuracy
        expected = float(storm['expected_snow'])
        difference = abs(total_snow - expected)
        within_tolerance = difference <= storm['tolerance']

        print(f"\n[RESULTS]")
        print(f"  Expected: {expected}\"")
        print(f"  Actual:   {total_snow}\"")
        print(f"  Diff:     {difference:.1f}\"")
        print(f"  Status:   {'PASS' if within_tolerance else 'FAIL'}")

        if within_tolerance:
            print(f"  [OK] Within {storm['tolerance']}\" tolerance!")
        else:
            print(f"  [WARNING] Outside tolerance range")

        results.append({
            'storm': storm['name'],
            'location': storm['location'],
            'expected': expected,
            'actual': total_snow,
            'difference': difference,
            'tolerance': storm['tolerance'],
            'status': 'PASS' if within_tolerance else 'FAIL',
            'station': nearest['name']
        })

    # Summary
    print("\n" + "=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)

    passed = sum(1 for r in results if r['status'] == 'PASS')
    failed = sum(1 for r in results if r['status'] == 'FAIL')
    no_data = sum(1 for r in results if r['status'] == 'NO DATA')

    print(f"\nResults: {passed} PASS / {failed} FAIL / {no_data} NO DATA")
    print(f"Success Rate: {(passed / len(results) * 100):.1f}%")

    print("\nDetailed Results:")
    for r in results:
        status_icon = {
            'PASS': '[OK]',
            'FAIL': '[!!]',
            'NO DATA': '[--]'
        }[r['status']]

        if r['actual'] is not None:
            print(f"  {status_icon} {r['storm']}")
            print(f"       Expected: {r['expected']}\" | Actual: {r['actual']}\" | Diff: {r['difference']:.1f}\"")
        else:
            print(f"  {status_icon} {r['storm']} - No data available")

    print("\n" + "=" * 80)

    if passed == len(results):
        print("[SUCCESS] All snowstorm data verified accurately!")
        print("NOAA direct access is providing accurate snowfall measurements.")
    elif passed >= len(results) * 0.8:
        print("[GOOD] 80%+ verification success rate.")
        print("NOAA data is highly reliable for snowfall tracking.")
    else:
        print("[REVIEW] Some discrepancies found.")
        print("This may be due to station location differences or data gaps.")

    print("=" * 80)

    return results


def test_recent_season_comparison():
    """Compare recent seasons across multiple cities"""

    print("\n" + "=" * 80)
    print("RECENT SEASON COMPARISON (2023-2024)")
    print("=" * 80)

    cities = [
        {'name': 'Boston, MA', 'lat': 42.3601, 'lng': -71.0589},
        {'name': 'Buffalo, NY', 'lat': 42.8864, 'lng': -78.8784},
        {'name': 'Minneapolis, MN', 'lat': 44.9778, 'lng': -93.2650},
        {'name': 'Denver, CO', 'lat': 39.7392, 'lng': -104.9903},
        {'name': 'Chicago, IL', 'lat': 41.8781, 'lng': -87.6298},
    ]

    matcher = StationMatcher()
    fetcher = NOAADataFetcher()

    for city in cities:
        print(f"\n{city['name']}:")
        print("-" * 80)

        # Find station
        station = matcher.find_best_station(city['lat'], city['lng'])

        # Fetch season data
        season_data = fetcher.fetch_snowfall_season(station['id'], 2023)

        print(f"Station: {station['name']} ({station['distance_miles']} mi away)")
        print(f"Total Snowfall: {season_data.get('total_snowfall', 'N/A')}\"")
        print(f"Snow Days: {season_data.get('days_with_snow', 'N/A')}")

        if 'biggest_storms' in season_data and season_data['biggest_storms']:
            print(f"Top Storm: {season_data['biggest_storms'][0]['date']} - "
                  f"{season_data['biggest_storms'][0]['amount']}\"")

    print("\n" + "=" * 80)


if __name__ == '__main__':
    # Verify known snowstorms
    verify_snowstorm_accuracy()

    # Compare recent seasons
    test_recent_season_comparison()
