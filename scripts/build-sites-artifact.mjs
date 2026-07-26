import { copyFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const serverDir = join(distDir, 'server');
const distOpenAiDir = join(distDir, '.openai');
const hostingConfig = join(root, '.openai', 'hosting.json');
const workerSource = join(root, 'worker', 'sites-worker.mjs');

await stat(join(distDir, 'index.html'));
await stat(hostingConfig);
await stat(workerSource);

await mkdir(serverDir, { recursive: true });
await mkdir(distOpenAiDir, { recursive: true });
await copyFile(workerSource, join(serverDir, 'index.js'));
await copyFile(hostingConfig, join(distOpenAiDir, 'hosting.json'));

console.log('OK: Sites artifact prepared in dist/server/index.js.');
