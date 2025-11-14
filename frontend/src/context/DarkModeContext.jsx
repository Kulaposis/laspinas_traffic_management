import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Dark Mode Context
 * Provides dark mode state based on map style preference
 * When mapStyle is 'night', dark mode is enabled
 */
const DarkModeContext = createContext({
  isDarkMode: false,
  mapStyle: 'main',
});

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within DarkModeProvider');
  }
  return context;
};

export const DarkModeProvider = ({ children, mapStyle = 'main' }) => {
  // Dark mode is enabled when map style is 'night'
  const isDarkMode = mapStyle === 'night';

  // Apply dark mode class to document body
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
    }

    return () => {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
    };
  }, [isDarkMode]);

  return (
    <DarkModeContext.Provider value={{ isDarkMode, mapStyle }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export default DarkModeContext;

