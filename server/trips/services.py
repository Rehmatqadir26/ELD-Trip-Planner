"""
Core services for trip planning, route calculation, and HOS rules.

HOS Rules (Property-Carrying Driver, 70hrs/8days):
- 11-hour driving limit after 10 consecutive hours off duty
- 14-hour on-duty window after coming on duty (runs continuously)
- 30-minute break after 8 cumulative hours of driving
- 70-hour/8-day cycle limit
- 10-hour off-duty required to reset daily limits
- 34-hour restart to reset 70-hour cycle
- Fueling at least once every 1,000 miles
- 1 hour for pickup and drop-off (on-duty not driving)
"""

import requests
import urllib3
from datetime import datetime, timedelta
from math import radians, sin, cos, sqrt, atan2

# Suppress SSL warnings for older Python SSL libraries
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ─── HOS Constants ────────────────────────────────────────────────────────────
MAX_DRIVING_HOURS = 11
MAX_DUTY_WINDOW_HOURS = 14
BREAK_AFTER_DRIVING_HOURS = 8
BREAK_DURATION_HOURS = 0.5         # 30 minutes
REST_DURATION_HOURS = 10           # 10-hour off-duty rest
CYCLE_LIMIT_HOURS = 70             # 70-hour/8-day cycle
RESTART_DURATION_HOURS = 34        # 34-hour restart
FUEL_INTERVAL_MILES = 1000         # Fuel every 1000 miles
FUEL_STOP_DURATION_HOURS = 0.5     # 30 minutes for fueling
PICKUP_DURATION_HOURS = 1          # 1 hour at pickup
DROPOFF_DURATION_HOURS = 1         # 1 hour at dropoff
DEFAULT_AVG_SPEED_MPH = 55         # Fallback average speed


# ─── Utility Functions ────────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    """Calculate great-circle distance in miles between two points."""
    R = 3958.8  # Earth's radius in miles
    rlat1, rlon1 = radians(lat1), radians(lon1)
    rlat2, rlon2 = radians(lat2), radians(lon2)
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = sin(dlat / 2) ** 2 + cos(rlat1) * cos(rlat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


def calculate_cumulative_distances(coords):
    """
    Calculate cumulative distances (in miles) along a list of [lat, lng] points.
    Returns a list of cumulative distances, same length as coords.
    """
    distances = [0.0]
    for i in range(1, len(coords)):
        d = haversine(coords[i - 1][0], coords[i - 1][1],
                      coords[i][0], coords[i][1])
        distances.append(distances[-1] + d)
    return distances


def interpolate_point(coords, cum_distances, target_distance):
    """
    Find the [lat, lng] point on the route at a given cumulative distance.
    """
    if target_distance <= 0:
        return coords[0]
    if target_distance >= cum_distances[-1]:
        return coords[-1]

    for i in range(1, len(cum_distances)):
        if cum_distances[i] >= target_distance:
            seg_len = cum_distances[i] - cum_distances[i - 1]
            if seg_len == 0:
                return coords[i]
            fraction = (target_distance - cum_distances[i - 1]) / seg_len
            lat = coords[i - 1][0] + fraction * (coords[i][0] - coords[i - 1][0])
            lng = coords[i - 1][1] + fraction * (coords[i][1] - coords[i - 1][1])
            return [round(lat, 6), round(lng, 6)]
    return coords[-1]


# ─── External API Calls ──────────────────────────────────────────────────────

def geocode(location_text):
    """Geocode a location string using Nominatim (OpenStreetMap)."""
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location_text,
        "format": "json",
        "limit": 1,
        "countrycodes": "us",
    }
    headers = {"User-Agent": "ELD-TripPlanner/1.0 (educational project)"}
    resp = requests.get(url, params=params, headers=headers, timeout=10, verify=False)
    resp.raise_for_status()
    data = resp.json()
    if not data:
        raise ValueError(f"Could not find location: {location_text}")
    return {
        "lat": float(data[0]["lat"]),
        "lon": float(data[0]["lon"]),
        "name": data[0].get("display_name", location_text),
    }


