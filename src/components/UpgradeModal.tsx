import React, { useState } from 'react';
import { Tool, UpgradeStep } from '../types';
import { X, AlertTriangle, Shield, Database, CheckCircle, Clock, FileText } from 'lucide-react';

interface UpgradeModalProps {
  tool: Tool;
  onClose: () => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ tool, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'backup'>('overview');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const upgradeSteps: UpgradeStep[] = [
    {
      id: 'backup',
      title: 'Create Full System Backup',
      description: 'Backup all configuration files, data directories, and application deployments',
      type: 'backup',
      critical: true,
      estimatedTime: '15-30 minutes',
      commands: [
        'sudo systemctl stop ' + tool.name.toLowerCase(),
        'tar -czf backup-$(date +%Y%m%d).tar.gz /opt/' + tool.name.toLowerCase(),
        'cp -r /etc/' + tool.name.toLowerCase() + ' /backup/config/'
      ]
    },
    {
      id: 'prep',
      title: 'Prepare Environment',
      description: 'Verify system requirements and prepare upgrade environment',
      type: 'preparation',
      critical: true,
      estimatedTime: '10 minutes',
      commands: [
        'java -version',
        'df -h',
        'systemctl status ' + tool.name.toLowerCase()
      ]
    },
    {
      id: 'download',
      title: 'Download New Version',
      description: 'Download and verify the new version package',
      type: 'preparation',
      critical: false,
      estimatedTime: '5 minutes'
    },
    {
      id: 'upgrade',
      title: 'Execute Upgrade',
      description: 'Install the new version and migrate configurations',
      type: 'execution',
      critical: true,
      estimatedTime: tool.estimatedDowntime
    },
    {
      id: 'migrate',
      title: 'Migrate Data & Configuration',
      description: 'Transfer existing data and update configuration files',
      type: 'execution',
      critical: true,
      estimatedTime: '20 minutes'
    },
    {
      id: 'verify',
      title: 'Verify Installation',
      description: 'Test the upgraded installation and verify all services',
      type: 'verification',
      critical: true,
      estimatedTime: '15 minutes'
    }
  ];

  const toggleStepComplete = (stepId: string) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId);
    } else {
      newCompleted.add(stepId);
    }
    setCompletedSteps(newCompleted);
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'backup': return <Shield className="w-4 h-4" />;
      case 'preparation': return <FileText className="w-4 h-4" />;
      case 'execution': return <Database className="w-4 h-4" />;
      case 'verification': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{tool.icon}</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Upgrade {tool.name}
              </h2>
              <p className="text-sm text-gray-600">
                From {tool.currentVersion} to {tool.latestVersion}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex border-b border-gray-200">
          {['overview', 'steps', 'backup'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {activeTab === 'overview' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Data Preservation</h3>
                    <p className="text-sm text-gray-600">{tool.dataPreservation}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Estimated Downtime</h3>
                    <p className="text-sm text-gray-600">{tool.estimatedDowntime}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Dependencies</h3>
                    <div className="space-y-1">
                      {tool.dependencies.map((dep, index) => (
                        <span key={index} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mr-1">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Backup Required</h3>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      tool.backupRequired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {tool.backupRequired ? 'Yes' : 'No'}
                    </span>
                  </div>
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
            </div>
          )}

          {activeTab === 'steps' && (
            <div className="p-6">
              <div className="space-y-4">
                {upgradeSteps.map((step, index) => (
                  <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            {getStepIcon(step.type)}
                            <h4 className="font-medium text-gray-900">{step.title}</h4>
                            {step.critical && (
                              <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                Critical
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>⏱️ {step.estimatedTime}</span>
                            <span className="capitalize">📋 {step.type}</span>
                          </div>
                          {step.commands && (
                            <div className="mt-3 bg-gray-900 text-green-400 p-3 rounded text-sm font-mono">
                              {step.commands.map((cmd, cmdIndex) => (
                                <div key={cmdIndex}>$ {cmd}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleStepComplete(step.id)}
                        className={`ml-4 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors ${
                          completedSteps.has(step.id)
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-green-500'
                        }`}
                      >
                        {completedSteps.has(step.id) && <CheckCircle className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-medium text-yellow-800">Critical: Always Backup Before Upgrading</h3>
                </div>
                <p className="text-sm text-yellow-700">
                  Create comprehensive backups of all data, configurations, and applications before proceeding with any upgrade.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Essential Backup Items</h3>
                  <div className="space-y-2">
                    {[
                      'Configuration files (/etc/' + tool.name.toLowerCase() + '/)',
                      'Application deployments and WAR files',
                      'Database dumps (if applicable)',
                      'SSL certificates and keystores',
                      'Custom libraries and modules',
                      'Log files for reference',
                      'Environment variables and startup scripts'
                    ].map((item, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Backup Commands</h3>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                    <div># Create timestamped backup directory</div>
                    <div>sudo mkdir -p /backup/$(date +%Y%m%d)</div>
                    <div className="mt-2"># Stop services</div>
                    <div>sudo systemctl stop {tool.name.toLowerCase()}</div>
                    <div className="mt-2"># Backup configuration</div>
                    <div>sudo tar -czf /backup/$(date +%Y%m%d)/{tool.name.toLowerCase()}-config.tar.gz /etc/{tool.name.toLowerCase()}/</div>
                    <div className="mt-2"># Backup application data</div>
                    <div>sudo tar -czf /backup/$(date +%Y%m%d)/{tool.name.toLowerCase()}-data.tar.gz /opt/{tool.name.toLowerCase()}/</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Rollback Plan</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800 mb-2">
                      If the upgrade fails, follow these steps to rollback:
                    </p>
                    <ol className="text-sm text-red-700 space-y-1 ml-4">
                      <li>1. Stop the new version service</li>
                      <li>2. Restore configuration files from backup</li>
                      <li>3. Reinstall previous version</li>
                      <li>4. Restore application data</li>
                      <li>5. Start services and verify functionality</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
            Start Upgrade Process
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;