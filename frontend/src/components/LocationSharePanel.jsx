import React, { useState, useEffect } from 'react';
import { Share2, Copy, X, Clock, MapPin, Check, ExternalLink } from 'lucide-react';
import locationSharingService from '../services/locationSharingService';

/**
 * Location Share Panel Component
 * Allows users to share their live location
 */
const LocationSharePanel = ({ 
  userId, 
  userName, 
  origin, 
  destination, 
  routeData,
  currentLocation,
  onClose
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState(120); // minutes

  useEffect(() => {
    // Check if there's an active share
    if (userId) {
      loadActiveShares();
    }
  }, [userId]);

  const loadActiveShares = async () => {
    try {
      const shares = await locationSharingService.getUserShares(userId);
      if (shares.length > 0) {
        setShareData(shares[0]);
        setIsSharing(true);
      }
    } catch (error) {

    }
  };

  const handleStartSharing = async () => {
    try {
      const share = await locationSharingService.createShare({
        userId,
        userName,
        origin,
        destination,
        routeData,
        expiresInMinutes: expiresIn
      });

      setShareData(share);
      setIsSharing(true);
    } catch (error) {

      alert('Failed to create location share');
    }
  };

  const handleStopSharing = async () => {
    if (!shareData) return;

    try {
      await locationSharingService.cancelShare(shareData.id);
      setShareData(null);
      setIsSharing(false);
    } catch (error) {

    }
  };

  const handleCopyLink = async () => {
    if (!shareData) return;

    try {
      await locationSharingService.copyShareUrl(shareData.shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {

    }
  };

  const handleShare = async () => {
    if (!shareData) return;

    try {
      const shared = await locationSharingService.shareViaWebShare(
        shareData.shareCode,
        userName
      );

      if (!shared) {
        // Fallback to copy
        handleCopyLink();
      }
    } catch (error) {

      handleCopyLink();
    }
  };

  // Update location periodically if sharing
  useEffect(() => {
    if (!isSharing || !shareData || !currentLocation) return;

    const updateInterval = setInterval(async () => {
      try {
        await locationSharingService.updateLocation(shareData.id, {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          eta: routeData?.estimated_duration_minutes,
          distanceRemaining: routeData?.distance_km
        });
      } catch (error) {

      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(updateInterval);
  }, [isSharing, shareData, currentLocation, routeData]);

  if (!isSharing) {
    return (
      <div className="bg-white rounded-xl shadow-xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Share Your Trip</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Expiration Time Selector */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Duration
          </label>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(parseInt(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
            <option value={240}>4 hours</option>
            <option value={480}>8 hours</option>
          </select>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartSharing}
          disabled={!origin || !destination}
          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Start Sharing
        </button>

        {!origin || !destination ? (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Select route first
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-xl p-3 border-2 border-blue-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Sharing Location</h3>
            <p className="text-xs text-gray-600">Live tracking</p>
          </div>
        </div>
        <button
          onClick={handleStopSharing}
          className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
          title="Stop sharing"
        >
          <X className="w-4 h-4 text-red-600" />
        </button>
      </div>

      {/* Share Code */}
      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="text-xs text-gray-500 mb-1">Share Code</div>
        <div className="text-xl font-bold text-blue-600 tracking-wider text-center">
          {shareData?.shareCode}
        </div>
      </div>

      {/* Share URL */}
      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="text-xs text-gray-500 mb-1.5">Share Link</div>
        <div className="flex items-center space-x-1.5">
          <input
            type="text"
            value={shareData?.shareUrl || ''}
            readOnly
            className="flex-1 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700"
          />
          <button
            onClick={handleCopyLink}
            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="Copy link"
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1.5 mb-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Expires in
          </span>
          <span className="font-medium text-gray-900">
            {Math.round((new Date(shareData?.expiresAt) - new Date()) / 60000)} min
          </span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 flex items-center">
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            Views
          </span>
          <span className="font-medium text-gray-900">
            {shareData?.viewCount || 0}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center text-xs"
        >
          <Share2 className="w-3.5 h-3.5 mr-1.5" />
          Share
        </button>
        
        <button
          onClick={() => window.open(shareData?.shareUrl, '_blank')}
          className="flex-1 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center justify-center text-xs"
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
          View
        </button>
      </div>
    </div>
  );
};

export default LocationSharePanel;
