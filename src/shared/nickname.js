// Shared nickname normalization and validation. Unicode letters are allowed
// (Greek, accented, etc); blocked fragments still match case-insensitively.
const BLOCKED_FRAGMENTS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "pussy",
  "fucker",
  "bastard",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "retard",
  "motherfucker",
];

export const MAX_NICKNAME_LENGTH = 10;

export function normalizeName(rawName) {
  if (typeof rawName !== "string") return "";
  const collapsed = rawName.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, MAX_NICKNAME_LENGTH).trim();
}

export function isAllowedName(name) {
  if (!name || name.length === 0) return false;
  if (name.length > MAX_NICKNAME_LENGTH) return false;
  const hasLetter = /[\p{L}]/u.test(name);
  const lettersAndSpaces = /^[\p{L}\s]+$/u.test(name);
  if (!hasLetter || !lettersAndSpaces) return false;

  // Block-list is mixed-case and collapsed in the same way both sides handle it.
  const compact = name.toLowerCase().replace(/\s+/g, "");
  for (const fragment of BLOCKED_FRAGMENTS) {
    if (compact.includes(fragment.toLowerCase())) return false;
  }
  return true;
}

export function normalizeNameKey(name) {
  return normalizeName(name).toLowerCase();
}
