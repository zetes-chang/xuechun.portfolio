import { useEffect, useMemo, useState } from 'react';
import CargoContent from './CargoContent';
import { localAssetByRemoteUrl, manifest, state } from '../lib/cargoData';

const CV_REMOTE_URL = 'https://freight.cargo.site/m/A2430674546610214647077682951679/CV-2025.pdf';
const LANDING_PAGE_ORDER = [
  'header-sales-experience-in-fintech',
  '01-markets-pipeline-dashboard-copy',
  'header-sales-experience-in-fintech-copy',
  '01-markets-pipeline-dashboard-copy-copy',
  '01-markets-pipeline-dashboard',
  '02-sales-crm-redesign',
  '03-loan-monetization-impact-evaluation-workflow',
  '04-intraday-credit-control',
  'header-digital-arts-in-branding',
  '06-plaza-lively-floor-game',
  '05-nike-basketball-interactive-experience',
  'header-my-featured',
  '07-tie-dyed-rivival',
  '08-female-retraining-program-copy-1',
  '09-citi-tech-engineer-annual-report-1',
  'header-get-hands-dirty',
  '10-before-wilderness-is-gone',
  '11-cow-emissions-of',
  '12-poetic-waiting',
  'footer'
];

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onResize = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    window.addEventListener('resize', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [breakpoint]);

  return isMobile;
}

function isVisibleOnViewport(page, isMobile) {
  const visibility = page?.pin_options?.screen_visibility;
  if (!visibility) return true;
  if (visibility === 'mobile') return isMobile;
  if (visibility === 'desktop') return !isMobile;
  return true;
}

function localizeCssUrls(cssText) {
  if (!cssText) return '';
  let localized = cssText;
  for (const [remoteUrl, localUrl] of Object.entries(localAssetByRemoteUrl)) {
    localized = localized.split(remoteUrl).join(localUrl);
  }
  return localized;
}

function isTopNavPage(page) {
  const title = String(page?.title || '').toLowerCase();
  const purl = String(page?.purl || '').toLowerCase();
  return title.includes('top nav') || purl.startsWith('top-nav');
}

function isLandingSectionHeader(page) {
  const purl = String(page?.purl || '').toLowerCase();
  const title = String(page?.title || '').toLowerCase();
  if (purl.startsWith('header-')) return true;
  if (purl.startsWith('footer')) return true;
  return title.startsWith('header-');
}

function reorderLandingPages(pages) {
  const rankByPurl = new Map(LANDING_PAGE_ORDER.map((purl, index) => [purl, index]));
  return [...pages].sort((left, right) => {
    const leftRank = rankByPurl.get(left?.purl);
    const rightRank = rankByPurl.get(right?.purl);
    if (leftRank === undefined && rightRank === undefined) return 0;
    if (leftRank === undefined) return 1;
    if (rightRank === undefined) return -1;
    return leftRank - rightRank;
  });
}

function SiteHeader({ cvHref }) {
  return (
    <header className="site-header">
      <nav className="site-header-nav">
        <a className="site-header-link" href={`/${encodeURI(manifest.homepageSlug)}`}>
          Home
        </a>
        <a className="site-header-link" href="/information-1">
          Bio
        </a>
        <a className="site-header-link" href={cvHref} target="_blank" rel="noreferrer">
          CV
        </a>
      </nav>
    </header>
  );
}

function CargoPageBlock({ page, projectNumber }) {
  const pageClassName = [
    'page',
    page.pin ? 'cargo-pin-page pinned pinned-top fixed accepts-pointer-events' : '',
    page.stack ? 'stacked-page' : '',
    page.overlay ? 'cargo-overlay-page' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const localCss = useMemo(() => localizeCssUrls(page.local_css || ''), [page.local_css]);

  return (
    <section id={page.id} page-url={page.purl || ''} className={pageClassName} data-purl={page.purl || ''}>
      {localCss ? <style>{localCss}</style> : null}
      <div className="backdrop clip">
        <div className="backdrop-contents visible inside loaded" />
      </div>
      {page.purl ? <a id={page.purl} /> : null}
      <div className="page-layout">
        <div className="page-content">
          <CargoContent html={page.content || ''} projectNumber={projectNumber} />
        </div>
      </div>
    </section>
  );
}

export default function CargoPageRenderer({ setSlug }) {
  const route = useMemo(
    () => manifest.routes.find((entry) => entry.slug === setSlug) || null,
    [setSlug]
  );

  const isMobile = useIsMobile();

  const pages = useMemo(() => {
    if (!route) return [];
    return route.pageIds
      .map((pageId) => state?.pages?.byId?.[pageId])
      .filter(Boolean)
      .filter((page) => isVisibleOnViewport(page, isMobile));
  }, [route, isMobile]);

  const pinnedPages = pages.filter((page) => page.pin && !isTopNavPage(page));
  const contentPages = useMemo(() => {
    const entries = pages.filter((page) => !page.pin);
    if (!route || route.slug !== manifest.homepageSlug) {
      return entries;
    }
    return reorderLandingPages(entries);
  }, [pages, route]);
  const projectNumbersByPageId = useMemo(() => {
    if (!route || route.slug !== manifest.homepageSlug) {
      return {};
    }

    let counter = 1;
    const map = {};
    for (const page of contentPages) {
      if (isLandingSectionHeader(page)) continue;
      map[page.id] = counter;
      counter += 1;
    }
    return map;
  }, [route, contentPages]);

  const siteStyles = useMemo(() => localizeCssUrls(state?.css?.stylesheet || ''), []);
  const cvHref = localAssetByRemoteUrl[CV_REMOTE_URL] || CV_REMOTE_URL;

  useEffect(() => {
    if (!route) return;
    const siteTitle = state?.site?.website_title || 'Xuechun Sophia Tao';
    document.title = route.title ? `${route.title} - ${siteTitle}` : siteTitle;
  }, [route]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle('mobile', isMobile);
    body.classList.toggle('mobile', isMobile);

    const viewportHeight = window.innerHeight || 0;
    root.style.setProperty('--viewport-height', `${viewportHeight}px`);
    root.style.setProperty('--min-viewport-height', `${viewportHeight}px`);
    root.style.setProperty('--base-size', isMobile ? '16px' : '13.6656px');
    body.classList.add('home');
  }, [isMobile]);

  if (!route) {
    return <main className="site-shell">Route not found: {setSlug}</main>;
  }

  return (
    <main className="site-shell">
      {siteStyles ? <style>{siteStyles}</style> : null}

      <div className="content site-route" data-set-id={route.setId} data-slug={route.slug}>
        <SiteHeader cvHref={cvHref} />

        <div className="site-pin-stack">
          {pinnedPages.map((page) => (
            <CargoPageBlock key={page.id} page={page} />
          ))}
        </div>

        <div className="site-content-stack">
          {contentPages.map((page) => (
            <CargoPageBlock
              key={page.id}
              page={page}
              projectNumber={projectNumbersByPageId[page.id] || null}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
