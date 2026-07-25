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
import type { BlacklistedPeer } from "p2party";

export interface BlacklistAlertProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const BlacklistAlert: FC<BlacklistAlertProps> = ({ isOpen, setIsOpen }) => {
  // const { peers } = useRoom();
  const [blacklistedPeers, setBlacklistedPeers] = useState<BlacklistedPeer[]>(
    [],
  );

  useEffect(() => {
    const getBlacklisted = async () => {
      const p = await p2party.getAllPeersInBlacklist();

      setBlacklistedPeers(p);
    };

    getBlacklisted();
  }, [isOpen, setBlacklistedPeers]);

  const handleRemovePeerFromBlacklist = async (
    peerId?: string,
    peerPublicKey?: string,
  ) => {
    const blacklistedIndex = blacklistedPeers.findIndex(
      (b) => b.peerId === peerId,
    );

    if (blacklistedIndex > -1) {
      await p2party.removePeerFromBlacklist(peerId, peerPublicKey);
      // Splicing the state array in place keeps the same reference, so React
      // bails out of the re-render and the row appears undeletable.
      setBlacklistedPeers((previous) =>
        previous.filter((entry) => entry.peerId !== peerId),
      );
    }
  };

  return (
    <Alert open={isOpen} onClose={setIsOpen} size='lg'>
      <AlertTitle>Blacklist</AlertTitle>
      <AlertDescription className='text-justify text-zinc-950 dark:text-white'>
        These are peers that can never see your IP or your connection status,
        therefore you cannot connect with them, unless you remove them from this
        list.
      </AlertDescription>
      <AlertBody>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className='relative w-0'>
                <span className='sr-only'>Delete</span>
              </TableHeader>
              <TableHeader>Date added</TableHeader>
              <TableHeader>Peer id</TableHeader>
              <TableHeader>Public key</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {blacklistedPeers.map((peer) => (
              <TableRow key={peer.peerId}>
                <TableCell>
                  <Button
                    plain
                    onClick={async () =>
                      await handleRemovePeerFromBlacklist(
                        peer.peerId,
                        peer.peerPublicKey,
                      )
                    }
                  >
                    <XMarkIcon />
                  </Button>
                </TableCell>

                <TableCell className='font-medium'>
                  {new Date(peer.dateAdded).toISOString().substring(0, 10)}
                </TableCell>

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

export default BlacklistAlert;
