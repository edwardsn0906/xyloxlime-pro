#!/usr/bin/env python3
"""
Add More Construction Market Countries
France, Spain, Japan, Russia - Major construction markets with NOAA coverage
"""

import json

COUNTRIES = {
    'FR': {'name': 'France', 'code': 'FR', 'full_name': 'France'},
    'SP': {'name': 'Spain', 'code': 'ES', 'full_name': 'Spain'},
    'JA': {'name': 'Japan', 'code': 'JP', 'full_name': 'Japan'},
    'RS': {'name': 'Russia', 'code': 'RU', 'full_name': 'Russia'}
}

def parse_stations(filename, country_codes):
    """Parse ghcnd-stations.txt for specified countries"""
    stations = {}

    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            station_id = line[0:11].strip()
            country_prefix = station_id[:2]

            if country_prefix not in country_codes:
                continue

            lat = float(line[12:20].strip())
            lng = float(line[21:30].strip())
            elevation = float(line[31:37].strip()) if line[31:37].strip() else 0.0
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
                'has_snwd': False
            }

    print(f"[PARSED] {len(stations):,} stations")
    return stations

def parse_inventory(filename, stations):
    """Parse inventory"""
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            parts = line.split()
            if len(parts) < 5:
                continue

            station_id = parts[0]
            if station_id not in stations:
                continue

            data_type = parts[3]
            end_year = int(parts[5])

            stations[station_id]['data_types'][data_type] = end_year

            if data_type == 'SNOW' and end_year >= 2020:
                stations[station_id]['has_snow'] = True
            elif data_type == 'SNWD' and end_year >= 2020:
                stations[station_id]['has_snwd'] = True

    return stations

def filter_snow_stations(stations):
    """Filter for stations with recent snow data"""
    return [s for s in stations.values() if s['has_snow'] or s['has_snwd']]

def main():
    print("=" * 80)
    print("ADDING MORE CONSTRUCTION MARKETS")
    print("France, Spain, Japan, Russia")
    print("=" * 80)
    print()

    country_codes = list(COUNTRIES.keys())

    print("[STEP 1] Parsing stations...")
    stations = parse_stations('ghcnd-stations.txt', country_codes)
    print()

    print("[STEP 2] Parsing inventory...")
    stations = parse_inventory('ghcnd-inventory.txt', stations)
    print()

    print("[STEP 3] Filtering for snow stations...")
    snow_stations = filter_snow_stations(stations)
    print(f"[FILTERED] {len(snow_stations):,} stations with recent snow data")
    print()

    # Group by country
    by_country = {}
    for station in snow_stations:
        country = station['country']
        by_country.setdefault(country, []).append(station)

    print("STATIONS BY COUNTRY:")
    for country, stations_list in sorted(by_country.items()):
        print(f"  {country}: {len(stations_list):,} stations")
    print()

    # Load existing
    print("[STEP 4] Loading existing database...")
    with open('noaa_stations_frontend.json', 'r') as f:
        existing = json.load(f)
    print(f"[LOADED] {len(existing):,} existing stations")
    print()

    # Add new
    print("[STEP 5] Adding new stations...")
    new_simple = [{
        'id': s['id'],
        'name': s['name'],
        'lat': s['lat'],
        'lng': s['lng'],
        'elevation': s['elevation'],
        'country': s['country']
    } for s in snow_stations]

    combined = existing + new_simple
    print(f"[COMBINED] {len(combined):,} total ({len(new_simple):,} added)")
    print()

    # Save
    print("[STEP 6] Saving...")
    with open('noaa_stations_frontend.json', 'w') as f:
        json.dump(combined, f, indent=2)

    # Stats
    country_counts = {}
    for s in combined:
        country = s.get('country', s.get('id', '')[:2])
        country_counts[country] = country_counts.get(country, 0) + 1

    with open('noaa_network_stats.json', 'w') as f:
        json.dump({
            'total_stations': len(combined),
            'by_country': country_counts,
            'last_updated': '2025-11-24'
        }, f, indent=2)

    print(f"[SAVED] Database updated")
    print()

    print("=" * 80)
    print(f"TOTAL STATIONS: {len(combined):,}")
    print("=" * 80)
    print("Top 20 Countries:")
    for country, count in sorted(country_counts.items(), key=lambda x: -x[1])[:20]:
        print(f"  {country}: {count:,}")
    print()

if __name__ == '__main__':
    main()
