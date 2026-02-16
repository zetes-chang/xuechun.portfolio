import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const sourcePath = path.resolve(rootDir, 'data/cargo-state.json');
const outputPath = path.resolve(rootDir, 'data/routes.manifest.json');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`State file not found: ${sourcePath}. Run npm run extract:state first.`);
}

const state = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const pages = state?.pages?.byId || {};
const sets = state?.sets?.byId || {};
const byParent = state?.structure?.byParent || {};
const rootChildren = byParent.root || [];
const removedPages = [];

const mediaByHash = {};
for (const page of Object.values(pages)) {
  const mediaItems = [];
  if (page?.thumbnail?.hash && page?.thumbnail?.name) {
    mediaItems.push(page.thumbnail);
  }
  if (Array.isArray(page?.media)) {
    mediaItems.push(...page.media);
  }

  for (const media of mediaItems) {
    if (!media?.hash || !media?.name) continue;
    if (mediaByHash[media.hash]) continue;

    const encodedName = encodeURIComponent(media.name).replace(/%2F/g, '/');
    mediaByHash[media.hash] = {
      hash: media.hash,
      name: media.name,
      width: media.width || null,
      height: media.height || null,
      fileType: media.file_type || null,
      mimeType: media.mime_type || null,
      url: `https://freight.cargo.site/t/original/i/${media.hash}/${encodedName}`
    };
  }
}

const routeRecords = [];
const pageSlugToSetSlug = {};

for (const setId of rootChildren) {
  const set = sets[setId];
  if (!set || set.id === 'root' || !set.purl || set.display === false) {
    continue;
  }

  const childPageIds = byParent[setId] || [];
  const allRoutablePageIds = [];
  const pinnedPageIds = [];
  const contentPageIds = [];

  for (const pageId of childPageIds) {
    const page = pages[pageId];
    if (!page || page.display === false) continue;

    if (page.purl && !pageSlugToSetSlug[page.purl]) {
      pageSlugToSetSlug[page.purl] = set.purl;
    }

    allRoutablePageIds.push(pageId);
    if (page.pin) {
      pinnedPageIds.push(pageId);
    } else {
      contentPageIds.push(pageId);
    }
  }

  routeRecords.push({
    setId,
    slug: set.purl,
    title: set.title || set.purl,
    allChildPageIds: childPageIds,
    pageIds: allRoutablePageIds,
    pinnedPageIds,
    contentPageIds
  });
}

const homepageSlug = state?.site?.homepage_purl || routeRecords[0]?.slug || 'xuechun-tao';

const manifest = {
  generatedAt: new Date().toISOString(),
  homepageSlug,
  routeSlugs: routeRecords.map((route) => route.slug),
  routes: routeRecords,
  redirects: {
    '/': `/${homepageSlug}`
  },
  pageSlugToSetSlug,
  removedPages,
  mediaByHash
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Normalized routes written to ${outputPath}`);
console.log(`routes=${manifest.routeSlugs.length} removedPages=${removedPages.length} media=${Object.keys(mediaByHash).length}`);
