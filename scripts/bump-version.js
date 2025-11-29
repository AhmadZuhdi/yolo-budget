#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const bumpType = process.argv[2];

if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('Usage: npm run bump [major|minor|patch]');
  console.error('Example: npm run bump patch');
  process.exit(1);
}

const [major, minor, patch] = packageJson.version.split('.').map(Number);

let newVersion;
switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

packageJson.version = newVersion;

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✅ Version bumped from ${major}.${minor}.${patch} to ${newVersion}`);