def get_route(start_lat, start_lon, end_lat, end_lon):
    """
    Get driving route from OSRM (Open Source Routing Machine).
    Returns route geometry as [[lat, lng], ...], distance in miles, duration in hours.
    """
    url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{start_lon},{start_lat};{end_lon},{end_lat}"
    )
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true",
    }
    resp = requests.get(url, params=params, timeout=15, verify=False)
    resp.raise_for_status()
    data = resp.json()

    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError("Could not calculate route between the given locations.")

    route = data["routes"][0]
    # OSRM returns [lon, lat] — convert to [lat, lng]
    geometry = [
        [round(coord[1], 6), round(coord[0], 6)]
        for coord in route["geometry"]["coordinates"]
    ]
    distance_miles = route["distance"] / 1609.344
    duration_hours = route["duration"] / 3600.0

    return {
        "geometry": geometry,
        "distance_miles": round(distance_miles, 1),
        "duration_hours": round(duration_hours, 2),
    }


# ─── Schedule & HOS Engine ───────────────────────────────────────────────────

def _make_event(start_time, duration_hours, status, description, location=None, miles=0):
    """Create a schedule event dict."""
    end_time = start_time + timedelta(hours=duration_hours)
    return {
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "status": status,
        "description": description,
        "location": location,
        "miles": round(miles, 1),
    }


