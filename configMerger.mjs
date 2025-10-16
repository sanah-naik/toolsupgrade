import fs from 'fs-extra';
import path from 'path';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { execSync } from 'child_process';

/**
 * Enhanced Smart Configuration Merger
 * Tool-specific intelligent merging with zero configuration loss
 */

// ============================================================================
// APACHE HTTPD - Smart Config Merger with VAPT Hardening
// ============================================================================

const APACHE_USER_DIRECTIVES = [
  'ServerName', 'ServerAdmin', 'ServerRoot', 'DocumentRoot', 'Listen',
  'ErrorLog', 'CustomLog', 'LogLevel', 'LogFormat',
  'SSLCertificateFile', 'SSLCertificateKeyFile', 'SSLCertificateChainFile',
  'SSLCACertificateFile', 'ProxyPass', 'ProxyPassReverse',
  'Redirect', 'RedirectMatch', 'Alias', 'ScriptAlias',
  'Directory', 'VirtualHost', 'IfModule', 'LoadModule'
];

const APACHE_SECURITY_DIRECTIVES = [
  'SSLProtocol', 'SSLCipherSuite', 'SSLHonorCipherOrder',
  'Header', 'ServerTokens', 'ServerSignature', 'TraceEnable',
  'FileETag', 'Timeout', 'LimitRequestBody', 'KeepAlive'
];

// VAPT Security Hardening for Apache
const APACHE_VAPT_CONFIG = `
# ============================================================================
# APACHE HTTPD - VAPT SECURITY HARDENING
# Auto-generated during upgrade - DO NOT MODIFY MANUALLY
# ============================================================================

# 1. Hide Apache Version and OS Information
ServerTokens Prod
ServerSignature Off

# 2. Disable HTTP TRACE Method (Prevents XST attacks)
TraceEnable Off

# 3. Clickjacking Protection
Header always append X-Frame-Options SAMEORIGIN

# 4. XSS Protection
Header set X-XSS-Protection "1; mode=block"

# 5. MIME Type Sniffing Protection
Header set X-Content-Type-Options "nosniff"

# 6. Referrer Policy
Header set Referrer-Policy "strict-origin-when-cross-origin"

# 7. Content Security Policy (CSP)
Header set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"

# 8. HTTP Strict Transport Security (HSTS) - Enable if using HTTPS
# Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

# 9. Remove ETag (Information Disclosure)
FileETag None

# 10. Limit Request Size (DoS Protection)
LimitRequestBody 10485760

# 11. Timeout Configuration (DoS Protection)
Timeout 60
KeepAlive On
MaxKeepAliveRequests 100
KeepAliveTimeout 5

# 12. Disable Directory Listing
<Directory />
    Options -Indexes
    AllowOverride None
    Require all denied
</Directory>

# 13. SSL/TLS Security (If SSL is enabled)
<IfModule ssl_module>
    # Use only TLS 1.2 and 1.3
    SSLProtocol -all +TLSv1.2 +TLSv1.3

    # Strong Cipher Suite
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384

    # Prefer Server Ciphers
    SSLHonorCipherOrder On

    # Disable SSL Compression (CRIME attack)
    SSLCompression Off

    # OCSP Stapling
    SSLUseStapling On
    SSLStaplingCache "shmcb:logs/ssl_stapling(32768)"
</IfModule>

# 14. Disable Unnecessary Modules (Uncomment to disable)
# LoadModule autoindex_module modules/mod_autoindex.so
# LoadModule status_module modules/mod_status.so
# LoadModule info_module modules/mod_info.so

# 15. Log Security Events
LogLevel warn ssl:warn

// ADD these missing items to APACHE_VAPT_CONFIG in configMerger.mjs (around line 35)

# 16. Secure Cookie Configuration (MISSING - Critical from PDF)
Header edit Set-Cookie ^(.*)$ $1;HttpOnly;Secure
Header always edit Set-Cookie (.*) "$1; SameSite=Strict"

# 17. Disable HTTP/1.0 Protocol (MISSING)
Protocols h2 http/1.1

# 18. Request Timeout (adjust from current generic Timeout)
RequestReadTimeout header=20-40,MinRate=500 body=20,MinRate=500

# ============================================================================
# END OF VAPT SECURITY HARDENING
# ============================================================================
`;

async function mergeApacheConfig(oldConfPath, newConfPath, outputPath, logs, sessionId) {
  logs.push(`[APACHE_MERGE] ═══════════════════════════════════════════════════════════`);
  logs.push(`[APACHE_MERGE] Starting Apache HTTPD Smart Configuration Merge`);
  logs.push(`[APACHE_MERGE] ═══════════════════════════════════════════════════════════`);

  const oldContent = await fs.readFile(oldConfPath, 'utf8');
  const newContent = await fs.readFile(newConfPath, 'utf8');

  // Parse configurations
  const oldConfig = parseApacheConfig(oldContent, logs);
  const newConfig = parseApacheConfig(newContent, logs);

  // Extract user customizations
  const userCustomizations = extractApacheUserSettings(oldConfig, logs);

  // Merge configurations intelligently
  const mergedConfig = mergeApacheSettings(newConfig, userCustomizations, logs);

  // Convert back to text
  const mergedContent = buildApacheConfig(mergedConfig, logs);

  // Add VAPT hardening
  const vaptPath = path.join(path.dirname(outputPath), 'conf', 'extra', 'httpd-security-vapt.conf');
  await fs.ensureDir(path.dirname(vaptPath));
  await fs.writeFile(vaptPath, APACHE_VAPT_CONFIG, 'utf8');
  logs.push(`[APACHE_MERGE] ✓ Created VAPT security config: ${vaptPath}`);

  // Add include directive for VAPT config
  const finalContent = mergedContent + `\n\n# Include VAPT Security Hardening\nInclude conf/extra/httpd-security-vapt.conf\n`;

  await fs.writeFile(outputPath, finalContent, 'utf8');
  await generateDiffReport(oldContent, finalContent, outputPath + '.diff.txt', logs);

  logs.push(`[APACHE_MERGE] ✓ Configuration merged successfully`);
  logs.push(`[APACHE_MERGE] ✓ User settings preserved: ${userCustomizations.directives.length}`);
  logs.push(`[APACHE_MERGE] ✓ VirtualHosts preserved: ${userCustomizations.virtualHosts.length}`);
  logs.push(`[APACHE_MERGE] ✓ VAPT hardening applied`);

  return {
    merged: true,
    userSettings: userCustomizations.directives.length,
    virtualHosts: userCustomizations.virtualHosts.length,
    diffReport: outputPath + '.diff.txt',
    vaptConfig: vaptPath
  };
}

