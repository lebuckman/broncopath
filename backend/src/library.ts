import { Router } from "express";
import * as cheerio from "cheerio";

const router = Router();

const LIBCAL_BASE = "https://cpp.libcal.com";
const LIBCAL_PAGE_PATH = "/reserve/study-rooms";
const LID = 8262;
const DEFAULT_GROUP_ID = 0;
const DEFAULT_ITEM_ID = -1;
const DEFAULT_SEAT = 0;
const DEFAULT_SEAT_ID = 0;
const DEFAULT_ZONE_ID = 0;
const DEFAULT_PAGE_SIZE = 18;
const METADATA_TTL_MS = 30 * 60 * 1000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const ADA_FILTER_ID = 1021;
const POWER_FILTER_ID = 1022;

const GROUP_ID_BY_GROUPING: Record<string, number> = {
  "Second Floor Study Rooms": 14784,
  "Third Floor Study Rooms": 14797,
  "Fourth Floor Study Rooms": 14785,
  "Fifth Floor Study Rooms": 14786,
  "Sixth Floor Study Rooms": 14795,
};

type LibraryAvailabilityQuery = {
  date: string;
  startTime: string;
  duration: number;
  groupSize: number;
  floor: string;
  needsPower: boolean;
  needsADA: boolean;
};

type LibCalPageSession = {
  html: string;
  cookie: string;
  referer: string;
};

type LibCalMetadata = {
  rooms: LibCalRoom[];
  resourceRows: number;
  pageSize: number;
  fetchedAt: number;
};

type LibCalRoom = {
  id: number;
  eid: number;
  gid: number;
  lid: number;
  name: string;
  title: string;
  url: string;
  grouping: string;
  capacity: number;
  floor: string | null;
  hasPower: boolean;
  isADA: boolean;
  pageIndex: number;
};

type LibCalGridSlot = {
  itemId?: number | string;
  start?: string;
  end?: string;
  className?: string | string[] | null;
  classNames?: string[] | string | null;
  status?: number | string;
  checksum?: string;
};

type LibraryRoomResult = LibCalRoom & {
  isAvailable: boolean;
  availableStarts: string[];
  nextAvailableStart: string | null;
  bookingUrl: string;
};

let metadataCache: LibCalMetadata | null = null;

router.get("/availability", async (req, res) => {
  console.log("Received library availability request with query:", req.query);
  try {
    const query = parseAvailabilityQuery(req.query as Record<string, unknown>);
    console.log("Library availability query:", query);
    const session = await fetchLibCalPage(query.date);
    console.log("Fetched LibCal page for date", query.date);
    const metadata = getMetadata(session.html);
    console.log("Parsed LibCal metadata with", metadata.rooms.length, "rooms and", metadata.resourceRows, "resource rows");
    const slots = await fetchAllGridSlots(session, metadata, query.date);
    console.log("Fetched LibCal grid with", slots.length, "slots for date", query.date);
    const results = buildResults(metadata.rooms, slots, query);

    res.setHeader("Cache-Control", "no-store");
    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown library availability error";
    const status = message.startsWith("Invalid ") || message.includes("required") ? 400 : 502;

    console.error("Library availability failed:", message);
    res.status(status).json({ error: message });
  }
});

router.get("/rooms", async (req, res) => {
  try {
    const date = readString(req.query.date) ?? formatDateLocal(new Date());
    validateDate(date);

    const session = await fetchLibCalPage(date);
    const metadata = getMetadata(session.html);

    res.setHeader("Cache-Control", "public, max-age=1800");
    res.json(metadata.rooms);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown library rooms error";
    console.error("Library room metadata failed:", message);
    res.status(502).json({ error: message });
  }
});

function parseAvailabilityQuery(raw: Record<string, unknown>): LibraryAvailabilityQuery {
  const date = readString(raw.date) ?? "";
  const startTime = readString(raw.startTime) ?? "";
  const duration = readNumber(raw.duration, 60);
  const groupSize = readNumber(raw.groupSize, 2);
  const floor = readString(raw.floor) ?? "any";
  const needsPower = readBoolean(raw.needsPower);
  const needsADA = readBoolean(raw.needsADA);

  validateDate(date);
  validateStartTime(startTime);

  if (!Number.isInteger(duration) || duration < 30 || duration > 180 || duration % 30 !== 0) {
    throw new Error("Invalid duration; expected 30-180 minutes in 30-minute increments");
  }

  if (!Number.isInteger(groupSize) || groupSize < 2 || groupSize > 9) {
    throw new Error("Invalid groupSize; expected 2-9");
  }

  if (floor !== "any" && !/^[2-6]$/.test(floor)) {
    throw new Error("Invalid floor; expected any or 2-6");
  }

  return { date, startTime, duration, groupSize, floor, needsPower, needsADA };
}

