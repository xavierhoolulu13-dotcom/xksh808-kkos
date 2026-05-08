import { execSync } from 'child_process';
import * as path from 'path';

console.log('🔨 Building void-headless...');

execSync('npx tsc', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

console.log('✅ Build complete → dist/');
