/**
 * Tour Helper Utility
 * Manages Driver.js tour state persistence using localStorage
 * Prevents tour from restarting after page reload if already completed
 */

const TOUR_STORAGE_KEY = 'traffic_map_tour_completed';
const TOUR_PROGRESS_KEY = 'traffic_map_tour_progress';
const TOUR_VERSION = '1.0'; // Increment this to reset tour for all users when tour content changes

/**
 * Check if the user has completed the tour
 * @returns {boolean} True if tour has been completed
 */
export const hasCompletedTour = () => {
  try {
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!stored) return false;
    
    const data = JSON.parse(stored);
    // Check if version matches (allows resetting tour when content changes)
    if (data.version !== TOUR_VERSION) {
      // Version mismatch, clear old data
      localStorage.removeItem(TOUR_STORAGE_KEY);
      return false;
    }
    
    return data.completed === true;
  } catch (error) {
    console.warn('Error checking tour completion:', error);
    return false;
  }
};

/**
 * Mark the tour as completed
 */
export const markTourCompleted = () => {
  try {
    const data = {
      completed: true,
      version: TOUR_VERSION,
      completedAt: new Date().toISOString()
    };
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Error marking tour as completed:', error);
  }
};

/**
 * Reset tour completion (for testing or admin purposes)
 */
export const resetTour = () => {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch (error) {
    console.warn('Error resetting tour:', error);
  }
};

/**
 * Check if user is new (hasn't completed tour)
 * Works for both logged-in users and guest mode
 * @returns {boolean} True if user is new
 */
export const isNewUser = () => {
  return !hasCompletedTour();
};

/**
 * Save the current tour progress
 * @param {number} stepIndex - The current step index
 * @param {number} totalSteps - Total number of steps
 */
export const saveTourProgress = (stepIndex, totalSteps) => {
  try {
    const data = {
      stepIndex,
      totalSteps,
      version: TOUR_VERSION,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(TOUR_PROGRESS_KEY, JSON.stringify(data));
    console.log('Tour progress saved:', stepIndex, 'of', totalSteps);
  } catch (error) {
    console.warn('Error saving tour progress:', error);
  }
};

/**
 * Get the saved tour progress
 * @returns {Object|null} Progress object with stepIndex and totalSteps, or null if no progress saved
 */
export const getTourProgress = () => {
  try {
    const stored = localStorage.getItem(TOUR_PROGRESS_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    
    // Check if version matches
    if (data.version !== TOUR_VERSION) {
      localStorage.removeItem(TOUR_PROGRESS_KEY);
      return null;
    }
    
    // Check if progress is recent (within last 24 hours)
    const savedAt = new Date(data.savedAt);
    const now = new Date();
    const hoursSince = (now - savedAt) / (1000 * 60 * 60);
    
    if (hoursSince > 24) {
      // Progress is too old, clear it
      localStorage.removeItem(TOUR_PROGRESS_KEY);
      return null;
    }
    
    return {
      stepIndex: data.stepIndex,
      totalSteps: data.totalSteps
    };
  } catch (error) {
    console.warn('Error getting tour progress:', error);
    return null;
  }
};

/**
 * Clear the saved tour progress
 */
export const clearTourProgress = () => {
  try {
    localStorage.removeItem(TOUR_PROGRESS_KEY);
    console.log('Tour progress cleared');
  } catch (error) {
    console.warn('Error clearing tour progress:', error);
  }
};

