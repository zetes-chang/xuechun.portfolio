import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { localAssetByHash, localAssetByRemoteUrl, manifest, state } from '../lib/cargoData';
import { transformCargoHtml } from '../lib/transformCargoHtml';

const HERO_PURL = 'header-sales-experience-in-fintech';
const BIO_PURL = 'information';
const BIO_KALEIDOSCOPE_SOURCES = [
  '/assets/local/bio-kaleidoscope-flower.jpg',
  '/assets/local/bio-kaleidoscope-source.jpg'
];
const HERO_INTRO_LINE = "Hey, I'm Sophia";
const HERO_ROTATING_PREFIX = 'I do:';
const HERO_LEAD_SPACE = '\u2002';
const HERO_TYPEWRITER_LINES = [
  'AI-native SaaS UX',
  'Cross-border compliance',
  'Fintech dashboard UX',
  'Loan workflow design',
  'Data-product storytelling',
  'Enterprise UX systems',
  'Research-driven design',
  'B2B growth journeys',
  'Interactive branding',
  'Complex flows, simplified'
];

function isModifiedEvent(event) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

let sharedLightbox = null;
const FROST_NOISE_TILE_SIZE = 160;
let frostedNoisePattern = null;

function ensureImageLightbox() {
  if (sharedLightbox) return sharedLightbox;

  const overlay = document.createElement('div');
  overlay.className = 'image-lightbox';
  overlay.setAttribute('aria-hidden', 'true');

  const stage = document.createElement('div');
  stage.className = 'image-lightbox-stage';

  const image = document.createElement('img');
  image.className = 'image-lightbox-image';
  image.alt = '';

  const controls = document.createElement('div');
  controls.className = 'image-lightbox-controls';

  const zoomOut = document.createElement('button');
  zoomOut.type = 'button';
  zoomOut.className = 'image-lightbox-btn';
  zoomOut.textContent = '−';
  zoomOut.setAttribute('aria-label', 'Zoom out');

  const zoomIn = document.createElement('button');
  zoomIn.type = 'button';
  zoomIn.className = 'image-lightbox-btn';
  zoomIn.textContent = '+';
  zoomIn.setAttribute('aria-label', 'Zoom in');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'image-lightbox-btn image-lightbox-close';
  close.textContent = 'Close';
  close.setAttribute('aria-label', 'Close');

  controls.append(zoomOut, zoomIn, close);
  stage.append(image, controls);
  overlay.appendChild(stage);
  document.body.appendChild(overlay);

  let scale = 1;
  const minScale = 1;
  const maxScale = 4;
  const step = 0.2;

  const clamp = (value) => Math.max(minScale, Math.min(maxScale, value));
  const setScale = (value) => {
    scale = clamp(value);
    image.style.transform = `scale(${scale})`;
  };

  const open = ({ src, alt }) => {
    if (!src) return;
    image.src = src;
    image.alt = alt || '';
    setScale(1);
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
  };

  const closeLightbox = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    image.src = '';
    image.alt = '';
    document.body.classList.remove('lightbox-open');
  };

  const onKeydown = (event) => {
    if (!overlay.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setScale(scale + step);
      return;
    }
    if (event.key === '-') {
      event.preventDefault();
      setScale(scale - step);
    }
  };

  const onWheel = (event) => {
    if (!overlay.classList.contains('is-open')) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? step : -step;
    setScale(scale + delta);
  };

  const onOverlayClick = (event) => {
    if (event.target === overlay) {
      closeLightbox();
    }
  };

  zoomIn.addEventListener('click', () => setScale(scale + step));
  zoomOut.addEventListener('click', () => setScale(scale - step));
  close.addEventListener('click', closeLightbox);
  overlay.addEventListener('click', onOverlayClick);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('dblclick', () => setScale(scale >= 2 ? 1 : 2));
  document.addEventListener('keydown', onKeydown);

  sharedLightbox = { open };
  return sharedLightbox;
}

