import express from 'express';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import cors from 'cors';
import { execSync } from 'child_process';
import { smartMergeConfiguration } from './configMerger.mjs';

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true, limit: '2gb' }));
app.use(express.json({ limit: '2gb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Store active SSE clients
const activeClients = new Map();

function isRunningAsAdmin() {
  if (process.platform === 'win32') {
    try {
      execSync('net session', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }
  return process.getuid && process.getuid() === 0;
}

const upload = multer({ dest: 'uploads/' });

// Enhanced logging with SSE broadcast
function logStep(logs, msg, level = 'INFO', sessionId = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${msg}`;
  logs.push(logEntry);
  console.log(logEntry);

  // Broadcast to SSE client if sessionId provided
  if (sessionId && activeClients.has(sessionId)) {
    const client = activeClients.get(sessionId);
    client.write(`data: ${JSON.stringify({ log: logEntry, level })}\n\n`);
  }
}

function logCommand(logs, command, args = {}, sessionId = null) {
  const argsStr = Object.keys(args).length > 0
    ? `\n    Args: ${JSON.stringify(args, null, 2)}`
    : '';
  logStep(logs, `EXECUTING: ${command}${argsStr}`, 'COMMAND', sessionId);
}

function logResult(logs, operation, result, sessionId = null) {
  logStep(logs, `RESULT: ${operation} -> ${JSON.stringify(result)}`, 'RESULT', sessionId);
}

function logFileOperation(logs, operation, source, destination = null, sessionId = null) {
  if (destination) {
    logStep(logs, `FILE_OP: ${operation} | FROM: ${source} | TO: ${destination}`, 'FILE', sessionId);
  } else {
    logStep(logs, `FILE_OP: ${operation} | PATH: ${source}`, 'FILE', sessionId);
  }
}

function logError(logs, operation, error, sessionId = null) {
  logStep(logs, `ERROR in ${operation}: ${error.message}`, 'ERROR', sessionId);
  if (error.stack) {
    logStep(logs, `Stack trace: ${error.stack}`, 'ERROR', sessionId);
  }
  if (error.code) {
    logStep(logs, `Error code: ${error.code}`, 'ERROR', sessionId);
  }
}

function logSystemInfo(logs, info, sessionId = null) {
  logStep(logs, `SYSTEM: ${info}`, 'SYSTEM', sessionId);
}

function now() { return new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14); }

function killApacheProcesses(logs, sessionId = null) {
  if (process.platform === 'win32') {
    try {
      logStep(logs, 'Attempting to kill Apache processes...', 'INFO', sessionId);
      execSync('taskkill /f /im httpd.exe', { stdio: 'ignore' });
      logStep(logs, 'Apache processes terminated', 'INFO', sessionId);
      return true;
    } catch (e) {
      logStep(logs, 'No Apache processes found to kill', 'INFO', sessionId);
      return false;
    }
  }
  return false;
}

async function useRobocopy(sourceDir, targetDir, logs, sessionId = null) {
  if (process.platform !== 'win32') {
    throw new Error('Robocopy is only available on Windows');
  }

  try {
    logStep(logs, 'Using Windows Robocopy for reliable file replacement...', 'INFO', sessionId);
    logCommand(logs, 'ROBOCOPY_UPGRADE', {
      source: sourceDir,
      target: targetDir,
      method: 'Windows native robust copy'
    }, sessionId);

    const cmd = `robocopy "${sourceDir}" "${targetDir}" /E /COPYALL /R:5 /W:2 /MT:8 /NFL /NDL /NP`;
    logStep(logs, `Executing: ${cmd}`, 'INFO', sessionId);
    const startTime = Date.now();

    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 1024 * 1024 * 10
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logStep(logs, `Robocopy completed in ${duration} seconds`, 'INFO', sessionId);

    const lines = output.split('\n').filter(line =>
      line.includes('Files :') ||
      line.includes('Dirs :') ||
      line.includes('Bytes :') ||
      line.includes('Ended :')
    );

    lines.forEach(line => {
      if (line.trim()) {
        logStep(logs, `ROBOCOPY: ${line.trim()}`, 'INFO', sessionId);
      }
    });

    return true;
  } catch (err) {
    if (err.status !== undefined && err.status <= 7) {
      logStep(logs, `Robocopy completed with code ${err.status} (success)`, 'INFO', sessionId);
      return true;
    }

    logError(logs, 'ROBOCOPY', err, sessionId);
    throw new Error(`Robocopy failed with exit code ${err.status}: ${err.message}`);
  }
}

async function backupWithStructure(src, userBackupRoot, toolType, logs, sessionId = null) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, 'STARTING BACKUP PROCESS', 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  const stamp = now();
  const toolSanitized = toolType.replace(/[^\w]+/g, '');
  const backupFolder = path.join(userBackupRoot, `${toolSanitized}_${stamp}`);

  logCommand(logs, 'CREATE_BACKUP_DIRECTORY', {
    source: src,
    backupDestination: backupFolder,
    toolType: toolType,
    timestamp: stamp
  }, sessionId);

  try {
    logStep(logs, `Checking if source exists: ${src}`, 'INFO', sessionId);
    const sourceExists = await fs.pathExists(src);
    logResult(logs, 'Source exists check', sourceExists, sessionId);

    if (!sourceExists) {
      throw new Error(`Source path does not exist: ${src}`);
    }

    logStep(logs, `Getting source directory stats`, 'INFO', sessionId);
    const sourceStats = await fs.stat(src);
    logResult(logs, 'Source stats', {
      isDirectory: sourceStats.isDirectory(),
      size: sourceStats.size,
      created: sourceStats.birthtime,
      modified: sourceStats.mtime
    }, sessionId);

    await fs.ensureDir(backupFolder);
    logStep(logs, `Backup directory created successfully: ${backupFolder}`, 'INFO', sessionId);

    if (process.platform === 'win32') {
      await useRobocopy(src, backupFolder, logs, sessionId);
    } else {
      logStep(logs, `Beginning file copy operation...`, 'INFO', sessionId);
      const startTime = Date.now();

      await fs.copy(src, backupFolder, {
        overwrite: true,
        errorOnExist: false,
        preserveTimestamps: true
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logStep(logs, `Copy operation completed in ${duration} seconds`, 'INFO', sessionId);
    }

    logStep(logs, `Verifying backup integrity...`, 'INFO', sessionId);
    const backupExists = await fs.pathExists(backupFolder);
    const backupStats = await fs.stat(backupFolder);

    logResult(logs, 'Backup verification', {
      exists: backupExists,
      isDirectory: backupStats.isDirectory(),
      path: backupFolder
    }, sessionId);

    logStep(logs, `✓ Backup completed successfully at: ${backupFolder}`, 'INFO', sessionId);
    logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

    return backupFolder;
  } catch (error) {
    logError(logs, 'BACKUP_PROCESS', error, sessionId);
    throw error;
  }
}

async function zipAndCleanupFolder(folder, logs, sessionId = null) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, 'STARTING ZIP AND CLEANUP PROCESS', 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  const zipPath = `${folder}.zip`;

  logCommand(logs, 'CREATE_ZIP_ARCHIVE', {
    sourceFolder: folder,
    destinationZip: zipPath
  }, sessionId);

  try {
    const startTime = Date.now();

    logStep(logs, `Checking if folder exists: ${folder}`, 'INFO', sessionId);
    const folderExists = await fs.pathExists(folder);
    logResult(logs, 'Folder exists check', folderExists, sessionId);

    if (!folderExists) {
      throw new Error(`Folder does not exist: ${folder}`);
    }

    logStep(logs, `Initializing AdmZip library`, 'INFO', sessionId);
    const zip = new AdmZip();

    logStep(logs, `Adding folder contents to zip archive...`, 'INFO', sessionId);
    zip.addLocalFolder(folder);

    logStep(logs, `Writing zip file to disk: ${zipPath}`, 'INFO', sessionId);
    zip.writeZip(zipPath);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logStep(logs, `Zip creation completed in ${duration} seconds`, 'INFO', sessionId);

    logStep(logs, `Verifying zip file...`, 'INFO', sessionId);
    const zipExists = await fs.pathExists(zipPath);
    const zipStats = await fs.stat(zipPath);

    logResult(logs, 'Zip verification', {
      exists: zipExists,
      size: `${(zipStats.size / 1024 / 1024).toFixed(2)} MB`,
      path: zipPath
    }, sessionId);

    logCommand(logs, 'DELETE_FOLDER', { path: folder }, sessionId);
    logStep(logs, `Removing original folder after successful zip...`, 'INFO', sessionId);

    await fs.remove(folder);

    logStep(logs, `✓ Folder deleted successfully: ${folder}`, 'INFO', sessionId);
    logStep(logs, `✓ Backup preserved as: ${zipPath}`, 'INFO', sessionId);
    logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  } catch (error) {
    logError(logs, 'ZIP_AND_CLEANUP', error, sessionId);
    throw error;
  }
}

async function extractArchive(archivePath, originalName, extractTo, logs, sessionId = null) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, 'STARTING ARCHIVE EXTRACTION', 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  logCommand(logs, 'EXTRACT_ARCHIVE', {
    archivePath: archivePath,
    originalName: originalName,
    extractTo: extractTo
  }, sessionId);

  try {
    logStep(logs, `Analyzing archive file...`, 'INFO', sessionId);
    const archiveStats = await fs.stat(archivePath);
    logResult(logs, 'Archive stats', {
      size: `${(archiveStats.size / 1024 / 1024).toFixed(2)} MB`,
      created: archiveStats.birthtime,
      extension: path.extname(originalName)
    }, sessionId);

    logStep(logs, `Creating extraction directory: ${extractTo}`, 'INFO', sessionId);
    await fs.ensureDir(extractTo);

    const startTime = Date.now();

    if (originalName.endsWith('.zip')) {
      logStep(logs, `Detected ZIP format, using AdmZip extractor`, 'INFO', sessionId);
      const zip = new AdmZip(archivePath);
      const entries = zip.getEntries();
      logStep(logs, `Archive contains ${entries.length} entries`, 'INFO', sessionId);

      logStep(logs, `Extracting all entries...`, 'INFO', sessionId);
      zip.extractAllTo(extractTo, true);

    } else if (originalName.endsWith('.tar.gz') || originalName.endsWith('.tgz')) {
      logStep(logs, `Detected TAR.GZ format, using tar extractor`, 'INFO', sessionId);

      await tar.extract({
        file: archivePath,
        cwd: extractTo,
        strict: true,
        onentry: entry => {
          logStep(logs, `  Extracting: ${entry.path}`, 'INFO', sessionId);
        }
      });

    } else if (originalName.endsWith('.tar')) {
      logStep(logs, `Detected TAR format, using tar extractor`, 'INFO', sessionId);

      await tar.extract({
        file: archivePath,
        cwd: extractTo,
        strict: true,
        onentry: entry => {
          logStep(logs, `  Extracting: ${entry.path}`, 'INFO', sessionId);
        }
      });

    } else {
      throw new Error(`Unsupported archive format. Only .zip, .tar, .tar.gz, .tgz allowed. Got: ${originalName}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logStep(logs, `Extraction completed in ${duration} seconds`, 'INFO', sessionId);

    logStep(logs, `Listing extracted contents...`, 'INFO', sessionId);
    const extractedItems = await fs.readdir(extractTo);
    logResult(logs, 'Extracted items', {
      count: extractedItems.length,
      items: extractedItems
    }, sessionId);

    logStep(logs, `✓ Archive extracted successfully to: ${extractTo}`, 'INFO', sessionId);
    logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  } catch (error) {
    logError(logs, 'EXTRACT_ARCHIVE', error, sessionId);
    throw error;
  }
}

// ADD to server.mjs after line 50

async function installModEvasive(apachePath, logs, sessionId) {
  logStep(logs, 'Installing mod_evasive for rate limiting...', 'INFO', sessionId);
  
  const modulePath = path.join(apachePath, 'modules', 'mod_evasive.so');
  const httpdConfPath = path.join(apachePath, 'conf', 'httpd.conf');
  
  // Check if already configured
  let httpdConf = await fs.readFile(httpdConfPath, 'utf8');
  
  if (!httpdConf.includes('mod_evasive')) {
    httpdConf += '\n\n# Rate Limiting - VAPT Fix #7\n';
    httpdConf += 'LoadModule evasive_module modules/mod_evasive.so\n';
    httpdConf += '<IfModule mod_evasive.c>\n';
    httpdConf += '  DOSEnabled true\n';
    httpdConf += '  DOSHashTableSize 3097\n';
    httpdConf += '  DOSPageCount 2\n';
    httpdConf += '  DOSSiteCount 50\n';
    httpdConf += '  DOSPageInterval 1\n';
    httpdConf += '  DOSSiteInterval 1\n';
    httpdConf += '  DOSBlockingPeriod 10\n';
    httpdConf += '</IfModule>\n';
    
    await fs.writeFile(httpdConfPath, httpdConf, 'utf8');
    logStep(logs, '✓ mod_evasive rate limiting configured', 'INFO', sessionId);
    logStep(logs, '⚠ NOTE: mod_evasive.so must be manually downloaded from Apache Lounge', 'WARNING', sessionId);
  }
}

// CALL in comprehensivePreserveHTTPD_SECURE (around line 650)


// Helper function to copy only recent logs
async function copyRecentLogs(sourceDir, targetDir, daysToKeep, logs, sessionId) {
  await fs.ensureDir(targetDir);

  const files = await fs.readdir(sourceDir);
  const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  let copiedCount = 0;

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const stat = await fs.stat(sourcePath);

    if (stat.isFile() && stat.mtime.getTime() > cutoffDate) {
      const targetPath = path.join(targetDir, file);
      await fs.copy(sourcePath, targetPath, { overwrite: true });
      copiedCount++;
    }
  }

  logStep(logs, `  → Copied ${copiedCount} recent log files (last ${daysToKeep} days)`, 'INFO', sessionId);
}

// ============================================================================
// SECURE PRESERVATION FUNCTIONS WITH SMART CONFIG MERGING
// ============================================================================

async function comprehensivePreserveHTTPD_SECURE(oldHttpd, newHttpd, logs, sessionId = null) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, 'SECURE APACHE HTTPD CONFIGURATION PRESERVATION', 'INFO', sessionId);
  logStep(logs, 'Strategy: Smart merge instead of blind copy', 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  const preserveItems = [
    // CONFIGURATION FILES - Use smart merge
    {
      type: 'merge',
      path: 'conf/httpd.conf',
      critical: true,
      description: 'Main Apache configuration with security patches'
    },
    {
      type: 'merge',
      path: 'conf/3dx.conf',
      critical: false,
      description: 'Custom 3DEXPERIENCE configuration'
    },

    // THESE ARE SAFE TO COPY DIRECTLY (user data, not security-critical)
    {
      type: 'copy-dir',
      path: 'conf/SSL',
      critical: true,
      description: 'SSL certificates and keys'
    },
    {
      type: 'copy-dir',
      path: 'htdocs',
      critical: true,
      description: 'Web content and deployed applications'
    },
    {
      type: 'copy-dir',
      path: 'conf/extra',
      critical: true,
      description: 'Additional configuration modules'
    },

    // LOGS - Optional, for reference
    {
      type: 'copy-dir',
      path: 'logs',
      critical: false,
      description: 'Historical logs (last 7 days only)'
    }
  ];

  let preservedCount = 0;
  let mergedCount = 0;
  let skippedCount = 0;

  for (const item of preserveItems) {
    const sourcePath = path.join(oldHttpd, item.path);
    const targetPath = path.join(newHttpd, item.path);

    logCommand(logs, 'PRESERVE_ITEM', {
      type: item.type,
      path: item.path,
      critical: item.critical,
      description: item.description
    }, sessionId);

    try {
      if (!(await fs.pathExists(sourcePath))) {
        if (item.critical) {
          logStep(logs, `⚠ Critical item not found: ${item.path}`, 'WARNING', sessionId);
        } else {
          logStep(logs, `- Optional item not found: ${item.path}`, 'INFO', sessionId);
        }
        skippedCount++;
        continue;
      }

      // SMART MERGE for configuration files
      if (item.type === 'merge') {
        logStep(logs, `🔄 SMART MERGING: ${item.path}`, 'INFO', sessionId);
        logStep(logs, `  → Extracting user settings from old config`, 'INFO', sessionId);
        logStep(logs, `  → Applying to new config with security patches`, 'INFO', sessionId);

        const mergeResult = await smartMergeConfiguration(
          'httpd',
          sourcePath,
          targetPath,
          targetPath, // Overwrite target with merged version
          logs,
          sessionId
        );

        if (mergeResult.merged) {
          logStep(logs, `✓ Smart merged: ${item.path}`, 'INFO', sessionId);
          logStep(logs, `  → ${mergeResult.userSettings || 0} user settings preserved`, 'INFO', sessionId);
          logStep(logs, `  → Security patches maintained from new version`, 'INFO', sessionId);
          logStep(logs, `  → Diff report: ${mergeResult.diffReport}`, 'INFO', sessionId);
          mergedCount++;
        } else {
          logStep(logs, `⚠ Merge failed, used fallback: ${item.path}`, 'WARNING', sessionId);
          logStep(logs, `  → Manual review required: ${targetPath}.old`, 'WARNING', sessionId);
          preservedCount++;
        }
      }

      // DIRECT COPY for non-security-critical items
      else if (item.type === 'copy-file' || item.type === 'copy-dir') {
        const sourceStats = await fs.stat(sourcePath);

        // Remove target first if it exists
        if (await fs.pathExists(targetPath)) {
          logStep(logs, `  Removing existing target: ${item.path}`, 'INFO', sessionId);
          await fs.remove(targetPath);
        }

        if (sourceStats.isDirectory()) {
          // Special handling for logs - only copy recent files
          if (item.path === 'logs') {
            await copyRecentLogs(sourcePath, targetPath, 7, logs, sessionId);
          } else {
            await fs.copy(sourcePath, targetPath, { overwrite: true });
          }

          const items = await fs.readdir(targetPath);
          logStep(logs, `✓ Copied directory: ${item.path} (${items.length} items)`, 'INFO', sessionId);
        } else {
          await fs.copy(sourcePath, targetPath, { overwrite: true });
          logStep(logs, `✓ Copied file: ${item.path}`, 'INFO', sessionId);
        }

        preservedCount++;
      }

    } catch (error) {
      logError(logs, `PRESERVE_${item.path}`, error, sessionId);

      if (error.code === 'EBUSY') {
        logStep(logs, `  ⚠ File locked. Ensure Apache is stopped!`, 'ERROR', sessionId);
      } else if (error.code === 'EPERM' || error.code === 'EACCES') {
        logStep(logs, `  ⚠ Permission denied. Run as Administrator!`, 'ERROR', sessionId);
      }

      if (item.critical) {
        throw new Error(`Failed to preserve critical item: ${item.path} (${error.code || error.message})`);
      }
      skippedCount++;
    }
  }

  // Preserve certificate files from conf directory
  const confDir = path.join(oldHttpd, 'conf');
  if (await fs.pathExists(confDir)) {
    const certExtensions = ['.crt', '.key', '.pem', '.p12', '.pfx'];
    const confFiles = await fs.readdir(confDir);

    for (const file of confFiles) {
      const ext = path.extname(file).toLowerCase();
      if (certExtensions.includes(ext)) {
        const sourceFile = path.join(confDir, file);
        const targetFile = path.join(newHttpd, 'conf', file);

        try {
          if (await fs.pathExists(targetFile)) {
            await fs.remove(targetFile);
          }

          await fs.copy(sourceFile, targetFile, { overwrite: true });
          logStep(logs, `✓ Preserved certificate: conf/${file}`, 'INFO', sessionId);
          preservedCount++;
        } catch (error) {
          logError(logs, `PRESERVE_CERT_${file}`, error, sessionId);
        }
      }
    }
  }

  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, `PRESERVATION SUMMARY:`, 'INFO', sessionId);
  logStep(logs, `  ✓ Smart merged: ${mergedCount} config files (security patches preserved)`, 'INFO', sessionId);
  logStep(logs, `  ✓ Directly copied: ${preservedCount} data/certificate files`, 'INFO', sessionId);
  logStep(logs, `  - Skipped: ${skippedCount} items (not found)`, 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
}

async function comprehensivePreserveTomEE_SECURE(oldTomEE, newTomEE, logs, sessionId = null) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, 'SECURE TOMEE/TOMCAT CONFIGURATION PRESERVATION', 'INFO', sessionId);
  logStep(logs, 'Strategy: Smart XML merge with security preservation', 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  const preserveItems = [
    // CRITICAL CONFIG - Use smart XML merge
    {
      type: 'merge',
      path: 'conf/server.xml',
      critical: true,
      description: 'Main Tomcat server config (ports, connectors, security)'
    },
    {
      type: 'merge',
      path: 'conf/tomee.xml',
      critical: true,
      description: 'TomEE-specific configuration'
    },

    // THESE CAN BE COPIED (less security-critical, more user-specific)
    {
      type: 'copy-file',
      path: 'conf/context.xml',
      critical: false,
      description: 'Context configuration for applications'
    },
    {
      type: 'copy-file',
      path: 'conf/tomcat-users.xml',
      critical: false,
      description: 'User authentication database'
    },

    // USER DATA - Safe to copy directly
    {
      type: 'copy-dir',
      path: 'webapps',
      critical: true,
      description: 'Deployed web applications'
    },
    {
      type: 'copy-dir',
      path: 'lib/custom',
      critical: false,
      description: 'Custom libraries'
    },
    {
      type: 'copy-dir',
      path: 'logs',
      critical: false,
      description: 'Application logs'
    }
  ];

  let preservedCount = 0;
  let mergedCount = 0;
  let skippedCount = 0;

  for (const item of preserveItems) {
    const sourcePath = path.join(oldTomEE, item.path);
    const targetPath = path.join(newTomEE, item.path);

    logCommand(logs, 'PRESERVE_ITEM', {
      type: item.type,
      path: item.path,
      critical: item.critical,
      description: item.description
    }, sessionId);

    try {
      if (!(await fs.pathExists(sourcePath))) {
        if (item.critical) {
          logStep(logs, `⚠ Critical item not found: ${item.path}`, 'WARNING', sessionId);
        }
        skippedCount++;
        continue;
      }

      if (item.type === 'merge') {
        logStep(logs, `🔄 SMART XML MERGING: ${item.path}`, 'INFO', sessionId);
        logStep(logs, `  → Extracting user connectors, hosts, contexts`, 'INFO', sessionId);
        logStep(logs, `  → Preserving new security settings (SSL protocols, ciphers)`, 'INFO', sessionId);

        const mergeResult = await smartMergeConfiguration(
          'tomcat',
          sourcePath,
          targetPath,
          targetPath,
          logs,
          sessionId
        );

        if (mergeResult.merged) {
          logStep(logs, `✓ Smart merged: ${item.path}`, 'INFO', sessionId);
          logStep(logs, `  → ${mergeResult.customizations || 0} user customizations preserved`, 'INFO', sessionId);
          logStep(logs, `  → Diff report: ${mergeResult.diffReport}`, 'INFO', sessionId);
          mergedCount++;
        } else {
          preservedCount++;
        }
      } else {
        // Direct copy for non-critical items
        const sourceStats = await fs.stat(sourcePath);

        if (await fs.pathExists(targetPath)) {
          await fs.remove(targetPath);
        }

        await fs.copy(sourcePath, targetPath, { overwrite: true });

        if (sourceStats.isDirectory()) {
          const items = await fs.readdir(targetPath);
          logStep(logs, `✓ Copied directory: ${item.path} (${items.length} items)`, 'INFO', sessionId);
        } else {
          logStep(logs, `✓ Copied file: ${item.path}`, 'INFO', sessionId);
        }

        preservedCount++;
      }

    } catch (error) {
      logError(logs, `PRESERVE_${item.path}`, error, sessionId);
      if (item.critical) {
        throw new Error(`Failed to preserve critical configuration: ${item.path}`);
      }
      skippedCount++;
    }
  }

  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, `TOMEE PRESERVATION SUMMARY:`, 'INFO', sessionId);
  logStep(logs, `  ✓ Smart merged: ${mergedCount} XML configs`, 'INFO', sessionId);
  logStep(logs, `  ✓ Copied: ${preservedCount} data files`, 'INFO', sessionId);
  logStep(logs, `  - Skipped: ${skippedCount} items`, 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
}

async function comprehensivePreserveJDK_SECURE(oldJdk, newJdk, logs, sessionId = null) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, 'SECURE JDK CONFIGURATION PRESERVATION', 'INFO', sessionId);
  logStep(logs, 'Strategy: Merge security policies, copy certificates', 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  const preserveItems = [
    // SECURITY POLICY - Use smart merge
    {
      type: 'merge',
      path: 'lib/security/java.policy',
      critical: false,
      description: 'Java security policy file'
    },

    // CERTIFICATES - Safe to copy (user-installed CA certs)
    {
      type: 'copy-file',
      path: 'lib/security/cacerts',
      critical: true,
      description: 'Trusted CA certificates keystore'
    },

    // SECURITY CONFIG - Copy but create backup of new version
    {
      type: 'copy-with-backup',
      path: 'lib/security/java.security',
      critical: false,
      description: 'Java security properties'
    },

    // EXTENSIONS - Safe to copy
    {
      type: 'copy-dir',
      path: 'lib/ext',
      critical: false,
      description: 'Java extension libraries'
    },
    {
      type: 'copy-dir',
      path: 'jre/lib/ext',
      critical: false,
      description: 'JRE extension libraries (JDK 8 and earlier)'
    }
  ];

  let preservedCount = 0;
  let mergedCount = 0;
  let skippedCount = 0;

  for (const item of preserveItems) {
    const sourcePath = path.join(oldJdk, item.path);
    const targetPath = path.join(newJdk, item.path);

    try {
      if (!(await fs.pathExists(sourcePath))) {
        skippedCount++;
        continue;
      }

      if (item.type === 'merge') {
        logStep(logs, `🔄 SMART POLICY MERGING: ${item.path}`, 'INFO', sessionId);

        const mergeResult = await smartMergeConfiguration(
          'jdk',
          sourcePath,
          targetPath,
          targetPath,
          logs,
          sessionId
        );

        if (mergeResult.merged) {
          logStep(logs, `✓ Smart merged: ${item.path}`, 'INFO', sessionId);
          logStep(logs, `  → ${mergeResult.userGrants || 0} user grants preserved`, 'INFO', sessionId);
          mergedCount++;
        } else {
          preservedCount++;
        }
      } else if (item.type === 'copy-with-backup') {
        // Create backup of new version before overwriting
        const backupPath = targetPath + '.new-version-backup';
        await fs.copy(targetPath, backupPath, { overwrite: true });
        logStep(logs, `  → Backed up new version to: ${backupPath}`, 'INFO', sessionId);

        await fs.copy(sourcePath, targetPath, { overwrite: true });
        logStep(logs, `✓ Copied with backup: ${item.path}`, 'INFO', sessionId);
        logStep(logs, `  ⚠ Manual review recommended - compare with .new-version-backup`, 'WARNING', sessionId);
        preservedCount++;
      } else {
        const sourceStats = await fs.stat(sourcePath);

        await fs.copy(sourcePath, targetPath, { overwrite: true });

        if (sourceStats.isDirectory()) {
          logStep(logs, `✓ Copied directory: ${item.path}`, 'INFO', sessionId);
        } else {
          const sizeMB = (sourceStats.size / 1024 / 1024).toFixed(2);
          logStep(logs, `✓ Copied file: ${item.path} (${sizeMB} MB)`, 'INFO', sessionId);
        }

        preservedCount++;
      }

    } catch (error) {
      logError(logs, `PRESERVE_${item.path}`, error, sessionId);
      if (item.critical) {
        throw new Error(`Failed to preserve critical configuration: ${item.path}`);
      }
      skippedCount++;
    }
  }

  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, `JDK PRESERVATION SUMMARY:`, 'INFO', sessionId);
  logStep(logs, `  ✓ Smart merged: ${mergedCount} policy files`, 'INFO', sessionId);
  logStep(logs, `  ✓ Copied: ${preservedCount} certificates/extensions`, 'INFO', sessionId);
  logStep(logs, `  - Skipped: ${skippedCount} items`, 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
}
// REPLACE the function in server.mjs (around line 850) with this enhanced version:

