import React, { useState } from 'react';
import { X, Camera, MapPin, AlertTriangle, Construction, Shield, Droplets, Car, HelpCircle, CheckCircle, Upload } from 'lucide-react';

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
  const [step, setStep] = useState(1); // 1: Select type, 2: Add details, 3: Confirm
  const [formData, setFormData] = useState({
    incident_type: '',
    title: '',
    description: '',
    severity: 'medium',
    latitude: currentLocation?.lat || '',
    longitude: currentLocation?.lng || '',
    photo: null,
    photoPreview: null
  });

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

    // Auto-generate title if not provided
    const selectedType = incidentTypes.find(t => t.type === formData.incident_type);
    const finalData = {
      ...formData,
      title: formData.title || selectedType.label,
      latitude: parseFloat(formData.latitude) || currentLocation?.lat,
      longitude: parseFloat(formData.longitude) || currentLocation?.lng
    };

    await onSubmit(finalData);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      incident_type: '',
      title: '',
      description: '',
      severity: 'medium',
      latitude: currentLocation?.lat || '',
      longitude: currentLocation?.lng || '',
      photo: null,
      photoPreview: null
    });
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
        },
        (error) => {

          alert('Unable to get your location. Please enter manually.');
        }
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl sm:rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 sm:p-6 border-b">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {step === 1 && 'Report Incident'}
              {step === 2 && 'Add Details'}
              {step === 3 && 'Confirm Report'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 1 && 'What happened?'}
              {step === 2 && 'Tell us more about it'}
              {step === 3 && 'Review before submitting'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-gray-600" />
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                          ? level.color + ' border-current' 
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add more details about what you see..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows="3"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="Latitude"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="Longitude"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={handleGetCurrentLocation}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
                >
                  <MapPin className="w-4 h-4 mr-1" />
                  Use current location
                </button>
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Tap to add photo</span>
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
                  className="flex-1 py-3 px-4 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Submit Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncidentReportModal;

