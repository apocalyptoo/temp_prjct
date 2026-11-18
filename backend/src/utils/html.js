// Makes a value safe to insert into HTML (text or a quoted attribute), so that
// characters like < > " ' & are shown as text instead of being read as HTML.
// Use it for anything inserted into HTML that didn't come from our own code.
export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
