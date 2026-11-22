// Is this text a web link the app may open? (docs/features/profiles-and-registration.md,
// P18; PRODUCT.md "Venue owners": website links must start with http:// or https://.)
// Edit venue checks a website with it before sending, and every screen that shows a
// website opens it only when it passes; otherwise it's shown as plain text.
//
// The rule: http:// or https:// (any capitals), then a host name, then an optional port
// and an optional path. A host name is one or more labels joined by dots; a label is
// letters (any script), digits, hyphens or underscores. No spaces anywhere, and nothing
// else before the host, so no "user:password@" part (it can make a link look like it
// goes to one site while it opens another).
//   pass: https://arena.com.bd · HTTP://Arena.com · https://arena.com:8080/page?x=1#top
//   fail: arena.com · www.arena.com · http:arena.com · https:/arena.com · mailto:a@b.com
//         javascript:alert(1) · ftp://arena.com · https:// · https://user@arena.com
//
// It's a pattern rather than new URL(...): on the phone, React Native's URL doesn't
// really parse links (it accepts anything, and can't find the host of
// "HTTP://Arena.com"). The backend has the same function
// (backend/src/utils/links.js): change both together. Built with new RegExp(...)
// because a \p{…} pattern written as a regex literal breaks the app's Babel build.
const LABEL = '[\\p{L}\\p{M}\\p{N}_-]+';
const WEB_LINK = new RegExp(
  `^https?://${LABEL}(?:\\.${LABEL})*(?::(\\d{1,5}))?(?:[/?#]\\S*)?$`,
  'iu',
);
const MAX_PORT = 65535;

export const WEBSITE_MESSAGE = 'Website must start with http:// or https://';

export function isWebLink(text) {
  if (typeof text !== 'string') return false;
  const match = WEB_LINK.exec(text);
  return (
    match !== null && (match[1] === undefined || Number(match[1]) <= MAX_PORT)
  );
}