function readString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return readString(value[0]);
  }
  return typeof value === "string" ? value.trim() : undefined;
}

function readNumber(value: unknown, fallback: number): number {
  const text = readString(value);
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: unknown): boolean {
  const text = readString(value)?.toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function validateDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date; expected YYYY-MM-DD");
  }
}

function validateStartTime(startTime: string): void {
  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    throw new Error("Invalid startTime; expected HH:MM");
  }

  const [hourText, minuteText] = startTime.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (hour < 0 || hour > 23 || (minute !== 0 && minute !== 30)) {
    throw new Error("Invalid startTime; expected a half-hour HH:MM value");
  }
}

async function fetchLibCalPage(date: string): Promise<LibCalPageSession> {
  const referer = `${LIBCAL_BASE}${LIBCAL_PAGE_PATH}?lid=${LID}&gid=${DEFAULT_GROUP_ID}&dt=${date}`;
  const response = await fetch(referer, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`LibCal page returned ${response.status}`);
  }

  const html = await response.text();
  const cookie = collectCookies(response.headers);

  return { html, cookie, referer };
}

function collectCookies(headers: Headers): string {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const cookies = withGetSetCookie.getSetCookie?.() ?? [];
  const fallback = headers.get("set-cookie");

  if (cookies.length > 0) {
    return cookies.map((cookie) => cookie.split(";")[0]).filter(Boolean).join("; ");
  }

  return fallback ? fallback.split(/,(?=[^;]+?=)/).map((cookie) => cookie.split(";")[0]).filter(Boolean).join("; ") : "";
}

function getMetadata(html: string): LibCalMetadata {
  const now = Date.now();

  if (metadataCache && now - metadataCache.fetchedAt < METADATA_TTL_MS) {
    return metadataCache;
  }

  const parsed = parseMetadata(html);

  if (parsed.rooms.length === 0) {
    throw new Error("LibCal room metadata was not found in the public page");
  }

  const nextCache = { ...parsed, fetchedAt: now };
  metadataCache = nextCache;
  return nextCache;
}

function parseMetadata(html: string): Omit<LibCalMetadata, "fetchedAt"> {
  const parsedPageSize = numberFromPattern(html, /pageSize:\s*(\d+)/) ?? DEFAULT_PAGE_SIZE;
  const pageSize = parsedPageSize > 0 ? parsedPageSize : DEFAULT_PAGE_SIZE;
  const resourceRows = numberFromPattern(html, /resourceRows:\s*(\d+)/) ?? 0;
  const scriptRooms = parseRoomsFromResourceScript(html, pageSize);
  const rooms = scriptRooms.length > 0 ? scriptRooms : parseRoomsFromRenderedDom(html, pageSize);

  return {
    rooms,
    resourceRows: resourceRows || rooms.length,
    pageSize,
  };
}

function parseRoomsFromResourceScript(html: string, pageSize: number): LibCalRoom[] {
  const rooms: LibCalRoom[] = [];
  const resourcePattern = /resources\.push\(\s*\{([\s\S]*?)\}\s*\);/g;
  let match: RegExpExecArray | null;

  while ((match = resourcePattern.exec(html)) !== null) {
    const block = match[1] ?? "";
    const eid = numberField(block, "eid");
    const gid = numberField(block, "gid");
    const lid = numberField(block, "lid") ?? LID;
    const capacity = numberField(block, "capacity") ?? 0;
    const title = stringField(block, "title") ?? "Study Room";
    const name = title.replace(/\s*\(Capacity\s+\d+\)\s*$/i, "").trim();
    const filterIds = numberArrayField(block, "filterIds");
    const grouping = stringField(block, "grouping") ?? groupingForFloor(extractFloor(name));
    const url = stringField(block, "url") ?? `/space/${eid ?? ""}`;

    if (eid === null || gid === null) continue;

    rooms.push({
      id: eid,
      eid,
      gid,
      lid,
      name,
      title,
      url,
      grouping,
      capacity,
      floor: extractFloor(name),
      hasPower: filterIds.includes(POWER_FILTER_ID),
      isADA: filterIds.includes(ADA_FILTER_ID),
      pageIndex: 0,
    });
  }

  return assignGroupPageIndexes(rooms, pageSize);
}

