"""
NOAA GHCN Station Network Builder
Builds comprehensive US station database with snowfall capability
"""

import json
import re
from collections import defaultdict

def parse_stations(filename):
    """Parse ghcnd-stations.txt for ALL stations globally"""
    stations = {}

    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            station_id = line[0:11].strip()

            # Include ALL stations globally (not just US)
            # Station ID format: CC = Country Code, NNNNNNNN = Station Number
            # Examples: US = United States, CA = Canada, UK = United Kingdom, etc.

            try:
                lat = float(line[12:20].strip())
                lng = float(line[21:30].strip())
                elevation = float(line[31:37].strip())
                name = line[38:68].strip()

                # Extract country code from station ID (first 2 characters)
                country_code = station_id[0:2] if len(station_id) >= 2 else "XX"

                stations[station_id] = {
                    'id': station_id,
                    'name': name,
                    'lat': lat,
                    'lng': lng,
                    'elevation': elevation,
                    'country': country_code,  # Country code instead of state
                    'data_types': {},
                    'has_snow': False,
                    'has_temp': False,
                    'has_precip': False
                }
            except (ValueError, IndexError):
                continue

    return stations

def parse_inventory(filename, stations):
    """Parse ghcnd-inventory.txt to add data type info"""

    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            station_id = line[0:11].strip()

            # Only process US stations we've already loaded
            if station_id not in stations:
                continue

            try:
                data_type = line[31:35].strip()
                start_year = int(line[36:40].strip())
                end_year = int(line[41:45].strip())

                # Track data types
                stations[station_id]['data_types'][data_type] = {
                    'start': start_year,
                    'end': end_year
                }

                # Mark capabilities
                if data_type == 'SNOW' and end_year >= 2020:
                    stations[station_id]['has_snow'] = True
                if data_type in ['TMAX', 'TMIN'] and end_year >= 2020:
                    stations[station_id]['has_temp'] = True
                if data_type == 'PRCP' and end_year >= 2020:
                    stations[station_id]['has_precip'] = True

            except (ValueError, IndexError):
                continue

    return stations

def extract_state_from_name(name):
    """Extract state abbreviation from station name"""
    # Common state abbreviations at end of names
    state_pattern = r'\b([A-Z]{2})\b'
    matches = re.findall(state_pattern, name)

    # US state codes (not exhaustive, but covers most)
    valid_states = {
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    }

    for match in reversed(matches):  # Check from end of name
        if match in valid_states:
            return match

    return 'US'

def generate_statistics(stations):
    """Generate coverage statistics"""
    stats = {
        'total_stations': len(stations),
        'snow_capable': 0,
        'full_capability': 0,
        'by_country': defaultdict(lambda: {'total': 0, 'snow': 0}),
        'recent_data': 0
    }

    for station_id, station in stations.items():
        # Use country code from station ID
        country = station['country']

        stats['by_country'][country]['total'] += 1

        if station['has_snow']:
            stats['snow_capable'] += 1
            stats['by_country'][country]['snow'] += 1

        if station['has_snow'] and station['has_temp'] and station['has_precip']:
            stats['full_capability'] += 1

        # Check if has recent data (2024+)
        if any(dt.get('end', 0) >= 2024 for dt in station['data_types'].values()):
            stats['recent_data'] += 1

    return dict(stats)

def main():
    print(">>> Building NOAA GHCN Station Network...")
    print("=" * 60)

    # Step 1: Parse stations
    print("\n[*] Step 1: Parsing GLOBAL stations from ghcnd-stations.txt...")
    stations = parse_stations('ghcnd-stations.txt')
    print(f"    [OK] Found {len(stations)} stations worldwide")

    # Step 2: Parse inventory
    print("\n[*] Step 2: Analyzing data capabilities from ghcnd-inventory.txt...")
    stations = parse_inventory('ghcnd-inventory.txt', stations)

    # Step 3: Filter for snow-capable stations
    print("\n[*] Step 3: Filtering for snowfall-capable stations...")
    snow_stations = {
        sid: sdata for sid, sdata in stations.items()
        if sdata['has_snow']
    }
    print(f"    [OK] Found {len(snow_stations)} snow-capable stations globally")

    # Step 4: Generate statistics
    print("\n[*] Step 4: Generating coverage statistics...")
    stats = generate_statistics(snow_stations)

    # Display statistics
    print("\n" + "=" * 60)
    print("GLOBAL COVERAGE STATISTICS")
    print("=" * 60)
    print(f"Total Stations: {stats['total_stations']:,}")
    print(f"Snow-Capable: {stats['snow_capable']:,}")
    print(f"Full Capability (Temp+Precip+Snow): {stats['full_capability']:,}")
    print(f"With Recent Data (2024+): {stats['recent_data']:,}")

    print("\nTOP 20 COUNTRIES BY SNOW STATION COUNT:")
    print("-" * 60)

    # Sort countries by snow station count
    sorted_countries = sorted(
        stats['by_country'].items(),
        key=lambda x: x[1]['snow'],
        reverse=True
    )

    for country, counts in sorted_countries[:20]:  # Top 20
        print(f"  {country:3s}: {counts['snow']:4d} snow stations (of {counts['total']:4d} total)")

    # Step 5: Save databases
    print("\n[*] Step 5: Saving station databases...")

    # Save full snow network
    with open('noaa_snow_stations.json', 'w') as f:
        json.dump(list(snow_stations.values()), f, indent=2)
    print(f"    [OK] Saved noaa_snow_stations.json ({len(snow_stations)} stations)")

    # Save statistics
    with open('noaa_network_stats.json', 'w') as f:
        # Convert defaultdict to regular dict for JSON
        stats_copy = stats.copy()
        stats_copy['by_country'] = dict(stats_copy['by_country'])
        json.dump(stats_copy, f, indent=2)
    print(f"    [OK] Saved noaa_network_stats.json")

    # Create optimized lookup database (grouped by country)
    print("\n[*] Step 6: Creating country-grouped lookup database...")
    by_country = defaultdict(list)
    for station in snow_stations.values():
        by_country[station['country']].append(station)

    with open('noaa_stations_by_country.json', 'w') as f:
        json.dump(dict(by_country), f, indent=2)
    print(f"    [OK] Saved noaa_stations_by_country.json")

    print("\n" + "=" * 60)
    print("[SUCCESS] GLOBAL NOAA STATION NETWORK BUILD COMPLETE!")
    print("=" * 60)
    print(f"\nGenerated Files:")
    print(f"  - noaa_snow_stations.json - All {len(snow_stations)} snow stations worldwide")
    print(f"  - noaa_stations_by_country.json - Grouped by country for fast lookup")
    print(f"  - noaa_network_stats.json - Global coverage statistics")

    return snow_stations, stats

if __name__ == '__main__':
    stations, stats = main()
