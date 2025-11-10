import { useState, useEffect, useCallback } from 'react';
import parkingService from '../services/parkingService';
import weatherService from '../services/weatherService';
import reportService from '../services/reportService';
import emergencyService from '../services/emergencyService';
import incidentProneService from '../services/incidentProneService';
import trafficService from '../services/trafficService';
import roadworksService from '../services/roadworksService';

/**
 * Custom Hook for Map Data Management
 * Handles fetching and managing all map-related data layers
 */
export const useMapData = (mapCenter, {
  parkingEnabled = false,
  weatherEnabled = false,
  // emergencyEnabled = false,
  // reportsEnabled = false,
  incidentProneEnabled = false,
  floodZonesEnabled = false,
  trafficMonitorNewEnabled = false
}) => {
  // Data state
  const [parkingAreas, setParkingAreas] = useState([]);
  const [noParkingZones, setNoParkingZones] = useState([]);
  const [nearbyWeatherAlerts, setNearbyWeatherAlerts] = useState([]);
  const [nearbyEmergencies, setNearbyEmergencies] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [incidentProneAreas, setIncidentProneAreas] = useState([]);
  const [floodProneAreas, setFloodProneAreas] = useState([]);
  const [criticalFloodAreas, setCriticalFloodAreas] = useState([]);
  const [activeFloods, setActiveFloods] = useState([]);
  const [tmIncidents, setTmIncidents] = useState([]);
  const [tmRoadworks, setTmRoadworks] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load Parking data
  useEffect(() => {
    let isCancelled = false;
    const loadParking = async () => {
      if (!parkingEnabled) {
        setParkingAreas([]);
        setNoParkingZones([]);
        return;
      }
      try {
        const [areas, zones] = await Promise.all([
          parkingService.getParkingAreas().catch(() => []),
          parkingService.getNoParkingZones().catch(() => [])
        ]);
        if (!isCancelled) {
          setParkingAreas(Array.isArray(areas) ? areas : []);
          setNoParkingZones(Array.isArray(zones) ? zones : []);
        }
      } catch (e) {

        if (!isCancelled) {
          setParkingAreas([]);
          setNoParkingZones([]);
        }
      }
    };
    loadParking();
    return () => { isCancelled = true; };
  }, [parkingEnabled]);

  // Load Weather/Flood alerts
  useEffect(() => {
    let isCancelled = false;
    const loadAlerts = async () => {
      if (!weatherEnabled || !mapCenter) {
        setNearbyWeatherAlerts([]);
        return;
      }
      try {
        const alerts = await weatherService.getNearbyWeatherAlerts({ lat: mapCenter[0], lng: mapCenter[1] }, 15);
        if (!isCancelled) setNearbyWeatherAlerts(Array.isArray(alerts) ? alerts : []);
      } catch (e) {
        if (!isCancelled) setNearbyWeatherAlerts([]);
      }
    };
    loadAlerts();
    const interval = setInterval(loadAlerts, 120000);
    return () => { isCancelled = true; clearInterval(interval); };
  }, [weatherEnabled, mapCenter]);

  // Load Traffic Monitoring data
  useEffect(() => {
    let cancelled = false;
    const loadTrafficMonitoring = async () => {
      if (!trafficMonitorNewEnabled) {
        setTmIncidents([]);
        setTmRoadworks([]);
        return;
      }
      try {
        const [incidents, roadworks] = await Promise.all([
          mapCenter ? trafficService.getNearbyIncidents({ lat: mapCenter[0], lng: mapCenter[1] }, 10).catch(() => []) : Promise.resolve([]),
          roadworksService.getActiveRoadworks().catch(() => [])
        ]);
        if (!cancelled) {
          setTmIncidents(Array.isArray(incidents) ? incidents : []);
          setTmRoadworks(Array.isArray(roadworks) ? roadworks : []);
        }
      } catch (e) {
        if (!cancelled) {
          setTmIncidents([]);
          setTmRoadworks([]);
        }
      }
    };
    loadTrafficMonitoring();
    const interval = setInterval(loadTrafficMonitoring, 120000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [trafficMonitorNewEnabled, mapCenter]);

  // Load User Reports
  // useEffect(() => {
  //   let cancelled = false;
  //   const loadReports = async () => {
  //     if (!reportsEnabled || !mapCenter) {
  //       setUserReports([]);
  //       return;
  //     }
  //     try {
  //       const reports = await reportService.getNearbyReports(mapCenter[0], mapCenter[1], 15).catch(() => []);
  //       if (!cancelled) setUserReports(Array.isArray(reports) ? reports : []);
  //     } catch (e) {
  //       if (!cancelled) setUserReports([]);
  //     }
  //   };
  //   loadReports();
  //   const interval = setInterval(loadReports, 180000);
  //   return () => { cancelled = true; clearInterval(interval); };
  // }, [reportsEnabled, mapCenter]);

  // Load Incident Prone Areas
  useEffect(() => {
    let cancelled = false;
    const loadIncidentProne = async () => {
      if (!incidentProneEnabled || !mapCenter) {
        setIncidentProneAreas([]);
        return;
      }
      try {
        setIsLoadingData(true);
        const areas = await incidentProneService.getNearbyIncidentProneAreas(mapCenter[0], mapCenter[1], 15);
        if (!cancelled) {
          // Ensure we have an array - handle both direct array and object with nearby_areas property
          const areasArray = Array.isArray(areas) ? areas : (areas?.nearby_areas || areas?.areas || []);
          setIncidentProneAreas(areasArray);
          console.log(`Loaded ${areasArray.length} incident prone areas`);
        }
      } catch (e) {
        console.error('Error loading incident prone areas:', e);
        if (!cancelled) setIncidentProneAreas([]);
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    };
    loadIncidentProne();
    // Refresh every 5 minutes (300000ms)
    const interval = setInterval(loadIncidentProne, 300000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [incidentProneEnabled, mapCenter]);

  // Load Flood Zones and Active Floods
  useEffect(() => {
    let cancelled = false;
    const loadFloodData = async () => {
      if (!floodZonesEnabled || !mapCenter) {
        setFloodProneAreas([]);
        setCriticalFloodAreas([]);
        setActiveFloods([]);
        return;
      }
      try {
        const [prone, critical, floods] = await Promise.all([
          weatherService.getFloodProneBarangays().catch(() => []),
          weatherService.getCriticalFloodAreas().catch(() => []),
          weatherService.getFloodMonitoring({ latitude: mapCenter[0], longitude: mapCenter[1] }).catch(() => [])
        ]);
        if (!cancelled) {
          setFloodProneAreas(Array.isArray(prone) ? prone : []);
          setCriticalFloodAreas(Array.isArray(critical) ? critical : []);
          setActiveFloods(Array.isArray(floods) ? floods : []);
        }
      } catch (e) {
        if (!cancelled) {
          setFloodProneAreas([]);
          setCriticalFloodAreas([]);
          setActiveFloods([]);
        }
      }
    };
    loadFloodData();
    const interval = setInterval(loadFloodData, 180000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [floodZonesEnabled, mapCenter]);

  // Load Nearby Emergencies
  // useEffect(() => {
  //   let cancelled = false;
  //   const loadEmergencies = async () => {
  //     if (!emergencyEnabled || !mapCenter) {
  //       setNearbyEmergencies([]);
  //       return;
  //     }
  //     try {
  //       const emergencies = await emergencyService.getNearbyEmergencies({ lat: mapCenter[0], lng: mapCenter[1] }, 15).catch(() => []);
  //       if (!cancelled) setNearbyEmergencies(Array.isArray(emergencies) ? emergencies : []);
  //     } catch (e) {
  //       if (!cancelled) setNearbyEmergencies([]);
  //     }
  //   };
  //   loadEmergencies();
  //   const interval = setInterval(loadEmergencies, 120000);
  //   return () => { cancelled = true; clearInterval(interval); };
  // }, [emergencyEnabled, mapCenter]);

  // Load heatmap data
  const loadTrafficData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const mockHeatmapData = Array.from({ length: 50 }, (_, i) => [
        (mapCenter[0] || 14.4504) + (Math.random() - 0.5) * 0.02,
        (mapCenter[1] || 121.0170) + (Math.random() - 0.5) * 0.02,
        Math.random()
      ]);
      setHeatmapData(mockHeatmapData);
    } catch (error) {

    } finally {
      setIsLoadingData(false);
    }
  }, [mapCenter]);

  useEffect(() => {
    loadTrafficData();
    const interval = setInterval(loadTrafficData, 30000);
    return () => clearInterval(interval);
  }, [loadTrafficData]);

  return {
    // Parking
    parkingAreas,
    noParkingZones,
    // Weather & Flood
    nearbyWeatherAlerts,
    floodProneAreas,
    criticalFloodAreas,
    activeFloods,
    // Other layers
    nearbyEmergencies,
    userReports,
    incidentProneAreas,
    tmIncidents,
    tmRoadworks,
    heatmapData,
    isLoadingData
  };
};



