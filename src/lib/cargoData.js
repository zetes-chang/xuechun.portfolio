import state from '../../data/cargo-state.json';
import manifest from '../../data/routes.manifest.json';
import assetsManifest from '../../data/assets.manifest.json';

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

export function toRoutePath(slug) {
  return `/${encodeURI(slug)}`;
}
