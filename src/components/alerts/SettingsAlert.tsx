import { FC, useState } from "react";
import { useParams } from "react-router";
import { useLocalStorage } from "usehooks-ts";

import * as Headless from "@headlessui/react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid";

import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  AlertBody,
} from "../alert";
// import { Link } from "../link";
import { Button } from "../button";
import { Input } from "../input";
import { Divider } from "../divider";
import { Fieldset } from "../fieldset";

import {
  useRoom,
  DEFAULT_SIGNALING_URL,
  DEFAULT_STUN_URLS,
} from "../../hooks/useRoom";

// import { Checkbox, CheckboxField } from "../checkbox";
import { Description, Label } from "../fieldset";
import { Switch, SwitchField, SwitchGroup } from "../switch";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";

export interface SettingsAlertProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const SettingsAlert: FC<SettingsAlertProps> = ({ isOpen, setIsOpen }) => {
  const {
    signalingServerConnectionState,
    connectToSignalingServer,
    disconnectFromSignalingServer,
    onlyConnectWithKnownPeers,
    peers,
    setOnlyConnectToKnownPeers,
    signalingServerUrl,
    setSignalingServerUrl,
    stunServerUrls,
    setStunServerUrls,
    roomPolicy,
  } = useRoom({ subscribeToMessages: false });
  const { roomUrl } = useParams();

  const [chunks, setChunks] = useLocalStorage("chunksToSplitMessage", 1);
  const [percentageFilledChunk, setPercentageFilledChunk] = useLocalStorage(
    "percentageFilledChunk",
    90,
  );
  const [pressedCancelInConnect, setPressedCancelInConnect] = useLocalStorage(
    "pressedCancelButtonInRoom" + roomUrl,
    false,
  );

  const [newStunUrl, setNewStunUrl] = useState("");

