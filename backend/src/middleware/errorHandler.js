// The last middleware in server.js. Any error that a route doesn't handle itself ends
// up here: controllers pass errors on with next(error), and Express 5 also forwards
// errors thrown in async route functions automatically.
//
// The real error is logged on the server only. The client gets a short generic
// message, never error.message, a stack trace or Prisma details.
import { isFormRequest, messagePage } from '../utils/pages.js';

// eslint-disable-next-line no-unused-vars -- Express needs all four arguments to treat this as an error handler.
export const errorHandler = (err, req, res, next) => {
  // The client sent a body we can't read (for example broken JSON). That's their
  // mistake, not a server failure, so it's a 400 rather than a 500.
  const isBadBody = err.type === 'entity.parse.failed' || (err.status >= 400 && err.status < 500);
  const status = isBadBody ? 400 : 500;
  const message = isBadBody ? 'Invalid request body' : 'Something went wrong';

  if (!isBadBody) console.error(`Error in ${req.method} ${req.originalUrl}:`, err);

  if (res.headersSent) return; // a reply already started; nothing more we can send
  if (isFormRequest(req)) {
    return res.status(status).send(messagePage({ title: 'Something went wrong', message: 'Please try again later.' }));
  }
  return res.status(status).json({ error: message });
};
