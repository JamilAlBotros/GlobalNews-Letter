#!/usr/bin/env tsx

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create test-output directory if it doesn't exist
const testOutputDir = path.join(process.cwd(), 'test-output');
if (!fs.existsSync(testOutputDir)) {
  fs.mkdirSync(testOutputDir, { recursive: true });
}

// Generate date-based filename
const now = new Date();
const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
const timeStr = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS
const outputFile = path.join(testOutputDir, `test-results-${dateStr}-${timeStr}.txt`);

console.log(`Running tests and saving output to: ${outputFile}`);

// Start the test process
const testProcess = spawn('npx', ['vitest', 'run'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

// Create write stream for output file
const outputStream = fs.createWriteStream(outputFile);

// Write header with timestamp
outputStream.write(`Test Results - ${now.toISOString()}\n`);
outputStream.write(`=`.repeat(50) + '\n\n');

// Pipe stdout and stderr to both console and file
testProcess.stdout?.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output); // Show in console
  outputStream.write(output);   // Write to file
});

testProcess.stderr?.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output); // Show in console
  outputStream.write(output);   // Write to file
});

testProcess.on('close', (code) => {
  outputStream.write(`\n\nTest process completed with exit code: ${code}\n`);
  outputStream.write(`Timestamp: ${new Date().toISOString()}\n`);
  outputStream.end();
  
  console.log(`\nTest output saved to: ${outputFile}`);
  process.exit(code || 0);
});

testProcess.on('error', (error) => {
  console.error('Failed to start test process:', error);
  outputStream.write(`\nError starting test process: ${error.message}\n`);
  outputStream.end();
  process.exit(1);
});