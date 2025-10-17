#!/usr/bin/env node
/**
 * Prepare files for pkg by converting .mjs to .js
 * pkg has issues with .mjs bytecode compilation
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🔧 Preparing files for pkg compilation...\n');

async function convertMjsToJs() {
  const files = [
    { from: 'server.mjs', to: 'server.js' },
    { from: 'configMerger.mjs', to: 'configMerger.js' }
  ];

  for (const file of files) {
    const fromPath = path.join(rootDir, file.from);
    const toPath = path.join(rootDir, file.to);

    if (await fs.pathExists(fromPath)) {
      let content = await fs.readFile(fromPath, 'utf8');
      
      // Update imports from .mjs to .js
      content = content.replace(/from\s+['"](.*)\.mjs['"]/g, "from '$1.js'");
      content = content.replace(/import\s+['"](.*)\.mjs['"]/g, "import '$1.js'");
      
      await fs.writeFile(toPath, content, 'utf8');
      console.log(`✓ Converted ${file.from} → ${file.to}`);
    } else {
      console.warn(`⚠ Warning: ${file.from} not found`);
    }
  }

  // Update package.json bin and pkg.scripts temporarily
  const pkgJsonPath = path.join(rootDir, 'package.json');
  const pkgJson = await fs.readJson(pkgJsonPath);
  
  const originalPkgJson = { ...pkgJson };
  
  pkgJson.bin = 'server.js';
  pkgJson.pkg.scripts = ['server.js', 'configMerger.js'];
  
  await fs.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2), 'utf8');
  console.log('✓ Updated package.json for pkg');
  
  console.log('\n✅ Preparation complete. Ready for pkg compilation.\n');
  
  // Restore original package.json after pkg runs
  process.on('exit', async () => {
    try {
      await fs.writeFile(pkgJsonPath, JSON.stringify(originalPkgJson, null, 2), 'utf8');
      await fs.remove(path.join(rootDir, 'server.js'));
      await fs.remove(path.join(rootDir, 'configMerger.js'));
    } catch (e) {
      // Ignore cleanup errors
    }
  });
}

convertMjsToJs().catch(err => {
  console.error('Error preparing files:', err);
  process.exit(1);
});