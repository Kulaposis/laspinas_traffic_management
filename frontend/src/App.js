import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import websocketService from './services/websocketService';
import toast from 'react-hot-toast';

// Layout components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import EmailVerification from './pages/EmailVerification';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
// import Violations from './pages/Violations';
// import Schools from './pages/Schools';
// import Footprints from './pages/Footprints';
import Parking from './pages/Parking';
import Notifications from './pages/Notifications';
import TrafficMonitoring from './pages/TrafficMonitoring';
import TrafficMap from './pages/TrafficMap';
import WeatherMonitoring from './pages/WeatherMonitoring';
import ActivityLogs from './pages/ActivityLogs';
import EmergencyCenter from './pages/EmergencyCenter';
import EmergencyModeration from './pages/EmergencyModeration';
import AdminDashboard from './pages/AdminDashboard';
import AdminUserManagement from './pages/AdminUserManagement';
import AdminSystemSettings from './pages/AdminSystemSettings';

const AppContent = () => {
  const { isAuthenticated, user } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Handle email verification redirects from Firebase
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const isVerified = urlParams.get('verified');
    const email = urlParams.get('email');

    if (isVerified === 'true' && email && user?.emailVerified) {
      // User was verified via email link, redirect to dashboard
      toast.success('Email verified successfully! Welcome!');
      navigate('/dashboard', { replace: true });
    }
  }, [location.search, user?.emailVerified, navigate]);
  

  // Check if current route is mobile-only view
  const isMobileOnlyView = false; // Removed mobile-only traffic monitoring

  useEffect(() => {
    if (isAuthenticated) {
      websocketService.connect();
    } else {
      websocketService.disconnect();
    }

    return () => {
      websocketService.disconnect();
    };
  }, [isAuthenticated]);

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  // Lock/unlock body scroll based on drawer state
  useEffect(() => {
    try {
      document.body.style.overflow = isMobileSidebarOpen ? 'hidden' : '';
    } catch {}
  }, [isMobileSidebarOpen]);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Check if user is authenticated but email not verified
  if (user && !user.emailVerified) {
    return (
      <Routes>
        <Route path="/verify-email" element={<EmailVerification />} />
        <Route path="*" element={<Navigate to="/verify-email" replace />} />
      </Routes>
    );
  }

  // Mobile-only view without navbar/sidebar - removed

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row layout-container">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Desktop: always visible, Mobile: drawer */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Sticky Navbar */}
        <div className="sticky top-0 z-30 bg-white shadow-sm">
          <Navbar onMobileMenuClick={() => setIsMobileSidebarOpen(true)} />
        </div>

        {/* Main Content */}
        <main className="flex-1 content-area overflow-x-hidden">
          <div className="max-w-7xl mx-auto content-wrapper px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              {/* <Route
                path="/violations"
                element={
                  <ProtectedRoute>
                    <Violations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schools"
                element={
                  <ProtectedRoute>
                    <Schools />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/footprints"
                element={
                  <ProtectedRoute>
                    <Footprints />
                  </ProtectedRoute>
                }
              /> */}
              <Route
                path="/parking"
                element={
                  <ProtectedRoute>
                    <Parking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/traffic"
                element={
                  <ProtectedRoute>
                    <TrafficMonitoring />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/traffic-map"
                element={
                  <ProtectedRoute>
                    <TrafficMap />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/weather"
                element={
                  <ProtectedRoute>
                    <WeatherMonitoring />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/activity-logs"
                element={
                  <ProtectedRoute>
                    <ActivityLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/emergency"
                element={
                  <ProtectedRoute>
                    <EmergencyCenter />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/emergency/moderation"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'lgu_staff']}>
                    <EmergencyModeration />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminUserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminSystemSettings />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

function App() {
  return <AppContent />;
}

export default App;
