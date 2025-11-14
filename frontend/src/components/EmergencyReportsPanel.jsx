import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, MapPin, Clock, CheckCircle, X, RefreshCw, ExternalLink, Shield, UserCheck, MessageSquare, TrendingUp, AlertCircle, Ban } from 'lucide-react';
import emergencyService from '../services/emergencyService';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';

/**
 * Emergency Reports Panel Component
 * Displays user's reported emergency incidents with details and status
 */
const EmergencyReportsPanel = ({ isOpen, onClose, mapRef, onEmergencyClick }) => {
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();
  const isGuest = !user;
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  const fetchMyEmergencyReports = async () => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      setEmergencies([]);
      setError('Please sign in to view your emergency reports.');
      setErrorCode('not_authenticated');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      const data = await emergencyService.getMyEmergencyReports();
      // Handle both array and object with emergencies property
      const emergenciesList = Array.isArray(data) ? data : (data.emergencies || []);
      setEmergencies(emergenciesList);
    } catch (err) {
      const errorMessage = err?.message || 'Failed to load emergency reports';
      setError(errorMessage);

      if (err?.status === 401 || errorMessage.toLowerCase().includes('not authenticated')) {
        setErrorCode('not_authenticated');
      } else {
        setErrorCode(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch emergency reports when panel opens
  useEffect(() => {
    if (isOpen && user) {
      fetchMyEmergencyReports();
    } else if (isOpen && !user) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

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
    // Normalize status to lowercase for comparison
    const normalizedStatus = (status || '').toLowerCase();
    const statusConfig = {
      reported: { 
        light: 'bg-blue-100 text-blue-700', 
        dark: 'bg-blue-900 text-blue-300', 
        label: 'Reported',
        icon: AlertTriangle
      },
      dispatched: { 
        light: 'bg-yellow-100 text-yellow-700', 
        dark: 'bg-yellow-900 text-yellow-300', 
        label: 'Dispatched',
        icon: TrendingUp
      },
      in_progress: { 
        light: 'bg-orange-100 text-orange-700', 
        dark: 'bg-orange-900 text-orange-300', 
        label: 'In Progress',
        icon: Clock
      },
      resolved: { 
        light: 'bg-green-100 text-green-700', 
        dark: 'bg-green-900 text-green-300', 
        label: 'Resolved',
        icon: CheckCircle
      },
      cancelled: { 
        light: 'bg-gray-100 text-gray-700', 
        dark: 'bg-gray-700 text-gray-300', 
        label: 'Cancelled',
        icon: Ban
      }
    };

    const config = statusConfig[normalizedStatus] || statusConfig.reported;
    const color = isDarkMode ? config.dark : config.light;
    const Icon = config.icon || AlertTriangle;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getVerificationBadge = (verificationStatus, isVerified) => {
    const status = (verificationStatus || '').toLowerCase();
    const config = {
      verified: {
        light: 'bg-green-100 text-green-800 border-green-300',
        dark: 'bg-green-900/50 text-green-300 border-green-700',
        label: 'Verified',
        icon: CheckCircle,
        description: 'Report verified by admin'
      },
      rejected: {
        light: 'bg-red-100 text-red-800 border-red-300',
        dark: 'bg-red-900/50 text-red-300 border-red-700',
        label: 'Rejected',
        icon: AlertCircle,
        description: 'Report was rejected'
      },
      flagged: {
        light: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        dark: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
        label: 'Flagged',
        icon: AlertTriangle,
        description: 'Report flagged for review'
      },
      pending: {
        light: 'bg-gray-100 text-gray-800 border-gray-300',
        dark: 'bg-gray-800 text-gray-400 border-gray-700',
        label: 'Pending Review',
        icon: Clock,
        description: 'Awaiting admin review'
      }
    };

    const badgeConfig = config[status] || config.pending;
    const color = isDarkMode ? badgeConfig.dark : badgeConfig.light;
    const Icon = badgeConfig.icon || Clock;
    
    return {
      badge: (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
          <Icon className="w-3 h-3" />
          {badgeConfig.label}
        </span>
      ),
      description: badgeConfig.description
    };
  };

  const getSeverityBadge = (severity) => {
    const severityConfig = {
      low: { 
        light: 'bg-green-100 text-green-700', 
        dark: 'bg-green-900 text-green-300', 
        label: 'Low' 
      },
      medium: { 
        light: 'bg-yellow-100 text-yellow-700', 
        dark: 'bg-yellow-900 text-yellow-300', 
        label: 'Medium' 
      },
      high: { 
        light: 'bg-orange-100 text-orange-700', 
        dark: 'bg-orange-900 text-orange-300', 
        label: 'High' 
      },
      critical: { 
        light: 'bg-red-100 text-red-700', 
        dark: 'bg-red-900 text-red-300', 
        label: 'Critical' 
      }
    };

    const config = severityConfig[severity] || severityConfig.medium;
    const color = isDarkMode ? config.dark : config.light;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>
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

  // Prevent body scroll when panel is open (same as HistoryPanel)
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      
      // Prevent body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // Restore body scroll
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const panelContent = (
    <>
      {/* Backdrop */}
      <div
        className="emergency-reports-panel-backdrop fixed inset-0 bg-black bg-opacity-30 transition-opacity duration-300 animate-fade-in backdrop-blur-sm"
        style={{ zIndex: 99998, position: 'fixed' }}
        onClick={onClose}
      />
      
      {/* Panel - Using exact same structure as HistoryPanel */}
      <div
        data-emergency-reports-panel
        className={`emergency-reports-panel fixed top-0 left-0 h-full w-full sm:w-80 md:w-96 shadow-2xl transform transition-all duration-300 ease-out sm:rounded-r-3xl border-r overflow-hidden flex flex-col animate-slide-in-left ${
          isDarkMode 
            ? 'bg-gray-900 border-gray-700' 
            : 'bg-white border-gray-100'
        }`}
        style={{ 
          zIndex: 99999, 
          position: 'fixed',
          pointerEvents: 'auto', 
          visibility: 'visible', 
          opacity: 1
        }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Header */}
      <div className={`p-6 border-b flex-shrink-0 ${
        isDarkMode 
          ? 'border-gray-700 bg-gray-900' 
          : 'border-gray-100 bg-white'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isDarkMode ? 'bg-red-900' : 'bg-red-100'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Emergency Reports</h2>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Your reported incidents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-all duration-200 transform hover:scale-110 hover:rotate-90 ${
              isDarkMode 
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 modern-scrollbar">
        {isGuest ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
              isDarkMode ? 'bg-red-900' : 'bg-red-100'
            }`}>
              <AlertTriangle className={`w-10 h-10 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            </div>
            <h3 className={`text-xl font-bold mb-2 text-center ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Login Required</h3>
            <p className={`text-sm mb-6 text-center max-w-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
                className={`w-full px-6 py-3 border-2 rounded-xl font-semibold transition-all duration-200 ${
                  isDarkMode 
                    ? 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className={`w-8 h-8 animate-spin mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading your reports...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 px-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDarkMode ? 'bg-red-900' : 'bg-red-100'
            }`}>
              <AlertTriangle className={`w-8 h-8 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
            </div>
            <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Error loading reports</p>
            <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>{error}</p>
            {errorCode === 'not_authenticated' ? (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    if (onClose) {
                      onClose();
                    }
                    window.location.href = '/login';
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg text-sm font-semibold shadow hover:from-red-600 hover:to-orange-600 transition-all duration-200"
                >
                  Sign In
                </button>
                <button
                  onClick={fetchMyEmergencyReports}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isDarkMode
                      ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Try Again
                </button>
              </div>
            ) : (
              <button
                onClick={fetchMyEmergencyReports}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        ) : emergencies.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              <AlertTriangle className={`w-8 h-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            </div>
            <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>No emergency reports yet</p>
            <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Your reported emergencies will appear here
            </p>
            <div className={`border rounded-lg p-3 ${
              isDarkMode 
                ? 'bg-blue-900/30 border-blue-700' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                💡 Use the red Report Incident button on the map to report emergencies
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {emergencies.map((emergency) => {
              const isResolved = emergency.status?.toUpperCase() === 'RESOLVED';
              const isRejected = emergency.verification_status === 'rejected';
              const isInProgress = emergency.status?.toUpperCase() === 'IN_PROGRESS';
              
              return (
              <div
                key={emergency.id}
                className={`group relative p-4 sm:p-5 rounded-xl border transition-all duration-300 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] ${
                  isDarkMode 
                    ? isResolved
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-green-700/50 hover:border-green-600 hover:shadow-lg hover:shadow-green-500/10'
                      : isRejected
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-red-700/50 hover:border-red-600 hover:shadow-lg hover:shadow-red-500/10'
                      : isInProgress
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-orange-700/50 hover:border-orange-600 hover:shadow-lg hover:shadow-orange-500/10'
                      : 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-500/10'
                    : isResolved
                    ? 'bg-gradient-to-br from-white to-green-50/30 border-green-200 hover:border-green-400 hover:shadow-lg hover:shadow-green-500/10'
                    : isRejected
                    ? 'bg-gradient-to-br from-white to-red-50/30 border-red-200 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/10'
                    : isInProgress
                    ? 'bg-gradient-to-br from-white to-orange-50/30 border-orange-200 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/10'
                    : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10'
                }`}
                onClick={() => handleEmergencyClick(emergency)}
              >
                {/* Status Indicator Ribbon */}
                {(isResolved || isRejected || isInProgress) && (
                  <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${
                    isResolved 
                      ? 'bg-gradient-to-r from-green-500 to-green-600'
                      : isRejected
                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600'
                  }`}></div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      isResolved
                        ? isDarkMode ? 'bg-green-900/50 ring-2 ring-green-600/50' : 'bg-green-100 ring-2 ring-green-300/50'
                        : isRejected
                        ? isDarkMode ? 'bg-red-900/50 ring-2 ring-red-600/50' : 'bg-red-100 ring-2 ring-red-300/50'
                        : isInProgress
                        ? isDarkMode ? 'bg-orange-900/50 ring-2 ring-orange-600/50' : 'bg-orange-100 ring-2 ring-orange-300/50'
                        : isDarkMode ? 'bg-red-900' : 'bg-red-100'
                    }`}>
                      <span className="text-xl sm:text-2xl">
                        {emergencyService.getEmergencyIcon(emergency.emergency_type)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm sm:text-base font-semibold truncate mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {emergency.title || emergency.emergency_type?.replace('_', ' ').toUpperCase()}
                      </h4>
                      {emergency.emergency_number && (
                        <p className={`text-xs sm:text-sm font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          #{emergency.emergency_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status and Severity */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {getStatusBadge(emergency.status)}
                  {getSeverityBadge(emergency.severity)}
                  {/* Verification Status Badge */}
                  {emergency.verification_status && (
                    getVerificationBadge(emergency.verification_status, emergency.is_verified).badge
                  )}
                </div>

                {/* Description */}
                {emergency.description && (
                  <p className={`text-xs mb-3 line-clamp-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {emergency.description}
                  </p>
                )}

                {/* Admin Action Section - Show if admin has taken action */}
                {(emergency.verification_status && emergency.verification_status !== 'pending') || 
                 emergency.status?.toUpperCase() === 'RESOLVED' || 
                 emergency.status?.toUpperCase() === 'IN_PROGRESS' ||
                 emergency.assigned_responder ||
                 emergency.resolution_notes ? (
                  <div className={`mb-3 p-3 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/50 border-gray-700' 
                      : 'bg-blue-50/50 border-blue-200'
                  }`}>
                    <div className="flex items-start space-x-2 mb-2">
                      <Shield className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        emergency.verification_status === 'verified' 
                          ? (isDarkMode ? 'text-green-400' : 'text-green-600')
                          : emergency.verification_status === 'rejected'
                          ? (isDarkMode ? 'text-red-400' : 'text-red-600')
                          : (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold mb-1 ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          Admin Response
                        </p>
                        
                        {/* Verification Status Message */}
                        {emergency.verification_status && emergency.verification_status !== 'pending' && (
                          <p className={`text-xs mb-2 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {getVerificationBadge(emergency.verification_status, emergency.is_verified).description}
                            {emergency.verified_at && (
                              <span className="ml-1">
                                • {formatDate(emergency.verified_at)}
                              </span>
                            )}
                          </p>
                        )}

                        {/* Assigned Responder */}
                        {emergency.assigned_responder && (
                          <div className="flex items-center space-x-1.5 mb-2">
                            <UserCheck className={`w-3.5 h-3.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                            <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Assigned to: <span className="font-medium">{emergency.assigned_responder}</span>
                            </span>
                          </div>
                        )}

                        {/* Resolution Notes */}
                        {emergency.resolution_notes && (
                          <div className={`mt-2 p-2 rounded border ${
                            isDarkMode 
                              ? 'bg-gray-900/50 border-gray-600' 
                              : 'bg-white border-gray-200'
                          }`}>
                            <div className="flex items-start space-x-2">
                              <MessageSquare className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium mb-1 ${
                                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  Resolution Notes:
                                </p>
                                <p className={`text-xs ${
                                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                  {emergency.resolution_notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Verification Notes */}
                        {emergency.verification_notes && (
                          <div className={`mt-2 p-2 rounded border ${
                            isDarkMode 
                              ? 'bg-gray-900/50 border-gray-600' 
                              : 'bg-white border-gray-200'
                          }`}>
                            <div className="flex items-start space-x-2">
                              <MessageSquare className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium mb-1 ${
                                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  Admin Notes:
                                </p>
                                <p className={`text-xs ${
                                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                  {emergency.verification_notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Resolved At */}
                        {emergency.resolved_at && (
                          <div className="flex items-center space-x-1.5 mt-2">
                            <CheckCircle className={`w-3.5 h-3.5 ${
                              isDarkMode ? 'text-green-400' : 'text-green-600'
                            }`} />
                            <span className={`text-xs ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Resolved on: {formatDate(emergency.resolved_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Location */}
                {emergency.address && (
                  <div className="flex items-start space-x-2 mb-3">
                    <MapPin className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    <p className={`text-xs flex-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{emergency.address}</p>
                  </div>
                )}

                {/* Response Time Information */}
                {(emergency.estimated_response_time || emergency.actual_response_time) && (
                  <div className={`mb-3 p-2.5 rounded-lg ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border border-gray-700' 
                      : 'bg-green-50 border border-green-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <Clock className={`w-3.5 h-3.5 ${
                        isDarkMode ? 'text-green-400' : 'text-green-600'
                      }`} />
                      <div className="flex-1">
                        {emergency.actual_response_time ? (
                          <span className={`text-xs font-medium ${
                            isDarkMode ? 'text-green-300' : 'text-green-700'
                          }`}>
                            Actual response: {emergency.actual_response_time} min
                          </span>
                        ) : emergency.estimated_response_time ? (
                          <span className={`text-xs ${
                            isDarkMode ? 'text-green-300' : 'text-green-700'
                          }`}>
                            Estimated response: {emergency.estimated_response_time} min
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Info */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className={`flex items-center space-x-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Reported: {formatDate(emergency.created_at || emergency.reported_at)}</span>
                  </div>
                  {emergency.latitude && emergency.longitude && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEmergencyClick(emergency);
                      }}
                      className={`flex items-center space-x-1 text-xs font-medium transition-colors ${
                        isDarkMode 
                          ? 'text-blue-400 hover:text-blue-300' 
                          : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      <span>View on Map</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {emergencies.length > 0 && (
        <div className={`p-4 border-t flex-shrink-0 ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-800' 
            : 'border-gray-100 bg-gray-50'
        }`}>
          <button
            onClick={fetchMyEmergencyReports}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-2 border rounded-lg text-sm font-semibold transition-colors ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' 
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      )}
      </div>
    </>
  );

  // Render panel using portal to ensure it's always on top
  return createPortal(panelContent, document.body);
};

export default EmergencyReportsPanel;

