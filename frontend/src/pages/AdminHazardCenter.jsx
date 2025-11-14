import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  AlertTriangle,
  Waves,
  RefreshCw,
  PlusCircle,
  Bell,
  ClipboardList,
  ShieldAlert,
  Flame,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import incidentProneService from '../services/incidentProneService';
import adminService from '../services/adminService';
import weatherService from '../services/weatherService';
import geoapifyService from '../services/geoapifyService';

const LAS_PINAS_CENTER = { lat: 14.4504, lng: 121.017 };
import { useAuth } from '../context/AuthContext';

const defaultIncidentForm = {
  area_name: '',
  area_type: 'ACCIDENT_PRONE',
  description: '',
  severity_level: 'medium',
  latitude: '',
  longitude: '',
  radius_meters: 500,
  barangay: '',
  incident_count: 0,
  risk_score: 40,
  data_source: 'manual_entry',
  affected_roads: '',
  peak_hours: '',
  common_incident_types: '',
  alternative_routes: '',
  prevention_measures: '',
  source_url: '',
  is_active: true,
  is_verified: false
};

const defaultAlertForm = {
  title: '',
  message: '',
  alert_type: 'info',
  target_roles: '',
  is_active: true,
  is_dismissible: true,
  start_date: '',
  end_date: ''
};

const defaultFloodForm = {
  location_name: '',
  latitude: '',
  longitude: '',
  water_level_cm: 0,
  flood_level: 'NORMAL',
  is_flood_prone: true,
  evacuation_center_nearby: '',
  affected_roads: '',
  estimated_passable: true,
  alert_level: 0,
  sensor_id: ''
};

const incidentTypeOptions = [
  { value: 'ACCIDENT_PRONE', label: 'Accident Prone' },
  { value: 'CRIME_HOTSPOT', label: 'Crime Hotspot' },
  { value: 'FLOOD_PRONE', label: 'Flood Prone' },
  { value: 'TRAFFIC_CONGESTION', label: 'Traffic Congestion' },
  { value: 'ROAD_HAZARD', label: 'Road Hazard' }
];

const floodLevelOptions = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' }
];

