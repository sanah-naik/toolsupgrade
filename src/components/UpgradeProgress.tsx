import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle, Terminal, Download, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const UPGRADE_PHASES = [
  {
    id: 'phase0',
    title: 'Access Test',
    description: 'Testing target directory access permissions',
    keywords: ['PHASE 0', 'Testing target directory access', 'Path is accessible']
  },
  {
    id: 'phase1',
    title: 'Backup Creation',
    description: 'Creating backup of existing installation',
    keywords: ['PHASE 1', 'STARTING BACKUP PROCESS', 'Backup completed successfully']
  },
  {
    id: 'phase2',
    title: 'Archive Extraction',
    description: 'Extracting new version from archive',
    keywords: ['PHASE 2', 'STARTING ARCHIVE EXTRACTION', 'Archive extracted successfully']
  },
  {
    id: 'phase3',
    title: 'Configuration Preservation',
    description: 'Preserving configurations and data from old installation',
    keywords: ['PHASE 3', 'COMPREHENSIVE', 'PRESERVATION SUMMARY']
  },
  {
    id: 'phase4',
    title: 'Robocopy Upgrade',
    description: 'Performing in-place upgrade using Robocopy',
    keywords: ['PHASE 4', 'Robocopy-based', 'ROBOCOPY UPGRADE COMPLETED']
  },
  {
    id: 'phase5',
    title: 'Backup Compression',
    description: 'Compressing backup to ZIP file',
    keywords: ['PHASE 5', 'Compressing backup', 'Backup preserved as']
  },
  {
    id: 'phase6',
    title: 'Cleanup',
    description: 'Cleaning up temporary files',
    keywords: ['PHASE 6', 'Final cleanup', 'Uploaded archive removed']
  },
  {
    id: 'rollback',
    title: 'Rollback',
    description: 'Rolling back to previous version after error',
    keywords: ['ROLLBACK', 'INITIATING ROBOCOPY ROLLBACK', 'Successfully restored']
  }
];

