/**
 * Short unique alphanumeric ID generator for NexSport shareable tournament links
 * Uses a safe base31 character set (excluding confusing characters like 0, O, 1, l, I)
 * Example output: '7k9m2x4b', 'a8d3w9y2'
 */
const BASE31_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function generateShortId(length = 8): string {
  let result = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += BASE31_ALPHABET.charAt(bytes[i] % BASE31_ALPHABET.length);
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += BASE31_ALPHABET.charAt(
        Math.floor(Math.random() * BASE31_ALPHABET.length)
      );
    }
  }
  return result;
}
