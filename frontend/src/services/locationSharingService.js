/**
 * Location Sharing Service
 * Enables real-time location sharing with contacts
 */

import { db } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  GeoPoint
} from 'firebase/firestore';

class LocationSharingService {
  constructor() {
    this.sharesCollection = 'location_shares';
    this.activeShares = new Map();
    this.listeners = new Map();
  }

  /**
   * Create a new location share
   */
  async createShare(shareData) {
    try {
      const {
        userId,
        userName,
        origin,
        destination,
        routeData,
        expiresInMinutes = 120 // Default 2 hours
      } = shareData;

      // Generate unique share code
      const shareCode = this.generateShareCode();

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

      // Create share document
      const share = {
        shareCode,
        userId,
        userName,
        origin: origin ? {
          name: origin.name,
          location: new GeoPoint(origin.lat, origin.lng)
        } : null,
        destination: destination ? {
          name: destination.name,
          location: new GeoPoint(destination.lat, destination.lng)
        } : null,
        routeData: routeData || null,
        currentLocation: null,
        eta: null,
        distanceRemaining: null,
        status: 'active', // active, completed, cancelled
        createdAt: serverTimestamp(),
        expiresAt,
        lastUpdated: serverTimestamp(),
        viewCount: 0
      };

      // Add to Firestore
      const docRef = await addDoc(collection(db, this.sharesCollection), share);

      return {
        id: docRef.id,
        shareCode,
        shareUrl: this.getShareUrl(shareCode),
        ...share
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * Update shared location
   */
  async updateLocation(shareId, locationData) {
    try {
      const { lat, lng, eta, distanceRemaining, speed } = locationData;

      const shareRef = doc(db, this.sharesCollection, shareId);

      await updateDoc(shareRef, {
        currentLocation: new GeoPoint(lat, lng),
        eta: eta || null,
        distanceRemaining: distanceRemaining || null,
        speed: speed || null,
        lastUpdated: serverTimestamp()
      });

      return true;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get share by code
   */
  async getShareByCode(shareCode) {
    try {
      const q = query(
        collection(db, this.sharesCollection),
        where('shareCode', '==', shareCode),
        where('status', '==', 'active')
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Share not found or expired');
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      // Check if expired
      if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        await this.cancelShare(doc.id);
        throw new Error('Share has expired');
      }

      // Increment view count
      await updateDoc(doc.ref, {
        viewCount: (data.viewCount || 0) + 1
      });

      return {
        id: doc.id,
        ...data,
        origin: data.origin ? {
          name: data.origin.name,
          lat: data.origin.location.latitude,
          lng: data.origin.location.longitude
        } : null,
        destination: data.destination ? {
          name: data.destination.name,
          lat: data.destination.location.latitude,
          lng: data.destination.location.longitude
        } : null,
        currentLocation: data.currentLocation ? {
          lat: data.currentLocation.latitude,
          lng: data.currentLocation.longitude
        } : null,
        createdAt: data.createdAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
        lastUpdated: data.lastUpdated?.toDate()
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * Subscribe to location updates
   */
  subscribeToShare(shareCode, callback) {
    try {
      const q = query(
        collection(db, this.sharesCollection),
        where('shareCode', '==', shareCode),
        where('status', '==', 'active')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          callback({ error: 'Share not found or expired' });
          return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        // Check if expired
        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
          callback({ error: 'Share has expired' });
          return;
        }

        callback({
          id: doc.id,
          ...data,
          origin: data.origin ? {
            name: data.origin.name,
            lat: data.origin.location.latitude,
            lng: data.origin.location.longitude
          } : null,
          destination: data.destination ? {
            name: data.destination.name,
            lat: data.destination.location.latitude,
            lng: data.destination.location.longitude
          } : null,
          currentLocation: data.currentLocation ? {
            lat: data.currentLocation.latitude,
            lng: data.currentLocation.longitude
          } : null,
          createdAt: data.createdAt?.toDate(),
          expiresAt: data.expiresAt?.toDate(),
          lastUpdated: data.lastUpdated?.toDate()
        });
      });

      this.listeners.set(shareCode, unsubscribe);

      return unsubscribe;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Unsubscribe from location updates
   */
  unsubscribeFromShare(shareCode) {
    const unsubscribe = this.listeners.get(shareCode);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(shareCode);
    }
  }

  /**
   * Complete a share (arrived at destination)
   */
  async completeShare(shareId) {
    try {
      const shareRef = doc(db, this.sharesCollection, shareId);

      await updateDoc(shareRef, {
        status: 'completed',
        completedAt: serverTimestamp()
      });

      return true;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Cancel a share
   */
  async cancelShare(shareId) {
    try {
      const shareRef = doc(db, this.sharesCollection, shareId);

      await updateDoc(shareRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp()
      });

      return true;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get user's active shares
   */
  async getUserShares(userId) {
    try {
      const q = query(
        collection(db, this.sharesCollection),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );

      const querySnapshot = await getDocs(q);
      const shares = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        shares.push({
          id: doc.id,
          ...data,
          shareUrl: this.getShareUrl(data.shareCode),
          createdAt: data.createdAt?.toDate(),
          expiresAt: data.expiresAt?.toDate()
        });
      });

      return shares;
    } catch (error) {

      return [];
    }
  }

  /**
   * Generate unique share code
   */
  generateShareCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Get shareable URL
   */
  getShareUrl(shareCode) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/${shareCode}`;
  }

  /**
   * Copy share URL to clipboard
   */
  async copyShareUrl(shareCode) {
    try {
      const url = this.getShareUrl(shareCode);
      await navigator.clipboard.writeText(url);
      return url;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Share via Web Share API
   */
  async shareViaWebShare(shareCode, userName) {
    try {
      const url = this.getShareUrl(shareCode);
      
      if (navigator.share) {
        await navigator.share({
          title: 'Live Location Share',
          text: `${userName} is sharing their location with you`,
          url: url
        });
        return true;
      } else {
        // Fallback to clipboard
        await this.copyShareUrl(shareCode);
        return false;
      }
    } catch (error) {

      throw error;
    }
  }
}

export default new LocationSharingService();
