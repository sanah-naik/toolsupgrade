import { Tool } from '../types';

export const supportedTools: Tool[] = [
  {
    id: 'apache-tomcat',
    name: 'Apache Tomcat',
    category: 'Application Server',
    icon: '🐱',
    description: 'Java servlet container and web server',
    supportedExtensions: ['.zip', '.tar.gz'],
    configFiles: ['conf/server.xml', 'conf/web.xml', 'conf/context.xml', 'conf/tomcat-users.xml'],
    dataDirectories: ['webapps', 'work', 'temp', 'logs'],
    serviceNames: ['tomcat', 'tomcat9', 'tomcat10']
  },
  {
    id: 'openjdk',
    name: 'OpenJDK',
    category: 'Runtime',
    icon: '☕',
    description: 'Java Development Kit and Runtime',
    supportedExtensions: ['.zip', '.tar.gz', '.msi', '.pkg'],
    configFiles: ['conf/security/java.policy', 'conf/security/java.security'],
    dataDirectories: ['lib/security/cacerts'],
    serviceNames: []
  },
  {
    id: 'apache-httpd',
    name: 'Apache HTTP Server',
    category: 'Web Server',
    icon: '🌐',
    description: 'Open-source HTTP server',
    supportedExtensions: ['.zip', '.tar.gz'],
    configFiles: ['conf/httpd.conf', 'conf/extra/*.conf'],
    dataDirectories: ['htdocs', 'logs', 'modules'],
    serviceNames: ['httpd', 'apache2']
  }
];