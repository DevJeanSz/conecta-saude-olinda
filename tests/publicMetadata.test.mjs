import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const brandPattern = /Conecta(?:\s|&nbsp;)+Sa(?:\u00fa|u|&#xFA;|&uacute;)de(?:\s|&nbsp;)+Olinda/i;
const descriptionPattern =
  /Portal municipal para aproximar a popula(?:\u00e7|&ccedil;|&#xE7;)\u00e3o dos servi(?:\u00e7|&ccedil;|&#xE7;)os de sa(?:\u00fa|u|&#xFA;|&uacute;)de de Olinda/i;

test('mantem metadados publicos do Conecta Saude Olinda no HTML', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /\bcodex-preview\b/i);
  assert.match(html, brandPattern);
  assert.match(html, descriptionPattern);
  assert.match(html, /<meta\s+property=["']og:title["']\s+content=["']Conecta Sa\u00fade Olinda["']/i);
  assert.match(html, /<meta\s+name=["']twitter:card["']\s+content=["']summary["']/i);
});

test('mantem metadados publicos do Conecta Saude Olinda no manifesto Codex', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../metadata.json', import.meta.url), 'utf8'),
  );

  assert.match(manifest.name, brandPattern);
  assert.match(manifest.description, descriptionPattern);
  assert.deepEqual(manifest.requestFramePermissions, []);
});
