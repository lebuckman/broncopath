import { pgTable, text, integer, real, uuid, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const buildings = pgTable('buildings', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
});

export const rooms = pgTable('rooms', {
    id: text('id').primaryKey(),
    buildingId: text('building_id').notNull().references(() => buildings.id),
    number: text('number').notNull(),
    type: text('type').notNull(),
    capacity: integer('capacity').notNull(),
});

export const scheduleEntries = pgTable('schedule_entries', {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: text('room_id').notNull().references(() => rooms.id),
    dayOfWeek: text('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    courseName: text('course_name'),
    semester: text('semester').notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Define relationships
export const buildingsRelations = relations(buildings, ({ many }) => ({
    rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
    building: one(buildings, {
        fields: [rooms.buildingId],
        references: [buildings.id],
     }),
     scheduleEntries: many(scheduleEntries),
}));

export const scheduleEntriesRelations = relations(scheduleEntries, ({ one }) => ({
    room: one(rooms, {
        fields: [scheduleEntries.roomId],
        references: [rooms.id],
    }),
}));