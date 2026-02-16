import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const rootDir = process.cwd();
const sourcePath = path.resolve(rootDir, 'data/cargo-state.json');
const outputPath = path.resolve(rootDir, 'data/assets.manifest.json');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`State file not found: ${sourcePath}. Run npm run extract:state first.`);
}

const state = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const pages = state?.pages?.byId || {};

const urlIndex = new Map();

function buildOptimizedMediaUrl(media) {
  const encodedName = encodeURIComponent(media.name).replace(/%2F/g, '/');
  const sourceWidth = Number(media.width) || 1200;
  const fileType = String(media.file_type || media.fileType || '').toLowerCase();
  const isGif = fileType === 'gif';
  const quality = isGif ? 65 : 75;

  let targetWidth = sourceWidth;
  if (isGif) {
    targetWidth = Math.min(sourceWidth, 720);
  } else if (sourceWidth > 1600) {
    targetWidth = 1600;
  } else if (sourceWidth > 900) {
    targetWidth = 1200;
  }

  return `https://freight.cargo.site/w/${targetWidth}/q/${quality}/i/${media.hash}/${encodedName}`;
}

function addAsset(url, source, downloadUrl = null) {
  if (!url) return;
  const clean = url.replace(/\\$/, '');
  if (!urlIndex.has(clean)) {
    urlIndex.set(clean, { url: clean, downloadUrl: downloadUrl || clean, sources: new Set() });
  } else if (downloadUrl) {
    urlIndex.get(clean).downloadUrl = downloadUrl;
  }
  urlIndex.get(clean).sources.add(source);
}

const fileUrlPattern = /https:\/\/(?:freight|static)\.cargo\.site[^"' )>]+?\.(?:png|jpe?g|gif|webp|svg|ico|pdf)(?:\?[^"' )>]*)?/gi;

const stack = [state];
while (stack.length > 0) {
  const current = stack.pop();
  if (current == null) continue;

  if (typeof current === 'string') {
    const matches = current.match(fileUrlPattern) || [];
    for (const match of matches) {
      addAsset(match, 'state-string');
    }
    continue;
  }

  if (Array.isArray(current)) {
    for (const item of current) stack.push(item);
    continue;
  }

  if (typeof current === 'object') {
    for (const value of Object.values(current)) stack.push(value);
  }
}

for (const page of Object.values(pages)) {
  const items = [];
  if (page?.thumbnail?.hash && page?.thumbnail?.name) {
    items.push(page.thumbnail);
  }
  if (Array.isArray(page?.media)) {
    items.push(...page.media);
  }

  for (const item of items) {
    if (!item?.hash || !item?.name) continue;
    const encodedName = encodeURIComponent(item.name).replace(/%2F/g, '/');
    const original = `https://freight.cargo.site/t/original/i/${item.hash}/${encodedName}`;
    const optimized = buildOptimizedMediaUrl(item);
    addAsset(original, 'derived-original', optimized);
  }
}

const safeSegment = (segment) =>
  segment
    .normalize('NFKC')
    .replace(/[^\w.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'asset';

function resolveLocalPath(url) {
  const parsed = new URL(url);
  const segments = parsed.pathname.replace(/^\/+/, '').split('/').filter(Boolean).map(safeSegment);

  let fileName = segments.pop() || 'asset';
  const folderSegments = segments;

  if (parsed.search) {
    const searchHash = crypto.createHash('sha1').update(parsed.search).digest('hex').slice(0, 10);
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex > 0) {
      fileName = `${fileName.slice(0, dotIndex)}__q${searchHash}${fileName.slice(dotIndex)}`;
    } else {
      fileName = `${fileName}__q${searchHash}`;
    }
  }

  return path.join('public', 'assets', 'cargo', parsed.hostname, ...folderSegments, fileName);
}

const assets = Array.from(urlIndex.values())
  .map((entry) => ({
    url: entry.url,
    downloadUrl: entry.downloadUrl || entry.url,
    localPath: resolveLocalPath(entry.url),
    sources: Array.from(entry.sources).sort()
  }))
  .sort((a, b) => a.url.localeCompare(b.url));

const manifest = {
  generatedAt: new Date().toISOString(),
  total: assets.length,
  assets
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Asset manifest written to ${outputPath}`);
console.log(`assets=${assets.length}`);
