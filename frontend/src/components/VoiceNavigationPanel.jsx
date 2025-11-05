import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Settings, Play, Pause } from 'lucide-react';
import voiceNavigationService from '../services/voiceNavigationService';

/**
 * Voice Navigation Panel Component
 * Controls for voice-guided navigation
 */
const VoiceNavigationPanel = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [rate, setRate] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  useEffect(() => {
    // Initialize state from service
    setIsEnabled(voiceNavigationService.isEnabled());
    setVolume(voiceNavigationService.volume);
    setRate(voiceNavigationService.rate);

    // Load available voices
    const loadVoices = () => {
      const availableVoices = voiceNavigationService.getVoices();
      setVoices(availableVoices);
      
      if (voiceNavigationService.voice) {
        setSelectedVoice(voiceNavigationService.voice.name);
      }
    };

    loadVoices();

    // Chrome loads voices asynchronously
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleToggle = () => {
    const newState = voiceNavigationService.toggle();
    setIsEnabled(newState);
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    voiceNavigationService.setVolume(newVolume);
  };

  const handleRateChange = (newRate) => {
    setRate(newRate);
    voiceNavigationService.setRate(newRate);
  };

  const handleVoiceChange = (voiceName) => {
    setSelectedVoice(voiceName);
    voiceNavigationService.setVoice(voiceName);
  };

  const handleTest = () => {
    voiceNavigationService.test();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {isEnabled ? (
            <Volume2 className="w-6 h-6 text-blue-600" />
          ) : (
            <VolumeX className="w-6 h-6 text-gray-400" />
          )}
          <div>
            <h3 className="font-semibold text-gray-900">Voice Navigation</h3>
            <p className="text-xs text-gray-500">
              {isEnabled ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
          
          <button
            onClick={handleToggle}
            className={`
              px-4 py-2 rounded-lg font-medium transition-all duration-200
              ${isEnabled
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }
            `}
          >
            {isEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          {/* Volume Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Volume: {Math.round(volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Speech Rate Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Speed: {rate.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={rate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Voice Selection */}
          {voices.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice
              </label>
              <select
                value={selectedVoice || ''}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Test Button */}
          <button
            onClick={handleTest}
            disabled={!isEnabled}
            className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <Play className="w-4 h-4 mr-2" />
            Test Voice
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceNavigationPanel;
