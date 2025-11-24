#!/usr/bin/env python3
"""
Add Nordic + Netherlands + Switzerland NOAA Stations
Major European construction markets with excellent NOAA coverage
"""

import json
import math

# Country configuration
COUNTRIES = {
    'SW': {'name': 'Sweden', 'code': 'SE', 'full_name': 'Sweden'},
    'NL': {'name': 'Netherlands', 'code': 'NL', 'full_name': 'Netherlands'},
    'NO': {'name': 'Norway', 'code': 'NO', 'full_name': 'Norway'},
    'CH': {'name': 'Switzerland', 'code': 'CH', 'full_name': 'Switzerland'}
}

def parse_stations(filename, country_codes):
    """Parse ghcnd-stations.txt for specified countries"""
    stations = {}

    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            station_id = line[0:11].strip()
            country_prefix = station_id[:2]

            # Only include specified countries
            if country_prefix not in country_codes:
                continue

            lat = float(line[12:20].strip())
            lng = float(line[21:30].strip())
            elevation = float(line[31:37].strip()) if line[31:37].strip() else 0.0

            # Extract name (positions 41-71)
            name = line[41:71].strip() if len(line) > 41 else "Unknown"

            country_info = COUNTRIES[country_prefix]
            stations[station_id] = {
                'id': station_id,
                'name': f'{country_info["code"]} {name}',
                'lat': lat,
                'lng': lng,
                'elevation': elevation,
                'country': country_info['code'],
                'data_types': {},
                'has_snow': False,
                'has_snwd': False,
                'has_temp': False,
                'has_precip': False
            }

    print(f"[PARSED] {len(stations):,} stations from stations file")
    return stations

def parse_inventory(filename, stations):
    """Parse ghcnd-inventory.txt to find which stations have which data"""
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            parts = line.split()
            if len(parts) < 5:
                continue

            station_id = parts[0]

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
            elif data_type == 'SNWD':
                stations[station_id]['has_snwd'] = True
            elif data_type in ['TMAX', 'TMIN', 'TAVG']:
                stations[station_id]['has_temp'] = True
            elif data_type == 'PRCP':
                stations[station_id]['has_precip'] = True

    print(f"[INVENTORY] Processed inventory data")
    return stations