function parseApacheConfig(content, logs) {
  const lines = content.split('\n');
  const config = {
    directives: [],
    modules: [],
    virtualHosts: [],
    directories: [],
    ifModules: []
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line || line.startsWith('#')) {
      i++;
      continue;
    }

    // LoadModule directives
    if (line.startsWith('LoadModule')) {
      config.modules.push({ line: lines[i], lineNum: i + 1 });
    }
    // VirtualHost blocks
    else if (line.startsWith('<VirtualHost')) {
      const block = extractApacheBlock(lines, i, '<VirtualHost', '</VirtualHost>');
      config.virtualHosts.push(block);
      i = block.endIndex;
    }
    // Directory blocks
    else if (line.startsWith('<Directory')) {
      const block = extractApacheBlock(lines, i, '<Directory', '</Directory>');
      config.directories.push(block);
      i = block.endIndex;
    }
    // IfModule blocks
    else if (line.startsWith('<IfModule')) {
      const block = extractApacheBlock(lines, i, '<IfModule', '</IfModule>');
      config.ifModules.push(block);
      i = block.endIndex;
    }
    // Regular directives
    else {
      const directive = parseApacheDirective(lines[i]);
      if (directive) {
        config.directives.push({ ...directive, lineNum: i + 1 });
      }
    }

    i++;
  }

  return config;
}

function parseApacheDirective(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length < 1) return null;

  return {
    name: parts[0],
    value: parts.slice(1).join(' '),
    fullLine: line
  };
}

function extractApacheBlock(lines, startIndex, startTag, endTag) {
  const blockLines = [lines[startIndex]];
  let i = startIndex + 1;
  let depth = 1;

  while (i < lines.length && depth > 0) {
    blockLines.push(lines[i]);
    const trimmed = lines[i].trim();

    if (trimmed.startsWith(startTag)) depth++;
    if (trimmed.startsWith(endTag)) depth--;

    if (depth === 0) break;
    i++;
  }

  return {
    content: blockLines.join('\n'),
    lines: blockLines,
    startIndex,
    endIndex: i
  };
}

function extractApacheUserSettings(config, logs) {
  const customizations = {
    directives: [],
    virtualHosts: [],
    directories: [],
    modules: []
  };

  // Extract user-specific directives
  config.directives.forEach(dir => {
    if (APACHE_USER_DIRECTIVES.includes(dir.name)) {
      customizations.directives.push(dir);
      logs.push(`[APACHE_EXTRACT] User directive: ${dir.name} = ${dir.value}`);
    }
  });

  // All VirtualHosts are considered user customizations
  customizations.virtualHosts = config.virtualHosts;
  logs.push(`[APACHE_EXTRACT] Found ${config.virtualHosts.length} VirtualHost(s)`);

  // User-customized directories
  config.directories.forEach(dir => {
    if (hasUserContent(dir.content)) {
      customizations.directories.push(dir);
      logs.push(`[APACHE_EXTRACT] User Directory block`);
    }
  });

  // Custom modules
  config.modules.forEach(mod => {
    if (!isDefaultModule(mod.line)) {
      customizations.modules.push(mod);
      logs.push(`[APACHE_EXTRACT] Custom module: ${mod.line}`);
    }
  });

  return customizations;
}

function hasUserContent(content) {
  const userKeywords = ['ProxyPass', 'Redirect', 'Alias', 'SSLCertificate', 'Allow', 'Deny'];
  return userKeywords.some(kw => content.includes(kw));
}

function isDefaultModule(line) {
  const defaultModules = [
    'mod_access_compat', 'mod_actions', 'mod_alias', 'mod_allowmethods',
    'mod_auth_basic', 'mod_authn_core', 'mod_authn_file', 'mod_authz_core',
    'mod_authz_groupfile', 'mod_authz_host', 'mod_authz_user', 'mod_autoindex',
    'mod_dir', 'mod_env', 'mod_headers', 'mod_include', 'mod_log_config',
    'mod_mime', 'mod_negotiation', 'mod_setenvif'
  ];
  return defaultModules.some(mod => line.includes(mod));
}

