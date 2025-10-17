import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Filter, 
  Search,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  ExternalLink,
  Clock,
  Star,
  Heart,
  MessageSquare,
  Zap,
  Gift,
  TrendingUp,
  MapPin,
  Users
} from 'lucide-react';
import notificationService from '../services/notificationService';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'important', 'achievements'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedNotifications, setExpandedNotifications] = useState(new Set());
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    important: 0,
    thisWeek: 0
  });

  useEffect(() => {
    fetchNotifications();
  }, [filter, selectedCategory]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = { limit: 50 };
      
      if (filter === 'unread') params.unread_only = true;
      if (selectedCategory !== 'all') params.notification_type = selectedCategory;
      
      const data = await notificationService.getNotifications(params);
      setNotifications(data);
      
      // Calculate stats
      const allNotifications = await notificationService.getNotifications({ limit: 100 });
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      setStats({
        total: allNotifications.length,
        unread: allNotifications.filter(n => !n.is_read).length,
        important: allNotifications.filter(n => n.priority === 'high').length,
        thisWeek: allNotifications.filter(n => new Date(n.created_at) > weekAgo).length
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (searchTerm) {
      return notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
             notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  const toggleExpanded = (notificationId) => {
    setExpandedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Notification categories for filtering
  const categories = [
    { value: 'all', label: 'All', icon: Bell, count: stats.total },
    { value: 'traffic_update', label: 'Traffic', icon: MapPin, count: notifications.filter(n => n.notification_type === 'traffic_update').length },
    { value: 'weather_alert', label: 'Weather', icon: AlertTriangle, count: notifications.filter(n => n.notification_type === 'weather_alert').length },
    { value: 'system_alert', label: 'System', icon: Zap, count: notifications.filter(n => n.notification_type === 'system_alert').length },
    { value: 'achievement', label: 'Rewards', icon: Gift, count: notifications.filter(n => n.notification_type === 'achievement').length },
  ];

  const getNotificationIcon = (type, priority) => {
    const iconMap = {
      traffic_update: MapPin,
      weather_alert: AlertTriangle,
      system_alert: Info,
      report_update: MessageSquare,
      achievement: Star,
      emergency_alert: AlertTriangle
    };
    
    const Icon = iconMap[type] || Bell;
    return <Icon className={`w-5 h-5 ${priority === 'high' ? 'animate-pulse' : ''}`} />;
  };

  const getNotificationActions = (notification) => {
    const actions = [];
    
    // Mark as read/unread
    if (!notification.is_read) {
      actions.push({
        label: 'Mark as read',
        icon: Check,
        onClick: () => handleMarkAsRead(notification.id),
        primary: true
      });
    }
    
    // Type-specific actions
    if (notification.notification_type === 'traffic_update') {
      actions.push({
        label: 'View on map',
        icon: ExternalLink,
        onClick: () => window.location.href = '/traffic'
      });
    } else if (notification.notification_type === 'weather_alert') {
      actions.push({
        label: 'Weather details',
        icon: ExternalLink,
        onClick: () => window.location.href = '/weather'
      });
    } else if (notification.notification_type === 'report_update') {
      actions.push({
        label: 'View report',
        icon: ExternalLink,
        onClick: () => window.location.href = '/reports'
      });
    }
    
    return actions;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Stats */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Bell className="w-8 h-8 mr-3 text-primary-600" />
              Notifications
            </h1>
            <p className="text-gray-600">Stay connected with real-time updates</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleMarkAllAsRead}
              className="btn-secondary flex items-center hover:scale-105 transition-transform"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <Bell className="w-8 h-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-900">Total</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.unread}</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-900">Unread</p>
                <p className="text-2xl font-bold text-orange-600">{stats.unread}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-900">Important</p>
                <p className="text-2xl font-bold text-red-600">{stats.important}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-900">This Week</p>
                <p className="text-2xl font-bold text-green-600">{stats.thisWeek}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 input-field"
              />
            </div>
          </div>
          
          {/* Filter Dropdown */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="all">All Notifications</option>
            <option value="unread">Unread Only</option>
            <option value="important">Important Only</option>
          </select>
        </div>

        {/* Category Tabs */}
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {categories.map(category => {
            const Icon = category.icon;
            return (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  selectedCategory === category.value
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{category.label}</span>
                {category.count > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    selectedCategory === category.value
                      ? 'bg-white bg-opacity-20 text-white'
                      : 'bg-primary-100 text-primary-600'
                  }`}>
                    {category.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Enhanced Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="card text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No matching notifications' : 'No notifications'}
            </h3>
            <p className="text-gray-500">
              {searchTerm 
                ? `No notifications match "${searchTerm}"`
                : filter === 'unread' 
                  ? "You're all caught up! 🎉"
                  : "You don't have any notifications yet."
              }
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const isExpanded = expandedNotifications.has(notification.id);
            const actions = getNotificationActions(notification);
            
            return (
              <div
                key={notification.id}
                className={`card transition-all duration-300 hover:shadow-md ${
                  !notification.is_read ? 'ring-2 ring-blue-200 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start space-x-4">
                  {/* Priority Indicator */}
                  <div className={`flex-shrink-0 w-1 h-full rounded-full ${
                    notification.priority === 'high' ? 'bg-red-500' :
                    notification.priority === 'medium' ? 'bg-orange-500' :
                    'bg-green-500'
                  }`}></div>
                  
                  {/* Icon */}
                  <div className={`flex-shrink-0 p-2 rounded-full ${
                    notification.priority === 'high' ? 'bg-red-100 text-red-600' :
                    notification.priority === 'medium' ? 'bg-orange-100 text-orange-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {getNotificationIcon(notification.notification_type, notification.priority)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {notification.title}
                          </h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            notification.notification_type === 'achievement' ? 'bg-yellow-100 text-yellow-800' :
                            notification.notification_type === 'weather_alert' ? 'bg-orange-100 text-orange-800' :
                            notification.notification_type === 'traffic_update' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {notification.notification_type.replace('_', ' ')}
                          </span>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                        
                        <p className={`text-gray-700 ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{notificationService.formatNotificationTime(notification.created_at)}</span>
                          </div>
                          <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                            notification.priority === 'high' ? 'bg-red-100 text-red-800' :
                            notification.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {notification.priority} priority
                          </span>
                          {notification.is_broadcast && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs flex items-center">
                              <Users className="w-3 h-3 mr-1" />
                              Broadcast
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {actions.length > 0 && (
                      <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-200">
                        {actions.map((action, index) => {
                          const ActionIcon = action.icon;
                          return (
                            <button
                              key={index}
                              onClick={action.onClick}
                              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                action.primary
                                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <ActionIcon className="w-4 h-4" />
                              <span>{action.label}</span>
                            </button>
                          );
                        })}
                        
                        {notification.message.length > 100 && (
                          <button
                            onClick={() => toggleExpanded(notification.id)}
                            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                          >
                            {isExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Load More Button */}
      {filteredNotifications.length > 0 && filteredNotifications.length % 50 === 0 && (
        <div className="text-center">
          <button
            onClick={fetchNotifications}
            className="btn-secondary hover:scale-105 transition-transform"
          >
            Load More Notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default Notifications;
