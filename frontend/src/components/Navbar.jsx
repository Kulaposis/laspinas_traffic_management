import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, LogOut, Settings, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const Navbar = ({ onMobileMenuClick }) => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close on outside click or on Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <nav className="navbar-container">
      <div className="w-full px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between w-full max-w-full">
          <div className="flex items-center space-x-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => {
                // Lock body scroll when opening drawer
                try {
                  document.body.style.overflow = 'hidden';
                } catch {}
                onMobileMenuClick && onMobileMenuClick();
              }}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Title - Responsive */}
            <h1 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 truncate flex-shrink-0">
              <span className="hidden sm:inline">Traffic Management System</span>
              <span className="sm:hidden">TMS</span>
            </h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Notifications */}
            <NotificationBell />

            {/* User Menu */}
            <div className="relative">
              <button
                ref={buttonRef}
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-full p-1"
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-primary-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">
                  {user?.full_name}
                </span>
              </button>

              {showUserMenu && (
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label="User menu"
                  className="absolute right-0 mt-2 w-64 sm:w-72 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-50 overflow-hidden max-w-[calc(100vw-1rem)] sm:max-w-sm"
                >
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    <p className="mt-1 inline-block text-[11px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 capitalize">{user?.role?.replace('_', ' ')}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        // Navigate to profile/settings
                      }}
                      className="flex items-center px-4 py-3 w-full text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors active:bg-gray-200"
                    >
                      <Settings className="w-4 h-4 mr-3 text-gray-500" />
                      Settings
                    </button>

                    <div className="my-1 border-t border-gray-100" />

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="flex items-center px-4 py-3 w-full text-left text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none transition-colors active:bg-red-100"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