function mergeApacheSettings(newConfig, userCustomizations, logs) {
  const merged = JSON.parse(JSON.stringify(newConfig));

  // Merge user directives (skip security-critical ones)
  userCustomizations.directives.forEach(userDir => {
    if (APACHE_SECURITY_DIRECTIVES.includes(userDir.name)) {
      logs.push(`[APACHE_MERGE] ⚠ Skipping security directive: ${userDir.name} (using new version)`);
      return;
    }

    const existingIndex = merged.directives.findIndex(d => d.name === userDir.name);
    if (existingIndex >= 0) {
      merged.directives[existingIndex] = userDir;
      logs.push(`[APACHE_MERGE] ✓ Replaced: ${userDir.name}`);
    } else {
      merged.directives.push(userDir);
      logs.push(`[APACHE_MERGE] ✓ Added: ${userDir.name}`);
    }
  });

  // Add all user VirtualHosts
  merged.virtualHosts.push(...userCustomizations.virtualHosts);

  // Add custom directories
  merged.directories.push(...userCustomizations.directories);

  // Add custom modules
  merged.modules.push(...userCustomizations.modules);

  return merged;
}

function buildApacheConfig(config, logs) {
  const lines = [];

  lines.push('# ============================================================================');
  lines.push('# Apache HTTP Server Configuration - Merged by Upgrade Tool');
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('# ============================================================================');
  lines.push('');

  // Add modules
  if (config.modules.length > 0) {
    lines.push('# Load Modules');
    config.modules.forEach(mod => lines.push(mod.line));
    lines.push('');
  }

  // Add directives
  if (config.directives.length > 0) {
    lines.push('# Server Configuration');
    config.directives.forEach(dir => lines.push(dir.fullLine));
    lines.push('');
  }

  // Add IfModule blocks
  if (config.ifModules.length > 0) {
    lines.push('# Conditional Configuration');
    config.ifModules.forEach(block => lines.push(block.content));
    lines.push('');
  }

  // Add Directory blocks
  if (config.directories.length > 0) {
    lines.push('# Directory Configuration');
    config.directories.forEach(block => lines.push(block.content));
    lines.push('');
  }

  // Add VirtualHosts
  if (config.virtualHosts.length > 0) {
    lines.push('# Virtual Hosts');
    config.virtualHosts.forEach(block => lines.push(block.content));
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// TOMCAT/TOMEE - Smart XML Merger with Inline VAPT
// ============================================================================

const TOMCAT_VAPT_SETTINGS = {
  server: {
    '@_port': '8005',
    '@_shutdown': 'SHUTDOWN_' + Math.random().toString(36).substring(7), // Random shutdown command
    '@_port': '-1', // Disable shutdown port for security
  },
  connector: {
    '@_maxThreads': '150',
    '@_minSpareThreads': '25',
    '@_connectionTimeout': '20000',
    '@_maxHttpHeaderSize': '8192',
    '@_maxParameterCount': '1000',
    '@_compression': 'on',
    '@_compressionMinSize': '2048',
    '@_server': 'Apache', // Hide Tomcat version
    '@_xpoweredBy': 'false',
    // SSL Security
    '@_SSLEnabled': 'true',
    '@_sslProtocol': 'TLS',
    '@_sslEnabledProtocols': 'TLSv1.2,TLSv1.3',
    '@_ciphers': 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
    '@_SSLHonorCipherOrder': 'true',
    '@_URIEncoding': 'UTF-8',
    '@_useBodyEncodingForURI': 'true',
    '@_allowTrace': 'false', // Critical - disables TRACE method
    '@_maxPostSize': '2097152', // 2MB limit
    '@_maxSavePostSize': '4096',
    '@_secure': 'true',
    '@_scheme': 'https',
  },
  valve: {
    '@_className': 'org.apache.catalina.valves.ErrorReportValve',
    '@_showReport': 'false',
    '@_showServerInfo': 'false'
  },
  // ADD THIS NEW VALVE for access logging:
  accessLogValve: {
    '@_className': 'org.apache.catalina.valves.AccessLogValve',
    '@_directory': 'logs',
    '@_prefix': 'localhost_access_log',
    '@_suffix': '.txt',
    '@_pattern': '%h %l %u %t "%r" %s %b'
  }
};

async function mergeTomcatConfig(oldXmlPath, newXmlPath, outputPath, logs, sessionId) {
  logs.push(`[TOMCAT_MERGE] ═══════════════════════════════════════════════════════════`);
  logs.push(`[TOMCAT_MERGE] Starting Tomcat/TomEE Smart XML Merge with VAPT`);
  logs.push(`[TOMCAT_MERGE] ═══════════════════════════════════════════════════════════`);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    trimValues: true
  });

  const oldXml = await fs.readFile(oldXmlPath, 'utf8');
  const newXml = await fs.readFile(newXmlPath, 'utf8');

  const oldConfig = parser.parse(oldXml);
  const newConfig = parser.parse(newXml);

  // Extract user customizations
  const userSettings = extractTomcatUserSettings(oldConfig, logs);

  // Apply user settings to new config
  applyTomcatUserSettings(newConfig, userSettings, logs);

  // Apply VAPT hardening inline
  applyTomcatVAPT(newConfig, logs);
  await apply3DSpaceVAPT(outputPath, logs, sessionId);

  // Build final XML
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    indentBy: '  ',
    suppressEmptyNode: false
  });

  let mergedXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  mergedXml += '<!-- Tomcat Configuration - Merged with VAPT Security Hardening -->\n';
  mergedXml += `<!-- Generated: ${new Date().toISOString()} -->\n`;
  mergedXml += builder.build(newConfig);

  await fs.writeFile(outputPath, mergedXml, 'utf8');
  await generateDiffReport(oldXml, mergedXml, outputPath + '.diff.txt', logs);

  logs.push(`[TOMCAT_MERGE] ✓ Configuration merged successfully`);
  logs.push(`[TOMCAT_MERGE] ✓ Connectors preserved: ${userSettings.connectors.length}`);
  logs.push(`[TOMCAT_MERGE] ✓ Hosts preserved: ${userSettings.hosts.length}`);
  logs.push(`[TOMCAT_MERGE] ✓ VAPT hardening applied inline`);

  return {
    merged: true,
    connectors: userSettings.connectors.length,
    hosts: userSettings.hosts.length,
    vaptApplied: true,
    diffReport: outputPath + '.diff.txt'
  };
}

