import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useLocation } from "react-router-dom";

import {
  resolveRoomInvite,
  type RoomInviteResolution,
} from "../protocol/roomAccess";

import type { PropsWithChildren } from "react";

const RoomInviteContext = createContext<RoomInviteResolution | undefined>(
  undefined,
);

// "Has this tree been hydrated yet?" as an external store. It never changes
// after the first client render, so there is nothing to subscribe to.
const subscribeNever = () => () => undefined;
const getHydrated = () => true;
const getHydratedOnServer = () => false;

export const RoomInviteProvider = ({ children }: PropsWithChildren) => {
  const location = useLocation();
  // Resolved only once there is a document, never during the first render. The
  // fragment carrying the room capability is invisible to the build --
  // fragments are not sent to servers -- so resolving eagerly made the
  // prerendered /r an error page ("Room invitation fragment is missing"), and
  // made the server's markup disagree with the first render of every real
  // invite link. Server and first client render both say "pending", then the
  // store flips and the real answer arrives on the very next render.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    getHydrated,
    getHydratedOnServer,
  );
  const resolution = useMemo<RoomInviteResolution>(
    () =>
      hydrated
        ? resolveRoomInvite(location.pathname, location.hash, location.search)
        : { kind: "pending" },
    [hydrated, location.hash, location.pathname, location.search],
  );

  return (
    <RoomInviteContext.Provider value={resolution}>
      {children}
    </RoomInviteContext.Provider>
  );
};

// The provider and its paired hook intentionally share this private context.
// eslint-disable-next-line react-refresh/only-export-components
export const useRoomInvite = (): RoomInviteResolution => {
  const resolution = useContext(RoomInviteContext);
  if (resolution === undefined)
    throw new Error("useRoomInvite must be used inside RoomInviteProvider");
  return resolution;
};
