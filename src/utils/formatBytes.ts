/**
 * Binary units, because that is what the transfer layer counts: chunk sizes,
 * the 65,490-byte cell and the 10 GiB message ceiling are all powers of two.
 *
 * One decimal below 10 so "1.4 MB" does not collapse to "1 MB", none above, so
 * a value sitting in a fixed-width row never jitters between widths as it
 * climbs.
 */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log2(bytes) / 10),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const digits = exponent === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[exponent]}`;
};
