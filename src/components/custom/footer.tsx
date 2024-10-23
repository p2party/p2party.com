import { Link } from "../link";

const Footer = () => {
  return (
    <footer className='fixed left-1 bottom-0 z-0 pb-1 pt-2'>
        <div className='mt-8 md:order-1 md:mt-0'>
          <Link
            href={"https://github.com/p2party"}
            target='_blank'
            rel='noopener noreferrer'
            className='text-center text-xs leading-5 text-gray-500'
          >
            &copy; 2024 Deliberative Technologies. All rights reserved.
          </Link>
        </div>
    </footer>
  );
};

export default Footer;
