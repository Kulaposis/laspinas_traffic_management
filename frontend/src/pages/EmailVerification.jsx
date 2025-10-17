import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, checkForEmailVerificationAction, handleEmailVerificationAction } from '../firebase';
import toast from 'react-hot-toast';

const EmailVerification = () => {
  const { user, resendVerificationEmail, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const from = location.state?.from?.pathname || '/';

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    setResendCooldown(60); // 60 seconds cooldown

    try {
      const result = await resendVerificationEmail();
      if (result.success) {
        toast.success('Verification email sent! Please check your inbox.');
      } else {
        toast.error('Failed to send verification email. Please try again.');
      }
    } catch (error) {
      toast.error('Failed to send verification email. Please try again.');
      console.error('Error resending verification email:', error);
    } finally {
      setIsResending(false);
    }
  };


  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Error logging out');
    }
  };

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Check for email verification action code in URL and handle auto-redirect
  useEffect(() => {
    const handleEmailVerificationFromURL = async () => {
      const actionCode = checkForEmailVerificationAction();

      if (actionCode) {
        try {
          const result = await handleEmailVerificationAction(actionCode);
          if (result.success) {
            toast.success(`Email verified successfully! Welcome, ${result.email}`);
            // Force page reload to ensure auth state is properly updated
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            toast.error('Failed to verify email. Please try again.');
            console.error('Email verification failed:', result.error);
          }
        } catch (error) {
          toast.error('Failed to verify email. Please try again.');
          console.error('Error verifying email:', error);
        }
      } else {
        // Check if we're on a Firebase domain and should redirect
        const isFirebaseDomain = window.location.hostname.includes('firebase');
        if (isFirebaseDomain && user?.emailVerified) {
          // User is verified and on Firebase domain, redirect to our app
          toast.success('Email verified successfully! Redirecting to dashboard...');
          setTimeout(() => {
            window.location.href = `${window.location.origin}/`;
          }, 1500);
        }
      }
    };

    handleEmailVerificationFromURL();
  }, [navigate, user?.emailVerified]);

  // Enhanced verification check with reload mechanism
  useEffect(() => {
    if (user?.emailVerified) {
      // Check if this is a newly verified user (not from initial load)
      const verificationTimestamp = localStorage.getItem('emailVerificationTimestamp');
      const currentTime = Date.now();

      if (!verificationTimestamp || (currentTime - parseInt(verificationTimestamp)) > 5000) {
        // Mark this as a verification event
        localStorage.setItem('emailVerificationTimestamp', currentTime.toString());

        toast.success('Email verified successfully! Redirecting to dashboard...');

        // Force reload to ensure auth state is properly synchronized
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      }
    }
  }, [user?.emailVerified]);

  // Auto-redirect if user becomes verified (but not if we already handled action code)
  useEffect(() => {
    if (user?.emailVerified && !checkForEmailVerificationAction()) {
      toast.success('Email verified successfully!');
      navigate(from, { replace: true });
    }
  }, [user?.emailVerified, navigate, from]);

  // Auto-redirect if user is already verified
  if (user?.emailVerified) {
    // Force reload to ensure auth state is properly synchronized
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1000);

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Email verified! Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Not Authorized</h1>
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center">
            <svg
              className="h-8 w-8 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Verify Your Email
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            We've sent a verification link to{' '}
            <span className="font-medium text-gray-900">{user.email}</span>
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10">
          <div className="space-y-6">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                To complete your registration and access all features, please verify your email address by clicking the link we sent you.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Didn't receive the email?
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>Check your spam folder or click below to resend the verification email.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleResendVerification}
                  disabled={isResending || resendCooldown > 0}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Sending...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Resend in ${resendCooldown}s`
                  ) : (
                    'Resend Verification Email'
                  )}
                </button>

                {/* Auto-redirect message */}
                <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2 text-green-700">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-sm font-medium">Waiting for email verification...</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Click the verification link in your email and you'll be automatically redirected.
                  </p>
                </div>

                {/* Manual refresh button as fallback */}
                <button
                  onClick={() => window.location.reload()}
                  className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Refresh Page (if not redirected automatically)
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleLogout}
                className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-gray-600">
          <p>
            Need help?{' '}
            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
