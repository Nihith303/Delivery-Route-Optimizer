import React, { useState, useCallback } from 'react';
import { MapPin, Trash2, Navigation, Loader2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import MapComponent from './MapComponent';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [locations, setLocations] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [error, setError] = useState(null);
  const [travelMode, setTravelMode] = useState('driving');

  const handleMapClick = useCallback((coords) => {
    // Prevent adding points if we are showing a route already
    if (routeResult) {
       // Reset route if clicking to add new points
       setRouteResult(null);
    }
    
    const newLocation = {
      id: crypto.randomUUID(),
      lat: coords.lat,
      lng: coords.lng,
      address: `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`
    };
    
    setLocations((prev) => [...prev, newLocation]);
  }, [routeResult]);

  const handlePlaceSelect = useCallback((place) => {
    if (routeResult) {
       setRouteResult(null);
    }
    const newLocation = {
      id: crypto.randomUUID(),
      lat: place.lat,
      lng: place.lng,
      address: place.address
    };
    setLocations((prev) => [...prev, newLocation]);
  }, [routeResult]);

  const removeLocation = (id) => {
    setLocations((prev) => prev.filter(loc => loc.id !== id));
    setRouteResult(null); // Reset route when locations change
  };

  const clearLocations = () => {
    setLocations([]);
    setRouteResult(null);
    setError(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Parse sheet to array of objects
        const data = XLSX.utils.sheet_to_json(ws);
        
        const importedLocations = [];
        data.forEach((row, index) => {
           // Look for latitude and longitude columns (case insensitive, various common names)
           const latKey = Object.keys(row).find(k => k.toLowerCase().includes('lat'));
           const lngKey = Object.keys(row).find(k => k.toLowerCase().includes('lng') || k.toLowerCase().includes('lon'));
           const addressKey = Object.keys(row).find(k => k.toLowerCase().includes('address') || k.toLowerCase().includes('name'));
           
           if (latKey && lngKey && !isNaN(parseFloat(row[latKey])) && !isNaN(parseFloat(row[lngKey]))) {
               importedLocations.push({
                  id: crypto.randomUUID(),
                  lat: parseFloat(row[latKey]),
                  lng: parseFloat(row[lngKey]),
                  address: addressKey ? row[addressKey] : `Imported Location ${index + 1}`
               });
           }
        });

        if (importedLocations.length > 0) {
            setLocations(prev => [...prev, ...importedLocations]);
            setRouteResult(null);
            setError(null);
        } else {
            setError("Could not find valid latitude (lat) and longitude (lng) columns in the file.");
        }
      } catch (err) {
          setError("Failed to parse file. Please upload a valid CSV or Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input so same file can be uploaded again if needed
    e.target.value = null;
  };

  const optimizeRoute = async () => {
    if (locations.length < 2) {
      setError("Please select at least 2 locations on the map.");
      return;
    }

    setIsOptimizing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/optimize-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locations, travel_mode: travelMode }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to optimize route');
      }

      const data = await response.json();
      setRouteResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while optimizing the route.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const formatDistance = (meters) => {
      return (meters / 1000).toFixed(2) + ' km';
  };
  
  const formatDuration = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} min`;
  };

  const startJourney = () => {
      if (!routeResult || routeResult.route_order.length < 2) return;
      
      const orderedLocs = routeResult.route_order.map(index => locations[index]);
      const origin = orderedLocs[0];
      const destination = orderedLocs[orderedLocs.length - 1]; // which is also the warehouse
      
      const waypoints = [];
      for(let i=1; i < orderedLocs.length - 1; i++) {
          waypoints.push(`${orderedLocs[i].lat},${orderedLocs[i].lng}`);
      }
      
      const waypointsStr = waypoints.length > 0 ? `&waypoints=${waypoints.join('|')}` : '';
      let travelModeStr = 'driving';
      if (travelMode === 'bicycling') travelModeStr = 'bicycling';
      if (travelMode === 'two_wheeler') travelModeStr = 'two-wheeler'; // google maps URL uses two-wheeler
      
      // Construct Google Maps Directions URL
      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointsStr}&travelmode=${travelModeStr}`;
      
      window.open(url, '_blank');
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="header">
          <h1>Route Optimizer</h1>
          <p>Plan the most efficient delivery routes</p>
        </div>

        <div className="locations-panel">
          <div className="locations-header">
            <h3>Locations ({locations.length})</h3>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                <label className="import-btn" style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#3b82f6'}}>
                    <Upload size={14} /> Import
                    <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileUpload} style={{display: 'none'}} />
                </label>
                {locations.length > 0 && (
                  <button className="clear-btn" onClick={clearLocations}>Clear</button>
                )}
            </div>
          </div>
          
          {locations.length === 0 ? (
            <div className="empty-state">
              <MapPin size={48} opacity={0.3} />
              <p>Click on the map to add delivery locations.</p>
            </div>
          ) : (
            <ul className="locations-list">
              {locations.map((loc, index) => (
                <li key={loc.id} className="location-item">
                  <div className="location-index">{index + 1}</div>
                  <div className="location-info">
                    <span>{loc.address}</span>
                  </div>
                  <button className="delete-btn" onClick={() => removeLocation(loc.id)}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="action-panel">
          <div className="mode-selector" style={{display: 'flex', gap: '15px', marginBottom: '15px', justifyContent: 'center'}}>
           <label style={{display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 500}}>
               <input type="radio" value="driving" checked={travelMode === 'driving'} onChange={(e) => setTravelMode(e.target.value)} />
               🚗 Car
           </label>
           <label style={{display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 500}}>
               <input type="radio" value="two_wheeler" checked={travelMode === 'two_wheeler'} onChange={(e) => setTravelMode(e.target.value)} />
               🛵 Two-Wheeler
           </label>
          </div>
          <button 
            className={`optimize-btn ${isOptimizing ? 'loading' : ''}`}
            onClick={optimizeRoute}
            disabled={locations.length < 2 || isOptimizing}
          >
            {isOptimizing ? (
              <><Loader2 className="spinner" size={18} /> Optimizing...</>
            ) : (
              <><Navigation size={18} /> Optimize Route</>
            )}
          </button>
        </div>

        {routeResult && (
          <div className="results-panel">
             <h3>Route Summary</h3>
             <div className="stats">
                <div className="stat-box">
                    <span className="stat-label">Total Distance</span>
                    <span className="stat-value">{formatDistance(routeResult.total_distance_meters)}</span>
                </div>
                <div className="stat-box">
                    <span className="stat-label">Est. Time</span>
                    <span className="stat-value">{formatDuration(routeResult.total_duration_seconds)}</span>
                </div>
             </div>
             
             <h4>Optimal Route (Closed Loop):</h4>
             <ul className="ordered-path">
                 {routeResult.route_order.map((origIndex, i) => {
                     const isStart = i === 0;
                     const isEnd = i === routeResult.route_order.length - 1;
                     return (
                       <li key={i}>
                           <div className="order-number" style={isStart || isEnd ? {backgroundColor: '#10b981'} : {}}>
                               {i + 1}
                           </div>
                           <span>
                               {isStart ? "Start (Warehouse)" : isEnd ? "End (Warehouse)" : `Location ${origIndex + 1}`}
                           </span>
                       </li>
                     );
                 })}
             </ul>
             
             <button 
                onClick={startJourney}
                className="optimize-btn" 
                style={{marginTop: '1rem', backgroundColor: '#10b981', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'}}
             >
                 <Navigation size={18} /> Start Journey
             </button>
          </div>
        )}
      </div>

      <div className="map-view">
        <MapComponent 
            locations={locations} 
            routeOrder={routeResult ? routeResult.route_order : null}
            travelMode={travelMode}
            onMapClick={handleMapClick} 
            onPlaceSelect={handlePlaceSelect}
        />
      </div>
    </div>
  );
}

export default App;
