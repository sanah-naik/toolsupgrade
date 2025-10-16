import { Tool, UpgradeConfig, UpgradeSession, UpgradeStep } from '../types';

export class UpgradeService {
  private static instance: UpgradeService;
  private sessions: Map<string, UpgradeSession> = new Map();

  static getInstance(): UpgradeService {
    if (!UpgradeService.instance) {
      UpgradeService.instance = new UpgradeService();
    }
    return UpgradeService.instance;
  }

  createUpgradeSession(tool: Tool, config: UpgradeConfig): UpgradeSession {
    const sessionId = `upgrade-${Date.now()}`;
    
    const steps: UpgradeStep[] = [
      {
        id: 'validate',
        title: 'Validate Environment',
        description: 'Checking system requirements and existing installation',
        status: 'pending',
        progress: 0,
        logs: [],
        critical: true
      },
      {
        id: 'backup',
        title: 'Create Backup',
        description: 'Creating complete backup of existing installation',
        status: 'pending',
        progress: 0,
        logs: [],
        critical: true
      },
      {
        id: 'stop-service',
        title: 'Stop Services',
        description: 'Stopping running services safely',
        status: 'pending',
        progress: 0,
        logs: [],
        critical: true
      },
      {
        id: 'extract',
        title: 'Extract New Version',
        description: 'Extracting and preparing new version files',
        status: 'pending',
        progress: 0,
        logs: [],
        critical: false
      },
      {
        id: 'migrate-config',
        title: 'Migrate Configuration',
        description: 'Transferring existing configurations to new version',
        status: 'pending',
        progress: 0,
        logs: [],
        critical: true
      },
      {
        id: 'migrate-data',
        title: 'Migrate Data',
        description: 'Transferring application data and deployments',
        status: 'pending',
        progress: 0,
        logs: [],
        critical: true
      },
      {
        id: 'update-permissions',
        title: 'Update Permissions',
        description: 'Setting correct file permissions and ownership',
        status: 'pending',
        progress: 0,
        logs: [],
        critical: false
      },
      {
        id: 'verify',
        title: 'Verify Installation',
        description: 'Verifying new installation integrity',
        status: 'pending',
        progress: 0,
        logs: [],
        critical: true
      },
      {
        id: 'start-service',
        title: 'Start Services',
        description: 'Starting upgraded services',
        status: 'pending',
        progress: 0,
        logs: [],
        critical: config.autoStart
      }
    ];

    const session: UpgradeSession = {
      id: sessionId,
      tool,
      config,
      steps,
      status: 'configuring',
      startTime: new Date()
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async startUpgrade(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'running';
    
    // Execute upgrade steps sequentially
    for (const step of session.steps) {
      try {
        await this.executeStep(session, step);
        if (step.status === 'failed') {
          session.status = 'failed';
          return;
        }
      } catch (error) {
        step.status = 'failed';
        step.logs.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        session.status = 'failed';
        return;
      }
    }

    session.status = 'completed';
    session.endTime = new Date();
  }

  private async executeStep(session: UpgradeSession, step: UpgradeStep): Promise<void> {
    step.status = 'running';
    step.logs.push(`Starting ${step.title}...`);

    // Simulate step execution with progress updates
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        step.progress += Math.random() * 20;
        
        if (step.progress >= 100) {
          step.progress = 100;
          step.status = 'completed';
          step.logs.push(`${step.title} completed successfully`);
          clearInterval(interval);
          resolve();
        } else {
          // Add realistic log messages based on step type
          this.addStepLog(session, step);
        }
      }, 500 + Math.random() * 1000); // Random delay between 500-1500ms
    });
  }

  private addStepLog(session: UpgradeSession, step: UpgradeStep): void {
    const { tool, config } = session;
    
    switch (step.id) {
      case 'validate':
        const validateLogs = [
          `Checking ${tool.name} installation at ${config.existingPath}`,
          'Verifying system requirements...',
          'Checking available disk space...',
          'Validating file permissions...'
        ];
        step.logs.push(validateLogs[Math.floor(Math.random() * validateLogs.length)]);
        break;
        
      case 'backup':
        const backupLogs = [
          `Creating backup directory: ${config.backupPath}`,
          'Backing up configuration files...',
          'Backing up application data...',
          'Compressing backup archive...'
        ];
        step.logs.push(backupLogs[Math.floor(Math.random() * backupLogs.length)]);
        break;
        
      case 'stop-service':
        const stopLogs = [
          `Stopping ${tool.name} service...`,
          'Waiting for graceful shutdown...',
          'Verifying service stopped...'
        ];
        step.logs.push(stopLogs[Math.floor(Math.random() * stopLogs.length)]);
        break;
        
      case 'extract':
        const extractLogs = [
          `Extracting ${config.newToolZip?.name}...`,
          'Verifying archive integrity...',
          'Extracting files to temporary location...',
          'Validating extracted files...'
        ];
        step.logs.push(extractLogs[Math.floor(Math.random() * extractLogs.length)]);
        break;
        
      case 'migrate-config':
        const configLogs = [
          'Analyzing existing configuration files...',
          'Merging configuration settings...',
          'Updating configuration for new version...',
          'Validating configuration syntax...'
        ];
        step.logs.push(configLogs[Math.floor(Math.random() * configLogs.length)]);
        break;
        
      case 'migrate-data':
        const dataLogs = [
          'Transferring application deployments...',
          'Migrating user data...',
          'Updating data file formats...',
          'Verifying data integrity...'
        ];
        step.logs.push(dataLogs[Math.floor(Math.random() * dataLogs.length)]);
        break;
        
      case 'update-permissions':
        const permLogs = [
          'Setting file ownership...',
          'Updating directory permissions...',
          'Configuring security policies...'
        ];
        step.logs.push(permLogs[Math.floor(Math.random() * permLogs.length)]);
        break;
        
      case 'verify':
        const verifyLogs = [
          'Running installation verification...',
          'Checking file integrity...',
          'Validating configuration...',
          'Testing basic functionality...'
        ];
        step.logs.push(verifyLogs[Math.floor(Math.random() * verifyLogs.length)]);
        break;
        
      case 'start-service':
        const startLogs = [
          `Starting ${tool.name} service...`,
          'Waiting for service initialization...',
          'Verifying service health...',
          'Service started successfully'
        ];
        step.logs.push(startLogs[Math.floor(Math.random() * startLogs.length)]);
        break;
    }
  }

  getSession(sessionId: string): UpgradeSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): UpgradeSession[] {
    return Array.from(this.sessions.values());
  }
}