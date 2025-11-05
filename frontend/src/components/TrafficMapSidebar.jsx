import React from 'react';
import { X, History, Layers, Map as MapIcon, Cloud, Droplets, UserCircle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const noop = () => {};

const Toggle = ({ label, checked, onChange, helper, icon, iconColor }) => (
  <label className="flex items-center justify-between p-4 hover:bg-blue-50 rounded-xl transition-all duration-200 cursor-pointer group border border-transparent hover:border-blue-200">
    <div className="flex items-center space-x-3 flex-1">
      {icon && (
        <div className={`flex-shrink-0 p-2 rounded-lg transition-all duration-200 ${
          checked 
            ? iconColor || 'bg-blue-100 text-blue-600' 
            : 'bg-gray-100 text-gray-400'
        }`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-semibold ${checked ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>
        {helper && <p className="text-xs text-gray-500 mt-0.5">{helper}</p>}
      </div>
    </div>
    <div className="flex items-center space-x-3">
      <div className={`w-12 h-7 rounded-full transition-all duration-200 relative shadow-inner ${checked ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gray-300'}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform absolute top-1 ${checked ? 'translate-x-6' : 'translate-x-1'}`}></div>
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
    </div>
  </label>
);

const Section = ({ title, subtitle, children, icon }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
    <div className="p-5 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200 flex items-center space-x-2">
      {icon}
      <div>
        <h3 className="font-bold text-gray-900 text-lg leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
      </div>
    </div>
    <div className="p-5 space-y-3">
      {children}
    </div>
  </div>
);

const StyleButton = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full px-5 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
      active
        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-[1.02]'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
    }`}
  >
    {label}
  </button>
);

const TrafficMapSidebar = ({
  onClose,
  onBackToDashboard,
  travelHistory = [],
  onOpenHistory = noop,
  heatmapEnabled = false,
  setHeatmapEnabled = noop,
  trafficLayerEnabled = true,
  setTrafficLayerEnabled = noop,
  mapStyle = 'main',
  setMapStyle = noop,
  // Optional data layer toggles
  parkingEnabled = false,
  setParkingEnabled = noop,
  weatherEnabled = false,
  setWeatherEnabled = noop,
  emergencyEnabled = false,
  setEmergencyEnabled = noop,
  // Traffic Monitoring (New)
  trafficMonitorNewEnabled = false,
  setTrafficMonitorNewEnabled = noop,
  // New comprehensive toggles
  reportsEnabled = false,
  setReportsEnabled = noop,
  incidentProneEnabled = false,
  setIncidentProneEnabled = noop,
  floodZonesEnabled = false,
  setFloodZonesEnabled = noop,
  isGuest = false,
}) => {
  const { user, logout } = useAuth();
  const isCitizen = !!user && (user.role?.toLowerCase?.() === 'citizen');
  return (
    <div
      className="fixed top-0 left-0 h-full w-80 sm:w-96 bg-white shadow-2xl transform transition-all duration-300 ease-out rounded-r-3xl border-r border-gray-100 overflow-hidden flex flex-col"
      style={{ zIndex: 50 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-6 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <MapIcon className="w-6 h-6 text-primary-600" />
            <h2 className="text-2xl font-bold text-gray-900">Traffic Map</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 transform hover:scale-110 hover:rotate-90"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {isGuest ? (
          <div className="w-full flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-500 to-slate-600 rounded-2xl border border-slate-400/30 shadow-lg">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <UserCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <span className="text-base font-bold text-white">Guest mode</span>
              <p className="text-xs text-slate-100 mt-0.5">Exploring as guest</p>
            </div>
          </div>
        ) : isCitizen ? (
          <div className="w-full flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl border border-blue-400/30 shadow-lg">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <UserCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <span className="text-base font-bold text-white">{user?.full_name || 'Citizen'}</span>
              <p className="text-xs text-blue-100 mt-0.5 capitalize">{user?.role || 'citizen'}</p>
            </div>
          </div>
        ) : (
          <button
            onClick={onBackToDashboard}
            className="w-full flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-2xl transition-all duration-200 text-left group shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-base font-bold text-white">Back to Dashboard</span>
              <p className="text-xs text-blue-100 mt-0.5">Return to main page</p>
            </div>
          </button>
        )}
      </div>

      <div className="p-6 space-y-6 overflow-y-auto flex-1 pb-24 modern-scrollbar overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* History */}
        <div>
          <button
            onClick={onOpenHistory}
            className="w-full flex items-center space-x-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 rounded-2xl transition-all duration-200 text-left group border border-indigo-100 hover:border-indigo-200 shadow-sm hover:shadow-md"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <History className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <span className="text-base font-bold text-gray-900">Travel History</span>
              <p className="text-xs text-gray-600 mt-0.5">View your past trips</p>
            </div>
            {travelHistory.length > 0 && (
              <span className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-md">
                {travelHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Map Layers */}
        <Section title="Map Layers" subtitle="Toggle map overlays" icon={<Layers className="w-5 h-5 text-gray-600" />}>
          <Toggle label="Traffic Heatmap" checked={heatmapEnabled} onChange={(e) => setHeatmapEnabled(e.target.checked)} />
          <Toggle label="Traffic Flow Layer" checked={trafficLayerEnabled} onChange={(e) => setTrafficLayerEnabled(e.target.checked)} helper="Updates every 10 min" />
        </Section>

        {/* Map Style */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 text-lg mb-1">Map Style</h3>
            <p className="text-xs text-gray-600">Choose your preferred view</p>
          </div>
          <div className="p-5">
            <div className="space-y-2">
              <StyleButton label="☀️ Day" active={mapStyle === 'main'} onClick={() => setMapStyle('main')} />
              <StyleButton label="🌙 Night" active={mapStyle === 'night'} onClick={() => setMapStyle('night')} />
              <StyleButton label="🛰️ Satellite" active={mapStyle === 'satellite'} onClick={() => setMapStyle('satellite')} />
            </div>
          </div>
        </div>

        {/* Data Layers (API-backed) */}
        <Section title="Data Layers" subtitle="City services and live data" icon={<Layers className="w-5 h-5 text-gray-600" />}>
          <Toggle label="No‑Parking & Restricted Zones" checked={parkingEnabled} onChange={(e) => setParkingEnabled(e.target.checked)} helper="Highlights areas where stopping/parking is restricted" />
          <Toggle 
            label="Weather & Flood" 
            checked={weatherEnabled || floodZonesEnabled} 
            onChange={(e) => {
              const isChecked = e.target.checked;
              setWeatherEnabled(isChecked);
              setFloodZonesEnabled(isChecked);
            }} 
            helper="Weather alerts, flood zones, and active floods"
            icon={
              <div className="flex items-center space-x-1">
                <Cloud className="w-4 h-4" />
                <Droplets className="w-4 h-4" />
              </div>
            }
            iconColor="bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-600"
          />
          <Toggle label="Emergency Reports" checked={emergencyEnabled} onChange={(e) => setEmergencyEnabled(e.target.checked)} />
          <Toggle label="Traffic Monitoring (New)" checked={trafficMonitorNewEnabled} onChange={(e) => setTrafficMonitorNewEnabled(e.target.checked)} />
          <Toggle label="User Reports" checked={reportsEnabled} onChange={(e) => setReportsEnabled(e.target.checked)} />
          <Toggle label="Incident Prone Areas" checked={incidentProneEnabled} onChange={(e) => setIncidentProneEnabled(e.target.checked)} />
          <div className="text-xs text-gray-500 pt-1">
            These layers will fetch from your API when enabled.
          </div>
        </Section>

        {/* Helpful hint */}
        <div className="text-xs text-gray-400 px-1">Designed for a Google Maps-like feel: clean, responsive, and fast.</div>
      </div>

      {/* Footer - Logout */}
      {!isGuest && (
        <div className="p-6 border-t border-gray-100 bg-white">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-semibold border border-red-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TrafficMapSidebar;


