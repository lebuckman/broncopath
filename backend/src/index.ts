import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import buildingsRouter from './buildings.ts';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/buildings', buildingsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});