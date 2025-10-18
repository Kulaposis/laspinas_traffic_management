import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield, Eye, EyeOff, Sparkles, Zap, Users, ChevronRight, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, registerWithEmailPassword } from '../firebase';
import toast, { Toaster } from 'react-hot-toast';

const Login = () => {
  const { login, isAuthenticated, updateUser } = useAuth();
  const location = useLocation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  // Animation on mount
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Redirect if already authenticated
  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        // Sign up logic
        if (!formData.email || !formData.password || !formData.displayName) {
          throw new Error('Please fill in all fields');
        }

        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }

        if (formData.password.length < 6) {
          throw new Error('Password should be at least 6 characters');
        }

        const result = await registerWithEmailPassword(formData.email, formData.password, formData.displayName);

        if (result.success) {
          toast.success(`Account created! Please check your email at ${formData.email} to verify your account.`);
          // Clear form
          setFormData({
            username: '',
            email: '',
            password: '',
            confirmPassword: '',
            displayName: ''
          });
          setIsSignUp(false);
        } else {
          throw new Error(result.error || 'Registration failed');
        }
      } else {
        // Login logic
        await login(formData.username, formData.password);
        toast.success('Welcome back!');
        // Navigation will be handled by the redirect logic above
      }
    } catch (error) {
      setError(error.message || (isSignUp ? 'Registration failed. Please try again.' : 'Login failed. Please try again.'));
      toast.error(error.message || (isSignUp ? 'Registration failed. Please try again.' : 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      const result = await signInWithGoogle();

      if (result.success) {
        // Persist in auth context so ProtectedRoute/App react immediately
        updateUser(result.user);

        // Try to sync with backend if no backend token exists
        try {
          const authService = (await import('../services/authService')).default;
          if (!authService.getToken()) {
            await authService.syncFirebaseUser({
              uid: result.user.uid,
              email: result.user.email,
              display_name: result.user.displayName || result.user.email.split('@')[0],
              email_verified: result.user.emailVerified
            });
          }
        } catch (syncError) {
          console.warn('Failed to sync Google user with backend:', syncError);
        }

        toast.success(`Welcome, ${result.user.full_name || result.user.displayName || 'User'}!`);
        // Navigate to dashboard
        const from = location.state?.from?.pathname || '/dashboard';
        window.location.replace(from);
      } else {
        setError(result.error || 'Google sign-in failed');
        toast.error(result.error || 'Google sign-in failed');
      }
    } catch (error) {
      setError('Google sign-in failed. Please try again.');
      toast.error('Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      displayName: ''
    });
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
        <div className="absolute top-0 left-0 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />

        <div className={`max-w-md w-full transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="bg-gradient-to-br from-primary-600 to-indigo-600 p-4 rounded-2xl shadow-2xl hover:shadow-primary-300/25 transition-all duration-300 hover:scale-105">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Traffic Management
              </h1>
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">Smart • Secure • Efficient</span>
              </div>
            </div>
          </div>

          {/* Login/Signup Form Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 hover:shadow-3xl transition-all duration-300 hover:bg-white/90">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="text-gray-600 mt-1">
                {isSignUp
                  ? 'Sign up to get started with Traffic Management'
                  : 'Sign in to continue to Traffic Management'
                }
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Error Alert */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* Sign Up Fields */}
              {isSignUp && (
                <>
                  {/* Display Name Field */}
                  <div className="space-y-2">
                    <label htmlFor="displayName" className="block text-sm font-semibold text-gray-700">
                      Full Name
                    </label>
                    <div className="relative group">
                      <input
                        id="displayName"
                        name="displayName"
                        type="text"
                        required={isSignUp}
                        value={formData.displayName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 bg-gray-50/50 focus:bg-white placeholder:text-gray-400"
                        placeholder="Enter your full name"
                        disabled={loading}
                        autoComplete="name"
                      />
                      <Users className="absolute right-3 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                      Email Address
                    </label>
                    <div className="relative group">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required={isSignUp}
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 bg-gray-50/50 focus:bg-white placeholder:text-gray-400"
                        placeholder="Enter your email address"
                        disabled={loading}
                        autoComplete="email"
                      />
                      <Mail className="absolute right-3 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                  </div>
                </>
              )}

              {/* Username Field (only for login) */}
              {!isSignUp && (
                <div className="space-y-2">
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-700">
                    Username or Email
                  </label>
                  <div className="relative group">
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required={!isSignUp}
                      value={formData.username}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 bg-gray-50/50 focus:bg-white placeholder:text-gray-400"
                      placeholder="Enter your username or email"
                      disabled={loading}
                      autoComplete="username"
                    />
                    <Users className="absolute right-3 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                </div>
              )}

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                  Password
                </label>
                <div className="relative group">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 bg-gray-50/50 focus:bg-white placeholder:text-gray-400"
                    placeholder={isSignUp ? "Create a password" : "Enter your password"}
                    disabled={loading}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field (only for signup) */}
              {isSignUp && (
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
                    Confirm Password
                  </label>
                  <div className="relative group">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required={isSignUp}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 bg-gray-50/50 focus:bg-white placeholder:text-gray-400"
                      placeholder="Confirm your password"
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                      disabled={loading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary-200/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 group"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isSignUp ? 'Creating Account...' : 'Signing you in...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5 group-hover:animate-pulse" />
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  </div>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-medium">Or continue with</span>
              </div>
            </div>

            {/* Google Sign-In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-300 rounded-xl px-6 py-4 text-gray-700 font-semibold hover:bg-gray-50 hover:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {googleLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  <span>Signing in with Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Toggle Mode */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-medium text-primary-600 hover:text-primary-500"
                  disabled={loading}
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>

            {/* Demo Accounts */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-gray-600" />
                <p className="text-sm font-semibold text-gray-700">Demo Accounts</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { role: 'Admin', username: 'admin', password: 'admin123', color: 'bg-red-50 border-red-200 text-red-700' },
                  { role: 'LGU Staff', username: 'staff', password: 'staff123', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { role: 'Enforcer', username: 'enforcer', password: 'enforcer123', color: 'bg-green-50 border-green-200 text-green-700' },
                  { role: 'Citizen', username: 'citizen', password: 'citizen123', color: 'bg-purple-50 border-purple-200 text-purple-700' }
                ].map((account, index) => (
                  <div key={index} className={`${account.color} border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer group`}>
                    <div className="text-xs font-semibold mb-1">{account.role}</div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div><span className="font-medium">User:</span> {account.username}</div>
                      <div><span className="font-medium">Pass:</span> {account.password}</div>
                    </div>
                    <ChevronRight className="w-3 h-3 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500 bg-white/50 backdrop-blur-sm rounded-full px-4 py-2 inline-block">
              Need help? Contact your system administrator
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </>
  );
};

export default Login;
