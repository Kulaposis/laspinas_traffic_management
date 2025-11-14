import React, { useState, useEffect } from 'react';
import { X, Bell, AlertCircle, Info, AlertTriangle, Wrench, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Announcement Banner Component
 * Displays system-wide announcements from AdminHazardCenter
 */
const AnnouncementBanner = ({ announcements = [], onDismiss }) => {
  const [expandedAnnouncements, setExpandedAnnouncements] = useState(new Set());
  const [visibleAnnouncements, setVisibleAnnouncements] = useState([]);

  useEffect(() => {
    // Filter out dismissed announcements
    const dismissedIds = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
    const visible = announcements.filter(alert => !dismissedIds.includes(alert.id));
    setVisibleAnnouncements(visible);
  }, [announcements]);

  const handleDismiss = (alertId) => {
    const dismissedIds = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
    if (!dismissedIds.includes(alertId)) {
      dismissedIds.push(alertId);
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(dismissedIds));
    }
    setVisibleAnnouncements(prev => prev.filter(a => a.id !== alertId));
    if (onDismiss) {
      onDismiss(alertId);
    }
  };

  const toggleExpand = (alertId) => {
    setExpandedAnnouncements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const getAlertStyles = (alertType) => {
    const styles = {
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        textColor: 'text-blue-900',
        textSecondary: 'text-blue-700',
        Icon: Info
      },
      warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
        textColor: 'text-yellow-900',
        textSecondary: 'text-yellow-700',
        Icon: AlertTriangle
      },
      error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        textColor: 'text-red-900',
        textSecondary: 'text-red-700',
        Icon: AlertCircle
      },
      maintenance: {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600',
        textColor: 'text-gray-900',
        textSecondary: 'text-gray-700',
        Icon: Wrench
      }
    };
    return styles[alertType] || styles.info;
  };

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleAnnouncements.map((alert) => {
        const styles = getAlertStyles(alert.alert_type);
        const isExpanded = expandedAnnouncements.has(alert.id);
        const Icon = styles.Icon;
        const messageLength = alert.message?.length || 0;
        const shouldShowExpand = messageLength > 150;

        return (
          <div
            key={alert.id}
            className={`
              ${styles.bg} ${styles.border} border-l-4 rounded-lg shadow-md
              transition-all duration-300 ease-in-out
              animate-in slide-in-from-top-2
            `}
          >
            <div className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`flex-shrink-0 ${styles.iconBg} rounded-full p-2`}>
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${styles.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className={`text-sm sm:text-base font-semibold ${styles.textColor} mb-1`}>
                        {alert.title}
                      </h3>
                      <p
                        className={`text-xs sm:text-sm ${styles.textSecondary} ${
                          !isExpanded && shouldShowExpand ? 'line-clamp-2' : ''
                        }`}
                      >
                        {alert.message}
                      </p>
                      {alert.start_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(alert.start_date).toLocaleDateString()}
                          {alert.end_date && ` - ${new Date(alert.end_date).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-start gap-1 flex-shrink-0">
                      {shouldShowExpand && (
                        <button
                          onClick={() => toggleExpand(alert.id)}
                          className={`p-1 rounded hover:bg-white/50 transition-colors ${styles.textSecondary}`}
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {alert.is_dismissible && (
                        <button
                          onClick={() => handleDismiss(alert.id)}
                          className={`p-1 rounded hover:bg-white/50 transition-colors ${styles.textSecondary}`}
                          aria-label="Dismiss"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AnnouncementBanner;

