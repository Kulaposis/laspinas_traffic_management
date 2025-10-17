import React from 'react';
import { School } from 'lucide-react';

const Schools = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
        <p className="text-gray-600">Manage school information and dismissal schedules</p>
      </div>

      <div className="card text-center py-12">
        <School className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Schools Management</h3>
        <p className="text-gray-500">This feature will allow managing schools and their dismissal schedules.</p>
      </div>
    </div>
  );
};

export default Schools;
