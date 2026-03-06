import React, { useRef, useEffect, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export default function CustomAutocomplete({ onPlaceSelect }) {
  const [placeAutocomplete, setPlaceAutocomplete] = useState(null);
  const inputRef = useRef(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ['geometry', 'name', 'formatted_address']
    };

    setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places]);

  useEffect(() => {
    if (!placeAutocomplete) return;

    const listener = placeAutocomplete.addListener('place_changed', () => {
      onPlaceSelect(placeAutocomplete.getPlace());
      // clear input if desired, or keep the text
      if (inputRef.current) {
         inputRef.current.value = '';
      }
    });
    
    return () => {
        // Clean up the listener to prevent memory leaks and multiple additions
        google.maps.event.removeListener(listener);
    };
  }, [onPlaceSelect, placeAutocomplete]);

  return (
    <div className="autocomplete-container" style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        width: '60%',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        borderRadius: '8px',
        backgroundColor: 'white'
    }}>
      <input 
        ref={inputRef}
        placeholder="Search for a place..."
        style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '16px',
            border: 'none',
            borderRadius: '8px',
            outline: 'none'
        }}
      />
    </div>
  );
}
