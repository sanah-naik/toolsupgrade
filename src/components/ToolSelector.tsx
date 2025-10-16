import React from 'react';
import { Tool } from '../types';
import { supportedTools } from '../data/supportedTools';
import { Plus, Search } from 'lucide-react';

interface ToolSelectorProps {
  onSelectTool: (tool: Tool) => void;
}

const ToolSelector: React.FC<ToolSelectorProps> = ({ onSelectTool }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredTools = supportedTools.filter(tool =>
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = Array.from(new Set(supportedTools.map(tool => tool.category)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Tool Upgrade Manager
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Safely upgrade your development tools while preserving all existing data, configurations, and deployments
          </p>
        </div>

        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-8">
          {categories.map(category => {
            const categoryTools = filteredTools.filter(tool => tool.category === category);
            if (categoryTools.length === 0) return null;

            return (
              <div key={category}>
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryTools.map(tool => (
                    <div
                      key={tool.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
                      onClick={() => onSelectTool(tool)}
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-3xl">{tool.icon}</div>
                          <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {tool.name}
                        </h3>
                        
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {tool.description}
                        </p>
                        
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500">
                            <span className="font-medium">Supported formats:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tool.supportedExtensions.map(ext => (
                                <span key={ext} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                  {ext}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {filteredTools.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tools found</h3>
            <p className="text-gray-600">Try adjusting your search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolSelector;