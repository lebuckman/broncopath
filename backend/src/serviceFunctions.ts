import { and, eq, lte, gte } from 'drizzle-orm';
import { db } from './db/index.js';
import { rooms, scheduleEntries } from './db/schema.js';

export type DensityLevel = 'low' | 'med' | 'high';

export function getCurrentDayOfWeek(): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const day = days[new Date().getDay()];
  if (!day) throw new Error('Invalid day index');
  return day;
}

export function getCurrentTimeHHMM(): string {
  const now = new Date();
  const hh = now.getHours();
  const mm = now.getMinutes();
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function to12Hour(time24: string): string {
  const parts = time24.split(':');
  const hhStr = parts[0];
  const mmStr = parts[1];
  if (!hhStr || !mmStr) throw new Error(`Invalid time format: ${time24}`);
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const period = hh >= 12 ? 'PM' : 'AM';
  const hour = hh % 12 || 12;
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`;
}

export function addMinutes(time24: string, minutes: number): string {
  const parts = time24.split(':');
  const hhStr = parts[0];
  const mmStr = parts[1];
  if (!hhStr || !mmStr) throw new Error(`Invalid time format: ${time24}`);
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const total = hh * 60 + mm + minutes;
  const newHH = Math.floor(total / 60) % 24;
  const newMM = total % 60;
  return `${String(newHH).padStart(2, '0')}:${String(newMM).padStart(2, '0')}`;
}

export async function getRoomStatus(roomId: string) {
  const dayOfWeek = getCurrentDayOfWeek();
  const currentTime = getCurrentTimeHHMM();
  const soonThreshold = addMinutes(currentTime, 15);

  const active = await db
    .select()
    .from(scheduleEntries)
    .where(
      and(
        eq(scheduleEntries.roomId, roomId),
        eq(scheduleEntries.dayOfWeek, dayOfWeek),
        lte(scheduleEntries.startTime, currentTime),
        gte(scheduleEntries.endTime, currentTime)
      )
    );

  const currentClass = active[0];

  if (!currentClass) return { status: 'free' as const };

  if (currentClass.endTime <= soonThreshold) {
    return { status: 'soon' as const, freesAt: to12Hour(currentClass.endTime) };
  }

  return { status: 'busy' as const };
}

export function densityFromPercent(percent: number): DensityLevel {
  if (percent < 40) return 'low';
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
    return { occupancy: 0, level: 'low' as DensityLevel, roomCount: 0, freeCount: 0 };
  }

  const dayOfWeek = getCurrentDayOfWeek();
  const currentTime = getCurrentTimeHHMM();

  const occupiedRoomIds = new Set<string>();

  for (const room of buildingRooms) {
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

    if (active.length > 0) occupiedRoomIds.add(room.id);
  }

  const occupiedCount = occupiedRoomIds.size;
  const freeCount = roomCount - occupiedCount;
  const occupancy = Math.round((occupiedCount / roomCount) * 100);

  return { occupancy, level: densityFromPercent(occupancy), roomCount, freeCount };
}