import React from 'react';
import { Heart } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto app-footer w-full">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 text-center sm:text-left">
          {/* Copyright */}
          <div className="flex flex-col sm:flex-row items-center gap-1 text-xs text-gray-600">
            <span>© {currentYear} Las Piñas City TMS.</span>
            <div className="flex items-center">
              <span>Made with</span>
              <Heart className="w-3 h-3 mx-1 text-red-500 fill-current" />
              <span>for safer cities.</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs">
            <button className="text-gray-600 hover:text-blue-600 transition-colors active:text-blue-700 py-1">
              Privacy Policy
            </button>
            <span className="hidden sm:inline text-gray-300">|</span>
            <button className="text-gray-600 hover:text-blue-600 transition-colors active:text-blue-700 py-1">
              Terms of Service
            </button>
            <span className="hidden sm:inline text-gray-300">|</span>
            <button className="text-gray-600 hover:text-blue-600 transition-colors active:text-blue-700 py-1">
              Support Center
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
