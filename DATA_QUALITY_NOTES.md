# 📊 DATA QUALITY & ACCURACY NOTES

**Last Updated:** November 20, 2025
**Data Source:** Open-Meteo ERA5 Reanalysis

---

## 🌐 DATA SOURCE OVERVIEW

Xyloclime uses **Open-Meteo's ERA5 historical weather data**, which provides:
- **Global coverage** with consistent gridded data
- **Historical records** from 1940-present
- **Free and open access** for weather analysis
- **Updated regularly** from ECMWF's ERA5 reanalysis

### What is ERA5?
ERA5 is a **climate reanalysis** dataset that combines:
- Weather station observations
- Satellite data
- Weather model simulations
- Advanced data assimilation techniques

This produces a consistent global weather dataset, but with some regional limitations.

---

## ⚠️ KNOWN DATA QUALITY LIMITATIONS

### 1. **SNOWFALL SIGNIFICANTLY UNDERESTIMATED** ❌

**Affected Regions:** Great Plains, Mountain West, Northern climates

**Issue:** ERA5 snowfall data can show dramatically lower values than ground station measurements.

**Example - Scottsbluff, Nebraska:**
- **ERA5 Data:** ~2.7 inches/year average
- **NOAA Station Data:** 42.5 inches/year (1991-2020)
- **Discrepancy:** ERA5 shows only **6% of actual snowfall**

**Root Cause:**
- ERA5 uses gridded interpolation (30km resolution)
- Ground stations measure point-specific accumulation
- Snowfall is highly variable and harder to model than temperature
- Reanalysis models may underestimate snow in complex terrain

**Impact on Xyloclime:**
- **Snow day counts may be LOW** (days with >1mm snow)
- **Total snowfall accumulation may be VERY LOW**
- **Heavy snow days may be MISSED** (>10mm threshold)
- **Winter risk assessments may underestimate snow impacts**

**What This Means for Your Projects:**
- If your project is in snow-prone regions, **expect higher actual snowfall** than shown
- Use Xyloclime's snowfall estimates as a **conservative lower bound**
- Cross-reference with local NOAA station data for critical projects
- Consider adding extra winter weather contingency for snow-prone areas

---

### 2. **TEMPERATURE DATA: GENERALLY ACCURATE** ✅

**Performance:** Temperature measurements (max, min) align well with station data.

**Example - Scottsbluff, Nebraska:**
- **Extreme heat days (≥100°F):** ERA5 shows 5-6 days vs NOAA 6 days ✓
- **Max temperatures:** ERA5 matches NOAA within 1-2°F typical variance
- **Work-stopping cold:** Reliable for construction planning

**Confidence Level:** **HIGH** - Use temperature-based metrics with confidence.

---

### 3. **PRECIPITATION (RAIN): GENERALLY ACCURATE** ✅

**Performance:** Rainfall measurements typically align with regional patterns.

**Confidence Level:** **MODERATE TO HIGH** - Suitable for planning purposes.

**Notes:**
- Heavy rain thresholds (≥10mm) are reliable indicators
- Localized thunderstorms may not be captured precisely
- Overall monthly/seasonal patterns are accurate

---

### 4. **WIND SPEED: GENERALLY ACCURATE** ✅

**Performance:** Wind speed data matches regional climate patterns.

**Confidence Level:** **MODERATE TO HIGH** - Reliable for general planning.

**Notes:**
- High wind thresholds (≥30 km/h) are useful indicators
- Localized gusts may not be captured
- Geographic wind patterns (e.g., Great Plains winds) are well-represented

---

## 🎯 DATA ACCURACY BY METRIC

| Metric | Accuracy | Confidence | Notes |
|--------|----------|------------|-------|
| **Maximum Temperature** | High | ✅ HIGH | Matches station data within 1-2°F |
| **Minimum Temperature** | High | ✅ HIGH | Reliable for freeze/cold analysis |
| **Work-Stopping Cold (≤-5°C)** | High | ✅ HIGH | Accurate for construction planning |
| **Extreme Heat Days (≥110°F)** | High | ✅ HIGH | Accurate count for safety planning |
| **Heavy Rain Days (≥10mm)** | Moderate-High | ✅ MODERATE | Good indicator, may miss isolated storms |
| **Rain Accumulation** | Moderate-High | ✅ MODERATE | Suitable for general planning |
| **High Wind Days (≥30 km/h)** | Moderate | ⚠️ MODERATE | Good regional indicator, misses gusts |
| **Snow Days (>1mm)** | Low | ❌ LOW | SEVERELY UNDERESTIMATED in many regions |
| **Heavy Snow Days (>10mm)** | Very Low | ❌ VERY LOW | May miss most heavy snow events |
| **Total Snowfall** | Very Low | ❌ VERY LOW | Can be 90%+ underestimated |

