import json

# Load NOAA stations
with open('noaa_stations_frontend.json', 'r') as f:
    stations = json.load(f)

# Cascade County, Montana coordinates (approximate center: Great Falls, MT)
cascade_lat = 47.5053
cascade_lng = -111.3008

print(f"Total stations in database: {len(stations)}")
print(f"\nSearching for stations near Cascade County, MT ({cascade_lat}, {cascade_lng})")
print("=" * 80)

# Calculate distance for all US stations
def haversine(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, sqrt, atan2
    R = 6371  # Earth radius in km

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))

    return R * c

# Find nearby stations
us_stations = [s for s in stations if s.get('country') == 'US']
print(f"US stations: {len(us_stations)}")

nearby = []
for station in us_stations:
    distance = haversine(cascade_lat, cascade_lng, station['lat'], station['lng'])
    if distance <= 300:  # Within 300km
        nearby.append({
            'name': station['name'],
            'id': station['id'],
            'distance': round(distance, 1),
            'lat': station['lat'],
            'lng': station['lng']
        })

nearby.sort(key=lambda x: x['distance'])

print(f"\nStations within 300km of Cascade County: {len(nearby)}")
print("\nClosest 10 stations:")
print("-" * 80)
for i, s in enumerate(nearby[:10], 1):
    print(f"{i}. {s['name']:30s} {s['id']:15s} {s['distance']:6.1f}km away")

# Montana specific search
montana_stations = [s for s in stations if 'MT ' in s.get('name', '')]
print(f"\n\nAll Montana stations in database: {len(montana_stations)}")
if montana_stations:
    print("\nSample Montana stations:")
    for s in montana_stations[:10]:
        dist = haversine(cascade_lat, cascade_lng, s['lat'], s['lng'])
        print(f"  {s['name']:30s} {s['id']:15s} {dist:6.1f}km away")
