#!/usr/bin/env python3
"""
Add Final Countries with Significant NOAA Coverage
Kazakhstan, Turkey, Argentina, Italy, Finland, Poland
"""

import json

# Add more major markets
COUNTRIES = {
    'KZ': {'name': 'Kazakhstan', 'code': 'KZ'},
    'TU': {'name': 'Turkey', 'code': 'TR'},
    'AR': {'name': 'Argentina', 'code': 'AR'},
    'IT': {'name': 'Italy', 'code': 'IT'},
    'FI': {'name': 'Finland', 'code': 'FI'},
    'PL': {'name': 'Poland', 'code': 'PL'},
    'AU': {'name': 'Austria', 'code': 'AT'},
    'EZ': {'name': 'Czechia', 'code': 'CZ'},
}

def main():
    print("=" * 80)
    print("ADDING FINAL COUNTRIES - COMPREHENSIVE GLOBAL COVERAGE")
    print("=" * 80)
    print()

    # Parse stations
    stations = {}
    with open('ghcnd-stations.txt', 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            station_id = line[0:11].strip()
            prefix = station_id[:2]

            if prefix not in COUNTRIES:
                continue

            lat = float(line[12:20].strip())
            lng = float(line[21:30].strip())
            elevation = float(line[31:37].strip()) if line[31:37].strip() else 0.0
            name = line[41:71].strip() if len(line) > 41 else "Unknown"

            stations[station_id] = {
                'id': station_id,
                'name': f'{COUNTRIES[prefix]["code"]} {name}',
                'lat': lat,
                'lng': lng,
                'elevation': elevation,
                'country': COUNTRIES[prefix]['code'],
                'has_snow': False
            }

    print(f"[PARSED] {len(stations):,} stations")

    # Parse inventory for snow data
    with open('ghcnd-inventory.txt', 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            parts = line.split()
            if len(parts) < 5:
                continue

            station_id = parts[0]
            if station_id not in stations:
                continue

            data_type = parts[3]
            end_year = int(parts[5])

            if data_type in ['SNOW', 'SNWD'] and end_year >= 2020:
                stations[station_id]['has_snow'] = True

    # Filter for snow stations
    snow_stations = [s for s in stations.values() if s['has_snow']]
    print(f"[FILTERED] {len(snow_stations):,} with recent snow data")

    # Group by country
    by_country = {}
    for s in snow_stations:
        by_country.setdefault(s['country'], []).append(s)

    print("\nSTATIONS BY COUNTRY:")
    for country in sorted(by_country.keys()):
        print(f"  {country}: {len(by_country[country]):,}")

    # Load existing + add new
    with open('noaa_stations_frontend.json', 'r') as f:
        existing = json.load(f)

    new_simple = [{
        'id': s['id'],
        'name': s['name'],
        'lat': s['lat'],
        'lng': s['lng'],
        'elevation': s['elevation'],
        'country': s['country']
    } for s in snow_stations]

    combined = existing + new_simple

    # Save
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

    print(f"\n[SUCCESS] Database: {len(existing):,} -> {len(combined):,} (+{len(new_simple):,})")
    print(f"\nTOP 25 COUNTRIES:")
    for country, count in sorted(country_counts.items(), key=lambda x: -x[1])[:25]:
        print(f"  {country}: {count:,}")

if __name__ == '__main__':
    main()
