import React, { useState, useEffect } from 'react';
import emergencyService from '../services/emergencyService';
import { useAuth } from '../context/AuthContext';

const EmergencyModeration = () => {
  const { user } = useAuth();
  const [moderationQueue, setModerationQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [filters, setFilters] = useState({
    priority: '',
    verification_status: ''
  });

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'lgu_staff') {
      fetchModerationQueue();
    }
  }, [user, filters]);

  const fetchModerationQueue = async () => {
    try {
      setLoading(true);
      const response = await emergencyService.getModerationQueue(filters);
      
      // Ensure photo_urls are properly handled
      if (response.pending_reports) {
        response.pending_reports.forEach((report) => {
          // If photo_urls is a string, try to parse it
          if (typeof report.photo_urls === 'string' && report.photo_urls) {
            try {
              report.photo_urls = JSON.parse(report.photo_urls);
            } catch (e) {
              console.error(`Failed to parse photo_urls for report ${report.id}:`, e);
              report.photo_urls = [];
            }
          }
          
          // Ensure it's an array
          if (!Array.isArray(report.photo_urls)) {
            report.photo_urls = [];
          }
        });
      }
      
      setModerationQueue(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModeration = async (emergencyId, status, notes = '') => {
    try {
      setModerating(true);
      await emergencyService.moderateEmergencyReport(emergencyId, {
        verification_status: status,
        verification_notes: notes
      });
      
      // Refresh the queue
      await fetchModerationQueue();
      setShowDetailModal(false);
      setSelectedReport(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setModerating(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getEmergencyIcon = (type) => {
    const icons = {
      medical: '🚑',
      accident: '🚗',
      fire: '🔥',
      crime: '🚔',
      road_hazard: '⚠️',
      vehicle_breakdown: '🔧',
      other: '📞'
    };
    return icons[type] || '📞';
  };

  if (!user || (user.role !== 'admin' && user.role !== 'lgu_staff')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Emergency Report Moderation</h1>
          <p className="text-gray-600">Review and verify emergency reports submitted by users</p>
        </div>

        {/* Statistics Cards */}
        {moderationQueue && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pending Reports</p>
                  <p className="text-2xl font-semibold text-gray-900">{moderationQueue.total_pending || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">High Priority</p>
                  <p className="text-2xl font-semibold text-gray-900">{moderationQueue.high_priority || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Flagged Reports</p>
                  <p className="text-2xl font-semibold text-gray-900">{moderationQueue.flagged_reports || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.verification_status}
                onChange={(e) => setFilters({ ...filters, verification_status: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="flagged">Flagged</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Reports Pending Moderation</h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading reports...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-600">{error}</p>
            </div>
          ) : moderationQueue.pending_reports?.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-600">No reports pending moderation</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {moderationQueue.pending_reports?.map((report) => (
                <div key={report.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl">{getEmergencyIcon(report.emergency_type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">{report.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(report.moderation_priority)}`}>
                            {report.moderation_priority.toUpperCase()}
                          </span>
                          <span className={`text-sm font-medium ${getSeverityColor(report.severity)}`}>
                            {report.severity.toUpperCase()} SEVERITY
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">#{report.emergency_number}</p>
                        <p className="text-gray-700 mb-3">{report.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Reported by: {report.reporter_name || 'Anonymous'}</span>
                          <span>•</span>
                          <span>{new Date(report.created_at).toLocaleString()}</span>
                          {report.photo_urls && report.photo_urls.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="flex items-center space-x-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{report.photo_urls.length} photo{report.photo_urls.length > 1 ? 's' : ''}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setShowDetailModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedReport && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Emergency Report Review</h3>
                  <p className="text-gray-600">#{selectedReport.emergency_number}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Report Details */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Report Details</h4>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getEmergencyIcon(selectedReport.emergency_type)}</span>
                          <div>
                            <p className="font-medium text-gray-900">{selectedReport.title}</p>
                            <p className="text-sm text-gray-600 capitalize">{selectedReport.emergency_type.replace('_', ' ')} Emergency</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Description:</p>
                          <p className="text-gray-600">{selectedReport.description || 'No description provided'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Severity:</p>
                            <p className={`font-semibold ${getSeverityColor(selectedReport.severity)}`}>
                              {selectedReport.severity.toUpperCase()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">Priority:</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedReport.moderation_priority)}`}>
                              {selectedReport.moderation_priority.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Reporter:</p>
                          <p className="text-gray-600">{selectedReport.reporter_name || 'Anonymous'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Reported At:</p>
                          <p className="text-gray-600">{new Date(selectedReport.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Photos */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Attached Photos</h4>
                    {selectedReport.photo_urls && selectedReport.photo_urls.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {selectedReport.photo_urls.map((url, index) => (
                          <div key={index} className="bg-gray-100 rounded-lg p-2">
                            <img 
                              src={url} 
                              alt={`Evidence ${index + 1}`}
                              className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity duration-200"
                              onClick={() => {
                                setSelectedPhoto(url);
                                setShowPhotoModal(true);
                              }}
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBDOTEuNzE1NyA3MCA4NS43IDE2IDE4NS43IDE4NEMxMDguMjg0IDg0IDExNS43MTYgODQgMTI0IDg0QzEzMi4yODQgODQgMTM5LjcxNiA4NCAxNDcuMyA4NEMxNTUuNzE2IDg0IDE2Mi4yODQgODQgMTcwIDg0VjE1NkMxNzAgMTY0LjI4NCAxNjMuNzE2IDE3MCA4NTUuMyAxNzBIMTQ0LjdDMTM2LjQxNiAxNzAgMTMwIDcxNi4yODQgMTMwIDcwOFY4NEMxMzAgNzUuNzE1NyAxMzYuMjg0IDcwIDE0NC43IDcwSDE1NS4zQzE2My43MTYgNzAgMTcwIDc1LjcxNTcgMTcwIDg0VjcwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">Photo {index + 1}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-8 text-center">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-600">No photos attached</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Moderation Actions */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-4">Moderation Actions</h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleModeration(selectedReport.id, 'verified', 'Report verified as legitimate emergency')}
                      disabled={moderating}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      {moderating ? 'Processing...' : 'Verify Report'}
                    </button>
                    <button
                      onClick={() => handleModeration(selectedReport.id, 'rejected', 'Report rejected - not a legitimate emergency')}
                      disabled={moderating}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      {moderating ? 'Processing...' : 'Reject Report'}
                    </button>
                    <button
                      onClick={() => handleModeration(selectedReport.id, 'flagged', 'Report flagged for further review')}
                      disabled={moderating}
                      className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      {moderating ? 'Processing...' : 'Flag for Review'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photo Modal */}
        {showPhotoModal && selectedPhoto && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowPhotoModal(false);
                  setSelectedPhoto(null);
                }}
                className="absolute top-4 right-4 z-10 p-3 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Photo */}
              <img 
                src={selectedPhoto} 
                alt="Full size evidence"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Click outside to close */}
              <div 
                className="absolute inset-0 -z-10"
                onClick={() => {
                  setShowPhotoModal(false);
                  setSelectedPhoto(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmergencyModeration;
