import { Navbar, NavbarSpacer } from "../navbar";
import ConnectButtonNavigation from "../buttons/connectNavigation";

export interface NavBarProps {
  roomUrl: string;
}

const NavBar = ({ roomUrl }: NavBarProps) => {
  return (
    <Navbar>
      <NavbarSpacer />

      <ConnectButtonNavigation roomUrl={roomUrl ?? ""} />
    </Navbar>
  );
};

export default NavBar;
