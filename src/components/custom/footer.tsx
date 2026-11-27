import { Link } from "../link";

const Footer = () => {
  return (
    <footer className='fixed bottom-5 z-10 sm:right-3'>
      <div className='md:order-1'>
        <Link
          href='https://github.com/p2party/p2party.com-source'
          target='_blank'
          rel='noopener noreferrer'
          className='text-center text-xs leading-5 text-gray-500'
        >
          Source · AGPL-3.0-only · &copy; 2025–2026 p2party contributors
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
