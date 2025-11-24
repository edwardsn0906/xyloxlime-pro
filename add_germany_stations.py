#!/usr/bin/env python3
"""
Add Germany NOAA Stations to Database
Germany is the largest construction market in Europe with 535 NOAA stations
"""

import json

def parse_stations(filename):
    """Parse ghcnd-stations.txt for Germany stations"""
    stations = {}

    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            station_id = line[0:11].strip()

            # Only include Germany stations
            if not station_id.startswith('GM'):
                continue

            lat = float(line[12:20].strip())
            lng = float(line[21:30].strip())
            elevation = float(line[31:37].strip()) if line[31:37].strip() else 0.0

            # Extract name (positions 41-71)
            name = line[41:71].strip() if len(line) > 41 else "Unknown"

            stations[station_id] = {
                'id': station_id,
                'name': f'DE {name}',  # Use DE for Germany (Deutschland)
                'lat': lat,
                'lng': lng,
                'elevation': elevation,
                'country': 'DE',
                'data_types': {},
                'has_snow': False,
                'has_snwd': False,
                'has_temp': False,
                'has_precip': False
            }

    print(f"[PARSED] {len(stations):,} Germany stations from stations file")
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

            # Only process Germany stations
            if not station_id.startswith('GM'):
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

    print(f"[INVENTORY] Processed inventory data for {len(station_data_count):,} Germany stations")
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

    print(f"[FILTERED] {len(snow_stations):,} Germany stations with recent snow data (SNOW or SNWD after {min_year})")
    return snow_stations

def main():
    print("=" * 80)
    print("ADDING GERMANY NOAA STATIONS TO DATABASE")
    print("Germany: Largest construction market in Europe")
    print("=" * 80)
    print()

    # Parse stations
    print("[STEP 1] Parsing Germany stations...")
    stations = parse_stations('ghcnd-stations.txt')
    print()

    # Parse inventory
    print("[STEP 2] Parsing inventory data...")
    stations = parse_inventory('ghcnd-inventory.txt', stations)
    print()

    # Filter for snow-capable stations (2020+)
    print("[STEP 3] Filtering for snow-capable stations...")
    de_snow_stations = filter_snow_capable_stations(stations, min_year=2020)
    print()

    # Show sample stations
    print("=" * 80)
    print("SAMPLE GERMANY STATIONS (First 30)")
    print("=" * 80)
    print()

    for i, station in enumerate(sorted(de_snow_stations, key=lambda x: x['id'])[:30]):
        has_snow = 'YES' if station['has_snow'] else 'NO '
        has_snwd = 'YES' if station['has_snwd'] else 'NO '
        print(f"{station['id']}: {station['name'][:40]}")
        print(f"  Location: {station['lat']:.4f}, {station['lng']:.4f}")
        print(f"  SNOW: [{has_snow}]  SNWD: [{has_snwd}]")

        if 'SNWD' in station['data_types']:
            snwd_info = station['data_types']['SNWD']
            print(f"  SNWD Data: {snwd_info['start']}-{snwd_info['end']}")

        print()

    if len(de_snow_stations) > 30:
        print(f"... and {len(de_snow_stations) - 30} more stations")
        print()

    # Show major cities
    print("=" * 80)
    print("MAJOR GERMAN CITIES - STATION COVERAGE")
    print("=" * 80)
    print()

    major_cities = [
        ('Berlin', 52.5200, 13.4050),
        ('Hamburg', 53.5511, 9.9937),
        ('Munich', 48.1351, 11.5820),
        ('Cologne', 50.9375, 6.9603),
        ('Frankfurt', 50.1109, 8.6821),
        ('Stuttgart', 48.7758, 9.1829),
        ('Dusseldorf', 51.2277, 6.7735),
        ('Dortmund', 51.5136, 7.4653),
        ('Essen', 51.4556, 7.0116),
        ('Leipzig', 51.3397, 12.3731),
    ]

    def haversine(lat1, lon1, lat2, lon2):
        import math
        R = 6371
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    for city, city_lat, city_lng in major_cities:
        # Find nearest station
        nearest = None
        min_dist = float('inf')

        for station in de_snow_stations:
            dist = haversine(city_lat, city_lng, station['lat'], station['lng'])
            if dist < min_dist:
                min_dist = dist
                nearest = station

        if nearest:
            print(f"{city:15s}: {nearest['name'][:35]:<35s} ({min_dist:5.1f} km)")

    print()

    # Load existing database
    print("[STEP 4] Loading existing NOAA database...")
    with open('noaa_stations_frontend.json', 'r') as f:
        existing_stations = json.load(f)

    print(f"[LOADED] {len(existing_stations):,} existing stations")
    print()

    # Add Germany stations
    print("[STEP 5] Adding Germany stations to database...")

    # Convert to simple format matching existing database
    de_stations_simple = []
    for station in de_snow_stations:
        de_stations_simple.append({
            'id': station['id'],
            'name': station['name'],
            'lat': station['lat'],
            'lng': station['lng'],
            'elevation': station['elevation'],
            'country': 'DE'
        })

    # Combine with existing
    combined_stations = existing_stations + de_stations_simple

    print(f"[COMBINED] {len(combined_stations):,} total stations")
    print(f"  - Existing: {len(existing_stations):,}")
    print(f"  - Germany added: {len(de_stations_simple):,}")
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
        'germany_stations': len(de_stations_simple),
        'snow_capable': len(combined_stations),
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
    print("Top 10 Countries:")
    for country, count in sorted(country_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {country}: {count:,} stations")
    print()
    print("[SUCCESS] Germany NOAA stations successfully added to database!")
    print()
    print("Germany Facts:")
    print("  - Largest economy in Europe (GDP: $4.3 trillion)")
    print("  - Major construction market ($500B+ annually)")
    print("  - Population: 83+ million")
    print("  - Capital: Berlin")
    print("  - Major construction hubs: Munich, Frankfurt, Hamburg, Berlin")
    print()

if __name__ == '__main__':
    main()
