"""
NOAA Data Fetcher
Fetches historical weather data directly from NOAA NCEI API
"""

import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class NOAADataFetcher:
    """Fetch weather data from NOAA NCEI"""

    BASE_URL = "https://www.ncei.noaa.gov/access/services/data/v1"

    def __init__(self):
        """Initialize NOAA data fetcher"""
        print("[OK] NOAA Data Fetcher initialized")
        print("[INFO] Using NOAA NCEI Data API v1 (no API key required)")

    def fetch_daily_data(self, station_id: str, start_date: str, end_date: str,
                         data_types: Optional[List[str]] = None) -> Dict:
        """
        Fetch daily weather data from NOAA

        Args:
            station_id: NOAA station ID (e.g., 'USW00094728')
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            data_types: List of data types to fetch (SNOW, SNWD, TMAX, TMIN, PRCP, etc.)
                       If None, fetches all available data

        Returns:
            Dictionary with weather data
        """
        if data_types is None:
            data_types = ['TMAX', 'TMIN', 'PRCP', 'SNOW', 'SNWD']

        params = {
            'dataset': 'daily-summaries',
            'stations': station_id,
            'startDate': start_date,
            'endDate': end_date,
            'dataTypes': ','.join(data_types),
            'format': 'json',
            'units': 'standard'  # US standard units
        }

        try:
            print(f"[*] Fetching data for {station_id} ({start_date} to {end_date})...")
            response = requests.get(self.BASE_URL, params=params, timeout=60)
            response.raise_for_status()

            data = response.json()
            print(f"    [OK] Retrieved {len(data)} records")

            return {
                'station_id': station_id,
                'start_date': start_date,
                'end_date': end_date,
                'records': data,
                'record_count': len(data)
            }

        except requests.exceptions.RequestException as e:
            print(f"    [ERROR] Failed to fetch data: {e}")
            return {
                'station_id': station_id,
                'start_date': start_date,
                'end_date': end_date,
                'records': [],
                'record_count': 0,
                'error': str(e)
            }

    def fetch_monthly_summary(self, station_id: str, year: int, month: int) -> Dict:
        """
        Fetch monthly weather summary

        Args:
            station_id: NOAA station ID
            year: Year (YYYY)
            month: Month (1-12)

        Returns:
            Monthly summary statistics
        """
        # Calculate month date range
        start_date = f"{year}-{month:02d}-01"

        # Get last day of month
        if month == 12:
            next_month = f"{year+1}-01-01"
        else:
            next_month = f"{year}-{month+1:02d}-01"

        # Fetch data
        data = self.fetch_daily_data(station_id, start_date, next_month)

        if not data['records']:
            return data

        # Calculate summary statistics
        summary = self._calculate_summary(data['records'])
        summary['station_id'] = station_id
        summary['year'] = year
        summary['month'] = month

        return summary

    def fetch_yearly_summary(self, station_id: str, year: int) -> Dict:
        """
        Fetch yearly weather summary

        Args:
            station_id: NOAA station ID
            year: Year (YYYY)

        Returns:
            Yearly summary statistics
        """
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        data = self.fetch_daily_data(station_id, start_date, end_date)

        if not data['records']:
            return data

        # Calculate summary statistics
        summary = self._calculate_summary(data['records'])
        summary['station_id'] = station_id
        summary['year'] = year

        return summary

    def fetch_snowfall_season(self, station_id: str, start_year: int) -> Dict:
        """
        Fetch snow season data (Nov-Apr)

        Args:
            station_id: NOAA station ID
            start_year: Starting year of season (e.g., 2023 for 2023-2024 season)

        Returns:
            Snow season summary
        """
        # Snow season typically runs from November to April
        start_date = f"{start_year}-11-01"
        end_date = f"{start_year + 1}-04-30"

        data = self.fetch_daily_data(station_id, start_date, end_date, data_types=['SNOW', 'SNWD', 'TMAX', 'TMIN'])

        if not data['records']:
            return data

        # Calculate snow-specific statistics
        summary = self._calculate_snow_summary(data['records'])
        summary['station_id'] = station_id
        summary['season'] = f"{start_year}-{start_year + 1}"

        return summary

    def _calculate_summary(self, records: List[Dict]) -> Dict:
        """Calculate summary statistics from daily records"""

        # Convert string values to float
        temps_max = [float(r['TMAX']) for r in records if 'TMAX' in r and r['TMAX'] is not None and r['TMAX'] != '']
        temps_min = [float(r['TMIN']) for r in records if 'TMIN' in r and r['TMIN'] is not None and r['TMIN'] != '']
        precip = [float(r['PRCP']) for r in records if 'PRCP' in r and r['PRCP'] is not None and r['PRCP'] != '']
        snow = [float(r['SNOW']) for r in records if 'SNOW' in r and r['SNOW'] is not None and r['SNOW'] != '']

        summary = {
            'days_with_data': len(records),
            'temperature': {
                'avg_high': round(sum(temps_max) / len(temps_max), 1) if temps_max else None,
                'avg_low': round(sum(temps_min) / len(temps_min), 1) if temps_min else None,
                'max': max(temps_max) if temps_max else None,
                'min': min(temps_min) if temps_min else None
            },
            'precipitation': {
                'total': round(sum(precip), 2) if precip else None,
                'avg_daily': round(sum(precip) / len(precip), 2) if precip else None,
                'days_with_precip': len([p for p in precip if p > 0])
            },
            'snowfall': {
                'total': round(sum(snow), 1) if snow else None,
                'avg_daily': round(sum(snow) / len(snow), 2) if snow else None,
                'days_with_snow': len([s for s in snow if s > 0]),
                'max_daily': max(snow) if snow else None
            }
        }

        return summary

    def _calculate_snow_summary(self, records: List[Dict]) -> Dict:
        """Calculate snow-specific statistics"""

        # Convert string values to float
        snow = [float(r['SNOW']) for r in records if 'SNOW' in r and r['SNOW'] is not None and r['SNOW'] != '']
        snow_depth = [float(r['SNWD']) for r in records if 'SNWD' in r and r['SNWD'] is not None and r['SNWD'] != '']

        # Find snow events (days with measurable snow)
        snow_events = []
        for r in records:
            if 'SNOW' in r and r['SNOW'] and r['SNOW'] != '':
                snow_amt = float(r['SNOW'])
                if snow_amt > 0:
                    snow_events.append({
                        'date': r['DATE'],
                        'amount': snow_amt
                    })

        # Sort by amount
        snow_events.sort(key=lambda x: x['amount'], reverse=True)

        summary = {
            'total_snowfall': round(sum(snow), 1) if snow else 0,
            'days_with_snow': len([s for s in snow if s > 0]),
            'avg_snow_depth': round(sum(snow_depth) / len(snow_depth), 1) if snow_depth else None,
            'max_snow_depth': max(snow_depth) if snow_depth else None,
            'biggest_storms': snow_events[:10],  # Top 10 snow events
            'snow_days_breakdown': {
                'trace': len([s for s in snow if s > 0 and s < 0.1]),
                'light (0.1-2")': len([s for s in snow if 0.1 <= s < 2]),
                'moderate (2-6")': len([s for s in snow if 2 <= s < 6]),
                'heavy (6-12")': len([s for s in snow if 6 <= s < 12]),
                'extreme (12"+)': len([s for s in snow if s >= 12])
            }
        }

        return summary