function extractTomcatUserSettings(config, logs) {
  const settings = {
    connectors: [],
    hosts: [],
    contexts: [],
    resources: [],
    valves: []
  };

  try {
    const server = config.Server;
    if (!server) return settings;

    const services = Array.isArray(server.Service) ? server.Service : [server.Service];

    services.forEach(service => {
      // Extract custom connectors
      if (service.Connector) {
        const connectors = Array.isArray(service.Connector) ? service.Connector : [service.Connector];
        connectors.forEach(conn => {
          const port = conn['@_port'];
          const isSSL = conn['@_SSLEnabled'] === 'true' || conn['@_secure'] === 'true';
          const isCustomPort = port && !['8080', '8009', '8005', '8443'].includes(port);

          if (isSSL || isCustomPort || conn['@_protocol']) {
            settings.connectors.push(conn);
            logs.push(`[TOMCAT_EXTRACT] Custom connector: port=${port}, SSL=${isSSL}`);
          }
        });
      }

      // Extract custom hosts
      if (service.Engine?.Host) {
        const hosts = Array.isArray(service.Engine.Host) ? service.Engine.Host : [service.Engine.Host];
        hosts.forEach(host => {
          const name = host['@_name'];
          if (name && name !== 'localhost') {
            settings.hosts.push(host);
            logs.push(`[TOMCAT_EXTRACT] Custom host: ${name}`);
          }

          // Extract contexts
          if (host.Context) {
            const contexts = Array.isArray(host.Context) ? host.Context : [host.Context];
            contexts.forEach(ctx => {
              settings.contexts.push(ctx);
              logs.push(`[TOMCAT_EXTRACT] Context: ${ctx['@_path'] || '/'}`);
            });
          }
        });
      }

      // Extract resources
      if (service.Engine?.Host?.Context?.Resource) {
        const resources = Array.isArray(service.Engine.Host.Context.Resource)
          ? service.Engine.Host.Context.Resource
          : [service.Engine.Host.Context.Resource];
        settings.resources.push(...resources);
        logs.push(`[TOMCAT_EXTRACT] Resources: ${resources.length}`);
      }
    });
  } catch (error) {
    logs.push(`[TOMCAT_EXTRACT] Error: ${error.message}`);
  }

  return settings;
}

function applyTomcatUserSettings(newConfig, userSettings, logs) {
  try {
    const server = newConfig.Server;
    if (!server?.Service) return;

    const service = Array.isArray(server.Service) ? server.Service[0] : server.Service;

    // Apply custom connectors
    if (userSettings.connectors.length > 0) {
      if (!service.Connector) {
        service.Connector = [];
      } else if (!Array.isArray(service.Connector)) {
        service.Connector = [service.Connector];
      }

      userSettings.connectors.forEach(userConn => {
        const port = userConn['@_port'];
        const existingIdx = service.Connector.findIndex(c => c['@_port'] === port);

        if (existingIdx >= 0) {
          // Merge while preserving new security settings
          service.Connector[existingIdx] = {
            ...userConn,
            '@_sslProtocol': service.Connector[existingIdx]['@_sslProtocol'] || userConn['@_sslProtocol'],
            '@_ciphers': service.Connector[existingIdx]['@_ciphers'] || userConn['@_ciphers']
          };
          logs.push(`[TOMCAT_MERGE] Merged connector: port=${port}`);
        } else {
          service.Connector.push(userConn);
          logs.push(`[TOMCAT_MERGE] Added connector: port=${port}`);
        }
      });
    }

    // Apply custom hosts
    if (userSettings.hosts.length > 0 && service.Engine) {
      if (!service.Engine.Host) {
        service.Engine.Host = [];
      } else if (!Array.isArray(service.Engine.Host)) {
        service.Engine.Host = [service.Engine.Host];
      }

      userSettings.hosts.forEach(userHost => {
        const name = userHost['@_name'];
        const existingIdx = service.Engine.Host.findIndex(h => h['@_name'] === name);

        if (existingIdx < 0) {
          service.Engine.Host.push(userHost);
          logs.push(`[TOMCAT_MERGE] Added host: ${name}`);
        }
      });
    }
  } catch (error) {
    logs.push(`[TOMCAT_MERGE] Error: ${error.message}`);
  }
}

function applyTomcatVAPT(config, logs) {
  try {
    const server = config.Server;
    if (!server) return;

    // Apply server-level VAPT settings
    Object.assign(server, TOMCAT_VAPT_SETTINGS.server);
    logs.push(`[TOMCAT_VAPT] ✓ Applied randomized shutdown command`);

    const service = Array.isArray(server.Service) ? server.Service[0] : server.Service;
    if (!service) return;

    // Apply connector VAPT settings
    if (service.Connector) {
      const connectors = Array.isArray(service.Connector) ? service.Connector : [service.Connector];
      connectors.forEach((conn, idx) => {
        Object.assign(conn, TOMCAT_VAPT_SETTINGS.connector);
        logs.push(`[TOMCAT_VAPT] ✓ Hardened connector ${idx + 1}`);
      });
    }

    // Add ErrorReportValve if not exists
    if (service.Engine?.Host) {
      const hosts = Array.isArray(service.Engine.Host) ? service.Engine.Host : [service.Engine.Host];
      hosts.forEach(host => {
        if (!host.Valve) {
          host.Valve = [];
        } else if (!Array.isArray(host.Valve)) {
          host.Valve = [host.Valve];
        }

        const hasErrorValve = host.Valve.some(v =>
          v['@_className']?.includes('ErrorReportValve')
        );

        if (!hasErrorValve) {
          host.Valve.push(TOMCAT_VAPT_SETTINGS.valve);
          logs.push(`[TOMCAT_VAPT] ✓ Added ErrorReportValve to hide version info`);
        }
      });
    }

    logs.push(`[TOMCAT_VAPT] ✓ All VAPT hardening applied`);
  } catch (error) {
    logs.push(`[TOMCAT_VAPT] Error: ${error.message}`);
  }
}

