import { useState } from 'react'
import TripForm from './components/TripForm'
import TripResults from './components/TripResults'

function App() {
  const [tripData, setTripData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <span className="header-icon">🚛</span>
          <div>
            <h1>ELD Trip Planner</h1>
            <p>Plan your route with HOS-compliant Electronic Logging Device logs</p>
          </div>
        </div>
      </header>

      <div className="app-container">
        <div className="main-layout">
          <aside>
            <TripForm
              onResult={setTripData}
              onLoading={setLoading}
              onError={setError}
            />
          </aside>

          <main>
            {error && (
              <div className="error-box">
                {Array.isArray(error) ? error.map((e, i) => <div key={i}>{e}</div>) : error}
              </div>
            )}

            {loading ? (
              <div className="card">
                <div className="loading-overlay">
                  <div className="spinner" />
                  <p>Calculating your route &amp; generating ELD logs...</p>
                  <p style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                    This may take a few seconds
                  </p>
                </div>
              </div>
            ) : tripData ? (
              <TripResults data={tripData} />
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="icon">🗺️</div>
                  <h3>Plan Your Trip</h3>
                  <p>
                    Enter your current location, pickup, and dropoff to generate
                    a route plan with HOS-compliant ELD logs.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
