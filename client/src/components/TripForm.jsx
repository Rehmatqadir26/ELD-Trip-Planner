import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

/**
 * Debounce helper
 */
function useDebounce(callback, delay) {
  const timer = useRef(null)
  return useCallback((...args) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => callback(...args), delay)
  }, [callback, delay])
}

/**
 * Location input with Nominatim autocomplete
 */
function LocationInput({ label, value, onChange, placeholder, hint }) {
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef(null)

  const fetchSuggestions = useCallback(async (query) => {
    if (query.length < 3) {
      setSuggestions([])
      return
    }
    try {
      const resp = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: query, format: 'json', limit: 5, countrycodes: 'us' },
        headers: { 'User-Agent': 'ELD-TripPlanner/1.0' },
      })
      setSuggestions(resp.data || [])
      setShowDropdown(true)
    } catch {
      setSuggestions([])
    }
  }, [])

  const debouncedFetch = useDebounce(fetchSuggestions, 400)

  const handleChange = (e) => {
    const val = e.target.value
    onChange(val)
    debouncedFetch(val)
  }

  const handleSelect = (item) => {
    onChange(item.display_name)
    setSuggestions([])
    setShowDropdown(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="autocomplete-wrapper" ref={wrapperRef}>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {showDropdown && suggestions.length > 0 && (
          <div className="autocomplete-dropdown">
            {suggestions.map((item, idx) => (
              <div
                key={idx}
                className="autocomplete-item"
                onClick={() => handleSelect(item)}
              >
                {item.display_name}
              </div>
            ))}
          </div>
        )}
      </div>
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  )
}

export default function TripForm({ onResult, onLoading, onError }) {
  const [currentLocation, setCurrentLocation] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [dropoffLocation, setDropoffLocation] = useState('')
  const [cycleUsed, setCycleUsed] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    onError(null)

    // Client-side validation
    const errors = []
    if (!currentLocation.trim()) errors.push('Current location is required.')
    if (!pickupLocation.trim()) errors.push('Pickup location is required.')
    if (!dropoffLocation.trim()) errors.push('Dropoff location is required.')
    const cycleHrs = parseFloat(cycleUsed) || 0
    if (cycleHrs < 0) errors.push('Cycle hours must be non-negative.')
    if (cycleHrs >= 70) errors.push('Cycle hours must be less than 70.')

    if (errors.length > 0) {
      onError(errors)
      return
    }

    setSubmitting(true)
    onLoading(true)
    onResult(null)

    try {
      const resp = await axios.post(`${API_BASE}/api/trip/plan/`, {
        current_location: currentLocation.trim(),
        pickup_location: pickupLocation.trim(),
        dropoff_location: dropoffLocation.trim(),
        current_cycle_used: cycleHrs,
      })
      onResult(resp.data)
      onError(null)
    } catch (err) {
      const data = err.response?.data
      if (data?.errors) {
        onError(data.errors)
      } else {
        onError('Failed to plan trip. Please check your inputs and try again.')
      }
    } finally {
      setSubmitting(false)
      onLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="icon">📋</span>
        <h2>Trip Details</h2>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <LocationInput
            label="Current Location"
            value={currentLocation}
            onChange={setCurrentLocation}
            placeholder="e.g. Chicago, IL"
            hint="Where you are starting from"
          />
          <LocationInput
            label="Pickup Location"
            value={pickupLocation}
            onChange={setPickupLocation}
            placeholder="e.g. Indianapolis, IN"
            hint="Where you'll pick up the load"
          />
          <LocationInput
            label="Dropoff Location"
            value={dropoffLocation}
            onChange={setDropoffLocation}
            placeholder="e.g. Nashville, TN"
            hint="Where you'll deliver the load"
          />
          <div className="form-group">
            <label>Current Cycle Used (Hours)</label>
            <input
              type="number"
              value={cycleUsed}
              onChange={(e) => setCycleUsed(e.target.value)}
              placeholder="0"
              min="0"
              max="69"
              step="0.5"
            />
            <div className="form-hint">
              Hours already used in your 70-hour/8-day cycle (0-69)
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <div className="spinner" />
                Planning Route...
              </>
            ) : (
              <>🚀 Plan Trip</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
