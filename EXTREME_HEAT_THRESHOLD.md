# ⚠️ EXTREME HEAT DAYS - MEASUREMENT GUIDE

**Last Updated:** November 19, 2025
**Threshold:** ≥100°F (37.78°C)
**Status:** INFORMATIONAL METRIC (Not Work-Stopping)

---

## 📊 HOW EXTREME HEAT IS MEASURED

### Temperature Threshold
**≥100°F (37.78°C)** maximum daily temperature

### Why 100°F?
- **Informational Tracking**: Monitors hot days that require extra precautions
- **Reduces Ideal Days**: Days ≥100°F are excluded from "ideal" conditions
- **Still Workable**: NOT counted as work-stopping (work can continue with heat safety measures)
- **Work Stoppage Threshold**: ≥110°F is used for true work-stopping conditions
- **Regional Appropriate**: In areas like North Carolina, 100°F days are rare but trackable

---

## 🔍 DETECTION METHOD

**Data Source:** Open-Meteo Historical Weather API (ERA5 reanalysis)
**Parameter:** `temperature_2m_max` (daily maximum temperature at 2 meters)

**Code Implementation (app.js:2623):**
```javascript
extremeHeatDays: daily.temperature_2m_max.filter(t => t !== null && t >= 37.78).length
```

**Range Analysis:**
- Flags any day where maximum temperature reaches or exceeds 100°F
- Counts total extreme heat days over project duration
- Averages across 5 years of historical data for prediction

---

## 🏗️ CONSTRUCTION IMPACT

### Work Restrictions at ≥100°F:
1. **Mandatory Heat Illness Prevention Plan**
   - Frequent water breaks (every 15-20 minutes)
   - Shaded rest areas required
   - Acclimatization protocols for new workers

2. **Reduced Work Hours**
   - Avoid peak heat (11 AM - 4 PM)
   - Early morning or evening shifts
   - Extended break periods

3. **Increased Costs**
   - Higher labor costs (overtime for early/late shifts)
   - Cooling equipment and shade structures
   - Medical monitoring and safety officers

4. **Physical Limitations**
   - Reduced productivity (30-50% decrease)
   - Increased fatigue and errors
   - Higher injury risk

5. **Material Concerns**
   - Concrete curing issues
   - Asphalt temperature restrictions
   - Paint/coating application limits

---

## 📋 TEMPERATURE RANGES

| Range | Classification | Work Status |
|-------|---------------|-------------|
| < 90°F | Normal | Full productivity |
| 90-99°F | Hot | Precautions recommended |
| **100-109°F** | **Extreme Heat** | **Tracked for info - Still workable with heat safety** |
| **≥110°F** | **Dangerous Heat** | **Work-stopping / Major restrictions** |
| ≥115°F | Severe | Work prohibited in many jurisdictions |

---

## 🎯 DISPLAY LOCATIONS

### 1. **Metrics Tile** (index.html:578-587)
```html
<div class="metric-tile heat-tile">
    <i class="fas fa-sun"></i>
    <span>Extreme Heat</span>
    <div class="tile-value" id="extremeHeatDays">--</div>
    <div class="tile-detail">Days over 100°F</div>
    <div class="tile-criteria">Reduces ideal days</div>
</div>
```

### 2. **Impact on Calculations**
- **Ideal Days**: Excludes days ≥100°F (days ≥100°F are NOT ideal)
- **Workable Days**: INCLUDES days 100-109°F (still workable with precautions)
- **Workable Days**: Excludes days ≥110°F (true work stoppage)
- **Temperature Risk**: Days ≥100°F contribute to overall temperature risk

### 3. **Executive Summary Report**
- Listed in Key Weather Metrics table
- Mentioned in Concrete Work Impacts section
- Included in risk mitigation recommendations

---

## ⚙️ TECHNICAL DETAILS

### Calculation Flow:
1. **Fetch Historical Data** → Open-Meteo API (5 years)
2. **Filter by Threshold** → `temp >= 37.78°C`
3. **Count Days** → Per year
4. **Average** → Across all years
5. **Display** → Round to nearest whole number

### Code Locations:
- **Data Collection (≥100°F):** app.js:2624
- **Work-Stopping Check (≥110°F):** app.js:2674
- **Ideal Days Check (≥100°F):** app.js:2658
- **Display Update:** app.js:4094
- **HTML Tile:** index.html:578-587
- **Tile Label:** "Days over 100°F - Reduces ideal days"

---

## 🌡️ REGIONAL VARIATIONS

### Expected Extreme Heat Days by Region:

| Region | Typical Days ≥100°F |
|--------|-------------------|
| Phoenix, AZ | 100-110 days/year |
| Las Vegas, NV | 70-80 days/year |
| Dallas, TX | 15-25 days/year |
| Atlanta, GA | 0-5 days/year |
| Chicago, IL | 0-2 days/year |
| Seattle, WA | 0 days/year |

---

## ✅ VERIFICATION

To verify extreme heat calculations:

1. **Check Browser Console:**
   ```
   [ANALYSIS] Extreme heat: X days >= 100°F
   ```

2. **Compare Against Climate Data:**
   - NOAA Climate Normals
   - National Weather Service records
   - Local climate summaries

3. **Validate Threshold:**
   - 100°F = 37.78°C (exact)
   - Open-Meteo uses Celsius
   - Conversion: (100 - 32) × 5/9 = 37.78

---

## 📚 REFERENCES

- **OSHA Heat Illness Prevention:** [osha.gov/heat-exposure](https://www.osha.gov/heat-exposure)
- **NIOSH Heat Stress Recommendations:** Temperature ≥100°F = Very High Risk
- **Construction Safety Standards:** Many states require heat illness prevention plans at 95°F+
- **Open-Meteo API:** Historical weather reanalysis (ERA5 dataset)

---

## 🚨 IMPORTANT NOTES

1. **100°F is INFORMATIONAL ONLY** - Tracks hot days but does NOT stop work
2. **110°F is WORK-STOPPING THRESHOLD** - True work stoppage for safety
3. **Based on MAXIMUM daily temperature** - Not average or minimum
4. **Days 100-109°F are WORKABLE** - But excluded from "ideal days"
5. **Regional Appropriate** - Realistic for areas where 100°F is uncommon (like NC)
6. **Displayed prominently in metrics tiles** - Shows count of days ≥100°F

---

## 📝 CALCULATION SUMMARY

**What Gets Counted:**
- `extremeHeatDays` = Days where max temp ≥100°F (informational metric)

**Impact on Workability:**
- Days 100-109°F → Still counted as WORKABLE (with heat precautions)
- Days ≥110°F → NOT workable (true work stoppage)

**Impact on Ideal Days:**
- Days ≥100°F → Excluded from "ideal" (too hot for perfect conditions)

---

**Status:** ✅ IMPLEMENTED & UPDATED
**Info Threshold:** 100°F (37.78°C)
**Work-Stop Threshold:** 110°F (43.33°C)
**Display:** "Days over 100°F - Reduces ideal days"
**Calculation:** Accurate and regionally appropriate
