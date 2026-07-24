import { useRoom } from "../../hooks/useRoom";

import { Dropdown, DropdownButton } from "../dropdown";
import { SidebarItem } from "../sidebar";
import ChannelDropdownMenu from "./channelDropdownMenu";

import { ChatBubbleBottomCenterTextIcon } from "@heroicons/react/16/solid";

const ChannelDropdownNavigation = () => {
  const { channels } = useRoom({ subscribeToMessages: false });
  const channelsLen = channels.length;

  return (
    <Dropdown>
      <DropdownButton as={SidebarItem}>
        <span className='flex min-w-0 items-center gap-3'>
          <ChatBubbleBottomCenterTextIcon className='size-7' />
          <span className='min-w-0'>
            <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
              Conversations:
            </span>
            <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
              {channelsLen}
            </span>
          </span>
        </span>
      </DropdownButton>

      <ChannelDropdownMenu />
    </Dropdown>
  );
};

export default ChannelDropdownNavigation;
