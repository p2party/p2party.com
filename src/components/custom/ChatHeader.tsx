import * as Headless from "@headlessui/react";

import { Subheading } from "../heading";
// import { Label } from "../fieldset";

import { useRoom } from "../../hooks/useRoom";
import ChannelListbox from "../dropdowns/channelListbox";

const ChatHeading = () => {
  const { channels } = useRoom({ subscribeToMessages: false });

  return (
    <>
      {channels.length > 0 && (
        <Subheading className='fixed top-12 right-0 left-0 border-zinc-950/10 bg-white p-4 px-6 lg:top-0 lg:right-2 lg:left-64 lg:border-b lg:px-28 dark:border-white/10 dark:bg-zinc-900'>
          <Headless.Field className='hidden items-baseline justify-between max-sm:flex lg:flex lg:gap-6'>
            <ChannelListbox />
          </Headless.Field>
        </Subheading>
      )}
    </>
  );
};

export default ChatHeading;
