import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

/**
 * PWA Install Prompt Component
 * Shows a prompt to install the app on mobile/desktop
 */

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      
      // Show the install prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000); // Show after 5 seconds
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {

      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {

    } else {

      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <>
      {/* Mobile Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <div className="bg-white border-t-4 border-blue-500 shadow-2xl rounded-t-3xl p-6 animate-slide-up">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <Download className="w-8 h-8 text-white" />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Install LP Traffic App
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Get faster access and work offline. Install our app on your home screen!
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg"
                >
                  Install Now
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-3 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Banner */}
      <div className="hidden md:block fixed top-20 right-4 z-50 max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 animate-slide-left">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Download className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Install App
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Install LP Traffic for quick access and offline support.
              </p>

              <button
                onClick={handleInstallClick}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slide-left {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }

        .animate-slide-left {
          animation: slide-left 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default PWAInstallPrompt;
