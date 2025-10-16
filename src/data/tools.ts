import { Tool } from '../types';

export const tools: Tool[] = [
  {
    id: 'apache-tomcat',
    name: 'Apache Tomcat',
    category: 'Application Server',
    currentVersion: '9.0.65',
    latestVersion: '10.1.16',
    releaseDate: '2023-12-15',
    upgradeComplexity: 'Medium',
    dataPreservation: 'Manual',
    icon: '🐱',
    description: 'Java servlet container and web server',
    dependencies: ['JDK', 'Maven'],
    breakingChanges: [
      'Jakarta EE namespace changes',
      'Deprecated APIs removed',
      'Configuration format updates'
    ],
    backupRequired: true,
    estimatedDowntime: '15-30 minutes'
  },
  {
    id: 'openjdk',
    name: 'OpenJDK',
    category: 'Runtime',
    currentVersion: '11.0.19',
    latestVersion: '21.0.1',
    releaseDate: '2023-10-17',
    upgradeComplexity: 'Critical',
    dataPreservation: 'Automatic',
    icon: '☕',
    description: 'Java Development Kit and Runtime',
    dependencies: [],
    breakingChanges: [
      'Module system enforcement',
      'Deprecated APIs removed',
      'Security policy changes',
      'Garbage collector updates'
    ],
    backupRequired: true,
    estimatedDowntime: '30-60 minutes'
  },
  {
    id: 'apache-httpd',
    name: 'Apache HTTP Server',
    category: 'Web Server',
    currentVersion: '2.4.54',
    latestVersion: '2.4.58',
    releaseDate: '2023-10-19',
    upgradeComplexity: 'Low',
    dataPreservation: 'Manual',
    icon: '🌐',
    description: 'Open-source HTTP server',
    dependencies: [],
    breakingChanges: [
      'Module API changes',
      'Configuration directive updates'
    ],
    backupRequired: true,
    estimatedDowntime: '5-15 minutes'
  },
];