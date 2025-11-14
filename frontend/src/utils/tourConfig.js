/**
 * Driver.js Tour Configuration
 * Defines the steps for the Traffic Map onboarding tour
 * 
 * Note: This function dynamically finds elements by text content
 * since some buttons don't have stable IDs or classes
 */

export const getTrafficMapTourSteps = () => {
  // Helper function to find element by text content
  const findElementByText = (tagName, text) => {
    const elements = document.querySelectorAll(tagName);
    for (const el of elements) {
      if (el.textContent && el.textContent.trim().includes(text)) {
        return el;
      }
    }
    return null;
  };

  const steps = [];
  
  // Welcome step - targets the map container (always add this first)
  const mapContainer = document.querySelector('.leaflet-container');
  if (mapContainer) {
    steps.push({
      element: mapContainer,
      popover: {
        title: '🗺️ Welcome to Traffic Map!',
        description: 'This is your interactive traffic management map. Let\'s take a quick tour to help you get started.',
        side: 'bottom',
        align: 'center'
      }
    });
  }

  // Find elements dynamically and add steps
  const menuButton = document.querySelector('button[title="Menu"]');
  if (menuButton) {
    steps.push({
      element: menuButton,
      popover: {
        title: '📋 Sidebar Menu',
        description: 'Click here to access map settings, layers, and features. You can toggle traffic layers, weather, and more.',
        side: 'right',
        align: 'start'
      }
    });
  }

  // Sidebar toggles (these will be added after sidebar opens)
  // Note: These steps are added dynamically when sidebar is open, excluding User Reports
  
  // After sidebar toggles, continue with map features
  const searchInput = document.querySelector('input[type="text"][placeholder*="Search"], input[placeholder*="places"]');
  if (searchInput) {
    steps.push({
      element: searchInput,
      popover: {
        title: '🔍 Search for Places',
        description: 'Search for any location, address, or point of interest. The map will show you the best route options.',
        side: 'bottom',
        align: 'start'
      }
    });
  }

  // Insights Button (blue button with BarChart icon - the one that says "Insights")
  const insightsButton = findElementByText('button', 'Insights');
  if (insightsButton) {
    steps.push({
      element: insightsButton,
      popover: {
        title: '📊 Traffic Insights',
        description: 'View real-time traffic analytics, congestion data, and insights about current road conditions.',
        side: 'left',
        align: 'start'
      }
    });
  }

  const weatherButton = findElementByText('button', 'Weather');
  if (weatherButton) {
    steps.push({
      element: weatherButton,
      popover: {
        title: '🌤️ Weather Information',
        description: 'Check current weather conditions and flood advisories for your area.',
        side: 'top',
        align: 'start'
      }
    });
  }

  // Show Traffic Heatmap button (floating toggle, top-right)
  const heatmapToggleButton =
    findElementByText('button', 'Show Traffic Heatmap') ||
    document.querySelector('button[title="Show Traffic Heatmap"]');
  if (heatmapToggleButton) {
    steps.push({
      element: heatmapToggleButton,
      popover: {
        title: '🔥 Traffic Heatmap',
        description: 'Visualize congestion hotspots. Toggle this to overlay the live traffic heatmap on the map.',
        side: 'left',
        align: 'start'
      }
    });
  }

  // Emergency Report Button (red button with AlertTriangle icon)
  const emergencyReportButton =
    document.querySelector('button[title="Report Incident"]') ||
    document.querySelector('button[title="Report Emergency"]');
  if (emergencyReportButton) {
    steps.push({
      element: emergencyReportButton,
      popover: {
        title: '🚨 Report Emergency Incident',
        description: 'Click this button to report traffic incidents, accidents, or emergencies. Help keep the community informed about road conditions.',
        side: 'left',
        align: 'start'
      }
    });
  }

  // Traffic Predictions button (cyan floating action button)
  const trafficPredictionsButton = document.querySelector('button[title="Traffic Predictions"]');
  if (trafficPredictionsButton) {
    steps.push({
      element: trafficPredictionsButton,
      popover: {
        title: '📈 Traffic Predictions',
        description: 'Open detailed forecasts to see how congestion will change in the next few hours.',
        side: 'left',
        align: 'start'
      }
    });
  }

  return steps;
};

