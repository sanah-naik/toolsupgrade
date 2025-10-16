import React, { useState, useRef } from 'react';
import { ArrowLeft, Folder, Upload, Settings, Play, Shield, Key } from 'lucide-react';

const UpgradeWizard = ({ tool, onBack, onStartUpgrade }) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    toolId: tool?.id || '',
    existingPath: '',
    newToolZip: null,
    backupPath: '',
    preserveConfig: true,
    preserveData: true,
    autoStart: false,
    // JDK-specific fields
    certFolderPath: '',
    keystorePassword: 'changeit' // Default Java keystore password
  });

  // Safety check
  if (!tool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No tool selected</p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Tools
          </button>
        </div>
      </div>
    );
  }

  const fileInputRef = useRef(null);
  const isJDK = tool.id.toLowerCase().includes('jdk') || tool.id.toLowerCase().includes('java');

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (tool.supportedExtensions?.includes(extension) ||
          (extension === '.gz' && file.name.endsWith('.tar.gz'))) {
        setConfig(prev => ({ ...prev, newToolZip: file }));
      } else {
        alert(`Unsupported file format. Please select: ${tool.supportedExtensions?.join(', ')}`);
      }
    }
  };

  // Dynamic steps based on tool type
  const baseSteps = [
    { number: 1, title: 'Locate Existing Installation', icon: <Folder className="w-5 h-5" /> },
    { number: 2, title: 'Upload New Version', icon: <Upload className="w-5 h-5" /> }
  ];

  const jdkCertStep = { number: 3, title: 'Certificate Import', icon: <Key className="w-5 h-5" /> };
  const configStep = { number: isJDK ? 4 : 3, title: 'Configure Upgrade', icon: <Settings className="w-5 h-5" /> };
  const reviewStep = { number: isJDK ? 5 : 4, title: 'Review & Execute', icon: <Play className="w-5 h-5" /> };

  const steps = isJDK
    ? [...baseSteps, jdkCertStep, configStep, reviewStep]
    : [...baseSteps, configStep, reviewStep];

  const maxStep = steps[steps.length - 1].number;

  const canProceed = () => {
    switch (step) {
      case 1: return config.existingPath.length > 0;
      case 2: return config.newToolZip !== null;
      case 3:
        if (isJDK) {
          // Certificate step - optional, can skip
          return true;
        } else {
          // Config step for non-JDK
          return config.backupPath.length > 0;
        }
      case 4:
        if (isJDK) {
          // Config step for JDK
          return config.backupPath.length > 0;
        } else {
          // Review step for non-JDK
          return true;
        }
      case 5: return true; // Review step for JDK
      default: return false;
    }
  };

  const handleStartUpgrade = async () => {
    const sessionId = `upgrade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const formData = new FormData();
    formData.append(
      'config',
      JSON.stringify({
        toolType: tool.internalName || tool.name.toLowerCase(),
        existingPath: config.existingPath,
        backupPath: config.backupPath,
        preserveConfig: config.preserveConfig,
        preserveData: config.preserveData,
        autoStart: config.autoStart,
        sessionId: sessionId,
        // JDK-specific
        certFolderPath: config.certFolderPath,
        keystorePassword: config.keystorePassword
      })
    );
    formData.append('newArchive', config.newToolZip);

    onStartUpgrade({
      ...config,
      sessionId,
      formData,
      tool
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Tools</span>
          </button>
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{tool.icon || '🔧'}</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tool.name} Upgrade</h1>
              <p className="text-gray-600">{tool.description}</p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center justify-between min-w-max">
            {steps.map((s, index) => (
              <div key={s.number} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  step >= s.number
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-400'
                }`}>
                  {step > s.number ? '✓' : s.icon}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={`text-sm font-medium ${step >= s.number ? 'text-blue-600' : 'text-gray-400'}`}>
                    Step {s.number}
                  </p>
                  <p className={`text-xs ${step >= s.number ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`hidden sm:block w-16 h-0.5 ml-6 ${
                    step > s.number ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* STEP 1: Locate Installation */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Locate Your Existing {tool.name} Installation
              </h2>
              <p className="text-gray-600 mb-6">
                Please enter the full path where {tool.name} is currently installed.
                We'll analyze the installation and preserve your configurations.
              </p>
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Shield className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      ⚠️ Critical: Stop all {tool.name} services before upgrading!
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      The upgrade will automatically attempt to stop services, but manual verification is recommended.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Installation Directory
                  </label>
                  <input
                    type="text"
                    value={config.existingPath}
                    onChange={(e) => setConfig(prev => ({ ...prev, existingPath: e.target.value }))}
                    placeholder="e.g., D:\Apps\Apache24 or /opt/tomcat"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {config.existingPath && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-medium text-green-800 mb-2">Expected Configuration Files:</h3>
                    <ul className="text-sm text-green-700 space-y-1">
                      {tool.configFiles?.map(file => (
                        <li key={file} className="flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          <span>{file}</span>
                        </li>
                      )) || <li>Configuration files will be preserved</li>}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Upload New Version */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload New {tool.name} Version
              </h2>
              <p className="text-gray-600 mb-6">
                Select the zip or archive file containing the new version of {tool.name} that you want to upgrade to.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Version Archive
                  </label>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {config.newToolZip ? (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 text-green-600 mx-auto" />
                        <p className="text-lg font-medium text-gray-900">{config.newToolZip.name}</p>
                        <p className="text-sm text-gray-600">
                          {(config.newToolZip.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button className="text-blue-600 hover:text-blue-700 text-sm">
                          Click to change file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                        <p className="text-lg font-medium text-gray-900">
                          Drop your file here or click to browse
                        </p>
                        <p className="text-sm text-gray-600">
                          Supported formats: {tool.supportedExtensions?.join(', ') || '.zip, .tar.gz, .tar'}
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept=".zip,.tar,.tar.gz,.tgz"
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: JDK Certificate Import (Only for JDK) */}
          {step === 3 && isJDK && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                <Key className="inline w-6 h-6 mr-2" />
                Certificate Import (Optional)
              </h2>
              <p className="text-gray-600 mb-6">
                If you have custom SSL certificates or CA certificates to import into the new JDK,
                provide the folder path containing your certificate files (.crt, .cer, .pem, .p12, .pfx).
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-800 mb-2">ℹ️ Certificate Import Information</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Supported formats: .crt, .cer, .pem (X.509) and .p12, .pfx (PKCS12)</li>
                  <li>• All certificates in the folder will be imported to the JDK cacerts keystore</li>
                  <li>• This step is optional - skip if you don't have custom certificates</li>
                  <li>• The default keystore password is "changeit" (can be changed below)</li>
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certificate Folder Path (Optional)
                  </label>
                  <input
                    type="text"
                    value={config.certFolderPath}
                    onChange={(e) => setConfig(prev => ({ ...prev, certFolderPath: e.target.value }))}
                    placeholder="e.g., D:\Certificates or /opt/certs"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to skip certificate import
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keystore Password
                  </label>
                  <input
                    type="password"
                    value={config.keystorePassword}
                    onChange={(e) => setConfig(prev => ({ ...prev, keystorePassword: e.target.value }))}
                    placeholder="changeit"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default Java keystore password is "changeit"
                  </p>
                </div>

                {config.certFolderPath && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-medium text-yellow-800 mb-2">⚠️ Important Notes</h3>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Ensure the certificate folder exists and is accessible</li>
                      <li>• For PKCS12 files (.p12, .pfx), the same password will be used</li>
                      <li>• Certificate import happens after the JDK files are upgraded</li>
                      <li>• A backup of the original cacerts will be created</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3/4: Configure Upgrade (depends on tool type) */}
          {((step === 3 && !isJDK) || (step === 4 && isJDK)) && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Configure Upgrade Options
              </h2>
              <p className="text-gray-600 mb-6">
                Set your preferences for data preservation, backup location, and post-upgrade behavior.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Backup Directory
                  </label>
                  <input
                    type="text"
                    value={config.backupPath}
                    onChange={(e) => setConfig(prev => ({ ...prev, backupPath: e.target.value }))}
                    placeholder="e.g., D:\Apps\Backup or /backup/apache"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    A complete backup will be created here before starting the upgrade
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Data Preservation Options</h3>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.preserveConfig}
                      onChange={(e) => setConfig(prev => ({ ...prev, preserveConfig: e.target.checked }))}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Preserve Configuration Files</span>
                      <p className="text-xs text-gray-600">Smart merge: Keep user settings, apply security patches</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.preserveData}
                      onChange={(e) => setConfig(prev => ({ ...prev, preserveData: e.target.checked }))}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Preserve Application Data</span>
                      <p className="text-xs text-gray-600">Keep webapps, deployments, SSL certificates, and user data</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.autoStart}
                      onChange={(e) => setConfig(prev => ({ ...prev, autoStart: e.target.checked }))}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Auto-start Service After Upgrade</span>
                      <p className="text-xs text-gray-600">Automatically start the service when upgrade completes</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4/5: Review & Execute (depends on tool type) */}
          {((step === 4 && !isJDK) || (step === 5 && isJDK)) && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Review Upgrade Configuration
              </h2>
              <p className="text-gray-600 mb-6">
                Please review your settings before starting the upgrade process. This cannot be undone once started.
              </p>

              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Upgrade Summary</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-blue-800"><strong>Tool:</strong> {tool.name}</p>
                      <p className="text-blue-800"><strong>Existing Path:</strong> {config.existingPath}</p>
                      <p className="text-blue-800"><strong>New Version:</strong> {config.newToolZip?.name}</p>
                      <p className="text-blue-800"><strong>Backup Path:</strong> {config.backupPath}</p>
                    </div>
                    <div>
                      <p className="text-blue-800"><strong>Preserve Config:</strong> {config.preserveConfig ? 'Yes ✓' : 'No'}</p>
                      <p className="text-blue-800"><strong>Preserve Data:</strong> {config.preserveData ? 'Yes ✓' : 'No'}</p>
                      <p className="text-blue-800"><strong>Auto-start:</strong> {config.autoStart ? 'Yes ✓' : 'No'}</p>
                      {isJDK && config.certFolderPath && (
                        <p className="text-blue-800"><strong>Certificates:</strong> Will import from {config.certFolderPath}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-900 mb-2">✅ Smart Merge Features</h3>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• User configurations will be intelligently merged</li>
                    <li>• Security patches from new version will be preserved</li>
                    <li>• VAPT hardening will be automatically applied</li>
                    <li>• Services will be automatically stopped before upgrade</li>
                    <li>• Detailed diff reports will be generated for review</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-900 mb-2">⚠️ Important Notes</h3>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• A complete backup will be created before any changes are made</li>
                    <li>• Services will be stopped automatically (manual verification recommended)</li>
                    <li>• You can rollback to the previous version if needed</li>
                    <li>• Monitor the upgrade progress and logs carefully</li>
                    <li>• Review diff reports after upgrade completes</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-6 py-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          {step < maxStep ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartUpgrade}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Start Upgrade</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeWizard;