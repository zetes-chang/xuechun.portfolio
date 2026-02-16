import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import CargoPageRenderer from './components/CargoPageRenderer';
import { manifest, toRoutePath, toSetSlugFromRouteSlug } from './lib/cargoData';
import './styles/cargo-fonts.css';
import './styles/base.css';

function SlugRoute() {
  const params = useParams();
  const rawSlug = params.slug || '';
  const slug = decodeURIComponent(rawSlug);
  const setSlug = toSetSlugFromRouteSlug(slug);
  const canonicalPath = toRoutePath(setSlug);
  const currentPath = `/${encodeURI(slug)}`;

  if (canonicalPath !== currentPath && manifest.routeSlugs.includes(setSlug)) {
    return <Navigate replace to={canonicalPath} />;
  }

  if (manifest.routeSlugs.includes(setSlug)) {
    return <CargoPageRenderer setSlug={setSlug} />;
  }

  const mappedSet = manifest.pageSlugToSetSlug?.[setSlug] || manifest.pageSlugToSetSlug?.[slug];
  if (mappedSet) {
    return <Navigate replace to={toRoutePath(mappedSet)} />;
  }

  return <Navigate replace to={toRoutePath(manifest.homepageSlug)} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to={toRoutePath(manifest.homepageSlug)} />} />
      <Route path="/:slug" element={<SlugRoute />} />
      <Route path="*" element={<Navigate replace to={toRoutePath(manifest.homepageSlug)} />} />
    </Routes>
  );
}
