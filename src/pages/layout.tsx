"use client";

import { useEffect, useState } from "react";

import { Avatar } from "../components/avatar";
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from "../components/navbar";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  // SidebarHeading,
  SidebarItem,
  SidebarLabel,
  // SidebarSection,
  SidebarSpacer,
} from "../components/sidebar";
// import { QRCodeAvatar } from "../components/qrcodeavatar";
import { SidebarLayout } from "../components/sidebar-layout";
import { Link } from "../components/link";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../components/dropdown";

import { useRoom } from "../hooks/useRoom";

import {
  UserIcon,
  HomeIcon,
  PlusIcon,
  MagnifyingGlassIcon as MagnifyingGlassIcon16,
  MinusIcon,
  StopIcon,
  CheckIcon,
  XMarkIcon,
  NoSymbolIcon,
  ChatBubbleBottomCenterTextIcon as ChatBubbleBottomCenterTextIcon16,
  UserGroupIcon as UserGroupIcon16,
  SignalIcon as SignalIcon16,
  SignalSlashIcon as SignalSlashIcon16,
  EllipsisHorizontalIcon as EllipsisHorizontalIcon16,
  TrashIcon as TrashIcon16,
} from "@heroicons/react/16/solid";
import {
  SignalIcon,
  SignalSlashIcon,
  EllipsisHorizontalIcon,
  // MagnifyingGlassIcon,
  ChatBubbleBottomCenterTextIcon,
  UserGroupIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";

import type { PropsWithChildren } from "react";

const Layout = ({ children }: PropsWithChildren) => {
  const [peersLen, setPeersLen] = useState(0);
  const [channelsLen, setChannelsLen] = useState(0);

  const { peers, channels, signalingServerConnectionState, roomId, peerId } =
    useRoom();

  useEffect(() => {
    setPeersLen(peers.length);
  }, [peers]);

  useEffect(() => {
    setChannelsLen(channels.length);
  }, [channels]);

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                {signalingServerConnectionState.isConnected && <SignalIcon />}

                {signalingServerConnectionState.isEstablishingConnection && (
                  <div className='relative h-6 w-6'>
                    {/* First icon (background) */}
                    <SignalIcon className='absolute inset-0' />

                    {/* Second icon (foreground) */}
                    <EllipsisHorizontalIcon className='absolute inset-0' />
                  </div>
                )}

                {!signalingServerConnectionState.isEstablishingConnection &&
                  !signalingServerConnectionState.isConnected && (
                    <SignalSlashIcon />
                  )}
              </DropdownButton>
              <DropdownMenu className='min-w-64' anchor='bottom start'>
                {signalingServerConnectionState.isConnected && (
                  <DropdownItem>
                    <XMarkIcon />
                    Disconnect from signaling server
                  </DropdownItem>
                )}

                {signalingServerConnectionState.isConnected && (
                  <DropdownItem>
                    <NoSymbolIcon />
                    Disconnect and stop receiving signaling info
                  </DropdownItem>
                )}

                {!signalingServerConnectionState.isConnected && (
                  <DropdownItem>
                    <CheckIcon />
                    Connect to signaling server
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>

            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <UserGroupIcon />
                <SidebarLabel>{peersLen}</SidebarLabel>
              </DropdownButton>
              <DropdownMenu className='min-w-64' anchor='bottom start'>
                <DropdownItem>
                  <MagnifyingGlassIcon16 />
                  Search peers
                </DropdownItem>

                <DropdownItem>
                  <PlusIcon />
                  Add peer
                </DropdownItem>

                <DropdownItem>
                  <MinusIcon />
                  Remove peer
                </DropdownItem>

                <DropdownItem>
                  <StopIcon />
                  Block peer
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>

            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <ChatBubbleBottomCenterTextIcon />
                <SidebarLabel>{channelsLen}</SidebarLabel>
              </DropdownButton>
              <DropdownMenu className='min-w-64' anchor='bottom start'>
                <DropdownItem>
                  <MagnifyingGlassIcon16 />
                  Search channel
                </DropdownItem>

                <DropdownItem>
                  <PlusIcon />
                  New channel
                </DropdownItem>

                <DropdownItem>
                  <MinusIcon />
                  Exit channel
                </DropdownItem>

                <DropdownItem>
                  <StopIcon />
                  Block channel
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>

            {/*
            <NavbarItem href='/search' aria-label='Search'>
              <MagnifyingGlassIcon />
            </NavbarItem>
            */}
            <NavbarItem href='/inbox' aria-label='Inbox'>
              <TrashIcon />
            </NavbarItem>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <Link href={"/"}>
              <SidebarItem className='lg:mb-2.5'>
                <Avatar src='/tailwind-logo.svg' />
                <SidebarLabel>p2party</SidebarLabel>
              </SidebarItem>
            </Link>
          </SidebarHeader>
          <SidebarBody>
            <SidebarItem>
              <span className='flex min-w-0 items-center gap-3'>
                <HomeIcon className='size-7' />
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
                <UserIcon className='size-7' />
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

            <Dropdown>
              <DropdownButton as={SidebarItem}>
                {signalingServerConnectionState.isConnected && (
                  <span className='flex min-w-0 items-center gap-3'>
                    <SignalIcon16 className='size-7' />
                    <span className='min-w-0'>
                      <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                        Signaling server:
                      </span>
                      <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                        Connected
                      </span>
                    </span>
                  </span>
                )}

                {signalingServerConnectionState.isEstablishingConnection && (
                  <span className='flex min-w-0 items-center gap-3'>
                    <div className='relative size-7'>
                      {/* First icon (background) */}
                      <SignalIcon16 className='absolute inset-0 size-7' />

                      {/* Second icon (foreground) */}
                      <EllipsisHorizontalIcon16 className='absolute inset-0 size-7' />
                    </div>
                    <span className='min-w-0'>
                      <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                        Signaling server:
                      </span>
                      <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                        {signalingServerConnectionState.isConnected
                          ? "Disconnecting"
                          : "Connecting"}
                      </span>
                    </span>
                  </span>
                )}

                {!signalingServerConnectionState.isEstablishingConnection &&
                  !signalingServerConnectionState.isConnected && (
                    <span className='flex min-w-0 items-center gap-3'>
                      <SignalSlashIcon16 className='size-7' />
                      <span className='min-w-0'>
                        <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                          Signaling server:
                        </span>
                        <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                          Disconnected
                        </span>
                      </span>
                    </span>
                  )}
              </DropdownButton>
              <DropdownMenu className='min-w-64' anchor='bottom start'>
                {signalingServerConnectionState.isConnected && (
                  <DropdownItem>
                    <XMarkIcon />
                    Disconnect from signaling server
                  </DropdownItem>
                )}

                {signalingServerConnectionState.isConnected && (
                  <DropdownItem>
                    <NoSymbolIcon />
                    Disconnect and stop receiving signaling info
                  </DropdownItem>
                )}

                {!signalingServerConnectionState.isConnected && (
                  <DropdownItem>
                    <CheckIcon />
                    Connect to signaling server
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>

            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className='flex min-w-0 items-center gap-3'>
                  <UserGroupIcon16 className='size-7' />
                  <span className='min-w-0'>
                    <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                      Connected Peers:
                    </span>
                    <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                      {peersLen}
                    </span>
                  </span>
                </span>
              </DropdownButton>
              <DropdownMenu className='min-w-64' anchor='bottom start'>
                <DropdownItem>
                  <MagnifyingGlassIcon16 />
                  Search peers
                </DropdownItem>

                <DropdownItem>
                  <PlusIcon />
                  Add peer
                </DropdownItem>

                <DropdownItem>
                  <MinusIcon />
                  Remove peer
                </DropdownItem>

                <DropdownItem>
                  <StopIcon />
                  Block peer
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>

            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className='flex min-w-0 items-center gap-3'>
                  <ChatBubbleBottomCenterTextIcon16 className='size-7' />
                  <span className='min-w-0'>
                    <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                      Active Conversations:
                    </span>
                    <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                      {channelsLen}
                    </span>
                  </span>
                </span>
              </DropdownButton>
              <DropdownMenu className='min-w-64' anchor='bottom start'>
                <DropdownItem>
                  <MagnifyingGlassIcon16 />
                  Search channel
                </DropdownItem>

                <DropdownItem>
                  <PlusIcon />
                  New channel
                </DropdownItem>

                <DropdownItem>
                  <MinusIcon />
                  Exit channel
                </DropdownItem>

                <DropdownItem>
                  <StopIcon />
                  Block channel
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <SidebarSpacer />

            <SidebarFooter>
              <SidebarItem>
                <span className='flex min-w-0 items-center gap-3'>
                  <TrashIcon16 className='size-7' />
                  <span className='min-w-0 text-sm/5 font-medium text-zinc-950 dark:text-white'>
                    Delete
                  </span>
                </span>
              </SidebarItem>
            </SidebarFooter>
          </SidebarBody>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  );
};

export default Layout;