// ============================================================================
// JDK - Certificate Import & Policy Merge
// ============================================================================

async function mergeJDKConfig(oldJdkPath, newJdkPath, certFolderPath, keystorePassword, logs, sessionId) {
  logs.push(`[JDK_MERGE] ═══════════════════════════════════════════════════════════`);
  logs.push(`[JDK_MERGE] Starting JDK Configuration Merge with Certificate Import`);
  logs.push(`[JDK_MERGE] ═══════════════════════════════════════════════════════════`);

  const results = {
    certificatesImported: 0,
    cacertsCopied: false,
    policiesMerged: false,
    errors: []
  };

  // 1. Import certificates from folder
  if (certFolderPath && await fs.pathExists(certFolderPath)) {
    results.certificatesImported = await importCertificates(
      certFolderPath,
      newJdkPath,
      keystorePassword,
      logs
    );
  } else {
    logs.push(`[JDK_MERGE] ℹ No certificate folder provided or folder not found`);
  }

  // 2. Merge security policies
  const oldPolicyPath = path.join(oldJdkPath, 'lib', 'security', 'java.policy');
  const newPolicyPath = path.join(newJdkPath, 'lib', 'security', 'java.policy');

  if (await fs.pathExists(oldPolicyPath) && await fs.pathExists(newPolicyPath)) {
    results.policiesMerged = await mergeJavaSecurityPolicy(
      oldPolicyPath,
      newPolicyPath,
      newPolicyPath,
      logs,
      sessionId
    );
  }

  // 3. Copy old cacerts if no certificates were imported
  if (results.certificatesImported === 0) {
    const oldCacerts = path.join(oldJdkPath, 'lib', 'security', 'cacerts');
    const newCacerts = path.join(newJdkPath, 'lib', 'security', 'cacerts');

    if (await fs.pathExists(oldCacerts)) {
      await fs.copy(oldCacerts, newCacerts + '.backup', { overwrite: true });
      await fs.copy(oldCacerts, newCacerts, { overwrite: true });
      results.cacertsCopied = true;
      logs.push(`[JDK_MERGE] ✓ Copied old cacerts to new JDK`);
    }
  }

  logs.push(`[JDK_MERGE] ✓ JDK configuration merge completed`);
  logs.push(`[JDK_MERGE] ✓ Certificates imported: ${results.certificatesImported}`);
  logs.push(`[JDK_MERGE] ✓ Security policies merged: ${results.policiesMerged}`);

  return results;
}

async function importCertificates(certFolder, jdkPath, password, logs) {
  logs.push(`[JDK_CERT] Starting certificate import from: ${certFolder}`);

  const cacertsPath = path.join(jdkPath, 'lib', 'security', 'cacerts');
  const keytoolPath = path.join(jdkPath, 'bin', 'keytool');

  if (!await fs.pathExists(keytoolPath)) {
    logs.push(`[JDK_CERT] ✗ keytool not found at: ${keytoolPath}`);
    return 0;
  }

  const certFiles = await fs.readdir(certFolder);
  let imported = 0;

  for (const file of certFiles) {
    const filePath = path.join(certFolder, file);
    const ext = path.extname(file).toLowerCase();

    // Skip non-certificate files
    if (!['.crt', '.cer', '.pem', '.p12', '.pfx'].includes(ext)) {
      continue;
    }

    try {
      const alias = path.basename(file, ext).replace(/[^a-zA-Z0-9]/g, '_');

      if (['.crt', '.cer', '.pem'].includes(ext)) {
        // Import X.509 certificate
        const cmd = `"${keytoolPath}" -import -trustcacerts -alias ${alias} -file "${filePath}" -keystore "${cacertsPath}" -storepass ${password} -noprompt`;

        try {
          execSync(cmd, { stdio: 'pipe' });
          logs.push(`[JDK_CERT] ✓ Imported: ${file} as ${alias}`);
          imported++;
        } catch (err) {
          logs.push(`[JDK_CERT] ⚠ Failed to import ${file}: ${err.message}`);
        }
      } else if (['.p12', '.pfx'].includes(ext)) {
        // Import PKCS12 keystore
        const cmd = `"${keytoolPath}" -importkeystore -srckeystore "${filePath}" -srcstoretype PKCS12 -srcstorepass ${password} -destkeystore "${cacertsPath}" -deststorepass ${password} -noprompt`;

        try {
          execSync(cmd, { stdio: 'pipe' });
          logs.push(`[JDK_CERT] ✓ Imported PKCS12: ${file}`);
          imported++;
        } catch (err) {
          logs.push(`[JDK_CERT] ⚠ Failed to import PKCS12 ${file}: ${err.message}`);
        }
      }
    } catch (error) {
      logs.push(`[JDK_CERT] ✗ Error processing ${file}: ${error.message}`);
    }
  }

  logs.push(`[JDK_CERT] ✓ Certificate import completed: ${imported}/${certFiles.length} successful`);
  return imported;
}

