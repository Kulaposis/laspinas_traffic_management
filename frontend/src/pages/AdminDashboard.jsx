import React, { useState, useEffect } from 'react';
import {
  Users,
  Settings,
  Shield,
  Activity,
  Database,
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Server,
  HardDrive,
  Cpu,
  Clock,
  FileText,
  Download,
  Upload,
  Zap,
  RefreshCw,
  Eye,
  Lock,
  Globe,
  BarChart3
} from 'lucide-react';
import adminService from '../services/adminService';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await adminService.getDashboardData();
      setDashboardData(data);
    } catch (err) {

      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const StatCard = ({ title, value, icon: Icon, color, description, trend, onClick }) => (
    <div 
      className={`card transition-all duration-300 hover:shadow-lg ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-center space-x-2">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {trend && (
              <div className={`flex items-center text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className={`w-3 h-3 mr-1 ${trend < 0 ? 'rotate-180' : ''}`} />
                {Math.abs(trend)}%
              </div>
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );

  const HealthIndicator = ({ status }) => {
    const colors = {
      healthy: 'bg-green-500',
      degraded: 'bg-yellow-500',
      unhealthy: 'bg-red-500'
    };
    
    return (
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${colors[status] || colors.unhealthy} animate-pulse`}></div>
        <span className="text-sm font-medium capitalize">{status}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { system_analytics, performance_metrics, recent_security_events, active_alerts, pending_moderation, system_health } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">System overview and management</p>
        </div>
        <div className="flex items-center space-x-3">
          <HealthIndicator status={system_health} />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Health Alert */}
      {system_health !== 'healthy' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">System Status Alert</h3>
              <p className="text-sm text-yellow-700 mt-1">
                System is currently in {system_health} state. Please check system components.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {active_alerts && active_alerts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <div className="flex">
            <Bell className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Active System Alerts</h3>
              <div className="mt-2 space-y-1">
                {active_alerts.slice(0, 3).map((alert) => (
                  <p key={alert.id} className="text-sm text-red-700">
                    • {alert.title}
                  </p>
                ))}
                {active_alerts.length > 3 && (
                  <p className="text-sm text-red-700">
                    ... and {active_alerts.length - 3} more alerts
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={system_analytics.total_users}
          icon={Users}
          color="bg-blue-500"
          description={`${system_analytics.active_users_today} active today`}
          onClick={() => window.location.href = '/admin/users'}
        />
        
        <StatCard
          title="Total Reports"
          value={system_analytics.total_reports}
          icon={FileText}
          color="bg-green-500"
          description={`${system_analytics.reports_today} today`}
          onClick={() => window.location.href = '/reports'}
        />

        <StatCard
          title="Security Events"
          value={recent_security_events.length}
          icon={Shield}
          color="bg-red-500"
          description="Unresolved events"
          onClick={() => window.location.href = '/admin/security'}
        />

        <StatCard
          title="Pending Moderation"
          value={pending_moderation}
          icon={Eye}
          color="bg-yellow-500"
          description="Emergency reports awaiting review"
          onClick={() => window.location.href = '/emergency/moderation'}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">System Performance</h2>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">CPU Usage</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${performance_metrics.cpu_usage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{performance_metrics.cpu_usage}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-600">Memory Usage</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${performance_metrics.memory_usage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{performance_metrics.memory_usage}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-600">Disk Usage</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${performance_metrics.disk_usage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{performance_metrics.disk_usage}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-gray-600">Avg Response Time</span>
              </div>
              <span className="text-sm font-medium">{performance_metrics.avg_response_time}ms</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Security Events</h2>
            <Shield className="w-5 h-5 text-gray-400" />
          </div>
          
          {recent_security_events.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-500">No recent security events</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recent_security_events.map((event) => (
                <div key={event.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`p-1 rounded-full ${adminService.getSeverityColor(event.severity)}`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{event.event_type.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-600">{event.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!event.is_resolved && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                      Unresolved
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          <Zap className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <button
            onClick={() => window.location.href = '/admin/users'}
            className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 text-center group"
          >
            <Users className="w-8 h-8 text-blue-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-gray-900">User Management</span>
          </button>

          <button
            onClick={() => window.location.href = '/admin/settings'}
            className="p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all duration-300 text-center group"
          >
            <Settings className="w-8 h-8 text-green-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-gray-900">System Settings</span>
          </button>

          <button
            onClick={() => window.location.href = '/admin/security'}
            className="p-4 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all duration-300 text-center group"
          >
            <Shield className="w-8 h-8 text-red-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-gray-900">Security</span>
          </button>

          <button
            onClick={() => window.location.href = '/emergency/moderation'}
            className="p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-300 text-center group"
          >
            <AlertTriangle className="w-8 h-8 text-purple-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-gray-900">Emergency Moderation</span>
          </button>

          <button
            onClick={() => window.location.href = '/admin/export'}
            className="p-4 border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-300 transition-all duration-300 text-center group"
          >
            <Download className="w-8 h-8 text-orange-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-gray-900">Data Export</span>
          </button>

          <button
            onClick={() => window.location.href = '/admin/maintenance'}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 text-center group"
          >
            <Server className="w-8 h-8 text-gray-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-gray-900">Maintenance</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
