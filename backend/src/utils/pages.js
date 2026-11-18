// Small server-rendered HTML pages, used where a browser (not the app) talks to the
// backend: the password reset form and its replies. Every inserted value is escaped,
// and the pages use no inline scripts or styles, so helmet's default content security
// policy allows them.
import { escapeHtml } from './html.js';

// True when the request came from an HTML form (the reset page) rather than the app,
// which sends JSON.
export const isFormRequest = (req) => Boolean(req.is('application/x-www-form-urlencoded'));

// A page with a title, a message and an optional link ({ href, text }).
export const messagePage = ({ title, message, link }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>
    ${link ? `<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.text)}</a></p>` : ''}
  </body>
</html>`;
