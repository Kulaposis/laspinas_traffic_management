import { supabase } from '../config/supabase';

/**
 * Supabase Storage Service
 * Handles file uploads to Supabase Storage
 */
class SupabaseStorageService {
  constructor() {
    this.bucketName = 'emergency-photos'; // Default bucket name
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.isConfigured = this.checkConfiguration();
  }

  /**
   * Check if Supabase is properly configured
   */
  checkConfiguration() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(url && key && url.trim() !== '' && key.trim() !== '');
  }

  /**
   * Upload a photo file to Supabase Storage
   * @param {File} file - The file to upload
   * @param {string} folder - Optional folder path (default: 'incidents')
   * @returns {Promise<string>} - The public URL of the uploaded file
   */
  async uploadPhoto(file, folder = 'incidents') {
    try {
      // Check if Supabase is configured
      if (!this.isConfigured) {
        throw new Error('Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
      }

      // Validate file size
      if (file.size > this.maxFileSize) {
        throw new Error(`File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`);
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = file.name.split('.').pop();
      const filename = `${folder}/${timestamp}_${randomString}.${fileExtension}`;

      

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filename);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      
      return urlData.publicUrl;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Upload multiple photos
   * @param {File[]} files - Array of files to upload
   * @param {string} folder - Optional folder path
   * @returns {Promise<string[]>} - Array of public URLs
   */
  async uploadPhotos(files, folder = 'incidents') {
    try {
      const uploadPromises = files.map(file => this.uploadPhoto(file, folder));
      const urls = await Promise.all(uploadPromises);
      return urls;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Delete a photo from Supabase Storage
   * @param {string} filePath - The path to the file in storage
   * @returns {Promise<void>}
   */
  async deletePhoto(filePath) {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Get public URL for a file
   * @param {string} filePath - The path to the file in storage
   * @returns {string} - Public URL
   */
  getPublicUrl(filePath) {
    const { data } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);
    return data?.publicUrl || '';
  }

  /**
   * Get signed URL for a file (for private buckets)
   * @param {string} filePath - The path to the file in storage
   * @param {number} expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   * @returns {Promise<string>} - Signed URL
   */
  async getSignedUrl(filePath, expiresIn = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      return data?.signedUrl || '';
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Get URLs for multiple files (supports both public and signed URLs)
   * @param {string[]} filePaths - Array of file paths
   * @param {boolean} useSignedUrls - Whether to use signed URLs (default: false, uses public URLs)
   * @returns {Promise<string[]>} - Array of URLs
   */
  async getUrls(filePaths, useSignedUrls = false) {
    try {
      if (useSignedUrls) {
        const urlPromises = filePaths.map(path => this.getSignedUrl(path));
        return await Promise.all(urlPromises);
      } else {
        return filePaths.map(path => this.getPublicUrl(path));
      }
    } catch (error) {
      
      throw error;
    }
  }
}

export default new SupabaseStorageService();