function parseRoomsFromRenderedDom(html: string, pageSize: number): LibCalRoom[] {
  const $ = cheerio.load(html);
  const rooms: LibCalRoom[] = [];
  let currentGrouping = "Group Study Rooms";

  $("table.fc-datagrid-body tbody tr").each((_index: number, row: unknown) => {
    const groupText = $(row).find(".fc-resource-group .fc-datagrid-cell-main").text().trim();
    if (groupText) {
      currentGrouping = groupText;
      return;
    }

    const resourceCell = $(row).find("td.fc-resource[data-resource-id]").first();
    if (resourceCell.length === 0) return;

    const resourceId = String(resourceCell.attr("data-resource-id") ?? "");
    const eidMatch = resourceId.match(/eid_(\d+)/);
    const eid = eidMatch ? Number(eidMatch[1]) : NaN;
    if (!Number.isFinite(eid)) return;

    const title = resourceCell.find(".fc-cell-text").text().replace(/\s+/g, " ").trim();
    const capacityMatch = title.match(/Capacity\s+(\d+)/i);
    const capacity = capacityMatch ? Number(capacityMatch[1]) : 0;
    const name = title.replace(/\s*\(Capacity\s+\d+\)\s*$/i, "").trim();
    const className = resourceCell.find(".fc-cell-text").attr("class") ?? "";
    const gid = GROUP_ID_BY_GROUPING[currentGrouping] ?? DEFAULT_GROUP_ID;

    rooms.push({
      id: eid,
      eid,
      gid,
      lid: LID,
      name,
      title,
      url: `/space/${eid}`,
      grouping: currentGrouping,
      capacity,
      floor: extractFloor(name),
      hasPower: className.includes(`s-lc-filter-${POWER_FILTER_ID}`),
      isADA: className.includes(`s-lc-filter-${ADA_FILTER_ID}`),
      pageIndex: 0,
    });
  });

  return assignGroupPageIndexes(rooms, pageSize);
}

function assignGroupPageIndexes(rooms: LibCalRoom[], pageSize: number): LibCalRoom[] {
  return rooms.map((room, index) => ({
    ...room,
    pageIndex: Math.floor(index / pageSize),
  }));
}

function numberField(block: string, field: string): number | null {
  const match = block.match(new RegExp(`${field}:\\s*(-?\\d+)`));
  return match?.[1] ? Number(match[1]) : null;
}

function stringField(block: string, field: string): string | null {
  const match = block.match(new RegExp(`${field}:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  return match?.[1] ? decodeJsString(match[1]) : null;
}

function numberArrayField(block: string, field: string): number[] {
  const match = block.match(new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`));
  if (!match?.[1]) return [];

  return match[1]
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function decodeJsString(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return value.replace(/\\u0020/g, " ").replace(/\\\//g, "/");
  }
}

function numberFromPattern(source: string, pattern: RegExp): number | null {
  const match = source.match(pattern);
  return match?.[1] ? Number(match[1]) : null;
}

async function fetchAllGridSlots(
  session: LibCalPageSession,
  metadata: LibCalMetadata,
  date: string,
): Promise<LibCalGridSlot[]> {
  const pageCount = Math.max(1, Math.ceil(metadata.resourceRows / metadata.pageSize));
  const slots: LibCalGridSlot[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageSlots = await fetchGridPage(session, date, pageIndex, metadata.pageSize);
    slots.push(...pageSlots);
  }

  return slots;
}

async function fetchGridPage(
  session: LibCalPageSession,
  date: string,
  pageIndex: number,
  pageSize: number,
): Promise<LibCalGridSlot[]> {
  const body = new URLSearchParams({
    lid: String(LID),
    gid: String(DEFAULT_GROUP_ID),
    eid: String(DEFAULT_ITEM_ID),
    seat: String(DEFAULT_SEAT),
    seatId: String(DEFAULT_SEAT_ID),
    zone: String(DEFAULT_ZONE_ID),
    filters: "",
    start: date,
    end: addDays(date, 1),
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
  });

  const headers: Record<string, string> = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent": USER_AGENT,
    Origin: LIBCAL_BASE,
    Referer: session.referer,
    "X-Requested-With": "XMLHttpRequest",
  };

  if (session.cookie) {
    headers.Cookie = session.cookie;
  }

  const response = await fetch(`${LIBCAL_BASE}/spaces/availability/grid`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LibCal grid returned ${response.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }

  const data = (await response.json()) as { slots?: unknown };
  return Array.isArray(data.slots) ? (data.slots as LibCalGridSlot[]) : [];
}

function buildResults(
  rooms: LibCalRoom[],
  slots: LibCalGridSlot[],
  query: LibraryAvailabilityQuery,
): LibraryRoomResult[] {
  const availableStartMap = buildAvailableStartMap(slots, query.date);
  const requiredKeys = buildRequiredSlotKeys(query.date, query.startTime, query.duration);

  return rooms
    .filter((room) => roomMatchesFilters(room, query))
    .map((room) => {
      const starts = [...(availableStartMap.get(room.eid) ?? new Set<string>())].sort();
      const startSet = new Set(starts);
      const isAvailable = requiredKeys.every((key) => startSet.has(key));

      return {
        ...room,
        isAvailable,
        availableStarts: starts,
        nextAvailableStart: starts.find((start) => start >= `${query.date}T${query.startTime}`) ?? starts[0] ?? null,
        bookingUrl: `${LIBCAL_BASE}${LIBCAL_PAGE_PATH}?lid=${LID}&gid=${room.gid}&eid=${room.eid}&dt=${query.date}`,
      };
    })
    .sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      const floorCompare = (a.floor ?? "9").localeCompare(b.floor ?? "9");
      if (floorCompare !== 0) return floorCompare;
      return naturalRoomCompare(a.name, b.name);
    });
}

