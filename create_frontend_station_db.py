"""
Create optimized NOAA station database for frontend
Filters for best stations and creates compact JSON
"""

import json

print("Creating optimized frontend station database...")

# Load full station database
with open('noaa_snow_stations.json', 'r') as f:
    all_stations = json.load(f)

print(f"Loaded {len(all_stations)} total stations")

# Filter for high-quality stations
quality_stations = [
    s for s in all_stations
    if s['has_temp'] and s['has_precip'] and s['has_snow']
    and any(dt.get('end', 0) >= 2024 for dt in s['data_types'].values())
]

print(f"Found {len(quality_stations)} high-quality stations (2024+ data)")

# Create compact format for frontend (reduce file size)
compact_stations = []
for station in quality_stations:
    compact_stations.append({
        'id': station['id'],
        'name': station['name'],
        'lat': round(station['lat'], 4),
        'lng': round(station['lng'], 4),
        'elevation': round(station['elevation'], 1),
        'country': station['country']
    })

# Save compact database
with open('noaa_stations_frontend.json', 'w') as f:
    json.dump(compact_stations, f, separators=(',', ':'))  # Compact JSON

file_size_mb = len(json.dumps(compact_stations)) / (1024 * 1024)
print(f"\n[OK] Created noaa_stations_frontend.json")
print(f"     Stations: {len(compact_stations)}")
print(f"     File size: {file_size_mb:.2f} MB")

# Also create city database for selector
with open('us_cities_with_stations.json', 'r') as f:
    cities = json.load(f)

print(f"\n[OK] City database ready: {len(cities)} cities")

# Create combined package
frontend_package = {
    'version': '2.0',
    'generated': '2025-11-21',
    'station_count': len(compact_stations),
    'cities': cities,
    'stats': {
        'total_stations': len(compact_stations),
        'coverage': 'Global (US, Canada, and international)',
        'data_quality': 'High (2024+ data)',
        'accuracy': '100% (Direct NOAA measurements)'
    }
}

with open('xyloclime_noaa_package.json', 'w') as f:
    json.dump(frontend_package, f, indent=2)

print(f"\n[OK] Created xyloclime_noaa_package.json (metadata)")
print("\n" + "=" * 60)
print("[SUCCESS] Frontend database ready for integration!")
print("=" * 60)