function mountImageLightbox(root, cleanups) {
  const lightbox = ensureImageLightbox();
  const images = Array.from(root.querySelectorAll('.cargo-media-item img'));
  const detachList = [];

  for (const image of images) {
    image.classList.add('zoomable-image');

    const onClick = (event) => {
      if (event.defaultPrevented || isModifiedEvent(event)) return;
      event.preventDefault();
      lightbox.open({
        src: image.currentSrc || image.src,
        alt: image.alt || ''
      });
    };

    image.addEventListener('click', onClick);
    detachList.push(() => image.removeEventListener('click', onClick));
  }

  cleanups.push(() => {
    detachList.forEach((detach) => detach());
  });
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let delta = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

function getFrostNoisePattern(ctx) {
  if (frostedNoisePattern) return frostedNoisePattern;

  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = FROST_NOISE_TILE_SIZE;
  noiseCanvas.height = FROST_NOISE_TILE_SIZE;
  const noiseContext = noiseCanvas.getContext('2d', { alpha: true });
  if (!noiseContext) return null;

  const imageData = noiseContext.createImageData(FROST_NOISE_TILE_SIZE, FROST_NOISE_TILE_SIZE);
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    const grain = 186 + Math.floor(Math.random() * 70);
    const alpha = 14 + Math.floor(Math.random() * 50);
    data[index] = grain;
    data[index + 1] = grain;
    data[index + 2] = grain;
    data[index + 3] = alpha;
  }
  noiseContext.putImageData(imageData, 0, 0);

  noiseContext.fillStyle = 'rgba(255, 255, 255, 0.2)';
  for (let index = 0; index < 210; index += 1) {
    const x = Math.random() * FROST_NOISE_TILE_SIZE;
    const y = Math.random() * FROST_NOISE_TILE_SIZE;
    const radius = Math.random() * 0.85 + 0.15;
    noiseContext.beginPath();
    noiseContext.arc(x, y, radius, 0, Math.PI * 2);
    noiseContext.fill();
  }

  frostedNoisePattern = ctx.createPattern(noiseCanvas, 'repeat');
  return frostedNoisePattern;
}

function drawFrostedGlassOverlay(ctx, width, height, phase, pointerRadius, centerX, centerY) {
  const shimmerX = Math.cos(phase * 0.34) * width * 0.08;
  const shimmerY = Math.sin(phase * 0.27) * height * 0.06;

  const bloom = ctx.createRadialGradient(
    centerX + shimmerX,
    centerY - height * 0.04 + shimmerY,
    Math.min(width, height) * 0.08,
    centerX,
    centerY,
    Math.max(width, height) * 0.78
  );
  bloom.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
  bloom.addColorStop(0.38, 'rgba(238, 241, 255, 0.06)');
  bloom.addColorStop(1, 'rgba(190, 178, 255, 0.015)');

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const haze = ctx.createLinearGradient(0, 0, width, height);
  haze.addColorStop(0, 'rgba(248, 244, 255, 0.055)');
  haze.addColorStop(0.45, 'rgba(232, 238, 255, 0.018)');
  haze.addColorStop(1, 'rgba(212, 220, 255, 0.05)');

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.56;
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const noisePattern = getFrostNoisePattern(ctx);
  if (!noisePattern) return;

  const driftX = ((phase * 34) % FROST_NOISE_TILE_SIZE) - FROST_NOISE_TILE_SIZE;
  const driftY = ((phase * 22) % FROST_NOISE_TILE_SIZE) - FROST_NOISE_TILE_SIZE;
  const noiseAreaWidth = width + FROST_NOISE_TILE_SIZE * 3;
  const noiseAreaHeight = height + FROST_NOISE_TILE_SIZE * 3;

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.05 + pointerRadius * 0.03;
  ctx.translate(driftX, driftY);
  ctx.fillStyle = noisePattern;
  ctx.fillRect(-FROST_NOISE_TILE_SIZE, -FROST_NOISE_TILE_SIZE, noiseAreaWidth, noiseAreaHeight);
  ctx.restore();

  const reverseX =
    (((-phase * 17) % FROST_NOISE_TILE_SIZE) + FROST_NOISE_TILE_SIZE) % FROST_NOISE_TILE_SIZE -
    FROST_NOISE_TILE_SIZE;
  const reverseY = ((phase * 11) % FROST_NOISE_TILE_SIZE) - FROST_NOISE_TILE_SIZE;

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.022;
  ctx.translate(reverseX, reverseY);
  ctx.fillStyle = noisePattern;
  ctx.fillRect(-FROST_NOISE_TILE_SIZE, -FROST_NOISE_TILE_SIZE, noiseAreaWidth, noiseAreaHeight);
  ctx.restore();
}

