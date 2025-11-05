import React, { useState } from 'react';
import { Plus, X, GripVertical, MapPin, Navigation, Shuffle, Trash2 } from 'lucide-react';

/**
 * Multi-Stop Route Planner Component
 * Allows users to add multiple waypoints to their route
 */
const MultiStopPlanner = ({ stops, onStopsChange, onCalculateRoute }) => {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const addStop = () => {
    const newStops = [...stops, { name: '', lat: null, lng: null }];
    onStopsChange(newStops);
  };

  const removeStop = (index) => {
    if (index === 0 || index === stops.length - 1) {
      alert('Cannot remove origin or destination');
      return;
    }
    const newStops = stops.filter((_, i) => i !== index);
    onStopsChange(newStops);
  };

  const updateStop = (index, stop) => {
    const newStops = [...stops];
    newStops[index] = stop;
    onStopsChange(newStops);
  };

  const handleDragStart = (index) => {
    if (index === 0 || index === stops.length - 1) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (index === 0 || index === stops.length - 1) return;
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || dropIndex === 0 || dropIndex === stops.length - 1) return;

    const newStops = [...stops];
    const [draggedStop] = newStops.splice(draggedIndex, 1);
    newStops.splice(dropIndex, 0, draggedStop);
    
    onStopsChange(newStops);
    setDraggedIndex(null);
  };

  const optimizeRoute = () => {
    if (stops.length < 3) {
      alert('Add at least one waypoint to optimize');
      return;
    }
    onCalculateRoute({ optimize: true });
  };

  const getStopLabel = (index) => {
    if (index === 0) return 'Origin';
    if (index === stops.length - 1) return 'Destination';
    return `Stop ${index}`;
  };

  const getStopColor = (index) => {
    if (index === 0) return 'bg-blue-500';
    if (index === stops.length - 1) return 'bg-red-500';
    return 'bg-gray-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Multi-Stop Route</h3>
        </div>
        
        <div className="flex items-center space-x-2">
          {stops.length >= 3 && (
            <button
              onClick={optimizeRoute}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center"
              title="Optimize stop order"
            >
              <Shuffle className="w-4 h-4 mr-1" />
              Optimize
            </button>
          )}
          
          {stops.length < 12 && (
            <button
              onClick={addStop}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Stop
            </button>
          )}
        </div>
      </div>

      {/* Stops List */}
      <div className="space-y-2">
        {stops.map((stop, index) => (
          <div
            key={index}
            draggable={index !== 0 && index !== stops.length - 1}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={`
              flex items-center space-x-3 p-3 rounded-lg border-2 transition-all
              ${draggedIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
              ${index !== 0 && index !== stops.length - 1 ? 'cursor-move' : ''}
            `}
          >
            {/* Drag Handle */}
            {index !== 0 && index !== stops.length - 1 && (
              <GripVertical className="w-5 h-5 text-gray-400" />
            )}

            {/* Stop Indicator */}
            <div className={`w-4 h-4 ${getStopColor(index)} rounded-full flex-shrink-0`} />

            {/* Stop Info */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-500 mb-1">
                {getStopLabel(index)}
              </div>
              <div className="text-sm font-medium text-gray-900 truncate">
                {stop.name || 'Not selected'}
              </div>
              {stop.lat && stop.lng && (
                <div className="text-xs text-gray-500">
                  {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                </div>
              )}
            </div>

            {/* Remove Button */}
            {index !== 0 && index !== stops.length - 1 && (
              <button
                onClick={() => removeStop(index)}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors group"
                title="Remove stop"
              >
                <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-600" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Calculate Button */}
      {stops.length >= 2 && stops.every(s => s.lat && s.lng) && (
        <button
          onClick={() => onCalculateRoute({ optimize: false })}
          className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center justify-center"
        >
          <Navigation className="w-5 h-5 mr-2" />
          Calculate Route ({stops.length} stops)
        </button>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>Tip:</strong> Drag and drop waypoints to reorder them, or click "Optimize" to automatically find the best order.
        </p>
      </div>
    </div>
  );
};

export default MultiStopPlanner;
