import { and, eq, lte, gte } from 'drizzle-orm';
import { db } from './db/index.js';
import { rooms, scheduleEntries } from './db/schema.js';

export type DensityLevel = 'low' | 'med' | 'high';

function getCurrentDayOfWeek(): string | undefined {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[new Date().getDay()];
}

function getCurrentTimeHHMM(): string {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function densityFromPercent(percent: number): DensityLevel {
    if (percent < 35) return 'low';
    if (percent < 70) return 'med';
    return 'high';
}

export async function getBuildingOccupancy(buildingId: string) {
    const buildingRooms = await db
        .select()
        .from(rooms)
        .where(eq(rooms.buildingId, buildingId));

    const roomCount = buildingRooms.length;

    if (roomCount === 0) {
        return {
            occupancy: 0,
            level: 'low' as DensityLevel,
            roomCount: 0,
            freeCount: 0,
            updatedAt: new Date().toISOString(),
        };
    }

    const dayOfWeek = getCurrentDayOfWeek();
    const currentTime = getCurrentTimeHHMM();

    const occupiedRoomIds = new Set<string>();

    for (const room of buildingRooms) {
        const activeClasses = await db
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

        if (activeClasses.length > 0) {
            occupiedRoomIds.add(room.id);
        }
    }

        const occupiedCount = occupiedRoomIds.size;
        const freeCount = roomCount - occupiedCount;
        const occupancy = Math.round((occupiedCount / roomCount) * 100);

    return {
            occupancy,
            level: densityFromPercent(occupancy),
            roomCount,
            freeCount,
            updatedAt: new Date().toISOString(),
    };
}