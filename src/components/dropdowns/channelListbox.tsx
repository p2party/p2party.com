import { useState, useEffect } from "react";

import {
  Listbox,
  ListboxDescription,
  ListboxOption,
  ListboxLabel,
} from "../listbox";

import { useRoom } from "../../hooks/useRoom";

const ChannelListbox = () => {
  const { channels, messages, selectedChannel, selectChannel } = useRoom();

  const [messagesLen, setMessagesLen] = useState(0);

  useEffect(() => {
    const len = messages.length;
    let j = 0;
    for (let i = 0; i < len; i++) {
      if (messages[i].channelLabel === selectedChannel) j++;
    }

    if (j !== messagesLen) setMessagesLen(j);
  }, [messages, selectedChannel]);

  return (
    <Listbox
      name='Current Channel'
      placeholder='Select channel'
      defaultValue={selectedChannel}
      onChange={selectChannel}
    >
      {channels.map((channel) => (
        <ListboxOption value={channel.label} key={channel.label}>
          <ListboxLabel className='capitalize'>{channel.label}:</ListboxLabel>
          <ListboxDescription>
            {channel.peerIds.length} peers, {messagesLen} messages
          </ListboxDescription>
        </ListboxOption>
      ))}
    </Listbox>
  );
};

export default ChannelListbox;
