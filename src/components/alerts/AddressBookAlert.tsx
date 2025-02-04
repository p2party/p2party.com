import { FC, useEffect, useState } from "react";
import p2party from "p2party";

import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  AlertBody,
} from "../alert";
import { Button } from "../button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";

import { XMarkIcon } from "@heroicons/react/20/solid";

// import { useRoom } from "../../hooks/useRoom";

import type { Dispatch, SetStateAction } from "react";
import type { UsernamedPeer } from "p2party";

export interface AddressBookAlertProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const AddressBookAlert: FC<AddressBookAlertProps> = ({ isOpen, setIsOpen }) => {
  // const { peers } = useRoom();
  const [addressBookPeers, setAddressBookPeers] = useState<UsernamedPeer[]>([]);

  useEffect(() => {
    const getAddressBook = async () => {
      const p = await p2party.getAllPeersInAddressBook();

      setAddressBookPeers(p);
    };

    getAddressBook();
  }, [isOpen, setAddressBookPeers]);

  const handleRemovePeerFromAddressBook = async (
    peerId?: string,
    peerPublicKey?: string,
  ) => {
    const addressBookIndex = addressBookPeers.findIndex(
      (b) => b.peerId === peerId,
    );

    if (addressBookIndex > -1) {
      await p2party.deletePeerFromAddressBook(peerId, peerPublicKey);
      const p = addressBookPeers;
      p.splice(addressBookIndex, 1);
      setAddressBookPeers(p);
    }
  };

  return (
    <Alert open={isOpen} onClose={setIsOpen} size='lg'>
      <AlertTitle>Address Book</AlertTitle>
      <AlertDescription className='text-justify text-zinc-950 dark:text-white'>
        You can create exclusive rooms with these peers by selecting to only
        connect with them in the settings.
      </AlertDescription>
      <AlertBody>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className='relative w-0'>
                <span className='sr-only'>Delete</span>
              </TableHeader>
              <TableHeader>Username</TableHeader>
              <TableHeader>Peer id</TableHeader>
              <TableHeader>Public key</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {addressBookPeers.map((peer) => (
              <TableRow key={peer.peerId}>
                <TableCell>
                  <Button
                    plain
                    onClick={async () =>
                      await handleRemovePeerFromAddressBook(
                        peer.peerId,
                        peer.peerPublicKey,
                      )
                    }
                  >
                    <XMarkIcon />
                  </Button>
                </TableCell>

                <TableCell className='font-medium'>{peer.username}</TableCell>

                <TableCell>
                  ...
                  {peer.peerId.substring(
                    peer.peerId.length - 10,
                    peer.peerId.length,
                  )}
                </TableCell>
                <TableCell className='text-zinc-500'>
                  {peer.peerPublicKey.substring(0, 10)}...
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AlertBody>
      <AlertActions>
        <Button autoFocus onClick={() => setIsOpen(false)}>
          Done
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default AddressBookAlert;