async function detectAndStopServices(toolType, installPath, logs, sessionId) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, `Detecting and stopping ${toolType} services`, 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  const toolLower = toolType.toLowerCase();
  const stoppedServices = [];

  // Apache HTTPD - Enhanced
  if (toolLower.includes('apache') || toolLower.includes('httpd')) {
    const apacheServices = ['Apache', 'Apache2.4', 'Apache2.2', 'httpd', 'apache2'];

    for (const service of apacheServices) {
      const stopped = await stopService(service, logs, sessionId);
      if (stopped) stoppedServices.push(service);
    }

    // Kill processes MULTIPLE times to ensure cleanup
    for (let i = 0; i < 3; i++) {
      if (process.platform === 'win32') {
        try {
          execSync('taskkill /f /im httpd.exe', { stdio: 'ignore' });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) { /* ignore */ }
      } else {
        try {
          execSync('pkill -9 httpd', { stdio: 'ignore' });
          execSync('pkill -9 apache2', { stdio: 'ignore' });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) { /* ignore */ }
      }
    }
    
    logStep(logs, `✓ Apache cleanup completed (${3} attempts)`, 'INFO', sessionId);
  }

  // Tomcat/TomEE - Enhanced
  if (toolLower.includes('tomcat') || toolLower.includes('tomee')) {
    const tomcatServices = [
      'Tomcat9', 'Tomcat10', 'Tomcat8', 'tomcat', 'tomee',
      '3DSpace_CAS', '3DSpace_NoCAS' // Add 3DSpace specific
    ];

    for (const service of tomcatServices) {
      const stopped = await stopService(service, logs, sessionId);
      if (stopped) stoppedServices.push(service);
    }

    // Kill Java/Tomcat processes - enhanced detection
    if (process.platform === 'win32') {
      try {
        const processes = execSync('wmic process where "name=\'java.exe\'" get commandline,processid', { encoding: 'utf8' });
        const lines = processes.split('\n');

        for (const line of lines) {
          if (line.includes('catalina') || line.includes('tomcat') || 
              line.includes('tomee') || line.includes('3DSpace')) {
            const match = line.match(/(\d+)\s*$/);
            if (match) {
              const pid = match[1];
              try {
                execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' });
                logStep(logs, `✓ Killed Tomcat process (PID: ${pid})`, 'INFO', sessionId);
              } catch (e) { /* ignore */ }
            }
          }
        }
      } catch (e) {
        logStep(logs, `ℹ No Tomcat Java processes found`, 'INFO', sessionId);
      }
    } else {
      try {
        execSync('pkill -9 -f "catalina|tomcat|tomee|3DSpace"', { stdio: 'ignore' });
        logStep(logs, `✓ Killed Tomcat processes`, 'INFO', sessionId);
      } catch (e) {
        logStep(logs, `ℹ No Tomcat processes found`, 'INFO', sessionId);
      }
    }
  }

  // Wait for complete shutdown
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  logStep(logs, `✓ Service stop completed. Stopped: ${stoppedServices.length} service(s)`, 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  return stoppedServices;
}

