import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const indexPath = join(root, 'dist', 'index.html');
const assetsPath = join(root, 'dist', 'assets');
const brandPattern = /Conecta(?:\s|&nbsp;)+Sa(?:\u00fa|u|&#xFA;|&uacute;)de(?:\s|&nbsp;)+Olinda/i;

assert.equal(existsSync(indexPath), true, 'dist/index.html deve existir após o build');
assert.equal(existsSync(assetsPath), true, 'dist/assets deve existir após o build');

const html = await readFile(indexPath, 'utf8');

assert.doesNotMatch(html, /\bcodex-preview\b/i, 'metadata temporário codex-preview não deve existir');
assert.match(html, brandPattern, 'dist/index.html deve conter a identidade Conecta Saúde Olinda');
assert.match(
  html,
  /Portal municipal para aproximar a popula(?:\u00e7|&ccedil;|&#xE7;)\u00e3o dos servi(?:\u00e7|&ccedil;|&#xE7;)os de sa(?:\u00fa|u|&#xFA;|&uacute;)de de Olinda/i,
  'dist/index.html deve conter a descrição pública final',
);

console.log('OK: artefato dist validado com identidade pública do Conecta Saúde Olinda.');
