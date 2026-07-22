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

const MessagesDropdown = () => {
  const { messages, deleteMessage } = useRoom();
  const messagesLen = messages.length;

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

export default MessagesDropdown;
