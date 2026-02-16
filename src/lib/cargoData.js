import state from '../../data/cargo-state.json';
import manifest from '../../data/routes.manifest.json';
import assetsManifest from '../../data/assets.manifest.json';

const ROUTE_ALIAS_BY_SET_SLUG = {
  [manifest.homepageSlug]: 'home',
  'information-1': 'bio'
};

const SET_SLUG_BY_ROUTE_ALIAS = Object.fromEntries(
  Object.entries(ROUTE_ALIAS_BY_SET_SLUG).map(([setSlug, alias]) => [alias, setSlug])
);

const toPublicPath = (localPath) =>
  `/${localPath.replace(/^public[\\/]/, '').replace(/\\/g, '/')}`;

const hashFromUrl = (url) => {
  const match = String(url || '').match(/\/i\/([A-Za-z0-9]+)\//);
  return match ? match[1] : null;
};

const localAssetByRemoteUrl = Object.fromEntries(
  (assetsManifest?.assets || []).map((asset) => [asset.url, toPublicPath(asset.localPath)])
);

const localAssetByHash = {};
for (const asset of assetsManifest?.assets || []) {
  const hash = hashFromUrl(asset.url);
  if (!hash) continue;
  const localPath = toPublicPath(asset.localPath);
  const current = localAssetByHash[hash];
  if (!current || asset.url.includes('/t/original/')) {
    localAssetByHash[hash] = localPath;
  }
}

export { state, manifest, localAssetByRemoteUrl, localAssetByHash };

export function toCanonicalRouteSlug(setSlug) {
  return ROUTE_ALIAS_BY_SET_SLUG[setSlug] || setSlug;
}

export function toSetSlugFromRouteSlug(routeSlug) {
  return SET_SLUG_BY_ROUTE_ALIAS[routeSlug] || routeSlug;
}

export function toRoutePath(slug) {
  return `/${encodeURI(toCanonicalRouteSlug(slug))}`;
}