/**
 * Get sidebar toggle steps (excluding User Reports)
 * These should be added after the sidebar opens
 */
export const getSidebarToggleSteps = () => {
  const findElementByText = (tagName, text) => {
    const elements = document.querySelectorAll(tagName);
    for (const el of elements) {
      if (el.textContent && el.textContent.trim().includes(text)) {
        return el;
      }
    }
    return null;
  };

  const toggleSteps = [];
  
  // Define the toggles to show (excluding User Reports)
  // Note: Match the exact label text from the sidebar component
  const togglesToShow = [
    { label: 'No‑Parking & Restricted Zones', title: '🚫 No-Parking Zones', description: 'Highlights areas where stopping/parking is restricted. Essential for avoiding parking violations.' },
    { label: 'Weather & Flood', title: '🌤️ Weather & Flood', description: 'View weather alerts, flood zones, and active flood warnings to stay safe on the road.' },
    { label: 'Traffic Monitoring', title: '🚦 Traffic Monitoring', description: 'Access real-time traffic flow data and traffic monitoring insights.' },
    { label: 'Traffic Predictions', title: '📈 Traffic Predictions', description: 'View traffic predictions and future congestion forecasts to plan your route better.' },
    { label: 'Incident Prone Areas', title: '⚠️ Incident Prone Areas', description: 'See areas with higher risk of traffic incidents based on historical data.' }
  ];

  // Find each toggle and add it to steps
  togglesToShow.forEach(toggle => {
    // Try exact match first
    let toggleElement = findElementByText('label', toggle.label);
    
    // If not found, try partial match (for special characters)
    if (!toggleElement) {
      const partialMatch = toggle.label.split('&')[0].trim(); // Get text before & for "No-Parking & Restricted Zones"
      toggleElement = findElementByText('label', partialMatch);
    }
    
    // If still not found, try finding by key words
    if (!toggleElement && toggle.label.includes('Parking')) {
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent && (label.textContent.includes('Parking') || label.textContent.includes('Restricted'))) {
          toggleElement = label;
          break;
        }
      }
    }
    
    if (toggleElement) {
      toggleSteps.push({
        element: toggleElement,
        popover: {
          title: toggle.title,
          description: toggle.description,
          side: 'right',
          align: 'start'
        }
      });
    } else {
      console.warn('Could not find toggle element for:', toggle.label);
    }
  });

  return toggleSteps;
};

/**
 * Alternative tour steps with more specific selectors
 * Use these if the above selectors don't work reliably
 */
export const getTrafficMapTourStepsDetailed = () => {
  return [
    {
      element: '#map-container, .leaflet-container',
      popover: {
        title: '🗺️ Welcome to Traffic Map!',
        description: 'This is your interactive traffic management map. Let\'s take a quick tour to help you get started.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      // Hamburger menu button
      element: 'button[aria-label*="Menu"], button:has(svg[class*="Menu"])',
      popover: {
        title: '📋 Sidebar Menu',
        description: 'Click here to access map settings, layers, and features. You can toggle traffic layers, weather, and more.',
        side: 'right',
        align: 'start'
      }
    },
    {
      // Search bar
      element: 'input[type="text"][placeholder*="Search"], input[placeholder*="places"]',
      popover: {
        title: '🔍 Search for Places',
        description: 'Search for any location, address, or point of interest. The map will show you the best route options.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      // Insights button - using text content
      element: 'button:has-text("Insights"), a:has-text("Insights")',
      popover: {
        title: '📊 Traffic Insights',
        description: 'View real-time traffic analytics, congestion data, and insights about current road conditions.',
        side: 'left',
        align: 'start'
      }
    },
    {
      // Zoom controls
      element: '.leaflet-control-zoom-in, .leaflet-control-zoom',
      popover: {
        title: '🔍 Map Controls',
        description: 'Use these controls to zoom in and out of the map. You can also use your mouse wheel or pinch gestures.',
        side: 'left',
        align: 'start'
      }
    },
    {
      // Weather button
      element: 'button:has-text("Weather"), button[title*="Weather"]',
      popover: {
        title: '🌤️ Weather Information',
        description: 'Check current weather conditions and flood advisories for your area.',
        side: 'top',
        align: 'start'
      }
    }
  ];
};

