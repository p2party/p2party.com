// Match every backed-up request locally. A bare unspent snapshot cannot distinguish a
// previously spent request from one that has never received a unit.
export function reconcileReceives(accounts, { snapshot, created, spent }) {
  const verified = Boolean(created && spent);
  const height = BigInt(snapshot.height).toString();
  const present = new Map(
    snapshot.units.map((unit) => [unit.commitment, unit]),
  );
  const statuses = new Map();
  for (const account of accounts) {
    const live = present.get(account.commitment),
      gone = spent?.get(account.commitment);
    const status = { height, verified };
    if (live && live.suite === account.suite) {
      status.state = "received";
      status.unitId = live.id;
      if (verified) {
        status.unit = Object.freeze({
          ...live,
          createdHeight: created.get(live.id) ?? "0x0",
          spentHeight: null,
        });
        status.receivedHeight = BigInt(status.unit.createdHeight).toString();
      }
    } else if (gone && gone.suite === account.suite) {
      status.state = "spent";
      status.unitId = gone.id;
      if (gone.createdHeight !== undefined)
        status.receivedHeight = BigInt(gone.createdHeight).toString();
      if (gone.spentHeight !== undefined)
        status.spentHeight = BigInt(gone.spentHeight).toString();
    } else status.state = verified ? "awaiting" : "unknown";
    statuses.set(
      account.suite + ":" + account.commitment,
      Object.freeze(status),
    );
  }
  return statuses;
}
