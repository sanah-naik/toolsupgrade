import React from 'react';
import { Tool } from '../types';
import { X, ExternalLink, Calendar, Clock, AlertTriangle, Shield } from 'lucide-react';

interface ToolDetailsModalProps {
  tool: Tool;
  onClose: () => void;
  onUpgrade: () => void;
}

const ToolDetailsModal: React.FC<ToolDetailsModalProps> = ({ tool, onClose, onUpgrade }) => {
  const isUpgradeAvailable = tool.currentVersion !== tool.latestVersion;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">{tool.icon}</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{tool.name}</h2>
              <p className="text-sm text-gray-600">{tool.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[70vh]">
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600">{tool.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Current Version</h3>
                  <p className="text-lg font-semibold text-gray-800">{tool.currentVersion}</p>
                </div>

                {isUpgradeAvailable && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Latest Version</h3>
                    <div className="flex items-center space-x-2">
                      <p className="text-lg font-semibold text-blue-600">{tool.latestVersion}</p>
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">New</span>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Release Date</h3>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {new Date(tool.releaseDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Upgrade Complexity</h3>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                    tool.upgradeComplexity === 'Critical' ? 'bg-red-100 text-red-800' :
                    tool.upgradeComplexity === 'High' ? 'bg-orange-100 text-orange-800' :
                    tool.upgradeComplexity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {tool.upgradeComplexity}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Estimated Downtime</h3>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">{tool.estimatedDowntime}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Data Preservation</h3>
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">{tool.dataPreservation}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Dependencies</h3>
              <div className="flex flex-wrap gap-2">
                {tool.dependencies.map((dep, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {dep}
                  </span>
                ))}
                {tool.dependencies.length === 0 && (
                  <span className="text-sm text-gray-500 italic">No dependencies</span>
                )}
              </div>
            </div>

            {tool.breakingChanges.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h3 className="text-sm font-medium text-gray-900">Breaking Changes</h3>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <ul className="space-y-2">
                    {tool.breakingChanges.map((change, index) => (
                      <li key={index} className="text-sm text-red-800 flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Backup Recommendation</h3>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${tool.backupRequired ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {tool.backupRequired ? 'Full backup required before upgrade' : 'Backup recommended but not critical'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          {isUpgradeAvailable && (
            <button
              onClick={onUpgrade}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Plan Upgrade
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolDetailsModal;