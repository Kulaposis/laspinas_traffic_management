import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import websocketService from './services/websocketService';
import toast from 'react-hot-toast';

// Layout components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import EmailVerification from './pages/EmailVerification';
import TrafficMap from './pages/TrafficMap';

// Lazy-loaded pages (non-map) for faster initial load
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Reports = lazy(() => import('./pages/Reports'));
// const Violations = lazy(() => import('./pages/Violations'));
// const Schools = lazy(() => import('./pages/Schools'));
// const Footprints = lazy(() => import('./pages/Footprints'));
const Parking = lazy(() => import('./pages/Parking'));
const Notifications = lazy(() => import('./pages/Notifications'));
const TrafficMonitoring = lazy(() => import('./pages/TrafficMonitoring'));
const TrafficMonitorNew = lazy(() => import('./pages/TrafficMonitorNew'));
const WeatherMonitoring = lazy(() => import('./pages/WeatherMonitoring'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const EmergencyCenter = lazy(() => import('./pages/EmergencyCenter'));
const EmergencyModeration = lazy(() => import('./pages/EmergencyModeration'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUserManagement = lazy(() => import('./pages/AdminUserManagement'));
const AdminSystemSettings = lazy(() => import('./pages/AdminSystemSettings'));
const AdminHazardCenter = lazy(() => import('./pages/AdminHazardCenter'));

// Role-based redirect component
const RoleBasedRedirect = () => {
  const { user } = useAuth();
  
  // Check if user is admin or staff (non-citizen roles)
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'lgu_staff';
  
  // Redirect to admin dashboard for admin, dashboard for staff, traffic-map for citizens
  return <Navigate to={isAdmin ? '/admin/dashboard' : isStaff ? '/dashboard' : '/traffic-map'} replace />;
};

const AppContent = () => {
  const { isAuthenticated, user, authMethod } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Handle email verification redirects from Firebase
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const isVerified = urlParams.get('verified');
    const email = urlParams.get('email');

    if (isVerified === 'true' && email && user?.emailVerified) {
      // User was verified via email link, redirect based on role
      toast.success('Email verified successfully! Welcome!');
      const isAdmin = user?.role === 'admin';
      const isStaff = user?.role === 'lgu_staff';
      navigate(isAdmin ? '/admin/dashboard' : isStaff ? '/dashboard' : '/traffic-map', { replace: true });
    }
  }, [location.search, user?.emailVerified, user?.role, navigate]);
  

  // Check if current route is mobile-only view
  const isMobileOnlyView = false; // Removed mobile-only traffic monitoring

  useEffect(() => {
    if (isAuthenticated && authMethod === 'backend') {
      websocketService.connect();
    } else {
      websocketService.disconnect();
    }

    return () => {
      websocketService.disconnect();
    };
  }, [isAuthenticated, authMethod]);

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
        {/* Public guest mode entry for live map */}
        <Route
          path="/explore"
          element={
            <div className="traffic-map-fullscreen absolute inset-0 -mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:mx-0 lg:my-0 lg:left-0 lg:right-0 lg:top-0 lg:bottom-0">
              <TrafficMap />
            </div>
          }
        />
        {/* Public alias */}
        <Route path="/map" element={<Navigate to="/explore" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Check if user is authenticated but email not verified
  // Only redirect to email verification for Firebase email/password sign-ups (not Google sign-in or backend auth)
  // Google sign-in users have their email already verified by Google, so emailVerified will be true
  // Backend-authenticated users (admin accounts) don't need email verification
  if (user && !user.emailVerified && authMethod === 'firebase') {
    return (
      <Routes>
        <Route path="/verify-email" element={<EmailVerification />} />
        <Route path="*" element={<Navigate to="/verify-email" replace />} />
      </Routes>
    );
  }

  // Mobile-only view without navbar/sidebar - removed

  return (
    <div className="lg:flex min-h-screen bg-gray-50">
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
      
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Fixed Sidebar */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area with left margin */}
      <main className="ml-0 lg:ml-64 flex-1 overflow-y-auto bg-gray-50 touch-pan-y">
        {/* Sticky Navbar */}
        <div className="sticky top-0 z-30 bg-white shadow-sm">
          <Navbar onMobileMenuClick={() => setIsMobileSidebarOpen(true)} />
        </div>

        {/* Page Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Special handling for fullscreen pages like TrafficMap */}
          <Suspense fallback={<div className="py-12 text-center text-gray-500">Loading...</div>}>
            <Routes>
              {/* Default route - redirect based on user role */}
              <Route path="/" element={<RoleBasedRedirect />} />

              {/* Public map alias */}
              <Route path="/map" element={<Navigate to="/explore" replace />} />

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
                path="/traffic-monitor-new"
                element={
                  <ProtectedRoute>
                    <TrafficMonitorNew />
                  </ProtectedRoute>
                }
              />
              {/* Public guest mode entry */}
              <Route
                path="/explore"
                element={
                  <div className="traffic-map-fullscreen absolute inset-0 -mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:mx-0 lg:my-0 lg:left-0 lg:right-0 lg:top-0 lg:bottom-0">
                    <TrafficMap />
                  </div>
                }
              />
              {/* Keep protected version for signed-in sidebar layout if you link to /traffic-map internally */}
              <Route
                path="/traffic-map"
                element={
                  <div className="traffic-map-fullscreen absolute inset-0 -mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:mx-0 lg:my-0 lg:left-0 lg:right-0 lg:top-0 lg:bottom-0">
                    <TrafficMap />
                  </div>
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
                  <ProtectedRoute requiredRoles={['admin']}>
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
              <Route
                path="/admin/hazard-center"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'lgu_staff']}>
                    <AdminHazardCenter />
                  </ProtectedRoute>
                }
              />
              {/* Catch-all route - redirect based on user role */}
              <Route path="*" element={<RoleBasedRedirect />} />
            </Routes>
          </Suspense>
        </div>

        {/* Footer */}
        <Footer />
      </main>
    </div>
  );
};

function App() {
  return <AppContent />;
}

export default App;
