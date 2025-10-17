/**
 * Traffic Patterns Service
 * Fetches 24h patterns and generates descriptive narratives (e.g., 5 PM rush hour)
 */

import api from './api';

class TrafficPatternsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async getDailyPatterns() {
    const cacheKey = 'daily-patterns';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const response = await api.get('/traffic/monitoring/patterns');
    const data = response.data;
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Build narrative for a specific hour (0-23). Defaults to 17 (5 PM).
   */
  buildRushHourNarrative(patterns, hour = 17) {
    if (!patterns || !Array.isArray(patterns.data)) return null;

    const items = patterns.data.filter(p => {
      const t = new Date(p.timestamp);
      return t.getHours() === hour;
    });

    if (items.length === 0) return null;

    // Aggregate by road
    const byRoad = {};
    for (const it of items) {
      if (!byRoad[it.road_name]) {
        byRoad[it.road_name] = { count: 0, speed: 0, vehicles: 0, heavy: 0, moderate: 0, low: 0 };
      }
      const r = byRoad[it.road_name];
      r.count += 1;
      r.speed += it.average_speed_kph;
      r.vehicles += it.vehicle_count;
      if (it.congestion_level === 'heavy') r.heavy += 1;
      else if (it.congestion_level === 'moderate') r.moderate += 1;
      else r.low += 1;
    }

    // Rank roads by severity (heavy share, then vehicles)
    const ranked = Object.entries(byRoad)
      .map(([road, v]) => ({
        road,
        avgSpeed: v.speed / Math.max(v.count, 1),
        vehicles: Math.round(v.vehicles / Math.max(v.count, 1)),
        heavyShare: v.heavy / Math.max(v.count, 1),
        moderateShare: v.moderate / Math.max(v.count, 1)
      }))
      .sort((a, b) => (b.heavyShare - a.heavyShare) || (b.vehicles - a.vehicles));

    const top = ranked.slice(0, 3);
    const hourLabel = `${hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour)}:00 ${hour >= 12 ? 'PM' : 'AM'}`;

    const intro = `Around ${hourLabel}, Las Piñas typically experiences an evening rush as workers and students head home.`;

    const bullets = top.map(r => {
      let tone = 'moderate';
      if (r.heavyShare >= 0.6) tone = 'heavy';
      else if (r.heavyShare >= 0.3 || r.moderateShare >= 0.5) tone = 'moderate';
      const toneText = tone === 'heavy' ? 'heavy congestion' : tone === 'moderate' ? 'moderate build-up' : 'lighter flow';
      return `${r.road}: ${toneText} • avg speed ~${Math.max(5, Math.round(r.avgSpeed))} km/h • vehicles/15m ~${r.vehicles}`;
    });

    const advice = `If possible, consider leaving earlier (before 4 PM) or later (after 7 PM), or use alternate corridors with fewer choke points.`;

    return {
      hour,
      hour_label: hourLabel,
      intro,
      highlights: bullets,
      advice
    };
  }
}

export default new TrafficPatternsService();


