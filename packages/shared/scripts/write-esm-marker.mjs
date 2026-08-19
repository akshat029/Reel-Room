// Marks packages/shared/dist/esm as ES-module output.
// Without this, Node treats dist/esm/*.js as CommonJS (the package has no
// "type": "module") and refuses to load it as ESM.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const esmDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'esm');
mkdirSync(esmDir, { recursive: true });
writeFileSync(join(esmDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 4) + '\n');
console.log('[shared] wrote ' + join(esmDir, 'package.json'));
