function buildFreightUrlForWidth(media, width, quality) {
  const encodedName = encodeURIComponent(media.name).replace(/%2F/g, '/');
  return `https://freight.cargo.site/w/${width}/q/${quality}/i/${media.hash}/${encodedName}`;
}

function buildOriginalMediaUrl(media) {
  if (!media?.hash || !media?.name) {
    return null;
  }
  const encodedName = encodeURIComponent(media.name).replace(/%2F/g, '/');
  return `https://freight.cargo.site/t/original/i/${media.hash}/${encodedName}`;
}

function buildFreightUrl(media, localAssetByRemoteUrl, localAssetByHash) {
  if (!media?.hash || !media?.name) {
    return null;
  }
  const originalUrl = buildOriginalMediaUrl(media);
  if (originalUrl && localAssetByRemoteUrl?.[originalUrl]) {
    return localAssetByRemoteUrl[originalUrl];
  }
  if (media.hash && localAssetByHash?.[media.hash]) {
    return localAssetByHash[media.hash];
  }
  return null;
}

function decorateElement(element, className) {
  if (className) {
    element.className = `${className} ${element.className || ''}`.trim();
  }

  if (element.tagName.toLowerCase() === 'column-unit') {
    const span = element.getAttribute('span');
    if (span) {
      element.style.setProperty('--span', span);
    }
  }

  if (element.tagName.toLowerCase() === 'column-set') {
    const gutter = element.getAttribute('gutter');
    if (gutter) {
      element.style.setProperty('--gutter', gutter);
    }
  }
}

function toCanonicalRouteSlug(setSlug, homepageSlug) {
  if (setSlug === homepageSlug) return 'home';
  if (setSlug === 'information-1') return 'bio';
  return setSlug;
}

