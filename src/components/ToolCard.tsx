import React from 'react';
import { Tool } from '../types';
import { Calendar, Clock, AlertTriangle, Shield, Database } from 'lucide-react';

interface ToolCardProps {
  tool: Tool;
  onUpgrade: (tool: Tool) => void;
  onViewDetails: (tool: Tool) => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onUpgrade, onViewDetails }) => {
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Low': return 'text-green-600 bg-green-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'High': return 'text-orange-600 bg-orange-50';
      case 'Critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Database': return <Database className="w-4 h-4" />;
      case 'Web Server': return <Shield className="w-4 h-4" />;
      default: return null;
    }
  };

  const isUpgradeAvailable = tool.currentVersion !== tool.latestVersion;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:-translate-y-1">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{tool.icon}</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{tool.name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                {getCategoryIcon(tool.category)}
                <span className="text-sm text-gray-600">{tool.category}</span>
              </div>
            </div>
          </div>
          {isUpgradeAvailable && (
            <div className="flex items-center space-x-1 text-blue-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">Update Available</span>
            </div>
          )}
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{tool.description}</p>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Current Version:</span>
            <span className="text-sm font-medium text-gray-900">{tool.currentVersion}</span>
          </div>
          
          {isUpgradeAvailable && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Latest Version:</span>
              <span className="text-sm font-medium text-blue-600">{tool.latestVersion}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Complexity:</span>
            <span className={`text-xs font-medium px-2 py-1 rounded ${getComplexityColor(tool.upgradeComplexity)}`}>
              {tool.upgradeComplexity}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{tool.estimatedDowntime}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3" />
            <span>{new Date(tool.releaseDate).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => onViewDetails(tool)}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-150"
          >
            View Details
          </button>
          {isUpgradeAvailable && (
            <button
              onClick={() => onUpgrade(tool)}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-150"
            >
              Plan Upgrade
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolCard;