import { useState, useEffect } from "react";

import { useRoom } from "../../hooks/useRoom";

import { UserGroupIcon } from "@heroicons/react/20/solid";

import { Dropdown, DropdownButton } from "../dropdown";
import { SidebarLabel } from "../sidebar";
import { NavbarItem } from "../navbar";

import PeerDropdownMenu from "./peerDropdownMenu";

const PeerDropdownNavigation = () => {
  const { peers } = useRoom();

  const [peersLen, setPeersLen] = useState(0);

  useEffect(() => {
    setPeersLen(peers.length);
  }, [peers, setPeersLen]);

  return (
    <Dropdown>
      <DropdownButton as={NavbarItem}>
        <UserGroupIcon />
        <SidebarLabel>{peersLen}</SidebarLabel>
      </DropdownButton>

      <PeerDropdownMenu />
    </Dropdown>
  );
};

export default PeerDropdownNavigation;
