import React, { useState, useMemo } from 'react';

const MiniDashboardSheet = ({
  isOpen,
  onClose,
  onOpenDashboard,
  stats = {},
  updates = [],
  align = 'left', // 'left' | 'center' | 'right'
  isLive = true,
  lastUpdated = null,
  onSelectUpdate = null,
}) => {
  const {
    activeIncidents = 0,
    totalReports = 0,
    trafficCondition = 'normal',
  } = stats;

  const [heightMode, setHeightMode] = useState('peek'); // 'peek' | 'half' | 'full'

  const containerAlignment = useMemo(() => {
    if (align === 'left') return 'mx-3 sm:ml-4 sm:mr-auto sm:mx-0';
    if (align === 'right') return 'mx-3 sm:mr-4 sm:ml-auto sm:mx-0';
    return 'mx-3 md:mx-auto';
  }, [align]);

  const heightStyle = useMemo(() => {
    // Non-scrollable; include safe area padding for mobile
    const basePad = 12;
    return { paddingBottom: `calc(${basePad}px + env(safe-area-inset-bottom, 0px))` };
  }, [heightMode]);

  const cycleHeight = () => {
    setHeightMode((m) => (m === 'peek' ? 'half' : m === 'half' ? 'full' : 'peek'));
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[60] pointer-events-none`}
      role="dialog"
      aria-modal={isOpen ? 'true' : 'false'}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`pointer-events-auto relative ${containerAlignment} w-[calc(100%-1.5rem)] sm:w-auto max-w-md md:max-w-2xl rounded-t-2xl bg-white/90 backdrop-blur-xl shadow-2xl border border-white/60 ring-1 ring-black/5 transition-transform duration-300 ease-out overflow-hidden ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={isOpen ? heightStyle : { minHeight: 0 }}
      >
        {/* Grab handle */}
        <button onClick={cycleHeight} className="flex items-center justify-center w-full py-2 select-none active:opacity-80">
          <div className="h-1.5 w-12 rounded-full bg-gray-300" />
        </button>

        {/* Header */}
        <div className="px-4 sm:px-5 pb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Overview</h3>
              {isLive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500">
              {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 'Live snapshot for your current map area'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 text-xs rounded-full font-medium shadow-sm ${
                trafficCondition === 'heavy'
                  ? 'bg-red-100 text-red-700'
                  : trafficCondition === 'moderate'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              Traffic: {trafficCondition}
            </span>
            <button
              onClick={onOpenDashboard}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs sm:text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] shadow-md"
            >
              View full dashboard
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="ml-1 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-5 pb-5">
          {/* Stat row (Weather removed) */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="rounded-xl border border-gray-100 bg-white/70 p-3 hover:bg-white transition-colors shadow-sm">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-700">🚦</span>
                <div className="text-[11px] sm:text-xs text-gray-500">Incidents</div>
              </div>
              <p className="mt-2 text-lg sm:text-xl font-bold text-gray-900">{activeIncidents}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/70 p-3 hover:bg-white transition-colors shadow-sm">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-100 text-purple-700">📝</span>
                <div className="text-[11px] sm:text-xs text-gray-500">Reports</div>
              </div>
              <p className="mt-2 text-lg sm:text-xl font-bold text-gray-900">{totalReports}</p>
            </div>
          </div>

          {/* Quick chips */}
          <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
            <button className="px-2 py-1 rounded-full text-[11px] sm:text-xs bg-blue-50 text-blue-700 border border-blue-200 active:scale-95">Nearby incidents</button>
            <button className="px-2 py-1 rounded-full text-[11px] sm:text-xs bg-purple-50 text-purple-700 border border-purple-200 active:scale-95">Community reports</button>
          </div>

          {/* Updates list */}
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Recent updates</p>
            {updates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-xs text-gray-500">
                No recent updates in this area.
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {updates.slice(0, 3).map((u) => (
                  <div
                    key={u.id || `${u.type}-${u.timestamp}`}
                    className={`flex items-start gap-2 rounded-xl border-l-4 p-2 text-sm shadow-sm ${
                      u.priority === 'high'
                        ? 'bg-red-50 border-red-400'
                        : u.priority === 'medium'
                        ? 'bg-amber-50 border-amber-400'
                        : 'bg-blue-50 border-blue-400'
                    }`}
                  >
                    <span className="text-base leading-5">{u.icon || '📢'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 truncate">{u.message}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {u.timestamp ? new Date(u.timestamp).toLocaleTimeString() : ''}
                      </p>
                    </div>
                    {onSelectUpdate && (
                      <button
                        onClick={() => onSelectUpdate(u)}
                        className="ml-2 px-2 py-1 rounded-lg bg-white/80 hover:bg-white text-blue-700 text-xs font-semibold border border-blue-200 active:scale-95"
                      >
                        View
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiniDashboardSheet;


