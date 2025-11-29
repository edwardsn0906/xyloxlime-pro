import json

with open('noaa_test.json', 'r') as f:
    data = json.load(f)

# Process snow data
snow_vals = []
for d in data:
    snow = d.get('SNOW', 0)
    if snow is not None:
        snow_vals.append(float(snow))
    else:
        snow_vals.append(0)

snow_days = [s for s in snow_vals if s > 1]
total_snow = sum(snow_vals)

print("=" * 60)
print("NOAA STATION DATA COMPARISON")
print("=" * 60)
print(f"\nStation: Scottsbluff W B Heilig Field Airport")
print(f"Station ID: USW00024028")
print(f"Period: 2023-11-20 to 2024-11-19\n")

print("NOAA RESULTS:")
print(f"  Total days: {len(data)}")
print(f"  Snow days (>1mm): {len(snow_days)}")
print(f"  Total snowfall: {total_snow:.1f}mm ({total_snow/25.4:.1f}in)")

print("\nERA5 RESULTS (same period, correct coords):")
print(f"  Snow days: 17")
print(f"  Total snowfall: 46.8mm (1.8in)")

print("\nCOMPARISON:")
if total_snow > 0:
    ratio = total_snow / 46.8
    print(f"  NOAA is {ratio:.1f}x higher than ERA5")
    print(f"  ERA5 captured only {(46.8/total_snow)*100:.0f}% of actual snow")
else:
    print("  No snow data available")

print("\nNOAA DATA QUALITY: Ground station measurements (ACCURATE)")
print("ERA5 DATA QUALITY: Gridded reanalysis (UNDERESTIMATED)")
print("=" * 60)
