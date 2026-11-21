// Must stay the first import. With ES modules every import runs before the code
// below it, and some modules read settings while they load (authController builds
// its email sender). config.js loads backend/.env and checks every setting first,
// and stops the server with a clear message if one is missing or invalid.
import { config } from './config.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import playerRoutes from './routes/playerRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import legalRoutes from './routes/legalRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// The backend is reached through exactly one proxy: ngrok. ngrok adds the visitor's
// real address to the X-Forwarded-For header. "trust proxy = 1" tells Express to trust
// that one hop, so req.ip is the visitor's address instead of ngrok's (which would put
// every visitor into the same rate-limit counter). Don't raise it: trusting more hops
// would let a visitor fake their address by sending their own X-Forwarded-For.
app.set('trust proxy', 1);

// Protective HTTP headers, including a content security policy. The defaults work
// for the reset-password page: its form posts to this same site (allowed by
// form-action 'self') and it uses no inline scripts or styles.
app.use(helmet());
app.use(cors());
app.use(express.json());
// Form posts (the reset-password page). extended: false reads every value as plain text
// (or a list of texts when a field repeats), never as a nested object, so a field like
// token[not]=x can't turn into a query operator.
app.use(express.urlencoded({ extended: false }));

app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);
app.use('/teams', teamRoutes);
app.use('/players', playerRoutes);
app.use('/owners', ownerRoutes);
app.use('/legal', legalRoutes); // Terms of Use and Privacy Policy pages (no login)
app.get('/', (req, res) => res.send('API running ✅'));

// Must stay last: turns any unhandled error into a generic reply.
app.use(errorHandler);

const PORT = config.port;
// Express 5 passes a startup error (like the port being taken) to this callback.
// Without the check, it would print "Server running" and then quietly exit.
app.listen(PORT, (error) => {
  if (error) {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Port ${PORT} is already in use. Is another server running?`
        : `Server can't start on port ${PORT}: ${error.code ?? error.message}`
    );
    process.exit(1);
  }
  console.log(`Server running on port ${PORT}`);
});