def test_noaa_fetcher():
    """Test NOAA data fetching"""

    print("\n" + "=" * 80)
    print("TESTING NOAA DATA FETCHER")
    print("=" * 80)

    fetcher = NOAADataFetcher()

    # Test 1: Fetch recent data for NYC Central Park
    print("\n--- Test 1: NYC Central Park Recent Week ---")
    today = datetime.now()
    week_ago = today - timedelta(days=7)

    data = fetcher.fetch_daily_data(
        'USW00094728',  # NYC Central Park
        week_ago.strftime('%Y-%m-%d'),
        today.strftime('%Y-%m-%d')
    )

    if data['records']:
        print(f"\nSample record:")
        print(json.dumps(data['records'][0], indent=2))

    # Test 2: Fetch snow season data
    print("\n--- Test 2: 2023-2024 Snow Season (NYC) ---")
    snow_data = fetcher.fetch_snowfall_season('USW00094728', 2023)

    if 'snowfall' in snow_data or 'total_snowfall' in snow_data:
        print(f"\nSeason: {snow_data.get('season', 'N/A')}")
        print(f"Total Snowfall: {snow_data.get('total_snowfall', 'N/A')} inches")
        print(f"Days with Snow: {snow_data.get('days_with_snow', 'N/A')}")

        if 'biggest_storms' in snow_data:
            print(f"\nBiggest Storms:")
            for i, storm in enumerate(snow_data['biggest_storms'][:5], 1):
                print(f"  #{i}: {storm['date']} - {storm['amount']}\"")

    # Test 3: Compare multiple cities
    print("\n--- Test 3: January 2024 Comparison ---")

    test_stations = [
        ('USW00094728', 'NYC Central Park'),
        ('USW00014819', 'Chicago Midway'),
        ('USW00024233', 'Seattle-Tacoma'),
        ('USW00023062', 'Denver')
    ]

    for station_id, name in test_stations:
        summary = fetcher.fetch_monthly_summary(station_id, 2024, 1)

        if 'snowfall' in summary and summary['snowfall']['total'] is not None:
            print(f"\n{name}:")
            print(f"  Temp: {summary['temperature']['avg_high']}°F / {summary['temperature']['avg_low']}°F")
            print(f"  Snowfall: {summary['snowfall']['total']}\"")
            print(f"  Snow days: {summary['snowfall']['days_with_snow']}")

    print("\n" + "=" * 80)


if __name__ == '__main__':
    test_noaa_fetcher()
