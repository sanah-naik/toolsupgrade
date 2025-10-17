#!/usr/bin/env node
/**
 * Complete Packaging Script for Tool Upgrade Manager
 * Creates a standalone executable with embedded frontend
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  appName: 'ToolUpgradeManager',
  version: '1.0.0',
  outputDir: path.join(__dirname, 'dist'),
  buildDir: path.join(__dirname, 'build'),
  platforms: ['win', 'linux'], // 'macos' if needed
};

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║     Tool Upgrade Manager - Packaging Script              ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

async function cleanDirs() {
  console.log('🧹 Cleaning previous builds...');
  await fs.remove(CONFIG.outputDir);
  await fs.remove(CONFIG.buildDir);
  await fs.ensureDir(CONFIG.outputDir);
  await fs.ensureDir(CONFIG.buildDir);
  console.log('✓ Directories cleaned\n');
}

async function buildFrontend() {
  console.log('🔨 Building React frontend...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✓ Frontend built successfully\n');
    return true;
  } catch (error) {
    console.error('✗ Frontend build failed:', error.message);
    return false;
  }
}

async function createProductionServer() {
  console.log('🔧 Creating production server...');
  
  const serverCode = `import express from 'express';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import cors from 'cors';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { smartMergeConfiguration } from './configMerger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true, limit: '2gb' }));
app.use(express.json({ limit: '2gb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'frontend')));

// CORS headers
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

// Import all functions from original server.mjs
${await fs.readFile('server.mjs', 'utf8')}

// Fallback route - serve index.html for SPA routing
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🚀 Tool Upgrade Manager Started');
  console.log('   📡 Server: http://localhost:' + PORT);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Features:');
  console.log('   • Smart configuration merge');
  console.log('   • Automatic backup & rollback');
  console.log('   • Real-time progress tracking');
  console.log('   • VAPT security hardening');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('   👉 Open your browser and navigate to the URL above');
  console.log('   👉 Press Ctrl+C to stop the server');
  console.log('');
});
`;

  await fs.writeFile(
    path.join(CONFIG.buildDir, 'server-production.mjs'),
    serverCode,
    'utf8'
  );
  
  console.log('✓ Production server created\n');
}

async function copyBackendFiles() {
  console.log('📦 Copying backend files...');
  
  const filesToCopy = [
    'configMerger.mjs',
    'package.json',
  ];
  
  for (const file of filesToCopy) {
    await fs.copy(file, path.join(CONFIG.buildDir, file));
    console.log(`  ✓ Copied ${file}`);
  }
  
  // Copy frontend build
  await fs.copy('dist', path.join(CONFIG.buildDir, 'frontend'));
  console.log('  ✓ Copied frontend build');
  
  console.log('✓ Backend files copied\n');
}

async function installProductionDependencies() {
  console.log('📥 Installing production dependencies...');
  
  const productionPackageJson = {
    name: CONFIG.appName.toLowerCase(),
    version: CONFIG.version,
    type: 'module',
    main: 'server-production.mjs',
    scripts: {
      start: 'node server-production.mjs'
    },
    dependencies: {
      'express': '^4.18.2',
      'multer': '^1.4.5-lts.1',
      'fs-extra': '^11.2.0',
      'adm-zip': '^0.5.10',
      'tar': '^6.2.0',
      'cors': '^2.8.5',
      'fast-xml-parser': '^4.3.2'
    }
  };
  
  await fs.writeFile(
    path.join(CONFIG.buildDir, 'package.json'),
    JSON.stringify(productionPackageJson, null, 2),
    'utf8'
  );
  
  try {
    execSync('npm install --omit=dev', {
      cwd: CONFIG.buildDir,
      stdio: 'inherit'
    });
    console.log('✓ Dependencies installed\n');
    return true;
  } catch (error) {
    console.error('✗ Failed to install dependencies:', error.message);
    return false;
  }
}

async function createExecutables() {
  console.log('🎁 Creating executables...');
  
  // Check if pkg is installed
  try {
    execSync('pkg --version', { stdio: 'pipe' });
  } catch (error) {
    console.log('  Installing pkg globally...');
    execSync('npm install -g pkg', { stdio: 'inherit' });
  }
  
  // Create executables for each platform
  for (const platform of CONFIG.platforms) {
    console.log(`  Building for ${platform}...`);
    
    const target = platform === 'win' ? 'node18-win-x64' :
                   platform === 'linux' ? 'node18-linux-x64' :
                   'node18-macos-x64';
    
    const outputName = platform === 'win' 
      ? `${CONFIG.appName}.exe` 
      : CONFIG.appName;
    
    try {
      execSync(
        `pkg server-production.mjs --targets ${target} --output ${path.join('../dist', outputName)}`,
        {
          cwd: CONFIG.buildDir,
          stdio: 'inherit'
        }
      );
      console.log(`  ✓ Created ${outputName}`);
    } catch (error) {
      console.error(`  ✗ Failed to create executable for ${platform}`);
    }
  }
  
  console.log('✓ Executables created\n');
}

async function createPortablePackage() {
  console.log('📦 Creating portable package...');
  
  const portableDir = path.join(CONFIG.outputDir, 'portable');
  await fs.ensureDir(portableDir);
  
  // Copy all necessary files
  await fs.copy(CONFIG.buildDir, portableDir);
  
  // Create start scripts
  const startScriptWin = `@echo off
echo Starting Tool Upgrade Manager...
node server-production.mjs
pause`;
  
  const startScriptLinux = `#!/bin/bash
echo "Starting Tool Upgrade Manager..."
node server-production.mjs`;
  
  await fs.writeFile(
    path.join(portableDir, 'start.bat'),
    startScriptWin,
    'utf8'
  );
  
  await fs.writeFile(
    path.join(portableDir, 'start.sh'),
    startScriptLinux,
    'utf8'
  );
  
  // Make shell script executable on Unix
  if (process.platform !== 'win32') {
    await fs.chmod(path.join(portableDir, 'start.sh'), '755');
  }
  
  console.log('✓ Portable package created\n');
}

async function createReadme() {
  console.log('📝 Creating README...');
  
  const readme = `# ${CONFIG.appName} v${CONFIG.version}

## Installation & Usage

### Option 1: Portable Package (Requires Node.js)

1. Extract the 'portable' folder
2. Windows: Double-click \`start.bat\`
3. Linux/Mac: Run \`./start.sh\`
4. Open browser at http://localhost:4000

### Option 2: Standalone Executable (No Node.js Required)

1. Run the executable for your platform:
   - Windows: \`${CONFIG.appName}.exe\`
   - Linux: \`./${CONFIG.appName}\`
2. Open browser at http://localhost:4000

## Requirements

### For Portable Package:
- Node.js 18+ (https://nodejs.org)

### For Standalone Executable:
- Windows 10+ / Linux (Ubuntu 20.04+) / macOS 10.15+
- Administrator/root privileges for service operations

## Features

✓ **Smart Configuration Merge**
  - Preserves user settings
  - Applies security patches from new versions
  - Generates detailed diff reports

✓ **Automatic Backup & Rollback**
  - Complete backup before upgrade
  - Automatic rollback on failure
  - Compressed backup storage

✓ **Real-time Progress Tracking**
  - Live log streaming
  - Phase-by-phase progress
  - Detailed error reporting

✓ **VAPT Security Hardening**
  - Apache HTTPD security configurations
  - Tomcat/TomEE security settings
  - JDK certificate management

## Supported Tools

- Apache HTTP Server
- Apache Tomcat / TomEE
- OpenJDK / Java

## Security Notes

- Always run as Administrator (Windows) or root (Linux)
- Verify backups are created before upgrades
- Review diff reports after upgrades
- Test in non-production environment first

## Troubleshooting

**"Access Denied" errors:**
- Run as Administrator/root
- Stop all services manually before upgrade
- Check file permissions

**"Service not found" errors:**
- Services are auto-detected
- Manual stop/start may be required for custom services

**Upload failures:**
- Check archive format (.zip, .tar.gz, .tar)
- Ensure sufficient disk space
- Verify archive is not corrupted

## Support

For issues or questions, check the logs in the application
or review the generated diff reports.

---

Built with ❤️ for safe, zero-downtime upgrades
`;
  
  await fs.writeFile(
    path.join(CONFIG.outputDir, 'README.md'),
    readme,
    'utf8'
  );
  
  console.log('✓ README created\n');
}

async function main() {
  try {
    await cleanDirs();
    
    if (!await buildFrontend()) {
      throw new Error('Frontend build failed');
    }
    
    await createProductionServer();
    await copyBackendFiles();
    
    if (!await installProductionDependencies()) {
      throw new Error('Dependency installation failed');
    }
    
    await createExecutables();
    await createPortablePackage();
    await createReadme();
    
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║     ✓ PACKAGING COMPLETED SUCCESSFULLY                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📦 Output directory:', CONFIG.outputDir);
    console.log('');
    console.log('Available packages:');
    console.log('  • Standalone executables in dist/');
    console.log('  • Portable package in dist/portable/');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test the executable: ./dist/' + CONFIG.appName);
    console.log('  2. Or test portable: cd dist/portable && npm start');
    console.log('  3. Distribute to users');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('╔═══════════════════════════════════════════════════════════╗');
    console.error('║     ✗ PACKAGING FAILED                                   ║');
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();