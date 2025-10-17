#!/usr/bin/env node
/**
 * Entry point for pkg-compiled executable
 * Loads the ES module server
 */

import('./server.mjs').catch(err => {
  console.error('Failed to start server:', err);
  console.error('\nPress any key to exit...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', process.exit.bind(process, 1));
});