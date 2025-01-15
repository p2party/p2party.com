import { lazy, Suspense } from "react";

import { HomeIcon, TrashIcon, UserIcon } from "@heroicons/react/20/solid";

import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
} from "../sidebar";
import { Link } from "../link";

import CatAvatar from "../avatars/cat";

import { useRoom } from "../../hooks/useRoom";

const SignalingDropdownSidebar = lazy(
  () => import("../dropdowns/signalingDropdownSidebar"),
);

export interface SideBarProps {
  roomUrl: string;
}

const SideBar = () => {
  // { roomUrl }: SideBarProps) => {
  const { roomId, peerId, purge } = useRoom();

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

      <SidebarBody>
        <Suspense>
          <SignalingDropdownSidebar />
        </Suspense>

        <SidebarItem>
          <span className='flex min-w-0 items-center gap-3'>
            <HomeIcon className='size-10' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Room ID:
              </span>
              <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                {roomId.length > 0 ? roomId : '""'}
              </span>
            </span>
          </span>
        </SidebarItem>

        <SidebarItem>
          <span className='flex min-w-0 items-center gap-3'>
            <UserIcon className='size-10' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                My Peer ID:
              </span>
              <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                {peerId.length > 0 ? peerId : '""'}
              </span>
            </span>
          </span>
        </SidebarItem>

        <SidebarItem onClick={purge}>
          <span className='flex min-w-0 items-center gap-3'>
            <TrashIcon className='size-9' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Delete all
              </span>
            </span>
          </span>
        </SidebarItem>
      </SidebarBody>
    </Sidebar>
  );
};

export default SideBar;
