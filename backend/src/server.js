import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import teamRoutes from './routes/teamRoutes.js'; 
import playerRoutes from './routes/playerRoutes.js';


dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);
app.use('/teams', teamRoutes);
app.use('/players', playerRoutes);
app.get('/', (req, res) => res.send('API running ✅'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



//GET http://localhost:4000/players/invites