function normalizeInternalHref(href, { homepageSlug, pageSlugToSetSlug, siteOrigin }) {
  if (!href || href === '#') {
    return `/${encodeURI(toCanonicalRouteSlug(homepageSlug, homepageSlug))}`;
  }

  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
    return null;
  }

  let candidate = href;

  if (/^https?:\/\//i.test(href)) {
    try {
      const parsed = new URL(href);
      if (siteOrigin && parsed.origin === siteOrigin) {
        candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  const candidatePath = candidate.startsWith('/') ? candidate : `/${candidate}`;
  const [pathOnly, query = ''] = candidatePath.split('?');
  const slug = decodeURIComponent(pathOnly.replace(/^\/+/, ''));

  if (!slug) {
    return `/${encodeURI(toCanonicalRouteSlug(homepageSlug, homepageSlug))}`;
  }

  const mapped = pageSlugToSetSlug?.[slug] || slug;
  const basePath = `/${encodeURI(toCanonicalRouteSlug(mapped, homepageSlug))}`;

  return query ? `${basePath}?${query}` : basePath;
}

function removeLinkWithNearbySeparator(anchor) {
  const prev = anchor.previousSibling;
  const next = anchor.nextSibling;

  if (prev && prev.nodeType === Node.TEXT_NODE) {
    prev.textContent = prev.textContent.replace(/[\s\u00a0]*\/[\s\u00a0]*$/, ' ');
  } else if (next && next.nodeType === Node.TEXT_NODE) {
    next.textContent = next.textContent.replace(/^[\s\u00a0]*\/[\s\u00a0]*/, ' ');
  }

  const container = anchor.closest('column-unit');
  if (container && (container.textContent || '').replace(/[\s\u00a0]/g, '') === '中文') {
    container.remove();
    return;
  }

  anchor.remove();
}

function rewriteProjectNumber(wrapper, projectNumber) {
  if (!Number.isInteger(projectNumber) || projectNumber < 1) {
    return;
  }

  const paddedNumber = String(projectNumber).padStart(2, '0');
  const firstColumn =
    wrapper.querySelector('column-set:first-of-type column-unit[slot="0"]') ||
    wrapper.querySelector('column-set:first-of-type column-unit:first-of-type');

  if (!firstColumn) return;

  const textNodeWalker = document.createTreeWalker(firstColumn, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!text) return NodeFilter.FILTER_REJECT;
      if (!/[A-Za-z\u4E00-\u9FFF]/.test(text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const firstTextNode = textNodeWalker.nextNode();
  if (!firstTextNode) return;

  for (const anchor of Array.from(firstColumn.querySelectorAll('a'))) {
    const anchorText = (anchor.textContent || '').replace(/\s+/g, '');
    if (!/^\d+$/u.test(anchorText)) continue;

    const relation = anchor.compareDocumentPosition(firstTextNode);
    const isBeforeFirstText = Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!isBeforeFirstText) continue;

    const next = anchor.nextSibling;
    if (next?.nodeType === Node.TEXT_NODE) {
      next.nodeValue = (next.nodeValue || '').replace(/^[\s\u00A0]+/u, ' ');
    }
    anchor.remove();
  }

  const currentText = firstTextNode.nodeValue || '';
  const cleaned = currentText.replace(/^\s*(?:\d+\s*)+/u, '').trim();
  if (!cleaned) return;

  firstTextNode.nodeValue = ` ${paddedNumber} ${cleaned}`;
}

function normalizeProjectSpacing(wrapper, pagePurl) {
  if (!pagePurl || pagePurl.startsWith('header-') || pagePurl === 'footer') {
    return;
  }

  const hasMeaningfulText = (set) => {
    const probe = set.cloneNode(true);
    probe
      .querySelectorAll('template, style, script, slot, br, [data-nosnippet], [aria-hidden="true"]')
      .forEach((node) => node.remove());
    const text = (probe.textContent || '').replace(/[\s\u00A0]+/g, '');
    return text.length > 0;
  };

  for (const set of Array.from(wrapper.querySelectorAll('column-set'))) {
    const hasVisualContent = Boolean(
      set.querySelector(
        'media-item, gallery-slideshow, gallery-grid, gallery-justify, gallery-columnized, img, video, iframe, a, button, canvas, svg'
      )
    );
    if (!hasVisualContent && !hasMeaningfulText(set)) {
      set.remove();
    }
  }
}

function enhanceBioKaleidoscope(wrapper, pagePurl) {
  if (pagePurl !== 'information') {
    return;
  }

  for (const floating of Array.from(wrapper.querySelectorAll('.flying-object, [uses="flying-object"]'))) {
    floating.remove();
  }

  const mediaItems = Array.from(wrapper.querySelectorAll('media-item')).slice(0, 2).map((item) => item.cloneNode(true));

  const layout = document.createElement('div');
  layout.className = 'bio-page-layout';

  const leftPane = document.createElement('div');
  leftPane.className = 'bio-kaleidoscope-pane';

  const square = document.createElement('div');
  square.className = 'bio-kaleidoscope-square';

  const canvas = document.createElement('canvas');
  canvas.className = 'bio-kaleidoscope-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  square.appendChild(canvas);
  leftPane.appendChild(square);

  const rightPane = document.createElement('div');
  rightPane.className = 'bio-profile-pane';

  const intro = document.createElement('div');
  intro.className = 'bio-intro';

  const introLead = document.createElement('h2');
  introLead.className = 'bio-intro-line';
  introLead.textContent = 'Hello,';

  const introName = document.createElement('h2');
  introName.className = 'bio-intro-line';
  introName.textContent = 'my name is Sophia.';

  intro.append(introLead, introName);

  const photoGrid = document.createElement('div');
  photoGrid.className = 'bio-photo-grid';

  for (const mediaItem of mediaItems) {
    const card = document.createElement('div');
    card.className = 'bio-photo-card';
    card.appendChild(mediaItem);
    photoGrid.appendChild(card);
  }

  const summary = document.createElement('p');
  summary.className = 'bio-summary';
  summary.textContent =
    'I am a UX designer focused on enterprise and fintech products. I translate complex requirements into clear, scalable experiences through user research, systems thinking, and close collaboration with product and engineering teams.';

  rightPane.append(intro, photoGrid, summary);
  layout.append(leftPane, rightPane);

  wrapper.textContent = '';
  wrapper.appendChild(layout);
}

function injectAiComplianceShowcase(wrapper, pagePurl) {
  if (pagePurl !== '01-markets-pipeline-dashboard-copy') {
    return;
  }

  const targetSet = Array.from(wrapper.querySelectorAll('column-set')).find(
    (set) =>
      set.querySelector('gallery-slideshow') &&
      /check this project/i.test((set.textContent || '').replace(/\s+/g, ' '))
  );
  if (!targetSet) return;

  targetSet.classList.add('ai-compliance-layout');
  const mediaUnit = targetSet.querySelector('column-unit[slot="0"]');
  const textUnit = targetSet.querySelector('column-unit[slot="1"]');
  if (textUnit) {
    textUnit.classList.add('ai-compliance-description');
  }
  if (!mediaUnit) return;

  const showcase = document.createElement('div');
  showcase.className = 'ai-compliance-showcase';

  const imageSources = [
    {
      src: '/assets/cargo/freight.cargo.site/t/original/i/O2701928164361042364328751543807/Group-4190.png',
      variant: 'left'
    },
    {
      src: '/assets/cargo/freight.cargo.site/t/original/i/O2701928164361042364328751543807/Group-4190.png',
      variant: 'right'
    }
  ];

  for (const source of imageSources) {
    const figure = document.createElement('figure');
    figure.className = `ai-compliance-showcase-item is-${source.variant}`;

    const img = document.createElement('img');
    img.src = source.src;
    img.alt = 'AI Cross-border Compliance Solutions';
    img.loading = 'lazy';
    img.decoding = 'async';

    figure.appendChild(img);
    showcase.appendChild(figure);
  }

  mediaUnit.textContent = '';
  mediaUnit.appendChild(showcase);
}

function linkProjectDetailButtons(wrapper, pagePurl) {
  // Keep buttons but route them to our local project detail pages.
  const projectDestinations = {
    '01-markets-pipeline-dashboard-copy': '/ai-cross-border-compliance',
    '01-markets-pipeline-dashboard-copy-copy': '/markets-pipeline-dashboard'
  };

  const destination = projectDestinations[pagePurl];
  if (!destination) return;

  for (const link of Array.from(wrapper.querySelectorAll('a'))) {
    const text = (link.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/check\s*this\s*project/i.test(text)) continue;
    link.setAttribute('href', destination);
    link.setAttribute('data-allow-project-link', 'true');
    link.removeAttribute('aria-disabled');
    link.removeAttribute('data-disabled-link');
    link.classList.remove('disabled-project-link');
  }
}

function setColumnUnitText(unit, value, className = '') {
  if (!unit || !value) return;
  unit.textContent = '';
  const text = document.createElement('span');
  text.className = ['landing-project-header-cell', className].filter(Boolean).join(' ');
  text.style.setProperty('--font-scale', '1.1');
  text.textContent = value;
  unit.appendChild(text);
}

function enforceLandingProjectHeader(wrapper, pagePurl) {
  const overrides = {
    '06-plaza-lively-floor-game': {
      title: '07 Plaza Lively Floor Game',
      client: 'NOWHERE / Seed Plaza',
      year: '2021',
      spans: { title: '5', client: '3', year: '4' }
    },
    '05-nike-basketball-interactive-experience': {
      title: '08 Nike Basketball Interactive Experience',
      client: 'NOWHERE / Nike',
      year: '2021',
      spans: { title: '5', client: '3', year: '4' }
    },
    '07-tie-dyed-rivival': {
      title: '09 Tie Dyed Rivival',
      client: 'Chinese Bai Minority Community',
      year: '2024',
      spans: { title: '5', client: '3', year: '4' }
    },
    '09-citi-tech-engineer-annual-report-1': {
      title: '11 Citi Tech Engineer Annual Report',
      client: 'Citi Tech',
      year: '2023',
      spans: { title: '5', client: '3', year: '4' }
    }
  };

  const override = overrides[pagePurl];
  if (!override) return;

  const firstSet = wrapper.querySelector('column-set');
  if (!firstSet) return;

  const titleUnit =
    firstSet.querySelector('column-unit[slot="0"]') || firstSet.querySelector('column-unit:first-of-type');
  const clientUnit = firstSet.querySelector('column-unit[slot="1"]');
  const yearUnit = firstSet.querySelector('column-unit[slot="2"]');

  firstSet.classList.add('landing-project-header-row');
  if (titleUnit) titleUnit.classList.add('landing-project-header-title');
  if (clientUnit) clientUnit.classList.add('landing-project-header-client');
  if (yearUnit) yearUnit.classList.add('landing-project-header-year');

  if (override.spans) {
    if (titleUnit && override.spans.title) titleUnit.setAttribute('span', override.spans.title);
    if (clientUnit && override.spans.client) clientUnit.setAttribute('span', override.spans.client);
    if (yearUnit && override.spans.year) yearUnit.setAttribute('span', override.spans.year);
  }

  setColumnUnitText(titleUnit, override.title, 'is-title');
  setColumnUnitText(clientUnit, override.client, 'is-client');
  setColumnUnitText(yearUnit, override.year, 'is-year');
}

function enhanceFooterLayout(wrapper, pagePurl) {
  if (pagePurl !== 'footer') {
    return;
  }

  const email = 'thisisxuechun@gmail.com';
  const linkedinUrl = 'https://www.linkedin.com/in/xuechun-sophia-tao';
  const currentYear = String(new Date().getFullYear());

  const footer = document.createElement('div');
  footer.className = 'custom-footer';

  const top = document.createElement('div');
  top.className = 'custom-footer-top';

  const left = document.createElement('div');
  left.className = 'custom-footer-left';

  const kicker = document.createElement('p');
  kicker.className = 'custom-footer-kicker';
  kicker.textContent = 'Got an idea?';

  const emailLink = document.createElement('a');
  emailLink.className = 'custom-footer-email';
  emailLink.href = `mailto:${email}`;
  emailLink.textContent = email;

  left.append(kicker, emailLink);

  const right = document.createElement('div');
  right.className = 'custom-footer-right';

  const linkedin = document.createElement('a');
  linkedin.className = 'custom-footer-linkedin';
  linkedin.href = linkedinUrl;
  linkedin.target = '_blank';
  linkedin.rel = 'noopener noreferrer';
  linkedin.textContent = 'LinkedIn ↗';
  right.appendChild(linkedin);

  top.append(left, right);

  const bottom = document.createElement('div');
  bottom.className = 'custom-footer-bottom';

  const copy = document.createElement('p');
  copy.className = 'custom-footer-copy';
  copy.textContent = `© ${currentYear} Xuechun Sophia Tao. All Rights Reserved.`;

  bottom.append(copy);

  footer.append(top, bottom);

  wrapper.textContent = '';
  wrapper.appendChild(footer);
}

function normalizeSectionHeaderLayout(wrapper, pagePurl) {
  if (!pagePurl || !pagePurl.startsWith('header-') || pagePurl === 'header-sales-experience-in-fintech') {
    return;
  }

  const firstSet = wrapper.querySelector('column-set');
  if (!firstSet) return;

  const units = Array.from(firstSet.querySelectorAll('column-unit'));
  if (units.length === 0) return;

  const headerUnit = units.find((unit) => unit.querySelector('.section-header'));
  if (!headerUnit) return;

  for (const unit of units) {
    if (unit !== headerUnit) {
      unit.remove();
    }
  }

  firstSet.querySelectorAll('h1').forEach((node) => node.remove());
  headerUnit.setAttribute('span', '12');

  const header = headerUnit.querySelector('.section-header');
  if (!header) return;

  const stylized = header.querySelector('i');
  const enforcedTextByPurl = {
    'header-digital-arts-in-branding': 'Digital Arts in Branding'
  };
  const enforcedText = enforcedTextByPurl[pagePurl];
  if (enforcedText) {
    if (stylized) {
      stylized.textContent = enforcedText;
    } else {
      header.textContent = enforcedText;
    }
    return;
  }

  if (stylized) {
    stylized.textContent = stylized.textContent.replace(/^[\s\u00A0]+/u, '');
  } else {
    header.textContent = (header.textContent || '').replace(/^[\s\u00A0]+/u, '');
  }
}

export function transformCargoHtml({
  html,
  mediaByHash,
  localAssetByRemoteUrl,
  localAssetByHash,
  homepageSlug,
  pageSlugToSetSlug,
  siteOrigin,
  pagePurl,
  projectNumber
}) {
  if (!html) {
    return '';
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  for (const template of Array.from(wrapper.querySelectorAll('template'))) {
    template.remove();
  }

  rewriteProjectNumber(wrapper, projectNumber);
  enforceLandingProjectHeader(wrapper, pagePurl);
  enhanceFooterLayout(wrapper, pagePurl);
  enhanceBioKaleidoscope(wrapper, pagePurl);
  injectAiComplianceShowcase(wrapper, pagePurl);
  linkProjectDetailButtons(wrapper, pagePurl);
  normalizeSectionHeaderLayout(wrapper, pagePurl);
  normalizeProjectSpacing(wrapper, pagePurl);

  for (const node of Array.from(wrapper.querySelectorAll('[src]'))) {
    const source = node.getAttribute('src');
    if (source && localAssetByRemoteUrl?.[source]) {
      node.setAttribute('src', localAssetByRemoteUrl[source]);
    }
  }

  for (const node of Array.from(wrapper.querySelectorAll('media-item'))) {
    const hash = node.getAttribute('hash');
    const media = hash ? mediaByHash?.[hash] : null;

    const figure = document.createElement('figure');
    figure.className = 'cargo-media-item';

    if (media) {
      const image = document.createElement('img');
      const originalUrl = buildOriginalMediaUrl(media);
      const localUrl = originalUrl ? localAssetByRemoteUrl?.[originalUrl] : null;
      const src = localUrl || buildFreightUrl(media, localAssetByRemoteUrl, localAssetByHash);
      const sourceWidth = Number(media.width) || 1200;
      const fileType = String(media.fileType || '').toLowerCase();
      const isGif = fileType === 'gif';
      const quality = isGif ? 65 : 75;

      image.src = src || '';
      image.alt = media.name || '';
      image.loading = 'lazy';
      image.decoding = 'async';
      if (isGif) image.setAttribute('fetchpriority', 'low');

      const widths = isGif
        ? [320, 480, 720]
        : [480, 768, 1200, 1600];
      const srcset = widths
        .filter((width) => width <= sourceWidth)
        .map((width) => `${buildFreightUrlForWidth(media, width, quality)} ${width}w`);

      // Never generate remote `freight.cargo.site` srcsets when we're serving local assets.
      // This keeps the site independent from Cargo's image CDN.
      const isRemoteFreight = typeof src === 'string' && src.startsWith('https://freight.cargo.site/');
      if (isRemoteFreight && !localUrl && srcset.length > 0 && src) {
        image.srcset = srcset.join(', ');
        image.sizes = '(max-width: 900px) 100vw, 90vw';
      }

      if (media.width) image.width = media.width;
      if (media.height) image.height = media.height;
      if (src) {
        figure.appendChild(image);
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'cargo-media-missing';
        fallback.textContent = hash ? `Missing local media: ${hash}` : 'Missing local media';
        figure.appendChild(fallback);
      }
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'cargo-media-missing';
      fallback.textContent = hash ? `Missing media: ${hash}` : 'Missing media';
      figure.appendChild(fallback);
    }

    node.replaceWith(figure);
  }

  const tagMap = {
    'column-set': 'cargo-column-set',
    'column-unit': 'cargo-column-unit',
    'gallery-slideshow': 'cargo-gallery cargo-gallery-slideshow',
    'gallery-justify': 'cargo-gallery cargo-gallery-justify',
    'gallery-grid': 'cargo-gallery cargo-gallery-grid',
    'gallery-columnized': 'cargo-gallery cargo-gallery-columnized'
  };

  for (const [tagName, className] of Object.entries(tagMap)) {
    for (const node of Array.from(wrapper.querySelectorAll(tagName))) {
      decorateElement(node, className);
    }
  }

  for (const link of Array.from(wrapper.querySelectorAll('a[href]'))) {
    const rel = (link.getAttribute('rel') || '').toLowerCase();
    const href = link.getAttribute('href') || '';
    const linkText = (link.textContent || '').trim();

    if (linkText === '中文') {
      removeLinkWithNearbySeparator(link);
      continue;
    }

    if (/check\s*this\s*project/i.test(linkText) && link.dataset.allowProjectLink !== 'true') {
      link.setAttribute('href', '#');
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('data-disabled-link', 'true');
      link.classList.add('disabled-project-link');
      continue;
    }

    if (localAssetByRemoteUrl?.[href]) {
      link.setAttribute('href', localAssetByRemoteUrl[href]);
      continue;
    }

    if (rel === 'home-page') {
      link.setAttribute('href', `/${encodeURI(toCanonicalRouteSlug(homepageSlug, homepageSlug))}`);
      continue;
    }

    const normalized = normalizeInternalHref(href, {
      homepageSlug,
      pageSlugToSetSlug,
      siteOrigin
    });

    if (normalized) {
      link.setAttribute('href', normalized);
    }
  }

  return wrapper.innerHTML;
}
