// App.tsx - Complete Integration Example
import React, { useState } from 'react';
import UpgradeWizard from './components/UpgradeWizard';
import UpgradeProgress from './components/UpgradeProgress';

const App = () => {
  const [currentView, setCurrentView] = useState('tools'); // 'tools', 'wizard', 'progress'
  const [selectedTool, setSelectedTool] = useState(null);
  const [upgradeConfig, setUpgradeConfig] = useState(null);

  // Example tools data
  const tools = [
    {
      id: 'apache',
      name: 'Apache HTTP Server',
      internalName: 'apache http server',
      icon: '🌐',
      description: 'High-performance HTTP server',
      supportedExtensions: ['.zip', '.tar.gz', '.tar'],
      configFiles: [
        'conf/httpd.conf',
        'conf/SSL/*',
        'conf/extra/*',
        'htdocs/*'
      ]
    },
    {
      id: 'tomee',
      name: 'Apache TomEE',
      internalName: 'tomee',
      icon: '☕',
      description: 'Java EE application server',
      supportedExtensions: ['.zip', '.tar.gz', '.tar'],
      configFiles: [
        'conf/server.xml',
        'conf/tomee.xml',
        'webapps/*'
      ]
    },
    {
      id: 'jdk',
      name: 'Java JDK',
      internalName: 'jdk',
      icon: '♨️',
      description: 'Java Development Kit',
      supportedExtensions: ['.zip', '.tar.gz', '.tar'],
      configFiles: [
        'lib/security/cacerts',
        'lib/ext/*'
      ]
    }
  ];

  const handleSelectTool = (tool) => {
    setSelectedTool(tool);
    setCurrentView('wizard');
  };

  const handleStartUpgrade = (config) => {
    setUpgradeConfig(config);
    setCurrentView('progress');
  };

  const handleComplete = () => {
    setCurrentView('tools');
    setSelectedTool(null);
    setUpgradeConfig(null);
  };

  const handleBack = () => {
    setCurrentView('tools');
    setSelectedTool(null);
    setUpgradeConfig(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'tools' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Tool Upgrade Manager</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map(tool => (
              <div
                key={tool.id}
                onClick={() => handleSelectTool(tool)}
                className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-xl transition-shadow cursor-pointer"
              >
                <div className="text-5xl mb-4">{tool.icon}</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{tool.name}</h2>
                <p className="text-gray-600 mb-4">{tool.description}</p>
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  Start Upgrade
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentView === 'wizard' && selectedTool && (
        <UpgradeWizard
          tool={selectedTool}
          onBack={handleBack}
          onStartUpgrade={handleStartUpgrade}
        />
      )}

      {currentView === 'progress' && upgradeConfig && (
        <UpgradeProgress
          upgradeConfig={upgradeConfig}
          onBack={handleBack}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
};

export default App;