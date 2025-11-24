#!/usr/bin/env python3
"""
Add UK NOAA Stations to Database
Adds UK stations with SNWD (snow depth) data to the NOAA network
"""

import json

def parse_stations(filename):
    """Parse ghcnd-stations.txt for UK stations"""
    stations = {}

    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            station_id = line[0:11].strip()

            # Only include UK stations
            if not station_id.startswith('UK'):
                continue

            lat = float(line[12:20].strip())
            lng = float(line[21:30].strip())
            elevation = float(line[31:37].strip()) if line[31:37].strip() else 0.0

            # Extract name (positions 41-71)
            name = line[41:71].strip() if len(line) > 41 else "Unknown"

            stations[station_id] = {
                'id': station_id,
                'name': f'UK {name}',
                'lat': lat,
                'lng': lng,
                'elevation': elevation,
                'country': 'UK',
                'data_types': {},
                'has_snow': False,
                'has_snwd': False,
                'has_temp': False,
                'has_precip': False
            }

    print(f"[PARSED] {len(stations):,} UK stations from stations file")
    return stations

def parse_inventory(filename, stations):
    """Parse ghcnd-inventory.txt to find which stations have which data"""
    station_data_count = {}

    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            parts = line.split()
            if len(parts) < 5:
                continue

            station_id = parts[0]

            # Only process UK stations
            if not station_id.startswith('UK'):
                continue

            if station_id not in stations:
                continue

            data_type = parts[3]
            start_year = int(parts[4])
            end_year = int(parts[5])

            # Track data types
            stations[station_id]['data_types'][data_type] = {
                'start': start_year,
                'end': end_year
            }

            # Mark what types of data this station has
            if data_type == 'SNOW':
                stations[station_id]['has_snow'] = True
            elif data_type == 'SNWD':  # Snow depth
                stations[station_id]['has_snwd'] = True
            elif data_type in ['TMAX', 'TMIN', 'TAVG']:
                stations[station_id]['has_temp'] = True
            elif data_type == 'PRCP':
                stations[station_id]['has_precip'] = True

            # Count stations by data type
            if station_id not in station_data_count:
                station_data_count[station_id] = set()
            station_data_count[station_id].add(data_type)

    print(f"[INVENTORY] Processed inventory data for {len(station_data_count):,} UK stations")
    return stations

def filter_snow_capable_stations(stations, min_year=2020):
    """Filter for stations with snow data (SNOW or SNWD) after min_year"""
    snow_stations = []

    for station_id, data in stations.items():
        # Check if station has SNOW or SNWD data
        has_recent_snow = False
        has_recent_snwd = False

        if 'SNOW' in data['data_types']:
            if data['data_types']['SNOW']['end'] >= min_year:
                has_recent_snow = True

        if 'SNWD' in data['data_types']:
            if data['data_types']['SNWD']['end'] >= min_year:
                has_recent_snwd = True

        # Include if has recent SNOW or SNWD data
        if has_recent_snow or has_recent_snwd:
            snow_stations.append(data)

    print(f"[FILTERED] {len(snow_stations):,} UK stations with recent snow data (SNOW or SNWD after {min_year})")
    return snow_stations

def main():
    print("=" * 80)
    print("ADDING UK NOAA STATIONS TO DATABASE")
    print("=" * 80)
    print()

    # Parse stations
    print("[STEP 1] Parsing UK stations...")
    stations = parse_stations('ghcnd-stations.txt')
    print()

    # Parse inventory
    print("[STEP 2] Parsing inventory data...")
    stations = parse_inventory('ghcnd-inventory.txt', stations)
    print()

    # Filter for snow-capable stations (2020+)
    print("[STEP 3] Filtering for snow-capable stations...")
    uk_snow_stations = filter_snow_capable_stations(stations, min_year=2020)
    print()

    # Show station details
    print("=" * 80)
    print("UK STATIONS FOUND")
    print("=" * 80)
    print()

    for station in sorted(uk_snow_stations, key=lambda x: x['id']):
        has_snow = 'YES' if station['has_snow'] else 'NO '
        has_snwd = 'YES' if station['has_snwd'] else 'NO '
        print(f"{station['id']}: {station['name']}")
        print(f"  Location: {station['lat']:.4f}, {station['lng']:.4f}")
        print(f"  SNOW: [{has_snow}]  SNWD: [{has_snwd}]")

        if 'SNWD' in station['data_types']:
            snwd_info = station['data_types']['SNWD']
            print(f"  SNWD Data: {snwd_info['start']}-{snwd_info['end']}")

        print()

    # Load existing database
    print("[STEP 4] Loading existing NOAA database...")
    with open('noaa_stations_frontend.json', 'r') as f:
        existing_stations = json.load(f)

    print(f"[LOADED] {len(existing_stations):,} existing stations")
    print()

    # Add UK stations
    print("[STEP 5] Adding UK stations to database...")

    # Convert to simple format matching existing database
    uk_stations_simple = []
    for station in uk_snow_stations:
        uk_stations_simple.append({
            'id': station['id'],
            'name': station['name'],
            'lat': station['lat'],
            'lng': station['lng'],
            'elevation': station['elevation'],
            'country': 'UK'
        })

    # Combine with existing
    combined_stations = existing_stations + uk_stations_simple

    print(f"[COMBINED] {len(combined_stations):,} total stations")
    print(f"  - Existing: {len(existing_stations):,}")
    print(f"  - UK added: {len(uk_stations_simple):,}")
    print()

    # Save updated database
    print("[STEP 6] Saving updated database...")
    with open('noaa_stations_frontend.json', 'w') as f:
        json.dump(combined_stations, f, indent=2)

    print(f"[SAVED] noaa_stations_frontend.json")
    print()

    # Update stats
    print("[STEP 7] Updating network stats...")

    # Count by country
    country_counts = {}
    for station in combined_stations:
        country = station.get('country', station.get('id', '')[:2])
        country_counts[country] = country_counts.get(country, 0) + 1

    stats = {
        'total_stations': len(combined_stations),
        'by_country': country_counts,
        'uk_stations': len(uk_stations_simple),
        'snow_capable': len(combined_stations),  # All in database are snow-capable
        'last_updated': '2025-11-24'
    }

    with open('noaa_network_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

    print(f"[SAVED] noaa_network_stats.json")
    print()

    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Stations: {len(combined_stations):,}")
    print()
    print("By Country:")
    for country, count in sorted(country_counts.items(), key=lambda x: -x[1]):
        print(f"  {country}: {count:,} stations")
    print()
    print("[SUCCESS] UK NOAA stations successfully added to database!")
    print()

if __name__ == '__main__':
    main()
