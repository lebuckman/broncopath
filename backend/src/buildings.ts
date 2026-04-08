import { Router } from 'express';
import { db } from './db/index.js';
import { buildings, rooms, scheduleEntries } from './db/schema.js';
import * as fn from './serviceFunctions.js'
import { eq, lte, gte, and } from 'drizzle-orm';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const allBuildings = await db.select().from(buildings);

    const result = await Promise.all(
      allBuildings.map(async (building) => {
        const buildingRooms = await db
          .select()
          .from(rooms)
          .where(eq(rooms.buildingId, building.id));

        const roomCount = buildingRooms.length;

        return {
          id: building.id,
          name: building.name,
          code: building.code,
          latitude: building.latitude,
          longitude: building.longitude,
          occupancy: 42, // fake for now
          level: 'med',
          roomCount,
          freeCount: Math.max(0, roomCount - 2), // fake-ish
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

    const dayOfWeek = fn.getCurrentDayOfWeek();
    const currentTime = fn.getCurrentTimeHHMM();

    const result = await Promise.all(
      buildingRooms.map(async (room) => {
        const active = await db
          .select()
          .from(scheduleEntries)
          .where(
            and(
              eq(scheduleEntries.roomId, room.id),
              eq(scheduleEntries.dayOfWeek, dayOfWeek),
              lte(scheduleEntries.startTime, currentTime),
              gte(scheduleEntries.endTime, currentTime)
            )
          );

        const currentClass = active[0];

        return {
          id: room.id,
          number: room.number,
          type: room.type,
          capacity: room.capacity,
          status: currentClass ? 'occupied' : 'free',
          freesAt: currentClass ? currentClass.endTime : null,
          courseName: currentClass?.courseName ?? null,
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