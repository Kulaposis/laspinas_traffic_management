import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import notificationService from '../services/notificationService';
import websocketService from '../services/websocketService';

const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUnreadCount();
    
    // Listen for real-time notifications
    const handleNewNotification = (notification) => {
      setUnreadCount(prev => prev + 1);
      setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep only 10 recent
    };

    websocketService.on('notification', handleNewNotification);
    
    return () => {
      websocketService.off('notification', handleNewNotification);
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {

    }
  };

  const fetchNotifications = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const data = await notificationService.getNotifications({ limit: 10 });
      setNotifications(data);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const handleBellClick = () => {
    setShowDropdown(!showDropdown);
    if (!showDropdown && notifications.length === 0) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {

    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {

    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleBellClick}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none active:scale-95 transition-transform"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center font-semibold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 md:w-96 max-w-md bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Notifications</h3>
              <button
                onClick={() => setShowDropdown(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 active:bg-gray-200"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-primary-600 hover:text-primary-700 mt-1 active:text-primary-800"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 sm:p-4 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors ${
                    !notification.is_read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <span className="text-lg sm:text-xl">
                        {notificationService.getNotificationTypeIcon(notification.notification_type)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {notification.title}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {notificationService.formatNotificationTime(notification.created_at)}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-200">
            <button
              onClick={() => {
                setShowDropdown(false);
                // Navigate to notifications page
                window.location.href = '/notifications';
              }}
              className="w-full text-center text-sm text-primary-600 hover:text-primary-700 active:text-primary-800 font-medium py-2 rounded-lg hover:bg-primary-50 active:bg-primary-100 transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