def generate_schedule(trip_legs, current_cycle_used, start_time):
    """
    Generate an HOS-compliant trip schedule.

    trip_legs: list of dicts with keys:
      - type: 'drive' | 'pickup' | 'dropoff'
      - distance_miles: float (for drive legs)
      - duration_hours: float (for drive legs)
      - location_name: str
      - location: [lat, lng]

    Returns: list of schedule events
    """
    schedule = []
    current_time = start_time

    # HOS tracking
    window_start = current_time      # When current duty window started
    driving_in_window = 0.0          # Hours driven since last 10-hr rest
    hours_since_break = 0.0          # Driving hours since last 30-min+ non-driving
    cycle_hours = float(current_cycle_used)  # Hours used in 70-hr cycle
    miles_since_fuel = 0.0           # Miles since last fuel stop

    def take_rest(duration, status, description, loc=None):
        """Add a rest/break event and return the new current_time."""
        nonlocal current_time
        event = _make_event(current_time, duration, status, description, location=loc)
        schedule.append(event)
        current_time += timedelta(hours=duration)
        return current_time

    def reset_daily():
        """Reset daily HOS counters after 10+ hour rest."""
        nonlocal window_start, driving_in_window, hours_since_break
        window_start = current_time
        driving_in_window = 0.0
        hours_since_break = 0.0

    def reset_cycle():
        """Reset cycle counter after 34-hour restart."""
        nonlocal cycle_hours
        cycle_hours = 0.0
        reset_daily()

    def check_and_rest_before_on_duty(needed_hours):
        """
        Ensure we have enough room in duty window and cycle
        before adding on-duty (non-driving) time.
        """
        nonlocal current_time, cycle_hours

        time_in_window = (current_time - window_start).total_seconds() / 3600.0

        # Check 14-hour window
        if time_in_window + needed_hours > MAX_DUTY_WINDOW_HOURS:
            take_rest(REST_DURATION_HOURS, 'sleeper_berth',
                      '10-hour rest (duty window limit)')
            reset_daily()

        # Check 70-hour cycle
        if cycle_hours + needed_hours > CYCLE_LIMIT_HOURS:
            take_rest(RESTART_DURATION_HOURS, 'off_duty',
                      '34-hour restart (cycle limit)')
            reset_cycle()

    for leg in trip_legs:
        if leg['type'] in ('pickup', 'dropoff'):
            duration = PICKUP_DURATION_HOURS if leg['type'] == 'pickup' else DROPOFF_DURATION_HOURS

            check_and_rest_before_on_duty(duration)

            desc = f"{'Pickup' if leg['type'] == 'pickup' else 'Dropoff'} at {leg['location_name']}"
            event = _make_event(current_time, duration, 'on_duty_not_driving',
                                desc, location=leg.get('location'))
            schedule.append(event)
            current_time += timedelta(hours=duration)
            cycle_hours += duration
            # 1 hour on-duty not driving satisfies 30-min break requirement
            hours_since_break = 0.0

        elif leg['type'] == 'drive':
            remaining_hours = leg['duration_hours']
            remaining_miles = leg['distance_miles']
            avg_speed = (remaining_miles / remaining_hours) if remaining_hours > 0.01 else DEFAULT_AVG_SPEED_MPH

            iteration_guard = 0
            max_iterations = 200  # Safety limit

            while remaining_hours > 0.01 and iteration_guard < max_iterations:
                iteration_guard += 1

                time_in_window = (current_time - window_start).total_seconds() / 3600.0

                # Calculate maximum drivable hours before hitting any limit
                avail_driving = MAX_DRIVING_HOURS - driving_in_window
                avail_window = MAX_DUTY_WINDOW_HOURS - time_in_window
                avail_break = BREAK_AFTER_DRIVING_HOURS - hours_since_break
                avail_cycle = CYCLE_LIMIT_HOURS - cycle_hours
                avail_fuel = ((FUEL_INTERVAL_MILES - miles_since_fuel) / avg_speed
                              if avg_speed > 0 else 999)

                can_drive = min(
                    avail_driving,
                    avail_window,
                    avail_break,
                    avail_cycle,
                    avail_fuel,
                    remaining_hours,
                )

                if can_drive < 0.01:
                    # Cannot drive — need to take a break or rest
                    if avail_cycle <= 0.01:
                        take_rest(RESTART_DURATION_HOURS, 'off_duty',
                                  '34-hour restart (70-hour cycle limit)')
                        reset_cycle()
                    elif avail_driving <= 0.01 or avail_window <= 0.01:
                        take_rest(REST_DURATION_HOURS, 'sleeper_berth',
                                  '10-hour rest (driving/duty limit)')
                        reset_daily()
                    elif avail_fuel <= 0.01:
                        take_rest(FUEL_STOP_DURATION_HOURS, 'on_duty_not_driving',
                                  'Fuel stop')
                        cycle_hours += FUEL_STOP_DURATION_HOURS
                        miles_since_fuel = 0.0
                        hours_since_break = 0.0  # 30-min non-driving resets break
                    elif avail_break <= 0.01:
                        take_rest(BREAK_DURATION_HOURS, 'off_duty',
                                  '30-minute rest break')
                        hours_since_break = 0.0
                    continue

                # Drive for can_drive hours
                drive_miles = can_drive * avg_speed
                event = _make_event(current_time, can_drive, 'driving',
                                    'Driving', miles=drive_miles)
                schedule.append(event)

                current_time += timedelta(hours=can_drive)
                remaining_hours -= can_drive
                remaining_miles -= drive_miles
                driving_in_window += can_drive
                hours_since_break += can_drive
                cycle_hours += can_drive
                miles_since_fuel += drive_miles

    return schedule


# ─── Daily Log Generation ────────────────────────────────────────────────────

