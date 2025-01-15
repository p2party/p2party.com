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

  const [messagesLen, setMessagesLen] = useState<number[]>([]);

  useEffect(() => {
    const mlen = messages.length;
    const clen = channels.length;
    for (let i = 0; i < clen; i++) {
      let k = 0;
      for (let j = 0; j < mlen; j++) {
        if (messages[j].channelLabel === channels[i].label) k++;
      }

      const m = messagesLen;
      m[i] = k;
      setMessagesLen(m);
    }
  }, [messages, selectedChannel, channels]);

  return (
    <Listbox
      name='Current Channel'
      placeholder='Select channel'
      defaultValue={selectedChannel}
      onChange={selectChannel}
    >
      {channels.map((channel, i) => (
        <ListboxOption value={channel.label} key={channel.label}>
          <ListboxLabel className='capitalize'>{channel.label} :</ListboxLabel>
          <ListboxDescription>
            {channel.peerIds.length} peers, {messagesLen[i]} messages,{" "}
            {channels.length} channels
          </ListboxDescription>
        </ListboxOption>
      ))}
    </Listbox>
  );
};

export default ChannelListbox;
