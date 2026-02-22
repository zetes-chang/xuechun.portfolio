import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { manifest, toRoutePath } from '../lib/cargoData';

const DEFAULT_SURFACE = { r: 244, g: 246, b: 250, a: 1 };
const LUMINANCE_THRESHOLD_ON = 0.66;
const LUMINANCE_THRESHOLD_OFF = 0.57;

function parseRgba(value) {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(',').map((item) => item.trim());
  if (parts.length < 3) return null;
  const r = Number.parseFloat(parts[0]);
  const g = Number.parseFloat(parts[1]);
  const b = Number.parseFloat(parts[2]);
  const a = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return {
    r: Math.max(0, Math.min(255, r)),
    g: Math.max(0, Math.min(255, g)),
    b: Math.max(0, Math.min(255, b)),
    a: Math.max(0, Math.min(1, a))
  };
}

function compositeColor(base, overlay) {
  const alpha = overlay.a;
  return {
    r: overlay.r * alpha + base.r * (1 - alpha),
    g: overlay.g * alpha + base.g * (1 - alpha),
    b: overlay.b * alpha + base.b * (1 - alpha),
    a: 1
  };
}

function channelToLinear(value) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getLuminance(color) {
  const r = channelToLinear(color.r);
  const g = channelToLinear(color.g);
  const b = channelToLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getSurfaceLuminance(element) {
  if (!(element instanceof HTMLElement)) {
    return getLuminance(DEFAULT_SURFACE);
  }

  if (element.closest("section.page[data-purl='header-sales-experience-in-fintech']")) {
    return 0.24;
  }

  const overlays = [];
  let node = element;
  while (node && node !== document.documentElement) {
    const parsed = parseRgba(getComputedStyle(node).backgroundColor || '');
    if (parsed && parsed.a > 0.01) {
      overlays.push(parsed);
    }
    node = node.parentElement;
  }

  let color = { ...DEFAULT_SURFACE };
  for (let index = overlays.length - 1; index >= 0; index -= 1) {
    color = compositeColor(color, overlays[index]);
  }

  return getLuminance(color);
}

export default function SiteHeader({ cvHref }) {
  const location = useLocation();
  const headerRef = useRef(null);
  const [useContrastGlass, setUseContrastGlass] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;

    let rafId = 0;

    const evaluateContrast = () => {
      rafId = 0;
      const rect = header.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const sampleY = Math.max(
        2,
        Math.min(window.innerHeight - 2, rect.top + rect.height * 0.66)
      );
      const xRatios = [0.14, 0.34, 0.52, 0.7, 0.9];
      const luminances = [];

      for (const ratio of xRatios) {
        const sampleX = Math.max(
          2,
          Math.min(window.innerWidth - 2, rect.left + rect.width * ratio)
        );
        const stack = document.elementsFromPoint(sampleX, sampleY);
        const target = stack.find(
          (entry) =>
            entry instanceof HTMLElement &&
            !header.contains(entry) &&
            entry !== document.documentElement &&
            entry !== document.body
        );
        luminances.push(getSurfaceLuminance(target || document.body));
      }

      if (!luminances.length) return;
      const avgLuminance = luminances.reduce((sum, value) => sum + value, 0) / luminances.length;

      setUseContrastGlass((prev) => {
        if (!prev && avgLuminance > LUMINANCE_THRESHOLD_ON) return true;
        if (prev && avgLuminance < LUMINANCE_THRESHOLD_OFF) return false;
        return prev;
      });
    };

    const scheduleEvaluate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(evaluateContrast);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleEvaluate();
    });
    resizeObserver.observe(header);

    window.addEventListener('scroll', scheduleEvaluate, { passive: true });
    window.addEventListener('resize', scheduleEvaluate);

    scheduleEvaluate();

    return () => {
      window.removeEventListener('scroll', scheduleEvaluate);
      window.removeEventListener('resize', scheduleEvaluate);
      resizeObserver.disconnect();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [location.pathname]);

  const className = `site-header${useContrastGlass ? ' site-header--contrast' : ''}`;

  return (
    <header ref={headerRef} className={className}>
      <nav className="site-header-nav">
        <Link className="site-header-link site-header-link-home" to={toRoutePath(manifest.homepageSlug)}>
          <span className="site-header-home-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <path d="M3.25 9.1 10 3.2l6.75 5.9" />
              <path d="M5.2 8.5V16h9.6V8.5" />
            </svg>
          </span>
          <span>Home</span>
        </Link>

        <div className="site-header-right">
          <Link className="site-header-link site-header-link-right" to={toRoutePath('information-1')}>
            Bio
          </Link>
          <a className="site-header-link site-header-link-right" href={cvHref} target="_blank" rel="noreferrer">
            CV
          </a>
        </div>
      </nav>
    </header>
  );
}
