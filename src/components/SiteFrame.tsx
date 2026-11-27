import { Outlet, useLocation } from "react-router";
import { Link } from "./link";
import { WalletNav } from "./SharedWalletBalance";

const sections = [
  ["Protocol", "/protocol"],
  ["Roadmap", "/roadmap"],
  ["Whitepaper", "/whitepaper"],
  ["Explorer", "/explorer"],
] as const;

export function SiteFrame() {
  const path = useLocation().pathname.replace(/\/+$/, "");
  return (
    <div className='site-frame'>
      <a className='site-skip' href='#site-content'>
        Skip to content
      </a>
      <header className='site-header'>
        <nav className='site-bar' aria-label='Site navigation'>
          <Link
            href='/'
            className='site-brand'
            aria-label='p2party home'
            aria-current={path === "" ? "page" : undefined}
          >
            <img src='/logo-cat-tight.svg' width='36' height='36' alt='' />
            p2party
          </Link>
          <div className='site-sections'>
            {sections.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  path === href
                    ? "page"
                    : path.startsWith(href + "/")
                      ? "location"
                      : undefined
                }
              >
                {label}
              </Link>
            ))}
            <WalletNav current={path === "/wallet"} />
          </div>
          <Link className='site-rooms' href='/rooms'>
            Rooms <span aria-hidden='true'>→</span>
          </Link>
        </nav>
      </header>
      <div id='site-content' tabIndex={-1}>
        <Outlet />
      </div>
      <footer className='site-footer'>
        <div className='site-bar'>
          <span>© 2026 p2party</span>
          <nav aria-label='More from p2party'>
            <Link
              href='/blog'
              aria-current={path.startsWith("/blog") ? "location" : undefined}
            >
              Field notes
            </Link>
            <Link
              href='/session-lab'
              aria-current={path === "/session-lab" ? "page" : undefined}
            >
              Crypto lab
            </Link>
            <Link
              href='/privacy-policy'
              aria-current={path === "/privacy-policy" ? "page" : undefined}
            >
              Privacy
            </Link>
            <Link
              href='/terms-of-service'
              aria-current={path === "/terms-of-service" ? "page" : undefined}
            >
              Terms
            </Link>
            <Link href='https://github.com/p2party/p2party.com'>
              Website source
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
