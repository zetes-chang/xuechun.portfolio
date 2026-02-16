import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const rootDir = process.cwd();
const outputPath = path.resolve(rootDir, 'data/cargo-state.json');
const marker = 'window.__PRELOADED_STATE__=';

const explicitSource = process.argv[2] ? [path.resolve(rootDir, process.argv[2])] : null;
const defaultSources = [
  path.resolve(rootDir, 'exports/landing/index.html'),
  path.resolve(rootDir, 'exports/information/index.html'),
  path.resolve(rootDir, 'Xuechun Sophia Tao.html'),
  path.resolve(rootDir, 'Information — Xuechun Sophia Tao.html')
];
const sourceFiles = [...new Set((explicitSource || defaultSources).filter((filePath) => fs.existsSync(filePath)))];

if (sourceFiles.length === 0) {
  throw new Error(
    'No Cargo export HTML found. Expected one of: exports/landing/index.html, exports/information/index.html, or legacy root HTML files.'
  );
}

function parseStateFromHtml(html, sourceLabel) {
  const start = html.indexOf(marker);
  if (start === -1) {
    throw new Error(`window.__PRELOADED_STATE__ not found in source HTML: ${sourceLabel}`);
  }

  const scriptEnd = html.indexOf('</script>', start);
  if (scriptEnd === -1) {
    throw new Error(`Unable to find closing </script> for preloaded state: ${sourceLabel}`);
  }

  const jsonText = html.slice(start + marker.length, scriptEnd).trim();
  return JSON.parse(jsonText);
}

function readStateFromFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  return parseStateFromHtml(html, filePath);
}

function mergeUniqueList(base = [], incoming = []) {
  const merged = [...base];
  for (const item of incoming) {
    if (!merged.includes(item)) {
      merged.push(item);
    }
  }
  return merged;
}

function mergeByParent(base = {}, incoming = {}) {
  const merged = { ...base };
  for (const [parentId, childIds] of Object.entries(incoming)) {
    merged[parentId] = mergeUniqueList(base[parentId] || [], childIds || []);
  }
  return merged;
}

function mergeStructure(base = {}, incoming = {}) {
  return {
    ...base,
    ...incoming,
    byParent: mergeByParent(base.byParent || {}, incoming.byParent || {}),
    bySort: { ...(base.bySort || {}), ...(incoming.bySort || {}) },
    indexById: { ...(base.indexById || {}), ...(incoming.indexById || {}) },
    liveIndexes: { ...(base.liveIndexes || {}), ...(incoming.liveIndexes || {}) }
  };
}

function mergeState(base, incoming) {
  const baseStylesheet = base?.css?.stylesheet || '';
  const incomingStylesheet = incoming?.css?.stylesheet || '';
  const stylesheet = incomingStylesheet.length > baseStylesheet.length ? incomingStylesheet : baseStylesheet;

  return {
    ...base,
    ...incoming,
    site: base?.site || incoming?.site || {},
    frontendState: base?.frontendState || incoming?.frontendState || {},
    css: {
      ...(base?.css || {}),
      ...(incoming?.css || {}),
      stylesheet
    },
    pages: {
      ...(base?.pages || {}),
      ...(incoming?.pages || {}),
      byId: { ...(base?.pages?.byId || {}), ...(incoming?.pages?.byId || {}) }
    },
    sets: {
      ...(base?.sets || {}),
      ...(incoming?.sets || {}),
      byId: { ...(base?.sets?.byId || {}), ...(incoming?.sets?.byId || {}) }
    },
    media: {
      ...(base?.media || {}),
      ...(incoming?.media || {}),
      byId: { ...(base?.media?.byId || {}), ...(incoming?.media?.byId || {}) }
    },
    structure: mergeStructure(base?.structure || {}, incoming?.structure || {})
  };
}

function hasInformationPage(state) {
  return Object.values(state?.pages?.byId || {}).some((page) => {
    const purl = String(page?.purl || '').toLowerCase();
    const title = String(page?.title || '').toLowerCase();
    return purl === 'information' || title === 'information';
  });
}

function fetchStateFromUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let html = '';
        response.on('data', (chunk) => {
          html += chunk;
        });
        response.on('end', () => {
          try {
            resolve(parseStateFromHtml(html, url));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function normalizePurl(rawValue) {
  if (!rawValue) return '';
  try {
    const withoutHost = rawValue.replace(/^https?:\/\/[^/]+/i, '');
    const cleaned = withoutHost.replace(/^\/+/, '').replace(/[?#].*$/, '');
    return decodeURIComponent(cleaned);
  } catch {
    return rawValue;
  }
}

function deriveTitleFromContent(content, fallbackPurl) {
  const text = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return fallbackPurl || 'Untitled';
  return text.slice(0, 120);
}

function extractRenderedPagesFromHtml(html) {
  const pages = [];
  const pageRegex =
    /<div id="([A-Z][0-9]{10})" page-url="([^"]*)" class="([^"]*\bpage\b[^"]*)"[^>]*>([\s\S]*?)<style id="mobile-offset-styles-\1">[\s\S]*?<\/style><\/div>/g;

  let match;
  while ((match = pageRegex.exec(html)) !== null) {
    const [fullMatch, id, rawPurl, rawClass, innerHtml] = match;
    const contentMatch = innerHtml.match(/<bodycopy[^>]*>([\s\S]*?)<\/bodycopy>/i);
    if (!contentMatch) continue;

    const localCssMatch = fullMatch.match(
      new RegExp(`<style>(\\[id="${id}"[\\s\\S]*?)<\\/style>\\s*<style id="mobile-offset-styles-${id}">`)
    );
    const content = contentMatch[1].trim();
    const purl = normalizePurl(rawPurl);

    pages.push({
      id,
      purl,
      className: rawClass,
      pin: rawClass.includes('pinned'),
      stack: rawClass.includes('stacked-page'),
      overlay: rawClass.includes('overlay'),
      content,
      localCss: localCssMatch ? localCssMatch[1] : '',
      title: deriveTitleFromContent(content, purl)
    });
  }

  return pages;
}

function extractPageOrderFromHtml(html) {
  const order = [];
  const orderRegex = /<div id="([A-Z][0-9]{10})" page-url="[^"]*" class="[^"]*\bpage\b[^"]*"/g;
  let match;
  while ((match = orderRegex.exec(html)) !== null) {
    const pageId = match[1];
    if (!order.includes(pageId)) {
      order.push(pageId);
    }
  }
  return order;
}

function extractFreightMediaByHash(html) {
  const mediaByHash = {};
  const urlRegex =
    /https:\/\/freight\.cargo\.site\/(?:t\/original|w\/\d+(?:\/q\/\d+)?)\/i\/([A-Za-z0-9]+)\/([^"'?\s<>]+)/g;

  let match;
  while ((match = urlRegex.exec(html)) !== null) {
    const [url, hash, rawName] = match;
    const existing = mediaByHash[hash];
    const preferCurrent = !existing || url.includes('/t/original/');
    if (!preferCurrent) continue;

    let name = rawName;
    try {
      name = decodeURIComponent(rawName);
    } catch {
      name = rawName;
    }

    const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : null;
    mediaByHash[hash] = {
      hash,
      name,
      file_type: extension,
      mime_type: null,
      width: null,
      height: null
    };
  }

  return mediaByHash;
}

function findParentSetId(state, pageId) {
  const byParent = state?.structure?.byParent || {};
  for (const [parentId, childIds] of Object.entries(byParent)) {
    if (Array.isArray(childIds) && childIds.includes(pageId)) {
      return parentId;
    }
  }
  return null;
}

function findSetIdByPurl(state, setPurl) {
  return Object.values(state?.sets?.byId || {}).find((set) => set?.purl === setPurl)?.id || null;
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function appendRenderedPagesToState(state, renderedPages, sourcePath) {
  if (!renderedPages.length) return state;

  const next = cloneDeep(state);
  const homepageSetId =
    next?.site?.homepage_id || findSetIdByPurl(next, next?.site?.homepage_purl) || 'K3898273367';
  const informationSetId = findSetIdByPurl(next, 'information-1') || 'D1206349348';
  const orderFromSource = [];

  for (const rendered of renderedPages) {
    const existing = next?.pages?.byId?.[rendered.id] || {};
    const existingParentId = findParentSetId(next, rendered.id);

    let targetSetId = existingParentId;
    if (!targetSetId) {
      if (rendered.purl === 'information' || rendered.purl === '信息-1') {
        targetSetId = informationSetId;
      } else {
        targetSetId = homepageSetId;
      }
    }

    next.pages.byId[rendered.id] = {
      ...existing,
      id: rendered.id,
      title: existing.title || rendered.title,
      purl: rendered.purl || existing.purl || rendered.id.toLowerCase(),
      page_type: existing.page_type || 'page',
      content: rendered.content || existing.content || '',
      local_css: rendered.localCss || existing.local_css || '',
      display: existing.display ?? true,
      stack: existing.stack ?? rendered.stack,
      pin: existing.pin ?? rendered.pin,
      overlay: existing.overlay ?? rendered.overlay,
      password_enabled: existing.password_enabled ?? false,
      page_count: existing.page_count ?? 0,
      media: Array.isArray(existing.media) ? existing.media : [],
      tags: Array.isArray(existing.tags) ? existing.tags : [],
      access_level: existing.access_level || 'public'
    };

    if (!next.structure.byParent[targetSetId]) {
      next.structure.byParent[targetSetId] = [];
    }
    if (!next.structure.byParent[targetSetId].includes(rendered.id)) {
      next.structure.byParent[targetSetId].push(rendered.id);
    }

    if (targetSetId === homepageSetId && sourcePath.includes('landing')) {
      orderFromSource.push(rendered.id);
    }
  }

  if (orderFromSource.length > 0) {
    next.structure.byParent[homepageSetId] = mergeUniqueList(
      orderFromSource,
      next.structure.byParent[homepageSetId] || []
    );
  }

  return next;
}

function appendMediaFromHtml(state, mediaByHashFromHtml) {
  const next = cloneDeep(state);
  const pages = Object.values(next?.pages?.byId || {});

  for (const page of pages) {
    const hashes = [...String(page?.content || '').matchAll(/hash=\"([^\"]+)\"/g)].map((match) => match[1]);
    if (hashes.length === 0) continue;

    if (!Array.isArray(page.media)) {
      page.media = [];
    }
    const existingHashes = new Set(page.media.map((item) => item?.hash).filter(Boolean));

    for (const hash of hashes) {
      if (existingHashes.has(hash)) continue;
      const media = mediaByHashFromHtml[hash];
      if (!media) continue;
      page.media.push({ ...media });
      existingHashes.add(hash);
    }
  }

  return next;
}

let mergedState = readStateFromFile(sourceFiles[0]);
for (const sourcePath of sourceFiles.slice(1)) {
  const state = readStateFromFile(sourcePath);
  mergedState = mergeState(mergedState, state);
}

if (!explicitSource && !hasInformationPage(mergedState)) {
  try {
    const infoState = await fetchStateFromUrl('https://xuechuntao.com/information-1');
    mergedState = mergeState(mergedState, infoState);
    console.log('Merged fallback state from https://xuechuntao.com/information-1');
  } catch (error) {
    console.warn(`Warning: unable to fetch fallback information state: ${error.message}`);
  }
}

for (const sourcePath of sourceFiles) {
  const html = fs.readFileSync(sourcePath, 'utf8');
  const renderedPages = extractRenderedPagesFromHtml(html);
  mergedState = appendRenderedPagesToState(mergedState, renderedPages, sourcePath);
  const mediaByHashFromHtml = extractFreightMediaByHash(html);
  mergedState = appendMediaFromHtml(mergedState, mediaByHashFromHtml);
}

const landingSource = sourceFiles.find((sourcePath) => sourcePath.includes('landing'));
if (landingSource) {
  const landingHtml = fs.readFileSync(landingSource, 'utf8');
  const landingOrder = extractPageOrderFromHtml(landingHtml);
  const homepageSetId =
    mergedState?.site?.homepage_id ||
    findSetIdByPurl(mergedState, mergedState?.site?.homepage_purl) ||
    'K3898273367';
  mergedState.structure.byParent[homepageSetId] = mergeUniqueList(
    landingOrder,
    mergedState.structure.byParent[homepageSetId] || []
  );
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(mergedState, null, 2)}\n`, 'utf8');

const pageCount = Object.keys(mergedState?.pages?.byId || {}).length;
const setCount = Object.keys(mergedState?.sets?.byId || {}).length;

console.log(`Extracted Cargo state to ${outputPath}`);
console.log(`pages=${pageCount} sets=${setCount}`);
