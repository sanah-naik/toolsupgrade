export interface Tool {
  id: string;
  name: string;
  category: 'Application Server' | 'Runtime' | 'Database' | 'Web Server' | 'Development Tool';
  currentVersion?: string;
  latestVersion?: string;
  icon: string;
  description: string;
  supportedExtensions: string[];
  configFiles: string[];
  dataDirectories: string[];
  serviceNames: string[];
}

export interface UpgradeConfig {
  toolId: string;
  existingPath: string;
  newToolZip: File | null;
  backupPath: string;
  preserveConfig: boolean;
  preserveData: boolean;
  autoStart: boolean;
}

export interface UpgradeStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  critical: boolean;
}

export interface UpgradeSession {
  id: string;
  tool: Tool;
  config: UpgradeConfig;
  steps: UpgradeStep[];
  status: 'configuring' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
}