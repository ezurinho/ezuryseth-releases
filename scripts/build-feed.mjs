import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';

function fail(message) {
  console.error(`[feed] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) fail(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value) fail(`Missing value for ${key}`);
    values[key.slice(2)] = value;
    index += 1;
  }
  return values;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[character];
  });
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`Missing ${label}: ${filePath}`);
  }
}

const options = parseArgs(process.argv.slice(2));
const tag = String(options.tag || '');
const repo = String(options.repo || '');
const assetsDir = path.resolve(options.assets || 'release-assets');
const outputDir = path.resolve(options.out || 'site');

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  fail(`Expected a stable tag such as v1.38.0, got: ${tag || '(empty)'}`);
}
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
  fail(`Expected owner/repository, got: ${repo || '(empty)'}`);
}

const version = tag.slice(1);
const [owner, repository] = repo.split('/');
const pagesBase =
  repository.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner}.github.io/`
    : `https://${owner}.github.io/${repository}/`;
const installerName = `Ezuryseth-Setup-${version}.exe`;
const blockmapName = `${installerName}.blockmap`;
const installerPath = path.join(assetsDir, installerName);
const blockmapPath = path.join(assetsDir, blockmapName);
const latestPath = path.join(assetsDir, 'latest.yml');

requireFile(installerPath, 'NSIS installer');
requireFile(blockmapPath, 'installer blockmap');
requireFile(latestPath, 'local latest.yml');

const installerStat = fs.statSync(installerPath);
if (fs.statSync(blockmapPath).size === 0) fail('The installer blockmap is empty.');

const installerSha512 = crypto
  .createHash('sha512')
  .update(fs.readFileSync(installerPath))
  .digest('base64');

let localLatest;
try {
  localLatest = yaml.load(fs.readFileSync(latestPath, 'utf8'));
} catch (error) {
  fail(`Cannot parse the local latest.yml: ${error.message}`);
}
if (!localLatest || typeof localLatest !== 'object' || Array.isArray(localLatest)) {
  fail('The local latest.yml is not an object.');
}
if (String(localLatest.version || '') !== version) {
  fail(`latest.yml version ${localLatest.version || '(missing)'} does not match ${version}.`);
}

const entries = Array.isArray(localLatest.files) ? localLatest.files : [];
const entry =
  entries.find((item) => item && String(item.url || '') === installerName) || entries[0];
if (!entry) fail('latest.yml has no installer entry.');
if (String(entry.url || '') !== installerName) {
  fail(`latest.yml points to ${entry.url}, expected ${installerName}.`);
}
if (String(localLatest.path || installerName) !== installerName) {
  fail(`latest.yml path is ${localLatest.path}, expected ${installerName}.`);
}
if (String(localLatest.sha512 || '') !== installerSha512) {
  fail('latest.yml SHA-512 does not match the installer.');
}
if (String(entry.sha512 || '') !== installerSha512) {
  fail('The installer entry SHA-512 does not match the installer.');
}
if (entry.size != null && Number(entry.size) !== installerStat.size) {
  fail('The installer entry size does not match the installer.');
}

const releaseAssetBase = `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}`;
const installerUrl = `${releaseAssetBase}/${encodeURIComponent(installerName)}`;
const releaseDate =
  typeof localLatest.releaseDate === 'string' && !Number.isNaN(Date.parse(localLatest.releaseDate))
    ? localLatest.releaseDate
    : new Date().toISOString();

const feed = {
  version,
  files: [
    {
      url: installerUrl,
      sha512: installerSha512,
      size: installerStat.size,
    },
  ],
  path: installerName,
  sha512: installerSha512,
  releaseDate,
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>Ezuryseth ${escapeHtml(version)} release</title>
  <style>
    :root { color-scheme: dark; --bg: #0b0f14; --panel: #121922; --line: #243245; --text: #eef4ff; --muted: #9db0c8; --accent: #65d6a6; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, #172536, var(--bg) 55%); color: var(--text); font: 16px/1.55 "Segoe UI", system-ui, sans-serif; }
    main { width: min(680px, calc(100% - 32px)); padding: 40px; border: 1px solid var(--line); border-radius: 20px; background: color-mix(in srgb, var(--panel) 92%, transparent); box-shadow: 0 24px 80px #0008; }
    .eyebrow { margin: 0 0 10px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(34px, 7vw, 54px); line-height: 1; letter-spacing: -.04em; }
    h1 span { color: var(--accent); }
    p { color: var(--muted); }
    .button { display: inline-block; margin: 16px 0 20px; padding: 13px 20px; border-radius: 10px; background: var(--accent); color: #07110c; font-weight: 800; text-decoration: none; }
    code { color: #c6d6ea; overflow-wrap: anywhere; }
    .meta { margin: 8px 0; font-size: 14px; }
    a { color: #a9d9ff; }
    footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Signed Windows release</p>
    <h1>Ezuryseth <span>${escapeHtml(version)}</span></h1>
    <p>The installer is hosted as a GitHub Release asset. The automatic updater reads the feed below.</p>
    <a class="button" href="${escapeHtml(installerUrl)}">Download Ezuryseth ${escapeHtml(version)}</a>
    <p class="meta">Feed: <code>${escapeHtml(pagesBase)}latest.yml</code></p>
    <p class="meta">SHA-512: <code>${escapeHtml(installerSha512)}</code></p>
    <footer>
      <a href="https://github.com/${escapeHtml(repo)}/releases">Release history</a>
      <span> · </span>
      <a href="https://github.com/${escapeHtml(repo)}">Release repository</a>
    </footer>
  </main>
</body>
</html>
`;

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'latest.yml'), yaml.dump(feed, { lineWidth: -1, noRefs: true }));
fs.writeFileSync(path.join(outputDir, 'index.html'), html);
fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');

console.log(`[feed] Version: ${version}`);
console.log(`[feed] Installer: ${installerName} (${installerStat.size} bytes)`);
console.log(`[feed] SHA-512: ${installerSha512}`);
console.log(`[feed] Feed URL: ${pagesBase}latest.yml`);
console.log(`[feed] Installer URL: ${installerUrl}`);