function drawKaleidoscopeFrame(
  ctx,
  image,
  width,
  height,
  pointerX,
  pointerY,
  phase,
  smoothedAngle = null,
  smoothedRadius = null
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const coverScale = Math.max(width / image.width, height / image.height) * 1.24;
  const drawWidth = image.width * coverScale;
  const drawHeight = image.height * coverScale;
  const dx = pointerX - 0.5;
  const dy = pointerY - 0.5;
  const fallbackAngle = Math.atan2(dy, dx);
  const fallbackRadius = Math.min(1, Math.hypot(dx, dy) / 0.7071);
  const pointerAngle = Number.isFinite(smoothedAngle) ? smoothedAngle : fallbackAngle;
  const pointerRadius = Number.isFinite(smoothedRadius) ? smoothedRadius : fallbackRadius;
  const panRangeX = Math.max(0, (drawWidth - width) * 0.5);
  const panRangeY = Math.max(0, (drawHeight - height) * 0.5);
  const radialPanStrength = pointerRadius * 0.38;
  const panX = Math.cos(pointerAngle) * panRangeX * radialPanStrength;
  const panY = Math.sin(pointerAngle) * panRangeY * radialPanStrength;
  const baseRotation = phase * 1.25 + pointerAngle * 0.08;
  const twist = (pointerRadius - 0.2) * 0.1;
  const slices = 8;
  const sliceAngle = (Math.PI * 2) / slices;
  const radius = Math.hypot(width, height) * 0.92;
  const arcPad = sliceAngle * 0.06;
  const edgeStroke = Math.max(0.65, Math.min(1.15, Math.min(width, height) * 0.0011));
  const edgeAlpha = 0.15 + pointerRadius * 0.07;

  // Avoid `clearRect()` with an opaque canvas: it can leave black pixels behind on some GPUs.
  ctx.fillStyle = '#0c1020';
  ctx.fillRect(0, 0, width, height);

  // Base full-bleed draw prevents edge gaps when slices rotate.
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(baseRotation * 0.35);
  ctx.drawImage(image, -drawWidth / 2 - panX, -drawHeight / 2 - panY, drawWidth, drawHeight);
  ctx.restore();

  for (let index = 0; index < slices; index += 1) {
    const start = index * sliceAngle + baseRotation;
    const end = start + sliceAngle;
    const mid = (start + end) * 0.5;
    const spokeDrift = Math.cos(pointerAngle - mid) * pointerRadius * Math.min(width, height) * 0.075;
    const sourceOffsetX = panX + Math.cos(mid) * spokeDrift;
    const sourceOffsetY = panY + Math.sin(mid) * spokeDrift;
    // Slight per-slice wobble breaks up the "flat" rotation and reads more radial.
    const wobble =
      Math.sin(phase * 0.92 + index * 0.73) * 0.07 +
      Math.cos(phase * 0.61 + index * 0.31) * 0.04;
    const sliceTwist = (index % 2 === 0 ? 1 : -1) * twist * 0.24 + wobble * pointerRadius * 0.1;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start - arcPad, end + arcPad, false);
    ctx.closePath();
    ctx.clip();

    if (index % 2 === 1) {
      ctx.scale(-1, 1);
    }

    ctx.rotate(sliceTwist);
    ctx.drawImage(
      image,
      -drawWidth / 2 - sourceOffsetX,
      -drawHeight / 2 - sourceOffsetY,
      drawWidth,
      drawHeight
    );
    ctx.restore();
  }

  // Frosted prism seam lines: only the radial dividers between slices.
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(baseRotation);
  ctx.strokeStyle = `rgba(255, 255, 255, ${edgeAlpha})`;
  ctx.lineWidth = edgeStroke;
  ctx.lineCap = 'round';
  for (let index = 0; index < slices; index += 1) {
    const angle = index * sliceAngle;
    const x = Math.cos(angle) * radius * 1.02;
    const y = Math.sin(angle) * radius * 1.02;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.08,
    centerX,
    centerY,
    Math.max(width, height) * 0.72
  );
  vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vignette.addColorStop(1, 'rgba(25, 20, 38, 0.2)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const sheen = ctx.createLinearGradient(0, 0, width, height);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
  sheen.addColorStop(0.32, 'rgba(255, 255, 255, 0.02)');
  sheen.addColorStop(0.68, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height);

  drawFrostedGlassOverlay(ctx, width, height, phase, pointerRadius, centerX, centerY);
}