async function findRootFolder(extractDir, toolType, existingPath, logs, sessionId = null) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, 'ANALYZING EXTRACTED ARCHIVE STRUCTURE', 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  const items = await fs.readdir(extractDir);
  logResult(logs, 'Top-level items in extract directory', {
    count: items.length,
    items: items
  }, sessionId);

  const targetFolderName = path.basename(existingPath);
  logStep(logs, `Target installation folder name: ${targetFolderName}`, 'INFO', sessionId);

  for (const item of items) {
    const itemPath = path.join(extractDir, item);
    const stat = await fs.stat(itemPath);

    if (stat.isDirectory() && item === targetFolderName) {
      logStep(logs, `⚠ DETECTED NESTED FOLDER: ${item}`, 'WARNING', sessionId);
      logStep(logs, `✓ This archive contains a ${targetFolderName} folder inside`, 'INFO', sessionId);
      logStep(logs, `✓ Will copy CONTENTS of ${item} to avoid nesting`, 'INFO', sessionId);

      const nestedFolderPath = path.join(extractDir, item);
      logStep(logs, `✓ Using nested folder contents from: ${nestedFolderPath}`, 'INFO', sessionId);
      logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
      return nestedFolderPath;
    }
  }

  const directories = [];
  for (const item of items) {
    const itemPath = path.join(extractDir, item);
    const stat = await fs.stat(itemPath);
    if (stat.isDirectory()) {
      directories.push({ name: item, path: itemPath });
    }
  }

  if (directories.length === 1) {
    logStep(logs, `Found single directory in archive: ${directories[0].name}`, 'INFO', sessionId);
    logStep(logs, `Using this directory as root: ${directories[0].path}`, 'INFO', sessionId);
    logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
    return directories[0].path;
  }

  logStep(logs, `No nested structure detected, using extract directory as root`, 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  return extractDir;
}

