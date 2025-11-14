import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Download,
  Upload,
  Eye,
  Mail,
  Phone,
  Calendar,
  Activity,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import adminService from '../services/adminService';
import userService from '../services/userService';

const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivity, setUserActivity] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    username: '',
    phone_number: '',
    role: 'citizen',
    password: ''
  });
  const [showCreateSuccess, setShowCreateSuccess] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    full_name: '',
    email: '',
    username: '',
    phone_number: '',
    role: 'citizen',
    is_active: true
  });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, statsData] = await Promise.all([
        userService.getUsers({ ...filters, limit: 100 }),
        adminService.getUserStats()
      ]);
      setUsers(usersData);
      setUserStats(statsData);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId) => {
    setSelectedUsers(prev => {
      const newSelected = prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      setShowBulkActions(newSelected.length > 0);
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
      setShowBulkActions(false);
    } else {
      setSelectedUsers(users.map(user => user.id));
      setShowBulkActions(true);
    }
  };

  const handleBulkAction = async (action, parameters = {}) => {
    try {
      const result = await adminService.bulkUserOperation({
        operation: action,
        user_ids: selectedUsers,
        parameters
      });
      
      if (result.successful > 0) {
        await fetchData();
        setSelectedUsers([]);
        setShowBulkActions(false);
        alert(`Successfully ${action}d ${result.successful} users`);
      }
      
      if (result.failed > 0) {
        alert(`Failed to ${action} ${result.failed} users: ${result.errors.join(', ')}`);
      }
    } catch (error) {

      alert(`Error performing bulk ${action}`);
    }
  };

  const handleViewUser = async (user) => {
    try {
      setSelectedUser(user);
      const activity = await adminService.getUserActivitySummary(user.id);
      setUserActivity(activity);
      setShowUserModal(true);
    } catch (error) {

      setSelectedUser(user);
      setUserActivity(null);
      setShowUserModal(true);
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      lgu_staff: 'bg-blue-100 text-blue-800',
      traffic_enforcer: 'bg-green-100 text-green-800',
      citizen: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || colors.citizen;
  };

  const getRoleIcon = (role) => {
    const icons = {
      admin: Shield,
      lgu_staff: Users,
      traffic_enforcer: Activity,
      citizen: Users
    };
    const Icon = icons[role] || Users;
    return <Icon className="w-4 h-4" />;
  };

  const StatCard = ({ title, value, icon: Icon, color, description }) => (
    <div className="card">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );

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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage system users and their permissions</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn btn-secondary">
            <Upload className="w-4 h-4 mr-2" />
            Import Users
          </button>
          <button className="btn btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export Users
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={userStats.total_users}
            icon={Users}
            color="bg-blue-500"
            description={`${userStats.active_users} active`}
          />
          <StatCard
            title="Recent Registrations"
            value={userStats.recent_registrations}
            icon={UserPlus}
            color="bg-green-500"
            description="Last 7 days"
          />
          <StatCard
            title="Recent Logins"
            value={userStats.recent_logins}
            icon={Activity}
            color="bg-purple-500"
            description="Last 24 hours"
          />
          <StatCard
            title="Inactive Users"
            value={userStats.inactive_users}
            icon={UserX}
            color="bg-orange-500"
            description="Disabled accounts"
          />
        </div>
      )}

      {/* Filters and Search */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Users</h2>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.role}
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="lgu_staff">LGU Staff</option>
              <option value="traffic_enforcer">Traffic Enforcer</option>
              <option value="citizen">Citizen</option>
            </select>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-800">
                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkAction('activate')}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  <UserCheck className="w-4 h-4 mr-1 inline" />
                  Activate
                </button>
                <button
                  onClick={() => handleBulkAction('deactivate')}
                  className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                >
                  <UserX className="w-4 h-4 mr-1 inline" />
                  Deactivate
                </button>
                <button
                  onClick={() => {
                    const newRole = prompt('Enter new role (admin, lgu_staff, traffic_enforcer, citizen):');
                    if (newRole) {
                      handleBulkAction('change_role', { new_role: newRole });
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  <Shield className="w-4 h-4 mr-1 inline" />
                  Change Role
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete selected users?')) {
                      handleBulkAction('delete');
                    }
                  }}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-1 inline" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === users.length && users.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleUserSelect(user.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-sm text-gray-500">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {getRoleIcon(user.role)}
                      <span className="ml-1 capitalize">{user.role.replace('_', ' ')}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="text-green-600 hover:text-green-900"
                        title="Edit User"
                        onClick={() => {
                          setEditForm({
                            id: user.id,
                            full_name: user.full_name,
                            email: user.email,
                            username: user.username,
                            phone_number: user.phone_number || '',
                            role: user.role,
                            is_active: user.is_active
                          });
                          setShowEditModal(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedUser.full_name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedUser.username}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedUser.phone_number || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Role</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(selectedUser.role)}`}>
                        {getRoleIcon(selectedUser.role)}
                        <span className="ml-1 capitalize">{selectedUser.role.replace('_', ' ')}</span>
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedUser.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedUser.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Activity Summary */}
                {userActivity && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Activity Summary</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Total Reports</label>
                        <p className="mt-1 text-sm text-gray-900">{userActivity.total_reports}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Total Violations</label>
                        <p className="mt-1 text-sm text-gray-900">{userActivity.total_violations}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Account Age</label>
                        <p className="mt-1 text-sm text-gray-900">{userActivity.account_age_days} days</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Login</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {userActivity.last_login ? new Date(userActivity.last_login).toLocaleString() : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="btn btn-secondary"
                  >
                    Close
                  </button>
                  <button className="btn btn-primary">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit User
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Add New User</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCreateLoading(true);
                  try {
                    // Basic validation
                    if (!createForm.full_name || !createForm.email || !createForm.username || !createForm.password) {
                      alert('Please fill in full name, email, username, and password');
                      return;
                    }
                    // Verify token exists before creating user
                    const token = localStorage.getItem('access_token');
                    if (!token) {
                      alert('Authentication token not found. Please log out and log back in.');
                      setCreateLoading(false);
                      return;
                    }
                    
                    console.log('Creating user with token:', token ? 'Token exists' : 'No token');
                    const newUser = await userService.createUser({
                      full_name: createForm.full_name,
                      email: createForm.email,
                      username: createForm.username,
                      phone_number: createForm.phone_number || null,
                      role: createForm.role,
                      password: createForm.password
                    });
                    await fetchData();
                    setCreatedUser(newUser);
                    setShowCreateModal(false);
                    setShowCreateSuccess(true);
                    setCreateForm({ full_name: '', email: '', username: '', phone_number: '', role: 'citizen', password: '' });
                  } catch (err) {
                    alert(err?.response?.data?.detail || err?.message || 'Failed to create user');
                  } finally {
                    setCreateLoading(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input className="mt-1 w-full border rounded p-2" value={createForm.full_name} onChange={(e)=>setCreateForm({...createForm, full_name:e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input className="mt-1 w-full border rounded p-2" value={createForm.username} onChange={(e)=>setCreateForm({...createForm, username:e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" className="mt-1 w-full border rounded p-2" value={createForm.email} onChange={(e)=>setCreateForm({...createForm, email:e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input className="mt-1 w-full border rounded p-2" value={createForm.phone_number} onChange={(e)=>setCreateForm({...createForm, phone_number:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select className="mt-1 w-full border rounded p-2" value={createForm.role} onChange={(e)=>setCreateForm({...createForm, role:e.target.value})}>
                      <option value="admin">Admin</option>
                      <option value="lgu_staff">LGU Staff</option>
                      <option value="traffic_enforcer">Traffic Enforcer</option>
                      <option value="citizen">Citizen</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input type="password" className="mt-1 w-full border rounded p-2" value={createForm.password} onChange={(e)=>setCreateForm({...createForm, password:e.target.value})} required />
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={()=>setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={createLoading}>{createLoading ? 'Creating...' : 'Create User'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Success Modal */}
      {showCreateSuccess && createdUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">User Created</h3>
                <button onClick={() => setShowCreateSuccess(false)} className="text-gray-400 hover:text-gray-600">×</button>
              </div>
              <p className="text-gray-700 mb-4">The user has been created successfully.</p>
              <div className="border rounded p-3 bg-gray-50 text-sm mb-6">
                <div className="font-medium text-gray-900">{createdUser.full_name}</div>
                <div className="text-gray-700">{createdUser.email} · @{createdUser.username}</div>
                <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-blue-100 text-blue-800">
                  {createdUser.role}
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  className="btn btn-secondary"
                  onClick={() => { setShowCreateSuccess(false); setShowCreateModal(true); }}
                >
                  Add Another
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => { setShowCreateSuccess(false); setCreatedUser(null); }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setEditLoading(true);
                  try {
                    await userService.updateUser(editForm.id, {
                      full_name: editForm.full_name,
                      email: editForm.email,
                      phone_number: editForm.phone_number || null,
                      role: editForm.role,
                      is_active: editForm.is_active
                    });
                    await fetchData();
                    setShowEditModal(false);
                  } catch (err) {
                    alert(err?.response?.data?.detail || err?.message || 'Failed to update user');
                  } finally {
                    setEditLoading(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input className="mt-1 w-full border rounded p-2" value={editForm.full_name} onChange={(e)=>setEditForm({...editForm, full_name:e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input className="mt-1 w-full border rounded p-2 bg-gray-100" value={editForm.username} disabled />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" className="mt-1 w-full border rounded p-2" value={editForm.email} onChange={(e)=>setEditForm({...editForm, email:e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input className="mt-1 w-full border rounded p-2" value={editForm.phone_number} onChange={(e)=>setEditForm({...editForm, phone_number:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select className="mt-1 w-full border rounded p-2" value={editForm.role} onChange={(e)=>setEditForm({...editForm, role:e.target.value})}>
                      <option value="admin">Admin</option>
                      <option value="lgu_staff">LGU Staff</option>
                      <option value="traffic_enforcer">Traffic Enforcer</option>
                      <option value="citizen">Citizen</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2 mt-6">
                    <input id="isActive" type="checkbox" className="h-4 w-4" checked={editForm.is_active} onChange={(e)=>setEditForm({...editForm, is_active:e.target.checked})} />
                    <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={()=>setShowEditModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={editLoading}>{editLoading ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
