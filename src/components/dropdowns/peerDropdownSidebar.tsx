import { useState, useEffect } from "react";

import { useRoom } from "../../hooks/useRoom";

import { UserGroupIcon } from "@heroicons/react/16/solid";

import { Dropdown, DropdownButton } from "../dropdown";
import { SidebarItem } from "../sidebar";

import PeerDropdownMenu from "./peerDropdownMenu";

const PeerDropdownSidebar = () => {
  const { peers } = useRoom();

  const [peersLen, setPeersLen] = useState(0);

  useEffect(() => {
    setPeersLen(peers.length);
  }, [peers, setPeersLen]);

  return (
    <Dropdown>
      <DropdownButton as={SidebarItem}>
        <span className='flex min-w-0 items-center gap-3'>
          <UserGroupIcon className='size-7' />
          <span className='min-w-0'>
            <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
              Peers:
            </span>
            <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
              {peersLen}
            </span>
          </span>
        </span>
      </DropdownButton>

      <PeerDropdownMenu />
    </Dropdown>
  );
};

export default PeerDropdownSidebar;
