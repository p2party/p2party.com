/**
 * Binary units, because that is what the transfer layer counts: chunk sizes,
 * the 65,490-byte cell and the 10 GiB message ceiling are all powers of two.
 *
 * One decimal below 10 so "1.4 MB" does not collapse to "1 MB", none above, so
 * a value sitting in a fixed-width row never jitters between widths as it
 * climbs.
 */
const UNITS = ["B", "KB", "MB", "GB", "TB"];

const unitExponent = (bytes: number): number =>
  Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const exponent = unitExponent(bytes);
  const value = bytes / 1024 ** exponent;
  const digits = exponent === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[exponent]}`;
};

/**
 * The same bytes, in whatever unit and precision `reference` chose.
 *
 * For a climbing "x of y" the two halves must be commensurable: left to itself
 * the formatter walks 819 KB -> 1.2 MB -> 17 MB, and each step is a different
 * number of characters, so a bubble sized to its text twitches on every tick.
 * Pinned to the total's unit, the moving half can never be wider than the total
 * it counts towards, which makes the row's width a property of the file rather
 * than of how far along it is.
 */
export const formatBytesLike = (bytes: number, reference: number): string => {
  if (!Number.isFinite(reference) || reference <= 0) return formatBytes(bytes);
  const exponent = unitExponent(reference);
  const scaled = Math.max(0, bytes) / 1024 ** exponent;
  // Precision follows the reference too, so both halves round the same way.
  const digits = exponent === 0 || reference / 1024 ** exponent >= 10 ? 0 : 1;
  return `${scaled.toFixed(digits)} ${UNITS[exponent]}`;
};
