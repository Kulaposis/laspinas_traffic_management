import React, { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Search,
  Edit,
  Trash2,
  Save,
  X,
  Check,
  AlertTriangle,
  Info,
  Globe,
  Mail,
  Bell,
  Database,
  Shield,
  Server,
  Wrench
} from 'lucide-react';
import adminService from '../services/adminService';

const AdminSystemSettings = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [newSetting, setNewSetting] = useState({
    key: '',
    value: '',
    setting_type: 'string',
    description: '',
    category: 'general',
    is_public: false
  });

  const categories = [
    { id: 'all', name: 'All Settings', icon: Settings },
    { id: 'general', name: 'General', icon: Globe },
    { id: 'system', name: 'System', icon: Server },
    { id: 'email', name: 'Email', icon: Mail },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'database', name: 'Database', icon: Database },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'maintenance', name: 'Maintenance', icon: Wrench }
  ];

  const settingTypes = [
    { value: 'string', label: 'Text' },
    { value: 'integer', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'json', label: 'JSON' },
    { value: 'float', label: 'Decimal' }
  ];

  useEffect(() => {
    fetchSettings();
  }, [selectedCategory]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const category = selectedCategory === 'all' ? null : selectedCategory;
      const data = await adminService.getSystemSettings(category);
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSettings = settings.filter(setting =>
    setting.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    setting.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateSetting = async () => {
    try {
      await adminService.createSystemSetting(newSetting);
      setShowAddModal(false);
      setNewSetting({
        key: '',
        value: '',
        setting_type: 'string',
        description: '',
        category: 'general',
        is_public: false
      });
      await fetchSettings();
    } catch (error) {
      console.error('Error creating setting:', error);
      alert('Error creating setting');
    }
  };

  const handleUpdateSetting = async (key, updateData) => {
    try {
      await adminService.updateSystemSetting(key, updateData);
      setEditingSetting(null);
      await fetchSettings();
    } catch (error) {
      console.error('Error updating setting:', error);
      alert('Error updating setting');
    }
  };

  const handleDeleteSetting = async (key) => {
    if (!confirm('Are you sure you want to delete this setting?')) return;
    
    try {
      await adminService.deleteSystemSetting(key);
      await fetchSettings();
    } catch (error) {
      console.error('Error deleting setting:', error);
      alert('Error deleting setting');
    }
  };

  const renderSettingValue = (setting) => {
    if (editingSetting?.key === setting.key) {
      return (
        <EditingForm
          setting={setting}
          onSave={(updateData) => handleUpdateSetting(setting.key, updateData)}
          onCancel={() => setEditingSetting(null)}
        />
      );
    }

    switch (setting.setting_type) {
      case 'boolean':
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            setting.value === 'true' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {setting.value === 'true' ? 'Enabled' : 'Disabled'}
          </span>
        );
      case 'json':
        return (
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
            {setting.value ? JSON.stringify(JSON.parse(setting.value), null, 2).substring(0, 100) + '...' : 'null'}
          </code>
        );
      default:
        return (
          <span className="text-sm text-gray-900">
            {setting.value || <em className="text-gray-500">No value</em>}
          </span>
        );
    }
  };

  const getCategoryIcon = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    const Icon = category?.icon || Settings;
    return <Icon className="w-4 h-4" />;
  };

  const EditingForm = ({ setting, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
      value: setting.value || '',
      description: setting.description || '',
      category: setting.category || 'general',
      is_public: setting.is_public || false
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      onSave(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700">Value</label>
          {setting.setting_type === 'boolean' ? (
            <select
              value={formData.value}
              onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : setting.setting_type === 'json' ? (
            <textarea
              value={formData.value}
              onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Enter valid JSON"
            />
          ) : (
            <input
              type={setting.setting_type === 'integer' || setting.setting_type === 'float' ? 'number' : 'text'}
              value={formData.value}
              onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {categories.filter(cat => cat.id !== 'all').map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_public"
            checked={formData.is_public}
            onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="is_public" className="ml-2 text-sm text-gray-700">
            Public setting (visible to non-admin users)
          </label>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </button>
        </div>
      </form>
    );
  };

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
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600">Configure system-wide settings and preferences</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Setting
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Categories Sidebar */}
        <div className="lg:w-64">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
            <nav className="space-y-1">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    {category.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Settings List */}
        <div className="flex-1">
          <div className="card">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Settings Table */}
            <div className="space-y-4">
              {filteredSettings.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No settings found</p>
                </div>
              ) : (
                filteredSettings.map((setting) => (
                  <div
                    key={setting.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getCategoryIcon(setting.category)}
                          <h4 className="text-lg font-medium text-gray-900">{setting.key}</h4>
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                            {setting.setting_type}
                          </span>
                          {setting.is_public && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">
                              Public
                            </span>
                          )}
                        </div>
                        
                        {setting.description && (
                          <p className="text-sm text-gray-600 mb-3">{setting.description}</p>
                        )}
                        
                        <div className="mb-2">
                          <label className="text-sm font-medium text-gray-700">Value:</label>
                          <div className="mt-1">
                            {renderSettingValue(setting)}
                          </div>
                        </div>

                        <div className="text-xs text-gray-500">
                          Category: {setting.category} • 
                          Created: {new Date(setting.created_at).toLocaleDateString()} •
                          Last updated: {setting.updated_at ? new Date(setting.updated_at).toLocaleDateString() : 'Never'}
                        </div>
                      </div>

                      {editingSetting?.key !== setting.key && (
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => setEditingSetting(setting)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit Setting"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSetting(setting.key)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            title="Delete Setting"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Setting Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Add New Setting</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateSetting();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700">Key</label>
                  <input
                    type="text"
                    required
                    value={newSetting.key}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, key: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., max_file_size"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={newSetting.setting_type}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, setting_type: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {settingTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Value</label>
                  {newSetting.setting_type === 'boolean' ? (
                    <select
                      value={newSetting.value}
                      onChange={(e) => setNewSetting(prev => ({ ...prev, value: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : newSetting.setting_type === 'json' ? (
                    <textarea
                      value={newSetting.value}
                      onChange={(e) => setNewSetting(prev => ({ ...prev, value: e.target.value }))}
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder="Enter valid JSON"
                    />
                  ) : (
                    <input
                      type={newSetting.setting_type === 'integer' || newSetting.setting_type === 'float' ? 'number' : 'text'}
                      value={newSetting.value}
                      onChange={(e) => setNewSetting(prev => ({ ...prev, value: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={newSetting.category}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, category: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.filter(cat => cat.id !== 'all').map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={newSetting.description}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe what this setting does"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="new_is_public"
                    checked={newSetting.is_public}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, is_public: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="new_is_public" className="ml-2 text-sm text-gray-700">
                    Public setting
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Setting
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystemSettings;
