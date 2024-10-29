import * as Headless from "@headlessui/react";

import { Subheading } from "../heading";
import { Label } from "../fieldset";

import { useRoom } from "../../hooks/useRoom";
import ChannelListbox from "../dropdowns/channelListbox";

const ChatHeading = () => {
  const { channels } = useRoom();

  return (
    <>
      {channels.length > 0 && (
        <Subheading className='fixed left-0 right-0 top-12 border-zinc-950/10 bg-white p-4 px-6 lg:left-64 lg:right-2 lg:top-0 lg:border-b lg:px-28 dark:border-white/10 dark:bg-zinc-900'>
          <Headless.Field className='hidden items-baseline justify-between lg:gap-6 max-sm:flex lg:flex'>
            <Label>Channel: </Label>

            <ChannelListbox />
          </Headless.Field>
        </Subheading>
      )}
    </>
  );
};

export default ChatHeading;
