import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import { localAssetByRemoteUrl } from '../lib/cargoData';

const CV_REMOTE_URL = 'https://freight.cargo.site/m/A2430674546610214647077682951679/CV-2025.pdf';

function ProjectHero({ title, subtitle }) {
  return (
    <header className="project-detail-hero">
      <div className="project-detail-hero-inner">
        <h1 className="project-detail-title">{title}</h1>
        {subtitle ? <p className="project-detail-subtitle">{subtitle}</p> : null}
      </div>
    </header>
  );
}

function ProjectImage({ src, alt }) {
  return (
    <figure className="project-detail-figure">
      <img className="project-detail-image" src={src} alt={alt || ''} loading="lazy" decoding="async" />
    </figure>
  );
}

export default function ProjectDetailPage({ kind }) {
  const isCompliance = kind === 'compliance';
  const title = isCompliance ? 'AI Cross-border Compliance Platform' : 'Finance Market Sales Pipeline Dashboard';
  const subtitle = isCompliance ? 'Selected Screens and UX Work' : 'Selected Screens and UX Work';
  const basePath = isCompliance ? '/assets/projects/compliance' : '/assets/projects/pipeline';
  const cvHref = localAssetByRemoteUrl?.[CV_REMOTE_URL] || CV_REMOTE_URL;
  const images = isCompliance
    ? [
        { src: `${basePath}/01.png`, alt: title },
        { src: `${basePath}/02.png`, alt: title },
        { src: `${basePath}/03.png`, alt: title },
        { src: `${basePath}/04.png`, alt: title },
        { src: `${basePath}/05.png`, alt: title }
      ]
    : [
        { src: `${basePath}/01.png`, alt: title },
        { src: `${basePath}/02.png`, alt: title },
        { src: `${basePath}/03.png`, alt: title },
        { src: `${basePath}/04.png`, alt: title }
      ];

  return (
    <main className="site-shell">
      <div className="content site-route project-detail-route">
        <SiteHeader cvHref={cvHref} />

        <ProjectHero title={title} subtitle={subtitle} />

        <section className="project-detail-grid" aria-label={title}>
          {images.map((img) => (
            <ProjectImage key={img.src} src={img.src} alt={img.alt} />
          ))}
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