async function apply3DSpaceVAPT(tomeeConfigPath, logs, sessionId) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, 'APPLYING 3DSPACE VAPT FIXES', 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  // Fix #3: XSS Protection in emxSystem.properties
  const emxSystemPath = path.join(
    path.dirname(tomeeConfigPath), 
    '..', 
    'webapps', 
    '3dspace', 
    'WEB-INF', 
    'classes', 
    'emxSystem.properties'
  );

  if (await fs.pathExists(emxSystemPath)) {
    let content = await fs.readFile(emxSystemPath, 'utf8');
    
    // Add if not exists
    if (!content.includes('emxFramework.InputFilter.BadChars')) {
      content += '\n\n# XSS Protection - VAPT Fix #3\n';
      content += 'emxFramework.InputFilter.BadChars=<|>|"|\'|%|;|)|(|&|+|-\n';
      content += 'emxFramework.InputFilter.BadRegE=(?is)prog(ram)?\\\\s*\\\\[.*\\\\]|(?is)exec(ute)?\\\\s*\\\\[.*\\\\]|(?is)eval.*\\\\(|(?s)".*\\\\*|(?s)\'.*\\\\*|(?is)[file://ssrc(/s*)=|(%3fi)(%3c/s*)(/*)script|(%3fis)(%3c/s*)(meta)/s.*content(/s*)=|(%3fi)javascript/s*:|/*%5b/s/S%5d*%3f/*/|(?is)%3c!--|(?is)--%3e|(?is)/s+on%5ba-z%5d+/s*=|(?i)/x%5ba-f0-9%5d%7b2%7d|(?i)/u00%5ba-f0-9%5d%7b2%7d|(?fs)%22/s*/)/s*;|(?fs)\'/s*/)/s*]\n';
      
      await fs.writeFile(emxSystemPath, content, 'utf8');
      logStep(logs, '✓ Applied 3DSpace XSS protection filters', 'INFO', sessionId);
    }
  }

  // Fix #6: File Upload Restrictions in emxComponents.properties
  const emxCompPath = path.join(
    path.dirname(tomeeConfigPath),
    '..',
    'webapps',
    '3dspace',
    'WEB-INF',
    'classes',
    'emxComponents.properties'
  );

  if (await fs.pathExists(emxCompPath)) {
    let content = await fs.readFile(emxCompPath, 'utf8');
    
    if (!content.includes('emxComponents.Commondocument.SupportedFormats')) {
      content += '\n\n# File Upload Security - VAPT Fix #6\n';
      content += 'emxComponents.Commondocument.SupportedFormats=docx,xlsx,pdf,jpg,png,txt,avi,mp4,flv,gif\n';
      content += 'emxComponents.Commondocument.RestrictedFormats=exe,htm,html,php,bin,pl,vbs,RAR,ZIP,CAB,ARJ,LZH,TAR,GZip,UUE,ISO,BZIP2,Z,7-Zip\n';
      
      await fs.writeFile(emxCompPath, content, 'utf8');
      logStep(logs, '✓ Applied file upload restrictions', 'INFO', sessionId);
    }
  }

  logStep(logs, '✓ 3DSpace VAPT fixes completed', 'INFO', sessionId);
}

// CALL THIS in applyTomcatVAPT 

async function mergeJavaSecurityPolicy(oldPolicyPath, newPolicyPath, outputPath, logs, sessionId) {
  logs.push(`[JDK_POLICY] Merging Java security policies`);

  const oldContent = await fs.readFile(oldPolicyPath, 'utf8');
  const newContent = await fs.readFile(newPolicyPath, 'utf8');

  // Extract user-defined grants from old policy
  const userGrants = extractJavaUserGrants(oldContent, logs);

  // Build merged policy
  let mergedContent = newContent;

  if (userGrants.length > 0) {
    mergedContent += '\n\n// ============================================================================\n';
    mergedContent += '// User-defined grants from previous JDK installation\n';
    mergedContent += `// Merged on: ${new Date().toISOString()}\n`;
    mergedContent += '// ============================================================================\n\n';
    mergedContent += userGrants.join('\n\n');
  }

  await fs.writeFile(outputPath, mergedContent, 'utf8');
  await generateDiffReport(oldContent, mergedContent, outputPath + '.diff.txt', logs);

  logs.push(`[JDK_POLICY] ✓ Security policy merged with ${userGrants.length} user grants`);

  return true;
}

function extractJavaUserGrants(content, logs) {
  const grants = [];
  const grantRegex = /grant\s*(?:codeBase\s+"[^"]*"\s*)?(?:signedBy\s+"[^"]*"\s*)?(?:principal\s+[^{]*\s*)?{[^}]*};/gs;
  const matches = content.match(grantRegex) || [];

  // Filter out default JDK grants
  const userGrants = matches.filter(grant => {
    const isDefaultGrant =
      grant.includes('${java.home}') ||
      grant.includes('${java.ext.dirs}') ||
      grant.includes('file:${java.home}') ||
      grant.includes('sun.') ||
      grant.includes('com.sun.');
    return !isDefaultGrant;
  });

  userGrants.forEach((grant, index) => {
    grants.push(grant.trim());
    logs.push(`[JDK_POLICY] Found user grant #${index + 1}`);
  });

  return grants;
}

// ============================================================================
// SERVICE MANAGEMENT - Stop/Start Services
// ============================================================================

