import React, { useState, useEffect } from 'react';
import { Tool } from '../types';
import ToolCard from './ToolCard';
import UpgradeModal from './UpgradeModal';
import ToolDetailsModal from './ToolDetailsModal';
import { tools } from '../data/tools';
import { Search, Filter, AlertCircle, CheckCircle, Clock, Zap, Server, Activity } from 'lucide-react';

interface ServiceStatus {
  [serviceName: string]: 'running' | 'stopped' | 'unknown';
}

interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  services: ServiceStatus;
}

const Dashboard: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [detailsTool, setDetailsTool] = useState<Tool | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [upgradeInProgress, setUpgradeInProgress] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }>>([]);

  // Fetch system health and service status
  useEffect(() => {
    const fetchSystemHealth = async () => {
      try {
        const response = await fetch('/api/system/health');
        if (response.ok) {
          const health = await response.json();
          setSystemHealth(health);
        }
      } catch (error) {
        console.error('Failed to fetch system health:', error);
        addNotification('error', 'Failed to fetch system health');
      }
    };

    fetchSystemHealth();
    const healthInterval = setInterval(fetchSystemHealth, 30000);
    return () => clearInterval(healthInterval);
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'upgrade_progress':
          if (data.status === 'completed') {
            setUpgradeInProgress(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.toolId);
              return newSet;
            });
            addNotification('success', `${data.toolName} upgrade completed successfully`);
          } else if (data.status === 'error') {
            setUpgradeInProgress(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.toolId);
              return newSet;
            });
            addNotification('error', `${data.toolName} upgrade failed: ${data.error}`);
          }
          break;

        case 'service_status':
          setSystemHealth(prev => prev ? {
            ...prev,
            services: { ...prev.services, [data.serviceName]: data.status }
          } : null);
          break;
      }
    };

    return () => ws.close();
  }, []);

  const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
    const notification = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date()
    };

    setNotifications(prev => [notification, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const handleUpgradeStart = async (tool: Tool) => {
    setUpgradeInProgress(prev => new Set(prev.add(tool.id)));

    try {
      const response = await fetch(`/api/tools/${tool.id}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          currentVersion: tool.currentVersion,
          targetVersion: tool.latestVersion,
        }),
      });

      if (!response.ok) {
        throw new Error(`Upgrade failed: ${response.statusText}`);
      }

      const result = await response.json();
      addNotification('info', `${tool.name} upgrade started (Process ID: ${result.processId})`);

    } catch (error) {
      setUpgradeInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(tool.id);
        return newSet;
      });
      addNotification('error', `Failed to start upgrade for ${tool.name}: ${error.message}`);
    }
  };

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || tool.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Array.from(new Set(tools.map(tool => tool.category)))];
  const upgradesAvailable = tools.filter(tool => tool.currentVersion !== tool.latestVersion).length;
  const criticalUpgrades = tools.filter(tool =>
    tool.currentVersion !== tool.latestVersion && tool.upgradeComplexity === 'Critical'
  ).length;
  const totalTools = tools.length;
  const upToDate = totalTools - upgradesAvailable;
  const activeUpgrades = upgradeInProgress.size;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with System Health */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Tool Upgrade Manager</h1>
              <p className="text-gray-600">Manage and track upgrades for your development tools while preserving existing data</p>
            </div>

            {systemHealth && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-gray-600">
                    CPU: {systemHealth.cpu}% | Memory: {systemHealth.memory}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="mb-6 space-y-2">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border-l-4 ${
                  notification.type === 'success' ? 'bg-green-50 border-green-400 text-green-700' :
                  notification.type === 'error' ? 'bg-red-50 border-red-400 text-red-700' :
                  'bg-blue-50 border-blue-400 text-blue-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <p className="text-sm">{notification.message}</p>
                  <button
                    onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                    className="text-gray-400 hover:text-gray-600 ml-4"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tools</p>
                <p className="text-2xl font-bold text-gray-900">{totalTools}</p>
              </div>
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Up to Date</p>
                <p className="text-2xl font-bold text-green-600">{upToDate}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Updates Available</p>
                <p className="text-2xl font-bold text-yellow-600">{upgradesAvailable}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Updates</p>
                <p className="text-2xl font-bold text-red-600">{criticalUpgrades}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Upgrades</p>
                <p className="text-2xl font-bold text-purple-600">{activeUpgrades}</p>
              </div>
              <Server className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Service Status Panel */}
        {systemHealth && Object.keys(systemHealth.services).length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(systemHealth.services).map(([serviceName, status]) => (
                <div key={serviceName} className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    status === 'running' ? 'bg-green-500' :
                    status === 'stopped' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-sm text-gray-700">{serviceName}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    status === 'running' ? 'bg-green-100 text-green-800' :
                    status === 'stopped' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onUpgrade={() => handleUpgradeStart(tool)}
              onViewDetails={setDetailsTool}
              isUpgrading={upgradeInProgress.has(tool.id)}
            />
          ))}
        </div>

        {filteredTools.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tools found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTool && (
        <UpgradeModal
          tool={selectedTool}
          onClose={() => setSelectedTool(null)}
          onUpgrade={() => handleUpgradeStart(selectedTool)}
        />
      )}

      {detailsTool && (
        <ToolDetailsModal
          tool={detailsTool}
          onClose={() => setDetailsTool(null)}
          onUpgrade={() => {
            handleUpgradeStart(detailsTool);
            setDetailsTool(null);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