  const handlePercentageFilledChunk = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    // if (v < 3) {
    //   setChunks(3);
    if (v < 1) {
      setPercentageFilledChunk(1);
    } else if (v > 99) {
      setPercentageFilledChunk(99);
    } else {
      setPercentageFilledChunk(v);
    }
  };

  const handleChunks = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    // if (v < 3) {
    //   setChunks(3);
    if (v < 1) {
      setChunks(1);
    } else if (v > 100) {
      setChunks(100);
    } else {
      setChunks(v);
    }
  };

  return (
    <Alert open={isOpen} onClose={setIsOpen} size='md'>
      <AlertTitle>Settings</AlertTitle>
      <AlertDescription className='text-justify text-zinc-950 dark:text-white'>
        Connectivity can change locally. The authenticated room policy is
        room-wide and immutable after first contact.
      </AlertDescription>
      <AlertBody>
        <Divider className='mb-3' />

        <Fieldset>
          <Headless.Field className='flex flex-col gap-2'>
            <Label>Signaling Server URL</Label>
            <Description>
              The WebSocket URL of the signaling server used to discover peers.
            </Description>
            <div className='flex items-center gap-2'>
              <Input
                type='url'
                name='signalingServerUrl'
                value={signalingServerUrl}
                onChange={(e) => setSignalingServerUrl(e.target.value)}
                placeholder={DEFAULT_SIGNALING_URL}
                className='flex-1'
              />
              {signalingServerUrl !== DEFAULT_SIGNALING_URL && (
                <Button
                  plain
                  onClick={() => setSignalingServerUrl(DEFAULT_SIGNALING_URL)}
                  title='Reset to default'
                >
                  <XMarkIcon className='size-4' />
                </Button>
              )}
            </div>
          </Headless.Field>

          <Divider className='my-3' />

          <Headless.Field className='flex flex-col gap-2'>
            <Label>ICE Servers (STUN/TURN)</Label>
            <Description>
              Server URLs used for WebRTC NAT traversal. Changes take effect on
              next connection.
            </Description>
            <div className='space-y-2'>
              {stunServerUrls.map((url, i) => (
                <div key={i} className='flex items-center gap-2'>
                  <Input
                    type='text'
                    value={url}
                    onChange={(e) => {
                      const updated = [...stunServerUrls];
                      updated[i] = e.target.value;
                      setStunServerUrls(updated);
                    }}
                    className='flex-1'
                  />
                  <Button
                    plain
                    onClick={() =>
                      setStunServerUrls(
                        stunServerUrls.filter((_, j) => j !== i),
                      )
                    }
                    title='Remove'
                  >
                    <XMarkIcon className='size-4' />
                  </Button>
                </div>
              ))}
              <div className='flex items-center gap-2'>
                <Input
                  type='text'
                  value={newStunUrl}
                  onChange={(e) => setNewStunUrl(e.target.value)}
                  placeholder='stun:stun.example.com:3478'
                  className='flex-1'
                />
                <Button
                  outline
                  onClick={() => {
                    if (newStunUrl.trim().length > 0) {
                      setStunServerUrls([...stunServerUrls, newStunUrl.trim()]);
                      setNewStunUrl("");
                    }
                  }}
                  title='Add server'
                >
                  <PlusIcon className='size-4' />
                </Button>
              </div>
              {JSON.stringify(stunServerUrls) !==
                JSON.stringify(DEFAULT_STUN_URLS) && (
                <Button
                  plain
                  className='text-xs'
                  onClick={() => {
                    setStunServerUrls(DEFAULT_STUN_URLS);
                    setNewStunUrl("");
                  }}
                >
                  Reset to defaults
                </Button>
              )}
            </div>
          </Headless.Field>

          <Divider className='my-3' />

          <SwitchGroup>
            {roomUrl && roomUrl.length === 64 && (
              <>
                <SwitchField>
                  <Label>Connected to signaling server</Label>
                  <Description>
                    To be discoverable you need to be connected to the signaling
                    server {signalingServerUrl}
                  </Description>
                  <Switch
                    name='Signaling server connection'
                    checked={signalingServerConnectionState.isConnected}
                    onChange={(checked) =>
                      checked
                        ? connectToSignalingServer(roomUrl ?? "")
                        : disconnectFromSignalingServer()
                    }
                  />
                </SwitchField>

                <Divider className='my-3' />

                <SwitchField>
                  <Label>Be discoverable on focus</Label>
                  <Description>
                    Connect to the signaling server {signalingServerUrl} every
                    time you come back to this window
                  </Description>
                  <Switch
                    name='Be discoverable on focus'
                    checked={!pressedCancelInConnect}
                    onChange={(checked) =>
                      checked
                        ? setPressedCancelInConnect(false)
                        : setPressedCancelInConnect(true)
                    }
                  />
                </SwitchField>

                <Divider className='my-3' />
              </>
            )}

            <SwitchField>
              <Label>Connect only with known peers</Label>
              <Description>
                You will be discoverable only by your address book.
                {!onlyConnectWithKnownPeers &&
                  peers.length > 0 &&
                  " This will disconnect you from all current peers outside of the address book."}
              </Description>
              <Switch
                name='Only connect to known peers'
                checked={onlyConnectWithKnownPeers}
                onChange={async (checked) =>
                  await setOnlyConnectToKnownPeers(roomUrl ?? "", checked)
                }
              />
            </SwitchField>
          </SwitchGroup>

          <Divider className='my-3' />

          <Headless.Field className='space-y-2'>
            <Label>Authenticated room policy</Label>
            <Description>
              Protocol v{roomPolicy.wireVersion} ·{" "}
              {roomPolicy.authMode === "pin"
                ? "CPace PIN authentication"
                : "no room PIN"}{" "}
              · ML-KEM-768 hybrid root · legacy signaling rendezvous.
            </Description>
            <div className='grid gap-2 sm:grid-cols-2'>
              <div className='rounded-lg border-2 border-orange-500 bg-orange-50/70 p-3 dark:bg-orange-950/25'>
                <p className='font-mono text-xs font-bold text-orange-800 uppercase dark:text-orange-300'>
                  Immediate · active
                </p>
                <p className='mt-1 text-xs text-zinc-600 dark:text-zinc-400'>
                  Cells leave as soon as the app can send them. No timed cover
                  stream.
                </p>
              </div>
              <div
                className='rounded-lg border border-dashed border-zinc-300 bg-zinc-100/70 p-3 opacity-70 dark:border-zinc-700 dark:bg-zinc-900/70'
                aria-disabled='true'
              >
                <p className='font-mono text-xs font-bold text-zinc-600 uppercase dark:text-zinc-400'>
                  Scheduled · not wired
                </p>
                <p className='mt-1 text-xs text-zinc-600 dark:text-zinc-400'>
                  Future room-wide presets: 10 s, 60 s, or 5 min. v0.10.0
                  rejects these policies until the scheduler exists.
                </p>
              </div>
            </div>
          </Headless.Field>

          <Divider className='my-3' />

          <Headless.Field className='justify-left flex items-center gap-12'>
            <div>
              <Label>Real data per message cell</Label>
              <Description>
                Per-message random padding; this is not room cover cadence.
              </Description>
            </div>
            <Input
              type='number'
              name='chunks'
              min={1}
              max={99}
              className='max-w-24'
              value={percentageFilledChunk}
              onChange={handlePercentageFilledChunk}
            />
          </Headless.Field>

          <Divider className='my-3' />

          <Headless.Field className='justify-left flex items-center gap-12'>
            <div>
              <Label>Minimum cells per message</Label>
              <Description>
                Adds intra-message padding only; immediate mode still sends now.
              </Description>
            </div>
            <Input
              type='number'
              name='chunks'
              min={1}
              max={100}
              className='max-w-24'
              value={chunks}
              onChange={handleChunks}
            />
          </Headless.Field>
        </Fieldset>

        <Divider className='mt-3' />
      </AlertBody>
      <AlertActions>
        <Button autoFocus onClick={() => setIsOpen(false)}>
          Done
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default SettingsAlert;
