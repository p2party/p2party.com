import { FC } from "react";
import { useParams } from "react-router";
import { useLocalStorage } from "usehooks-ts";

import * as Headless from "@headlessui/react";

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

import { useRoom } from "../../hooks/useRoom";

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
  } = useRoom();
  const { roomUrl } = useParams();

  const [chunks, setChunks] = useLocalStorage("chunksToSplitMessage", 3);
  const [pressedCancelInConnect, setPressedCancelInConnect] = useLocalStorage(
    "pressedCancelButtonInRoom" + roomUrl,
    false,
  );

  const handleChunks = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (v < 3) {
      setChunks(3);
    } else if (v > 20) {
      setChunks(20);
    } else {
      setChunks(v);
    }
  };

  return (
    <Alert open={isOpen} onClose={setIsOpen} size='xs'>
      <AlertTitle>Settings</AlertTitle>
      <AlertDescription className='text-justify text-zinc-950 dark:text-white'>
        These parameters affect the way p2party handles cryptography and
        connectivity.
      </AlertDescription>
      <AlertBody>
        <Divider className='mb-3' />

        <Fieldset>
          <SwitchGroup>
            {roomUrl && roomUrl.length === 64 && (
              <>
                <SwitchField>
                  <Label>Connected to signaling server</Label>
                  <Description>
                    To be discoverable you need to be connected to the signaling
                    server {signalingServerConnectionState.serverUrl}
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
                    Connect to the signaling server{" "}
                    {signalingServerConnectionState.serverUrl} every time you
                    come back to this window
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
            <Label>Min chunks to split every message:</Label>
            <Input
              type='number'
              name='chunks'
              min={3}
              max={20}
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
