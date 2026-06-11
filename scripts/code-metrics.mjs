#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)));
const reportsDir = join(repoRoot, 'reports');
const jsonPath = join(reportsDir, 'code-metrics.json');
const markdownPath = join(reportsDir, 'code-metrics.md');

const excludedDirectories = new Set([
  '.git',
  '.firebase',
  '.vercel',
  '.vite',
  'coverage',
  'dist',
  'build',
  'node_modules',
  'reports',
]);

const excludedFiles = new Set([
  'package-lock.json',
  'firebase-debug.log',
  'firestore-debug.log',
]);

const languageByExtension = new Map([
  ['.cjs', 'JavaScript'],
  ['.css', 'CSS'],
  ['.html', 'HTML'],
  ['.js', 'JavaScript'],
  ['.json', 'JSON'],
  ['.jsx', 'React JSX'],
  ['.md', 'Markdown'],
  ['.mjs', 'JavaScript'],
  ['.rules', 'Firebase Rules'],
  ['.sh', 'Shell'],
  ['.svg', 'SVG'],
  ['.ts', 'TypeScript'],
  ['.tsx', 'React TSX'],
  ['.txt', 'Text'],
  ['.yml', 'YAML'],
  ['.yaml', 'YAML'],
]);

const binaryExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpg',
  '.jpeg',
  '.otf',
  '.pdf',
  '.png',
  '.ttf',
  '.webp',
  '.woff',
  '.woff2',
]);

function normalizePath(pathname) {
  return pathname.split(sep).join('/');
}

function shouldSkipDirectory(directoryName) {
  return excludedDirectories.has(directoryName);
}

function shouldSkipFile(fileName) {
  return fileName.startsWith('.env') || excludedFiles.has(fileName);
}

function getLanguage(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (binaryExtensions.has(ext)) return null;
  return languageByExtension.get(ext) ?? 'Other';
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(entry.name)) {
        files.push(...await walk(fullPath));
      }
      continue;
    }

    if (!entry.isFile() || shouldSkipFile(entry.name)) {
      continue;
    }

    const language = getLanguage(entry.name);
    if (!language) {
      continue;
    }

    files.push({ fullPath, language });
  }

  return files;
}

function countLines(content) {
  if (content.length === 0) {
    return { lines: 0, blankLines: 0, nonBlankLines: 0 };
  }

  const lines = content.split(/\r\n|\n|\r/);
  if (lines.at(-1) === '') {
    lines.pop();
  }

  const blankLines = lines.filter((line) => line.trim() === '').length;
  return {
    lines: lines.length,
    blankLines,
    nonBlankLines: lines.length - blankLines,
  };
}

function createEmptyBucket(language) {
  return {
    language,
    files: 0,
    bytes: 0,
    lines: 0,
    blankLines: 0,
    nonBlankLines: 0,
  };
}

function addToBucket(bucket, fileMetrics) {
  bucket.files += 1;
  bucket.bytes += fileMetrics.bytes;
  bucket.lines += fileMetrics.lines;
  bucket.blankLines += fileMetrics.blankLines;
  bucket.nonBlankLines += fileMetrics.nonBlankLines;
}

function sortBuckets(buckets) {
  return [...buckets].sort((a, b) => {
    if (b.lines !== a.lines) return b.lines - a.lines;
    return a.language.localeCompare(b.language);
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function toMarkdown(report) {
  const rows = report.languages
    .map((item) => `| ${item.language} | ${formatNumber(item.files)} | ${formatNumber(item.lines)} | ${formatNumber(item.nonBlankLines)} | ${formatNumber(item.blankLines)} | ${formatNumber(item.bytes)} |`)
    .join('\n');

  const topFiles = report.topFiles
    .map((item, index) => `${index + 1}. \`${item.path}\` — ${formatNumber(item.lines)} lines`)
    .join('\n');

  return `# Code Metrics Report\n\nGenerated: ${report.generatedAt}\n\n## Summary\n\n- Files: ${formatNumber(report.totals.files)}\n- Lines: ${formatNumber(report.totals.lines)}\n- Non-blank lines: ${formatNumber(report.totals.nonBlankLines)}\n- Blank lines: ${formatNumber(report.totals.blankLines)}\n- Bytes: ${formatNumber(report.totals.bytes)}\n\n## By language\n\n| Language | Files | Lines | Non-blank | Blank | Bytes |\n|---|---:|---:|---:|---:|---:|\n${rows}\n\n## Top files by line count\n\n${topFiles}\n`;
}

async function main() {
  const files = await walk(repoRoot);
  const byLanguage = new Map();
  const totals = createEmptyBucket('Total');
  const fileMetrics = [];

  for (const file of files) {
    const buffer = await readFile(file.fullPath);
    const content = buffer.toString('utf8');
    const counts = countLines(content);
    const metrics = {
      path: normalizePath(relative(repoRoot, file.fullPath)),
      language: file.language,
      bytes: buffer.byteLength,
      ...counts,
    };

    fileMetrics.push(metrics);
    addToBucket(totals, metrics);

    if (!byLanguage.has(file.language)) {
      byLanguage.set(file.language, createEmptyBucket(file.language));
    }
    addToBucket(byLanguage.get(file.language), metrics);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    repository: 'peachtukta1014/chinchaflow',
    totals: {
      files: totals.files,
      bytes: totals.bytes,
      lines: totals.lines,
      blankLines: totals.blankLines,
      nonBlankLines: totals.nonBlankLines,
    },
    languages: sortBuckets(byLanguage.values()),
    topFiles: fileMetrics
      .sort((a, b) => {
        if (b.lines !== a.lines) return b.lines - a.lines;
        return a.path.localeCompare(b.path);
      })
      .slice(0, 20),
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(markdownPath, toMarkdown(report));

  console.log(`Code metrics written to ${normalizePath(relative(repoRoot, jsonPath))} and ${normalizePath(relative(repoRoot, markdownPath))}`);
  console.log(`Files: ${formatNumber(report.totals.files)} | Lines: ${formatNumber(report.totals.lines)} | Languages: ${formatNumber(report.languages.length)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
