/**
 * Incident Reporting Service
 * Handles real-time incident reporting and retrieval
 */

import { db, storage } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  getDoc,
  serverTimestamp,
  increment,
  GeoPoint
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

class IncidentReportingService {
  constructor() {
    this.incidentsCollection = 'traffic_incidents';
    this.maxImageSize = 5 * 1024 * 1024; // 5MB
  }

  /**
   * Report a new incident
   */
  async reportIncident(incidentData) {
    try {
      const { lat, lng, type, description, severity, photo, userId, userName } = incidentData;

      // Validate required fields
      if (!lat || !lng || !type) {
        throw new Error('Missing required fields: lat, lng, type');
      }

      // Prepare incident document
      const incident = {
        location: new GeoPoint(lat, lng),
        type, // accident, police, hazard, road_closure, construction, flooding, etc.
        description: description || '',
        severity: severity || 'medium', // low, medium, high
        reportedBy: userId || 'anonymous',
        reporterName: userName || 'Anonymous',
        timestamp: serverTimestamp(),
        upvotes: 0,
        downvotes: 0,
        status: 'active', // active, resolved, expired
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        verified: false,
        photoUrl: null
      };

      // Upload photo if provided
      if (photo) {
        const photoUrl = await this.uploadIncidentPhoto(photo);
        incident.photoUrl = photoUrl;
      }

      // Add to Firestore
      const docRef = await addDoc(collection(db, this.incidentsCollection), incident);

      return {
        id: docRef.id,
        ...incident,
        timestamp: new Date() // Convert for local use
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * Upload incident photo
   */
  async uploadIncidentPhoto(photoFile) {
    try {
      // Validate file size
      if (photoFile.size > this.maxImageSize) {
        throw new Error('Photo size exceeds 5MB limit');
      }

      // Create unique filename
      const timestamp = Date.now();
      const filename = `incidents/${timestamp}_${photoFile.name}`;
      const storageRef = ref(storage, filename);

      // Upload file
      await uploadBytes(storageRef, photoFile);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get incidents near a location
   */
  async getIncidentsNearLocation(lat, lng, radiusKm = 10) {
    try {
      // Calculate bounding box
      const latDelta = radiusKm / 111; // 1 degree latitude ≈ 111 km
      const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

      const minLat = lat - latDelta;
      const maxLat = lat + latDelta;
      const minLng = lng - lngDelta;
      const maxLng = lng + lngDelta;

      // Query incidents within bounding box
      const q = query(
        collection(db, this.incidentsCollection),
        where('status', '==', 'active'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      const querySnapshot = await getDocs(q);
      const incidents = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const incidentLat = data.location.latitude;
        const incidentLng = data.location.longitude;

        // Filter by bounding box
        if (
          incidentLat >= minLat &&
          incidentLat <= maxLat &&
          incidentLng >= minLng &&
          incidentLng <= maxLng
        ) {
          // Calculate actual distance
          const distance = this.calculateDistance(lat, lng, incidentLat, incidentLng);

          if (distance <= radiusKm) {
            incidents.push({
              id: doc.id,
              ...data,
              location: { lat: incidentLat, lng: incidentLng },
              distance,
              timestamp: data.timestamp?.toDate() || new Date()
            });
          }
        }
      });

      // Sort by distance
      incidents.sort((a, b) => a.distance - b.distance);

      return incidents;
    } catch (error) {

      return [];
    }
  }

  /**
   * Get incidents along a route
   */
  async getIncidentsAlongRoute(routeCoordinates, bufferKm = 1) {
    try {
      const incidents = [];
      const seenIds = new Set();

      // Sample points along route
      const samplePoints = routeCoordinates.filter((_, index) =>
        index % Math.max(1, Math.floor(routeCoordinates.length / 20)) === 0
      );

      // Get incidents near each sample point
      for (const [lat, lng] of samplePoints) {
        const nearbyIncidents = await this.getIncidentsNearLocation(lat, lng, bufferKm);

        nearbyIncidents.forEach(incident => {
          if (!seenIds.has(incident.id)) {
            seenIds.add(incident.id);
            incidents.push(incident);
          }
        });
      }

      return incidents;
    } catch (error) {

      return [];
    }
  }

  /**
   * Upvote an incident
   */
  async upvoteIncident(incidentId, userId) {
    try {
      const incidentRef = doc(db, this.incidentsCollection, incidentId);
      
      await updateDoc(incidentRef, {
        upvotes: increment(1)
      });

      // Store user vote in localStorage to prevent duplicate votes
      this.recordUserVote(incidentId, userId, 'upvote');

      return true;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Downvote an incident
   */
  async downvoteIncident(incidentId, userId) {
    try {
      const incidentRef = doc(db, this.incidentsCollection, incidentId);
      
      await updateDoc(incidentRef, {
        downvotes: increment(1)
      });

      // Store user vote in localStorage
      this.recordUserVote(incidentId, userId, 'downvote');

      // Auto-resolve if downvotes exceed threshold
      const incidentDoc = await getDoc(incidentRef);
      if (incidentDoc.exists()) {
        const data = incidentDoc.data();
        if (data.downvotes >= 5 && data.downvotes > data.upvotes * 2) {
          await this.resolveIncident(incidentId);
        }
      }

      return true;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Record user vote in localStorage
   */
  recordUserVote(incidentId, userId, voteType) {
    try {
      const key = `incident_votes_${userId}`;
      const votes = JSON.parse(localStorage.getItem(key) || '{}');
      votes[incidentId] = { type: voteType, timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(votes));
    } catch (error) {

    }
  }

  /**
   * Check if user has voted on incident
   */
  getUserVote(incidentId, userId) {
    try {
      const key = `incident_votes_${userId}`;
      const votes = JSON.parse(localStorage.getItem(key) || '{}');
      return votes[incidentId]?.type || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Resolve an incident
   */
  async resolveIncident(incidentId) {
    try {
      const incidentRef = doc(db, this.incidentsCollection, incidentId);
      
      await updateDoc(incidentRef, {
        status: 'resolved',
        resolvedAt: serverTimestamp()
      });

      return true;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Delete an incident (admin only)
   */
  async deleteIncident(incidentId) {
    try {
      const incidentRef = doc(db, this.incidentsCollection, incidentId);
      await deleteDoc(incidentRef);
      return true;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Convert degrees to radians
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get incident types
   */
  getIncidentTypes() {
    return [
      { id: 'accident', label: 'Accident', icon: '🚗💥', color: '#ef4444' },
      { id: 'police', label: 'Police', icon: '👮', color: '#3b82f6' },
      { id: 'hazard', label: 'Hazard', icon: '⚠️', color: '#f59e0b' },
      { id: 'road_closure', label: 'Road Closure', icon: '🚧', color: '#dc2626' },
      { id: 'construction', label: 'Construction', icon: '🏗️', color: '#f97316' },
      { id: 'flooding', label: 'Flooding', icon: '🌊', color: '#0ea5e9' },
      { id: 'heavy_traffic', label: 'Heavy Traffic', icon: '🚦', color: '#ef4444' },
      { id: 'vehicle_stopped', label: 'Vehicle Stopped', icon: '🛑', color: '#dc2626' },
      { id: 'pothole', label: 'Pothole', icon: '🕳️', color: '#78716c' },
      { id: 'other', label: 'Other', icon: '📍', color: '#6b7280' }
    ];
  }
}

export default new IncidentReportingService();