function roomMatchesFilters(room: LibCalRoom, query: LibraryAvailabilityQuery): boolean {
  if (query.floor !== "any" && room.floor !== query.floor) return false;
  if (room.capacity > 0 && query.groupSize > room.capacity) return false;
  if (query.needsPower && !room.hasPower) return false;
  if (query.needsADA && !room.isADA) return false;
  return true;
}

function buildAvailableStartMap(slots: LibCalGridSlot[], date: string): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();

  for (const slot of slots) {
    const itemId = Number(slot.itemId);
    if (!Number.isFinite(itemId) || !isSlotAvailable(slot)) continue;

    const key = normalizeSlotStart(slot.start);
    if (!key || !key.startsWith(`${date}T`)) continue;

    const existing = result.get(itemId) ?? new Set<string>();
    existing.add(key);
    result.set(itemId, existing);
  }

  return result;
}

function isSlotAvailable(slot: LibCalGridSlot): boolean {
  const classText = [slot.className, slot.classNames]
    .flat()
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLowerCase();

  if (
    classText.includes("checkout") ||
    classText.includes("unavailable") ||
    classText.includes("padding") ||
    classText.includes("booked") ||
    classText.includes("pending")
  ) {
    return false;
  }

  if (slot.status === 1 || slot.status === "1") return false;
  if (slot.status === 0 || slot.status === "0") return true;
  if (classText.includes("s-lc-eq-avail") || classText.includes("available")) return true;

  return classText.length === 0;
}

function normalizeSlotStart(start: unknown): string | null {
  if (typeof start !== "string") return null;

  const match = start.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
  if (!match?.[1] || !match[2]) return null;

  return `${match[1]}T${match[2]}`;
}

function buildRequiredSlotKeys(date: string, startTime: string, duration: number): string[] {
  const keys: string[] = [];

  for (let offset = 0; offset < duration; offset += 30) {
    keys.push(addMinutesToDateTime(date, startTime, offset));
  }

  return keys;
}

function addMinutesToDateTime(date: string, time: string, minutes: number): string {
  const [yearText, monthText, dayText] = date.split("-");
  const [hourText, minuteText] = time.split(":");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const totalMinutes = hour * 60 + minute + minutes;
  const dayOffset = Math.floor(totalMinutes / 1440);
  const minuteOfDay = ((totalMinutes % 1440) + 1440) % 1440;
  const adjustedDate = new Date(Date.UTC(year, month - 1, day + dayOffset));
  const adjustedDateText = adjustedDate.toISOString().slice(0, 10);
  const adjustedHour = Math.floor(minuteOfDay / 60);
  const adjustedMinute = minuteOfDay % 60;

  return `${adjustedDateText}T${String(adjustedHour).padStart(2, "0")}:${String(adjustedMinute).padStart(2, "0")}`;
}

function addDays(date: string, days: number): string {
  const [yearText, monthText, dayText] = date.split("-");
  const adjustedDate = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText) + days));
  return adjustedDate.toISOString().slice(0, 10);
}

function formatDateLocal(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function extractFloor(roomName: string): string | null {
  const match = roomName.match(/^([2-6])/);
  return match?.[1] ?? null;
}

function groupingForFloor(floor: string | null): string {
  switch (floor) {
    case "2":
      return "Second Floor Study Rooms";
    case "3":
      return "Third Floor Study Rooms";
    case "4":
      return "Fourth Floor Study Rooms";
    case "5":
      return "Fifth Floor Study Rooms";
    case "6":
      return "Sixth Floor Study Rooms";
    default:
      return "Group Study Rooms";
  }
}

function naturalRoomCompare(a: string, b: string): number {
  return a.localeCompare(b, "en-US", { numeric: true, sensitivity: "base" });
}

export default router;
