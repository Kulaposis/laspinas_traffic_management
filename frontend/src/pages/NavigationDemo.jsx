import React, { useState } from 'react';
import GoogleMapsStyleNavigation from '../components/GoogleMapsStyleNavigation';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Demo page for Google Maps Style Navigation
 * Shows the new navigation UI with a real map background
 */
const NavigationDemo = () => {
  const [showNavigation, setShowNavigation] = useState(true);

  const sampleRoutes = [
    { 
      duration: 36, 
      distance: "11 km", 
      arrivalTime: "2:01 PM", 
      label: "Best route, despite much heavier traffic than usual", 
      isBest: true,
      hasRestrictions: true
    },
    { 
      duration: 34, 
      distance: "9.5 km", 
      arrivalTime: "1:59 PM", 
      label: "Via Alabang-Zapote Road", 
      isBest: false 
    },
    { 
      duration: 37, 
      distance: "12 km", 
      arrivalTime: "2:02 PM", 
      label: "Avoid highways", 
      isBest: false 
    }
  ];

  const handleStart = () => {
    console.log('Starting navigation...');
    alert('Navigation started! (This would start real navigation)');
  };

  const handleSave = () => {
    console.log('Saving route...');
    alert('Route saved! (This would save to favorites)');
  };

  const handleClose = () => {
    setShowNavigation(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900">
      {/* Map Background */}
      <MapContainer
        center={[14.4504, 121.0170]} // Las Piñas City
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
      </MapContainer>

      {/* Google Maps Style Navigation Overlay */}
      {showNavigation && (
        <GoogleMapsStyleNavigation
          origin="Your location"
          destination="Maple Grove Rainwater Park"
          routes={sampleRoutes}
          onStart={handleStart}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}

      {/* Demo Controls */}
      {!showNavigation && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <button
            onClick={() => setShowNavigation(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-full shadow-2xl"
          >
            Show Navigation UI
          </button>
        </div>
      )}
    </div>
  );
};

export default NavigationDemo;

