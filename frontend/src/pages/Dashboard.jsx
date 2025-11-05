import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FileText,
  Shield,
  Users,
  Car,
  TrendingUp,
  AlertTriangle,
  Clock,
  MapPin,
  Activity,
  Cloud,
  Phone,
  ThermometerSun,
  Droplets,
  Eye,
  Zap,
  Bell,
  RefreshCw,
  ChevronRight,
  MessageSquare,
  Navigation,
  Gauge,
  TrendingDown,
  Calendar,
  Filter,
  Search,
  Settings,
  MoreVertical,
  Download,
  Share,
  ExternalLink
} from 'lucide-react';
import MapView from '../components/MapView';
import SmartRoutePanel from '../components/SmartRoutePanel';
import reportService from '../services/reportService';
import violationService from '../services/violationService';
import notificationService from '../services/notificationService';
import trafficService from '../services/trafficService';
import weatherService from '../services/weatherService';
import emergencyService from '../services/emergencyService';
import websocketService from '../services/websocketService';
import { useAuth } from '../context/AuthContext';
import { DashboardSkeleton } from '../components/LoadingSkeleton';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = ['admin', 'lgu_staff'].includes(user?.role?.toLowerCase());
  const [stats, setStats] = useState({
    totalReports: 0,
    pendingReports: 0,
    totalViolations: 0,
    recentNotifications: 0,
    activeIncidents: 0,
    activeEmergencies: 0,
    weatherAlerts: 0,
    trafficCondition: 'normal'
  });
  const [recentReports, setRecentReports] = useState([]);
  const [recentViolations, setRecentViolations] = useState([]);
  const [mapData, setMapData] = useState([]);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Smart Route states
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeDestination, setRouteDestination] = useState(null);
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  // Enhanced state management
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [isRealTimeActive, setIsRealTimeActive] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [emergencyBanner, setEmergencyBanner] = useState(null); // { title, location }

  // simple audible alert (beep)
  const playBeep = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      setTimeout(() => {
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.stop(ctx.currentTime + 0.25);
      }, 160);
    } catch (_) {}
  };

  // Real-time update handlers
  const handleRealTimeUpdate = useCallback((data) => {
    if (!isRealTimeActive) return;

    setLastUpdateTime(new Date());

    // Add to live updates feed
    const newUpdate = {
      id: Date.now(),
      type: data.type || 'general',
      message: data.message || 'New update received',
      timestamp: new Date(),
      priority: data.priority || 'normal',
      icon: getUpdateIcon(data.type)
    };

    setLiveUpdates(prev => [newUpdate, ...prev.slice(0, 9)]); // Keep last 10 updates

    // If a new emergency report is submitted by a citizen, route admins to Moderation first
    if (isStaff && (data.type === 'emergency_reported' || data.category === 'emergency')) {
      const title = data.title || 'New Emergency Reported';
      const locationText = data.location_name || data.address || data.location || '';
      // toast notification for new emergency
      toast((t) => (
        <div className="flex items-start gap-3">
          <span>🚨</span>
          <div className="text-sm">
            <div className="font-semibold">{title}</div>
            {locationText && <div className="text-gray-600">{locationText}</div>}
          </div>
        </div>
      ), { duration: 3000 });
      // show persistent banner and play sound
      setEmergencyBanner({ title, location: locationText });
      playBeep();
      // brief delay to let notification UI show
      setTimeout(() => navigate('/emergency-moderation'), 600);
    }

    // Note: Removed automatic fetchDashboardData() call to prevent infinite loops
    // Data will be refreshed manually or through periodic updates
  }, [isRealTimeActive, isStaff, navigate]);

  // Helper function to get appropriate icons for updates
  const getUpdateIcon = (type) => {
    const icons = {
      traffic: '🚦',
      weather: '🌤️',
      report: '📃',
      emergency: '🚨',
      violation: '⚠️'
    };
    return icons[type] || '📰';
  };

  // Filter and search functionality
  const filteredReports = recentReports.filter(report => {
    const matchesSearch = searchTerm === '' ||
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === 'all' || report.report_type === filterType;

    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    fetchDashboardData();

    // Set up WebSocket for real-time updates (only if connected)
    try {
      websocketService.connect();
      websocketService.on('dashboard_update', handleRealTimeUpdate);
      websocketService.on('traffic_update', handleRealTimeUpdate);
      websocketService.on('weather_update', handleRealTimeUpdate);
      websocketService.on('report_update', handleRealTimeUpdate);
    } catch (error) {
      
    }

    return () => {
      try {
        websocketService.off('dashboard_update', handleRealTimeUpdate);
        websocketService.off('traffic_update', handleRealTimeUpdate);
        websocketService.off('weather_update', handleRealTimeUpdate);
        websocketService.off('report_update', handleRealTimeUpdate);
      } catch (error) {
        
      }
    };
  }, []); // Remove handleRealTimeUpdate dependency to prevent infinite loops

  // Periodic refresh every 30 seconds to keep data fresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRealTimeActive) {
        fetchDashboardData();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isRealTimeActive]);

  // Initialize search functionality
  useEffect(() => {
    if (recentReports.length > 0 && searchTerm) {
      // Search is handled by filteredReports computed value
    }
  }, [recentReports, searchTerm]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch basic data
      const reportsData = await reportService.getReports({ limit: 20 });
      setRecentReports(reportsData.slice(0, 5));
      setMapData(reportsData);
      
      // Fetch violations (only for authorized users)
      let violationsData = [];
      if (isStaff) {
        violationsData = await violationService.getViolations({ limit: 5 });
        setRecentViolations(violationsData);
      }

      // Fetch new data
      const [
        trafficIncidents,
        weatherData,
        weatherAlerts,
        emergencies,
        unreadCount
      ] = await Promise.all([
        trafficService.getRoadIncidents({ is_active: true, limit: 10 }).catch(() => []),
        weatherService.getCurrentWeather().catch(() => []),
        weatherService.getWeatherAlerts({ is_active: true }).catch(() => []),
        emergencyService.getActiveEmergencies().catch(() => []),
        notificationService.getUnreadCount().catch(() => 0)
      ]);

      setActiveIncidents(trafficIncidents);
      setActiveEmergencies(emergencies);
      setCurrentWeather(weatherData.find(w => w.area_name.includes('Las Piñas')) || weatherData[0]);

      // Calculate stats
      const pendingReports = reportsData.filter(r => r.status === 'pending').length;
      const heavyTrafficCount = trafficIncidents.filter(i => 
        i.incident_type === 'traffic_jam' && ['high', 'critical'].includes(i.severity)
      ).length;

      setStats({
        totalReports: reportsData.length,
        pendingReports: pendingReports,
        totalViolations: violationsData.length,
        recentNotifications: unreadCount,
        activeIncidents: trafficIncidents.length,
        activeEmergencies: emergencies.length,
        weatherAlerts: weatherAlerts.length,
        trafficCondition: heavyTrafficCount > 3 ? 'heavy' : heavyTrafficCount > 1 ? 'moderate' : 'normal'
      });

    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  // Modern Stat Card Component
  const StatCard = ({ title, value, icon: Icon, color, description, trend, onClick, animated = false, size = 'default' }) => (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 ease-out ${onClick ? 'cursor-pointer hover:-translate-y-1 active:translate-y-0' : ''} ${animated ? 'ring-2 ring-red-200' : ''}`}
      onClick={onClick}
    >
      <div className="relative p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className={`flex-shrink-0 p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 mb-1 truncate">{title}</p>
              <div className="flex items-baseline space-x-2">
                <p className={`font-bold text-gray-900 ${size === 'large' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
                  {value}
                </p>
                {trend && (
                  <div className={`flex items-center text-sm font-medium ${trend > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {trend > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {Math.abs(trend)}%
                  </div>
                )}
              </div>
              {description && (
                <p className="text-sm text-gray-500 mt-1 truncate">{description}</p>
              )}
            </div>
          </div>

          {onClick && (
            <div className="flex-shrink-0 ml-4">
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              </div>
            </div>
          )}
        </div>

        {/* Animated pulse for active states */}
        {animated && (
          <div className="absolute top-3 right-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );

  // Modern Live Updates Widget
  const LiveUpdatesWidget = () => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Live Updates</h3>
              <p className="text-sm text-gray-500">Real-time activity feed</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isRealTimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-xs font-medium text-gray-600">
                {isRealTimeActive ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <button
              onClick={() => setIsRealTimeActive(!isRealTimeActive)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRealTimeActive ? 'text-emerald-600' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>

        {liveUpdates.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No recent updates</p>
            <p className="text-sm text-gray-400 mt-1">Updates will appear here when available</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {liveUpdates.map((update) => (
              <div
                key={update.id}
                className={`p-4 rounded-xl border-l-4 transition-all duration-200 hover:shadow-sm ${
                  update.priority === 'high' ? 'bg-red-50 border-red-400 hover:bg-red-100' :
                  update.priority === 'medium' ? 'bg-amber-50 border-amber-400 hover:bg-amber-100' :
                  'bg-blue-50 border-blue-400 hover:bg-blue-100'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-lg flex-shrink-0">{update.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-relaxed">
                      {update.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {update.timestamp.toLocaleTimeString()}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        update.priority === 'high' ? 'bg-red-100 text-red-700' :
                        update.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {update.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {isStaff && emergencyBanner && (
        <div className="fixed top-0 inset-x-0 z-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 text-red-800 shadow flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">🚨</span>
                <div>
                  <div className="font-semibold">{emergencyBanner.title}</div>
                  {emergencyBanner.location && (
                    <div className="text-sm text-red-700">{emergencyBanner.location}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/emergency-moderation')}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
                >
                  Review now
                </button>
                <button
                  onClick={() => setEmergencyBanner(null)}
                  className="px-3 py-1.5 rounded-lg bg-white text-red-700 border border-red-300 text-sm hover:bg-red-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="space-y-6 lg:space-y-8">

          {/* Modern Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Gauge className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{isStaff ? 'Admin Dashboard' : 'My Dashboard'}</h1>
                    <p className="text-gray-600 mt-1">Welcome back, {user.full_name}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isRealTimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span className="font-medium">
                      {isRealTimeActive ? 'Real-time Updates Active' : 'Updates Paused'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>Last updated: {lastUpdateTime.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <button className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                  <Download className="w-4 h-4" />
                  <span className="text-sm font-medium">Export Data</span>
                </button>
                <button className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                  <Settings className="w-4 h-4" />
                  <span className="text-sm font-medium">Settings</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modern Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
            <StatCard
              title="Active Incidents"
              value={stats.activeIncidents}
              icon={Activity}
              color={`from-${stats.trafficCondition === 'heavy' ? 'red' : stats.trafficCondition === 'moderate' ? 'orange' : 'emerald'}-500 to-${stats.trafficCondition === 'heavy' ? 'red' : stats.trafficCondition === 'moderate' ? 'orange' : 'emerald'}-600`}
              description={`Traffic: ${stats.trafficCondition}`}
              trend={stats.activeIncidents > 5 ? -12 : 8}
              onClick={() => window.location.href = '/traffic'}
              animated={stats.trafficCondition === 'heavy'}
              size="default"
            />

            <StatCard
              title="Weather Alerts"
              value={stats.weatherAlerts}
              icon={Cloud}
              color={`from-${stats.weatherAlerts > 0 ? 'orange' : 'blue'}-500 to-${stats.weatherAlerts > 0 ? 'orange' : 'blue'}-600`}
              description={currentWeather ? `${Math.round(currentWeather.temperature_celsius)}°C` : 'No data'}
              onClick={() => window.location.href = '/weather'}
              animated={stats.weatherAlerts > 0}
            />

            <StatCard
              title="Community Reports"
              value={stats.totalReports}
              icon={FileText}
              color="from-purple-500 to-purple-600"
              description={`${stats.pendingReports} pending`}
              trend={5}
              onClick={() => window.location.href = '/reports'}
            />

            <StatCard
              title="My Contribution"
              value={recentReports.filter(r => r.reporter_id === user.id).length}
              icon={Users}
              color="from-pink-500 to-pink-600"
              description="Reports submitted"
              onClick={() => window.location.href = '/reports'}
            />
          </div>

          {/* Admin Controls - visible only to admin/staff */}
          {isStaff && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Admin Controls</h2>
                    <p className="text-sm text-gray-500">Manage system data and operations</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={() => (window.location.href = '/reports')}
                  className="group p-4 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all text-left">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-semibold text-gray-900">Manage Reports</div>
                      <div className="text-xs text-gray-500">Review and triage</div>
                    </div>
                  </div>
                </button>
                <button onClick={() => (window.location.href = '/violations')}
                  className="group p-4 border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all text-left">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-red-600" />
                    <div>
                      <div className="font-semibold text-gray-900">Violations</div>
                      <div className="text-xs text-gray-500">Issue and track</div>
                    </div>
                  </div>
                </button>
                <button onClick={() => (window.location.href = '/notifications')}
                  className="group p-4 border border-gray-200 rounded-xl hover:bg-amber-50 hover:border-amber-300 transition-all text-left">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5 text-amber-600" />
                    <div>
                      <div className="font-semibold text-gray-900">Notifications</div>
                      <div className="text-xs text-gray-500">Send advisories</div>
                    </div>
                  </div>
                </button>
                <button onClick={() => (window.location.href = '/traffic')}
                  className="group p-4 border border-gray-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 transition-all text-left">
                  <div className="flex items-center space-x-3">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-gray-900">Traffic Monitoring</div>
                      <div className="text-xs text-gray-500">Live operations</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Current Weather Widget */}
          {currentWeather && (
            <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white rounded-2xl p-6 lg:p-8 shadow-lg">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-2xl">{weatherService.getWeatherIcon(currentWeather.weather_condition)}</span>
                    </div>
                    <div>
                      <h3 className="text-xl lg:text-2xl font-bold">Current Weather</h3>
                      <p className="text-blue-100 text-sm lg:text-base">{currentWeather.area_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className="text-4xl lg:text-5xl font-light">
                      {Math.round(currentWeather.temperature_celsius)}°C
                    </span>
                    <div>
                      <p className="text-lg lg:text-xl font-medium capitalize">
                        {currentWeather.weather_condition.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full lg:w-auto">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-blue-100 text-xs lg:text-sm mb-1">Humidity</p>
                    <p className="font-bold text-lg lg:text-xl">{currentWeather.humidity_percent}%</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-blue-100 text-xs lg:text-sm mb-1">Wind Speed</p>
                    <p className="font-bold text-lg lg:text-xl">{currentWeather.wind_speed_kmh || 0} km/h</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-blue-100 text-xs lg:text-sm mb-1">Rainfall</p>
                    <p className="font-bold text-lg lg:text-xl">{currentWeather.rainfall_mm} mm</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modern Alert Banner (admin/staff only) */}
          {isStaff && (stats.activeEmergencies > 0 || stats.weatherAlerts > 0 || stats.trafficCondition === 'heavy') && (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Active Alerts</h3>
                  <div className="space-y-2">
                    {stats.activeEmergencies > 0 && (
                      <div className="flex items-center space-x-3 p-3 bg-red-100 rounded-lg">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-red-800">
                          {stats.activeEmergencies} active emergency(ies) requiring attention
                        </span>
                      </div>
                    )}
                    {stats.weatherAlerts > 0 && (
                      <div className="flex items-center space-x-3 p-3 bg-orange-100 rounded-lg">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-orange-800">
                          {stats.weatherAlerts} weather alert(s) active
                        </span>
                      </div>
                    )}
                    {stats.trafficCondition === 'heavy' && (
                      <div className="flex items-center space-x-3 p-3 bg-amber-100 rounded-lg">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-amber-800">
                          Heavy traffic conditions detected across multiple areas
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modern Widgets Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            {/* Live Updates Widget - Full Width (admin/staff only) */}
            {isStaff && (
              <div className="xl:col-span-2">
                <LiveUpdatesWidget />
              </div>
            )}

            {/* Community Stats Widget */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Community Impact</h3>
                    <p className="text-sm text-gray-500">Today's statistics</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Reports Resolved Today</span>
                  <span className="font-bold text-emerald-600">
                    {recentReports.filter(r => r.status === 'resolved' &&
                      new Date(r.updated_at).toDateString() === new Date().toDateString()).length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Active Contributors</span>
                  <span className="font-bold text-blue-600">
                    {new Set(recentReports.map(r => r.reporter_id)).size}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Avg Response Time</span>
                  <span className="font-bold text-orange-600">~2.5 hrs</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Community engagement up 15%!</p>
                    <p className="text-xs text-emerald-700">Great work everyone!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modern Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            {/* Interactive Map View - Full Width */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Interactive Traffic Map</h2>
                        <p className="text-sm text-gray-500">Real-time traffic monitoring</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setShowRoutePanel(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                      >
                        <Navigation className="w-4 h-4" />
                        <span className="text-sm font-medium">Smart Route</span>
                      </button>
                      <button
                        onClick={() => setIsRealTimeActive(!isRealTimeActive)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isRealTimeActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {isRealTimeActive ? '🟢 Live' : '⏸️ Paused'}
                      </button>
                      <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0 relative">
                  <MapView
                    reports={mapData}
                    height="450px"
                    routes={routes}
                    selectedRoute={selectedRoute}
                    origin={routeOrigin}
                    destination={routeDestination}
                    onRouteClick={(route) => setSelectedRoute(route)}
                    showAllRoutes={showAllRoutes}
                  />
                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm text-gray-500 gap-2">
                    <span className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Showing {mapData.length} active reports</span>
                      {routes.length > 0 && (
                        <span className="ml-3 flex items-center space-x-1">
                          <Navigation className="w-3 h-3" />
                          <span>{routes.length} route{routes.length > 1 ? 's' : ''} available</span>
                        </span>
                      )}
                    </span>
                    <span>Last updated: {lastUpdateTime.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Recent Reports with Search */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Recent Community Reports</h2>
                      <p className="text-sm text-gray-500">Latest community submissions</p>
                    </div>
                  </div>
                  <button
                    onClick={() => window.location.href = '/reports'}
                    className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    View All →
                  </button>
                </div>

                {/* Search and Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search reports..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                    >
                      <option value="all">All Types</option>
                      <option value="traffic_jam">Traffic Jam</option>
                      <option value="accident">Accident</option>
                      <option value="road_closure">Road Closure</option>
                      <option value="construction">Construction</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {filteredReports.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium mb-2">
                      {searchTerm || filterType !== 'all' ? 'No reports match your search' : 'No recent reports'}
                    </p>
                    <p className="text-sm text-gray-400 mb-4">
                      {searchTerm || filterType !== 'all' ? 'Try adjusting your search criteria' : 'Reports will appear here when submitted'}
                    </p>
                    <button
                      onClick={() => window.location.href = '/reports'}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Submit a Report
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {filteredReports.slice(0, 6).map((report) => (
                      <div
                        key={report.id}
                        className={`p-4 rounded-xl border-l-4 transition-all duration-200 hover:shadow-md ${
                          report.reporter_id === user.id
                            ? 'bg-blue-50 border-blue-400 hover:bg-blue-100'
                            : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-semibold text-gray-900">{report.title}</h3>
                              {report.reporter_id === user.id && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                  Your Report
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                              {report.description?.substring(0, 120)}...
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(report.created_at).toLocaleDateString()}</span>
                              </span>
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize">
                                {report.report_type.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-4">
                            <span
                              className="px-3 py-1 text-xs rounded-full font-medium text-white"
                              style={{ backgroundColor: reportService.getReportStatusColor(report.status) }}
                            >
                              {report.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Violations (for authorized users) or Quick Actions */}
            {isStaff ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Recent Violations</h2>
                      <p className="text-sm text-gray-500">Latest enforcement actions</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {recentViolations.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No recent violations</p>
                      <p className="text-sm text-gray-400 mt-1">Violation records will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentViolations.map((violation) => (
                        <div key={violation.id} className="p-4 bg-red-50 border border-red-200 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-gray-900">
                              {violation.violation_number}
                            </h3>
                            <span
                              className="px-2 py-1 text-xs rounded-full font-medium text-white"
                              style={{ backgroundColor: violationService.getViolationStatusColor(violation.status) }}
                            >
                              {violation.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {violationService.getViolationTypeLabel(violation.violation_type)}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-bold text-red-600">
                              {violationService.formatFineAmount(violation.fine_amount)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(violation.issued_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
                      <p className="text-sm text-gray-500">Common tasks and shortcuts</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => window.location.href = '/reports'}
                      className="group p-4 border border-gray-200 rounded-xl hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 text-center"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 group-hover:text-purple-900">Report Issue</span>
                      <p className="text-xs text-gray-500 mt-1">Submit traffic reports</p>
                    </button>

                    <button
                      onClick={() => window.location.href = '/traffic'}
                      className="group p-4 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 text-center"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-900">Traffic Status</span>
                      <p className="text-xs text-gray-500 mt-1">Real-time updates</p>
                    </button>

                    <button
                      onClick={() => window.location.href = '/weather'}
                      className="group p-4 border border-gray-200 rounded-xl hover:bg-sky-50 hover:border-sky-300 transition-all duration-200 text-center"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Cloud className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 group-hover:text-sky-900">Weather</span>
                      <p className="text-xs text-gray-500 mt-1">Alerts & forecasts</p>
                    </button>

                    <button
                      onClick={() => window.location.href = '/emergency'}
                      className="group p-4 border border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all duration-200 text-center bg-red-50"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Phone className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-red-900">Emergency</span>
                      <p className="text-xs text-red-600 mt-1">24/7 Support</p>
                    </button>
                  </div>

                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-900">Stay Informed</h4>
                        <p className="text-sm text-blue-700">Get real-time updates on traffic conditions</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
      </div>

          {/* Modern Navigation Footer */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Quick Navigation</h2>
                  <p className="text-sm text-gray-500">Access all features instantly</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <button
                  onClick={() => window.location.href = '/traffic'}
                  className="group p-4 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 text-center"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    {stats.trafficCondition === 'heavy' && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-gray-900 group-hover:text-blue-900">Traffic</h3>
                  <p className="text-xs text-gray-500 mt-1">Live monitoring</p>
                </button>

                <button
                  onClick={() => window.location.href = '/weather'}
                  className="group p-4 border border-gray-200 rounded-xl hover:bg-sky-50 hover:border-sky-300 transition-all duration-200 text-center"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                      <Cloud className="w-5 h-5 text-white" />
                    </div>
                    {stats.weatherAlerts > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-gray-900 group-hover:text-sky-900">Weather</h3>
                  <p className="text-xs text-gray-500 mt-1">Alerts & info</p>
                </button>

                <button
                  onClick={() => window.location.href = '/emergency'}
                  className="group p-4 border border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all duration-200 text-center"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-medium text-sm text-red-900">Emergency</h3>
                  <p className="text-xs text-red-600 mt-1">24/7 support</p>
                </button>

                <button
                  onClick={() => window.location.href = '/reports'}
                  className="group p-4 border border-gray-200 rounded-xl hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 text-center"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    {stats.pendingReports > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                        {stats.pendingReports}
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-gray-900 group-hover:text-purple-900">Reports</h3>
                  <p className="text-xs text-gray-500 mt-1">Submit & track</p>
                </button>

                <button
                  onClick={() => window.location.href = '/parking'}
                  className="group p-4 border border-gray-200 rounded-xl hover:bg-green-50 hover:border-green-300 transition-all duration-200 text-center"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                    <Car className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-medium text-sm text-gray-900 group-hover:text-green-900">Parking</h3>
                  <p className="text-xs text-gray-500 mt-1">Find spots</p>
                </button>

                <button
                  onClick={() => window.location.href = '/notifications'}
                  className="group p-4 border border-gray-200 rounded-xl hover:bg-amber-50 hover:border-amber-300 transition-all duration-200 text-center"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                      <Bell className="w-5 h-5 text-white" />
                    </div>
                    {stats.recentNotifications > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                        {stats.recentNotifications}
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-gray-900 group-hover:text-amber-900">Alerts</h3>
                  <p className="text-xs text-gray-500 mt-1">Notifications</p>
                </button>
              </div>

              {/* Community Impact Section */}
              <div className="mt-8 p-6 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Community Driven</h3>
                      <p className="text-sm text-slate-600">
                        Together we're making Las Piñas safer and more efficient
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900">{stats.totalReports}</div>
                    <div className="text-sm text-slate-600">Total Reports</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Route Panel */}
      <SmartRoutePanel
        isOpen={showRoutePanel}
        onClose={() => setShowRoutePanel(false)}
        onRouteSelect={(route, origin, destination, allRoutes) => {
          setSelectedRoute(route);
          setRouteOrigin(origin);
          setRouteDestination(destination);
          setRoutes(allRoutes || []);
        }}
        onStartNavigation={(route) => {
          // Navigate to traffic map with route
          window.location.href = `/traffic?route=${route.route_id}`;
        }}
      />
    </div>
  );
};

export default Dashboard;
