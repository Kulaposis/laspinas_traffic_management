import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, X } from 'lucide-react';
import emergencyService from '../services/emergencyService';
import { CardSkeleton, ListItemSkeleton } from '../components/LoadingSkeleton';
import logsService from '../services/logsService';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';

const EmergencyCenter = () => {
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [allEmergencies, setAllEmergencies] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [myEmergencyReports, setMyEmergencyReports] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('emergency');
  
  // Emergency Button State
  const [showEmergencyButton, setShowEmergencyButton] = useState(false);
  const [emergencyStep, setEmergencyStep] = useState(1);
  const [emergencyType, setEmergencyType] = useState('');
  const [emergencyDetails, setEmergencyDetails] = useState({
    title: '',
    description: '',
    severity: 'medium',
    latitude: 14.4504,
    longitude: 121.0170,
    address: '',
    photo_urls: []
  });
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Emergency Detail Modal State
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [showEmergencyDetail, setShowEmergencyDetail] = useState(false);
  const [isUpdatingEmergency, setIsUpdatingEmergency] = useState(false);

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedEmergency, setSubmittedEmergency] = useState(null);
  
  // Update Success Modal State
  const [showUpdateSuccessModal, setShowUpdateSuccessModal] = useState(false);
  const [updateSuccessMessage, setUpdateSuccessMessage] = useState('');

  // Photo Modal State
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Complaint Form State
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [complaintFormStep, setComplaintFormStep] = useState(1);
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);
  const [isGettingComplaintLocation, setIsGettingComplaintLocation] = useState(false);
  const [showComplaintSuccess, setShowComplaintSuccess] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [complaintData, setComplaintData] = useState({
    type: 'complaint',
    category: 'illegal_parking',
    title: '',
    description: '',
    location_description: '',
    latitude: 14.4504,
    longitude: 121.0170
  });

  // Logs State
  const [activityLogs, setActivityLogs] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsStatistics, setLogsStatistics] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLogTab, setSelectedLogTab] = useState('activity');
  const [logsFilters, setLogsFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    activityType: '',
    searchQuery: '',
    limit: 50,
    offset: 0
  });

  const isStaff = ['admin', 'lgu_staff'].includes((user?.role || '').toLowerCase());
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  // Restrict page to admin-side only
  if (!user || !isStaff) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-2xl shadow border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600">This page is available to administrators only.</p>
        </div>
      </div>
    );
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      if (isStaff) {
        // Fetch data with individual error handling
        const results = await Promise.allSettled([
          emergencyService.getActiveEmergencies(),
          emergencyService.getEmergencies({ limit: 50 }),
          emergencyService.getComplaintsSuggestions({ limit: 50 }),
          emergencyService.getEmergencyStatistics().catch(() => ({
            emergency_statistics: { total: 0, resolved: 0, active: 0, resolution_rate: 0, avg_response_time_minutes: 0 },
            complaint_statistics: { total_complaints: 0, total_suggestions: 0, resolved: 0, resolution_rate: 0 }
          }))
        ]);
        
        // Handle results
        // Show only VERIFIED emergencies in the Emergency Center; pending ones go to Moderation first
        const active = results[0].status === 'fulfilled' ? results[0].value : [];
        const verifiedActive = Array.isArray(active)
          ? active.filter((e) => (e.verification_status || 'pending') === 'verified')
          : [];
        setActiveEmergencies(verifiedActive);
        setAllEmergencies(results[1].status === 'fulfilled' ? results[1].value : []);
        setComplaints(results[2].status === 'fulfilled' ? results[2].value : []);
        setStatistics(results[3].status === 'fulfilled' ? results[3].value : null);
        
        // Check for any failures
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0) {

          setError(`Some data may not be up to date. ${failures.length} service(s) unavailable.`);
        }
      } else {
        // Citizens can see their own complaints and emergency reports
        const results = await Promise.allSettled([
          emergencyService.getComplaintsSuggestions({ limit: 50 }),
          emergencyService.getMyEmergencyReports()
        ]);
        
        setComplaints(results[0].status === 'fulfilled' ? results[0].value : []);
        setMyEmergencyReports(results[1].status === 'fulfilled' ? results[1].value : []);
        
        // Check for failures
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0) {

          setError(`Some data may not be up to date. Please refresh the page.`);
        }
      }
    } catch (err) {

      setError('Unable to load emergency data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [isStaff]);

  useEffect(() => {
    // Set default tab based on user role
    setActiveTab(isStaff ? 'emergency' : 'my-reports');
  }, [isStaff]);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds for staff, every 60 seconds for citizens (to track progress)
    const refreshInterval = isStaff ? 30000 : 60000;
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, isStaff]);

  // Fetch logs data
  const fetchLogsData = useCallback(async () => {
    if (!isStaff || activeTab !== 'logs') return;
    
    try {
      setLogsLoading(true);
      
      const [activityData, systemData, auditData, statsData] = await Promise.all([
        logsService.getActivityLogs(logsFilters),
        logsService.getSystemLogs(logsFilters),
        logsService.getAuditLogs(logsFilters),
        logsService.getLogsStatistics({
          startDate: logsFilters.startDate,
          endDate: logsFilters.endDate
        })
      ]);
      
      setActivityLogs(activityData);
      setSystemLogs(systemData);
      setAuditLogs(auditData);
      setLogsStatistics(statsData);
    } catch (err) {

      setError('Failed to fetch logs data');
    } finally {
      setLogsLoading(false);
    }
  }, [isStaff, activeTab, logsFilters]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogsData();
    }
  }, [fetchLogsData, activeTab]);

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setEmergencyDetails({
            ...emergencyDetails,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setIsGettingLocation(false);
        },
        (error) => {

          setIsGettingLocation(false);
          // Keep default Las Piñas coordinates
        }
      );
    } else {
      setIsGettingLocation(false);
    }
  };

  const handleEmergencyReport = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      
      // Upload photos if any
      let photoUrls = [];
      if (uploadedPhotos.length > 0) {
        photoUrls = await uploadPhotosToServer(uploadedPhotos);
      }
      
      const emergencyData = {
        emergency_type: emergencyType,
        ...emergencyDetails,
        photo_urls: photoUrls
      };
      
      const response = await emergencyService.reportEmergency(emergencyData);
      
      // Store the submitted emergency data for the success modal
      setSubmittedEmergency({
        ...response,
        emergency_type: emergencyType,
        ...emergencyDetails
      });
      
      // Reset form
      setShowEmergencyButton(false);
      setEmergencyStep(1);
      setEmergencyType('');
      setEmergencyDetails({
        title: '',
        description: '',
        severity: 'medium',
        latitude: 14.4504,
        longitude: 121.0170,
        address: '',
        photo_urls: []
      });
      setUploadedPhotos([]);
      setIsSubmitting(false);
      
      fetchData();
      
      // Show success modal instead of alert
      setShowSuccessModal(true);
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (emergencyStep < 5) {
      setEmergencyStep(emergencyStep + 1);
    }
  };

  const prevStep = () => {
    if (emergencyStep > 1) {
      setEmergencyStep(emergencyStep - 1);
    }
  };

  const resetEmergencyForm = () => {
    setShowEmergencyButton(false);
    setEmergencyStep(1);
    setEmergencyType('');
    setEmergencyDetails({
      title: '',
      description: '',
      severity: 'medium',
      latitude: 14.4504,
      longitude: 121.0170,
      address: '',
      photo_urls: []
    });
    setUploadedPhotos([]);
    setIsSubmitting(false);
  };

  // Photo upload functions
  const handlePhotoUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length + uploadedPhotos.length > 3) {
      alert('You can upload maximum 3 photos');
      return;
    }

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert(`File ${file.name} is too large. Maximum size is 5MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const newPhoto = {
          id: Date.now() + Math.random(),
          file: file,
          preview: e.target.result,
          name: file.name,
          size: file.size
        };
        setUploadedPhotos(prev => [...prev, newPhoto]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (photoId) => {
    setUploadedPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  // Simulate photo upload to server (in real app, this would upload to cloud storage)
  const uploadPhotosToServer = async (photos) => {
    // For now, we'll use the base64 data URLs directly
    // In a real app, you'd upload to AWS S3, Cloudinary, etc. and get back real URLs
    const photoUrls = photos.map(photo => photo.preview); // Use the base64 data URL
    return photoUrls;
  };

  const getComplaintLocation = () => {
    setIsGettingComplaintLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setComplaintData({
            ...complaintData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setIsGettingComplaintLocation(false);
        },
        (error) => {

          setIsGettingComplaintLocation(false);
        }
      );
    } else {
      setIsGettingComplaintLocation(false);
    }
  };

  const nextComplaintStep = () => {
    if (complaintFormStep < 3) {
      setComplaintFormStep(complaintFormStep + 1);
    }
  };

  const prevComplaintStep = () => {
    if (complaintFormStep > 1) {
      setComplaintFormStep(complaintFormStep - 1);
    }
  };

  const resetComplaintForm = () => {
    setShowComplaintForm(false);
    setComplaintFormStep(1);
    setComplaintData({
      type: 'complaint',
      category: 'illegal_parking',
      title: '',
      description: '',
      location_description: '',
      latitude: 14.4504,
      longitude: 121.0170
    });
    setIsSubmittingComplaint(false);
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingComplaint(true);
      const response = await emergencyService.submitComplaint(complaintData);
      
      setSubmittedComplaint(response);
      setShowComplaintForm(false);
      setComplaintFormStep(1);
      setComplaintData({
        type: 'complaint',
        category: 'illegal_parking',
        title: '',
        description: '',
        location_description: '',
        latitude: 14.4504,
        longitude: 121.0170
      });
      setIsSubmittingComplaint(false);
      
      fetchData();
      setShowComplaintSuccess(true);
    } catch (err) {
      setError(err.message);
      setIsSubmittingComplaint(false);
    }
  };

  const handleEmergencyClick = (emergency) => {
    setSelectedEmergency(emergency);
    setShowEmergencyDetail(true);
  };

  const handleUpdateEmergencyStatus = async (emergencyId, updateData) => {
    try {
      setIsUpdatingEmergency(true);
      await emergencyService.updateEmergency(emergencyId, updateData);
      
      // Determine success message based on update type
      let message = 'Emergency updated successfully!';
      if (updateData.status === 'RESOLVED') {
        message = 'Emergency resolved successfully!';
      } else if (updateData.status === 'DISPATCHED') {
        message = 'Emergency dispatched successfully!';
      } else if (updateData.status === 'IN_PROGRESS') {
        message = 'Emergency status updated to In Progress!';
      }
      
      // Show success modal
      setUpdateSuccessMessage(message);
      setShowUpdateSuccessModal(true);
      
      // Refresh data and close modal
      fetchData();
      setShowEmergencyDetail(false);
      setSelectedEmergency(null);
      
      // Auto-close modal after 3 seconds
      setTimeout(() => {
        setShowUpdateSuccessModal(false);
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUpdatingEmergency(false);
    }
  };

  const getEmergencyIcon = (type) => emergencyService.getEmergencyIcon(type);
  const getEmergencyColor = (severity) => emergencyService.getEmergencyColor(severity);
  const getStatusColor = (status) => emergencyService.getStatusColor(status);
  
  // Helper function to get verification status color and icon
  const getVerificationStatusColor = (verificationStatus) => {
    switch (verificationStatus) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'flagged': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVerificationIcon = (verificationStatus) => {
    switch (verificationStatus) {
      case 'verified': return '✅';
      case 'rejected': return '❌';
      case 'flagged': return '⚠️';
      case 'pending': return '⏳';
      default: return '⏳';
    }
  };

  const getReporterContact = (record) => {
    return record?.reporter_phone || record?.contact_number || record?.reporter_contact || '';
  };

  // Progress Tracker Component
  const EmergencyProgressTracker = ({ emergency }) => {
    const steps = [
      { key: 'reported', label: 'Reported', icon: '📝', description: 'Emergency reported' },
      { key: 'dispatched', label: 'Dispatched', icon: '🚨', description: 'Responder dispatched' },
      { key: 'in_progress', label: 'In Progress', icon: '🚑', description: 'Help is on the way' },
      { key: 'resolved', label: 'Resolved', icon: '✅', description: 'Emergency resolved' }
    ];

    const getCurrentStepIndex = () => {
      const statusMap = {
        'reported': 0,
        'dispatched': 1,
        'in_progress': 2,
        'resolved': 3,
        'cancelled': -1
      };
      return statusMap[emergency.status] || 0;
    };

    const currentStep = getCurrentStepIndex();
    const isCancelled = emergency.status === 'cancelled';

    return (
      <div className="w-full">
        <div className="flex items-center justify-between relative">
          {/* Progress Line */}
          <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 rounded-full">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                isCancelled ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: isCancelled ? '100%' : `${(currentStep / (steps.length - 1)) * 100}%` }}
            />
          </div>

          {steps.map((step, index) => {
            const isActive = index <= currentStep && !isCancelled;
            const isCurrent = index === currentStep && !isCancelled;
            
            return (
              <div key={step.key} className="flex flex-col items-center relative z-10">
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 ${
                    isCancelled && index === currentStep
                      ? 'bg-red-500 text-white ring-4 ring-red-200'
                      : isActive
                      ? 'bg-green-500 text-white ring-4 ring-green-200'
                      : isCurrent
                      ? 'bg-blue-500 text-white ring-4 ring-blue-200 animate-pulse'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCancelled && index === currentStep ? '❌' : step.icon}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-semibold ${
                    isActive || isCurrent ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-xs ${
                    isActive || isCurrent ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Details */}
        <div className="mt-6 bg-gray-50 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-gray-600">Current Status:</span>
              <p className={`font-bold ${
                isCancelled ? 'text-red-600' : 
                emergency.status?.toUpperCase() === 'RESOLVED' ? 'text-green-600' : 'text-blue-600'
              }`}>
                {emergency.status.replace('_', ' ').toUpperCase()}
                {isCancelled && ' - Emergency Cancelled'}
              </p>
            </div>
            {emergency.verification_status && (
              <div>
                <span className="font-semibold text-gray-600">Verification Status:</span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getVerificationStatusColor(emergency.verification_status)}`}>
                    <span>{getVerificationIcon(emergency.verification_status)}</span>
                    <span>{emergency.verification_status.toUpperCase()}</span>
                  </span>
                </div>
                {emergency.verification_notes && (
                  <p className="text-xs text-gray-600 mt-1 italic">"{emergency.verification_notes}"</p>
                )}
              </div>
            )}
            <div>
              <span className="font-semibold text-gray-600">Last Updated:</span>
              <p className="text-gray-900">
                {new Date(emergency.updated_at || emergency.created_at).toLocaleString()}
              </p>
            </div>
            {emergency.assigned_responder && (
              <div>
                <span className="font-semibold text-gray-600">Assigned Responder:</span>
                <p className="text-gray-900">{emergency.assigned_responder}</p>
              </div>
            )}
            {emergency.estimated_response_time && emergency.status?.toUpperCase() !== 'RESOLVED' && (
              <div>
                <span className="font-semibold text-gray-600">Estimated Time:</span>
                <p className="text-blue-600 font-semibold">{emergency.estimated_response_time} minutes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="h-10 bg-gray-200 rounded w-64 mb-4 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50/30 to-yellow-50/20">
      {/* Enhanced Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                  Emergency Response Center
                </h1>
                <p className="text-gray-600 mt-1 text-lg">
                  {isStaff ? 'Emergency management and response coordination' : 'Report emergencies and submit complaints'}
                </p>
              </div>
            </div>
            
            {/* Hide EMERGENCY and Report Issue buttons for admin users */}
            {!isAdmin && (
              <div className="flex items-center space-x-4">
                {/* Enhanced Emergency Button */}
                <button
                  onClick={() => setShowEmergencyButton(true)}
                  className="group relative px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl font-bold text-lg shadow-2xl transform transition-all duration-300 hover:scale-110 hover:shadow-red-500/25 hover:from-red-600 hover:to-red-700 active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-red-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center space-x-3">
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    </div>
                    <span>EMERGENCY</span>
                    <svg className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </button>
                
                {/* Enhanced Complaint Button */}
                <button
                  onClick={() => setShowComplaintForm(true)}
                  className="group px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-700 active:scale-95"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 group-hover:rotate-6 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Report Issue</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Enhanced Statistics Cards (Staff Only) */}
        {isStaff && statistics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Active Emergencies Card */}
            <div className="group relative bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-gradient-to-br from-red-100 to-orange-100 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  {statistics.emergency_statistics.active > 0 && (
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-red-600 font-semibold">ACTIVE</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Active Emergencies</p>
                  <p className="text-4xl font-bold text-gray-900 mb-2">
                    {statistics.emergency_statistics.active}
                  </p>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min((statistics.emergency_statistics.active / 10) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Max: 10</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resolution Rate Card */}
            <div className="group relative bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Resolution Rate</p>
                  <p className="text-4xl font-bold text-gray-900 mb-2">
                    {Math.round(statistics.emergency_statistics.resolution_rate)}%
                  </p>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${statistics.emergency_statistics.resolution_rate}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-green-600 font-semibold">Excellent</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Response Time Card */}
            <div className="group relative bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Avg Response Time</p>
                  <p className="text-4xl font-bold text-gray-900 mb-2">
                    {statistics.emergency_statistics.avg_response_time_minutes}m
                  </p>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.max(20, 100 - (statistics.emergency_statistics.avg_response_time_minutes / 15) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-blue-600 font-semibold">Fast</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Complaints Card */}
            <div className="group relative bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Total Complaints</p>
                  <p className="text-4xl font-bold text-gray-900 mb-2">
                    {statistics.complaint_statistics.total_complaints}
                  </p>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-amber-400 to-amber-600 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min((statistics.complaint_statistics.total_complaints / 100) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-amber-600 font-semibold">Tracking</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {isStaff && (
            <button
              onClick={() => setActiveTab('emergency')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'emergency'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🚨 Active Emergencies ({activeEmergencies.length})
            </button>
          )}
          
          {!isStaff && (
            <button
              onClick={() => setActiveTab('my-reports')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'my-reports'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📱 My Emergency Reports ({myEmergencyReports.length})
            </button>
          )}
          
          <button
            onClick={() => setActiveTab('complaints')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'complaints'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📝 Complaints & Suggestions ({complaints.length})
          </button>
          
          {isStaff && (
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Emergency History
            </button>
          )}
          
          {isStaff && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Activity Logs
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Active Emergencies (Staff Only) */}
        {isStaff && activeTab === 'emergency' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Active Emergencies</h3>
            </div>
            
            {activeEmergencies.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No active emergencies
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {activeEmergencies.map((emergency) => (
                  <div 
                    key={emergency.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-all duration-200 hover:shadow-md border-l-4 border-transparent hover:border-red-500"
                    onClick={() => handleEmergencyClick(emergency)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">
                          {getEmergencyIcon(emergency.emergency_type)}
                        </span>
                        <div>
                          <h4 className="font-semibold text-gray-900">{emergency.title}</h4>
                          <p className="text-gray-600 text-sm mt-1">{emergency.description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>📍 {emergency.address || `${emergency.latitude}, ${emergency.longitude}`}</span>
                            <span>⏰ {new Date(emergency.created_at).toLocaleString()}</span>
                            {getReporterContact(emergency) && (
                              <span>☎️ {getReporterContact(emergency)}</span>
                            )}
                            <span>🆔 #{emergency.emergency_number}</span>
                          </div>
                          {emergency.assigned_responder && (
                            <p className="text-sm text-blue-600 mt-1">
                              👨‍🚒 Assigned: {emergency.assigned_responder}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2">
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: getEmergencyColor(emergency.severity) }}
                        >
                          {emergency.severity.toUpperCase()}
                        </span>
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: getStatusColor(emergency.status) }}
                        >
                          {emergency.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {emergency.verification_status && (
                          <span 
                            className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getVerificationStatusColor(emergency.verification_status)}`}
                            title={`Verification: ${emergency.verification_status}`}
                          >
                            <span>{getVerificationIcon(emergency.verification_status)}</span>
                            <span>{emergency.verification_status.toUpperCase()}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Emergency Reports (Citizens Only) */}
        {!isStaff && activeTab === 'my-reports' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center space-x-2">
                <span>📱</span>
                <span>My Emergency Reports</span>
              </h3>
              <p className="text-sm text-gray-600 mt-1">Track the progress of your emergency reports</p>
            </div>
            
            {myEmergencyReports.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">No Emergency Reports</h4>
                <p className="text-gray-600 mb-4">You haven't submitted any emergency reports yet.</p>
                <button
                  onClick={() => setShowEmergencyButton(true)}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Report Emergency
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {myEmergencyReports.map((emergency) => (
                  <div key={emergency.id} className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-gradient-to-br from-red-100 to-orange-100 rounded-2xl">
                          <span className="text-2xl">
                            {getEmergencyIcon(emergency.emergency_type)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-xl font-bold text-gray-900">{emergency.title}</h4>
                            <span 
                              className="px-3 py-1 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: getEmergencyColor(emergency.severity) }}
                            >
                              {emergency.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-2">{emergency.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center space-x-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              <span>#{emergency.emergency_number}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{new Date(emergency.created_at).toLocaleString()}</span>
                            </span>
                            {emergency.address && (
                              <span className="flex items-center space-x-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{emergency.address}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span 
                          className="px-4 py-2 rounded-full text-sm font-bold text-white inline-block"
                          style={{ backgroundColor: getStatusColor(emergency.status) }}
                        >
                          {emergency.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {emergency.verification_status && (
                          <span 
                            className={`px-3 py-2 rounded-full text-sm font-bold flex items-center space-x-1 ${getVerificationStatusColor(emergency.verification_status)}`}
                            title={`Verification: ${emergency.verification_status}`}
                          >
                            <span>{getVerificationIcon(emergency.verification_status)}</span>
                            <span>{emergency.verification_status.toUpperCase()}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Tracker */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                      <h5 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Response Progress</span>
                      </h5>
                      <EmergencyProgressTracker emergency={emergency} />
                    </div>

                    {/* Additional Info */}
                    {(emergency.resolution_notes || emergency.resolved_at) && (
                      <div className="mt-4 bg-green-50 rounded-xl p-4 border border-green-200">
                        <h6 className="font-semibold text-green-800 mb-2">Resolution Details</h6>
                        {emergency.resolution_notes && (
                          <p className="text-green-700 mb-2">{emergency.resolution_notes}</p>
                        )}
                        {emergency.resolved_at && (
                          <p className="text-sm text-green-600">
                            Resolved at: {new Date(emergency.resolved_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="mt-4 flex items-center space-x-3">
                      {emergency.address && (
                        <button
                          onClick={() => window.open(`https://maps.google.com/?q=${emergency.latitude},${emergency.longitude}`, '_blank')}
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span>View Location</span>
                        </button>
                      )}
                      
                      {emergency.status?.toUpperCase() !== 'RESOLVED' && emergency.status?.toUpperCase() !== 'CANCELLED' && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>Live tracking active</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Complaints & Suggestions */}
        {activeTab === 'complaints' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Complaints & Suggestions</h3>
            </div>
            
            {complaints.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No complaints or suggestions
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {complaints.map((complaint) => (
                  <div key={complaint.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">
                            {complaint.type === 'complaint' ? '⚠️' : '💡'}
                          </span>
                          <h4 className="font-semibold text-gray-900">{complaint.title}</h4>
                        </div>
                        <p className="text-gray-600 text-sm mt-1">{complaint.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>📂 {complaint.category.replace('_', ' ')}</span>
                          <span>⏰ {new Date(complaint.created_at).toLocaleString()}</span>
                          {complaint.location_description && (
                            <span>📍 {complaint.location_description}</span>
                          )}
                        </div>
                        {complaint.response_message && (
                          <div className="mt-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                            <p className="text-sm text-blue-800">
                              <strong>Response:</strong> {complaint.response_message}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              {new Date(complaint.response_date).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2">
                        <span 
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            complaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                            complaint.status === 'reviewing' ? 'bg-yellow-100 text-yellow-800' :
                            complaint.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {complaint.status.toUpperCase()}
                        </span>
                        <span 
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            complaint.priority === 'high' ? 'bg-red-100 text-red-800' :
                            complaint.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}
                        >
                          {complaint.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Emergency History (Staff Only) */}
        {isStaff && activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Emergency History</h3>
            </div>
            
            <div className="divide-y divide-gray-200">
              {allEmergencies.slice(0, 20).map((emergency) => (
                <div key={emergency.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <span className="text-xl">
                        {getEmergencyIcon(emergency.emergency_type)}
                      </span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{emergency.title}</h4>
                        <p className="text-gray-600 text-sm mt-1">{emergency.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>🆔 #{emergency.emergency_number}</span>
                          <span>⏰ {new Date(emergency.created_at).toLocaleString()}</span>
                          {getReporterContact(emergency) && (
                            <span>☎️ {getReporterContact(emergency)}</span>
                          )}
                          {emergency.resolved_at && (
                            <span>✅ Resolved: {new Date(emergency.resolved_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: getStatusColor(emergency.status) }}
                    >
                      {emergency.status.replace('_', ' ').toUpperCase()}
                    </span>
                    {emergency.verification_status && (
                      <span 
                        className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getVerificationStatusColor(emergency.verification_status)}`}
                        title={`Verification: ${emergency.verification_status}`}
                      >
                        <span>{getVerificationIcon(emergency.verification_status)}</span>
                        <span>{emergency.verification_status.toUpperCase()}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Logs (Staff Only) */}
        {isStaff && activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Activity Logs</h3>
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedLogTab('activity')}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${
                        selectedLogTab === 'activity'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      User Activity
                    </button>
                    <button
                      onClick={() => setSelectedLogTab('system')}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${
                        selectedLogTab === 'system'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      System Logs
                    </button>
                    <button
                      onClick={() => setSelectedLogTab('audit')}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${
                        selectedLogTab === 'audit'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Audit Trail
                    </button>
                    <button
                      onClick={() => setSelectedLogTab('statistics')}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${
                        selectedLogTab === 'statistics'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Statistics
                    </button>
                  </div>
                  <button
                    onClick={fetchLogsData}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                    disabled={logsLoading}
                  >
                    {logsLoading ? '🔄' : '🔄'} Refresh
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="date"
                  placeholder="Start Date"
                  value={logsFilters.startDate}
                  onChange={(e) => setLogsFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="date"
                  placeholder="End Date"
                  value={logsFilters.endDate}
                  onChange={(e) => setLogsFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <select
                  value={logsFilters.activityType}
                  onChange={(e) => setLogsFilters(prev => ({ ...prev, activityType: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">All Activities</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="emergency_created">Emergency Created</option>
                  <option value="emergency_updated">Emergency Updated</option>
                  <option value="complaint_created">Complaint Created</option>
                  <option value="report_created">Report Created</option>
                  <option value="violation_reported">Violation Reported</option>
                </select>
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={logsFilters.searchQuery}
                  onChange={(e) => setLogsFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            {logsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading logs...</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {/* Activity Logs */}
                {selectedLogTab === 'activity' && (
                  <div className="divide-y divide-gray-200">
                    {activityLogs.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        No activity logs found
                      </div>
                    ) : (
                      activityLogs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start space-x-3">
                            <span className="text-lg">
                              {logsService.getActivityIcon(log.activity_type)}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className={`font-medium ${logsService.getActivityColor(log.activity_type)}`}>
                                  {logsService.formatActivityType(log.activity_type)}
                                </h4>
                                <span className="text-sm text-gray-500">
                                  {logsService.formatDateTime(log.created_at)}
                                </span>
                              </div>
                              <p className="text-gray-600 text-sm mt-1">{log.activity_description}</p>
                              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                {log.user_name && <span>👤 {log.user_name}</span>}
                                {log.user_role && <span>🏷️ {log.user_role}</span>}
                                {log.ip_address && <span>🌐 {log.ip_address}</span>}
                                {log.resource_type && <span>📄 {log.resource_type}</span>}
                                {!log.is_successful && <span className="text-red-500">❌ Failed</span>}
                              </div>
                              {log.error_message && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                  {log.error_message}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* System Logs */}
                {selectedLogTab === 'system' && (
                  <div className="divide-y divide-gray-200">
                    {systemLogs.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        No system logs found
                      </div>
                    ) : (
                      systemLogs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start space-x-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              log.log_level === 'ERROR' ? 'bg-red-100 text-red-800' :
                              log.log_level === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                              log.log_level === 'INFO' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {log.log_level}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-900">{log.service_name}</h4>
                                <span className="text-sm text-gray-500">
                                  {logsService.formatDateTime(log.created_at)}
                                </span>
                              </div>
                              <p className="text-gray-600 text-sm mt-1">{log.message}</p>
                              {log.error_code && (
                                <div className="mt-2 text-xs text-gray-500">
                                  Error Code: {log.error_code}
                                </div>
                              )}
                              {log.stack_trace && (
                                <details className="mt-2">
                                  <summary className="text-xs text-gray-500 cursor-pointer">Stack Trace</summary>
                                  <pre className="mt-1 p-2 bg-gray-50 border rounded text-xs text-gray-700 overflow-x-auto">
                                    {log.stack_trace}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Audit Logs */}
                {selectedLogTab === 'audit' && (
                  <div className="divide-y divide-gray-200">
                    {auditLogs.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        No audit logs found
                      </div>
                    ) : (
                      auditLogs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start space-x-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                              log.action === 'UPDATE' ? 'bg-yellow-100 text-yellow-800' :
                              log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {log.action}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-900">
                                  {log.table_name} {log.record_id && `#${log.record_id}`}
                                </h4>
                                <span className="text-sm text-gray-500">
                                  {logsService.formatDateTime(log.created_at)}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-gray-500">
                                {log.user_name && <span>👤 {log.user_name}</span>}
                                {log.user_role && <span className="ml-2">🏷️ {log.user_role}</span>}
                                {log.ip_address && <span className="ml-2">🌐 {log.ip_address}</span>}
                              </div>
                              {(log.old_values || log.new_values) && (
                                <details className="mt-2">
                                  <summary className="text-xs text-gray-500 cursor-pointer">View Changes</summary>
                                  <div className="mt-1 p-2 bg-gray-50 border rounded text-xs">
                                    {log.old_values && (
                                      <div className="mb-2">
                                        <span className="font-medium text-red-700">Before:</span>
                                        <pre className="text-gray-700 whitespace-pre-wrap">
                                          {JSON.stringify(log.old_values, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    {log.new_values && (
                                      <div>
                                        <span className="font-medium text-green-700">After:</span>
                                        <pre className="text-gray-700 whitespace-pre-wrap">
                                          {JSON.stringify(log.new_values, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Statistics */}
                {selectedLogTab === 'statistics' && logsStatistics && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900">Total Activities</h4>
                        <p className="text-2xl font-bold text-blue-700">{logsStatistics.total_activities}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-900">Successful</h4>
                        <p className="text-2xl font-bold text-green-700">{logsStatistics.successful_activities}</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-red-900">Failed</h4>
                        <p className="text-2xl font-bold text-red-700">{logsStatistics.failed_activities}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-purple-900">Unique Users</h4>
                        <p className="text-2xl font-bold text-purple-700">{logsStatistics.unique_users}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Most Active Users */}
                      <div>
                        <h4 className="font-semibold mb-3">Most Active Users</h4>
                        <div className="space-y-2">
                          {logsStatistics.most_active_users.slice(0, 5).map((user, index) => (
                            <div key={user.user_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <span className="font-medium">{user.username}</span>
                                <span className="text-sm text-gray-500 ml-2">({user.role})</span>
                              </div>
                              <span className="font-bold text-indigo-600">{user.activity_count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Activity Breakdown */}
                      <div>
                        <h4 className="font-semibold mb-3">Activity Breakdown</h4>
                        <div className="space-y-2">
                          {Object.entries(logsStatistics.activity_breakdown)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 5)
                            .map(([activity, count]) => (
                              <div key={activity} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="flex items-center">
                                  <span className="mr-2">{logsService.getActivityIcon(activity)}</span>
                                  {logsService.formatActivityType(activity)}
                                </span>
                                <span className="font-bold text-indigo-600">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

        {/* Enhanced Emergency Wizard Modal */}
        {/* Prevent emergency form from showing for admin users */}
        {showEmergencyButton && !isAdmin && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
              {/* Modal Header with Progress */}
              <div className="px-8 py-6 bg-gradient-to-r from-red-500 to-orange-600 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-white/20 rounded-2xl">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Emergency Report</h2>
                      <p className="text-red-100">Step {emergencyStep} of 5 - Help is on the way</p>
                    </div>
                  </div>
                  <button
                    onClick={resetEmergencyForm}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-white h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(emergencyStep / 5) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8">
                <form onSubmit={handleEmergencyReport}>
                  {/* Step 1: Emergency Type */}
                  {emergencyStep === 1 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">What type of emergency?</h3>
                        <p className="text-gray-600">Select the category that best describes your emergency</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { value: 'medical', icon: '🚑', label: 'Medical Emergency', color: 'from-red-500 to-pink-500', desc: 'Health-related emergency' },
                          { value: 'accident', icon: '🚗', label: 'Vehicle Accident', color: 'from-orange-500 to-red-500', desc: 'Traffic collision or crash' },
                          { value: 'fire', icon: '🔥', label: 'Fire Emergency', color: 'from-red-500 to-orange-500', desc: 'Fire or smoke detected' },
                          { value: 'crime', icon: '🚔', label: 'Crime in Progress', color: 'from-blue-500 to-indigo-500', desc: 'Criminal activity happening' },
                          { value: 'road_hazard', icon: '⚠️', label: 'Road Hazard', color: 'from-yellow-500 to-orange-500', desc: 'Dangerous road conditions' },
                          { value: 'other', icon: '📞', label: 'Other Emergency', color: 'from-gray-500 to-gray-600', desc: 'Other urgent situation' }
                        ].map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => {
                              setEmergencyType(type.value);

                            }}
                            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left group hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-500/20 ${
                              emergencyType === type.value
                                ? `border-transparent bg-gradient-to-br ${type.color} text-white shadow-2xl transform scale-105`
                                : 'border-gray-300 hover:border-gray-400 bg-white hover:shadow-lg hover:border-red-300'
                            }`}
                          >
                            {emergencyType === type.value && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                            <div className="text-center">
                              <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">{type.icon}</div>
                              <h4 className={`font-bold text-lg mb-2 ${emergencyType === type.value ? 'text-white' : 'text-gray-900'}`}>
                                {type.label}
                              </h4>
                              <p className={`text-sm ${emergencyType === type.value ? 'text-white/90' : 'text-gray-500'}`}>
                                {type.desc}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Emergency Details */}
                  {emergencyStep === 2 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Tell us what happened</h3>
                        <p className="text-gray-600">Provide details to help responders understand the situation</p>
                      </div>
                      
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-3">Brief Title *</label>
                          <input
                            type="text"
                            value={emergencyDetails.title}
                            onChange={(e) => setEmergencyDetails({...emergencyDetails, title: e.target.value})}
                            className="w-full px-4 py-4 border-2 border-gray-300 rounded-2xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all duration-200 text-lg"
                            placeholder="Quick description of the emergency..."
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-3">Detailed Description</label>
                          <textarea
                            value={emergencyDetails.description}
                            onChange={(e) => setEmergencyDetails({...emergencyDetails, description: e.target.value})}
                            className="w-full px-4 py-4 border-2 border-gray-300 rounded-2xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all duration-200 resize-none"
                            rows="4"
                            placeholder="Provide more details about what happened, how many people involved, current conditions..."
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Severity & Location */}
                  {emergencyStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Severity & Location</h3>
                        <p className="text-gray-600">Help us prioritize and locate the emergency</p>
                      </div>
                      
                      <div className="space-y-6">
                        {/* Severity Selection */}
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-4">Emergency Severity *</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                              { value: 'low', label: 'Low Priority', icon: '🟢', color: 'from-green-400 to-green-600', desc: 'Minor issue, no immediate danger' },
                              { value: 'medium', label: 'Medium Priority', icon: '🟡', color: 'from-yellow-400 to-orange-500', desc: 'Moderate concern, attention needed' },
                              { value: 'high', label: 'High Priority', icon: '🟠', color: 'from-orange-500 to-red-500', desc: 'Urgent situation, quick response needed' },
                              { value: 'critical', label: 'CRITICAL', icon: '🔴', color: 'from-red-500 to-red-700', desc: 'Life-threatening, immediate response required' }
                            ].map((severity) => (
                              <button
                                key={severity.value}
                                type="button"
                                onClick={() => setEmergencyDetails({...emergencyDetails, severity: severity.value})}
                                className={`p-4 rounded-2xl border-2 transition-all duration-300 text-left hover:scale-105 ${
                                  emergencyDetails.severity === severity.value
                                    ? `border-transparent bg-gradient-to-br ${severity.color} text-white shadow-2xl`
                                    : 'border-gray-300 hover:border-gray-400 bg-white hover:shadow-lg'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="text-2xl">{severity.icon}</span>
                                  <div>
                                    <h4 className={`font-bold ${emergencyDetails.severity === severity.value ? 'text-white' : 'text-gray-900'}`}>
                                      {severity.label}
                                    </h4>
                                    <p className={`text-sm ${emergencyDetails.severity === severity.value ? 'text-white/80' : 'text-gray-500'}`}>
                                      {severity.desc}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Location */}
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-3">Location Information</label>
                          <div className="space-y-4">
                            <div className="flex space-x-3">
                              <input
                                type="text"
                                value={emergencyDetails.address}
                                onChange={(e) => setEmergencyDetails({...emergencyDetails, address: e.target.value})}
                                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all duration-200"
                                placeholder="Street address, landmark, or description..."
                              />
                              <button
                                type="button"
                                onClick={getCurrentLocation}
                                disabled={isGettingLocation}
                                className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
                              >
                                {isGettingLocation ? (
                                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                )}
                                <span>{isGettingLocation ? 'Getting...' : 'Get Location'}</span>
                              </button>
                            </div>
                            <p className="text-sm text-gray-500">
                              📍 Current coordinates: {emergencyDetails.latitude.toFixed(4)}, {emergencyDetails.longitude.toFixed(4)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Photo Upload */}
                  {emergencyStep === 4 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Add Photos (Optional)</h3>
                        <p className="text-gray-600">Photos help responders understand the situation better</p>
                      </div>
                      
                      <div className="space-y-6">
                        {/* Photo Upload Area */}
                        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-red-400 transition-colors duration-200">
                          <input
                            type="file"
                            id="photo-upload"
                            multiple
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            disabled={uploadedPhotos.length >= 3}
                          />
                          <label 
                            htmlFor="photo-upload" 
                            className={`cursor-pointer block ${uploadedPhotos.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="text-6xl mb-4">📸</div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">
                              {uploadedPhotos.length >= 3 ? 'Maximum 3 photos reached' : 'Upload Photos'}
                            </h4>
                            <p className="text-gray-600 text-sm">
                              Click to select photos or drag and drop<br/>
                              Maximum 3 photos, 5MB each
                            </p>
                          </label>
                        </div>

                        {/* Uploaded Photos Preview */}
                        {uploadedPhotos.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="font-semibold text-gray-900">Uploaded Photos ({uploadedPhotos.length}/3)</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {uploadedPhotos.map((photo) => (
                                <div key={photo.id} className="relative group">
                                  <div className="relative bg-gray-100 rounded-xl overflow-hidden aspect-video">
                                    <img 
                                      src={photo.preview} 
                                      alt={photo.name}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                                      <button
                                        type="button"
                                        onClick={() => removePhoto(photo.id)}
                                        className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-all duration-200 transform scale-90 group-hover:scale-100"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    <p className="text-sm font-medium text-gray-900 truncate">{photo.name}</p>
                                    <p className="text-xs text-gray-500">{(photo.size / 1024 / 1024).toFixed(1)} MB</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Photo Guidelines */}
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                          <div className="flex items-start space-x-3">
                            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <h5 className="font-semibold text-blue-900 mb-1">Photo Guidelines</h5>
                              <ul className="text-sm text-blue-800 space-y-1">
                                <li>• Take clear photos showing the emergency situation</li>
                                <li>• Avoid including personal information of individuals</li>
                                <li>• Photos help responders prepare appropriate resources</li>
                                <li>• Only upload relevant photos to the emergency</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Confirmation */}
                  {emergencyStep === 5 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Emergency Report</h3>
                        <p className="text-gray-600">Review your information before sending the alert</p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 border border-red-200">
                        <div className="space-y-4">
                          <div className="flex items-center space-x-3">
                            <span className="text-3xl">
                              {emergencyType === 'medical' && '🚑'}
                              {emergencyType === 'accident' && '🚗'}
                              {emergencyType === 'fire' && '🔥'}
                              {emergencyType === 'crime' && '🚔'}
                              {emergencyType === 'road_hazard' && '⚠️'}
                              {emergencyType === 'other' && '📞'}
                            </span>
                            <div>
                              <h4 className="text-xl font-bold text-gray-900">{emergencyDetails.title}</h4>
                              <p className="text-gray-600 capitalize">{emergencyType.replace('_', ' ')} Emergency</p>
                            </div>
                          </div>
                          
                          {emergencyDetails.description && (
                            <div className="bg-white/50 rounded-xl p-4">
                              <p className="text-gray-700">{emergencyDetails.description}</p>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/50 rounded-xl p-4">
                              <h5 className="font-semibold text-gray-900 mb-1">Severity</h5>
                              <p className="text-gray-700 capitalize flex items-center space-x-2">
                                <span>
                                  {emergencyDetails.severity === 'low' && '🟢'}
                                  {emergencyDetails.severity === 'medium' && '🟡'}
                                  {emergencyDetails.severity === 'high' && '🟠'}
                                  {emergencyDetails.severity === 'critical' && '🔴'}
                                </span>
                                <span>{emergencyDetails.severity}</span>
                              </p>
                            </div>
                            
                            <div className="bg-white/50 rounded-xl p-4">
                              <h5 className="font-semibold text-gray-900 mb-1">Location</h5>
                              <p className="text-gray-700 text-sm">
                                {emergencyDetails.address || `${emergencyDetails.latitude.toFixed(4)}, ${emergencyDetails.longitude.toFixed(4)}`}
                              </p>
                            </div>
                          </div>

                          {/* Photos Section */}
                          {uploadedPhotos.length > 0 && (
                            <div className="bg-white/50 rounded-xl p-4">
                              <h5 className="font-semibold text-gray-900 mb-3">Attached Photos ({uploadedPhotos.length})</h5>
                              <div className="grid grid-cols-3 gap-2">
                                {uploadedPhotos.map((photo) => (
                                  <div key={photo.id} className="relative">
                                    <img 
                                      src={photo.preview} 
                                      alt={photo.name}
                                      className="w-full h-16 object-cover rounded-lg"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                        <div className="flex items-start space-x-3">
                          <svg className="w-6 h-6 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <h5 className="font-semibold text-yellow-800">Important Notice</h5>
                            <p className="text-yellow-700 text-sm">
                              By submitting this report, you confirm that this is a genuine emergency. 
                              False reports may result in penalties and delay response to real emergencies.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={prevStep}
                      disabled={emergencyStep === 1}
                      className="px-6 py-3 text-gray-600 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Previous</span>
                    </button>

                    {emergencyStep < 5 ? (
                      <button
                        type="button"
                        onClick={nextStep}
                        disabled={
                          (emergencyStep === 1 && !emergencyType) ||
                          (emergencyStep === 2 && !emergencyDetails.title.trim())
                        }
                        className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 font-bold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        <span>
                          {emergencyStep === 4 
                            ? (uploadedPhotos.length > 0 ? 'Continue' : 'Skip Photos')
                            : 'Continue'
                          }
                        </span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 font-bold text-lg shadow-2xl hover:shadow-red-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transform hover:scale-105"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Sending Alert...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>SEND EMERGENCY ALERT</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Emergency Success Modal */}
        {showSuccessModal && submittedEmergency && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl transform transition-all duration-500 scale-100 max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in duration-300 mx-auto">
              {/* Success Animation Header */}
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500"></div>
                <div className="absolute inset-0 opacity-30">
                  <div className="w-full h-full bg-white/5 bg-opacity-10" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat'
                  }}></div>
                </div>
                
                <div className="relative px-4 sm:px-8 py-6 sm:py-8 text-white text-center">
                  {/* Animated Success Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                        <svg className="w-14 h-14 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {/* Ripple effect */}
                      <div className="absolute inset-0 rounded-full bg-white/10 animate-ping"></div>
                    </div>
                  </div>
                  
                  <h2 className="text-4xl font-bold mb-3 tracking-tight">Emergency Reported!</h2>
                  <p className="text-emerald-100 text-xl font-medium">🚨 Help is on the way - Your report has been received and is being processed</p>
                  
                  {/* Status Indicator */}
                  <div className="mt-6 inline-flex items-center bg-white/20 rounded-full px-6 py-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mr-3"></div>
                    <span className="text-sm font-semibold">ACTIVE • DISPATCHING</span>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 lg:p-8 bg-gray-50">
                {/* Emergency Summary Card */}
                <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center text-2xl">
                        {getEmergencyIcon(submittedEmergency.emergency_type)}
                      </div>
                      <span>Your Emergency Report</span>
                    </h3>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 font-medium">Emergency ID</p>
                      <p className="text-3xl font-bold text-emerald-600 font-mono tracking-wider">
                        #{submittedEmergency.emergency_number}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <label className="text-sm font-bold text-blue-700 uppercase tracking-wide">Type</label>
                      </div>
                      <p className="text-xl font-bold text-gray-900 capitalize">
                        {submittedEmergency.emergency_type.replace('_', ' ')}
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <label className="text-sm font-bold text-purple-700 uppercase tracking-wide">Severity</label>
                      </div>
                      <span 
                        className="inline-block px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg"
                        style={{ backgroundColor: getEmergencyColor(submittedEmergency.severity) }}
                      >
                        {submittedEmergency.severity.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <label className="text-sm font-bold text-green-700 uppercase tracking-wide">Reported At</label>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {new Date(submittedEmergency.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  {submittedEmergency.title && (
                    <div className="mt-6 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-100">
                      <label className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 block">Description</label>
                      <p className="text-gray-900 text-lg leading-relaxed">{submittedEmergency.title}</p>
                      {submittedEmergency.description && (
                        <p className="text-gray-600 mt-3 text-base leading-relaxed">{submittedEmergency.description}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* What Happens Next - Enhanced Timeline */}
                <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span>What Happens Next?</span>
                  </h3>
                  
                  <div className="space-y-8">
                    <div className="flex items-start space-x-6">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg">1</div>
                        <div className="w-1 h-16 bg-gradient-to-b from-blue-500 to-blue-300 rounded-full mt-2"></div>
                      </div>
                      <div className="flex-1 pt-2">
                        <p className="font-bold text-gray-900 text-xl mb-2 flex items-center space-x-2">
                          <span>Emergency Dispatch</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">IN PROGRESS</span>
                        </p>
                        <p className="text-gray-600 text-base leading-relaxed">Our emergency response team will review and dispatch appropriate responders within minutes</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-6">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg">2</div>
                        <div className="w-1 h-16 bg-gradient-to-b from-orange-500 to-orange-300 rounded-full mt-2"></div>
                      </div>
                      <div className="flex-1 pt-2">
                        <p className="font-bold text-gray-900 text-xl mb-2 flex items-center space-x-2">
                          <span>Responder Assignment</span>
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">PENDING</span>
                        </p>
                        <p className="text-gray-600 text-base leading-relaxed">A qualified responder will be assigned based on your emergency type and location</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-6">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg">3</div>
                      </div>
                      <div className="flex-1 pt-2">
                        <p className="font-bold text-gray-900 text-xl mb-2 flex items-center space-x-2">
                          <span>Help Arrives</span>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-semibold">SCHEDULED</span>
                        </p>
                        <p className="text-gray-600 text-base leading-relaxed">Emergency responders will arrive at your location to provide immediate assistance</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Important Information - Enhanced */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-3xl p-8 border-2 border-amber-200 mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <span>Important Information</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start space-x-3 bg-white/70 rounded-2xl p-4">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <span className="text-gray-700 font-medium">Keep your phone accessible - responders may need to contact you</span>
                    </div>
                    
                    <div className="flex items-start space-x-3 bg-white/70 rounded-2xl p-4">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className="text-gray-700 font-medium">Stay at the reported location if safe to do so</span>
                    </div>
                    
                    <div className="flex items-start space-x-3 bg-white/70 rounded-2xl p-4">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <span className="text-gray-700 font-medium">Track progress in "My Emergency Reports" section</span>
                    </div>
                    
                    <div className="flex items-start space-x-3 bg-white/70 rounded-2xl p-4">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <span className="text-gray-700 font-medium">Reference ID: <strong className="font-bold text-emerald-600">#{submittedEmergency.emergency_number}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Enhanced */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      setSubmittedEmergency(null);
                      setActiveTab('my-reports');
                    }}
                    className="flex-1 px-8 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-3"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Track Progress</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      setSubmittedEmergency(null);
                    }}
                    className="flex-1 px-8 py-5 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-2xl hover:from-gray-700 hover:to-gray-800 font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-3"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Emergency Detail Modal */}
        {showEmergencyDetail && selectedEmergency && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="px-8 py-6 bg-gradient-to-r from-red-500 to-orange-600 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-white/20 rounded-2xl">
                      <span className="text-3xl">
                        {getEmergencyIcon(selectedEmergency.emergency_type)}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedEmergency.title}</h2>
                      <p className="text-red-100">Emergency #{selectedEmergency.emergency_number}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowEmergencyDetail(false);
                      setSelectedEmergency(null);
                    }}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Emergency Details */}
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 border border-red-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Emergency Information</span>
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-semibold text-gray-600">Type</label>
                          <p className="text-gray-900 capitalize flex items-center space-x-2">
                            <span>{getEmergencyIcon(selectedEmergency.emergency_type)}</span>
                            <span>{selectedEmergency.emergency_type.replace('_', ' ')}</span>
                          </p>
                        </div>
                        
                        <div>
                          <label className="text-sm font-semibold text-gray-600">Severity</label>
                          <div className="flex items-center space-x-2 mt-1">
                            <span 
                              className="px-3 py-1 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: getEmergencyColor(selectedEmergency.severity) }}
                            >
                              {selectedEmergency.severity.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-semibold text-gray-600">Status</label>
                          <div className="flex items-center space-x-2 mt-1">
                            <span 
                              className="px-3 py-1 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: getStatusColor(selectedEmergency.status) }}
                            >
                              {selectedEmergency.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {selectedEmergency.verification_status && (
                              <span 
                                className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getVerificationStatusColor(selectedEmergency.verification_status)}`}
                                title={`Verification Status: ${selectedEmergency.verification_status}`}
                              >
                                <span>{getVerificationIcon(selectedEmergency.verification_status)}</span>
                                <span>{selectedEmergency.verification_status.toUpperCase()}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {selectedEmergency.description && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Description</label>
                            <p className="text-gray-900 mt-1 bg-white/50 rounded-xl p-3">
                              {selectedEmergency.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reporter Information */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Reporter Information</span>
                      </h3>
                      
                      <div className="space-y-3">
                        {selectedEmergency.reporter_name && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Name</label>
                            <p className="text-gray-900">{selectedEmergency.reporter_name}</p>
                          </div>
                        )}
                        
                        {getReporterContact(selectedEmergency) && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Phone</label>
                            <p className="text-gray-900 flex items-center space-x-2">
                              <span>{getReporterContact(selectedEmergency)}</span>
                              <a 
                                href={`tel:${getReporterContact(selectedEmergency)}`}
                                className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </a>
                            </p>
                          </div>
                        )}
                        
                        <div>
                          <label className="text-sm font-semibold text-gray-600">Reported At</label>
                          <p className="text-gray-900">{new Date(selectedEmergency.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Location & Response */}
                  <div className="space-y-6">
                    {/* Location Information */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Location</span>
                      </h3>
                      
                      <div className="space-y-3">
                        {selectedEmergency.address && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Address</label>
                            <p className="text-gray-900">{selectedEmergency.address}</p>
                          </div>
                        )}
                        
                        <div>
                          <label className="text-sm font-semibold text-gray-600">Coordinates</label>
                          <p className="text-gray-900 font-mono text-sm">
                            {selectedEmergency.latitude.toFixed(6)}, {selectedEmergency.longitude.toFixed(6)}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => window.open(`https://maps.google.com/?q=${selectedEmergency.latitude},${selectedEmergency.longitude}`, '_blank')}
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span>View on Map</span>
                        </button>
                      </div>
                    </div>

                    {/* Response Management */}
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-6 border border-yellow-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Response Management</span>
                      </h3>
                      
                      <div className="space-y-4">
                        {/* Verification Status */}
                        {selectedEmergency.verification_status && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Verification Status</label>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${
                                selectedEmergency.verification_status === 'verified' ? 'bg-green-100 text-green-800' :
                                selectedEmergency.verification_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                selectedEmergency.verification_status === 'flagged' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {selectedEmergency.verification_status === 'verified' && '✓'}
                                {selectedEmergency.verification_status === 'rejected' && '✗'}
                                {selectedEmergency.verification_status === 'flagged' && '⚠'}
                                {selectedEmergency.verification_status === 'pending' && '⏳'}
                                <span className="ml-1">{selectedEmergency.verification_status.toUpperCase()}</span>
                              </span>
                            </div>
                            {selectedEmergency.verification_notes && (
                              <p className="text-sm text-gray-600 mt-2 italic">"{selectedEmergency.verification_notes}"</p>
                            )}
                            {selectedEmergency.verified_at && (
                              <p className="text-xs text-gray-500 mt-1">
                                Verified on: {new Date(selectedEmergency.verified_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Assigned Responder */}
                        {selectedEmergency.assigned_responder && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Assigned Responder</label>
                            <p className="text-gray-900">{selectedEmergency.assigned_responder}</p>
                          </div>
                        )}
                        
                        {/* Response Times */}
                        {selectedEmergency.estimated_response_time && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Estimated Response Time</label>
                            <p className="text-gray-900">{selectedEmergency.estimated_response_time} minutes</p>
                          </div>
                        )}

                        {selectedEmergency.actual_response_time && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Actual Response Time</label>
                            <p className="text-gray-900">{selectedEmergency.actual_response_time} minutes</p>
                          </div>
                        )}

                        {/* Resolution Details */}
                        {selectedEmergency.resolution_notes && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Resolution Notes</label>
                            <p className="text-gray-900">{selectedEmergency.resolution_notes}</p>
                          </div>
                        )}

                        {selectedEmergency.resolved_at && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Resolved At</label>
                            <p className="text-gray-900">{new Date(selectedEmergency.resolved_at).toLocaleString()}</p>
                          </div>
                        )}
                        
                        {/* Traffic Control Requirement */}
                        {selectedEmergency.requires_traffic_control && (
                          <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <span className="text-red-600 font-semibold">Requires Traffic Control</span>
                          </div>
                        )}

                        {/* Moderation Priority */}
                        {selectedEmergency.moderation_priority && selectedEmergency.moderation_priority !== 'normal' && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600">Priority Level</label>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                              selectedEmergency.moderation_priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              selectedEmergency.moderation_priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              selectedEmergency.moderation_priority === 'low' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedEmergency.moderation_priority.toUpperCase()} PRIORITY
                            </span>
                          </div>
                        )}

                        {/* Empty State */}
                        {!selectedEmergency.verification_status && 
                         !selectedEmergency.assigned_responder && 
                         !selectedEmergency.estimated_response_time && 
                         !selectedEmergency.actual_response_time &&
                         !selectedEmergency.resolution_notes &&
                         !selectedEmergency.resolved_at &&
                         !selectedEmergency.requires_traffic_control && (
                          <div className="text-center py-8">
                            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-500 text-sm">No response management information available yet.</p>
                            <p className="text-gray-400 text-xs mt-1">Response details will appear here once the emergency is processed.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Attached Photos */}
                    {selectedEmergency.photo_urls && selectedEmergency.photo_urls.length > 0 && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Attached Photos ({selectedEmergency.photo_urls.length})</span>
                        </h3>
                        
                        <div className="grid grid-cols-1 gap-4">
                          {selectedEmergency.photo_urls.map((url, index) => (
                            <div key={index} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
                              <img 
                                src={url} 
                                alt={`Evidence ${index + 1}`}
                                className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity duration-200"
                                onClick={() => {
                                  setSelectedPhoto(url);
                                  setShowPhotoModal(true);
                                }}
                                onError={(e) => {
                                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBDOTEuNzE1NyA3MCA4NS43IDE2IDE4NS43IDE4NEMxMDguMjg0IDg0IDExNS43MTYgODQgMTI0IDg0QzEzMi4yODQgODQgMTM5LjcxNiA4NEMxNDcuMyA4NEMxNTUuNzE2IDg0IDE2Mi4yODQgODQgMTcwIDg0VjE1NkMxNzAgMTY0LjI4NCAxNjMuNzE2IDE3MCA4NTUuMyAxNzBIMTQ0LjdDMTM2LjQxNiAxNzAgMTMwIDcxNi4yODQgMTMwIDcwOFY4NEMxMzAgNzUuNzE1NyAxMzYuMjg0IDcwIDE0NC43IDcwSDE1NS4zQzE2My43MTYgNzAgMTcwIDc1LjcxNTcgMTcwIDg0VjcwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                                }}
                              />
                              <div className="p-3">
                                <p className="text-xs text-gray-500">Photo {index + 1} - Click to view full size</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleUpdateEmergencyStatus(selectedEmergency.id, { status: 'DISPATCHED' })}
                          disabled={isUpdatingEmergency || selectedEmergency.status?.toUpperCase() !== 'REPORTED'}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                        >
                          Dispatch
                        </button>
                        
                        <button
                          onClick={() => handleUpdateEmergencyStatus(selectedEmergency.id, { status: 'IN_PROGRESS' })}
                          disabled={isUpdatingEmergency || !['REPORTED', 'DISPATCHED'].includes(selectedEmergency.status?.toUpperCase())}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                        >
                          In Progress
                        </button>
                        
                        <button
                          onClick={() => handleUpdateEmergencyStatus(selectedEmergency.id, { status: 'RESOLVED' })}
                          disabled={isUpdatingEmergency || selectedEmergency.status?.toUpperCase() === 'RESOLVED'}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                        >
                          Resolve
                        </button>
                        
                        <button
                          onClick={() => handleUpdateEmergencyStatus(selectedEmergency.id, { requires_traffic_control: !selectedEmergency.requires_traffic_control })}
                          disabled={isUpdatingEmergency}
                          className={`px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium ${
                            selectedEmergency.requires_traffic_control 
                              ? 'bg-red-600 text-white hover:bg-red-700' 
                              : 'bg-gray-600 text-white hover:bg-gray-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {selectedEmergency.requires_traffic_control ? 'Remove Traffic Control' : 'Add Traffic Control'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowEmergencyDetail(false);
                      setSelectedEmergency(null);
                    }}
                    className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 font-semibold transition-colors duration-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Enhanced Complaint/Report Form Modal */}
      {showComplaintForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100">
            {/* Modal Header with Progress */}
            <div className="px-8 py-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Report an Issue</h2>
                    <p className="text-blue-100">Step {complaintFormStep} of 3 - Help us improve our community</p>
                  </div>
                </div>
                <button
                  onClick={resetComplaintForm}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-white/20 rounded-full h-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(complaintFormStep / 3) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              <form onSubmit={handleComplaintSubmit}>
                {/* Step 1: Type and Category */}
                {complaintFormStep === 1 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">What would you like to report?</h3>
                      <p className="text-gray-600">Choose the type and category that best describes your concern</p>
                    </div>
                    
                    {/* Type Selection */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-4">Report Type *</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { value: 'complaint', icon: '⚠️', label: 'Complaint', color: 'from-red-500 to-orange-500', desc: 'Report a problem or violation' },
                          { value: 'suggestion', icon: '💡', label: 'Suggestion', color: 'from-green-500 to-emerald-500', desc: 'Suggest an improvement' }
                        ].map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setComplaintData({...complaintData, type: type.value})}
                            className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left hover:scale-105 ${
                              complaintData.type === type.value
                                ? `border-transparent bg-gradient-to-br ${type.color} text-white shadow-2xl transform scale-105`
                                : 'border-gray-300 hover:border-gray-400 bg-white hover:shadow-lg'
                            }`}
                          >
                            {complaintData.type === type.value && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                            <div className="text-center">
                              <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">{type.icon}</div>
                              <h4 className={`font-bold text-lg mb-2 ${complaintData.type === type.value ? 'text-white' : 'text-gray-900'}`}>
                                {type.label}
                              </h4>
                              <p className={`text-sm ${complaintData.type === type.value ? 'text-white/90' : 'text-gray-500'}`}>
                                {type.desc}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category Selection */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-4">Category *</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          { value: 'illegal_parking', icon: '🚗', label: 'Illegal Parking' },
                          { value: 'reckless_driving', icon: '🏃', label: 'Reckless Driving' },
                          { value: 'traffic_violation', icon: '🚦', label: 'Traffic Violation' },
                          { value: 'road_maintenance', icon: '🛠️', label: 'Road Maintenance' },
                          { value: 'traffic_light_issue', icon: '🚥', label: 'Traffic Light Issue' },
                          { value: 'road_signage', icon: '🛑', label: 'Road Signage' },
                          { value: 'pedestrian_safety', icon: '🚶', label: 'Pedestrian Safety' },
                          { value: 'noise_pollution', icon: '🔊', label: 'Noise Pollution' },
                          { value: 'public_transport', icon: '🚌', label: 'Public Transport' },
                          { value: 'infrastructure', icon: '🏗️', label: 'Infrastructure' },
                          { value: 'other', icon: '📋', label: 'Other' }
                        ].map((category) => (
                          <button
                            key={category.value}
                            type="button"
                            onClick={() => setComplaintData({...complaintData, category: category.value})}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 text-center hover:scale-105 ${
                              complaintData.category === category.value
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg'
                                : 'border-gray-300 hover:border-blue-300 bg-white hover:shadow-md'
                            }`}
                          >
                            <div className="text-2xl mb-2">{category.icon}</div>
                            <p className="text-sm font-semibold">{category.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Details */}
                {complaintFormStep === 2 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Tell us more details</h3>
                      <p className="text-gray-600">Provide a clear description to help us understand and address your concern</p>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Title *</label>
                        <input
                          type="text"
                          value={complaintData.title}
                          onChange={(e) => setComplaintData({...complaintData, title: e.target.value})}
                          className="w-full px-4 py-4 border-2 border-gray-300 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-lg"
                          placeholder="Brief summary of your report..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Detailed Description *</label>
                        <textarea
                          value={complaintData.description}
                          onChange={(e) => setComplaintData({...complaintData, description: e.target.value})}
                          className="w-full px-4 py-4 border-2 border-gray-300 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 resize-none"
                          rows="5"
                          placeholder="Please provide detailed information about what happened, when it occurred, and any other relevant details..."
                          required
                        />
                        <p className="text-sm text-gray-500 mt-2">
                          {complaintData.description.length}/500 characters
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Location */}
                {complaintFormStep === 3 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Where did this happen?</h3>
                      <p className="text-gray-600">Help us locate the issue by providing location details</p>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Location Description</label>
                        <input
                          type="text"
                          value={complaintData.location_description}
                          onChange={(e) => setComplaintData({...complaintData, location_description: e.target.value})}
                          className="w-full px-4 py-4 border-2 border-gray-300 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-lg"
                          placeholder="Street address, landmark, or area description..."
                        />
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>GPS Location</span>
                        </h4>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 mb-2">Current coordinates:</p>
                            <p className="font-mono text-sm text-gray-900">
                              {complaintData.latitude.toFixed(6)}, {complaintData.longitude.toFixed(6)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={getComplaintLocation}
                            disabled={isGettingComplaintLocation}
                            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
                          >
                            {isGettingComplaintLocation ? (
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            )}
                            <span>{isGettingComplaintLocation ? 'Getting...' : 'Get Current Location'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Report Summary */}
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                        <h4 className="font-bold text-gray-900 mb-4">Report Summary</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Type:</span>
                            <span className="font-semibold capitalize">{complaintData.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Category:</span>
                            <span className="font-semibold">{complaintData.category.replace('_', ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Title:</span>
                            <span className="font-semibold">{complaintData.title}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={prevComplaintStep}
                    disabled={complaintFormStep === 1}
                    className="px-6 py-3 text-gray-600 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Previous</span>
                  </button>

                  {complaintFormStep < 3 ? (
                    <button
                      type="button"
                      onClick={nextComplaintStep}
                      disabled={
                        (complaintFormStep === 1 && (!complaintData.type || !complaintData.category)) ||
                        (complaintFormStep === 2 && (!complaintData.title.trim() || !complaintData.description.trim()))
                      }
                      className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-bold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <span>Continue</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmittingComplaint}
                      className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 font-bold text-lg shadow-2xl hover:shadow-green-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transform hover:scale-105"
                    >
                      {isSubmittingComplaint ? (
                        <>
                          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          <span>SUBMIT REPORT</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Success Modal */}
      {showComplaintSuccess && submittedComplaint && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100 overflow-hidden">
            {/* Modal Header */}
            <div className="px-8 py-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <div className="flex items-center justify-center mb-4">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-2">Report Submitted Successfully!</h2>
                <p className="text-green-100 text-lg">Thank you for helping improve our community</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Your Report Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 font-semibold">Type:</span>
                    <p className="text-gray-900 capitalize">{submittedComplaint.type}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 font-semibold">Category:</span>
                    <p className="text-gray-900">{submittedComplaint.category?.replace('_', ' ')}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-600 font-semibold">Title:</span>
                    <p className="text-gray-900">{submittedComplaint.title}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">What happens next?</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Your report has been received and logged in our system</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Our team will review and investigate your report</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>You'll receive updates on the progress in your notifications</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>You can track your reports in the "Complaints & Suggestions" section</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    setShowComplaintSuccess(false);
                    setSubmittedComplaint(null);
                    setActiveTab('complaints');
                  }}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>View My Reports</span>
                </button>
                
                <button
                  onClick={() => {
                    setShowComplaintSuccess(false);
                    setSubmittedComplaint(null);
                  }}
                  className="flex-1 px-6 py-4 bg-gray-600 text-white rounded-xl hover:bg-gray-700 font-semibold text-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowPhotoModal(false);
                setSelectedPhoto(null);
              }}
              className="absolute top-4 right-4 z-10 p-3 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Photo */}
            <img 
              src={selectedPhoto} 
              alt="Full size evidence"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Click outside to close */}
            <div 
              className="absolute inset-0 -z-10"
              onClick={() => {
                setShowPhotoModal(false);
                setSelectedPhoto(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Update Success Modal */}
      {showUpdateSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[130] p-4 animate-fade-in">
          <div 
            className={`relative w-full max-w-md rounded-2xl shadow-2xl transform transition-all duration-300 animate-scale-in ${
              isDarkMode 
                ? 'bg-gray-900 border border-gray-700' 
                : 'bg-white border border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowUpdateSuccessModal(false)}
              className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                  : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="flex flex-col items-center justify-center py-8 sm:py-10 px-6 sm:px-8">
              {/* Animated Success Icon */}
              <div className="relative mb-6">
                {/* Pulsing background circle */}
                <div className={`absolute inset-0 rounded-full animate-ping ${
                  isDarkMode ? 'bg-green-500/20' : 'bg-green-500/30'
                }`} style={{ animationDuration: '2s' }}></div>
                
                {/* Main success circle */}
                <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center ${
                  isDarkMode 
                    ? 'bg-gradient-to-br from-green-600 to-green-700' 
                    : 'bg-gradient-to-br from-green-500 to-green-600'
                } shadow-2xl`}>
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-scale-in" />
                </div>
              </div>

              {/* Success Message */}
              <h3 className={`text-xl sm:text-2xl font-bold mb-2 text-center ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Success!
              </h3>
              
              <p className={`text-sm sm:text-base mb-6 text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {updateSuccessMessage}
              </p>

              {/* Action Button */}
              <button
                onClick={() => setShowUpdateSuccessModal(false)}
                className={`w-full sm:w-auto px-6 sm:px-8 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20'
                }`}
              >
                Got it
              </button>
            </div>
          </div>

          {/* Backdrop click to close */}
          <div 
            className="absolute inset-0 -z-10"
            onClick={() => setShowUpdateSuccessModal(false)}
          />
        </div>
      )}
      </div>
    </div>
  );
};

export default EmergencyCenter;
