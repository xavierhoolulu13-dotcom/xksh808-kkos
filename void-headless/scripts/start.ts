import { execSync } from 'child_process';
import * as path from 'path';

console.log('🔴 VOID-HEADLESS START SEQUENCE');

try {
  execSync('npx ts-node src/index.ts', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env }
  });
} catch (err) {
  console.error('Start failed:', err);
  process.exit(1);
}