function mountBioKaleidoscope(root, cleanups) {
  const canvas = root.querySelector('.bio-kaleidoscope-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
    return;
  }

  const sourceImageElement =
    root.querySelector('.bio-photo-grid .cargo-media-item img') || root.querySelector('.cargo-media-item img');
  const fallbackUrl = sourceImageElement?.currentSrc || sourceImageElement?.src || '';

  const image = new Image();
  image.decoding = 'async';

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;

  let width = 0;
  let height = 0;
  let dpr = Math.max(1.25, window.devicePixelRatio || 1);
  let currentX = 0.5;
  let currentY = 0.5;
  let targetX = 0.5;
  let targetY = 0.5;
  let currentAngle = 0;
  let targetAngle = 0;
  let currentRadius = 0;
  let targetRadius = 0;
  let phase = 0;
  let lastTime = 0;
  let hovering = false;
  let inView = true;
  let rafId = 0;
  let loaded = false;
  let lastPointerEventTime = performance.now();

  const updateSize = () => {
    dpr = Math.max(1.25, window.devicePixelRatio || 1);
    width = Math.max(1, Math.round(canvas.clientWidth));
    height = Math.max(1, Math.round(canvas.clientHeight));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (loaded) {
      drawKaleidoscopeFrame(context, image, width, height, currentX, currentY, phase, currentAngle, currentRadius);
    }
  };

  const tick = (time) => {
    rafId = 0;
    if (!loaded || !inView) return;

    const now = typeof time === 'number' ? time : performance.now();
    const dt = lastTime ? Math.min(0.06, (now - lastTime) / 1000) : 0.016;
    lastTime = now;

    // Continuous idle drift (replaces interval steps that can cause stutter).
    if (!hovering && now - lastPointerEventTime > 650) {
      const t = now / 1000;
      targetX = 0.5 + Math.cos(t * 0.18) * 0.06;
      targetY = 0.5 + Math.sin(t * 0.16) * 0.06;
      targetAngle = Math.atan2(targetY - 0.5, targetX - 0.5);
      targetRadius = clamp01(Math.hypot(targetX - 0.5, targetY - 0.5) / 0.7071);
    }

    currentX = lerp(currentX, targetX, 0.14);
    currentY = lerp(currentY, targetY, 0.14);
    // Near center, angle is unstable; keep it steady to avoid snap/rollback.
    if (targetRadius > 0.015 || currentRadius > 0.02) {
      currentAngle = lerpAngle(currentAngle, targetAngle, 0.11);
    }
    currentRadius = lerp(currentRadius, targetRadius, 0.12);

    // Slow baseline motion; slightly faster on hover and towards the edges.
    const speed = (hovering ? 0.24 : 0.1) + currentRadius * 0.14;
    phase += dt * speed;
    if (phase > Math.PI * 2) phase -= Math.PI * 2;

    drawKaleidoscopeFrame(
      context,
      image,
      width,
      height,
      currentX,
      currentY,
      phase + currentAngle * 0.18,
      currentAngle,
      currentRadius
    );

    rafId = window.requestAnimationFrame(tick);
  };

  const scheduleRender = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(tick);
  };

  const setPointerTarget = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    targetX = clamp01((clientX - rect.left) / rect.width);
    targetY = clamp01((clientY - rect.top) / rect.height);

    const dx = targetX - 0.5;
    const dy = targetY - 0.5;
    targetAngle = Math.atan2(dy, dx);
    targetRadius = clamp01(Math.hypot(dx, dy) / 0.7071);
    scheduleRender();
  };

  const onPointerMove = (event) => {
    setPointerTarget(event.clientX, event.clientY);
    lastPointerEventTime = performance.now();
  };

  const onPointerEnter = () => {
    hovering = true;
    lastPointerEventTime = performance.now();
    scheduleRender();
  };

  const onPointerLeave = () => {
    targetX = 0.5;
    targetY = 0.5;
    targetAngle = currentAngle;
    targetRadius = 0;
    hovering = false;
    lastPointerEventTime = performance.now();
    scheduleRender();
  };

  const onResize = () => {
    updateSize();
    scheduleRender();
  };

  image.addEventListener('load', () => {
    loaded = true;
    updateSize();
    scheduleRender();
  });

  const sources = [...BIO_KALEIDOSCOPE_SOURCES, fallbackUrl].filter(Boolean);
  let sourceIndex = 0;
  const tryNextSource = () => {
    sourceIndex += 1;
    if (sourceIndex >= sources.length) return;
    image.src = sources[sourceIndex];
  };
  image.addEventListener('error', tryNextSource);
  image.src = sources[sourceIndex] || '';

  const observer = new IntersectionObserver(
    (entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      if (inView) {
        lastTime = 0;
        lastPointerEventTime = performance.now();
        scheduleRender();
      }
    },
    { root: null, threshold: 0.05 }
  );
  observer.observe(canvas);

  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerenter', onPointerEnter);
  canvas.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('resize', onResize);

  cleanups.push(() => {
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerenter', onPointerEnter);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('resize', onResize);
    observer.disconnect();
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  });
}