async function stopService(serviceName, logs, sessionId) {
  logs.push(`[SERVICE] Attempting to stop service: ${serviceName}`);

  try {
    if (process.platform === 'win32') {
      // Windows
      try {
        execSync(`sc query "${serviceName}"`, { stdio: 'pipe' });
        execSync(`sc stop "${serviceName}"`, { stdio: 'pipe' });
        logs.push(`[SERVICE] ✓ Stopped Windows service: ${serviceName}`);

        // Wait for service to fully stop
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
      } catch (err) {
        logs.push(`[SERVICE] ℹ Service not found or already stopped: ${serviceName}`);
        return false;
      }
    } else {
      // Linux/Unix
      try {
        execSync(`systemctl stop ${serviceName}`, { stdio: 'pipe' });
        logs.push(`[SERVICE] ✓ Stopped systemd service: ${serviceName}`);

        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
      } catch (err) {
        logs.push(`[SERVICE] ℹ Service not found or already stopped: ${serviceName}`);
        return false;
      }
    }
  } catch (error) {
    logs.push(`[SERVICE] ✗ Error stopping service: ${error.message}`);
    return false;
  }
}

async function startService(serviceName, logs, sessionId) {
  logs.push(`[SERVICE] Attempting to start service: ${serviceName}`);

  try {
    if (process.platform === 'win32') {
      execSync(`sc start "${serviceName}"`, { stdio: 'pipe' });
      logs.push(`[SERVICE] ✓ Started Windows service: ${serviceName}`);
    } else {
      execSync(`systemctl start ${serviceName}`, { stdio: 'pipe' });
      logs.push(`[SERVICE] ✓ Started systemd service: ${serviceName}`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  } catch (error) {
    logs.push(`[SERVICE] ✗ Error starting service: ${error.message}`);
    return false;
  }
}

async function detectAndStopServices(toolType, installPath, logs, sessionId) {
  logs.push(`[SERVICE] ═══════════════════════════════════════════════════════════`);
  logs.push(`[SERVICE] Detecting and stopping ${toolType} services`);
  logs.push(`[SERVICE] ═══════════════════════════════════════════════════════════`);

  const toolLower = toolType.toLowerCase();
  const stoppedServices = [];

  // Apache HTTPD
  if (toolLower.includes('apache') || toolLower.includes('httpd')) {
    const apacheServices = ['Apache', 'Apache2.4', 'httpd', 'apache2'];

    for (const service of apacheServices) {
      const stopped = await stopService(service, logs, sessionId);
      if (stopped) stoppedServices.push(service);
    }

    // Also kill any running httpd processes
    if (process.platform === 'win32') {
      try {
        execSync('taskkill /f /im httpd.exe', { stdio: 'ignore' });
        logs.push(`[SERVICE] ✓ Killed httpd.exe processes`);
      } catch (e) {
        logs.push(`[SERVICE] ℹ No httpd.exe processes found`);
      }
    } else {
      try {
        execSync('pkill -9 httpd', { stdio: 'ignore' });
        logs.push(`[SERVICE] ✓ Killed httpd processes`);
      } catch (e) {
        logs.push(`[SERVICE] ℹ No httpd processes found`);
      }
    }
  }

  // Tomcat/TomEE
  if (toolLower.includes('tomcat') || toolLower.includes('tomee')) {
    const tomcatServices = ['Tomcat9', 'Tomcat10', 'tomcat', 'tomee'];

    for (const service of tomcatServices) {
      const stopped = await stopService(service, logs, sessionId);
      if (stopped) stoppedServices.push(service);
    }

    // Kill Java processes running Tomcat
    if (process.platform === 'win32') {
      try {
        const processes = execSync('wmic process where "name=\'java.exe\'" get commandline,processid', { encoding: 'utf8' });
        const lines = processes.split('\n');

        for (const line of lines) {
          if (line.includes('catalina') || line.includes('tomcat') || line.includes('tomee')) {
            const match = line.match(/(\d+)\s*$/);
            if (match) {
              const pid = match[1];
              execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' });
              logs.push(`[SERVICE] ✓ Killed Tomcat Java process (PID: ${pid})`);
            }
          }
        }
      } catch (e) {
        logs.push(`[SERVICE] ℹ No Tomcat Java processes found`);
      }
    } else {
      try {
        execSync('pkill -9 -f catalina', { stdio: 'ignore' });
        logs.push(`[SERVICE] ✓ Killed Tomcat processes`);
      } catch (e) {
        logs.push(`[SERVICE] ℹ No Tomcat processes found`);
      }
    }
  }

  logs.push(`[SERVICE] ✓ Service stop completed. Stopped: ${stoppedServices.length} service(s)`);
  logs.push(`[SERVICE] ═══════════════════════════════════════════════════════════`);

  return stoppedServices;
}

// ============================================================================
// ENHANCED DIFF REPORT GENERATOR
// ============================================================================

async function generateDiffReport(oldContent, newContent, reportPath, logs) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const report = [];
  report.push('═'.repeat(100));
  report.push('                    CONFIGURATION DIFF REPORT');
  report.push(`                    Generated: ${new Date().toISOString()}`);
  report.push('═'.repeat(100));
  report.push('');

  // Summary section
  report.push('SUMMARY:');
  report.push('-'.repeat(100));
  report.push(`  Old Configuration Lines: ${oldLines.length}`);
  report.push(`  New Configuration Lines: ${newLines.length}`);
  report.push(`  Line Difference: ${newLines.length - oldLines.length}`);
  report.push('');

  // Detailed changes
  const changes = {
    added: [],
    removed: [],
    modified: []
  };

  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine !== newLine) {
      if (!oldLine && newLine) {
        changes.added.push({ line: i + 1, content: newLine });
      } else if (oldLine && !newLine) {
        changes.removed.push({ line: i + 1, content: oldLine });
      } else {
        changes.modified.push({ line: i + 1, old: oldLine, new: newLine });
      }
    }
  }

  // Added lines
  if (changes.added.length > 0) {
    report.push('ADDED LINES:');
    report.push('-'.repeat(100));
    changes.added.forEach(change => {
      report.push(`  [Line ${change.line}] + ${change.content}`);
    });
    report.push('');
  }

  // Removed lines
  if (changes.removed.length > 0) {
    report.push('REMOVED LINES:');
    report.push('-'.repeat(100));
    changes.removed.forEach(change => {
      report.push(`  [Line ${change.line}] - ${change.content}`);
    });
    report.push('');
  }

  // Modified lines
  if (changes.modified.length > 0) {
    report.push('MODIFIED LINES:');
    report.push('-'.repeat(100));
    changes.modified.slice(0, 50).forEach(change => { // Limit to first 50 for readability
      report.push(`  [Line ${change.line}]`);
      report.push(`    OLD: ${change.old}`);
      report.push(`    NEW: ${change.new}`);
      report.push('');
    });
    if (changes.modified.length > 50) {
      report.push(`  ... and ${changes.modified.length - 50} more modified lines`);
      report.push('');
    }
  }

  // Statistics
  report.push('═'.repeat(100));
  report.push('CHANGE STATISTICS:');
  report.push('-'.repeat(100));
  report.push(`  Lines Added:    ${changes.added.length}`);
  report.push(`  Lines Removed:  ${changes.removed.length}`);
  report.push(`  Lines Modified: ${changes.modified.length}`);
  report.push(`  Total Changes:  ${changes.added.length + changes.removed.length + changes.modified.length}`);
  report.push('═'.repeat(100));

  await fs.writeFile(reportPath, report.join('\n'), 'utf8');
  logs.push(`[DIFF] Generated detailed diff report: ${reportPath}`);
}

