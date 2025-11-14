import React from 'react';
import { X, History, Layers, Map as MapIcon, UserCircle, LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';

const noop = () => {};

const Toggle = ({ label, checked, onChange, helper, icon, iconColor, isDarkMode = false }) => (
  <label className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 cursor-pointer group border ${
    isDarkMode 
      ? 'hover:bg-gray-800 border-gray-700 hover:border-gray-600' 
      : 'hover:bg-blue-50 border-transparent hover:border-blue-200'
  }`}>
    <div className="flex items-center space-x-3 flex-1">
      {icon && (
        <div className={`flex-shrink-0 p-2 rounded-lg transition-all duration-200 ${
          checked 
            ? iconColor || (isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600')
            : isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
        }`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-semibold ${checked ? (isDarkMode ? 'text-gray-100' : 'text-gray-900') : (isDarkMode ? 'text-gray-400' : 'text-gray-600')}`}>{label}</span>
        {helper && <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>{helper}</p>}
      </div>
    </div>
    <div className="flex items-center space-x-3">
      <div className={`w-12 h-7 rounded-full transition-all duration-200 relative shadow-inner ${
        checked 
          ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
          : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
      }`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform absolute top-1 ${checked ? 'translate-x-6' : 'translate-x-1'}`}></div>
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
    </div>
  </label>
);

const Section = ({ title, subtitle, children, icon, isDarkMode = false }) => (
  <div className={`rounded-2xl border shadow-md overflow-hidden ${
    isDarkMode 
      ? 'bg-gray-800 border-gray-700' 
      : 'bg-white border-gray-200'
  }`}>
    <div className={`p-5 border-b flex items-center space-x-2 ${
      isDarkMode 
        ? 'bg-gradient-to-r from-gray-800 to-gray-750 border-gray-700' 
        : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
    }`}>
      {icon && React.cloneElement(icon, { className: `w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}` })}
      <div>
        <h3 className={`font-bold text-lg leading-tight ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{title}</h3>
        {subtitle && <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{subtitle}</p>}
      </div>
    </div>
    <div className="p-5 space-y-3">
      {children}
    </div>
  </div>
);

const StyleButton = ({ active, label, onClick, isDarkMode = false }) => (
  <button
    onClick={onClick}
    className={`w-full px-5 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
      active
        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-[1.02]'
        : isDarkMode 
          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600' 
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
  onOpenEmergencyReports = noop,
  myEmergencyReports = [],
  onOpenActiveIncidents = noop,
  activeIncidentsCount = 0,
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
  // emergencyEnabled = false,
  // setEmergencyEnabled = noop,
  // Traffic Monitoring
  trafficMonitorNewEnabled = false,
  setTrafficMonitorNewEnabled = noop,
  // New comprehensive toggles
  reportsEnabled = false,
  setReportsEnabled = noop,
  incidentProneEnabled = false,
  setIncidentProneEnabled = noop,
  // tomtomIncidentsEnabled = false,
  // setTomtomIncidentsEnabled = noop,
  floodZonesEnabled = false,
  setFloodZonesEnabled = noop,
  showPredictionsPanel = false,
  setShowPredictionsPanel = noop,
  isGuest = false,
  sidebarOpen = false,
}) => {
  const { user, logout } = useAuth();
  const { isDarkMode } = useDarkMode();
  const isCitizen = !!user && (user.role?.toLowerCase?.() === 'citizen');

  return (
    <>
      {/* Mobile overlay - only show on mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 transition-opacity duration-300 md:hidden"
          style={{ zIndex: 119 }}
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 left-0 h-full w-80 sm:w-96 shadow-2xl transform transition-transform duration-300 ease-out rounded-r-3xl border-r overflow-hidden flex flex-col ${
          isDarkMode 
            ? 'bg-gray-900 border-gray-700' 
            : 'bg-white border-gray-100'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ zIndex: 120 }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Header */}
      <div className={`p-6 border-b ${
        isDarkMode 
          ? 'border-gray-700 bg-gray-900' 
          : 'border-gray-100 bg-white'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <MapIcon className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-primary-600'}`} />
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Traffic Map</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-all duration-200 transform hover:scale-110 hover:rotate-90 ${
              isDarkMode 
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                : 'hover:bg-gray-100 text-gray-500'
            }`}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
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

      <div className={`p-6 space-y-6 overflow-y-auto flex-1 pb-24 modern-scrollbar overscroll-contain ${
        isDarkMode ? 'scrollbar-dark' : ''
      }`} style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* History */}
        <div>
          <button
            onClick={onOpenHistory}
            className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all duration-200 text-left group border shadow-sm hover:shadow-md ${
              isDarkMode
                ? 'bg-gradient-to-r from-indigo-900/50 to-blue-900/50 hover:from-indigo-800/50 hover:to-blue-800/50 border-indigo-700/50 hover:border-indigo-600/50'
                : 'bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 border-indigo-100 hover:border-indigo-200'
            }`}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <History className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <span className={`text-base font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Travel History</span>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>View your past trips</p>
            </div>
            {travelHistory.length > 0 && (
              <span className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-md">
                {travelHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Active Incidents - Accessible to all users, especially CITIZEN */}
        <div>
          <button
            onClick={onOpenActiveIncidents}
            className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all duration-200 text-left group border shadow-sm hover:shadow-md ${
              isDarkMode
                ? 'bg-gradient-to-r from-orange-900/50 to-red-900/50 hover:from-orange-800/50 hover:to-red-800/50 border-orange-700/50 hover:border-orange-600/50'
                : 'bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 border-orange-100 hover:border-orange-200'
            }`}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <span className={`text-base font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Active Incidents</span>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>View roadworks & traffic incidents</p>
            </div>
            {activeIncidentsCount > 0 && (
              <span className="bg-gradient-to-br from-orange-500 to-red-500 text-white text-xs rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-md animate-pulse">
                {activeIncidentsCount > 99 ? '99+' : activeIncidentsCount}
              </span>
            )}
          </button>
        </div>

        {/* Emergency Reports - Only show if logged in */}
        {!isGuest && (
          <div>
            <button
              onClick={onOpenEmergencyReports}
              className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all duration-200 text-left group border shadow-sm hover:shadow-md ${
                isDarkMode
                  ? 'bg-gradient-to-r from-red-900/50 to-orange-900/50 hover:from-red-800/50 hover:to-orange-800/50 border-red-700/50 hover:border-red-600/50'
                  : 'bg-gradient-to-r from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 border-red-100 hover:border-red-200'
              }`}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <span className={`text-base font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Emergency Reports</span>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>View and report emergencies</p>
              </div>
              {myEmergencyReports.length > 0 && (
                <span className="bg-gradient-to-br from-red-500 to-orange-500 text-white text-xs rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-md">
                  {myEmergencyReports.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Map Layers */}
        <Section title="Map Layers" subtitle="Toggle map overlays" icon={<Layers className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <Toggle label="Traffic Heatmap" checked={heatmapEnabled} onChange={(e) => setHeatmapEnabled(e.target.checked)} isDarkMode={isDarkMode} />
          <Toggle label="Traffic Flow Layer" checked={trafficLayerEnabled} onChange={(e) => setTrafficLayerEnabled(e.target.checked)} isDarkMode={isDarkMode} />
        </Section>

        {/* Map Style */}
        <div className={`rounded-2xl border shadow-md overflow-hidden ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className={`p-5 border-b ${
            isDarkMode 
              ? 'bg-gradient-to-r from-gray-800 to-gray-750 border-gray-700' 
              : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
          }`}>
            <h3 className={`font-bold text-lg mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Map Style</h3>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Choose your preferred view</p>
          </div>
          <div className="p-5">
            <div className="space-y-2">
              <StyleButton label="☀️ Day" active={mapStyle === 'main'} onClick={() => setMapStyle('main')} isDarkMode={isDarkMode} />
              <StyleButton label="🌙 Night" active={mapStyle === 'night'} onClick={() => setMapStyle('night')} isDarkMode={isDarkMode} />
              <StyleButton label="🛰️ Satellite" active={mapStyle === 'satellite'} onClick={() => setMapStyle('satellite')} isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>

        {/* Data Layers (API-backed) */}
        <Section title="Data Layers" subtitle="City services and live data" icon={<Layers className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <Toggle label="No‑Parking & Restricted Zones" checked={parkingEnabled} onChange={(e) => setParkingEnabled(e.target.checked)} helper="Highlights areas where stopping/parking is restricted" isDarkMode={isDarkMode} />
          <Toggle 
            label="Weather & Flood" 
            checked={weatherEnabled || floodZonesEnabled} 
            onChange={(e) => {
              const isChecked = e.target.checked;
              setWeatherEnabled(isChecked);
              setFloodZonesEnabled(isChecked);
            }} 
            helper="Weather alerts, flood zones, and active floods"
            isDarkMode={isDarkMode}
          />
          <Toggle label="Traffic Monitoring" checked={trafficMonitorNewEnabled} onChange={(e) => setTrafficMonitorNewEnabled(e.target.checked)} isDarkMode={isDarkMode} />
          <Toggle label="Traffic Predictions" checked={showPredictionsPanel} onChange={(e) => setShowPredictionsPanel(e.target.checked)} helper="View traffic predictions and future congestion forecasts" isDarkMode={isDarkMode} />
          <Toggle label="Incident Prone Areas" checked={incidentProneEnabled} onChange={(e) => setIncidentProneEnabled(e.target.checked)} isDarkMode={isDarkMode} />
        </Section>

        {/* Helpful hint */}
        <div className={`text-xs px-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Designed for a Google Maps-like feel: clean, responsive, and fast.</div>
      </div>

      {/* Footer - Logout */}
      {!isGuest && (
        <div className={`p-6 border-t ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-900' 
            : 'border-gray-100 bg-white'
        }`}>
          <button
            onClick={logout}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-semibold border transition-colors ${
              isDarkMode
                ? 'bg-red-900/50 hover:bg-red-800/50 text-red-300 border-red-700/50'
                : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      )}
      </div>
    </>
  );
};

export default TrafficMapSidebar;
