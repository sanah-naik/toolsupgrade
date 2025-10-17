#!/usr/bin/env node
/**
 * Create a portable, production-ready package
 * More reliable than pkg for ES modules
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║   Creating Portable Package for Tool Upgrade Manager     ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

async function createPortable() {
  const deployDir = path.join(__dirname, 'deploy');
  
  // Step 1: Clean and create deploy directory
  console.log('📁 Creating deployment directory...');
  await fs.remove(deployDir);
  await fs.ensureDir(deployDir);
  
  // Step 2: Build frontend
  console.log('🔨 Building frontend...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Frontend build failed');
    process.exit(1);
  }
  
  // Step 3: Copy files
  console.log('📦 Copying files...');
  
  // Copy frontend build
  await fs.copy('dist', path.join(deployDir, 'dist'));
  console.log('  ✓ Frontend build copied');
  
  // Copy backend files
  await fs.copy('server.mjs', path.join(deployDir, 'server.mjs'));
  await fs.copy('configMerger.mjs', path.join(deployDir, 'configMerger.mjs'));
  console.log('  ✓ Backend files copied');
  
  // Step 4: Update server to serve frontend
  console.log('🔧 Configuring production server...');
  
  let serverContent = await fs.readFile(path.join(deployDir, 'server.mjs'), 'utf8');
  
  // Add static file serving after cors setup
  const insertAfter = 'app.use(express.json({ limit: \'2gb\' }));';
  const staticServing = `

// ============================================================================
// SERVE STATIC FRONTEND FILES
// ============================================================================
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve React frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback route for React Router (SPA)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
`;
  
  serverContent = serverContent.replace(insertAfter, insertAfter + staticServing);
  await fs.writeFile(path.join(deployDir, 'server.mjs'), serverContent, 'utf8');
  console.log('  ✓ Server configured for production');
  
  // Step 5: Create production package.json
  console.log('📝 Creating production package.json...');
  
  const prodPackageJson = {
    name: 'tool-upgrade-manager',
    version: '1.0.0',
    type: 'module',
    description: 'Smart tool upgrade manager - Production',
    main: 'server.mjs',
    scripts: {
      start: 'node server.mjs'
    },
    dependencies: {
      '@supabase/supabase-js': '^2.57.4',
      'adm-zip': '^0.5.16',
      'cors': '^2.8.5',
      'express': '^5.1.0',
      'fast-xml-parser': '^5.3.0',
      'fs-extra': '^11.3.2',
      'graceful-fs': '^4.2.11',
      'jspdf': '^3.0.3',
      'jspdf-autotable': '^5.0.2',
      'multer': '^2.0.2',
      'tar': '^7.5.1'
    },
    engines: {
      'node': '>=18.0.0'
    }
  };
  
  await fs.writeFile(
    path.join(deployDir, 'package.json'),
    JSON.stringify(prodPackageJson, null, 2),
    'utf8'
  );
  console.log('  ✓ package.json created');
  
  // Step 6: Install production dependencies
  console.log('📥 Installing production dependencies...');
  try {
    execSync('npm install --production', {
      cwd: deployDir,
      stdio: 'inherit'
    });
    console.log('  ✓ Dependencies installed');
  } catch (err) {
    console.error('❌ Dependency installation failed');
    process.exit(1);
  }
  
  // Step 7: Create start scripts
  console.log('🚀 Creating start scripts...');
  
  // Windows batch file
  const startBat = `@echo off
cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║         Tool Upgrade Manager                              ║
echo ║         Starting server...                                ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo Starting server on http://localhost:4000
echo.
echo Press Ctrl+C to stop the server
echo.

node server.mjs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Server failed to start!
    echo Check the error message above.
    echo.
)

pause
`;
  
  await fs.writeFile(path.join(deployDir, 'start.bat'), startBat, 'utf8');
  
  // Linux shell script
  const startSh = `#!/bin/bash

clear
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         Tool Upgrade Manager                              ║"
echo "║         Starting server...                                ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Node.js version:"
node --version
echo ""

echo "Starting server on http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

node server.mjs

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Server failed to start!"
    echo "Check the error message above."
    echo ""
    read -p "Press Enter to exit..."
fi
`;
  
  await fs.writeFile(path.join(deployDir, 'start.sh'), startSh, 'utf8');
  
  // Make shell script executable
  if (process.platform !== 'win32') {
    try {
      await fs.chmod(path.join(deployDir, 'start.sh'), '755');
    } catch (err) {
      console.warn('  ⚠ Could not set execute permission on start.sh');
    }
  }
  
  console.log('  ✓ start.bat created (Windows)');
  console.log('  ✓ start.sh created (Linux/Mac)');
  
  // Step 8: Create README
  console.log('📄 Creating README...');
  
  const readme = `# Tool Upgrade Manager - Portable Package

## Installation

1. Ensure Node.js 18+ is installed: https://nodejs.org
2. Extract this folder to your desired location
3. Run the start script:
   - **Windows**: Double-click \`start.bat\`
   - **Linux/Mac**: Run \`./start.sh\` in terminal

## Usage

1. The server will start on http://localhost:4000
2. Open your web browser and navigate to that address
3. Follow the on-screen instructions to upgrade your tools

## Features

✓ Smart configuration merge (preserves user settings + applies security patches)
✓ Automatic backup and rollback
✓ Real-time progress tracking
✓ VAPT security hardening
✓ Support for Apache HTTPD, Tomcat/TomEE, and JDK

## Requirements

- Node.js 18 or higher
- Administrator/root privileges for service operations
- Sufficient disk space for backups

## Troubleshooting

**Server won't start:**
- Check if port 4000 is already in use
- Ensure Node.js is properly installed
- Run as Administrator (Windows) or with sudo (Linux)

**Cannot access in browser:**
- Check firewall settings
- Ensure localhost/127.0.0.1 is not blocked
- Try http://127.0.0.1:4000 instead

**Upload fails:**
- Check available disk space
- Verify file format (.zip, .tar.gz, .tar)
- Ensure you have write permissions

## Support

For issues, check the console output when running the start script.
All operations are logged in real-time.

---

Version: 1.0.0
Built: ${new Date().toISOString()}
`;
  
  await fs.writeFile(path.join(deployDir, 'README.md'), readme, 'utf8');
  console.log('  ✓ README.md created');
  
  // Step 9: Success message
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ PORTABLE PACKAGE CREATED SUCCESSFULLY               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📦 Package location: ' + deployDir);
  console.log('');
  console.log('📊 Package contents:');
  console.log('  • server.mjs - Backend server');
  console.log('  • configMerger.mjs - Smart config merger');
  console.log('  • dist/ - Frontend application');
  console.log('  • node_modules/ - Dependencies');
  console.log('  • start.bat - Windows launcher');
  console.log('  • start.sh - Linux/Mac launcher');
  console.log('  • README.md - User instructions');
  console.log('');
  console.log('🧪 Test locally:');
  console.log('  cd deploy');
  console.log('  npm start');
  console.log('');
  console.log('📦 Distribution:');
  console.log('  1. Zip the "deploy" folder');
  console.log('  2. Send to users');
  console.log('  3. Users extract and run start.bat (Windows) or start.sh (Linux)');
  console.log('');
  console.log('💡 Users need Node.js 18+ installed');
  console.log('');
}

createPortable().catch(err => {
  console.error('');
  console.error('❌ Error creating portable package:', err.message);
  process.exit(1);
});