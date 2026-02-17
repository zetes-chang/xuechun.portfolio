import { Link } from 'react-router-dom';
import { manifest, toRoutePath } from '../lib/cargoData';

export default function SiteHeader({ cvHref }) {
  return (
    <header className="site-header">
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