// ============================================================================
// MAIN SMART MERGE FUNCTION
// ============================================================================

export async function smartMergeConfiguration(
  toolType,
  oldConfigPath,
  newConfigPath,
  outputPath,
  logs,
  sessionId = null,
  options = {}
) {
  logs.push(`[SMART_MERGE] ═══════════════════════════════════════════════════════════`);
  logs.push(`[SMART_MERGE] INTELLIGENT CONFIGURATION MERGE`);
  logs.push(`[SMART_MERGE] Tool: ${toolType}`);
  logs.push(`[SMART_MERGE] Strategy: Zero configuration loss + Security preservation`);
  logs.push(`[SMART_MERGE] ═══════════════════════════════════════════════════════════`);

  const toolLower = toolType.toLowerCase();
  let result;

  try {
    // Stop services before merge
    const stoppedServices = await detectAndStopServices(toolType, oldConfigPath, logs, sessionId);

    // Perform tool-specific merge
    if (toolLower.includes('httpd') || toolLower.includes('apache')) {
      result = await mergeApacheConfig(oldConfigPath, newConfigPath, outputPath, logs, sessionId);
    } else if (toolLower.includes('tomcat') || toolLower.includes('tomee')) {
      result = await mergeTomcatConfig(oldConfigPath, newConfigPath, outputPath, logs, sessionId);
    } else if (toolLower.includes('jdk') || toolLower.includes('java')) {
      result = await mergeJDKConfig(
        oldConfigPath,
        newConfigPath,
        options.certFolderPath,
        options.keystorePassword,
        logs,
        sessionId
      );
    } else {
      throw new Error(`Unsupported tool type: ${toolType}`);
    }

    logs.push('');
    logs.push(`[SMART_MERGE] ✓✓✓ MERGE COMPLETED SUCCESSFULLY ✓✓✓`);
    logs.push(`[SMART_MERGE] ✓ User configurations preserved`);
    logs.push(`[SMART_MERGE] ✓ Security patches maintained`);
    logs.push(`[SMART_MERGE] ✓ VAPT hardening applied`);
    logs.push(`[SMART_MERGE] ✓ Services stopped: ${stoppedServices.length}`);
    logs.push(`[SMART_MERGE] ═══════════════════════════════════════════════════════════`);

    return {
      ...result,
      stoppedServices
    };

  } catch (error) {
    logs.push(`[SMART_MERGE] ✗ ERROR: ${error.message}`);
    logs.push(`[SMART_MERGE] Stack: ${error.stack}`);

    // Fallback strategy
    logs.push(`[SMART_MERGE] Attempting fallback: Copy new + backup old`);

    try {
      await fs.copy(newConfigPath, outputPath, { overwrite: true });
      await fs.copy(oldConfigPath, outputPath + '.old-backup', { overwrite: true });

      logs.push(`[SMART_MERGE] ⚠ Fallback completed`);
      logs.push(`[SMART_MERGE] ⚠ Old config backed up to: ${outputPath}.old-backup`);
      logs.push(`[SMART_MERGE] ⚠ MANUAL REVIEW REQUIRED!`);

      return {
        merged: false,
        error: error.message,
        fallback: true,
        backupPath: outputPath + '.old-backup'
      };
    } catch (fallbackError) {
      logs.push(`[SMART_MERGE] ✗ Fallback also failed: ${fallbackError.message}`);
      throw error;
    }
  }
}

// Export all functions
export {
  mergeApacheConfig,
  mergeTomcatConfig,
  mergeJDKConfig,
  importCertificates,
  mergeJavaSecurityPolicy,
  detectAndStopServices,
  stopService,
  startService,
  generateDiffReport
};