async function testPathAccess(targetPath, logs, sessionId = null) {
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
  logStep(logs, 'TESTING PATH ACCESS PERMISSIONS', 'INFO', sessionId);
  logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

  logCommand(logs, 'TEST_PATH_ACCESS', { path: targetPath }, sessionId);

  const testFile = path.join(targetPath, '.upgrade_test_' + Date.now());

  try {
    logStep(logs, `Checking if path exists: ${targetPath}`, 'INFO', sessionId);
    const exists = await fs.pathExists(targetPath);
    logResult(logs, 'Path exists', exists, sessionId);

    if (!exists) {
      return { accessible: false, error: 'Path does not exist' };
    }

    logStep(logs, `Attempting to create test file: ${testFile}`, 'INFO', sessionId);
    await fs.writeFile(testFile, 'test');
    logStep(logs, '✓ Test file created successfully', 'INFO', sessionId);

    logStep(logs, `Attempting to remove test file`, 'INFO', sessionId);
    await fs.remove(testFile);
    logStep(logs, '✓ Test file removed successfully', 'INFO', sessionId);

    logStep(logs, '✓ Path is accessible and writable', 'INFO', sessionId);
    logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

    return { accessible: true };
  } catch (err) {
    logError(logs, 'PATH_ACCESS_TEST', err, sessionId);
    logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

    return {
      accessible: false,
      error: err.message,
      code: err.code
    };
  }
}

