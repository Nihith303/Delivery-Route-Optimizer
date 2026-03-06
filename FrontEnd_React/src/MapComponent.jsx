import React, { useState, useEffect, useCallback } from 'react';
import CustomAutocomplete from './CustomAutocomplete';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';

// API Key should be set in .env as VITE_GOOGLE_MAPS_API_KEY
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Component to handle drawing the optimized route
function DirectionsRenderer({ routeOrder, locations, travelMode }) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({ map }));
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer || !routeOrder || routeOrder.length < 2) {
      if (directionsRenderer) directionsRenderer.setDirections(null);
      return;
    }

    const waypoints = [];
    const orderedLocs = routeOrder.map(index => locations[index]);
    
    // Origin AND Destination is the warehouse (the first point in locations list / routeOrder)
    const warehouse = orderedLocs[0];

    // All other points are waypoints
    for (let i = 1; i < orderedLocs.length - 1; i++) {
        waypoints.push({
            location: { lat: orderedLocs[i].lat, lng: orderedLocs[i].lng },
            stopover: true
        });
    }

    let gMapsTravelMode = google.maps.TravelMode.DRIVING;
    if (travelMode === 'bicycling') gMapsTravelMode = google.maps.TravelMode.BICYCLING;
    if (travelMode === 'two_wheeler') gMapsTravelMode = google.maps.TravelMode.TWO_WHEELER;

    directionsService
      .route({
        origin: { lat: warehouse.lat, lng: warehouse.lng },
        destination: { lat: warehouse.lat, lng: warehouse.lng },
        waypoints: waypoints,
        travelMode: gMapsTravelMode,
      })
      .then((response) => {
        directionsRenderer.setDirections(response);
      })
      .catch((e) => {
        console.error("Directions request failed due to " + e);
        alert("Could not render directions: " + e.message);
      });
      
      // Cleanup
      return () => directionsRenderer.setDirections(null);
  }, [directionsService, directionsRenderer, routeOrder, locations]);

  return null;
}

export default function MapComponent({ locations, routeOrder, travelMode, onMapClick, onPlaceSelect }) {
  const [center, setCenter] = useState({ lat: 40.7128, lng: -74.0060 }); // Default NYC

  // Try to get user location
  useEffect(() => {
    if (navigator.geolocation && locations.length === 0) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          console.log("Geolocation permission denied or error.");
        }
      );
    } else if (locations.length > 0) {
        // Center on last added location
        setCenter(locations[locations.length - 1]);
    }
  }, [locations.length]);

  const handleMapClick = useCallback((e) => {
    if (e.detail?.latLng) {
      onMapClick({
        lat: e.detail.latLng.lat,
        lng: e.detail.latLng.lng
      });
    }
  }, [onMapClick]);

  const handlePlaceSelect = useCallback((place) => {
      if (place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || place.name;
          setCenter({ lat, lng });
          
          if (onPlaceSelect) {
              onPlaceSelect({ lat, lng, address });
          } else if (onMapClick) {
              // Fallback if App doesn't pass onPlaceSelect
               onMapClick({ lat, lng, address });
          }
      }
  }, [onMapClick, onPlaceSelect]);

  if (!API_KEY) {
      return <div className="error-box">Google Maps API Key missing in environment!</div>;
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <div style={{ height: '600px', width: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
        <Map
          defaultZoom={11}
          center={center}
          mapId="route_optimizer_map_id" // Needed for AdvancedMarker
          onCenterChanged={ev => setCenter(ev.detail.center)}
          onClick={handleMapClick}
          disableDefaultUI={true}
          zoomControl={true}
        >
          <CustomAutocomplete onPlaceSelect={handlePlaceSelect} />
          
          {/* Render markers for each location NOT part of the route yet OR if we don't have a route */}
          {(!routeOrder || routeOrder.length < 2) && locations.map((loc, idx) => (
            <AdvancedMarker
              key={loc.id}
              position={{ lat: loc.lat, lng: loc.lng }}
              title={`Location ${idx + 1}`}
            >
                <div className="custom-marker">
                    {idx + 1}
                </div>
            </AdvancedMarker>
          ))}
          
          <DirectionsRenderer routeOrder={routeOrder} locations={locations} travelMode={travelMode} />
        </Map>
      </div>
    </APIProvider>
  );
}
