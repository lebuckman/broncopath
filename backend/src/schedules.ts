import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "./db/index.ts";
import { scheduleEntries, rooms, buildings } from "./db/schema.ts";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { semester, dayOfWeek } = req.query;

    const filters = [];

    if (typeof semester === "string") {
      filters.push(eq(scheduleEntries.semester, semester));
    }

    if (typeof dayOfWeek === "string") {
      filters.push(eq(scheduleEntries.dayOfWeek, dayOfWeek));
    }

    const rows = await db
      .select({
        id: scheduleEntries.id,
        roomId: scheduleEntries.roomId,
        roomNumber: rooms.number,
        buildingId: rooms.buildingId,
        buildingName: buildings.name,
        buildingCode: buildings.code,
        dayOfWeek: scheduleEntries.dayOfWeek,
        startTime: scheduleEntries.startTime,
        endTime: scheduleEntries.endTime,
        courseName: scheduleEntries.courseName,
        semester: scheduleEntries.semester,

        // No enrollment column exists in the schema.
        // Use capacity as a client-side congestion estimate.
        enrollment: rooms.capacity,
      })
      .from(scheduleEntries)
      .innerJoin(rooms, eq(scheduleEntries.roomId, rooms.id))
      .innerJoin(buildings, eq(rooms.buildingId, buildings.id))
      .where(filters.length > 0 ? and(...filters) : undefined);

    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch schedule:", error);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

export default router;