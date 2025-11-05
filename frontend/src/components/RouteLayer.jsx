import React, { useEffect, useMemo } from 'react';
import { Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import smartRoutingService from '../services/smartRoutingService';
import routeSmoothingService from '../services/routeSmoothingService';

// Custom icons for route markers
const createCustomIcon = (color, type) => {
  const label = type === 'origin' ? 'A' : 'B';
  const iconHtml = `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${label}</div>`;
  
  return L.divIcon({
    html: iconHtml,
    className: 'custom-route-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// Route waypoint marker
const createWaypointIcon = (index) => {
  return L.divIcon({
    html: `<div style="background-color: #6b7280; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">${index + 1}</div>`,
    className: 'custom-waypoint-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const RouteLayer = ({ 
  routes = [], 
  selectedRoute = null, 
  onRouteClick = null,
  showAllRoutes = false,
  origin = null,
  destination = null,
  simulationProgress = null,
  totalPoints = 0
}) => {
  const map = useMap();

  // Process and smooth routes for better visualization
  const processedRoutes = useMemo(() => {
    if (!Array.isArray(routes)) return [];
    return routes.map(route => {
      if (!route || !Array.isArray(route.route_coordinates)) {

        return { ...route, route_coordinates: [] };
      }

      const validCoordinates = route.route_coordinates.filter(coord => {
        if (!Array.isArray(coord) || coord.length < 2) return false;
        const lat = coord[0], lng = coord[1];
        if (typeof lat !== 'number' || typeof lng !== 'number') return false;
        if (isNaN(lat) || isNaN(lng)) return false;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
        return true;
      });

      if (validCoordinates.length < 2) {

        return { ...route, route_coordinates: [] };
      }

      const cleanRoute = { ...route, route_coordinates: validCoordinates };
      return routeSmoothingService.applyGoogleMapsStyle
        ? routeSmoothingService.applyGoogleMapsStyle(cleanRoute)
        : cleanRoute;
    });
  }, [routes]);

  const processedSelectedRoute = useMemo(() => {
    if (!selectedRoute) return null;
    if (!Array.isArray(selectedRoute.route_coordinates)) {

      return { ...selectedRoute, route_coordinates: [] };
    }

    const validCoordinates = selectedRoute.route_coordinates.filter(coord => {
      if (!Array.isArray(coord) || coord.length < 2) return false;
      const lat = coord[0], lng = coord[1];
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      if (isNaN(lat) || isNaN(lng)) return false;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
      return true;
    });

    if (validCoordinates.length < 2) {

      return { ...selectedRoute, route_coordinates: [] };
    }

    const cleanRoute = { ...selectedRoute, route_coordinates: validCoordinates };
    return routeSmoothingService.applyGoogleMapsStyle
      ? routeSmoothingService.applyGoogleMapsStyle(cleanRoute)
      : cleanRoute;
  }, [selectedRoute]);

  // Fit map to show all processed routes when routes change
  useEffect(() => {
    if (processedRoutes.length > 0 && map) {
      try {
        const bounds = smartRoutingService.calculateRouteBounds
          ? smartRoutingService.calculateRouteBounds(processedRoutes)
          : null;
        if (bounds && bounds.southwest && bounds.northeast) {
          map.fitBounds([bounds.southwest, bounds.northeast], {
            padding: [20, 20],
            maxZoom: 15
          });
        }
      } catch (error) {

      }
    }
  }, [processedRoutes, map]);

  // Fit map to selected route (processed)
  useEffect(() => {
    if (processedSelectedRoute && Array.isArray(processedSelectedRoute.route_coordinates) && processedSelectedRoute.route_coordinates.length > 1 && map) {
      try {
        const routeBounds = L.latLngBounds(
          processedSelectedRoute.route_coordinates.map(coord => [coord[0], coord[1]])
        );
        map.fitBounds(routeBounds, {
          padding: [30, 30],
          maxZoom: 16
        });
      } catch (error) {

      }
    }
  }, [processedSelectedRoute, map]);

  // small helper for getting a stable coordinate pair
  const toLatLng = (coord) => [coord[0], coord[1]];

  return (
    <>
      {/* Show all routes if enabled */}
      {showAllRoutes && processedRoutes.map((route, index) => {
        if (!route || !Array.isArray(route.route_coordinates) || route.route_coordinates.length < 2) return null;

        const isSelected = selectedRoute && selectedRoute.route_id === route.route_id;
        const visualStyle = route.visualStyle || {};
        const routeColor = visualStyle.color || (smartRoutingService.getRoutePolylineColor ? smartRoutingService.getRoutePolylineColor(route) : '#3388ff');
        const routeWeight = isSelected ? 6 : (visualStyle.weight || 3);
        const routeOpacity = isSelected ? 1.0 : (visualStyle.opacity || 0.6);

        const safeCoordinates = route.route_coordinates.filter(coord => {
          if (!Array.isArray(coord) || coord.length < 2) return false;
          const lat = coord[0], lng = coord[1];
          return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        });

        if (safeCoordinates.length < 2) return null;

        return (
          <Polyline
            key={`route-${route.route_id ?? index}`}
            positions={safeCoordinates.map(toLatLng)}
            color={routeColor}
            weight={routeWeight}
            opacity={routeOpacity}
            dashArray={isSelected ? null : visualStyle.dashArray}
            smoothFactor={visualStyle.smoothFactor || 1}
            lineCap={visualStyle.lineCap || "round"}
            lineJoin={visualStyle.lineJoin || "round"}
            eventHandlers={{
              click: () => { if (onRouteClick) onRouteClick(route); },
              mouseover: (e) => e.target.setStyle({ weight: routeWeight + 2, opacity: 1.0 }),
              mouseout: (e) => e.target.setStyle({ weight: routeWeight, opacity: routeOpacity })
            }}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-gray-900">{route.route_name}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Duration: {smartRoutingService.formatDuration ? smartRoutingService.formatDuration(route.estimated_duration_minutes) : `${route.estimated_duration_minutes} min`}</div>
                  <div>Distance: {smartRoutingService.formatDistance ? smartRoutingService.formatDistance(route.distance_km) : `${route.distance_km} km`}</div>
                  <div className="capitalize">Traffic: {route.traffic_conditions}</div>
                  {route.traffic_delays > 0 && (
                    <div className="text-orange-600">Delays: +{route.traffic_delays} min</div>
                  )}
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Show selected route with enhanced styling */}
      {processedSelectedRoute && processedSelectedRoute.route_coordinates && processedSelectedRoute.route_coordinates.length >= 2 && (
        (() => {
          const safeCoordinates = processedSelectedRoute.route_coordinates.filter(coord => {
            if (!Array.isArray(coord) || coord.length < 2) return false;
            const lat = coord[0], lng = coord[1];
            return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
          });

          if (safeCoordinates.length < 2) {

            return null;
          }

          const vs = processedSelectedRoute.visualStyle || {};
          const mainColor = vs.color || (smartRoutingService.getRoutePolylineColor ? smartRoutingService.getRoutePolylineColor(processedSelectedRoute) : '#ff0000');

          // Split route into passed and remaining sections if simulation is active
          const isSimulating = simulationProgress !== null && simulationProgress >= 0;
          const passedCoordinates = isSimulating && simulationProgress > 0 
            ? safeCoordinates.slice(0, simulationProgress + 1) 
            : [];
          const remainingCoordinates = isSimulating && simulationProgress < safeCoordinates.length 
            ? safeCoordinates.slice(simulationProgress) 
            : safeCoordinates;

          return (
            <>
              {/* Outline for visibility */}
              <Polyline
                positions={safeCoordinates.map(toLatLng)}
                color="#ffffff"
                weight={Math.max(10, vs.weight ? vs.weight + 4 : 12)}
                opacity={0.8}
                className="route-outline"
                interactive={false}
                smoothFactor={vs.smoothFactor || 1}
                lineCap={vs.lineCap || "round"}
                lineJoin={vs.lineJoin || "round"}
              />

              {/* Passed section (gray) - only show during simulation */}
              {isSimulating && passedCoordinates.length >= 2 && (
                <Polyline
                  positions={passedCoordinates.map(toLatLng)}
                  color="#9ca3af"
                  weight={vs.weight || 8}
                  opacity={0.7}
                  className="passed-route-line"
                  smoothFactor={vs.smoothFactor || 1}
                  lineCap={vs.lineCap || "round"}
                  lineJoin={vs.lineJoin || "round"}
                  interactive={false}
                />
              )}

              {/* Remaining route (red or original color) */}
              {remainingCoordinates.length >= 2 && (
                <Polyline
                  positions={remainingCoordinates.map(toLatLng)}
                  color={mainColor}
                  weight={vs.weight || 8}
                  opacity={vs.opacity || 0.9}
                  className="selected-route-line"
                  smoothFactor={vs.smoothFactor || 1}
                  lineCap={vs.lineCap || "round"}
                  lineJoin={vs.lineJoin || "round"}
                >
                <Popup>
                  <div className="p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">{smartRoutingService.getRouteTypeIcon ? smartRoutingService.getRouteTypeIcon(processedSelectedRoute.route_type) : null}</span>
                      <h3 className="font-semibold text-gray-900">{processedSelectedRoute.route_name}</h3>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="font-medium">{smartRoutingService.formatDuration ? smartRoutingService.formatDuration(processedSelectedRoute.estimated_duration_minutes) : `${processedSelectedRoute.estimated_duration_minutes} min`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Distance:</span>
                        <span className="font-medium">{smartRoutingService.formatDistance ? smartRoutingService.formatDistance(processedSelectedRoute.distance_km) : `${processedSelectedRoute.distance_km} km`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Traffic:</span>
                        <span className={`font-medium capitalize ${
                          processedSelectedRoute.traffic_conditions === 'light' ? 'text-green-600' :
                          processedSelectedRoute.traffic_conditions === 'moderate' ? 'text-yellow-600' :
                          processedSelectedRoute.traffic_conditions === 'heavy' ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {processedSelectedRoute.traffic_conditions}
                        </span>
                      </div>
                      {processedSelectedRoute.traffic_delays > 0 && (
                        <div className="flex justify-between">
                          <span>Delays:</span>
                          <span className="font-medium text-orange-600">+{processedSelectedRoute.traffic_delays} min</span>
                        </div>
                      )}
                      {processedSelectedRoute.incidents_on_route > 0 && (
                        <div className="flex justify-between">
                          <span>Incidents:</span>
                          <span className="font-medium text-red-600">{processedSelectedRoute.incidents_on_route}</span>
                        </div>
                      )}
                    </div>

                    {/* Advantages */}
                    {processedSelectedRoute.advantages && processedSelectedRoute.advantages.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-xs font-medium text-gray-700 mb-1">Advantages:</div>
                        <div className="space-y-1">
                          {processedSelectedRoute.advantages.slice(0, 2).map((adv, idx) => (
                            <div key={idx} className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                              ✓ {adv}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Polyline>
              )}

              {/* Waypoints */}
              {safeCoordinates.length > 2 && safeCoordinates.slice(1, -1).map((coord, idx) => {
                // show a subset of waypoints for readability
                const step = Math.max(1, Math.floor(safeCoordinates.length / 6));
                if (idx % step !== 0) return null;

                return (
                  <Marker
                    key={`waypoint-${idx}`}
                    position={toLatLng(coord)}
                    icon={createWaypointIcon(idx)}
                  >
                    <Popup>
                      <div className="p-2">
                        <div className="text-sm font-medium">Waypoint {idx + 1}</div>
                        <div className="text-xs text-gray-600">
                          {coord[0].toFixed(4)}, {coord[1].toFixed(4)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </>
          );
        })()
      )}

      {/* Origin marker */}
      {origin && origin.lat != null && (origin.lng != null || origin.lon != null) && (
        <Marker
          position={[origin.lat, origin.lng ?? origin.lon]}
          icon={createCustomIcon('#22c55e', 'origin')}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="p-2">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-semibold text-gray-900">Origin</span>
              </div>
              <div className="text-sm text-gray-700">{origin.name}</div>
              <div className="text-xs text-gray-500">{origin.display_name}</div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Destination marker */}
      {destination && destination.lat != null && (destination.lng != null || destination.lon != null) && (
        <Marker
          position={[destination.lat, destination.lng ?? destination.lon]}
          icon={createCustomIcon('#ef4444', 'destination')}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="p-2">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="font-semibold text-gray-900">Destination</span>
              </div>
              <div className="text-sm text-gray-700">{destination.name}</div>
              <div className="text-xs text-gray-500">{destination.display_name}</div>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
};

export default RouteLayer;
