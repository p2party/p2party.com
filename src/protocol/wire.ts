/**
 * The two wire sizes the landing page quotes, as literals.
 *
 * They belong to the SDK, and protocol/v4 still reads them from it -- but v4
 * imports the SDK, and the hero animation quoting "every cell 65,490 B" was
 * enough to pull 406 KB of WebRTC and cryptography onto the landing page for
 * two integers. These are wire constants: they cannot change without a
 * protocol version change, which is exactly the kind of thing a drift check
 * catches. v4 asserts they still match the SDK whenever it loads, so the copy
 * cannot rot silently on the routes that have the SDK anyway.
 */
export const CELL_BYTES = 65_490;
export const PAYLOAD_BYTES_PER_CELL = 61_912;