---

## 📍 COORDINATE ACCURACY MATTERS

**Always verify location coordinates** when analyzing a project:

✅ **Correct:** Scottsbluff, NE = 41.867°N, 103.667°W
❌ **Wrong:** Using 41.134°N puts you ~50 miles south with different climate

**Tips:**
- Use Google Maps to verify exact project coordinates
- Even small coordinate errors (0.5-1°) can affect results
- Microclimate variations exist within cities
- Airport weather stations may differ from downtown locations

---

## 🛠️ BEST PRACTICES FOR USING XYLOCLIME

### For Snow-Prone Regions (Great Plains, Mountain West, Northern states):

1. **Treat snowfall as conservative lower bound** - Real snowfall will likely be higher
2. **Add extra winter contingency** - Use 1.5-2x the snow impact shown
3. **Cross-reference with NOAA station data** - Check local Climate.gov or weather.gov
4. **Focus on temperature-based metrics** - Work-stopping cold, freeze days are accurate
5. **Consider local knowledge** - Talk to local contractors about typical winter impacts

### For All Regions:

1. **Verify coordinates** - Use exact project location
2. **Use multiple metrics** - Don't rely solely on one weather indicator
3. **Add reasonable contingency** - Xyloclime provides data-driven starting point
4. **Consider seasonal patterns** - Historical data shows trends, not guarantees
5. **Update as needed** - Weather forecasts improve closer to project start

---

## 🔬 WHY ERA5 vs WEATHER STATIONS?

**Why not use local weather station data instead?**

### Advantages of ERA5:
✅ **Global coverage** - Works anywhere, even remote locations
✅ **Consistent methodology** - Same calculations worldwide
✅ **No data gaps** - Stations have missing data, ERA5 is complete
✅ **Long historical record** - 1940-present
✅ **Free and accessible** - No API costs or restrictions

### Disadvantages of ERA5:
❌ **Lower spatial resolution** - 30km grid vs point measurements
❌ **Snowfall underestimation** - Severe in many regions
❌ **May miss extreme events** - Localized phenomena not captured

### Trade-offs:
For a **free, globally-accessible tool**, ERA5 provides excellent temperature and precipitation data, with known limitations for snowfall. For critical projects, supplement with local station data.

---

## 📚 DATA SOURCES & REFERENCES

**Primary Data Source:**
- **Open-Meteo ERA5 Historical Weather API**
- https://open-meteo.com/
- Based on ECMWF ERA5 Reanalysis

**Validation Sources:**
- **NOAA Climate Normals (1991-2020)**
- **Weather station records** via Climate.gov
- **Industry standards** (AGC, ACI, OSHA)

**For Local Validation:**
- NOAA Climate Data: https://www.ncdc.noaa.gov/cdo-web/
- Local Weather Service: https://www.weather.gov/
- State Climatologist Offices

---

## ✅ RECOMMENDATIONS FOR USERS

### When Snowfall Matters (Winter Construction):
1. ⚠️ **Expect actual snowfall to be HIGHER than shown**
2. 🔍 **Check NOAA station data** for your location
3. 📊 **Use Xyloclime's snow counts as minimum estimate**
4. 🧮 **Add 50-100% extra winter weather contingency**
5. 🏗️ **Consult local contractors** about typical winter conditions

### When Temperature Matters (Concrete, Asphalt, Painting):
1. ✅ **Trust temperature-based metrics** (work-stopping cold, freeze days)
2. ✅ **Use workable day calculations** with confidence
3. ✅ **Apply recommended contingencies** from the tool

### For All Projects:
1. 📍 **Verify your coordinates** are correct
2. 📅 **Consider seasonal patterns** from the monthly breakdown
3. 🎯 **Use as planning tool**, not absolute prediction
4. 🤝 **Combine with local knowledge** and industry experience

---

## 🔄 FUTURE IMPROVEMENTS UNDER CONSIDERATION

1. **Multi-source data integration** - Combine ERA5 with station data where available
2. **Regional data quality indicators** - Flag low-confidence metrics by region
3. **User data input** - Allow manual adjustment based on local knowledge
4. **Alternative snowfall sources** - Investigate better snow data APIs
5. **Data quality scoring** - Show confidence levels for each metric

---

**Last Verified:** November 20, 2025
**Investigation:** Nebraska Panhandle (Scottsbluff) 5-year ERA5 analysis vs NOAA station data
**Status:** Documented and validated
