import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import playerRoutes from './routes/playerRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';


dotenv.config();
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
app.use(express.urlencoded({ extended: true }));

app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);
app.use('/teams', teamRoutes);
app.use('/players', playerRoutes);
app.use('/owners', ownerRoutes);
app.get('/', (req, res) => res.send('API running ✅'));

// Must stay last: turns any unhandled error into a generic reply.
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



//GET http://localhost:4000/players/invites

