import React, { useState, useEffect } from 'react';
import { Plus, Search, Shield, Edit } from 'lucide-react';
import violationService from '../services/violationService';
import { useAuth } from '../context/AuthContext';

const Violations = () => {
  const { user } = useAuth();
  const [violations, setViolations] = useState([]);
  const [filteredViolations, setFilteredViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchViolations();
  }, []);

  useEffect(() => {
    filterViolations();
  }, [violations, searchTerm, statusFilter]);

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const data = await violationService.getViolations({ limit: 100 });
      setViolations(data);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const filterViolations = () => {
    let filtered = violations;

    if (searchTerm) {
      filtered = filtered.filter(violation =>
        violation.violation_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        violation.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        violation.vehicle_plate.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(violation => violation.status === statusFilter);
    }

    setFilteredViolations(filtered);
  };

  const violationStatuses = [
    { value: 'issued', label: 'Issued' },
    { value: 'paid', label: 'Paid' },
    { value: 'contested', label: 'Contested' },
    { value: 'dismissed', label: 'Dismissed' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Traffic Violations</h1>
          <p className="text-gray-600">Manage traffic violations and fines</p>
        </div>
        {user.role === 'traffic_enforcer' || user.role === 'admin' ? (
          <button className="btn-primary flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Issue Violation
          </button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search violations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-field"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
          >
            <option value="">All Statuses</option>
            {violationStatuses.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Violations Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Violation #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fine Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Issued
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredViolations.map((violation) => (
                <tr key={violation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {violation.violation_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span 
                      className="inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white"
                      style={{ backgroundColor: violationService.getViolationTypeColor(violation.violation_type) }}
                    >
                      {violationService.getViolationTypeLabel(violation.violation_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {violation.driver_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        License: {violation.driver_license}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {violation.vehicle_plate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {violationService.formatFineAmount(violation.fine_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span 
                      className="inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white"
                      style={{ backgroundColor: violationService.getViolationStatusColor(violation.status) }}
                    >
                      {violation.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(violation.issued_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-primary-600 hover:text-primary-900">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredViolations.length === 0 && (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No violations found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Violations;
