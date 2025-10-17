import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Toast Notification Component
 * Google Maps/Waze style toast notifications
 */
const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose && onClose(), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose && onClose(), 300);
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-600',
          icon: CheckCircle,
          iconColor: 'text-white'
        };
      case 'error':
        return {
          bg: 'bg-red-600',
          icon: AlertCircle,
          iconColor: 'text-white'
        };
      case 'warning':
        return {
          bg: 'bg-orange-600',
          icon: AlertCircle,
          iconColor: 'text-white'
        };
      default:
        return {
          bg: 'bg-gray-800',
          icon: Info,
          iconColor: 'text-white'
        };
    }
  };

  const { bg, icon: Icon, iconColor } = getTypeStyles();

  return (
    <div
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-50
        ${bg} text-white rounded-full shadow-2xl
        px-6 py-3 flex items-center space-x-3
        transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        toast-enter
      `}
    >
      <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0`} />
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={handleClose}
        className="ml-2 hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Toast Container Component
 * Manages multiple toast notifications
 */
export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  // Expose method to add toasts
  useEffect(() => {
    window.showToast = (message, type = 'info', duration = 3000) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type, duration }]);
    };

    return () => {
      delete window.showToast;
    };
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ top: `${4 + index * 4}rem` }}
          className="fixed left-1/2 transform -translate-x-1/2 z-50"
        >
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </>
  );
};

export default Toast;

