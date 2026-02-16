import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { localAssetByHash, localAssetByRemoteUrl, manifest, state } from '../lib/cargoData';
import { transformCargoHtml } from '../lib/transformCargoHtml';

function isModifiedEvent(event) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

export default function CargoContent({ html, projectNumber = null }) {
  const navigate = useNavigate();
  const contentRef = useRef(null);

  const transformed = useMemo(
    () =>
      transformCargoHtml({
        html,
        mediaByHash: manifest.mediaByHash,
        localAssetByRemoteUrl,
        localAssetByHash,
        homepageSlug: manifest.homepageSlug,
        pageSlugToSetSlug: manifest.pageSlugToSetSlug,
        siteOrigin: state?.site?.direct_link || 'https://xuechuntao.com',
        projectNumber
      }),
    [html, projectNumber]
  );

  const onClick = useCallback(
    (event) => {
      if (event.defaultPrevented || isModifiedEvent(event)) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const anchor = event.target.closest('a[href]');
      if (!anchor) {
        return;
      }

      const target = anchor.getAttribute('target');
      if (target && target !== '_self') {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/')) {
        return;
      }

      event.preventDefault();
      navigate(href);
    },
    [navigate]
  );

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return undefined;

    const cleanups = [];
    const sectionHeaders = Array.from(root.querySelectorAll('.section-header'));

    for (const header of sectionHeaders) {
      const text = (header.textContent || '').replace(/\s+/g, ' ').trim();
      const chars = Math.max(text.length, 8);
      header.classList.add('typewriter-headline');
      header.style.setProperty('--typing-chars', String(chars));
      header.classList.remove('is-typed');

      requestAnimationFrame(() => {
        header.classList.add('is-typed');
      });
    }

    const slideshows = Array.from(root.querySelectorAll('.cargo-gallery-slideshow'));

    for (const slideshow of slideshows) {
      const slides = Array.from(slideshow.querySelectorAll(':scope > .cargo-media-item'));
      if (slides.length <= 1) continue;

      for (const oldControl of Array.from(slideshow.querySelectorAll(':scope > .cargo-slideshow-control'))) {
        oldControl.remove();
      }

      let currentIndex = 0;
      const updateSlides = () => {
        slides.forEach((slide, index) => {
          slide.classList.toggle('is-active', index === currentIndex);
        });
      };

      const previousButton = document.createElement('button');
      previousButton.type = 'button';
      previousButton.className = 'cargo-slideshow-control cargo-slide-prev';
      previousButton.textContent = '‹';

      const nextButton = document.createElement('button');
      nextButton.type = 'button';
      nextButton.className = 'cargo-slideshow-control cargo-slide-next';
      nextButton.textContent = '›';

      const showPrev = () => {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        updateSlides();
      };

      const showNext = () => {
        currentIndex = (currentIndex + 1) % slides.length;
        updateSlides();
      };

      previousButton.addEventListener('click', showPrev);
      nextButton.addEventListener('click', showNext);

      slideshow.appendChild(previousButton);
      slideshow.appendChild(nextButton);
      updateSlides();

      const autoplay = window.setInterval(showNext, 3200);

      cleanups.push(() => {
        window.clearInterval(autoplay);
        previousButton.removeEventListener('click', showPrev);
        nextButton.removeEventListener('click', showNext);
      });
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [transformed]);

  return (
    <bodycopy
      ref={contentRef}
      className="cargo-content"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: transformed }}
    />
  );
}
