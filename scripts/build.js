import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('favicon.ico', 'dist/favicon.ico');
cpSync('src', 'dist/src', { recursive: true });
console.log('Built static app into dist/');
