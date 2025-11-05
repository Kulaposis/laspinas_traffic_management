/**
 * Session Management Service
 * Handles user sessions, activity tracking, and auto-logout
 */

import Cookies from 'js-cookie';

class SessionService {
  constructor() {
    this.SESSION_KEY = 'lp_traffic_session';
    this.ACTIVITY_KEY = 'lp_last_activity';
    this.INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    this.CHECK_INTERVAL = 60 * 1000; // Check every minute
    this.activityTimer = null;
    this.checkTimer = null;
    this.onLogoutCallback = null;
  }

  /**
   * Initialize session tracking
   */
  init(onLogout) {
    this.onLogoutCallback = onLogout;
    this.updateActivity();
    this.startActivityTracking();
    this.startInactivityCheck();
  }

  /**
   * Start tracking user activity
   */
  startActivityTracking() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, this.handleActivity.bind(this), { passive: true });
    });
  }

  /**
   * Handle user activity
   */
  handleActivity() {
    // Throttle activity updates (max once per minute)
    if (this.activityTimer) return;
    
    this.activityTimer = setTimeout(() => {
      this.updateActivity();
      this.activityTimer = null;
    }, 60000); // 1 minute throttle

    this.updateActivity();
  }

  /**
   * Update last activity timestamp
   */
  updateActivity() {
    const now = Date.now();
    
    // Store in localStorage
    try {
      localStorage.setItem(this.ACTIVITY_KEY, now.toString());
    } catch (error) {
      console.warn('Error updating activity:', error);
    }

    // Store in cookie (7 days expiry)
    Cookies.set(this.ACTIVITY_KEY, now.toString(), { 
      expires: 7,
      sameSite: 'strict',
      secure: window.location.protocol === 'https:'
    });
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity() {
    // Try localStorage first
    try {
      const stored = localStorage.getItem(this.ACTIVITY_KEY);
      if (stored) return parseInt(stored, 10);
    } catch (error) {
      console.warn('Error reading activity from localStorage:', error);
    }

    // Fallback to cookie
    const cookie = Cookies.get(this.ACTIVITY_KEY);
    return cookie ? parseInt(cookie, 10) : Date.now();
  }

  /**
   * Check for inactivity and auto-logout
   */
  startInactivityCheck() {
    this.checkTimer = setInterval(() => {
      const lastActivity = this.getLastActivity();
      const inactiveTime = Date.now() - lastActivity;

      if (inactiveTime > this.INACTIVITY_TIMEOUT) {
        console.log('⏰ Session expired due to inactivity');
        this.logout('Session expired due to inactivity');
      }
    }, this.CHECK_INTERVAL);
  }

  /**
   * Create session
   */
  createSession(user, token) {
    const sessionData = {
      user,
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    // Store in localStorage
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Error creating session in localStorage:', error);
    }

    // Store token in secure cookie
    Cookies.set('auth_token', token, {
      expires: 7,
      sameSite: 'strict',
      secure: window.location.protocol === 'https:'
    });

    // Store user info in cookie
    Cookies.set('user_info', JSON.stringify(user), {
      expires: 7,
      sameSite: 'strict',
      secure: window.location.protocol === 'https:'
    });

    this.updateActivity();
  }

  /**
   * Get current session
   */
  getSession() {
    // Try localStorage first
    try {
      const stored = localStorage.getItem(this.SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        
        // Check if expired
        if (session.expiresAt && Date.now() > session.expiresAt) {
          this.logout('Session expired');
          return null;
        }
        
        return session;
      }
    } catch (error) {
      console.warn('Error reading session from localStorage:', error);
    }

    // Fallback to cookies
    const token = Cookies.get('auth_token');
    const userInfo = Cookies.get('user_info');

    if (token && userInfo) {
      try {
        return {
          user: JSON.parse(userInfo),
          token,
          createdAt: this.getLastActivity()
        };
      } catch (error) {
        console.warn('Error parsing user info from cookie:', error);
      }
    }

    return null;
  }

  /**
   * Update session data
   */
  updateSession(updates) {
    const session = this.getSession();
    if (!session) return;

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: Date.now()
    };

    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedSession));
    } catch (error) {
      console.warn('Error updating session:', error);
    }

    // Update cookies if user info changed
    if (updates.user) {
      Cookies.set('user_info', JSON.stringify(updates.user), {
        expires: 7,
        sameSite: 'strict',
        secure: window.location.protocol === 'https:'
      });
    }
  }

  /**
   * Logout and clear session
   */
  logout(reason = 'User logout') {
    console.log(`🚪 Logging out: ${reason}`);

    // Clear localStorage
    try {
      localStorage.removeItem(this.SESSION_KEY);
      localStorage.removeItem(this.ACTIVITY_KEY);
    } catch (error) {
      console.warn('Error clearing localStorage:', error);
    }

    // Clear cookies
    Cookies.remove('auth_token');
    Cookies.remove('user_info');
    Cookies.remove(this.ACTIVITY_KEY);

    // Clear timers
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    // Call logout callback
    if (this.onLogoutCallback) {
      this.onLogoutCallback(reason);
    }
  }

  /**
   * Check if session is valid
   */
  isValid() {
    const session = this.getSession();
    if (!session) return false;

    const lastActivity = this.getLastActivity();
    const inactiveTime = Date.now() - lastActivity;

    return inactiveTime < this.INACTIVITY_TIMEOUT;
  }

  /**
   * Get session info
   */
  getSessionInfo() {
    const session = this.getSession();
    if (!session) return null;

    const lastActivity = this.getLastActivity();
    const inactiveTime = Date.now() - lastActivity;
    const remainingTime = this.INACTIVITY_TIMEOUT - inactiveTime;

    return {
      user: session.user,
      createdAt: new Date(session.createdAt),
      lastActivity: new Date(lastActivity),
      inactiveMinutes: Math.floor(inactiveTime / 60000),
      remainingMinutes: Math.floor(remainingTime / 60000),
      isValid: remainingTime > 0
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
  }
}

export default new SessionService();
