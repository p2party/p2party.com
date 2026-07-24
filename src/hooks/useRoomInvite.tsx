import { createContext, useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";

import {
  resolveRoomInvite,
  type RoomInviteResolution,
} from "../protocol/roomAccess";

import type { PropsWithChildren } from "react";

const RoomInviteContext = createContext<RoomInviteResolution | undefined>(
  undefined,
);

export const RoomInviteProvider = ({ children }: PropsWithChildren) => {
  const location = useLocation();
  const resolution = useMemo(
    () => resolveRoomInvite(location.pathname, location.hash, location.search),
    [location.hash, location.pathname, location.search],
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
