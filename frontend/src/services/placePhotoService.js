/**
 * Place Photo Service
 * Fetches real photos for places using Unsplash API
 */

class PlacePhotoService {
  constructor() {
    // Unsplash API - Free tier doesn't require auth for basic searches
    // Using Unsplash Source API for direct image access
    this.unsplashSourceUrl = 'https://source.unsplash.com';
    // Alternative: Use Unsplash API with access key if available
    this.unsplashApiUrl = 'https://api.unsplash.com';
    this.unsplashAccessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || null;
  }

  /**
   * Get photos for a place using Unsplash
   * @param {string} placeName - Name of the place
   * @param {number} count - Number of photos to return (default: 3)
   * @returns {Promise<Array>} Array of photo objects with url and title
   */
  async getPlacePhotos(placeName, count = 3) {
    try {
      // Clean the place name for search
      const searchQuery = this.cleanPlaceName(placeName);
      
      if (this.unsplashAccessKey) {
        // Use Unsplash API if access key is available
        return await this.fetchFromUnsplashAPI(searchQuery, count);
      } else {
        // Fallback to Unsplash Source (direct image URLs)
        return await this.fetchFromUnsplashSource(searchQuery, count);
      }
    } catch (error) {
      console.warn('Failed to fetch photos from Unsplash:', error);
      return [];
    }
  }

  /**
   * Clean place name for search query
   */
  cleanPlaceName(placeName) {
    if (!placeName) return 'place';
    
    // Remove common place indicators and extra words
    let cleaned = placeName
      .replace(/^(SM|SM Mall|Mall|Shopping Center|Shopping Mall)/i, '')
      .replace(/City Hall/i, 'government building')
      .replace(/Barangay/i, '')
      .replace(/Station/i, '')
      .trim();
    
    // If cleaned is too short or empty, use original
    if (cleaned.length < 3) {
      cleaned = placeName;
    }
    
    return cleaned;
  }

  /**
   * Fetch photos using Unsplash Source API (no auth required)
   * Note: Unsplash Source API is deprecated, using alternative approach
   */
  async fetchFromUnsplashSource(query, count) {
    const photos = [];
    
    // Generate unique seed based on query for consistent results
    const seed = this.hashString(query);
    
    // Use Picsum Photos (Lorem Picsum) as a reliable fallback
    // It provides random high-quality placeholder images
    const picsumBaseUrl = 'https://picsum.photos';
    
    // Also try to use Unsplash images via direct CDN (if available)
    const unsplashImageIds = [
      '1524758631624-282302140a57', // Building
      '1486406146926-c627a92ad1ab', // City
      '1514565131-fce0801e5785',     // Architecture
      '1496568816309-31d680b80e0c', // Urban
      '1514565131-fce0801e5785'      // Place
    ];
    
    for (let i = 0; i < count; i++) {
      // Use Picsum Photos with seed for consistent results
      const imageId = (seed + i) % 1000; // Use seed to get consistent image
      const imageUrl = `${picsumBaseUrl}/seed/${imageId}/800/600`;
      
      photos.push({
        url: imageUrl,
        title: `${query} - Photo ${i + 1}`,
        provider: 'Picsum',
        // Fallback to Unsplash direct CDN if Picsum fails
        fallbackUrl: `https://images.unsplash.com/photo-${unsplashImageIds[(seed + i) % unsplashImageIds.length]}?w=800&h=600&fit=crop&q=80`
      });
      
      console.log(`📷 Generated photo ${i + 1} for "${query}":`, imageUrl);
    }
    
    return photos;
  }

  /**
   * Fetch photos using Unsplash API (requires access key)
   */
  async fetchFromUnsplashAPI(query, count) {
    try {
      const response = await fetch(
        `${this.unsplashApiUrl}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&client_id=${this.unsplashAccessKey}`
      );

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        return data.results.map((photo, index) => ({
          url: photo.urls?.regular || photo.urls?.small || photo.url,
          title: photo.alt_description || photo.description || `${query} - Photo ${index + 1}`,
          provider: 'Unsplash',
          author: photo.user?.name,
          authorUrl: photo.user?.links?.html
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Unsplash API error:', error);
      return this.fetchFromUnsplashSource(query, count); // Fallback to source API
    }
  }

  /**
   * Simple string hash function for consistent image selection
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get a single featured photo for a place
   */
  async getFeaturedPhoto(placeName) {
    const photos = await this.getPlacePhotos(placeName, 1);
    return photos.length > 0 ? photos[0] : null;
  }
}

export default new PlacePhotoService();

