import { useMemo } from "react";

import {
  Listbox,
  ListboxDescription,
  ListboxOption,
  ListboxLabel,
} from "../listbox";

import { useRoom } from "../../hooks/useRoom";

const ChannelListbox = () => {
  const { channels, messages, selectedChannel, selectChannel } = useRoom();

  const messagesLen = useMemo(
    () =>
      channels.map(
        (channel) =>
          messages.filter((m) => m.channelLabel === channel.label).length,
      ),
    [channels, messages],
  );

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
