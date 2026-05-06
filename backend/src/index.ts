import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
config();
config({ path: '.env.local', override: true });
import buildingsRouter from './buildings.ts';
import campusGraphRouter from "./campusGraph.ts";
import schedulesRouter from "./schedules.ts";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/buildings', buildingsRouter);

app.use("/api/campus-graph", campusGraphRouter);

app.use("/api/schedules", schedulesRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});