def filter_snow_capable_stations(stations, min_year=2020):
    """Filter for stations with snow data (SNOW or SNWD) after min_year"""
    snow_stations = []

    for station_id, data in stations.items():
        has_recent_snow = False
        has_recent_snwd = False

        if 'SNOW' in data['data_types']:
            if data['data_types']['SNOW']['end'] >= min_year:
                has_recent_snow = True

        if 'SNWD' in data['data_types']:
            if data['data_types']['SNWD']['end'] >= min_year:
                has_recent_snwd = True

        if has_recent_snow or has_recent_snwd:
            snow_stations.append(data)

    print(f"[FILTERED] {len(snow_stations):,} stations with recent snow data (after {min_year})")
    return snow_stations

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in km"""
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def main():
    print("=" * 80)
    print("ADDING NORDIC + BENELUX + ALPINE NOAA STATIONS")
    print("Major European construction markets with excellent snow data")
    print("=" * 80)
    print()

    country_codes = list(COUNTRIES.keys())

    # Parse stations
    print("[STEP 1] Parsing stations...")
    stations = parse_stations('ghcnd-stations.txt', country_codes)
    print()

    # Parse inventory
    print("[STEP 2] Parsing inventory data...")
    stations = parse_inventory('ghcnd-inventory.txt', stations)
    print()

    # Filter for snow-capable stations
    print("[STEP 3] Filtering for snow-capable stations...")
    snow_stations = filter_snow_capable_stations(stations, min_year=2020)
    print()

    # Group by country
    by_country = {}
    for station in snow_stations:
        country = station['country']
        if country not in by_country:
            by_country[country] = []
        by_country[country].append(station)

    print("=" * 80)
    print("STATIONS BY COUNTRY")
    print("=" * 80)
    for country_code in sorted(by_country.keys()):
        country_name = next(c['full_name'] for c in COUNTRIES.values() if c['code'] == country_code)
        count = len(by_country[country_code])
        print(f"  {country_name}: {count:,} stations")
    print()

    # Show major cities coverage
    major_cities = [
        ('Stockholm', 'SE', 59.3293, 18.0686),
        ('Gothenburg', 'SE', 57.7089, 11.9746),
        ('Malmo', 'SE', 55.6050, 13.0038),
        ('Amsterdam', 'NL', 52.3676, 4.9041),
        ('Rotterdam', 'NL', 51.9225, 4.4792),
        ('The Hague', 'NL', 52.0705, 4.3007),
        ('Oslo', 'NO', 59.9139, 10.7522),
        ('Bergen', 'NO', 60.3913, 5.3221),
        ('Trondheim', 'NO', 63.4305, 10.3951),
        ('Zurich', 'CH', 47.3769, 8.5417),
        ('Geneva', 'CH', 46.2044, 6.1432),
        ('Basel', 'CH', 47.5596, 7.5886),
    ]

    print("=" * 80)
    print("MAJOR CITIES - NEAREST STATION")
    print("=" * 80)
    print()

    for city, country, city_lat, city_lng in major_cities:
        country_stations = by_country.get(country, [])

        if not country_stations:
            print(f"{city:20s} ({country}): No stations")
            continue

        # Find nearest station
        nearest = None
        min_dist = float('inf')

        for station in country_stations:
            dist = haversine(city_lat, city_lng, station['lat'], station['lng'])
            if dist < min_dist:
                min_dist = dist
                nearest = station

        if nearest:
            print(f"{city:20s} ({country}): {nearest['name'][:40]:<40s} ({min_dist:5.1f} km)")

    print()

    # Load existing database
    print("[STEP 4] Loading existing NOAA database...")
    with open('noaa_stations_frontend.json', 'r') as f:
        existing_stations = json.load(f)

    print(f"[LOADED] {len(existing_stations):,} existing stations")
    print()

    # Add new stations
    print("[STEP 5] Adding new stations to database...")

    # Convert to simple format
    new_stations_simple = []
    for station in snow_stations:
        new_stations_simple.append({
            'id': station['id'],
            'name': station['name'],
            'lat': station['lat'],
            'lng': station['lng'],
            'elevation': station['elevation'],
            'country': station['country']
        })

    # Combine with existing
    combined_stations = existing_stations + new_stations_simple

    print(f"[COMBINED] {len(combined_stations):,} total stations")
    print(f"  - Existing: {len(existing_stations):,}")
    print(f"  - New added: {len(new_stations_simple):,}")
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
        'snow_capable': len(combined_stations),
        'last_updated': '2025-11-24',
        'nordic_expansion': {
            'sweden': len([s for s in snow_stations if s['country'] == 'SE']),
            'netherlands': len([s for s in snow_stations if s['country'] == 'NL']),
            'norway': len([s for s in snow_stations if s['country'] == 'NO']),
            'switzerland': len([s for s in snow_stations if s['country'] == 'CH'])
        }
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
    print("Top 15 Countries:")
    for country, count in sorted(country_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"  {country}: {count:,} stations")
    print()
    print("[SUCCESS] Nordic + Benelux + Alpine stations added!")
    print()

    # Market info
    print("=" * 80)
    print("CONSTRUCTION MARKETS ADDED")
    print("=" * 80)
    print()
    print("Sweden:")
    print("  - GDP: $635 billion")
    print("  - Construction market: $70B+ annually")
    print("  - Major projects: Infrastructure, renewable energy")
    print()
    print("Netherlands:")
    print("  - GDP: $1.1 trillion")
    print("  - Construction market: $100B+ annually")
    print("  - Major projects: Flood defenses, logistics hubs")
    print()
    print("Norway:")
    print("  - GDP: $580 billion")
    print("  - Construction market: $50B+ annually")
    print("  - Major projects: Oil & gas, infrastructure")
    print()
    print("Switzerland:")
    print("  - GDP: $850 billion")
    print("  - Construction market: $80B+ annually")
    print("  - Major projects: Tunnels, alpine infrastructure")
    print()

if __name__ == '__main__':
    main()
