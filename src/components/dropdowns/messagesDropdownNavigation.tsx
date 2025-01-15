import { useState, useEffect } from "react";

import { useRoom } from "../../hooks/useRoom";

import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from "../dropdown";
import { SidebarLabel } from "../sidebar";
import { NavbarItem } from "../navbar";

import {
  ChatBubbleBottomCenterTextIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";

const MessagesDropdownNavigation = () => {
  const { messages, deleteMessage } = useRoom();

  const [messagesLen, setMessagesLen] = useState(0);

  useEffect(() => {
    setMessagesLen(messages.length);
  }, [messages, setMessagesLen]);

  const handleDeleteMessages = async () => {
    const MESSAGES_LEN = messages.length;
    for (let i = 0; i < MESSAGES_LEN; i++) {
      await deleteMessage(messages[i].merkleRootHex);
    }
  };

  return (
    <Dropdown>
      <DropdownButton as={NavbarItem}>
        <ChatBubbleBottomCenterTextIcon />
        <SidebarLabel>{messagesLen}</SidebarLabel>
      </DropdownButton>

      {messages.length > 0 && (
        <DropdownMenu anchor='bottom start'>
          <DropdownItem onClick={handleDeleteMessages}>
            <TrashIcon />
            Delete messages
          </DropdownItem>
        </DropdownMenu>
      )}
    </Dropdown>
  );
};

export default MessagesDropdownNavigation;
