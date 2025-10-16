// upgrade.mjs
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

const APP_DIR = 'D:/work_dsi/Apps/tools-upgrade-main';
const BACKUP_DIR = `${APP_DIR}_backup_${Date.now()}`;
const NEW_DIR = 'D:/work_dsi/Apps/tools-upgrade-main-new-version'; // adjust as needed
const CONFIGS = ['package.json', 'tsconfig.json', 'tailwind.config.js' /*, add more if needed */];
const SERVICES = ['myapp-service', 'myapp-api']; // Replace with your services!

function log(msg) {
  console.log(`[UPGRADE] ${msg}`);
}

async function backupExisting() {
  log('Backing up existing application...');
  await fs.copy(APP_DIR, BACKUP_DIR, { filter: src => !src.includes('node_modules') });
  log(`Backup created at ${BACKUP_DIR}`);
}

function stopServices() {
  log('Stopping services...');
  SERVICES.forEach(service => {
    try {
      execSync(`sc stop ${service}`);
      log(`Stopped service: ${service}`);
    } catch (err) {
      log(`Error stopping service ${service}: ${err.message}`);
    }
  });
}

async function copyConfigs() {
  log('Copying configuration files...');
  for (const file of CONFIGS) {
    const src = path.join(APP_DIR, file);
    const dest = path.join(NEW_DIR, file);
    if (await fs.exists(src)) {
      await fs.copy(src, dest);
      log(`Copied config: ${file}`);
    }
  }
}

async function upgradeApp() {
  log('Upgrading app...');
  await fs.copy(NEW_DIR, APP_DIR, { overwrite: true });
  log('Files replaced with new version.');
}

function validateUpgrade() {
  log('Validating upgrade...');
  try {
    const pkg = fs.readJsonSync(path.join(APP_DIR, 'package.json'));
    if (!pkg || !pkg.name) throw new Error('Invalid package.json after upgrade');
    log('Validation passed.');
    return true;
  } catch (err) {
    log(`Validation failed: ${err.message}`);
    return false;
  }
}

function startServices() {
  log('Starting services...');
  SERVICES.forEach(service => {
    try {
      execSync(`sc start ${service}`);
      log(`Started service: ${service}`);
    } catch (err) {
      log(`Error starting service ${service}: ${err.message}`);
    }
  });
}

async function main() {
  try {
    await backupExisting();
    stopServices();
    await copyConfigs();
    await upgradeApp();

    if (!validateUpgrade()) {
      log('Upgrade failed. Rolling back...');
      await fs.copy(BACKUP_DIR, APP_DIR, { overwrite: true });
      log('Rollback completed.');
      startServices();
      return;
    }
    startServices();
    log('Upgrade completed successfully.');
  } catch (err) {
    log(`Fatal error: ${err.message}`);
  }
}

main();
