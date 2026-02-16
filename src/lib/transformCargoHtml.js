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

function normalizeInternalHref(href, { homepageSlug, pageSlugToSetSlug, siteOrigin }) {
  if (!href || href === '#') {
    return `/${encodeURI(homepageSlug)}`;
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
    return `/${encodeURI(homepageSlug)}`;
  }

  const mapped = pageSlugToSetSlug?.[slug] || slug;
  const basePath = `/${encodeURI(mapped)}`;

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

  const currentText = firstTextNode.nodeValue || '';
  const cleaned = currentText.replace(/^\s*\d+\s*/u, '').trim();
  if (!cleaned) return;

  firstTextNode.nodeValue = ` ${paddedNumber} ${cleaned}`;
}

export function transformCargoHtml({
  html,
  mediaByHash,
  localAssetByRemoteUrl,
  localAssetByHash,
  homepageSlug,
  pageSlugToSetSlug,
  siteOrigin,
  projectNumber
}) {
  if (!html) {
    return '';
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  rewriteProjectNumber(wrapper, projectNumber);

  for (const template of Array.from(wrapper.querySelectorAll('template'))) {
    template.remove();
  }

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
      if (!localUrl && srcset.length > 0 && src) {
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

    if (localAssetByRemoteUrl?.[href]) {
      link.setAttribute('href', localAssetByRemoteUrl[href]);
      continue;
    }

    if (rel === 'home-page') {
      link.setAttribute('href', `/${encodeURI(homepageSlug)}`);
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
