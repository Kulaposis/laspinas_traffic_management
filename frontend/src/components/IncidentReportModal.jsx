import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, MapPin, AlertTriangle, Construction, Shield, Droplets, Car, HelpCircle, CheckCircle, Upload, Sparkles, Search } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import geoapifyService from '../services/geoapifyService';

/**
 * Incident Report Modal Component
 * Google Maps/Waze style incident reporting with large icon-based options
 */
const IncidentReportModal = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  currentLocation = null
}) => {
  const { isDarkMode } = useDarkMode();
  const [step, setStep] = useState(1); // 1: Select type, 2: Add details, 3: Success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [isLocationSearching, setIsLocationSearching] = useState(false);
  const [formData, setFormData] = useState({
    incident_type: '',
    title: '',
    description: '',
    severity: 'medium',
    latitude: currentLocation?.lat || '',
    longitude: currentLocation?.lng || '',
    contact_number: '',
    photo: null,
    photoPreview: null
  });
  const locationSearchTimeoutRef = useRef(null);

  const resetForm = useCallback(() => {
    setFormData({
      incident_type: '',
      title: '',
      description: '',
      severity: 'medium',
      latitude: currentLocation?.lat || '',
      longitude: currentLocation?.lng || '',
      contact_number: '',
      photo: null,
      photoPreview: null
    });
    setLocationQuery('');
    setLocationResults([]);
    setShowLocationResults(false);
  }, [currentLocation]);

  useEffect(() => {
    return () => {
      if (locationSearchTimeoutRef.current) {
        clearTimeout(locationSearchTimeoutRef.current);
      }
    };
  }, []);

  const incidentTypes = [
    {
      type: 'accident',
      label: 'Accident',
      icon: AlertTriangle,
      color: 'bg-red-500',
      hoverColor: 'hover:bg-red-600',
      description: 'Vehicle collision or crash'
    },
    {
      type: 'roadwork',
      label: 'Roadwork',
      icon: Construction,
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600',
      description: 'Construction or maintenance'
    },
    {
      type: 'police',
      label: 'Police',
      icon: Shield,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600',
      description: 'Police presence or checkpoint'
    },
    {
      type: 'flooding',
      label: 'Flood',
      icon: Droplets,
      color: 'bg-cyan-500',
      hoverColor: 'hover:bg-cyan-600',
      description: 'Water on the road'
    },
    {
      type: 'traffic_jam',
      label: 'Traffic',
      icon: Car,
      color: 'bg-yellow-500',
      hoverColor: 'hover:bg-yellow-600',
      description: 'Heavy traffic congestion'
    },
    {
      type: 'other',
      label: 'Other',
      icon: HelpCircle,
      color: 'bg-gray-500',
      hoverColor: 'hover:bg-gray-600',
      description: 'Other hazard or issue'
    }
  ];

  const severityLevels = [
    { value: 'low', label: 'Minor', color: 'bg-green-100 text-green-800 border-green-300' },
    { value: 'medium', label: 'Moderate', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { value: 'high', label: 'Severe', color: 'bg-red-100 text-red-800 border-red-300' }
  ];

  const handleTypeSelect = (type) => {
    setFormData({ ...formData, incident_type: type });
    setStep(2);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        photo: file,
        photoPreview: URL.createObjectURL(file)
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.incident_type) {
      alert('Please select an incident type');
      return;
    }

    setIsSubmitting(true);

    try {
      // Auto-generate title if not provided
      const selectedType = incidentTypes.find(t => t.type === formData.incident_type);
      const finalData = {
        ...formData,
        title: formData.title || selectedType.label,
        latitude: parseFloat(formData.latitude) || currentLocation?.lat,
        longitude: parseFloat(formData.longitude) || currentLocation?.lng,
        contact_number: formData.contact_number?.trim() || ''
      };

      await onSubmit(finalData);
      setSubmittedData(finalData);
      setStep(3); // Show success screen
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-close success screen after 3 seconds
  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => {
        resetForm();
        setStep(1);
        setSubmittedData(null);
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step, resetForm, onClose]);

  const handleClose = () => {
    resetForm();
    setStep(1);
    onClose();
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationQuery('Current location');
          setShowLocationResults(false);
        },
        (error) => {

          alert('Unable to get your location. Please enter manually.');
        }
      );
    }
  };

  const performLocationSearch = async (query) => {
    try {
      const lasPinasCenter = { lat: 14.4504, lng: 121.0170 };
      const response = await geoapifyService.autocompletePlaces(query, {
        limit: 8,
        countrySet: 'PH',
        lat: lasPinasCenter.lat,
        lng: lasPinasCenter.lng,
        radius: 20000
      });

      const formattedResults = (response?.results || [])
        .map((result) => {
          const lat =
            result.position?.lat ??
            result.position?.latitude ??
            result.lat ??
            result.geometry?.coordinates?.[1];
          const lng =
            result.position?.lon ??
            result.position?.longitude ??
            result.lon ??
            result.geometry?.coordinates?.[0];

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
          }

          const primaryName =
            result.poi?.name ||
            result.name ||
            result.address?.line1 ||
            result.address?.street ||
            result.address?.freeformAddress ||
            'Unnamed place';

          const secondaryAddress =
            result.address?.freeformAddress ||
            result.formatted ||
            result.description ||
            [result.address?.city, result.address?.country].filter(Boolean).join(', ');

          return {
            id: result.place_id || result.osm_id || `${lat}-${lng}-${primaryName}`,
            name: primaryName,
            address: secondaryAddress,
            lat,
            lng
          };
        })
        .filter(Boolean);

      setLocationResults(formattedResults);
      setShowLocationResults(true);
    } catch (error) {
      console.error('Location search failed:', error);
      setLocationResults([]);
      setShowLocationResults(true);
    } finally {
      setIsLocationSearching(false);
    }
  };

  const handleLocationQueryChange = (value) => {
    setLocationQuery(value);

    if (locationSearchTimeoutRef.current) {
      clearTimeout(locationSearchTimeoutRef.current);
    }

    if (!value.trim()) {
      setLocationResults([]);
      setShowLocationResults(false);
      setIsLocationSearching(false);
      return;
    }

    setIsLocationSearching(true);
    locationSearchTimeoutRef.current = setTimeout(() => {
      performLocationSearch(value.trim());
    }, 250);
  };

  const handleLocationSelect = (place) => {
    setFormData((prev) => ({
      ...prev,
      latitude: place.lat,
      longitude: place.lng,
      title: prev.title || place.name
    }));
    setLocationQuery(place.name || place.address || '');
    setShowLocationResults(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white'} w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl sm:rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b ${
          isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white'
        }`}>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {step === 1 && 'Report Incident'}
              {step === 2 && 'Add Details'}
              {step === 3 && 'Report Submitted!'}
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {step === 1 && 'What happened?'}
              {step === 2 && 'Tell us more about it'}
              {step === 3 && 'Thank you for your contribution'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
            aria-label="Close"
          >
            <X className={`w-6 h-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Step 1: Select Incident Type */}
          {step === 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {incidentTypes.map((incident) => {
                const Icon = incident.icon;
                return (
                  <button
                    key={incident.type}
                    onClick={() => handleTypeSelect(incident.type)}
                    className={`
                      ${incident.color} ${incident.hoverColor}
                      text-white rounded-2xl p-6 sm:p-8
                      flex flex-col items-center justify-center
                      transition-all duration-300
                      hover:scale-105 active:scale-95
                      shadow-lg hover:shadow-xl
                    `}
                  >
                    <Icon className="w-10 h-10 sm:w-12 sm:h-12 mb-3" />
                    <span className="font-semibold text-sm sm:text-base">{incident.label}</span>
                    <span className="text-xs opacity-90 mt-1 text-center">{incident.description}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Add Details */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Severity */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Severity Level
                </label>
                <div className="flex gap-2">
                  {severityLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setFormData({ ...formData, severity: level.value })}
                      className={`
                        flex-1 py-3 px-4 rounded-lg border-2 font-medium text-sm
                        transition-all duration-200
                        ${formData.severity === level.value 
                          ? ((isDarkMode 
                              ? (level.value === 'low'
                                  ? 'bg-green-900 text-green-300 border-green-700'
                                  : level.value === 'medium'
                                    ? 'bg-yellow-900 text-yellow-300 border-yellow-700'
                                    : 'bg-red-900 text-red-300 border-red-700')
                              : level.color) + ' border-current')
                          : (isDarkMode
                              ? 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300')
                        }
                      `}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add more details about what you see..."
                  className={`w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${
                    isDarkMode
                      ? 'bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-400'
                      : 'border border-gray-300'
                  }`}
                  rows="3"
                />
              </div>

              {/* Contact Number */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Contact Number (Optional)
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  maxLength={20}
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  placeholder="e.g. +63 917 123 4567"
                  className={`w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isDarkMode
                      ? 'bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-400'
                      : 'border border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  We may contact you for clarification if needed.
                </p>
              </div>

              {/* Location */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Location
                </label>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Search for a place
                    </label>
                    <div className="relative">
                      <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border focus-within:ring-2 focus-within:ring-blue-500 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-100'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        <Search className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                        <input
                          type="text"
                          value={locationQuery}
                          onChange={(e) => handleLocationQueryChange(e.target.value)}
                          onFocus={() => {
                            if (locationResults.length) {
                              setShowLocationResults(true);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowLocationResults(false), 120);
                          }}
                          placeholder="Start typing a landmark or address..."
                          className={`flex-1 bg-transparent text-sm focus:outline-none ${
                            isDarkMode ? 'placeholder-gray-500 text-gray-100' : 'placeholder-gray-500 text-gray-900'
                          }`}
                        />
                        {isLocationSearching && (
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                      {showLocationResults && (
                        <div
                          className={`absolute left-0 right-0 mt-2 rounded-xl border shadow-xl max-h-64 overflow-y-auto z-20 ${
                            isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                          }`}
                        >
                          {locationResults.length === 0 ? (
                            <div className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {locationQuery.trim()
                                ? isLocationSearching
                                  ? 'Searching...'
                                  : 'No places found.'
                                : 'Start typing to search for places.'}
                            </div>
                          ) : (
                            locationResults.map((place) => (
                              <button
                                key={place.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleLocationSelect(place)}
                                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                                  isDarkMode
                                    ? 'hover:bg-gray-800 text-gray-200'
                                    : 'hover:bg-gray-100 text-gray-800'
                                }`}
                              >
                                <MapPin className="w-5 h-5 mt-1 text-blue-500 flex-shrink-0" />
                                <div>
                                  <p className="text-sm font-semibold">{place.name}</p>
                                  {place.address && (
                                    <p className="text-xs text-gray-500">{place.address}</p>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="Latitude"
                    className={`flex-1 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isDarkMode ? 'bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-400' : 'border border-gray-300'
                    }`}
                  />
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="Longitude"
                    className={`flex-1 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isDarkMode ? 'bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-400' : 'border border-gray-300'
                    }`}
                  />
                </div>
                <button
                  onClick={handleGetCurrentLocation}
                  className="mt-2 text-sm text-blue-500 hover:text-blue-600 font-medium flex items-center"
                >
                  <MapPin className="w-4 h-4 mr-1" />
                  Use current location
                </button>
              </div>
            </div>

              {/* Photo Upload */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Photo Evidence (Optional)
                </label>
                {formData.photoPreview ? (
                  <div className="relative">
                    <img 
                      src={formData.photoPreview} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setFormData({ ...formData, photo: null, photoPreview: null })}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    isDarkMode 
                      ? 'border-gray-600 hover:border-blue-500 hover:bg-blue-900/20' 
                      : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}>
                    <Camera className={`w-8 h-8 mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tap to add photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    isDarkMode 
                      ? 'border-2 border-gray-600 text-gray-300 hover:bg-gray-800' 
                      : 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Submit Report
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success Screen */}
          {step === 3 && submittedData && (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
              {/* Animated Success Icon */}
              <div className="relative mb-6">
                {/* Pulsing background circle */}
                <div className={`absolute inset-0 rounded-full animate-ping ${
                  isDarkMode ? 'bg-green-500/20' : 'bg-green-500/30'
                }`} style={{ animationDuration: '2s' }}></div>
                
                {/* Main success circle */}
                <div className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center ${
                  isDarkMode 
                    ? 'bg-gradient-to-br from-green-600 to-green-700' 
                    : 'bg-gradient-to-br from-green-500 to-green-600'
                } shadow-2xl transform transition-all duration-500 scale-100`}>
                  <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-white animate-scale-in" />
                </div>

                {/* Sparkle effects */}
                <Sparkles className={`absolute -top-2 -right-2 w-6 h-6 ${
                  isDarkMode ? 'text-yellow-400' : 'text-yellow-500'
                } animate-bounce`} style={{ animationDelay: '0.5s' }} />
                <Sparkles className={`absolute -bottom-2 -left-2 w-5 h-5 ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-500'
                } animate-bounce`} style={{ animationDelay: '1s' }} />
              </div>

              {/* Success Message */}
              <h3 className={`text-2xl sm:text-3xl font-bold mb-3 text-center ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Report Submitted Successfully!
              </h3>
              
              <p className={`text-sm sm:text-base mb-6 text-center max-w-md ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Your incident report has been received and will be reviewed by our team. 
                Other drivers will be notified to help keep the roads safe.
              </p>

              {/* Report Summary Card */}
              <div className={`w-full max-w-md rounded-2xl p-4 sm:p-6 mb-6 ${
                isDarkMode 
                  ? 'bg-gray-800/50 border border-gray-700' 
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-start space-x-4">
                  {/* Incident Icon */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                    submittedData.incident_type === 'accident' ? 'bg-red-500/20' :
                    submittedData.incident_type === 'roadwork' ? 'bg-orange-500/20' :
                    submittedData.incident_type === 'police' ? 'bg-blue-500/20' :
                    submittedData.incident_type === 'flooding' ? 'bg-cyan-500/20' :
                    submittedData.incident_type === 'traffic_jam' ? 'bg-yellow-500/20' :
                    'bg-gray-500/20'
                  }`}>
                    {(() => {
                      const selectedType = incidentTypes.find(t => t.type === submittedData.incident_type);
                      const Icon = selectedType?.icon || AlertTriangle;
                      return <Icon className={`w-6 h-6 ${
                        submittedData.incident_type === 'accident' ? 'text-red-500' :
                        submittedData.incident_type === 'roadwork' ? 'text-orange-500' :
                        submittedData.incident_type === 'police' ? 'text-blue-500' :
                        submittedData.incident_type === 'flooding' ? 'text-cyan-500' :
                        submittedData.incident_type === 'traffic_jam' ? 'text-yellow-500' :
                        'text-gray-500'
                      }`} />;
                    })()}
                  </div>

                  {/* Report Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold text-base mb-1 ${
                      isDarkMode ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {submittedData.title || incidentTypes.find(t => t.type === submittedData.incident_type)?.label}
                    </h4>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        submittedData.severity === 'low' 
                          ? (isDarkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800')
                          : submittedData.severity === 'medium'
                            ? (isDarkMode ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-800')
                            : (isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-800')
                      }`}>
                        {submittedData.severity === 'low' ? 'Minor' : 
                         submittedData.severity === 'medium' ? 'Moderate' : 'Severe'}
                      </span>
                    </div>
                    {submittedData.description && (
                      <p className={`text-xs sm:text-sm line-clamp-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {submittedData.description}
                      </p>
                    )}
                    {submittedData.contact_number && (
                      <p className={`text-xs sm:text-sm mt-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Contact: {submittedData.contact_number}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                <button
                  onClick={handleClose}
                  className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20'
                  }`}
                >
                  Done
                </button>
              </div>

              {/* Auto-close indicator */}
              <p className={`text-xs mt-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                This window will close automatically in a few seconds...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncidentReportModal;

