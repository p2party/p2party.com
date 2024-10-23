import { useState, useEffect } from "react";

import { useRoom } from "../../hooks/useRoom";

import { Dropdown, DropdownButton } from "../dropdown";
import { SidebarLabel } from "../sidebar";
import { NavbarItem } from "../navbar";
import ChannelDropdownMenu from "./channelDropdownMenu";

import { UserGroupIcon } from "@heroicons/react/20/solid";

const ChannelDropdownNavigation = () => {
  const { channels } = useRoom();

  const [channelsLen, setChannelsLen] = useState(0);

  useEffect(() => {
    setChannelsLen(channels.length);
  }, [channels, setChannelsLen]);

  return (
    <Dropdown>
      <DropdownButton as={NavbarItem}>
        <UserGroupIcon />
        <SidebarLabel>{channelsLen}</SidebarLabel>
      </DropdownButton>

      <ChannelDropdownMenu />
    </Dropdown>
  );
};

export default ChannelDropdownNavigation;