function mountHeroTypewriter(root, cleanups) {
  const header = root.querySelector('.section-header');
  if (!header) return;

  const firstColumnSet = root.querySelector('column-set');
  if (firstColumnSet) {
    for (const unit of Array.from(firstColumnSet.querySelectorAll('column-unit[slot="0"], column-unit[slot="1"]'))) {
      unit.remove();
    }
    const titleUnit = firstColumnSet.querySelector('column-unit[slot="2"]');
    if (titleUnit) {
      titleUnit.setAttribute('span', '12');
    }
  }

  header.classList.add('hero-typewriter');
  header.classList.remove('typewriter-headline', 'is-typed');

  const textHost = header.querySelector('i') || header;
  const introNode = document.createElement('span');
  introNode.className = 'hero-typewriter-intro';
  introNode.textContent = HERO_INTRO_LINE;
  const rotatingLineNode = document.createElement('span');
  rotatingLineNode.className = 'hero-typewriter-rotating';
  const prefixNode = document.createElement('span');
  prefixNode.className = 'hero-typewriter-prefix';
  prefixNode.textContent = HERO_ROTATING_PREFIX;
  const textNode = document.createElement('span');
  textNode.className = 'hero-typewriter-text';

  textHost.textContent = '';
  rotatingLineNode.append(prefixNode, textNode);
  textHost.append(introNode, rotatingLineNode);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    textNode.textContent = `${HERO_LEAD_SPACE}${HERO_TYPEWRITER_LINES[0]}`;
  } else {
    let lineIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timerId = 0;

    const typingSpeed = 76;
    const deletingSpeed = 34;
    const pauseAfterTyping = 1150;
    const pauseBeforeNext = 340;
    const deleteStep = 2;

    const render = () => {
      const phrase = HERO_TYPEWRITER_LINES[lineIndex];
      const currentText = phrase.slice(0, charIndex);
      textNode.textContent = currentText ? `${HERO_LEAD_SPACE}${currentText}` : HERO_LEAD_SPACE;
    };

    const tick = () => {
      const phrase = HERO_TYPEWRITER_LINES[lineIndex];

      if (!isDeleting) {
        if (charIndex < phrase.length) {
          charIndex += 1;
          render();
          timerId = window.setTimeout(tick, typingSpeed);
          return;
        }
        isDeleting = true;
        timerId = window.setTimeout(tick, pauseAfterTyping);
        return;
      }

      if (charIndex > 0) {
        charIndex = Math.max(0, charIndex - deleteStep);
        render();
        timerId = window.setTimeout(tick, deletingSpeed);
        return;
      }

      isDeleting = false;
      lineIndex = (lineIndex + 1) % HERO_TYPEWRITER_LINES.length;
      timerId = window.setTimeout(tick, pauseBeforeNext);
    };

    render();
    timerId = window.setTimeout(tick, 360);
    cleanups.push(() => {
      window.clearTimeout(timerId);
    });
  }
}

export default function CargoContent({ html, projectNumber = null, pagePurl = '' }) {
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
        pagePurl,
        projectNumber
      }),
    [html, pagePurl, projectNumber]
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
      if (anchor.dataset.disabledLink === 'true') {
        event.preventDefault();
        return;
      }

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

    if (pagePurl === HERO_PURL) {
      mountHeroTypewriter(root, cleanups);
    }

    if (pagePurl === BIO_PURL) {
      mountBioKaleidoscope(root, cleanups);
    }

    mountImageLightbox(root, cleanups);

    const slideshows = Array.from(root.querySelectorAll('.cargo-gallery-slideshow'));

    for (const slideshow of slideshows) {
      const slides = Array.from(slideshow.querySelectorAll(':scope > .cargo-media-item'));
      if (slides.length <= 1) {
        slides.forEach((slide) => {
          slide.classList.add('is-active');
        });
        continue;
      }

      slideshow.classList.add('is-enhanced');

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
  }, [pagePurl, transformed]);

  return (
    <bodycopy
      ref={contentRef}
      className="cargo-content"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: transformed }}
    />
  );
}
