/**
 * Voice Navigation Service
 * Provides text-to-speech navigation instructions
 */

class VoiceNavigationService {
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.enabled = false;
    this.voice = null;
    this.volume = 1.0;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.language = 'en-US';
    this.lastInstruction = null;
    this.lastInstructionTime = 0;
    this.minTimeBetweenInstructions = 5000; // 5 seconds
    
    // Load settings from localStorage
    this.loadSettings();
    
    // Initialize voices
    this.initializeVoices();
  }

  /**
   * Initialize available voices
   */
  initializeVoices() {
    if (this.synthesis) {
      // Load voices
      const loadVoices = () => {
        const voices = this.synthesis.getVoices();
        
        // Try to find a good default voice
        if (!this.voice && voices.length > 0) {
          // Prefer English voices
          const englishVoice = voices.find(v => v.lang.startsWith('en'));
          this.voice = englishVoice || voices[0];
        }
      };

      loadVoices();
      
      // Chrome loads voices asynchronously
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const settings = localStorage.getItem('voiceNavigationSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        this.enabled = parsed.enabled || false;
        this.volume = parsed.volume || 1.0;
        this.rate = parsed.rate || 1.0;
        this.pitch = parsed.pitch || 1.0;
        this.language = parsed.language || 'en-US';
      }
    } catch (error) {

    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      const settings = {
        enabled: this.enabled,
        volume: this.volume,
        rate: this.rate,
        pitch: this.pitch,
        language: this.language
      };
      localStorage.setItem('voiceNavigationSettings', JSON.stringify(settings));
    } catch (error) {

    }
  }

  /**
   * Enable voice navigation
   */
  enable() {
    this.enabled = true;
    this.saveSettings();
    this.speak('Voice navigation enabled');
  }

  /**
   * Disable voice navigation
   */
  disable() {
    this.enabled = false;
    this.saveSettings();
    this.stopSpeaking();
  }

  /**
   * Toggle voice navigation
   */
  toggle() {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.enabled;
  }

  /**
   * Check if voice navigation is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get available voices
   */
  getVoices() {
    return this.synthesis ? this.synthesis.getVoices() : [];
  }

  /**
   * Set voice by name
   */
  setVoice(voiceName) {
    const voices = this.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      this.voice = voice;
      this.saveSettings();
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  /**
   * Set speech rate (0.1 to 10)
   */
  setRate(rate) {
    this.rate = Math.max(0.1, Math.min(10, rate));
    this.saveSettings();
  }

  /**
   * Set pitch (0 to 2)
   */
  setPitch(pitch) {
    this.pitch = Math.max(0, Math.min(2, pitch));
    this.saveSettings();
  }

  /**
   * Speak text
   */
  speak(text, priority = 'normal') {
    if (!this.enabled || !this.synthesis || !text) {
      return;
    }

    // Prevent duplicate instructions too quickly
    const now = Date.now();
    if (
      priority !== 'high' &&
      text === this.lastInstruction &&
      now - this.lastInstructionTime < this.minTimeBetweenInstructions
    ) {
      return;
    }

    // Cancel current speech if high priority
    if (priority === 'high') {
      this.stopSpeaking();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voice;
    utterance.volume = this.volume;
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.lang = this.language;

    utterance.onend = () => {

    };

    utterance.onerror = (error) => {

    };

    this.synthesis.speak(utterance);
    this.lastInstruction = text;
    this.lastInstructionTime = now;
  }

  /**
   * Stop current speech
   */
  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  /**
   * Announce navigation instruction
   */
  announceInstruction(instruction, distance) {
    if (!this.enabled) return;

    let announcement = '';

    // Format distance
    if (distance < 100) {
      announcement = `In ${Math.round(distance)} meters, `;
    } else if (distance < 1000) {
      announcement = `In ${Math.round(distance / 100) * 100} meters, `;
    } else {
      const km = (distance / 1000).toFixed(1);
      announcement = `In ${km} kilometers, `;
    }

    // Add instruction
    announcement += instruction.toLowerCase();

    this.speak(announcement);
  }

  /**
   * Announce turn
   */
  announceTurn(direction, streetName = null, distance = null) {
    if (!this.enabled) return;

    let announcement = '';

    if (distance !== null) {
      if (distance < 100) {
        announcement = `In ${Math.round(distance)} meters, `;
      } else if (distance < 1000) {
        announcement = `In ${Math.round(distance / 100) * 100} meters, `;
      } else {
        announcement = `In ${(distance / 1000).toFixed(1)} kilometers, `;
      }
    }

    announcement += `turn ${direction}`;

    if (streetName) {
      announcement += ` onto ${streetName}`;
    }

    this.speak(announcement);
  }

  /**
   * Announce arrival
   */
  announceArrival(destinationName = null) {
    if (!this.enabled) return;

    let announcement = 'You have arrived';
    if (destinationName) {
      announcement += ` at ${destinationName}`;
    }

    this.speak(announcement, 'high');
  }

  /**
   * Announce route recalculation
   */
  announceRecalculation() {
    if (!this.enabled) return;
    this.speak('Recalculating route', 'high');
  }

  /**
   * Announce traffic alert
   */
  announceTrafficAlert(message) {
    if (!this.enabled) return;
    this.speak(`Traffic alert: ${message}`, 'high');
  }

  /**
   * Announce incident ahead
   */
  announceIncident(incidentType, distance) {
    if (!this.enabled) return;

    let announcement = '';
    
    if (distance < 1000) {
      announcement = `${incidentType} ahead in ${Math.round(distance)} meters`;
    } else {
      announcement = `${incidentType} ahead in ${(distance / 1000).toFixed(1)} kilometers`;
    }

    this.speak(announcement, 'high');
  }

  /**
   * Announce speed limit
   */
  announceSpeedLimit(limit) {
    if (!this.enabled) return;
    this.speak(`Speed limit ${limit} kilometers per hour`);
  }

  /**
   * Announce ETA
   */
  announceETA(minutes) {
    if (!this.enabled) return;

    let announcement = '';
    
    if (minutes < 1) {
      announcement = 'You will arrive in less than a minute';
    } else if (minutes < 60) {
      announcement = `You will arrive in ${Math.round(minutes)} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      announcement = `You will arrive in ${hours} hour${hours > 1 ? 's' : ''}`;
      if (mins > 0) {
        announcement += ` and ${mins} minutes`;
      }
    }

    this.speak(announcement);
  }

  /**
   * Test voice
   */
  test() {
    this.speak('Voice navigation is working correctly', 'high');
  }
}

export default new VoiceNavigationService();