def generate_daily_logs(schedule):
    """
    Convert a schedule into daily ELD log sheets.
    Each daily log covers midnight to midnight.
    Gaps are filled with off-duty status.
    """
    if not schedule:
        return []

    first_start = datetime.fromisoformat(schedule[0]['start_time'])
    last_end = datetime.fromisoformat(schedule[-1]['end_time'])

    start_date = first_start.date()
    end_date = last_end.date()

    daily_logs = []
    current_date = start_date

    while current_date <= end_date:
        day_start = datetime.combine(current_date, datetime.min.time())
        day_end = day_start + timedelta(days=1)

        raw_segments = []

        for event in schedule:
            ev_start = datetime.fromisoformat(event['start_time'])
            ev_end = datetime.fromisoformat(event['end_time'])

            # Skip events that don't overlap with this day
            if ev_end <= day_start or ev_start >= day_end:
                continue

            # Clip to this day's boundaries
            seg_start = max(ev_start, day_start)
            seg_end = min(ev_end, day_end)

            start_hour = (seg_start - day_start).total_seconds() / 3600.0
            end_hour = (seg_end - day_start).total_seconds() / 3600.0

            raw_segments.append({
                'start_hour': round(start_hour, 4),
                'end_hour': round(end_hour, 4),
                'status': event['status'],
                'description': event.get('description', ''),
            })

        # Fill gaps with off-duty
        segments = _fill_gaps_with_off_duty(raw_segments)

        # Calculate totals
        totals = {
            'off_duty': 0.0,
            'sleeper_berth': 0.0,
            'driving': 0.0,
            'on_duty_not_driving': 0.0,
        }
        remarks = []
        for seg in segments:
            duration = seg['end_hour'] - seg['start_hour']
            totals[seg['status']] += duration
            if seg['description'] and seg['description'] not in ('Driving', ''):
                remarks.append(seg['description'])

        daily_logs.append({
            'date': current_date.isoformat(),
            'segments': segments,
            'total_hours': {k: round(v, 2) for k, v in totals.items()},
            'remarks': remarks,
        })

        current_date += timedelta(days=1)

    return daily_logs


def _fill_gaps_with_off_duty(segments):
    """Fill any gaps in the 0-24 hour range with off-duty segments."""
    if not segments:
        return [{'start_hour': 0, 'end_hour': 24, 'status': 'off_duty', 'description': ''}]

    # Sort by start time
    sorted_segs = sorted(segments, key=lambda s: s['start_hour'])
    filled = []

    prev_end = 0.0
    for seg in sorted_segs:
        if seg['start_hour'] > prev_end + 0.001:
            filled.append({
                'start_hour': round(prev_end, 4),
                'end_hour': round(seg['start_hour'], 4),
                'status': 'off_duty',
                'description': '',
            })
        filled.append(seg)
        prev_end = seg['end_hour']

    if prev_end < 23.999:
        filled.append({
            'start_hour': round(prev_end, 4),
            'end_hour': 24.0,
            'status': 'off_duty',
            'description': '',
        })

    return filled


# ─── Stop Location Mapping ───────────────────────────────────────────────────

def map_stops_to_route(schedule, route_geometries):
    """
    For fuel stops, rest stops, and breaks, find their approximate
    GPS coordinates by interpolating along the route geometry.
    """
    # Combine all route geometries into one continuous path
    combined_coords = []
    for geom in route_geometries:
        if combined_coords and geom:
            # Avoid duplicate point at junction
            combined_coords.extend(geom[1:])
        else:
            combined_coords.extend(geom)

    if not combined_coords:
        return []

    cum_distances = calculate_cumulative_distances(combined_coords)
    total_route_miles = cum_distances[-1]

    stops = []
    cumulative_drive_miles = 0.0

    for event in schedule:
        status = event['status']
        desc = event.get('description', '')

        if status == 'driving':
            cumulative_drive_miles += event.get('miles', 0)
            continue

        # Determine stop type (order matters for keywords that overlap)
        desc_lower = desc.lower()
        if 'pickup' in desc_lower:
            stop_type = 'pickup'
        elif 'dropoff' in desc_lower or 'drop-off' in desc_lower:
            stop_type = 'dropoff'
        elif 'fuel' in desc_lower:
            stop_type = 'fuel'
        elif 'restart' in desc_lower:
            stop_type = 'restart'
        elif 'break' in desc_lower:
            stop_type = 'break'
        elif '10-hour' in desc_lower or 'sleeper' in desc_lower:
            stop_type = 'rest'
        else:
            stop_type = 'other'

        # Find location
        location = event.get('location')
        if not location:
            # Interpolate along route
            clamped_miles = min(cumulative_drive_miles, total_route_miles)
            location = interpolate_point(combined_coords, cum_distances, clamped_miles)

        ev_start = datetime.fromisoformat(event['start_time'])
        ev_end = datetime.fromisoformat(event['end_time'])
        duration = (ev_end - ev_start).total_seconds() / 3600.0

        stops.append({
            'type': stop_type,
            'location': location,
            'description': desc,
            'arrival_time': event['start_time'],
            'departure_time': event['end_time'],
            'duration_hours': round(duration, 2),
        })

    return stops


