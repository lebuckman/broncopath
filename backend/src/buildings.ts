import { Router } from 'express';
import { db } from './db/index.ts';
import { buildings, rooms } from './db/schema.ts';
import { eq } from 'drizzle-orm';
import { getBuildingOccupancy, getRoomStatus } from './serviceFunctions.ts';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const allBuildings = await db.select().from(buildings);

    const result = await Promise.all(
      allBuildings.map(async (building) => {
        const { occupancy, level, roomCount, freeCount } = await getBuildingOccupancy(building.id);

        return {
          id: building.id,
          name: building.name,
          code: building.code,
          latitude: building.latitude,
          longitude: building.longitude,
          occupancy,
          level,
          roomCount,
          freeCount,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch buildings' });
  }
});

router.get('/:id/rooms', async (req, res) => {
  try {
    const buildingId = req.params.id;

    const buildingRooms = await db
      .select()
      .from(rooms)
      .where(eq(rooms.buildingId, buildingId));

    const result = await Promise.all(
      buildingRooms.map(async (room) => {
        const { status, freesAt } = await getRoomStatus(room.id);

        return {
          id: room.id,
          number: room.number,
          type: room.type,
          capacity: room.capacity,
          status,
          ...(freesAt && { freesAt }),
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

export default router;