import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import CargoPageRenderer from './components/CargoPageRenderer';
import { manifest, toRoutePath } from './lib/cargoData';
import './styles/cargo-fonts.css';
import './styles/base.css';
import './styles/cargo-compat.css';

function SlugRoute() {
  const params = useParams();
  const rawSlug = params.slug || '';
  const slug = decodeURIComponent(rawSlug);

  if (manifest.routeSlugs.includes(slug)) {
    return <CargoPageRenderer setSlug={slug} />;
  }

  const mappedSet = manifest.pageSlugToSetSlug?.[slug];
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