# ─── Main Trip Planner ────────────────────────────────────────────────────────

def plan_trip(current_location_text, pickup_location_text,
              dropoff_location_text, current_cycle_used):
    """
    Main entry point: plan a full trip with HOS compliance.
    Returns route info, stops, schedule, and daily ELD logs.
    """
    # 1. Geocode locations
    current_loc = geocode(current_location_text)
    pickup_loc = geocode(pickup_location_text)
    dropoff_loc = geocode(dropoff_location_text)

    # 2. Get routes
    route_to_pickup = get_route(
        current_loc['lat'], current_loc['lon'],
        pickup_loc['lat'], pickup_loc['lon']
    )
    route_to_dropoff = get_route(
        pickup_loc['lat'], pickup_loc['lon'],
        dropoff_loc['lat'], dropoff_loc['lon']
    )

    # 3. Build trip legs
    trip_legs = [
        {
            'type': 'drive',
            'distance_miles': route_to_pickup['distance_miles'],
            'duration_hours': route_to_pickup['duration_hours'],
            'location_name': pickup_loc['name'],
            'location': [pickup_loc['lat'], pickup_loc['lon']],
        },
        {
            'type': 'pickup',
            'location_name': pickup_loc['name'],
            'location': [pickup_loc['lat'], pickup_loc['lon']],
        },
        {
            'type': 'drive',
            'distance_miles': route_to_dropoff['distance_miles'],
            'duration_hours': route_to_dropoff['duration_hours'],
            'location_name': dropoff_loc['name'],
            'location': [dropoff_loc['lat'], dropoff_loc['lon']],
        },
        {
            'type': 'dropoff',
            'location_name': dropoff_loc['name'],
            'location': [dropoff_loc['lat'], dropoff_loc['lon']],
        },
    ]

    # 4. Generate HOS-compliant schedule
    start_time = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    schedule = generate_schedule(trip_legs, current_cycle_used, start_time)

    # 5. Map stops to route coordinates
    route_geometries = [route_to_pickup['geometry'], route_to_dropoff['geometry']]
    stops = map_stops_to_route(schedule, route_geometries)

    # 6. Generate daily ELD logs
    daily_logs = generate_daily_logs(schedule)

    # 7. Build combined route geometry for map display
    combined_geometry = route_to_pickup['geometry'][:]
    if route_to_dropoff['geometry']:
        combined_geometry.extend(route_to_dropoff['geometry'][1:])

    total_distance = (route_to_pickup['distance_miles'] +
                      route_to_dropoff['distance_miles'])
    total_duration = (route_to_pickup['duration_hours'] +
                      route_to_dropoff['duration_hours'])

    return {
        'locations': {
            'current': {
                'lat': current_loc['lat'],
                'lon': current_loc['lon'],
                'name': current_loc['name'],
            },
            'pickup': {
                'lat': pickup_loc['lat'],
                'lon': pickup_loc['lon'],
                'name': pickup_loc['name'],
            },
            'dropoff': {
                'lat': dropoff_loc['lat'],
                'lon': dropoff_loc['lon'],
                'name': dropoff_loc['name'],
            },
        },
        'route': {
            'geometry': combined_geometry,
            'total_distance_miles': round(total_distance, 1),
            'total_duration_hours': round(total_duration, 2),
            'legs': [
                {
                    'from': current_loc['name'],
                    'to': pickup_loc['name'],
                    'distance_miles': route_to_pickup['distance_miles'],
                    'duration_hours': route_to_pickup['duration_hours'],
                    'geometry': route_to_pickup['geometry'],
                },
                {
                    'from': pickup_loc['name'],
                    'to': dropoff_loc['name'],
                    'distance_miles': route_to_dropoff['distance_miles'],
                    'duration_hours': route_to_dropoff['duration_hours'],
                    'geometry': route_to_dropoff['geometry'],
                },
            ],
        },
        'stops': stops,
        'schedule': schedule,
        'daily_logs': daily_logs,
    }
