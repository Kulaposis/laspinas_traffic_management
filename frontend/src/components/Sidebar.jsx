import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Shield,
  School,
  Users,
  Car,
  Bell,
  Map,
  Activity,
  Cloud,
  Phone,
  Camera,
  Gift,
  FileBarChart,
  AlertTriangle,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isMobileOpen, onMobileClose }) => {
  const { user } = useAuth();
  

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['citizen', 'lgu_staff', 'traffic_enforcer', 'admin']
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: FileText,
      allowedRoles: ['citizen', 'lgu_staff', 'traffic_enforcer', 'admin']
    },
    // {
    //   name: 'Violations',
    //   href: '/violations',
    //   icon: Shield,
    //   allowedRoles: ['lgu_staff', 'traffic_enforcer', 'admin']
    // },
    // {
    //   name: 'Schools',
    //   href: '/schools',
    //   icon: School,
    //   allowedRoles: ['lgu_staff', 'admin']
    // },
    // {
    //   name: 'Footprints',
    //   href: '/footprints',
    //   icon: Users,
    //   allowedRoles: ['lgu_staff', 'admin']
    // },
    {
      name: 'Parking',
      href: '/parking',
      icon: Car,
      allowedRoles: ['citizen', 'lgu_staff', 'admin']
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      allowedRoles: ['citizen', 'lgu_staff', 'traffic_enforcer', 'admin']
    },
    {
      name: 'Traffic Monitor',
      href: '/traffic',
      icon: Activity,
      allowedRoles: ['citizen', 'lgu_staff', 'traffic_enforcer', 'admin']
    },
    {
      name: 'Traffic Monitor (New)',
      href: '/traffic-monitor-new',
      icon: Activity,
      allowedRoles: ['citizen', 'lgu_staff', 'traffic_enforcer', 'admin'],
      badge: 'NEW'
    },
    {
      name: 'Traffic Map',
      href: '/traffic-map',
      icon: Map,
      allowedRoles: ['citizen', 'lgu_staff', 'traffic_enforcer', 'admin']
    },
    {
      name: 'Weather & Flood',
      href: '/weather',
      icon: Cloud,
      allowedRoles: ['citizen', 'lgu_staff', 'traffic_enforcer', 'admin']
    },
    {
      name: 'Activity Logs',
      href: '/activity-logs',
      icon: FileBarChart,
      allowedRoles: ['admin']
    },
    {
      name: 'Admin Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['admin']
    },
    {
      name: 'User Management',
      href: '/admin/users',
      icon: Users,
      allowedRoles: ['admin']
    },
    {
      name: 'System Settings',
      href: '/admin/settings',
      icon: FileBarChart,
      allowedRoles: ['admin']
    },
    {
      name: 'Emergency Center',
      href: '/emergency',
      icon: Phone,
      allowedRoles: ['citizen', 'lgu_staff', 'traffic_enforcer', 'admin']
    },
    {
      name: 'Emergency Moderation',
      href: '/emergency/moderation',
      icon: AlertTriangle,
      allowedRoles: ['admin', 'lgu_staff']
    }
  ];

  // Normalize user role to lowercase for comparison (backend returns uppercase)
  const normalizedUserRole = user?.role?.toLowerCase();
  const filteredNavigation = navigationItems.filter(item =>
    item.allowedRoles.some(role => role.toLowerCase() === normalizedUserRole)
  );

  return (
    <>
      {/* Sidebar - Mobile: drawer overlay, Desktop: static */}
      <aside
        className={`
          bg-white sidebar-container
          fixed inset-y-0 left-0 z-[60]
          w-64 lg:w-64
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
          shadow-xl lg:shadow-sm
          h-screen
          top-0
          border-r border-gray-200 lg:border-gray-100
        `}
        aria-label="Main navigation"
        style={{ display: 'block', visibility: 'visible' }}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b lg:border-b-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Map className="w-7 h-7 sm:w-8 sm:h-8 text-primary-600" />
              <h2 className="text-lg font-bold text-gray-800">TMS</h2>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={() => {
                // Restore body scroll when closing drawer
                try {
                  document.body.style.overflow = '';
                } catch {}
                onMobileClose && onMobileClose();
              }}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {filteredNavigation.length === 0 && user && (
            <div className="p-4 text-center text-sm text-gray-500">
              No navigation items available for your role.
            </div>
          )}
          <div className="space-y-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => {
                    // Single-tap navigate + close drawer + restore scroll
                    try {
                      document.body.style.overflow = '';
                    } catch {}
                    if (typeof onMobileClose === 'function') onMobileClose();
                  }}
                >
                  {({ isActive }) => (
                    <>
                      <div className={`group flex items-center px-4 py-3 mx-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600 shadow-sm transform scale-[1.02]'
                          : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-primary-50 hover:text-primary-700 hover:border-l-2 hover:border-primary-300 active:bg-primary-100 hover:shadow-sm'
                      }`}>
                        <Icon className={`w-5 h-5 mr-3 flex-shrink-0 transition-all duration-200 ${
                          isActive ? 'text-primary-600' : 'text-gray-500 group-hover:text-primary-600'
                        }`} />
                        <span className="truncate">{item.name}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 bg-primary-600 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* User Role Indicator */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-lg p-4 border border-primary-100">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-xs text-gray-600 font-medium">Logged in as</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 capitalize truncate mb-1">
              {user?.role?.replace('_', ' ')}
            </p>
            <p className="text-xs text-gray-600 truncate">{user?.email}</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
