export default function SiteFooter() {
  const email = 'thisisxuechun@gmail.com';
  const linkedinUrl = 'https://www.linkedin.com/in/xuechun-sophia-tao';
  const year = String(new Date().getFullYear());

  return (
    <footer className="custom-footer" data-standalone-footer="true">
      <div className="custom-footer-top">
        <div className="custom-footer-left">
          <p className="custom-footer-kicker">Got an idea?</p>
          <a className="custom-footer-email" href={`mailto:${email}`}>
            {email}
          </a>
        </div>

        <div className="custom-footer-right">
          <a className="custom-footer-linkedin" href={linkedinUrl} target="_blank" rel="noopener noreferrer">
            LinkedIn ↗
          </a>
        </div>
      </div>

      <div className="custom-footer-bottom">
        <p className="custom-footer-copy">© {year} Xuechun Sophia Tao. All Rights Reserved.</p>
      </div>
    </footer>
  );
}

