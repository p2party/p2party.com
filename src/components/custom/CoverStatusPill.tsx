import { Badge } from "../badge";

import { useRoom } from "../../hooks/useRoom";

import type { RoomCoverStatus } from "../../protocol/v4";

type AggregateCoverStatus =
  "idle" | "starting" | "active" | "degraded" | "suspended";

/**
 * The room-level claim is the WORST live edge: cover is only "active" when
 * every connected peer edge reports active, and a browser-imposed gap
 * ("suspended") always wins. No edges (or only terminal "stopped" edges)
 * never claims cover at all.
 */
const aggregateCoverStatus = (
  statuses: readonly RoomCoverStatus[],
): AggregateCoverStatus => {
  const live = statuses.filter((status) => status !== "stopped");
  if (live.length === 0) return "idle";
  if (live.includes("suspended")) return "suspended";
  if (live.includes("degraded")) return "degraded";
  if (live.includes("starting")) return "starting";
  return "active";
};

const PILL: Record<
  AggregateCoverStatus,
  { color: "zinc" | "amber" | "orange" | "red" | "green"; text: string }
> = {
  idle: { color: "zinc", text: "cover idle" },
  starting: { color: "amber", text: "cover starting" },
  active: { color: "green", text: "cover active" },
  degraded: { color: "orange", text: "cover degraded" },
  suspended: { color: "red", text: "cover gap — not sending" },
};

/**
 * Live scheduled-cover status for the current room, driven by the library's
 * per-edge CoverScheduler reports. Renders nothing in immediate rooms.
 */
const CoverStatusPill = () => {
  const { roomPolicy, coverStatusByPeer } = useRoom({
    subscribeToMessages: false,
  });

  if (roomPolicy.coverMode !== "scheduled") return null;

  const statuses = Object.values(coverStatusByPeer);
  const aggregate = aggregateCoverStatus(statuses);
  const pill = PILL[aggregate];
  const liveEdges = statuses.filter((status) => status !== "stopped").length;

  return (
    <Badge
      color={pill.color}
      title={
        liveEdges > 0
          ? `${String(liveEdges)} peer edge${liveEdges === 1 ? "" : "s"} on the cover schedule`
          : "No peer edge is on the cover schedule yet"
      }
      aria-live='polite'
      className='rounded-none border-2 border-zinc-950 font-mono text-[10px] font-bold tracking-[0.1em] whitespace-nowrap uppercase dark:border-zinc-200'
    >
      {pill.text}
    </Badge>
  );
};

export default CoverStatusPill;