const UpgradeProgress = ({ upgradeConfig, onBack, onComplete }) => {
  const [phases, setPhases] = useState(
    UPGRADE_PHASES.map(phase => ({
      ...phase,
      status: 'pending',
      progress: 0,
      logs: []
    }))
  );
  const [allLogs, setAllLogs] = useState([]);
  const [expandedPhase, setExpandedPhase] = useState(null);
  const [upgradeStatus, setUpgradeStatus] = useState('running');
  const [startTime] = useState(new Date());
  const [endTime, setEndTime] = useState(null);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const logContainerRef = useRef(null);
  const eventSourceRef = useRef(null);

  const tool = upgradeConfig.tool || { name: 'Tool', icon: '🔧' };

  useEffect(() => {
    startUpgrade();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startUpgrade = async () => {
    const { sessionId, formData } = upgradeConfig;

    const eventSource = new EventSource(`http://localhost:4000/api/upgrade-stream/${sessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      console.log('SSE message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.complete) {
          console.log('Upgrade complete message received:', data);
          eventSource.close();
          setUpgradeStatus(data.success ? 'completed' : 'failed');
          setEndTime(new Date());
          setDuration(data.duration);
          if (!data.success) {
            setErrorMessage(data.error || 'Upgrade failed');
          }
        } else if (data.log) {
          setAllLogs(prev => [...prev, data.log]);
          updatePhaseStatus(data.log);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      eventSource.close();
    };

    try {
      const response = await fetch('http://localhost:4000/api/upgrade', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!result.success && upgradeStatus === 'running') {
        setUpgradeStatus('failed');
        setEndTime(new Date());
        setErrorMessage(result.error || 'Upgrade failed');
      }
    } catch (error) {
      console.error('Upgrade API error:', error);
      setUpgradeStatus('failed');
      setEndTime(new Date());
      setErrorMessage(error.message);
    }
  };

  const updatePhaseStatus = (log) => {
    setPhases(prev => {
      const updated = [...prev];

      if (log.includes('[ROLLBACK]') || log.includes('INITIATING ROBOCOPY ROLLBACK')) {
        setErrorMessage(prev => prev + '\n\nROLLBACK IN PROGRESS...');
      }

      if (log.includes('[ROLLBACK]') && log.includes('Successfully restored')) {
        setErrorMessage(prev => prev + '\n\n✓ ROLLBACK SUCCESSFUL: Your original installation has been restored.');
      }

      if (log.includes('ROBOCOPY UPGRADE COMPLETED SUCCESSFULLY') ||
          log.includes('UPGRADE COMPLETED SUCCESSFULLY')) {
        updated.forEach((phase, idx) => {
          if (phase.status === 'running' || phase.status === 'pending') {
            updated[idx].status = 'completed';
            updated[idx].progress = 100;
          }
        });
        return updated;
      }

      if (log.includes('[ERROR]') || log.includes('ERROR in')) {
        for (let i = 0; i < updated.length; i++) {
          const phase = updated[i];
          const isRelevant = phase.keywords.some(keyword =>
            log.toUpperCase().includes(keyword.toUpperCase())
          );

          if (isRelevant && (phase.status === 'running' || phase.status === 'pending')) {
            updated[i].status = 'error';
            updated[i].logs.push(log);
            return updated;
          }
        }

        for (let i = 0; i < updated.length; i++) {
          if (updated[i].status === 'running') {
            updated[i].status = 'error';
            updated[i].logs.push(log);
            return updated;
          }
        }
      }

      for (let i = 0; i < updated.length; i++) {
        const phase = updated[i];
        const isRelevant = phase.keywords.some(keyword =>
          log.toUpperCase().includes(keyword.toUpperCase())
        );

        if (isRelevant) {
          updated[i].logs.push(log);

          if (phase.id === 'rollback') {
            updated[i].status = 'running';

            if (log.includes('Successfully restored')) {
              updated[i].status = 'completed';
              updated[i].progress = 100;
            }
            break;
          }

          if (phase.status === 'pending') {
            updated[i].status = 'running';
            for (let j = 0; j < i; j++) {
              if (updated[j].status === 'running') {
                updated[j].status = 'completed';
                updated[j].progress = 100;
              }
            }
          }

          const completionKeywords = ['completed successfully', 'successfully', '✓✓✓', 'SUMMARY', 'Uploaded archive removed'];
          if (completionKeywords.some(kw => log.toUpperCase().includes(kw.toUpperCase()))) {
            updated[i].status = 'completed';
            updated[i].progress = 100;
          } else if (updated[i].status === 'running') {
            updated[i].progress = Math.min(updated[i].progress + 20, 90);
          }
          break;
        }
      }
      return updated;
    });
  };

  const getPhaseIcon = (phase) => {
    switch (phase.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

// REPLACE generatePDFReport function in UpgradeProgress.tsx (around line 120) with:

const generatePDFReport = () => {
  try {
    const doc = new jsPDF();
    let yPos = 20;

    // Header with logo/icon
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text(`${tool.name} Upgrade Report`, 20, 20);
    
    // Reset color
    doc.setTextColor(0, 0, 0);
    yPos = 40;

    // Executive Summary Box
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(15, yPos, 180, 50, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Executive Summary', 20, yPos + 10);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Start Time: ${startTime.toLocaleString()}`, 20, yPos + 20);
    if (endTime) {
      doc.text(`End Time: ${endTime.toLocaleString()}`, 20, yPos + 28);
      doc.text(`Total Duration: ${Math.round((endTime - startTime) / 1000 / 60)} minutes`, 20, yPos + 36);
    }
    
    // Status badge
    const statusColor = upgradeStatus === 'completed' ? [34, 197, 94] : 
                       upgradeStatus === 'failed' ? [239, 68, 68] : [59, 130, 246];
    doc.setFillColor(...statusColor);
    doc.roundedRect(140, yPos + 18, 40, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(upgradeStatus.toUpperCase(), 145, yPos + 24);
    doc.setTextColor(0, 0, 0);
    
    yPos += 60;

    // Configuration Details
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Configuration Details', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const configDetails = [
      ['Existing Path:', upgradeConfig.existingPath],
      ['Archive:', upgradeConfig.newToolZip?.name || 'N/A'],
      ['Backup Path:', upgradeConfig.backupPath],
      ['Preserve Config:', upgradeConfig.preserveConfig ? 'Yes' : 'No'],
      ['Preserve Data:', upgradeConfig.preserveData ? 'Yes' : 'No'],
      ['Auto Start:', upgradeConfig.autoStart ? 'Yes' : 'No']
    ];
    
    if (upgradeConfig.certFolderPath) {
      configDetails.push(['Certificate Path:', upgradeConfig.certFolderPath]);
    }
    
    autoTable(doc, {
      body: configDetails,
      startY: yPos,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 130 }
      }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;

    // Phase Summary with visual indicators
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Upgrade Phases', 20, yPos);
    yPos += 10;
    
    const phaseData = phases.map(phase => {
      const statusIcon = phase.status === 'completed' ? '✓' :
                        phase.status === 'running' ? '⟳' :
                        phase.status === 'error' ? '✗' : '○';
      return [
        statusIcon,
        phase.title,
        phase.status.toUpperCase(),
        `${phase.progress}%`,
        `${phase.logs.length} logs`
      ];
    });

    autoTable(doc, {
      head: [['', 'Phase', 'Status', 'Progress', 'Logs']],
      body: phaseData,
      startY: yPos,
      theme: 'striped',
      headStyles: { 
        fillColor: [59, 130, 246],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 0) {
          const status = phases[data.row.index].status;
          data.cell.styles.textColor = status === 'completed' ? [34, 197, 94] :
                                      status === 'error' ? [239, 68, 68] :
                                      status === 'running' ? [59, 130, 246] : [156, 163, 175];
        }
      }
    });

    // Detailed Logs Section
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Detailed Execution Logs', 20, yPos);
    yPos += 15;

    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    
    allLogs.forEach((log, index) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }

      // Color code log lines
      let logColor = [0, 0, 0]; // default black
      if (log.includes('[ERROR]')) logColor = [239, 68, 68];
      else if (log.includes('[WARNING]')) logColor = [234, 179, 8];
      else if (log.includes('✓')) logColor = [34, 197, 94];
      else if (log.includes('[INFO]')) logColor = [59, 130, 246];
      
      doc.setTextColor(...logColor);
      
      const cleanLog = log.replace(/\[.*?\]/g, '').trim();
      const lines = doc.splitTextToSize(cleanLog, 170);

      lines.forEach(line => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 20, yPos);
        yPos += 4;
      });
    });

    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(8);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Page ${i} of ${pageCount} | Generated: ${new Date().toLocaleString()}`,
        105,
        290,
        { align: 'center' }
      );
    }

    const fileName = `${tool.name.replace(/\s+/g, '_')}_Upgrade_Report_${new Date().toISOString().split('T')[0]}_${upgradeStatus}.pdf`;
    doc.save(fileName);

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF report. Check console for details.');
  }
};

  const completedPhases = phases.filter(p => p.status === 'completed').length;
  const totalPhases = phases.length;
  const overallProgress = (completedPhases / totalPhases) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
              disabled={upgradeStatus === 'running'}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </button>

            {upgradeStatus !== 'running' && (
              <button
                onClick={generatePDFReport}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </button>
            )}
          </div>

          <div className="flex items-center mb-4">
            <div className="text-4xl mr-4">{tool.icon}</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {tool.name} Upgrade
              </h1>
              <p className="text-sm text-gray-600">
                {upgradeStatus === 'running' ? '⚡ Upgrade in progress...' :
                 upgradeStatus === 'completed' ? '✅ Upgrade completed successfully!' :
                 '❌ Upgrade failed'}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Overall Progress</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {upgradeStatus === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <div>
                  <h3 className="font-medium text-green-800">Upgrade Successful</h3>
                  <p className="text-sm text-green-700">
                    Your {tool.name} installation has been successfully upgraded. All configurations and data have been preserved.
                  </p>
                </div>
              </div>
            </div>
          )}

          {upgradeStatus === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <XCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-red-800">Upgrade Failed</h3>
                  <p className="text-sm text-red-700 mb-2">
                    The upgrade process encountered an error. A rollback was performed to restore your system.
                  </p>
                  {errorMessage && (
                    <div className="text-sm mt-2 space-y-2">
                      {errorMessage.split('\n\n').map((msg, idx) => (
                        <div key={idx} className={`p-2 rounded font-mono ${
                          msg.includes('ROLLBACK SUCCESSFUL')
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : msg.includes('ROLLBACK')
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {msg}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">What happened?</h4>
                    <p className="text-xs text-blue-800">
                      The upgrade failed during configuration preservation. Common causes include:
                    </p>
                    <ul className="text-xs text-blue-800 list-disc list-inside mt-1 space-y-0.5">
                      <li>Files locked by running services (Apache/Tomcat must be stopped)</li>
                      <li>Insufficient permissions to modify files</li>
                      <li>Antivirus blocking file operations</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {phases.map((phase, index) => (
            <div key={phase.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getPhaseIcon(phase)}
                    <div className="ml-3">
                      <h3 className="font-medium text-gray-900">{phase.title}</h3>
                      <p className="text-sm text-gray-600">{phase.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    {phase.status === 'running' && (
                      <div className="flex items-center mr-4">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                    <span className="text-sm text-gray-500 mr-4">
                      {phase.progress}%
                    </span>
                    <Terminal className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {phase.status !== 'pending' && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all duration-300 ${
                          phase.status === 'completed' ? 'bg-green-500' :
                          phase.status === 'running' ? 'bg-blue-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {expandedPhase === phase.id && phase.logs.length > 0 && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="max-h-64 overflow-y-auto">
                    <div className="space-y-1">
                      {phase.logs.map((log, logIndex) => (
                        <div key={logIndex} className="text-xs font-mono text-gray-700 bg-white p-2 rounded border">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Complete Log Output
            </h3>
          </div>
          <div className="p-4">
            <div
              ref={logContainerRef}
              className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm"
            >
              {allLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
              {allLogs.length === 0 && (
                <div className="text-gray-500">Waiting for logs...</div>
              )}
            </div>
          </div>
        </div>

        {upgradeStatus !== 'running' && (
          <div className="mt-6 flex justify-center space-x-4">
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Return to Dashboard
            </button>
            {onComplete && upgradeStatus === 'completed' && (
              <button
                onClick={onComplete}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Complete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpgradeProgress;