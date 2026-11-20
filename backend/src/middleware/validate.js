// Checks a request against zod schemas before the controller runs.
//
//   router.post('/create', verifyToken, validate({ body: createTeamSchema }), createTeam);
//
// - The checked, cleaned values go on req.valid (req.valid.body, req.valid.query).
//   Controllers read from there, never from req.body or req.query, so nothing
//   unchecked can reach Prisma. (req.query is read-only in Express 5, so it isn't replaced.)
// - Fields a schema doesn't list are dropped from req.valid (ignored, not rejected).
// - A problem gets 400 with { error: "<message>" }: the first problem found, using the
//   messages written in the schema.
// Options:
// - message: reply with this fixed message whatever the problem (login uses it so the
//   reply never says which part was wrong).
// - onInvalid(req, res, message): send a different reply instead (for example an HTML
//   page for requests that come from a browser).
export function validate(schemas, { message, onInvalid } = {}) {
  return (req, res, next) => {
    const valid = {};
    for (const part of ['body', 'query']) {
      const schema = schemas[part];
      if (!schema) continue;
      // A request with no body at all has req.body undefined: check it as an empty object.
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        const problem = message ?? firstMessage(result.error);
        if (onInvalid) return onInvalid(req, res, problem);
        return res.status(400).json({ error: problem });
      }
      valid[part] = result.data;
    }
    req.valid = valid;
    next();
  };
}

const firstMessage = (error) => error.issues[0]?.message ?? 'Invalid request';
