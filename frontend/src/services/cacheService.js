/**
 * Centralized Caching Service
 * Provides in-memory and localStorage caching with TTL
 */

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.CACHE_PREFIX = 'lp_traffic_';
    this.DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate cache key
   */
  generateKey(namespace, key) {
    return `${this.CACHE_PREFIX}${namespace}_${key}`;
  }

  /**
   * Set cache in memory and localStorage
   */
  set(namespace, key, data, ttl = this.DEFAULT_TTL) {
    const cacheKey = this.generateKey(namespace, key);
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl
    };

    // Memory cache (fastest)
    this.memoryCache.set(cacheKey, cacheData);

    // LocalStorage cache (persistent)
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {

      this.clearExpired();
    }
  }

  /**
   * Get cache from memory or localStorage
   */
  get(namespace, key) {
    const cacheKey = this.generateKey(namespace, key);

    // Try memory cache first (fastest)
    let cached = this.memoryCache.get(cacheKey);

    // Fallback to localStorage
    if (!cached) {
      try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          cached = JSON.parse(stored);
          // Restore to memory cache
          this.memoryCache.set(cacheKey, cached);
        }
      } catch (error) {

        return null;
      }
    }

    if (!cached) return null;

    // Check if expired
    const age = Date.now() - cached.timestamp;
    if (age > cached.ttl) {
      this.delete(namespace, key);
      return null;
    }

    return {
      data: cached.data,
      age: Math.round(age / 1000), // age in seconds
      fresh: age < cached.ttl / 2 // consider fresh if less than half TTL
    };
  }

  /**
   * Delete specific cache
   */
  delete(namespace, key) {
    const cacheKey = this.generateKey(namespace, key);
    this.memoryCache.delete(cacheKey);
    try {
      localStorage.removeItem(cacheKey);
    } catch (error) {

    }
  }

  /**
   * Clear all cache for a namespace
   */
  clearNamespace(namespace) {
    const prefix = `${this.CACHE_PREFIX}${namespace}_`;
    
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {

    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpired() {
    const now = Date.now();

    // Clear memory cache
    for (const [key, value] of this.memoryCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.memoryCache.delete(key);
      }
    }

    // Clear localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          try {
            const cached = JSON.parse(localStorage.getItem(key));
            if (now - cached.timestamp > cached.ttl) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            // Invalid cache entry, remove it
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {

    }
  }

  /**
   * Clear all cache
   */
  clearAll() {
    this.memoryCache.clear();
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {

    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memorySize = this.memoryCache.size;
    let localStorageSize = 0;
    
    try {
      const keys = Object.keys(localStorage);
      localStorageSize = keys.filter(k => k.startsWith(this.CACHE_PREFIX)).length;
    } catch (error) {

    }

    return {
      memoryCache: memorySize,
      localStorage: localStorageSize,
      total: memorySize + localStorageSize
    };
  }
}

export default new CacheService();
