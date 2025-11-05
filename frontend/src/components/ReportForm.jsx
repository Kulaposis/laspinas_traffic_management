import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Image, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle,
  Camera,
  Navigation,
  Clock,
  User,
  FileText,
  Star,
  Sparkles,
  Award
} from 'lucide-react';
import reportService from '../services/reportService';

const ReportForm = ({ onSubmit, onCancel, initialData = null }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    report_type: initialData?.report_type || 'accident',
    latitude: initialData?.latitude || '',
    longitude: initialData?.longitude || '',
    address: initialData?.address || '',
    image_url: initialData?.image_url || '',
    urgency: initialData?.urgency || 'medium',
    estimated_duration: initialData?.estimated_duration || '',
  });
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [pointsToEarn, setPointsToEarn] = useState(10);

  const steps = [
    {
      id: 'type',
      title: 'What happened?',
      description: 'Tell us about the incident',
      icon: AlertCircle,
      color: 'text-red-500'
    },
    {
      id: 'details',
      title: 'Add details',
      description: 'Help us understand better',
      icon: FileText,
      color: 'text-blue-500'
    },
    {
      id: 'location',
      title: 'Where is it?',
      description: 'Pin the exact location',
      icon: MapPin,
      color: 'text-green-500'
    },
    {
      id: 'media',
      title: 'Add evidence',
      description: 'Photos help a lot!',
      icon: Camera,
      color: 'text-purple-500'
    },
    {
      id: 'review',
      title: 'Review & Submit',
      description: 'Check everything looks good',
      icon: CheckCircle,
      color: 'text-emerald-500'
    }
  ];

  const reportTypes = [
    { 
      value: 'accident', 
      label: 'Traffic Accident', 
      icon: '🚗💥', 
      description: 'Vehicle collision or crash',
      points: 15,
      urgency: 'high'
    },
    { 
      value: 'traffic_jam', 
      label: 'Traffic Jam', 
      icon: '🚦🐌', 
      description: 'Heavy traffic congestion',
      points: 10,
      urgency: 'medium'
    },
    { 
      value: 'road_closure', 
      label: 'Road Closure', 
      icon: '🚧⛔', 
      description: 'Road is blocked or closed',
      points: 12,
      urgency: 'high'
    },
    { 
      value: 'flooding', 
      label: 'Flooding', 
      icon: '🌊⚠️', 
      description: 'Water on the road',
      points: 15,
      urgency: 'high'
    },
    { 
      value: 'broken_traffic_light', 
      label: 'Broken Traffic Light', 
      icon: '🚦❌', 
      description: 'Traffic signal not working',
      points: 12,
      urgency: 'medium'
    },
    { 
      value: 'illegal_parking', 
      label: 'Illegal Parking', 
      icon: '🚗🚫', 
      description: 'Vehicle blocking traffic',
      points: 8,
      urgency: 'low'
    },
    { 
      value: 'other', 
      label: 'Other Issue', 
      icon: '❓📋', 
      description: 'Something else affecting traffic',
      points: 10,
      urgency: 'medium'
    },
  ];

  // Calculate points based on report details
  useEffect(() => {
    const selectedType = reportTypes.find(type => type.value === formData.report_type);
    let basePoints = selectedType?.points || 10;
    
    // Bonus points for additional details
    if (formData.description && formData.description.length > 50) basePoints += 2;
    if (formData.image_url) basePoints += 5;
    if (formData.address) basePoints += 2;
    if (formData.urgency === 'high') basePoints += 3;
    
    setPointsToEarn(basePoints);
  }, [formData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateStep = (stepIndex) => {
    const errors = {};
    const step = steps[stepIndex];

    switch (step.id) {
      case 'type':
        if (!formData.report_type) errors.report_type = 'Please select a report type';
        if (!formData.title.trim()) errors.title = 'Please provide a title';
        break;
      case 'details':
        if (!formData.description.trim()) errors.description = 'Please provide some details';
        break;
      case 'location':
        if (!formData.latitude || !formData.longitude) {
          errors.location = 'Please provide location coordinates';
        }
        break;
      case 'media':
        // Optional step - no required validation
        break;
      case 'review':
        // Final validation happens in handleSubmit
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const goToStep = (stepIndex) => {
    // Allow going to previous steps or next step if current is valid
    if (stepIndex <= currentStep || validateStep(currentStep)) {
      setCurrentStep(stepIndex);
    }
  };

  const getCurrentLocation = () => {
    setLocationLoading(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          }));
          setLocationLoading(false);
        },
        (error) => {

          alert('Unable to get your location. Please enter coordinates manually.');
          setLocationLoading(false);
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert lat/lng to numbers
      const submitData = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
      };

      await onSubmit(submitData);
    } catch (error) {

      alert('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step Components
  const StepIndicator = () => (
    <div className="mb-6 sm:mb-8">
      {/* Mobile: Show only current step */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-xs text-gray-400">
            {Math.round(((currentStep + 1) / steps.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop: Show all steps */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = index <= currentStep;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => isClickable && goToStep(index)}
                disabled={!isClickable}
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : isCurrent 
                      ? 'bg-primary-500 border-primary-500 text-white' 
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                } ${isClickable ? 'hover:scale-110 cursor-pointer active:scale-95' : 'cursor-not-allowed'}`}
                aria-label={`Step ${index + 1}: ${step.title}`}
              >
                {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </button>
              {index < steps.length - 1 && (
                <div className={`h-1 w-12 lg:w-16 mx-2 transition-all duration-500 ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.id) {
      case 'type':
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">What happened?</h3>
              <p className="text-sm sm:text-base text-gray-600">Select the type of incident you're reporting</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {reportTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, report_type: type.value, urgency: type.urgency }));
                  }}
                  className={`p-3 sm:p-4 border-2 rounded-lg text-left transition-all duration-300 active:scale-95 sm:hover:scale-105 ${
                    formData.report_type === type.value
                      ? 'border-primary-500 bg-primary-50 shadow-md'
                      : 'border-gray-200 hover:border-primary-300 active:border-primary-400'
                  }`}
                >
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <span className="text-xl sm:text-2xl flex-shrink-0">{type.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm sm:text-base text-gray-900">{type.label}</h4>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">{type.description}</p>
                      <div className="flex flex-wrap items-center mt-2 gap-1.5 sm:gap-2">
                        <span className="text-[10px] sm:text-xs bg-yellow-100 text-yellow-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                          +{type.points} points
                        </span>
                        <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                          type.urgency === 'high' ? 'bg-red-100 text-red-800' :
                          type.urgency === 'medium' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {type.urgency} priority
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div>
              <label className="label text-sm sm:text-base">Quick Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`input-field text-base ${validationErrors.title ? 'border-red-500' : ''}`}
                placeholder="Brief description of what happened"
              />
              {validationErrors.title && (
                <p className="text-red-500 text-xs sm:text-sm mt-1">{validationErrors.title}</p>
              )}
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Tell us more</h3>
              <p className="text-sm sm:text-base text-gray-600">The more details you provide, the better we can help</p>
            </div>

            <div>
              <label className="label text-sm sm:text-base">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className={`input-field text-base ${validationErrors.description ? 'border-red-500' : ''}`}
                rows="4"
                placeholder="What exactly happened? When did it occur? Is anyone hurt? Any other important details..."
              />
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-1 gap-1">
                {validationErrors.description ? (
                  <p className="text-red-500 text-xs sm:text-sm">{validationErrors.description}</p>
                ) : (
                  <p className="text-gray-500 text-xs sm:text-sm">
                    {formData.description.length > 50 ? '✅ Great detail! +2 bonus points' : 'More detail = more points'}
                  </p>
                )}
                <span className="text-xs sm:text-sm text-gray-400">{formData.description.length}/500</span>
              </div>
            </div>

            <div>
              <label className="label text-sm sm:text-base">How long might this last?</label>
              <select
                name="estimated_duration"
                value={formData.estimated_duration}
                onChange={handleInputChange}
                className="input-field text-base"
              >
                <option value="">Not sure</option>
                <option value="few_minutes">A few minutes</option>
                <option value="30_minutes">About 30 minutes</option>
                <option value="1_hour">About 1 hour</option>
                <option value="several_hours">Several hours</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Where is it?</h3>
              <p className="text-sm sm:text-base text-gray-600">Help us locate the incident precisely</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Navigation className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm sm:text-base text-blue-900">Use your current location</h4>
                  <p className="text-xs sm:text-sm text-blue-700">Most accurate and fastest way</p>
                </div>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                  className="btn-primary w-full sm:w-auto text-sm sm:text-base py-2"
                >
                  {locationLoading ? 'Getting...' : 'Use GPS'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="label text-sm sm:text-base">Latitude *</label>
                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  className={`input-field text-base ${validationErrors.location ? 'border-red-500' : ''}`}
                  step="any"
                  placeholder="14.5995"
                />
              </div>
              <div>
                <label className="label text-sm sm:text-base">Longitude *</label>
                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  className={`input-field text-base ${validationErrors.location ? 'border-red-500' : ''}`}
                  step="any"
                  placeholder="120.9842"
                />
              </div>
            </div>

            {validationErrors.location && (
              <p className="text-red-500 text-xs sm:text-sm">{validationErrors.location}</p>
            )}

            <div>
              <label className="label text-sm sm:text-base">Address or Landmark</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="input-field text-base"
                placeholder="e.g., Near SM Southmall, Alabang-Zapote Road"
              />
              {formData.address && (
                <p className="text-green-600 text-xs sm:text-sm mt-1">✅ Address added! +2 bonus points</p>
              )}
            </div>
          </div>
        );

      case 'media':
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Add evidence</h3>
              <p className="text-sm sm:text-base text-gray-600">Photos help authorities understand the situation better</p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 sm:p-6 text-center">
              <Camera className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600 mx-auto mb-3 sm:mb-4" />
              <h4 className="font-semibold text-sm sm:text-base text-purple-900 mb-2">📸 Photo Evidence</h4>
              <p className="text-xs sm:text-sm text-purple-700 mb-3 sm:mb-4">
                Upload a photo to help authorities assess the situation
              </p>
              <div className="bg-yellow-100 text-yellow-800 text-xs sm:text-sm px-3 py-2 rounded-full inline-block">
                +5 bonus points for adding a photo!
              </div>
            </div>

            <div>
              <label className="label text-sm sm:text-base">Image URL</label>
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleInputChange}
                className="input-field text-base"
                placeholder="https://example.com/image.jpg or paste image link"
              />
              {formData.image_url && (
                <div className="mt-2">
                  <p className="text-green-600 text-xs sm:text-sm mb-2">✅ Image added! +5 bonus points</p>
                  <img 
                    src={formData.image_url} 
                    alt="Report preview" 
                    className="w-full h-40 sm:h-48 object-cover rounded-lg border"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="text-center text-xs sm:text-sm text-gray-500">
              <p>💡 Tip: You can skip this step and add photos later if needed</p>
            </div>
          </div>
        );

      case 'review':
        const selectedType = reportTypes.find(type => type.value === formData.report_type);
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Review & Submit</h3>
              <p className="text-sm sm:text-base text-gray-600">Check everything looks good before submitting</p>
            </div>

            {/* Points Summary */}
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg p-4 sm:p-6 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Award className="w-6 h-6 sm:w-8 sm:h-8" />
                <span className="text-2xl sm:text-3xl font-bold">{pointsToEarn}</span>
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h4 className="text-lg sm:text-xl font-semibold mb-1">Citizen Points to Earn!</h4>
              <p className="text-xs sm:text-sm text-yellow-100">Thank you for helping make Las Piñas safer</p>
            </div>

            {/* Report Summary */}
            <div className="bg-gray-50 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <span className="text-2xl sm:text-3xl flex-shrink-0">{selectedType?.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base sm:text-lg text-gray-900 line-clamp-2">{formData.title}</h4>
                  <p className="text-sm sm:text-base text-primary-600 font-medium">{selectedType?.label}</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-2 line-clamp-3">{formData.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-gray-500">Location:</span>
                  <p className="font-medium line-clamp-2">
                    {formData.address || `${formData.latitude}, ${formData.longitude}`}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Priority:</span>
                  <p className={`font-medium ${
                    formData.urgency === 'high' ? 'text-red-600' :
                    formData.urgency === 'medium' ? 'text-orange-600' :
                    'text-green-600'
                  }`}>
                    {formData.urgency} priority
                  </p>
                </div>
              </div>

              {formData.image_url && (
                <div>
                  <span className="text-gray-500 text-xs sm:text-sm">Photo Evidence:</span>
                  <img 
                    src={formData.image_url} 
                    alt="Report evidence" 
                    className="w-full h-28 sm:h-32 object-cover rounded-lg mt-1"
                  />
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start space-x-2 sm:space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs sm:text-sm text-blue-800">
                  <p className="font-medium mb-1">What happens next?</p>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Your report will be reviewed by LGU staff</li>
                    <li>• You'll receive updates on the status</li>
                    <li>• Earn citizen points for your contribution</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 sm:p-6 border-b shadow-sm">
          <div className="flex-1 min-w-0 mr-2">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
              {initialData ? 'Update Report' : '📋 Report an Incident'}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 truncate">
              Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
            aria-label="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <StepIndicator />
          
          <form onSubmit={handleSubmit}>
            <div className="min-h-[300px] sm:min-h-[400px]">
              {renderStepContent()}
            </div>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-6 sm:pt-8 border-t gap-3 sm:gap-0">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 0}
                className={`flex items-center justify-center space-x-2 px-4 py-2.5 sm:py-2 rounded-lg transition-colors w-full sm:w-auto ${
                  currentStep === 0 
                    ? 'text-gray-400 cursor-not-allowed bg-gray-100' 
                    : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm sm:text-base">Previous</span>
              </button>

              <div className="text-center order-first sm:order-none">
                <div className="text-xs sm:text-sm text-gray-500">
                  You'll earn <span className="font-semibold text-yellow-600">{pointsToEarn} points</span>
                </div>
              </div>

              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center justify-center space-x-2 bg-primary-600 text-white px-6 py-2.5 sm:py-2 rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors w-full sm:w-auto shadow-md"
                >
                  <span className="text-sm sm:text-base">Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-2.5 sm:py-2 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 w-full sm:w-auto shadow-md"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span className="text-sm sm:text-base">Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm sm:text-base">Submit Report</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReportForm;
