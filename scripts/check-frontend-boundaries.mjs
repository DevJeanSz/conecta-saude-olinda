import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const frontendDirs = ['components', 'contexts', 'pages', 'services', 'src'];
const frontendFiles = ['App.tsx', 'constants.ts', 'index.tsx', 'types.ts'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const forbidden = [
  '@supabase/supabase-js',
  'firebase',
  'prisma',
  '@prisma/client',
  'drizzle-orm',
  'sequelize',
  'typeorm',
  'mongoose',
  'mongodb',
  'mysql',
  'pg',
  'service_role',
  'service role',
  'DATABASE_URL',
];

const walk = async dir => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (extensions.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const files = [
  ...frontendFiles.map(file => join(root, file)),
  ...(await Promise.all(frontendDirs.map(dir => walk(join(root, dir))))).flat(),
];

const violations = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  const importLines = content
    .split(/\r?\n/)
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => /\b(import|from|require)\b/.test(line) || /DATABASE_URL|service_role|service role/.test(line));

  for (const item of importLines) {
    const lower = item.line.toLowerCase();
    for (const token of forbidden) {
      if (lower.includes(token.toLowerCase())) {
        violations.push(`${relative(root, file)}:${item.index} contem "${token}"`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Frontend com acesso proibido a banco ou credenciais privadas:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('OK: frontend sem imports de banco, ORM ou clientes administrativos.');
