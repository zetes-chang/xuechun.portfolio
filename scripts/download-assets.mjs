import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const manifestPath = path.resolve(rootDir, 'data/assets.manifest.json');
const reportPath = path.resolve(rootDir, 'data/assets.download-report.json');
const concurrency = Number(process.env.DOWNLOAD_CONCURRENCY || '6');
const maxRetries = Number(process.env.DOWNLOAD_MAX_RETRIES || '3');

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Manifest file not found: ${manifestPath}. Run npm run extract:assets first.`);
}

const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
const assets = manifest.assets || [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadWithRetry(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      return {
        ok: true,
        attempt,
        statusCode: response.status,
        bytes
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await sleep(500 * attempt);
      }
    }
  }

  return {
    ok: false,
    attempt: maxRetries,
    statusCode: null,
    error: String(lastError?.message || lastError || 'Unknown error')
  };
}

const results = [];
let index = 0;

async function worker() {
  while (true) {
    const current = index;
    index += 1;

    if (current >= assets.length) {
      break;
    }

    const asset = assets[current];
    const outputFile = path.resolve(rootDir, asset.localPath);
    const fetchUrl = asset.downloadUrl || asset.url;

    const result = await downloadWithRetry(fetchUrl);

    if (result.ok) {
      await fsp.mkdir(path.dirname(outputFile), { recursive: true });
      await fsp.writeFile(outputFile, result.bytes);

      results.push({
        url: asset.url,
        fetchedFrom: fetchUrl,
        localPath: asset.localPath,
        status: 'downloaded',
        attempts: result.attempt,
        httpStatus: result.statusCode,
        bytes: result.bytes.length
      });

      console.log(`[${current + 1}/${assets.length}] downloaded ${asset.url}`);
    } else {
      results.push({
        url: asset.url,
        fetchedFrom: fetchUrl,
        localPath: asset.localPath,
        status: 'failed',
        attempts: result.attempt,
        httpStatus: result.statusCode,
        bytes: 0,
        error: result.error
      });

      console.log(`[${current + 1}/${assets.length}] failed ${asset.url} (${result.error})`);
    }
  }
}

await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

results.sort((a, b) => a.url.localeCompare(b.url));
const downloaded = results.filter((item) => item.status === 'downloaded').length;
const failed = results.length - downloaded;

const report = {
  generatedAt: new Date().toISOString(),
  total: results.length,
  downloaded,
  failed,
  items: results
};

await fsp.mkdir(path.dirname(reportPath), { recursive: true });
await fsp.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Download report written to ${reportPath}`);
console.log(`downloaded=${downloaded} failed=${failed}`);

if (failed > 0) {
  process.exitCode = 1;
}
