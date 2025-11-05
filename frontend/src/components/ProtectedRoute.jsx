import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({
  children,
  requiredRole = null,
  requiredRoles = null,
  requireEmailVerification = true
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(false);

  // Add a small delay when auth state changes to prevent rapid redirects
  useEffect(() => {
    if (!loading && user) {
      setIsChecking(true);
      const timer = setTimeout(() => setIsChecking(false), 150);
      return () => clearTimeout(timer);
    }
  }, [loading, user]);

  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check email verification if required
  if (requireEmailVerification && !user.emailVerified) {
    // Redirect to email verification page
    return <Navigate to="/verify-email" state={{ from: location }} replace />;
  }

  // Role checks: support single role or array of roles (case-insensitive)
  const rolesToCheck = requiredRoles || (requiredRole ? [requiredRole] : null);
  if (rolesToCheck) {
    const userRole = user.role?.toLowerCase();
    const normalizedRoles = rolesToCheck.map(r => r?.toLowerCase());
    if (!normalizedRoles.includes(userRole)) {
      // User doesn't have required role
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