const alertTypeOptions = [
  { value: 'info', label: 'Information' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Critical' },
  { value: 'maintenance', label: 'Maintenance' }
];

const AdminHazardCenter = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('incident');

  const [incidentForm, setIncidentForm] = useState(defaultIncidentForm);
  const [alertForm, setAlertForm] = useState(defaultAlertForm);
  const [floodForm, setFloodForm] = useState(defaultFloodForm);

  const [incidentLocationQuery, setIncidentLocationQuery] = useState('');
  const [incidentLocationResults, setIncidentLocationResults] = useState([]);
  const [incidentLocationLoading, setIncidentLocationLoading] = useState(false);
  const incidentLocationManualRef = useRef(false);
  const incidentSearchAbortRef = useRef(null);

  const [floodLocationQuery, setFloodLocationQuery] = useState('');
  const [floodLocationResults, setFloodLocationResults] = useState([]);
  const [floodLocationLoading, setFloodLocationLoading] = useState(false);
  const floodLocationManualRef = useRef(false);
  const floodSearchAbortRef = useRef(null);

  const [incidentAreas, setIncidentAreas] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [floodAreas, setFloodAreas] = useState([]);

  const [loadingIncident, setLoadingIncident] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingFloods, setLoadingFloods] = useState(false);

  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [submittingAlert, setSubmittingAlert] = useState(false);
  const [submittingFlood, setSubmittingFlood] = useState(false);

  const canAccess = useMemo(() => {
    if (!user?.role) return false;
    const role = user.role.toLowerCase?.() || user.role;
    return ['admin', 'lgu_staff'].includes(role);
  }, [user]);

  useEffect(() => {
    if (canAccess) {
      refreshIncidentAreas();
      refreshAlerts();
      refreshFloodAreas();
    }
  }, [canAccess]);

  useEffect(() => {
    if (incidentLocationManualRef.current) {
      incidentLocationManualRef.current = false;
      return;
    }

    const trimmed = incidentLocationQuery.trim();
    if (!trimmed) {
      setIncidentLocationResults([]);
      setIncidentLocationLoading(false);
      if (incidentSearchAbortRef.current) {
        incidentSearchAbortRef.current.abort?.();
        incidentSearchAbortRef.current = null;
      }
      return;
    }

    if (trimmed.length < 3) {
      setIncidentLocationResults([]);
      setIncidentLocationLoading(false);
      return;
    }

    setIncidentLocationLoading(true);
    const controller = new AbortController();
    incidentSearchAbortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const { results } = await geoapifyService.autocompletePlaces(trimmed, {
          countrySet: 'PH',
          limit: 8,
          lat: LAS_PINAS_CENTER.lat,
          lng: LAS_PINAS_CENTER.lng,
          radius: 20000,
          signal: controller.signal
        });
        setIncidentLocationResults(results || []);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('Incident location search failed:', error);
        }
        setIncidentLocationResults([]);
      } finally {
        setIncidentLocationLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setIncidentLocationLoading(false);
    };
  }, [incidentLocationQuery]);

  useEffect(() => {
    if (floodLocationManualRef.current) {
      floodLocationManualRef.current = false;
      return;
    }

    const trimmed = floodLocationQuery.trim();
    if (!trimmed) {
      setFloodLocationResults([]);
      setFloodLocationLoading(false);
      if (floodSearchAbortRef.current) {
        floodSearchAbortRef.current.abort?.();
        floodSearchAbortRef.current = null;
      }
      return;
    }

    if (trimmed.length < 3) {
      setFloodLocationResults([]);
      setFloodLocationLoading(false);
      return;
    }

    setFloodLocationLoading(true);
    const controller = new AbortController();
    floodSearchAbortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const { results } = await geoapifyService.autocompletePlaces(trimmed, {
          countrySet: 'PH',
          limit: 8,
          lat: LAS_PINAS_CENTER.lat,
          lng: LAS_PINAS_CENTER.lng,
          radius: 20000,
          signal: controller.signal
        });
        setFloodLocationResults(results || []);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('Flood location search failed:', error);
        }
        setFloodLocationResults([]);
      } finally {
        setFloodLocationLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setFloodLocationLoading(false);
    };
  }, [floodLocationQuery]);

  const parseList = (value) => {
    if (!value) return undefined;
    const entries = value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    return entries.length ? entries : undefined;
  };

  const buildLocationLabel = (suggestion) => {
    if (!suggestion) return '';
    const parts = [];
    if (suggestion.poi?.name) {
      parts.push(suggestion.poi.name);
    }
    if (suggestion.address?.freeformAddress) {
      if (!parts.includes(suggestion.address.freeformAddress)) {
        parts.push(suggestion.address.freeformAddress);
      }
    }
    return parts.join(', ') || suggestion.address?.freeformAddress || '';
  };

  const handleIncidentLocationSelect = (suggestion) => {
    if (!suggestion?.position) return;
    const label = buildLocationLabel(suggestion);
    incidentLocationManualRef.current = true;
    setIncidentLocationQuery(label);
    setIncidentLocationResults([]);
    setIncidentLocationLoading(false);
    setIncidentForm((prev) => ({
      ...prev,
      area_name: prev.area_name || suggestion.poi?.name || suggestion.address?.freeformAddress || prev.area_name,
      latitude: suggestion.position.lat.toFixed(6),
      longitude: suggestion.position.lon.toFixed(6),
      barangay: prev.barangay || suggestion.address?.municipality || suggestion.address?.suburb || prev.barangay
    }));
  };

  const handleFloodLocationSelect = (suggestion) => {
    if (!suggestion?.position) return;
    const label = buildLocationLabel(suggestion);
    floodLocationManualRef.current = true;
    setFloodLocationQuery(label);
    setFloodLocationResults([]);
    setFloodLocationLoading(false);
    setFloodForm((prev) => ({
      ...prev,
      location_name: prev.location_name || suggestion.poi?.name || suggestion.address?.freeformAddress || prev.location_name,
      latitude: suggestion.position.lat.toFixed(6),
      longitude: suggestion.position.lon.toFixed(6)
    }));
  };

  const clearIncidentLocation = () => {
    incidentLocationManualRef.current = true;
    setIncidentLocationQuery('');
    setIncidentLocationResults([]);
    setIncidentForm((prev) => ({
      ...prev,
      latitude: '',
      longitude: ''
    }));
  };

  const clearFloodLocation = () => {
    floodLocationManualRef.current = true;
    setFloodLocationQuery('');
    setFloodLocationResults([]);
    setFloodForm((prev) => ({
      ...prev,
      latitude: '',
      longitude: ''
    }));
  };

  const refreshIncidentAreas = async () => {
    try {
      setLoadingIncident(true);
      const data = await incidentProneService.getIncidentProneAreas({ per_page: 25 });
      const list = Array.isArray(data?.areas) ? data.areas : Array.isArray(data) ? data : [];
      setIncidentAreas(list);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to load incident prone areas');
    } finally {
      setLoadingIncident(false);
    }
  };

  const refreshAlerts = async () => {
    try {
      setLoadingAlerts(true);
      const list = await adminService.getSystemAlerts();
      setAlerts(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to load announcements');
    } finally {
      setLoadingAlerts(false);
    }
  };

  const refreshFloodAreas = async () => {
    try {
      setLoadingFloods(true);
      const list = await weatherService.getFloodMonitoring();
      setFloodAreas(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to load flood monitoring data');
    } finally {
      setLoadingFloods(false);
    }
  };

  const handleIncidentChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setIncidentForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAlertChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setAlertForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFloodChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFloodForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleIncidentSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmittingIncident(true);
      if (!incidentForm.latitude || !incidentForm.longitude) {
        toast.error('Please select a location from the search suggestions.');
        setSubmittingIncident(false);
        return;
      }
      const payload = {
        area_name: incidentForm.area_name,
        area_type: incidentForm.area_type,
        description: incidentForm.description || undefined,
        severity_level: incidentForm.severity_level,
        latitude: Number(incidentForm.latitude),
        longitude: Number(incidentForm.longitude),
        radius_meters: Number(incidentForm.radius_meters) || 500,
        barangay: incidentForm.barangay || undefined,
        incident_count: Number(incidentForm.incident_count) || 0,
        risk_score: Number(incidentForm.risk_score) || 0,
        data_source: incidentForm.data_source || 'manual_entry',
        affected_roads: parseList(incidentForm.affected_roads),
        peak_hours: parseList(incidentForm.peak_hours),
        common_incident_types: parseList(incidentForm.common_incident_types),
        alternative_routes: parseList(incidentForm.alternative_routes),
        prevention_measures: incidentForm.prevention_measures || undefined,
        source_url: incidentForm.source_url || undefined,
        is_active: Boolean(incidentForm.is_active),
        is_verified: Boolean(incidentForm.is_verified)
      };

      if (Number.isNaN(payload.latitude) || Number.isNaN(payload.longitude)) {
        toast.error('Latitude and longitude must be valid numbers');
        setSubmittingIncident(false);
        return;
      }

      await incidentProneService.createIncidentProneArea(payload);
      toast.success('Incident-prone area saved');
      setIncidentForm(defaultIncidentForm);
      clearIncidentLocation();
      await refreshIncidentAreas();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to save incident-prone area');
    } finally {
      setSubmittingIncident(false);
    }
  };

  const handleAlertSubmit = async (event) => {
    event.preventDefault();
    try {
      setSubmittingAlert(true);

      const targetRolesArray = parseList(alertForm.target_roles);
      const payload = {
        title: alertForm.title,
        message: alertForm.message,
        alert_type: alertForm.alert_type,
        target_roles: targetRolesArray,
        is_active: Boolean(alertForm.is_active),
        is_dismissible: Boolean(alertForm.is_dismissible),
        start_date: alertForm.start_date ? new Date(alertForm.start_date).toISOString() : undefined,
        end_date: alertForm.end_date ? new Date(alertForm.end_date).toISOString() : undefined
      };

      await adminService.createSystemAlert(payload);
      toast.success('Announcement published');
      setAlertForm(defaultAlertForm);
      await refreshAlerts();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to publish announcement');
    } finally {
      setSubmittingAlert(false);
    }
  };

  const handleFloodSubmit = async (event) => {
    event.preventDefault();
    try {
      setSubmittingFlood(true);
      if (!floodForm.latitude || !floodForm.longitude) {
        toast.error('Please select a location from the search suggestions.');
        setSubmittingFlood(false);
        return;
      }
      const payload = {
        location_name: floodForm.location_name,
        latitude: Number(floodForm.latitude),
        longitude: Number(floodForm.longitude),
        water_level_cm: Number(floodForm.water_level_cm),
        flood_level: floodForm.flood_level,
        is_flood_prone: Boolean(floodForm.is_flood_prone),
        evacuation_center_nearby: floodForm.evacuation_center_nearby || undefined,
        affected_roads: floodForm.affected_roads || undefined,
        estimated_passable: Boolean(floodForm.estimated_passable),
        alert_level: Number(floodForm.alert_level) || 0,
        sensor_id: floodForm.sensor_id || undefined
      };

      if (
        Number.isNaN(payload.latitude) ||
        Number.isNaN(payload.longitude) ||
        Number.isNaN(payload.water_level_cm)
      ) {
        toast.error('Please provide valid numeric values for location and water level');
        setSubmittingFlood(false);
        return;
      }

      await weatherService.createFloodMonitoring(payload);
      toast.success('Flood monitoring point saved');
      setFloodForm(defaultFloodForm);
      clearFloodLocation();
      await refreshFloodAreas();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to save flood monitoring point');
    } finally {
      setSubmittingFlood(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="max-w-4xl mx-auto mt-12 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
        <h1 className="text-2xl font-semibold text-gray-900">Admin Access Required</h1>
        <p className="text-gray-600">
          You need administrator or LGU staff permissions to manage hazard data and announcements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-primary-600" />
            Hazard &amp; Advisory Center
          </h1>
          <p className="text-gray-600">
            Maintain risk hotspots, publish city-wide announcements, and track flood-prone areas.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              refreshIncidentAreas();
              refreshAlerts();
              refreshFloodAreas();
            }}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('incident')}
          className={`px-4 py-2 rounded-full flex items-center gap-2 transition ${
            activeTab === 'incident' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Incident Hotspots
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2 rounded-full flex items-center gap-2 transition ${
            activeTab === 'announcements' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Bell className="w-4 h-4" />
          Announcements
        </button>
        <button
          onClick={() => setActiveTab('flood')}
          className={`px-4 py-2 rounded-full flex items-center gap-2 transition ${
            activeTab === 'flood' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Waves className="w-4 h-4" />
          Flood Monitoring
        </button>
      </div>

      {activeTab === 'incident' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Add Incident-Prone Area
              </h2>
            </div>
            <form onSubmit={handleIncidentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Area Name</label>
                  <input
                    type="text"
                    required
                    value={incidentForm.area_name}
                    onChange={handleIncidentChange('area_name')}
                    className="input-field"
                    placeholder="e.g. Alabang-Zapote Intersection"
                  />
                </div>
                <div>
                  <label className="form-label">Area Type</label>
                  <select
                    value={incidentForm.area_type}
                    onChange={handleIncidentChange('area_type')}
                    className="input-field"
                  >
                    {incidentTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  value={incidentForm.description}
                  onChange={handleIncidentChange('description')}
                  rows={3}
                  className="input-field"
                  placeholder="Describe why this area is high-risk"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Severity</label>
                  <select
                    value={incidentForm.severity_level}
                    onChange={handleIncidentChange('severity_level')}
                    className="input-field"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Risk Score (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={incidentForm.risk_score}
                    onChange={handleIncidentChange('risk_score')}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Locate on Map</label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={incidentLocationQuery}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setIncidentLocationQuery(nextValue);
                          setIncidentForm((prev) => ({
                            ...prev,
                            latitude: '',
                            longitude: ''
                          }));
                        }}
                        placeholder="Search for a street, barangay, or landmark"
                        className="input-field pr-10"
                      />
                      {incidentLocationLoading && (
                        <RefreshCw className="w-4 h-4 animate-spin text-primary-500 absolute right-3 top-1/2 -translate-y-1/2" />
                      )}
                      {incidentLocationResults.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                          {incidentLocationResults.map((result, index) => {
                            const label = buildLocationLabel(result);
                            return (
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left hover:bg-primary-50 focus:bg-primary-100 transition-colors"
                                key={`${label}_${index}`}
                                onClick={() => handleIncidentLocationSelect(result)}
                              >
                                <p className="text-sm font-medium text-gray-900">
                                  {result.poi?.name || result.address?.freeformAddress || 'Unnamed location'}
                                </p>
                                {result.address?.freeformAddress && (
                                  <p className="text-xs text-gray-500">{result.address.freeformAddress}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {(incidentForm.latitude || incidentForm.longitude) && (
                      <button type="button" onClick={clearIncidentLocation} className="btn btn-secondary whitespace-nowrap">
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Powered by Geoapify – choose a suggestion to capture accurate coordinates.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Latitude</label>
                  <input
                    type="text"
                    value={incidentForm.latitude}
                    readOnly
                    className="input-field bg-gray-100"
                    placeholder="Auto-filled after selecting location"
                  />
                </div>
                <div>
                  <label className="form-label">Longitude</label>
                  <input
                    type="text"
                    value={incidentForm.longitude}
                    readOnly
                    className="input-field bg-gray-100"
                    placeholder="Auto-filled after selecting location"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Coverage Radius (meters)</label>
                  <input
                    type="number"
                    min="50"
                    value={incidentForm.radius_meters}
                    onChange={handleIncidentChange('radius_meters')}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Barangay</label>
                  <input
                    type="text"
                    value={incidentForm.barangay}
                    onChange={handleIncidentChange('barangay')}
                    className="input-field"
                    placeholder="e.g. Talon Uno"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Historic Incident Count</label>
                  <input
                    type="number"
                    min="0"
                    value={incidentForm.incident_count}
                    onChange={handleIncidentChange('incident_count')}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Data Source</label>
                  <input
                    type="text"
                    value={incidentForm.data_source}
                    onChange={handleIncidentChange('data_source')}
                    className="input-field"
                    placeholder="manual_entry"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Affected Roads (comma separated)</label>
                  <input
                    type="text"
                    value={incidentForm.affected_roads}
                    onChange={handleIncidentChange('affected_roads')}
                    className="input-field"
                    placeholder="Road 1, Road 2"
                  />
                </div>
                <div>
                  <label className="form-label">Peak Hours (comma separated)</label>
                  <input
                    type="text"
                    value={incidentForm.peak_hours}
                    onChange={handleIncidentChange('peak_hours')}
                    className="input-field"
                    placeholder="07:00-09:00, 17:00-19:00"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Common Incident Types (comma separated)</label>
                <input
                  type="text"
                  value={incidentForm.common_incident_types}
                  onChange={handleIncidentChange('common_incident_types')}
                  className="input-field"
                  placeholder="Rear collision, Motorbike skid"
                />
              </div>

              <div>
                <label className="form-label">Suggested Alternative Routes (comma separated)</label>
                <input
                  type="text"
                  value={incidentForm.alternative_routes}
                  onChange={handleIncidentChange('alternative_routes')}
                  className="input-field"
                  placeholder="Route A, Route B"
                />
              </div>

              <div>
                <label className="form-label">Prevention Measures</label>
                <textarea
                  value={incidentForm.prevention_measures}
                  onChange={handleIncidentChange('prevention_measures')}
                  rows={2}
                  className="input-field"
                  placeholder="Recommended actions for field teams"
                />
              </div>

              <div>
                <label className="form-label">Reference URL (optional)</label>
                <input
                  type="url"
                  value={incidentForm.source_url}
                  onChange={handleIncidentChange('source_url')}
                  className="input-field"
                  placeholder="https://"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={incidentForm.is_active}
                    onChange={handleIncidentChange('is_active')}
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={incidentForm.is_verified}
                    onChange={handleIncidentChange('is_verified')}
                  />
                  <span className="text-sm text-gray-700">Verified</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingIncident}
                className="btn btn-primary flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                {submittingIncident ? 'Saving...' : 'Save Incident Area'}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                Recent Incident Hotspots
              </h2>
              <span className="text-sm text-gray-500">{incidentAreas.length} areas</span>
            </div>
            {loadingIncident ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : incidentAreas.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                <p>No incident-prone areas recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {incidentAreas.map((area) => (
                  <div
                    key={area.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-primary-200 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{area.area_name}</h3>
                        <p className="text-sm text-gray-600">
                          {area.description || 'No description provided'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          <span className="px-2 py-1 rounded-full bg-primary-100 text-primary-700">
                            {area.area_type?.replaceAll('_', ' ')}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full ${
                              area.severity_level === 'critical'
                                ? 'bg-red-100 text-red-700'
                                : area.severity_level === 'high'
                                ? 'bg-orange-100 text-orange-700'
                                : area.severity_level === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {area.severity_level?.toUpperCase()}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            Risk {Math.round(area.risk_score ?? 0)}
                          </span>
                          {area.barangay && (
                            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                              {area.barangay}
                            </span>
                          )}
                          {area.is_verified && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>
                          Lat/Lng:{' '}
                          {`${Number(area.latitude).toFixed(4)}, ${Number(area.longitude).toFixed(4)}`}
                        </p>
                        <p>Radius: {Math.round(area.radius_meters)} m</p>
                        <p>Incidents: {area.incident_count}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary-600" />
                Publish Announcement
              </h2>
            </div>
            <form onSubmit={handleAlertSubmit} className="space-y-4">
              <div>
                <label className="form-label">Title</label>
                <input
                  type="text"
                  required
                  value={alertForm.title}
                  onChange={handleAlertChange('title')}
                  className="input-field"
                  placeholder="e.g. Accident near SM Southmall"
                />
              </div>

              <div>
                <label className="form-label">Message</label>
                <textarea
                  required
                  rows={4}
                  value={alertForm.message}
                  onChange={handleAlertChange('message')}
                  className="input-field"
                  placeholder="Provide clear guidance for motorists and residents"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Alert Type</label>
                  <select
                    value={alertForm.alert_type}
                    onChange={handleAlertChange('alert_type')}
                    className="input-field"
                  >
                    {alertTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Target Roles (comma separated)</label>
                  <input
                    type="text"
                    value={alertForm.target_roles}
                    onChange={handleAlertChange('target_roles')}
                    className="input-field"
                    placeholder="admin, traffic_enforcer, citizen"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Start Date</label>
                  <input
                    type="datetime-local"
                    value={alertForm.start_date}
                    onChange={handleAlertChange('start_date')}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">End Date</label>
                  <input
                    type="datetime-local"
                    value={alertForm.end_date}
                    onChange={handleAlertChange('end_date')}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertForm.is_active}
                    onChange={handleAlertChange('is_active')}
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertForm.is_dismissible}
                    onChange={handleAlertChange('is_dismissible')}
                  />
                  <span className="text-sm text-gray-700">Allow users to dismiss</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingAlert}
                className="btn btn-primary flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                {submittingAlert ? 'Publishing...' : 'Publish Announcement'}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Active Announcements
              </h2>
              <span className="text-sm text-gray-500">{alerts.length} active</span>
            </div>
            {loadingAlerts ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                <p>No announcements yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-primary-200 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              alert.alert_type === 'warning'
                                ? 'bg-yellow-100 text-yellow-800'
                                : alert.alert_type === 'error'
                                ? 'bg-red-100 text-red-700'
                                : alert.alert_type === 'maintenance'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {alert.alert_type.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                          {Array.isArray(alert.target_roles) && alert.target_roles.length > 0 && (
                            <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                              Targets: {alert.target_roles.join(', ')}
                            </span>
                          )}
                          <span>
                            Start:{' '}
                            {alert.start_date
                              ? new Date(alert.start_date).toLocaleString()
                              : 'Immediate'}
                          </span>
                          {alert.end_date && (
                            <span>End: {new Date(alert.end_date).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        <p>Created: {new Date(alert.created_at).toLocaleString()}</p>
                        <p>{alert.is_dismissible ? 'Dismissible' : 'Sticky'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'flood' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Waves className="w-5 h-5 text-blue-500" />
                Add Flood Monitoring Point
              </h2>
            </div>
            <form onSubmit={handleFloodSubmit} className="space-y-4">
              <div>
                <label className="form-label">Location Name</label>
                <input
                  type="text"
                  required
                  value={floodForm.location_name}
                  onChange={handleFloodChange('location_name')}
                  className="input-field"
                  placeholder="e.g. Marcos Alvarez Ave - Creek"
                />
              </div>

              <div>
                <label className="form-label">Locate Waterway</label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={floodLocationQuery}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setFloodLocationQuery(nextValue);
                          setFloodForm((prev) => ({
                            ...prev,
                            latitude: '',
                            longitude: ''
                          }));
                        }}
                        placeholder="Search for river, creek, or street"
                        className="input-field pr-10"
                      />
                      {floodLocationLoading && (
                        <RefreshCw className="w-4 h-4 animate-spin text-primary-500 absolute right-3 top-1/2 -translate-y-1/2" />
                      )}
                      {floodLocationResults.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                          {floodLocationResults.map((result, index) => {
                            const label = buildLocationLabel(result);
                            return (
                              <button
                                type="button"
                                key={`${label}_${index}`}
                                className="w-full px-3 py-2 text-left hover:bg-primary-50 focus:bg-primary-100 transition-colors"
                                onClick={() => handleFloodLocationSelect(result)}
                              >
                                <p className="text-sm font-medium text-gray-900">
                                  {result.poi?.name || result.address?.freeformAddress || 'Unnamed location'}
                                </p>
                                {result.address?.freeformAddress && (
                                  <p className="text-xs text-gray-500">{result.address.freeformAddress}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {(floodForm.latitude || floodForm.longitude) && (
                      <button type="button" onClick={clearFloodLocation} className="btn btn-secondary whitespace-nowrap">
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Choose a nearby point to capture exact coordinates for the flood panel.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Latitude</label>
                  <input
                    type="text"
                    value={floodForm.latitude}
                    readOnly
                    className="input-field bg-gray-100"
                    placeholder="Auto-filled after selecting location"
                  />
                </div>
                <div>
                  <label className="form-label">Longitude</label>
                  <input
                    type="text"
                    value={floodForm.longitude}
                    readOnly
                    className="input-field bg-gray-100"
                    placeholder="Auto-filled after selecting location"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Water Level (cm)</label>
                  <input
                    type="number"
                    min="0"
                    value={floodForm.water_level_cm}
                    onChange={handleFloodChange('water_level_cm')}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Flood Level</label>
                  <select
                    value={floodForm.flood_level}
                    onChange={handleFloodChange('flood_level')}
                    className="input-field"
                  >
                    {floodLevelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Alert Level (0-4)</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={floodForm.alert_level}
                    onChange={handleFloodChange('alert_level')}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Sensor ID (optional)</label>
                  <input
                    type="text"
                    value={floodForm.sensor_id}
                    onChange={handleFloodChange('sensor_id')}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Nearest Evacuation Center</label>
                <input
                  type="text"
                  value={floodForm.evacuation_center_nearby}
                  onChange={handleFloodChange('evacuation_center_nearby')}
                  className="input-field"
                  placeholder="e.g. Talon Community Gym"
                />
              </div>

              <div>
                <label className="form-label">Affected Roads / Notes</label>
                <textarea
                  rows={2}
                  value={floodForm.affected_roads}
                  onChange={handleFloodChange('affected_roads')}
                  className="input-field"
                  placeholder="List affected roads or notes"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={floodForm.is_flood_prone}
                    onChange={handleFloodChange('is_flood_prone')}
                  />
                  <span className="text-sm text-gray-700">Flood-prone zone</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={floodForm.estimated_passable}
                    onChange={handleFloodChange('estimated_passable')}
                  />
                  <span className="text-sm text-gray-700">Passable to light vehicles</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingFlood}
                className="btn btn-primary flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                {submittingFlood ? 'Saving...' : 'Save Flood Location'}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Waves className="w-5 h-5 text-blue-500" />
                Flood Monitoring Points
              </h2>
              <span className="text-sm text-gray-500">{floodAreas.length} points</span>
            </div>
            {loadingFloods ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : floodAreas.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                <p>No flood monitoring points yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {floodAreas.map((flood) => (
                  <div
                    key={flood.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-primary-200 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{flood.location_name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          <span
                            className={`px-2 py-1 rounded-full ${
                              flood.flood_level === 'CRITICAL'
                                ? 'bg-red-100 text-red-700'
                                : flood.flood_level === 'HIGH'
                                ? 'bg-orange-100 text-orange-700'
                                : flood.flood_level === 'MODERATE'
                                ? 'bg-yellow-100 text-yellow-700'
                                : flood.flood_level === 'LOW'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {flood.flood_level}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            Alert {flood.alert_level}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            Water: {flood.water_level_cm} cm
                          </span>
                          {flood.is_flood_prone && (
                            <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                              Flood-prone
                            </span>
                          )}
                          <span
                            className={`px-2 py-1 rounded-full ${
                              flood.estimated_passable
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {flood.estimated_passable ? 'Passable' : 'Impassable'}
                          </span>
                        </div>
                        {flood.affected_roads && (
                          <p className="text-xs text-gray-500 mt-2">
                            {flood.affected_roads}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        <p>
                          Lat/Lng:{' '}
                          {`${Number(flood.latitude).toFixed(4)}, ${Number(flood.longitude).toFixed(4)}`}
                        </p>
                        {flood.evacuation_center_nearby && (
                          <p>Evacuation: {flood.evacuation_center_nearby}</p>
                        )}
                        <p>Updated: {new Date(flood.last_updated).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHazardCenter;

