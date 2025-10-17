import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  Loader2,
  TrendingUp,
  Users,
  Shield,
  BarChart3,
  FileText,
  Settings,
  Database
} from 'lucide-react';
import logsService from '../services/logsService';

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    activityType: '',
    resourceType: '',
    isSuccessful: '',
    searchQuery: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
    totalPages: 0
  });

  const activityTypes = [
    'CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 
    'REGISTER', 'PASSWORD_CHANGE', 'PROFILE_UPDATE', 'EXPORT', 'IMPORT'
  ];

  const resourceTypes = [
    'user', 'report', 'violation', 'parking', 'notification', 
    'traffic_data', 'weather_data', 'footprint', 'school'
  ];

  useEffect(() => {
    fetchLogs();
  }, [pagination.currentPage, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        limit: pagination.itemsPerPage,
        offset: (pagination.currentPage - 1) * pagination.itemsPerPage,
        format: 'paginated' // Request paginated format
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const response = await logsService.getActivityLogs(params);
      // Backend returns paginated response with logs array and total count
      setLogs(response.logs || []);
      setPagination(prev => ({
        ...prev,
        totalItems: response.total || 0,
        totalPages: Math.ceil((response.total || 0) / pagination.itemsPerPage)
      }));
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({
      ...prev,
      currentPage: 1
    }));
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({
      ...prev,
      currentPage: page
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      userId: '',
      activityType: '',
      resourceType: '',
      isSuccessful: '',
      searchQuery: ''
    });
    setPagination(prev => ({
      ...prev,
      currentPage: 1
    }));
  };

  const exportLogs = async () => {
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const blob = await logsService.exportActivityLogs(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting logs:', err);
      setError('Failed to export logs');
    }
  };

  const getActivityIcon = (type) => {
    const iconClass = "w-5 h-5";
    switch (type) {
      case 'CREATE': return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'UPDATE': return <AlertCircle className={`${iconClass} text-yellow-500`} />;
      case 'DELETE': return <XCircle className={`${iconClass} text-red-500`} />;
      case 'LOGIN': return <User className={`${iconClass} text-blue-500`} />;
      case 'LOGOUT': return <User className={`${iconClass} text-gray-500`} />;
      case 'READ': return <Eye className={`${iconClass} text-indigo-500`} />;
      case 'REGISTER': return <Shield className={`${iconClass} text-purple-500`} />;
      case 'EXPORT': return <Download className={`${iconClass} text-teal-500`} />;
      case 'IMPORT': return <FileText className={`${iconClass} text-orange-500`} />;
      case 'PASSWORD_CHANGE': return <Settings className={`${iconClass} text-pink-500`} />;
      case 'PROFILE_UPDATE': return <Users className={`${iconClass} text-cyan-500`} />;
      default: return <Activity className={`${iconClass} text-gray-400`} />;
    }
  };

  const getStatusBadge = (isSuccessful) => {
    return isSuccessful ? (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Success
      </span>
    ) : (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
        <XCircle className="w-3 h-3 mr-1" />
        Failed
      </span>
    );
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Responsive Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Activity Logs</h1>
              <p className="text-sm sm:text-lg text-gray-600 flex items-center">
                <Database className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500" />
                Monitor system activities and user actions
              </p>
            </div>
            <div className="flex items-center justify-between sm:justify-end space-x-3">
              <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm border flex-1 sm:flex-none">
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  <span className="font-medium">{pagination.totalItems}</span>
                  <span className="hidden sm:inline">Total Logs</span>
                  <span className="sm:hidden">Logs</span>
                </div>
              </div>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 sm:p-3 shadow-sm transition-all duration-200 hover:shadow-md disabled:opacity-50"
                title="Refresh logs"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Responsive Filters Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500" />
              Filter Logs
            </h2>
            <div className="text-xs sm:text-sm text-gray-500">
              {Object.values(filters).filter(Boolean).length} active filters
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="col-span-full sm:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Search Logs
              </label>
              <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  className="pl-10 sm:pl-12 pr-4 py-2 sm:py-3 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white text-sm"
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Activity Type
              </label>
              <div className="relative">
                <Activity className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white appearance-none text-sm"
                  value={filters.activityType}
                  onChange={(e) => handleFilterChange('activityType', e.target.value)}
                >
                  <option value="">All Activities</option>
                  {activityTypes.map(type => (
                    <option key={type} value={type}>{type.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Resource Type
              </label>
              <div className="relative">
                <Database className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white appearance-none text-sm"
                  value={filters.resourceType}
                  onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                >
                  <option value="">All Resources</option>
                  {resourceTypes.map(type => (
                    <option key={type} value={type}>{type.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <div className="relative">
                <BarChart3 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white appearance-none text-sm"
                  value={filters.isSuccessful}
                  onChange={(e) => handleFilterChange('isSuccessful', e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="true">✅ Success</option>
                  <option value="false">❌ Failed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white text-sm"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white text-sm"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                User ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Enter user ID"
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white text-sm"
                  value={filters.userId}
                  onChange={(e) => handleFilterChange('userId', e.target.value)}
                />
              </div>
            </div>

          </div>
          
          {/* Responsive Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 space-y-3 sm:space-y-0">
            <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
              {logs.length > 0 && (
                <span>Showing {logs.length} of {pagination.totalItems} results</span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 order-1 sm:order-2">
              <button
                onClick={clearFilters}
                className="px-4 sm:px-6 py-2 sm:py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium flex items-center justify-center shadow-sm hover:shadow-md text-sm"
              >
                <Filter className="w-4 h-4 mr-2" />
                <span className="sm:inline">Clear Filters</span>
              </button>
              <button
                onClick={exportLogs}
                disabled={loading}
                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 font-medium flex items-center justify-center shadow-sm hover:shadow-md disabled:opacity-50 text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="sm:inline">Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8 rounded-lg shadow-sm">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-400 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error Loading Logs</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Responsive Logs Display */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500" />
                Activity Timeline
              </h3>
              <div className="text-xs sm:text-sm text-gray-600">
                {loading ? (
                  <div className="flex items-center">
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  `${logs.length} entries`
                )}
              </div>
            </div>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    <div className="flex items-center space-x-1">
                      <Activity className="w-3 h-3 lg:w-4 lg:h-4" />
                      <span>Activity</span>
                    </div>
                  </th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    <div className="flex items-center space-x-1">
                      <User className="w-3 h-3 lg:w-4 lg:h-4" />
                      <span>User</span>
                    </div>
                  </th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    <div className="flex items-center space-x-1">
                      <Database className="w-3 h-3 lg:w-4 lg:h-4" />
                      <span>Resource</span>
                    </div>
                  </th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 lg:w-4 lg:h-4" />
                      <span>Status</span>
                    </div>
                  </th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 lg:w-4 lg:h-4" />
                      <span>Time</span>
                    </div>
                  </th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    <div className="flex items-center space-x-1">
                      <FileText className="w-3 h-3 lg:w-4 lg:h-4" />
                      <span>Details</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 lg:px-6 py-12 lg:py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="w-6 h-6 lg:w-8 lg:h-8 text-blue-500 animate-spin" />
                        <div className="text-gray-500">
                          <p className="text-base lg:text-lg font-medium">Loading activity logs...</p>
                          <p className="text-xs lg:text-sm">Please wait while we fetch the data</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 lg:px-6 py-12 lg:py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <Activity className="w-6 h-6 lg:w-8 lg:h-8 text-gray-400" />
                        </div>
                        <div className="text-gray-500">
                          <p className="text-base lg:text-lg font-medium">No activity logs found</p>
                          <p className="text-xs lg:text-sm">Try adjusting your filters or check back later</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => (
                    <tr 
                      key={log.id} 
                      className="hover:bg-blue-50 transition-all duration-200 border-l-4 border-transparent hover:border-blue-400 group"
                    >
                      <td className="px-4 lg:px-6 py-3 lg:py-5">
                        <div className="flex items-center space-x-2 lg:space-x-3">
                          <div className="flex-shrink-0">
                            {getActivityIcon(log.activity_type)}
                          </div>
                          <div>
                            <div className="text-xs lg:text-sm font-semibold text-gray-900">
                              {log.activity_type.replace('_', ' ')}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              #{index + 1 + (pagination.currentPage - 1) * pagination.itemsPerPage}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-3 lg:py-5">
                        <div className="flex items-center space-x-2 lg:space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 lg:w-8 lg:h-8 bg-gray-200 rounded-full flex items-center justify-center">
                              <User className="w-3 h-3 lg:w-4 lg:h-4 text-gray-600" />
                            </div>
                          </div>
                          <div>
                            <div className="text-xs lg:text-sm font-medium text-gray-900 truncate max-w-24 lg:max-w-32">
                              {log.user_email || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {log.user_id || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-3 lg:py-5">
                        <div>
                          <div className="text-xs lg:text-sm font-medium text-gray-900 capitalize">
                            {log.resource_type?.replace('_', ' ') || 'System'}
                          </div>
                          {log.resource_id && (
                            <div className="text-xs text-gray-500 mt-1 truncate">
                              {log.resource_id}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-3 lg:py-5">
                        {getStatusBadge(log.is_successful)}
                      </td>
                      <td className="px-4 lg:px-6 py-3 lg:py-5">
                        <div className="text-xs lg:text-sm text-gray-900 font-medium">
                          {new Date(log.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-3 lg:py-5">
                        <div className="max-w-20 lg:max-w-xs">
                          <div className="text-xs lg:text-sm text-gray-900 truncate" title={log.activity_description}>
                            {log.activity_description || 'No details'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            {loading ? (
              <div className="px-4 py-12 text-center">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  <div className="text-gray-500">
                    <p className="text-sm font-medium">Loading activity logs...</p>
                    <p className="text-xs">Please wait...</p>
                  </div>
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-gray-500">
                    <p className="text-sm font-medium">No activity logs found</p>
                    <p className="text-xs">Try adjusting your filters</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {logs.map((log, index) => (
                  <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {getActivityIcon(log.activity_type)}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            {log.activity_type.replace('_', ' ')}
                          </h4>
                          <p className="text-xs text-gray-500">
                            #{index + 1 + (pagination.currentPage - 1) * pagination.itemsPerPage}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(log.is_successful)}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900 font-medium truncate max-w-32">
                            {log.user_email || 'Unknown User'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Database className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700 capitalize">
                            {log.resource_type?.replace('_', ' ') || 'System'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      
                      {log.activity_description && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {log.activity_description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Responsive Pagination */}
          {pagination.totalPages > 1 && (
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Prev
                </button>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="font-medium">{pagination.currentPage}</span>
                  <span>/</span>
                  <span>{pagination.totalPages}</span>
                </div>
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-1 sm:space-y-0">
                  <p className="text-xs sm:text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-semibold text-gray-900">
                      {(pagination.currentPage - 1) * pagination.itemsPerPage + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-semibold text-gray-900">
                      {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)}
                    </span>{' '}
                    of{' '}
                    <span className="font-semibold text-gray-900">{pagination.totalItems}</span> results
                  </p>
                  <div className="hidden sm:block h-4 w-px bg-gray-300"></div>
                  <div className="text-xs sm:text-sm text-gray-500">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </div>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px">
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1}
                      className="relative inline-flex items-center px-2 lg:px-3 py-2 rounded-l-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <ChevronLeft className="h-3 w-3 lg:h-4 lg:w-4" />
                    </button>
                    {Array.from({ length: Math.min(3, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage <= 2) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage >= pagination.totalPages - 1) {
                        pageNum = pagination.totalPages - 2 + i;
                      } else {
                        pageNum = pagination.currentPage - 1 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`relative inline-flex items-center px-3 lg:px-4 py-2 border text-xs lg:text-sm font-semibold transition-all duration-200 ${
                            pagination.currentPage === pageNum
                              ? 'z-10 bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages}
                      className="relative inline-flex items-center px-2 lg:px-3 py-2 rounded-r-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
