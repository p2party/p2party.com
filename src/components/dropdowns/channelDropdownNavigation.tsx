import { useRoom } from "../../hooks/useRoom";

import { Dropdown, DropdownButton } from "../dropdown";
import { SidebarLabel } from "../sidebar";
import { NavbarItem } from "../navbar";
import ChannelDropdownMenu from "./channelDropdownMenu";

import { ChatBubbleBottomCenterTextIcon } from "@heroicons/react/20/solid";

const ChannelDropdownNavigation = () => {
  const { channels } = useRoom({ subscribeToMessages: false });
  const channelsLen = channels.length;

  return (
    <Dropdown>
      <DropdownButton as={NavbarItem}>
        <ChatBubbleBottomCenterTextIcon />
        <SidebarLabel>{channelsLen}</SidebarLabel>
      </DropdownButton>

      <ChannelDropdownMenu />
    </Dropdown>
  );
};

export default ChannelDropdownNavigation;
