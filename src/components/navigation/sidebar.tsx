import { Sidebar, SidebarHeader, SidebarItem, SidebarLabel } from "../sidebar";
import { Link } from "../link";

import ConnectButtonSidebar from "../buttons/connectSidebar";
import CatAvatar from "../avatars/cat";

export interface SideBarProps {
  roomUrl: string;
}

const SideBar = ({ roomUrl }: SideBarProps) => {
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={"/"}>
          <SidebarItem className='lg:mb-2.5'>
            <CatAvatar />
            <SidebarLabel>p2party</SidebarLabel>
          </SidebarItem>
        </Link>
      </SidebarHeader>

      <ConnectButtonSidebar roomUrl={roomUrl ?? ""} />
    </Sidebar>
  );
};

export default SideBar;
