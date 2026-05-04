import { pgTable, text, integer, real, uuid, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
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

export const campusGraphVersions = pgTable("campus_graph_versions", {
  id: uuid("id").primaryKey().defaultRandom(),

  campusId: text("campus_id").notNull().default("cpp"),
  source: text("source").notNull().default("openstreetmap"),
  osmRelationId: text("osm_relation_id").notNull(),

  status: text("status").notNull().default("pending"),
  // pending | active | failed | archived

  fetchedAt: timestamp("fetched_at").defaultNow(),
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campusGraphNodes = pgTable("campus_graph_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),

  graphVersionId: uuid("graph_version_id")
    .notNull()
    .references(() => campusGraphVersions.id),

  osmNodeId: text("osm_node_id").notNull(),

  lat: real("lat").notNull(),
  lng: real("lng").notNull(),

  type: text("type").notNull().default("path_node"),
  label: text("label"),
});

export const campusGraphEdges = pgTable("campus_graph_edges", {
  id: uuid("id").primaryKey().defaultRandom(),

  graphVersionId: uuid("graph_version_id")
    .notNull()
    .references(() => campusGraphVersions.id),

  fromNodeId: uuid("from_node_id")
    .notNull()
    .references(() => campusGraphNodes.id),

  toNodeId: uuid("to_node_id")
    .notNull()
    .references(() => campusGraphNodes.id),

  distanceMeters: real("distance_meters").notNull(),
  walkTimeSeconds: integer("walk_time_seconds").notNull(),

  highwayType: text("highway_type"),
  surface: text("surface"),
  incline: text("incline"),

  isStairs: boolean("is_stairs").notNull().default(false),
  accessibilityPenalty: real("accessibility_penalty").notNull().default(0),

  geometry: jsonb("geometry").notNull(),
});

export const campusGraphVersionsRelations = relations(
  campusGraphVersions,
  ({ many }) => ({
    nodes: many(campusGraphNodes),
    edges: many(campusGraphEdges),
  }),
);

export const campusGraphNodesRelations = relations(
  campusGraphNodes,
  ({ one, many }) => ({
    graphVersion: one(campusGraphVersions, {
      fields: [campusGraphNodes.graphVersionId],
      references: [campusGraphVersions.id],
    }),
    outgoingEdges: many(campusGraphEdges, {
      relationName: "fromNode",
    }),
    incomingEdges: many(campusGraphEdges, {
      relationName: "toNode",
    }),
  }),
);

export const campusGraphEdgesRelations = relations(
  campusGraphEdges,
  ({ one }) => ({
    graphVersion: one(campusGraphVersions, {
      fields: [campusGraphEdges.graphVersionId],
      references: [campusGraphVersions.id],
    }),
    fromNode: one(campusGraphNodes, {
      fields: [campusGraphEdges.fromNodeId],
      references: [campusGraphNodes.id],
      relationName: "fromNode",
    }),
    toNode: one(campusGraphNodes, {
      fields: [campusGraphEdges.toNodeId],
      references: [campusGraphNodes.id],
      relationName: "toNode",
    }),
  }),
);

export const academicTerms = pgTable("academic_terms", {
  id: uuid("id").primaryKey().defaultRandom(),

  code: text("code").notNull().unique(),
  label: text("label").notNull(),

  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),

  finalsStartDate: text("finals_start_date"),
  finalsEndDate: text("finals_end_date"),

  sourceUrl: text("source_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const academicCalendarEvents = pgTable("academic_calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),

  title: text("title").notNull(),
  eventType: text("event_type").notNull(),

  startDate: text("start_date").notNull(),
  endDate: text("end_date"),

  affectsClasses: boolean("affects_classes").notNull().default(false),
  campusClosed: boolean("campus_closed").notNull().default(false),

  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").defaultNow(),
});