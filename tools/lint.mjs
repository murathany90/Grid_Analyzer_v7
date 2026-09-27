import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['src', 'tests', 'tools'];
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const restrictedLayers = ['map', 'sld', 'features', 'analysis'];
const dgsRoot = path.resolve(root, 'src/importers/dgs');
const maxSourceLines = 10_000;
const noCheckMarker = '@ts-' + 'nocheck';
const forbiddenPatterns = [
  { label: 'dynamic eval call', expression: new RegExp('\\bev' + 'al\\s*\\(') },
  { label: 'dynamic constructor call', expression: new RegExp('\\bnew\\s+' + 'Fun' + 'ction\\s*\\(') },
];
const importPattern = /\b(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;

async function collect(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(fullPath));
    else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function resolveImport(fromFile, specifier) {
  if (specifier.startsWith('@/')) return path.resolve(root, 'src', specifier.slice(2));
  if (specifier.startsWith('src/')) return path.resolve(root, specifier);
  if (specifier.startsWith('.')) return path.resolve(path.dirname(fromFile), specifier);
  return null;
}

function isUnder(directory, parent) {
  const relative = path.relative(parent, directory);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

const errors = [];
const files = (await Promise.all(roots.map(rootName => collect(path.resolve(root, rootName))))).flat();
for (const file of files) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  const source = await readFile(file, 'utf8');
  const lineCount = source.length === 0 ? 0 : source.split(/\r?\n/).length;
  if (lineCount > maxSourceLines) errors.push(`${relative}: ${lineCount} lines exceeds the ${maxSourceLines}-line source limit`);
  if (source.includes(noCheckMarker)) errors.push(`${relative}: ${noCheckMarker} is not allowed`);
  for (const { label, expression } of forbiddenPatterns) {
    if (expression.test(source)) errors.push(`${relative}: ${label} is not allowed`);
  }

  const top = relative.split('/')[1];
  if (relative.startsWith('src/') && restrictedLayers.includes(top)) {
    importPattern.lastIndex = 0;
    for (const match of source.matchAll(importPattern)) {
      const resolved = resolveImport(file, match[1]);
      if (!resolved || !isUnder(resolved, dgsRoot)) continue;
      const targetName = path.basename(resolved).replace(/\.(?:[cm]?[jt]sx?)$/i, '');
      if (targetName !== 'canonical') {
        errors.push(`${relative}: imports raw DGS module ${match[1]}; use the canonical network API`);
      }
    }
  }
}

if (errors.length) {
  console.error(`Architecture lint failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Architecture lint passed for ${files.length} source files.`);
}