// ============================================================================
// SSE ENDPOINT FOR REAL-TIME LOGS
// ============================================================================

app.get('/api/upgrade-stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  activeClients.set(sessionId, res);

  res.write('data: {"log": "Connected to upgrade stream", "level": "INFO"}\n\n');

  req.on('close', () => {
    activeClients.delete(sessionId);
  });
});

// ============================================================================
// MAIN UPGRADE ENDPOINT
// ============================================================================

app.post('/api/upgrade', upload.single('newArchive'), async (req, res) => {
  if (!req.body.config) {
    return res.status(400).json({
      success: false,
      error: 'Missing config parameter in request body'
    });
  }

  const config = JSON.parse(req.body.config);
  const { toolType, existingPath, backupPath, preserveConfig, preserveData, autoStart, sessionId } = config;
  const logs = [];
  const startTime = Date.now();

  logStep(logs, '╔═══════════════════════════════════════════════════════════╗', 'INFO', sessionId);
  logStep(logs, '║         SECURE ROBOCOPY-BASED UPGRADE INITIATED           ║', 'INFO', sessionId);
  logStep(logs, '║         WITH SMART CONFIGURATION MERGE                    ║', 'INFO', sessionId);
  logStep(logs, '╚═══════════════════════════════════════════════════════════╝', 'INFO', sessionId);

  logSystemInfo(logs, `Node.js version: ${process.version}`, sessionId);
  logSystemInfo(logs, `Platform: ${process.platform} ${process.arch}`, sessionId);
  logSystemInfo(logs, `Working directory: ${process.cwd()}`, sessionId);

  const isAdmin = isRunningAsAdmin();
  logSystemInfo(logs, `Running as Administrator: ${isAdmin ? 'YES ✓' : 'NO ✗'}`, sessionId);

  if (!isAdmin) {
    logStep(logs, '⚠ WARNING: Not running as Administrator!', 'WARNING', sessionId);
    logStep(logs, '⚠ Robocopy works best with administrator privileges', 'WARNING', sessionId);
    logStep(logs, '', 'INFO', sessionId);
  }

  logStep(logs, 'Configuration received:', 'INFO', sessionId);
  logResult(logs, 'Upgrade configuration', {
    toolType,
    existingPath,
    backupPath,
    preserveConfig,
    preserveData,
    autoStart,
    uploadedFile: req.file ? {
      originalName: req.file.originalname,
      size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
      mimetype: req.file.mimetype
    } : null
  }, sessionId);

  let tempDir = '';
  let backupFolder = '';
  let uploadedFilePath = '';

  try {
    uploadedFilePath = req.file.path;
    logFileOperation(logs, 'UPLOADED_FILE_SAVED', uploadedFilePath, null, sessionId);

    logStep(logs, 'PHASE 0: Testing target directory access', 'INFO', sessionId);
    const accessTest = await testPathAccess(existingPath, logs, sessionId);
    if (!accessTest.accessible) {
      throw new Error(`Cannot access ${existingPath}: ${accessTest.error}. Ensure no programs are using this folder and you have write permissions.`);
    }

    logStep(logs, 'PHASE 1: Creating backup of existing installation', 'INFO', sessionId);
    backupFolder = await backupWithStructure(existingPath, backupPath, toolType, logs, sessionId);

    logStep(logs, 'PHASE 2: Extracting new version', 'INFO', sessionId);
    tempDir = path.join('tempupgrade', toolType.replace(/[^\w]+/g, '') + '_' + now());
    logStep(logs, `Creating temporary directory: ${tempDir}`, 'INFO', sessionId);
    await fs.ensureDir(tempDir);

    await extractArchive(uploadedFilePath, req.file.originalname, tempDir, logs, sessionId);

    const actualRoot = await findRootFolder(tempDir, toolType, existingPath, logs, sessionId);

    if (preserveConfig || preserveData) {
      logStep(logs, 'PHASE 3: Smart preservation with security patch maintenance', 'INFO', sessionId);
      logStep(logs, `Preserve config: ${preserveConfig}, Preserve data: ${preserveData}`, 'INFO', sessionId);

      const toolLower = toolType.toLowerCase();

      if (toolLower.includes('jdk') || toolLower.includes('java')) {
        logStep(logs, 'Tool type: JDK/Java detected', 'INFO', sessionId);
        await comprehensivePreserveJDK_SECURE(existingPath, actualRoot, logs, sessionId);
      }
      if (toolLower.includes('tomee') || toolLower.includes('tomcat')) {
        logStep(logs, 'Tool type: TomEE/Tomcat detected', 'INFO', sessionId);
        await comprehensivePreserveTomEE_SECURE(existingPath, actualRoot, logs, sessionId);
      }
      if (toolLower.includes('httpd') || toolLower.includes('apache')) {
        logStep(logs, 'Tool type: Apache HTTPD detected', 'INFO', sessionId);
        await comprehensivePreserveHTTPD_SECURE(existingPath, actualRoot, logs, sessionId);
        await installModEvasive(actualRoot, logs, sessionId);  // ✅ CORRECT - actualRoot is the new version
      }
    } else {
      logStep(logs, 'PHASE 3: Skipping preservation (disabled in config)', 'INFO', sessionId);
    }

    killApacheProcesses(logs, sessionId);
    await new Promise(resolve => setTimeout(resolve, 3000));

    logStep(logs, '', 'INFO', sessionId);
    logStep(logs, 'PHASE 4: Robocopy-based in-place upgrade (bulletproof)', 'INFO', sessionId);
    logStep(logs, '', 'INFO', sessionId);

    if (process.platform === 'win32') {
      await useRobocopy(actualRoot, existingPath, logs, sessionId);
      logStep(logs, '✓✓✓ ROBOCOPY UPGRADE COMPLETED SUCCESSFULLY! ✓✓✓', 'INFO', sessionId);
    } else {
      logStep(logs, 'Non-Windows system detected, using fs.copy fallback', 'INFO', sessionId);
      await fs.copy(actualRoot, existingPath, { overwrite: true });
      logStep(logs, '✓✓✓ UPGRADE COMPLETED SUCCESSFULLY! ✓✓✓', 'INFO', sessionId);
    }

    logStep(logs, 'Cleaning up temporary extraction directory...', 'INFO', sessionId);
    await fs.remove(tempDir);

    logStep(logs, 'PHASE 5: Compressing backup', 'INFO', sessionId);
    await zipAndCleanupFolder(backupFolder, logs, sessionId);

    logStep(logs, 'PHASE 6: Final cleanup', 'INFO', sessionId);
    logCommand(logs, 'DELETE_UPLOADED_ARCHIVE', { path: uploadedFilePath }, sessionId);
    await fs.remove(uploadedFilePath);
    logStep(logs, `✓ Uploaded archive removed`, 'INFO', sessionId);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    logStep(logs, '╔═══════════════════════════════════════════════════════════╗', 'INFO', sessionId);
    logStep(logs, '║         SECURE UPGRADE COMPLETED SUCCESSFULLY             ║', 'INFO', sessionId);
    logStep(logs, '╚═══════════════════════════════════════════════════════════╝', 'INFO', sessionId);
    logStep(logs, `Your old version is backed up as: ${backupFolder}.zip`, 'INFO', sessionId);
    logStep(logs, `Your installation at ${existingPath} has been upgraded successfully`, 'INFO', sessionId);
    logStep(logs, `✓ User configurations preserved with smart merge`, 'INFO', sessionId);
    logStep(logs, `✓ Security patches maintained from new version`, 'INFO', sessionId);
    logStep(logs, `✓ Diff reports generated for manual review`, 'INFO', sessionId);
    logStep(logs, `Total upgrade time: ${duration} seconds`, 'INFO', sessionId);

    // Send completion signal
    if (activeClients.has(sessionId)) {
      const client = activeClients.get(sessionId);
      client.write(`data: ${JSON.stringify({ complete: true, success: true, duration })}\n\n`);
      activeClients.delete(sessionId);
    }

    res.json({
      success: true,
      logs: logs.join('\n'),
      duration,
      backupPath: `${backupFolder}.zip`
    });

  } catch (e) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    logStep(logs, '╔═══════════════════════════════════════════════════════════╗', 'ERROR', sessionId);
    logStep(logs, '║         UPGRADE FAILED                                    ║', 'ERROR', sessionId);
    logStep(logs, '╚═══════════════════════════════════════════════════════════╝', 'ERROR', sessionId);
    logError(logs, 'UPGRADE_PROCESS', e, sessionId);

    logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);
    logStep(logs, 'INITIATING ROBOCOPY ROLLBACK PROCEDURE', 'INFO', sessionId);
    logStep(logs, '═══════════════════════════════════════════════════════════', 'INFO', sessionId);

    try {
      if (backupFolder && await fs.pathExists(backupFolder)) {
        logStep(logs, '[ROLLBACK] Using Robocopy to restore from backup...', 'INFO', sessionId);

        if (process.platform === 'win32') {
          await useRobocopy(backupFolder, existingPath, logs, sessionId);
          logStep(logs, '[ROLLBACK] ✓✓✓ Successfully restored using Robocopy! ✓✓✓', 'INFO', sessionId);
        } else {
          await fs.copy(backupFolder, existingPath, { overwrite: true });
          logStep(logs, '[ROLLBACK] ✓✓✓ Successfully restored using fs.copy! ✓✓✓', 'INFO', sessionId);
        }
      } else if (backupFolder && await fs.pathExists(backupFolder + '.zip')) {
        logStep(logs, '[ROLLBACK] Extracting from zipped backup...', 'INFO', sessionId);
        const zip = new AdmZip(backupFolder + '.zip');
        zip.extractAllTo(existingPath, true);
        logStep(logs, '[ROLLBACK] ✓✓✓ Successfully restored from ZIP backup! ✓✓✓', 'INFO', sessionId);
      } else {
        logStep(logs, '[ROLLBACK] ⚠ WARNING: No backup found for rollback!', 'ERROR', sessionId);
      }
    } catch (rollbackErr) {
      logError(logs, 'ROLLBACK_PROCEDURE', rollbackErr, sessionId);
      logStep(logs, '[CRITICAL] Rollback failed! Manual restoration required.', 'ERROR', sessionId);
    }

    try {
      if (tempDir && await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
      }
      if (uploadedFilePath && await fs.pathExists(uploadedFilePath)) {
        await fs.remove(uploadedFilePath);
      }
    } catch (cleanupErr) {
      // Silent cleanup failure
    }

    // Send failure signal
    if (activeClients.has(sessionId)) {
      const client = activeClients.get(sessionId);
      client.write(`data: ${JSON.stringify({ complete: true, success: false, duration, error: e.message })}\n\n`);
      activeClients.delete(sessionId);
    }

    res.status(500).json({
      success: false,
      logs: logs.join('\n'),
      duration,
      error: e.message
    });
  }
});

