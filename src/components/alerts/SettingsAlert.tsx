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
  } = useRoom();
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
    } else if (v > 100) {
      setPercentageFilledChunk(100);
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
        These parameters affect the way p2party handles cryptography and
        connectivity.
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

          <Headless.Field className='justify-left flex items-center gap-12'>
            <Label>Percentage of chunk with real data:</Label>
            <Input
              type='number'
              name='chunks'
              min={1}
              max={100}
              className='max-w-24'
              value={percentageFilledChunk}
              onChange={handlePercentageFilledChunk}
            />
          </Headless.Field>

          <Divider className='my-3' />

          <Headless.Field className='justify-left flex items-center gap-12'>
            <Label>Min chunks to split every message:</Label>
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
