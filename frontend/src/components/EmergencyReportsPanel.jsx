import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Clock, CheckCircle, X, RefreshCw, ExternalLink } from 'lucide-react';
import emergencyService from '../services/emergencyService';
import { useAuth } from '../context/AuthContext';

/**
 * Emergency Reports Panel Component
 * Displays user's reported emergency incidents with details and status
 */
const EmergencyReportsPanel = ({ isOpen, onClose, mapRef, onEmergencyClick }) => {
  const { user } = useAuth();
  const isGuest = !user;
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchMyEmergencyReports();
    } else if (isOpen && isGuest) {
      setLoading(false);
    }
  }, [isOpen, user, isGuest]);

  const fetchMyEmergencyReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await emergencyService.getMyEmergencyReports();
      // Handle both array and object with emergencies property
      const emergenciesList = Array.isArray(data) ? data : (data.emergencies || []);
      setEmergencies(emergenciesList);
    } catch (err) {
      setError(err.message || 'Failed to load emergency reports');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyClick = (emergency) => {
    if (emergency.latitude && emergency.longitude && mapRef?.current) {
      // Fly to emergency location on map
      const targetZoom = Math.max(mapRef.current.getZoom?.() || 15, 15);
      mapRef.current.flyTo([emergency.latitude, emergency.longitude], targetZoom, { duration: 1.2 });
      
      // Call parent callback if provided
      if (onEmergencyClick) {
        onEmergencyClick(emergency);
      }
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      reported: { color: 'bg-blue-100 text-blue-700', label: 'Reported' },
      dispatched: { color: 'bg-yellow-100 text-yellow-700', label: 'Dispatched' },
      in_progress: { color: 'bg-orange-100 text-orange-700', label: 'In Progress' },
      resolved: { color: 'bg-green-100 text-green-700', label: 'Resolved' },
      cancelled: { color: 'bg-gray-100 text-gray-700', label: 'Cancelled' }
    };

    const config = statusConfig[status] || statusConfig.reported;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getSeverityBadge = (severity) => {
    const severityConfig = {
      low: { color: 'bg-green-100 text-green-700', label: 'Low' },
      medium: { color: 'bg-yellow-100 text-yellow-700', label: 'Medium' },
      high: { color: 'bg-orange-100 text-orange-700', label: 'High' },
      critical: { color: 'bg-red-100 text-red-700', label: 'Critical' }
    };

    const config = severityConfig[severity] || severityConfig.medium;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 transition-opacity duration-300 animate-fade-in backdrop-blur-sm"
        style={{ zIndex: 10004 }}
        onClick={onClose}
      />
      
      <div
        className="emergency-reports-panel fixed top-0 left-0 bottom-0 w-80 sm:w-96 bg-white shadow-2xl transform transition-all duration-300 ease-out rounded-r-3xl border-r border-gray-100 flex flex-col animate-slide-in-left overflow-hidden"
        style={{ 
          zIndex: 10005, 
          pointerEvents: 'auto', 
          visibility: 'visible', 
          opacity: 1,
          backgroundColor: '#ffffff'
        }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Emergency Reports</h2>
              <p className="text-xs text-gray-500">Your reported incidents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 transform hover:scale-110 hover:rotate-90"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 modern-scrollbar">
        {isGuest ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Login Required</h3>
            <p className="text-sm text-gray-600 mb-6 text-center max-w-xs">
              You must login to view your emergency reports. Sign in to access your reported incidents and track their status.
            </p>
            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => {
                  onClose();
                  window.location.href = '/login';
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-semibold hover:from-red-600 hover:to-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  onClose();
                  window.location.href = '/register';
                }}
                className="w-full px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200"
              >
                Create Account
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mb-4" />
            <p className="text-sm text-gray-500">Loading your reports...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Error loading reports</p>
            <p className="text-xs text-gray-500 mb-4">{error}</p>
            <button
              onClick={fetchMyEmergencyReports}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : emergencies.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">No emergency reports yet</p>
            <p className="text-xs text-gray-500 mb-4">
              Your reported emergencies will appear here
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                💡 Use the red Report Incident button on the map to report emergencies
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {emergencies.map((emergency) => (
              <div
                key={emergency.id}
                className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => handleEmergencyClick(emergency)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">
                        {emergencyService.getEmergencyIcon(emergency.emergency_type)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate mb-1">
                        {emergency.title || emergency.emergency_type?.replace('_', ' ').toUpperCase()}
                      </h4>
                      {emergency.emergency_number && (
                        <p className="text-xs text-gray-500 font-mono">
                          #{emergency.emergency_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status and Severity */}
                <div className="flex items-center space-x-2 mb-3">
                  {getStatusBadge(emergency.status)}
                  {getSeverityBadge(emergency.severity)}
                </div>

                {/* Description */}
                {emergency.description && (
                  <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                    {emergency.description}
                  </p>
                )}

                {/* Location */}
                {emergency.address && (
                  <div className="flex items-start space-x-2 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600 flex-1">{emergency.address}</p>
                  </div>
                )}

                {/* Footer Info */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(emergency.created_at || emergency.reported_at)}</span>
                  </div>
                  {emergency.latitude && emergency.longitude && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEmergencyClick(emergency);
                      }}
                      className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <span>View on Map</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Response Time */}
                {emergency.estimated_response_time && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs text-green-700 font-medium">
                        Estimated response: {emergency.estimated_response_time} min
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {emergencies.length > 0 && (
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <button
            onClick={fetchMyEmergencyReports}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      )}
      </div>
    </>
  );
};

export default EmergencyReportsPanel;