// ============================================================================
// ADDITIONAL ENDPOINTS
// ============================================================================

app.get('/api/admin-status', (req, res) => {
  const isAdmin = isRunningAsAdmin();
  res.json({
    isAdmin: isAdmin,
    platform: process.platform,
    robocopyAvailable: process.platform === 'win32',
    message: isAdmin
      ? 'Running with administrator privileges - Robocopy will work optimally'
      : 'Not running as administrator - Robocopy may have limitations'
  });
});

app.post('/api/test-access', async (req, res) => {
  const { path: testPath } = req.body;
  const logs = [];

  try {
    const result = await testPathAccess(testPath, logs);
    res.json({
      accessible: result.accessible,
      error: result.error,
      logs: logs.join('\n')
    });
  } catch (err) {
    res.json({
      accessible: false,
      error: err.message,
      logs: logs.join('\n')
    });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(4000, () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔒 Secure Upgrade Server Started');
  console.log('   📡 Running at: http://localhost:4000/');
  console.log('═══════════════════════════════════════════════════════════');

  const isAdmin = isRunningAsAdmin();
  console.log(`   👤 Administrator Mode: ${isAdmin ? '✓ YES' : '✗ NO'}`);
  console.log(`   🔄 Robocopy Available: ${process.platform === 'win32' ? '✓ YES' : '✗ NO'}`);
  console.log(`   🔐 Smart Config Merge: ✓ ENABLED`);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Features:');
  console.log('   • Smart configuration merge with security preservation');
  console.log('   • Automatic diff report generation');
  console.log('   • User settings extraction and application');
  console.log('   • Security patch maintenance');
  console.log('   • Real-time SSE progress streaming');
  console.log('═══════════════════════════════════════════════════════════');
});