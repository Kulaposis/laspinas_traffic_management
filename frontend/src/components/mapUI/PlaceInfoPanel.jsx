import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Star, Navigation, Play, Phone, Heart, Share2, 
  Clock, MapPin, Car, Info, ExternalLink, Globe
} from 'lucide-react';
import geoapifyService from '../../services/geoapifyService';

/**
 * Place Info Panel Component - Mobile & Desktop Optimized
 * Mobile: Bottom sheet design
 * Desktop: Centered modal design
 */
const PlaceInfoPanel = ({
  place,
  isOpen,
  isLoadingDirections = false,
  onClose,
  onDirections,
  onStart,
  onCall,
  onSave,
  onShare,
  currentLocation = null,
  estimatedTravelTime = null
}) => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [placeDetails, setPlaceDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch place details from Geoapify
  const placeDetailsFetchedRef = useRef(null);
  
  useEffect(() => {
    const placeKey = place ? `${place.lat || place.latitude}_${place.lng || place.longitude || place.lon}_${place.name || ''}` : null;
    
    if (isOpen && place && (place.lat || place.latitude) && (place.lng || place.longitude || place.lon) && placeDetailsFetchedRef.current !== placeKey) {
      placeDetailsFetchedRef.current = placeKey;
      setDetailsLoading(true);
      
      const lat = place.lat || place.latitude;
      const lng = place.lng || place.longitude || place.lon;
      
      geoapifyService.getPlaceDetails(lat, lng, { includePOI: true, radius: 100 })
        .then((geoapifyDetails) => {
          if (geoapifyDetails) {
            // Transform Geoapify response to our format
            const transformedDetails = {
              name: place.name || geoapifyDetails.poi?.name || 'Unknown Location',
              address: {
                full: geoapifyDetails.address?.address?.freeformAddress || 
                      `${geoapifyDetails.address?.address?.streetName || ''}, ${geoapifyDetails.address?.address?.municipality || ''}`.trim() ||
                      place.address?.full || place.name || 'Address not available',
                streetName: geoapifyDetails.address?.address?.streetName || '',
                municipality: geoapifyDetails.address?.address?.municipality || '',
                country: geoapifyDetails.address?.address?.country || 'Philippines',
                postalCode: geoapifyDetails.address?.address?.postalCode || ''
              },
              category: (Array.isArray(geoapifyDetails.poi?.categorySet) && geoapifyDetails.poi.categorySet.length > 0) 
                ? geoapifyDetails.poi.categorySet[0].id 
                : (place.category || place.type || 'Location'),
              phone: place.phone || null,
              rating: place.rating || null,
              reviewCount: place.reviewCount || null,
              description: place.description || null,
              website: place.website || null,
              isOpen: place.isOpen,
              opensAt: place.opensAt || null,
              closesAt: place.closesAt || null,
              lat: lat,
              lng: lng,
              provider: 'Geoapify'
            };
            setPlaceDetails(transformedDetails);
          } else {
            // Fallback to basic place info
            setPlaceDetails({
              name: place.name || 'Unknown Location',
              address: {
                full: place.address?.full || place.address?.freeformAddress || place.name || 'Address not available',
                streetName: place.address?.streetName || '',
                municipality: place.address?.municipality || place.address?.city || '',
                country: place.address?.country || 'Philippines',
                postalCode: place.address?.postalCode || ''
              },
              category: place.category || place.type || 'Location',
              phone: place.phone || null,
              rating: place.rating || null,
              reviewCount: place.reviewCount || null,
              description: place.description || null,
              website: place.website || null,
              isOpen: place.isOpen,
              opensAt: place.opensAt || null,
              closesAt: place.closesAt || null,
              lat: lat,
              lng: lng,
              provider: 'Place Data'
            });
          }
          setDetailsLoading(false);
        })
        .catch((error) => {
          // Fallback to basic place info
          setPlaceDetails({
            name: place.name || 'Unknown Location',
            address: {
              full: place.address?.full || place.address?.freeformAddress || place.name || 'Address not available',
              streetName: place.address?.streetName || '',
              municipality: place.address?.municipality || place.address?.city || '',
              country: place.address?.country || 'Philippines',
              postalCode: place.address?.postalCode || ''
            },
            category: place.category || place.type || 'Location',
            phone: place.phone || null,
            rating: place.rating || null,
            reviewCount: place.reviewCount || null,
            description: place.description || null,
            website: place.website || null,
            isOpen: place.isOpen,
            opensAt: place.opensAt || null,
            closesAt: place.closesAt || null,
            lat: place.lat || place.latitude,
            lng: place.lng || place.longitude || place.lon,
            provider: 'Place Data'
          });
          setDetailsLoading(false);
        });
    } else if (!isOpen) {
      placeDetailsFetchedRef.current = null;
      setPlaceDetails(null);
    }
  }, [isOpen, place?.lat, place?.latitude, place?.lng, place?.longitude, place?.lon, place?.name]);

  if (!isOpen || !place) {
    return null;
  }

  const validPlace = {
    name: place.name || 'Unknown Location',
    lat: place.lat || place.latitude || null,
    lng: place.lng || place.longitude || null,
    ...place
  };

  const enrichedPlaceDetails = placeDetails || {
    name: validPlace.name,
    address: validPlace.address,
    category: validPlace.category || validPlace.type,
    phone: validPlace.phone,
    rating: validPlace.rating,
    reviewCount: validPlace.reviewCount,
    description: validPlace.description
  };

  const displayDetails = {
    rating: enrichedPlaceDetails.rating || validPlace.rating || null,
    reviewCount: enrichedPlaceDetails.reviewCount || validPlace.reviewCount || null,
    category: enrichedPlaceDetails.category || enrichedPlaceDetails.type || validPlace.category || validPlace.type || 'Location',
    isOpen: validPlace.isOpen !== undefined ? validPlace.isOpen : (enrichedPlaceDetails.openingHours ? true : null),
    closesAt: validPlace.closesAt || enrichedPlaceDetails.openingHours?.closesAt || null,
    opensAt: validPlace.opensAt || enrichedPlaceDetails.openingHours?.opensAt || null,
    phone: enrichedPlaceDetails.phone || validPlace.phone || null,
    address: enrichedPlaceDetails.address?.full || enrichedPlaceDetails.address?.freeformAddress || validPlace.address?.full || validPlace.address?.freeformAddress || validPlace.name || 'Address not available',
    description: enrichedPlaceDetails.description || validPlace.description || null,
    website: enrichedPlaceDetails.website || validPlace.website || null,
    reviews: Array.isArray(enrichedPlaceDetails.reviews) ? enrichedPlaceDetails.reviews : null
  };

  const formatTravelTime = (minutes) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    onSave?.();
  };

  const panelContent = (
    <>
      {/* Mobile: Bottom Sheet Design */}
      {isMobile ? (
        <div 
          data-place-info-panel
          className="fixed bottom-0 left-0 right-0 pointer-events-none"
          style={{ 
            zIndex: 10001,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto transform transition-all duration-300 ease-out"
            style={{
              maxHeight: 'min(90vh, calc(100dvh - env(safe-area-inset-bottom, 0px) - 80px))'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle - Mobile Only */}
            <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing" onClick={onClose}>
              <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>
            {/* Header */}
            <div className="relative">
              {/* Header Background */}
              <div className="h-32 bg-gradient-to-br from-teal-500 via-cyan-500 to-teal-600" />

              {/* Header Content Overlay */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
                {/* Top Actions */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 drop-shadow-lg truncate">
                      {validPlace.name}
                    </h1>
                  {displayDetails.rating && (
                    <div className="flex items-center space-x-2 text-white drop-shadow-md">
                      <div className="flex items-center space-x-1">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        <span className="text-lg font-semibold">{displayDetails.rating}</span>
                        {displayDetails.reviewCount && (
                          <span className="text-sm opacity-90">
                            ({displayDetails.reviewCount > 1000 
                              ? `${(displayDetails.reviewCount / 1000).toFixed(1)}K` 
                              : displayDetails.reviewCount})
                          </span>
                        )}
                      </div>
                      <span className="text-white/70">•</span>
                      <span className="text-sm opacity-90">{displayDetails.category}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSave}
                    className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
                      isSaved 
                        ? 'bg-red-500/90 text-white hover:bg-red-600/90' 
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    title="Save"
                  >
                    <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={onShare}
                    className="p-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-md transition-all"
                    title="Share"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-md transition-all"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick Info Bar */}
              <div className="flex items-center space-x-4 text-white drop-shadow-md">
                {estimatedTravelTime && (
                  <div className="flex items-center space-x-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full">
                    <Car className="w-4 h-4" />
                    <span className="text-sm font-medium">{formatTravelTime(estimatedTravelTime)}</span>
                  </div>
                )}
                {displayDetails.isOpen !== null && (
                  <div className={`flex items-center space-x-1.5 backdrop-blur-md px-3 py-1.5 rounded-full ${
                    displayDetails.isOpen ? 'bg-green-500/80' : 'bg-red-500/80'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${displayDetails.isOpen ? 'bg-green-200' : 'bg-red-200'}`} />
                    <span className="text-sm font-medium">
                      {displayDetails.isOpen ? 'Open' : 'Closed'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Tabs Navigation */}
              <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <div className="flex items-center px-4 sm:px-6 overflow-x-auto scrollbar-hide">
                  {['Overview', 'Reviews', 'Updates'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedTab(tab.toLowerCase())}
                      className={`px-4 sm:px-6 py-3 sm:py-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                        selectedTab === tab.toLowerCase()
                          ? 'border-teal-500 text-teal-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content - Mobile */}
              <div className="p-4 sm:p-6">
                {/* Overview Tab */}
                {selectedTab === 'overview' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Address Section */}
                    <div className="flex items-start space-x-3 sm:space-x-4 p-3 sm:p-4 bg-gray-50 rounded-xl">
                      <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 mb-1">Address</p>
                        {detailsLoading ? (
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                        ) : (
                          <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{displayDetails.address}</p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {displayDetails.description && (
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">About</h3>
                        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{displayDetails.description}</p>
                      </div>
                    )}

                    {/* Contact & Hours */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {displayDetails.phone && (
                        <div className="flex items-center space-x-3 p-3 sm:p-4 bg-gray-50 rounded-xl">
                          <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-500 mb-1">Phone</p>
                            <a 
                              href={`tel:${displayDetails.phone}`}
                              className="text-xs sm:text-sm text-gray-900 hover:text-teal-600 transition-colors break-all"
                            >
                              {displayDetails.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      {displayDetails.opensAt && displayDetails.closesAt && (
                        <div className="flex items-center space-x-3 p-3 sm:p-4 bg-gray-50 rounded-xl">
                          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Hours</p>
                            <p className="text-xs sm:text-sm text-gray-900">
                              {displayDetails.opensAt} - {displayDetails.closesAt}
                            </p>
                          </div>
                        </div>
                      )}
                      {displayDetails.website && (
                        <div className="flex items-center space-x-3 p-3 sm:p-4 bg-gray-50 rounded-xl sm:col-span-2">
                          <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-500 mb-1">Website</p>
                            <a 
                              href={displayDetails.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs sm:text-sm text-teal-600 hover:text-teal-700 transition-colors flex items-center space-x-1 break-all"
                            >
                              <span>Visit website</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reviews Tab */}
                {selectedTab === 'reviews' && (
                  <div>
                    {detailsLoading ? (
                      <div className="space-y-3 sm:space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="p-3 sm:p-4 border border-gray-200 rounded-xl">
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-full mb-1"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
                          </div>
                        ))}
                      </div>
                    ) : Array.isArray(displayDetails.reviews) && displayDetails.reviews.length > 0 ? (
                      <div className="space-y-3 sm:space-y-4">
                        {displayDetails.reviews.map((review, index) => (
                          <div key={index} className="p-3 sm:p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                            <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                              {review.rating && (
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-3 h-3 sm:w-4 sm:h-4 ${
                                        i < Math.floor(review.rating)
                                          ? 'text-yellow-500 fill-yellow-500'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                              {review.author && (
                                <span className="text-xs sm:text-sm font-semibold text-gray-900">{review.author}</span>
                              )}
                              {review.date && (
                                <span className="text-xs text-gray-500">{review.date}</span>
                              )}
                            </div>
                            {review.text && (
                              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{review.text}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 sm:py-12">
                        <Star className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-xs sm:text-sm text-gray-500">No reviews available for this place</p>
                      </div>
                    )}
                  </div>
                )}


                {/* Updates Tab */}
                {selectedTab === 'updates' && (
                  <div className="text-center py-8 sm:py-12">
                    <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-xs sm:text-sm text-gray-500">No updates available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons - Fixed Footer - Mobile */}
            <div className="border-t border-gray-200 bg-white p-4 sm:p-6 safe-area-bottom">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                {/* Primary Action */}
                <button
                  onClick={isLoadingDirections ? undefined : onDirections}
                  disabled={isLoadingDirections}
                  className={`flex-1 rounded-xl py-3.5 sm:py-4 px-4 sm:px-6 font-semibold flex items-center justify-center space-x-2 transition-all transform ${
                    isLoadingDirections
                      ? 'bg-teal-400 cursor-not-allowed text-white'
                      : 'bg-teal-500 hover:bg-teal-600 text-white hover:shadow-lg active:scale-[0.98]'
                  }`}
                >
                  {isLoadingDirections ? (
                    <>
                      <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span className="text-sm sm:text-base">Getting smart route…</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-5 h-5" />
                      <span className="text-sm sm:text-base">Get Smart Route</span>
                    </>
                  )}
                </button>

                {/* Secondary Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={onStart}
                    className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                      <Play className="w-3 h-3 fill-white" />
                    </div>
                    <span className="text-sm sm:text-base">Start</span>
                  </button>
                  {displayDetails.phone && (
                    <button
                      onClick={onCall}
                      className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl font-medium flex items-center justify-center space-x-2 transition-all hover:bg-gray-50 active:scale-[0.98]"
                    >
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base">Call</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div 
            data-place-info-panel
            className="fixed bottom-20 left-4 pointer-events-none"
            style={{ zIndex: 10001, maxWidth: 'calc(100vw - 2rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="bg-white rounded-lg shadow-2xl w-full max-w-xs max-h-[60vh] flex flex-col overflow-hidden pointer-events-auto transform transition-all duration-300 scale-100 border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative">
                {/* Header Background */}
                <div className="h-24 bg-gradient-to-br from-teal-500 via-cyan-500 to-teal-600" />

                {/* Header Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  {/* Top Actions */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-lg font-bold text-white mb-1 drop-shadow-lg truncate">
                        {validPlace.name}
                      </h1>
                      {displayDetails.rating && (
                        <div className="flex items-center space-x-1.5 text-white drop-shadow-md text-xs">
                          <div className="flex items-center space-x-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-semibold">{displayDetails.rating}</span>
                            {displayDetails.reviewCount && (
                              <span className="text-xs opacity-90">
                                ({displayDetails.reviewCount > 1000 
                                  ? `${(displayDetails.reviewCount / 1000).toFixed(1)}K` 
                                  : displayDetails.reviewCount})
                              </span>
                            )}
                          </div>
                          {displayDetails.category && (
                            <>
                              <span className="text-white/70">•</span>
                              <span className="text-xs opacity-90 truncate">{displayDetails.category}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      <button
                        onClick={handleSave}
                        className={`p-1.5 rounded-full backdrop-blur-md transition-all ${
                          isSaved 
                            ? 'bg-red-500/90 text-white hover:bg-red-600/90' 
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                        title="Save"
                      >
                        <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={onShare}
                        className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-md transition-all"
                        title="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={onClose}
                        className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-md transition-all"
                        title="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Info Bar */}
                  <div className="flex items-center space-x-2 text-white drop-shadow-md mt-1">
                    {estimatedTravelTime && (
                      <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-md px-2 py-1 rounded-full">
                        <Car className="w-3 h-3" />
                        <span className="text-xs font-medium">{formatTravelTime(estimatedTravelTime)}</span>
                      </div>
                    )}
                    {displayDetails.isOpen !== null && (
                      <div className={`flex items-center space-x-1 backdrop-blur-md px-2 py-1 rounded-full ${
                        displayDetails.isOpen ? 'bg-green-500/80' : 'bg-red-500/80'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${displayDetails.isOpen ? 'bg-green-200' : 'bg-red-200'}`} />
                        <span className="text-xs font-medium">
                          {displayDetails.isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Tabs Navigation */}
                <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
                  <div className="flex items-center px-4 overflow-x-auto scrollbar-hide">
                    {['Overview', 'Reviews', 'Photos', 'Updates'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setSelectedTab(tab.toLowerCase())}
                        className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                          selectedTab === tab.toLowerCase()
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-4">
                  {/* Overview Tab */}
                  {selectedTab === 'overview' && (
                    <div className="space-y-3">
                      {/* Address Section */}
                      <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <MapPin className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 mb-1">Address</p>
                          {detailsLoading ? (
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
                          ) : (
                            <p className="text-xs text-gray-700 leading-relaxed">{displayDetails.address}</p>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {displayDetails.description && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-1.5">About</h3>
                          <p className="text-xs text-gray-700 leading-relaxed">{displayDetails.description}</p>
                        </div>
                      )}

                      {/* Contact & Hours */}
                      <div className="grid grid-cols-1 gap-2">
                        {displayDetails.phone && (
                          <div className="flex items-center space-x-2 p-2.5 bg-gray-50 rounded-lg">
                            <Phone className="w-4 h-4 text-teal-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-medium text-gray-500 mb-0.5">Phone</p>
                              <a 
                                href={`tel:${displayDetails.phone}`}
                                className="text-xs text-gray-900 hover:text-teal-600 transition-colors truncate block"
                              >
                                {displayDetails.phone}
                              </a>
                            </div>
                          </div>
                        )}
                        {displayDetails.opensAt && displayDetails.closesAt && (
                          <div className="flex items-center space-x-2 p-2.5 bg-gray-50 rounded-lg">
                            <Clock className="w-4 h-4 text-teal-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-medium text-gray-500 mb-0.5">Hours</p>
                              <p className="text-xs text-gray-900">
                                {displayDetails.opensAt} - {displayDetails.closesAt}
                              </p>
                            </div>
                          </div>
                        )}
                        {displayDetails.website && (
                          <div className="flex items-center space-x-2 p-2.5 bg-gray-50 rounded-lg">
                            <Globe className="w-4 h-4 text-teal-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-medium text-gray-500 mb-0.5">Website</p>
                              <a 
                                href={displayDetails.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-teal-600 hover:text-teal-700 transition-colors flex items-center space-x-1"
                              >
                                <span className="truncate">Visit website</span>
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reviews Tab */}
                  {selectedTab === 'reviews' && (
                    <div>
                      {detailsLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="p-3 border border-gray-200 rounded-lg">
                              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4 mb-2"></div>
                              <div className="h-2.5 bg-gray-200 rounded animate-pulse w-full mb-1"></div>
                              <div className="h-2.5 bg-gray-200 rounded animate-pulse w-3/4"></div>
                            </div>
                          ))}
                        </div>
                      ) : Array.isArray(displayDetails.reviews) && displayDetails.reviews.length > 0 ? (
                        <div className="space-y-2">
                          {displayDetails.reviews.map((review, index) => (
                            <div key={index} className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                              <div className="flex items-center space-x-2 mb-2">
                                {review.rating && (
                                  <div className="flex items-center">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-3 h-3 ${
                                          i < Math.floor(review.rating)
                                            ? 'text-yellow-500 fill-yellow-500'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                )}
                                {review.author && (
                                  <span className="text-xs font-semibold text-gray-900">{review.author}</span>
                                )}
                                {review.date && (
                                  <span className="text-[10px] text-gray-500">{review.date}</span>
                                )}
                              </div>
                              {review.text && (
                                <p className="text-xs text-gray-700 leading-relaxed">{review.text}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Star className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">No reviews available for this place</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Updates Tab */}
                  {selectedTab === 'updates' && (
                    <div className="text-center py-8">
                      <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No updates available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons - Fixed Footer */}
              <div className="border-t border-gray-200 bg-white p-3">
                <div className="flex items-center space-x-2">
                  {/* Primary Action */}
                  <button
                    onClick={isLoadingDirections ? undefined : onDirections}
                    disabled={isLoadingDirections}
                    className={`flex-1 rounded-lg py-2.5 px-4 text-sm font-semibold flex items-center justify-center space-x-2 transition-all transform ${
                      isLoadingDirections
                        ? 'bg-teal-400 cursor-not-allowed text-white'
                        : 'bg-teal-500 hover:bg-teal-600 text-white hover:shadow-lg active:scale-[0.98]'
                    }`}
                  >
                    {isLoadingDirections ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span className="text-xs">Getting smart route…</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4" />
                        <span className="text-xs">Get Smart Route</span>
                      </>
                    )}
                  </button>

                  {/* Secondary Actions */}
                  <button
                    onClick={onStart}
                    className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center space-x-1.5 shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center">
                      <Play className="w-3 h-3 fill-white" />
                    </div>
                    <span className="text-xs">Start</span>
                  </button>
                  {displayDetails.phone && (
                    <button
                      onClick={onCall}
                      className="px-4 py-2.5 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-all hover:bg-gray-50 active:scale-[0.98]"
                    >
                      <Phone className="w-4 h-4" />
                      <span className="text-xs">Call</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );

  if (!document.body) {
    return null;
  }
  
  return createPortal(panelContent, document.body);
};

export default PlaceInfoPanel;
