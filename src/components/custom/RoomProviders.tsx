import { Provider } from "react-redux";

import p2party from "../../protocol/sdk";
import { RoomInviteProvider } from "../../hooks/useRoomInvite";

import type { ReactNode } from "react";

/**
 * The store and invite context, behind a lazy boundary.
 *
 * These wrap only /r and /rooms, but App referenced `p2party.store` directly
 * to build them -- and App is on every route, so reading a blog post pulled the
 * whole SDK in to construct a Provider the page never mounted. Moving the two
 * providers into their own lazily-imported module keeps the SDK on the routes
 * that actually talk to peers.
 */
const RoomProviders = ({ children }: { children: ReactNode }) => (
  <Provider store={p2party.store}>
    <RoomInviteProvider>{children}</RoomInviteProvider>
  </Provider>
);

export default RoomProviders;
