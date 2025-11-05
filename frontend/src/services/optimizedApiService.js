/**
 * Optimized API Service
 * Provides caching, parallel requests, and timeout protection
 */

import cacheService from './cacheService';

class OptimizedApiService {
  constructor() {
    this.pendingRequests = new Map();
    this.DEFAULT_TIMEOUT = 10000; // 10 seconds
    this.DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch with timeout protection
   */
  fetchWithTimeout(promise, timeoutMs = this.DEFAULT_TIMEOUT) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      )
    ]);
  }

  /**
   * Deduplicate concurrent requests
   */
  async deduplicateRequest(key, requestFn) {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {

      return this.pendingRequests.get(key);
    }

    // Create new request
    const promise = requestFn()
      .finally(() => {
        // Remove from pending after completion
        this.pendingRequests.delete(key);
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Cached API call
   */
  async cachedFetch(namespace, key, fetchFn, options = {}) {
    const {
      ttl = this.DEFAULT_CACHE_TTL,
      timeout = this.DEFAULT_TIMEOUT,
      forceRefresh = false
    } = options;

    const cacheKey = `${namespace}_${key}`;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cacheService.get(namespace, key);
      if (cached) {
        `);
        return cached.data;
      }
    }

    try {
      // Deduplicate concurrent requests
      const data = await this.deduplicateRequest(
        cacheKey,
        () => this.fetchWithTimeout(fetchFn(), timeout)
      );

      // Cache the result
      cacheService.set(namespace, key, data, ttl);

      return data;
    } catch (error) {

      // Return stale cache if available
      const cached = cacheService.get(namespace, key);
      if (cached) {

        return cached.data;
      }

      throw error;
    }
  }

  /**
   * Parallel fetch with individual error handling
   */
  async parallelFetch(requests) {
    const startTime = performance.now();
    
    const results = await Promise.allSettled(
      requests.map(req => this.cachedFetch(
        req.namespace,
        req.key,
        req.fetchFn,
        req.options
      ))
    );

    const loadTime = Math.round(performance.now() - startTime);

    return results.map((result, index) => ({
      name: requests[index].name || requests[index].key,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  }

  /**
   * Batch fetch with priority
   */
  async batchFetch(highPriority = [], lowPriority = []) {
    // Fetch high priority first
    const highPriorityResults = await this.parallelFetch(highPriority);

    // Fetch low priority in background (non-blocking)
    if (lowPriority.length > 0) {
      this.parallelFetch(lowPriority)
        .then(results => {

        })
        .catch(error => {

        });
    }

    return highPriorityResults;
  }

  /**
   * Prefetch data for faster subsequent loads
   */
  async prefetch(namespace, key, fetchFn, ttl = this.DEFAULT_CACHE_TTL) {
    try {
      const data = await fetchFn();
      cacheService.set(namespace, key, data, ttl);

    } catch (error) {

    }
  }

  /**
   * Invalidate cache
   */
  invalidateCache(namespace, key = null) {
    if (key) {
      cacheService.delete(namespace, key);

    } else {
      cacheService.clearNamespace(namespace);

    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats();
  }
}

export default new OptimizedApiService();
