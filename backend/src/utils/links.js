// Is this text a web link the app may open? (docs/features/profiles-and-registration.md,
// P18; PRODUCT.md "Venue owners": website links must start with http:// or https://.)
// It must parse as a URL, its scheme must be http or https (any case), it must have a
// host name, and it must contain no spaces. So "https://arena.com.bd" passes, while
// "arena.com", "www.arena.com", "javascript:alert(1)", "ftp://arena.com" and "https://"
// fail. The app has the same check (IndoorFootballApp/src/utils/links.js).
export function isWebLink(text) {
  if (typeof text !== 'string' || /\s/.test(text)) return false;
  let url;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
}
