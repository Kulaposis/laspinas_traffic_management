import React from 'react';

/**
 * Reusable Loading Skeleton Components
 */

// Card Skeleton
export const CardSkeleton = ({ className = '' }) => (
  <div className={`bg-white rounded-xl shadow-md p-4 animate-pulse ${className}`}>
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
  </div>
);

// Map Skeleton
export const MapSkeleton = ({ height = 'h-[500px]' }) => (
  <div className={`bg-gray-200 rounded-xl ${height} animate-pulse flex items-center justify-center`}>
    <div className="text-center">
      <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-3"></div>
      <div className="h-4 bg-gray-300 rounded w-32 mx-auto"></div>
    </div>
  </div>
);

// Table Skeleton
export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden">
    <div className="animate-pulse">
      {/* Header */}
      <div className="bg-gray-100 p-4 border-b">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {[...Array(columns)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-300 rounded"></div>
          ))}
        </div>
      </div>
      {/* Rows */}
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="p-4 border-b">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {[...Array(columns)].map((_, colIndex) => (
              <div key={colIndex} className="h-3 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Stats Card Skeleton
export const StatsCardSkeleton = () => (
  <div className="bg-white rounded-xl shadow-md p-6 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
      <div className="h-6 bg-gray-200 rounded w-16"></div>
    </div>
    <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-32"></div>
  </div>
);

// List Item Skeleton
export const ListItemSkeleton = () => (
  <div className="flex items-center space-x-4 p-4 bg-white rounded-xl shadow-sm animate-pulse">
    <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0"></div>
    <div className="flex-1">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
    </div>
    <div className="w-6 h-6 bg-gray-200 rounded"></div>
  </div>
);

// Hero Skeleton (for dashboard)
export const HeroSkeleton = () => (
  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-8 animate-pulse">
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="h-6 bg-white/20 rounded w-48 mb-3"></div>
        <div className="flex items-center space-x-3">
          <div className="w-16 h-16 bg-white/20 rounded-full"></div>
          <div>
            <div className="h-8 bg-white/20 rounded w-32 mb-2"></div>
            <div className="h-4 bg-white/20 rounded w-24"></div>
          </div>
        </div>
      </div>
      <div className="flex space-x-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-3 h-16 bg-white/20 rounded-full"></div>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white/10 rounded-2xl p-4">
          <div className="h-8 bg-white/20 rounded w-16 mb-2"></div>
          <div className="h-3 bg-white/20 rounded w-24"></div>
        </div>
      ))}
    </div>
  </div>
);

// Traffic Monitor Skeleton
export const TrafficMonitorSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
    {/* Header */}
    <div className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gray-200 rounded-2xl animate-pulse"></div>
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
          </div>
          <div className="flex space-x-3">
            <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
            <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
          </div>
        </div>
        <HeroSkeleton />
      </div>
    </div>

    {/* Main Content */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <MapSkeleton height="h-[500px]" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Dashboard Skeleton
export const DashboardSkeleton = () => (
  <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="h-10 bg-gray-200 rounded w-64 mb-4 animate-pulse"></div>
        <div className="h-6 bg-gray-200 rounded w-96 animate-pulse"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <CardSkeleton className="h-80" />
        <CardSkeleton className="h-80" />
      </div>

      {/* Table */}
      <TableSkeleton rows={5} columns={5} />
    </div>
  </div>
);

// Full Page Skeleton with custom content
export const PageSkeleton = ({ children }) => (
  <div className="min-h-screen bg-gray-50">
    <div className="animate-pulse">
      {children}
    </div>
  </div>
);

// Simple Loading Spinner
export const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizes[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
    </div>
  );
};

// Loading Overlay
export const LoadingOverlay = ({ message = 'Loading...' }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
      <LoadingSpinner size="xl" className="mb-4" />
      <p className="text-gray-700 font-medium">{message}</p>
    </div>
  </div>
);

export default {
  CardSkeleton,
  MapSkeleton,
  TableSkeleton,
  StatsCardSkeleton,
  ListItemSkeleton,
  HeroSkeleton,
  TrafficMonitorSkeleton,
  DashboardSkeleton,
  PageSkeleton,
  LoadingSpinner,
  LoadingOverlay
};
