/**
 * app/(tabs)/library.tsx
 *
 * Native filter/results UI backed by BroncoPath's Express adapter.
 * Final booking stays in LibCal WebView so CPP SSO is handled by CPP.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import {
  getLibraryAvailability,
  type LibraryRoomResult,
} from "../../lib/api";

const LIBCAL_BASE = "https://cpp.libcal.com";
const LID = 8262;

const TIME_SLOTS = [
  "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00",
];

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr", value: 120 },
  { label: "3 hr", value: 180 },
];

const FLOORS = [
  { label: "Any", value: "any" },
  { label: "Floor 2", value: "2" },
  { label: "Floor 3", value: "3" },
  { label: "Floor 4", value: "4" },
  { label: "Floor 5", value: "5" },
  { label: "Floor 6", value: "6" },
];

type Filters = {
  date: string;
  startTime: string;
  duration: number;
  groupSize: number;
  floor: string;
  needsPower: boolean;
  needsADA: boolean;
};

type RoomWithSlots = {
  room: LibraryRoomResult;
  isAvailable: boolean;
};

type Step = "filter" | "results" | "booking";

type AutomationStage =
  | "loading"
  | "preparing"
  | "scanning-date-pages"
  | "selecting-slot"
  | "setting-duration"
  | "slot-prepared"
  | "submitting-times"
  | "handoff"
  | "ready-for-user"
  | "failed";

type LibCalAutomationMessage = {
  type?: string;
  stage?: string;
  details?: unknown;
};

function getDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: formatDateValue(d),
      label:
        i === 0
          ? "Today"
          : d.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
    };
  });
}

function formatDateValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function to12h(time24: string): string {
  const [hStr = "0", mStr = "00"] = time24.split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${mStr} ${period}`;
}

function toLibCalTimeLabel(time24: string): string {
  return to12h(time24).replace(" ", "").toLowerCase();
}

function addMins(time24: string, minutes: number): string {
  const [h = 0, m = 0] = time24.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function addDateTime(date: string, time24: string, minutes: number): { date: string; time: string } {
  const [yearText, monthText, dayText] = date.split("-");
  const [hourText, minuteText] = time24.split(":");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const total = hour * 60 + minute + minutes;
  const dayOffset = Math.floor(total / 1440);
  const minuteOfDay = ((total % 1440) + 1440) % 1440;
  const adjusted = new Date(Date.UTC(year, month - 1, day + dayOffset));

  return {
    date: adjusted.toISOString().slice(0, 10),
    time: `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`,
  };
}

function slotKeyTo12h(slotKey: string | null): string | null {
  const time = slotKey?.split("T")[1];
  return time ? to12h(time) : null;
}

function buildLibCalDirectUrl(date: string): string {
  return `${LIBCAL_BASE}/reserve/study-rooms?lid=${LID}&gid=0&dt=${date}`;
}

function buildInjectJS(
  date: string,
  startTime: string,
  duration: number,
  room: LibraryRoomResult,
): string {
  const end = addDateTime(date, startTime, duration);
  const config = {
    date,
    eid: room.eid,
    gid: room.gid,
    lid: room.lid,
    roomName: room.name,
    startIso: `${date}T${startTime}:00`,
    startMinute: `${date}T${startTime}`,
    startValueSpace: `${date} ${startTime}:00`,
    startLabel: toLibCalTimeLabel(startTime),
    endIso: `${end.date}T${end.time}:00`,
    endMinute: `${end.date}T${end.time}`,
    endValueSpace: `${end.date} ${end.time}:00`,
    endLabel: toLibCalTimeLabel(end.time),
    duration,
  };

  return `
(function() {
  if (window.__broncoPathLibCalStarted) return true;
  window.__broncoPathLibCalStarted = true;

  var config = ${JSON.stringify(config)};
  var maxAttempts = 80;
  var attempts = 0;

  function log(stage, details) {
    var payload = {
      type: 'broncoPathLibCal',
      stage: stage,
      details: details || null,
      at: new Date().toISOString()
    };

    try {
      console.log('[BroncoPath LibCal]', stage, details || null);
    } catch (e) {}

    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  function summarizeSlot(slot) {
    if (!slot) return null;

    return {
      itemId: slot.itemId,
      eid: slot.eid,
      id: slot.id,
      start: slot.start,
      normalizedStart: normalizeSlotStart(slot.start),
      status: slot.status,
      className: slot.className,
      classNames: slot.classNames,
      hasChecksum: !!slot.checksum,
      checksumPrefix: slot.checksum ? String(slot.checksum).slice(0, 8) : null
    };
  }

  function summarizeSlots(slots, limit) {
    var output = [];
    var max = Math.min(slots.length, limit || 10);

    for (var i = 0; i < max; i++) {
      output.push(summarizeSlot(slots[i]));
    }

    return output;
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, '').trim();
  }

  function normalizeSlotStart(value) {
    var text = String(value || '').trim();

    // Accept both:
    // 2026-05-15 10:00:00
    // 2026-05-15T10:00:00
    text = text.replace(' ', 'T');

    var datePart = text.slice(0, 10);
    var timePart = text.slice(11, 16);

    if (
      datePart.length === 10 &&
      timePart.length === 5 &&
      datePart.charAt(4) === '-' &&
      datePart.charAt(7) === '-' &&
      timePart.charAt(2) === ':'
    ) {
      return datePart + 'T' + timePart;
    }

    return '';
  }

  function addDays(dateText, days) {
    var parts = dateText.split('-').map(Number);
    var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
    return d.toISOString().slice(0, 10);
  }

  function phpDateTime(value) {
    if (window.moment && window.springSpace && springSpace.phpDateTimeFormat) {
      return moment(value).format(springSpace.phpDateTimeFormat);
    }
    return String(value || '').replace('T', ' ');
  }

  function viewStartDate() {
    try {
      var timeline = window.getCurrentTimelineInstance && getCurrentTimelineInstance(config.lid);
      if (timeline && timeline.view && timeline.view.activeStart && window.moment) {
        return moment(timeline.view.activeStart).format('YYYY-MM-DD');
      }
    } catch (e) {}
    return config.date;
  }

  function viewEndDate() {
    try {
      var timeline = window.getCurrentTimelineInstance && getCurrentTimelineInstance(config.lid);
      if (timeline && timeline.view && timeline.view.activeEnd && window.moment) {
        return moment(timeline.view.activeEnd).format('YYYY-MM-DD');
      }
    } catch (e) {}
    return addDays(config.date, 1);
  }

  function currentBookings() {
    try {
      if (window.preparePendingBookingsPayload) return preparePendingBookingsPayload();
    } catch (e) {}
    return [];
  }

  function postJson(url, payload) {
    return new Promise(function(resolve, reject) {
      if (window.jQuery && jQuery.ajax) {
        jQuery.ajax({
          type: 'post',
          url: url,
          data: payload,
          dataType: 'json'
        }).done(resolve).fail(function(xhr) {
          reject(new Error((xhr && (xhr.responseText || xhr.statusText || xhr.status)) || 'LibCal AJAX request failed'));
        });
        return;
      }

      reject(new Error('jQuery is not available on LibCal page'));
    });
  }

  function findMatchingSlotInData(data, pageIndex) {
    var slots = Array.isArray(data && data.slots) ? data.slots : [];

    log('grid-response-summary', {
      pageIndex: pageIndex,
      slotCount: slots.length,
      keys: data ? Object.keys(data) : [],
      windowEnd: data && data.windowEnd,
      isPreCreatedBooking: data && data.isPreCreatedBooking,
      firstSlots: summarizeSlots(slots, 8)
    });

    var sawSameRoom = false;
    var sawSameTime = false;
    var sawSameRoomAndTime = false;

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];

      var itemId = Number(slot.itemId || slot.eid || slot.id);
      var expectedEid = Number(config.eid);
      var normalizedStart = normalizeSlotStart(slot.start);

      var sameRoom = itemId === expectedEid;
      var sameTime = normalizedStart === config.startMinute;

      if (sameRoom) sawSameRoom = true;
      if (sameTime) sawSameTime = true;
      if (sameRoom && sameTime) sawSameRoomAndTime = true;

      if (!sameRoom || !sameTime) {
        continue;
      }

      var classText = normalize(
        [slot.className, slot.classNames].flat
          ? [slot.className, slot.classNames].flat().join(' ')
          : String(slot.className || '') + ' ' + String(slot.classNames || '')
      );

      var unavailable = classText.indexOf('checkout') !== -1 ||
        classText.indexOf('unavailable') !== -1 ||
        classText.indexOf('padding') !== -1 ||
        classText.indexOf('booked') !== -1 ||
        classText.indexOf('pending') !== -1 ||
        slot.status === 1 ||
        slot.status === '1';

      log('matching-room-time-slot-found', {
        pageIndex: pageIndex,
        slot: summarizeSlot(slot),
        classText: classText,
        unavailable: unavailable,
        hasChecksum: !!slot.checksum
      });

      if (!unavailable && slot.checksum) {
        return slot;
      }

      log('matching-slot-rejected', {
        pageIndex: pageIndex,
        reason: unavailable
          ? 'slot-was-marked-unavailable'
          : 'slot-had-no-checksum',
        slot: summarizeSlot(slot),
        classText: classText
      });
    }

    log('no-matching-slot-on-page', {
      pageIndex: pageIndex,
      expectedEid: config.eid,
      expectedStartMinute: config.startMinute,
      sawSameRoom: sawSameRoom,
      sawSameTime: sawSameTime,
      sawSameRoomAndTime: sawSameRoomAndTime,
      slotCount: slots.length
    });

    return null;
  }

 function fetchSlotFromLibCal() {
    var pageSize = Number((window.springyPage && springyPage.pageSize) || 18);
    var resourceRows = Number((window.springyPage && (springyPage.resourceRows || springyPage.resourceCount)) || 0);

    var totalPages = resourceRows > 0
      ? Math.ceil(resourceRows / pageSize)
      : 3;

    totalPages = Math.max(1, Math.min(totalPages, 3));

    var pageIndexes = [];
    for (var p = 0; p < totalPages; p++) {
      pageIndexes.push(p);
    }

    log('grid-pagination-plan', {
      pageIndexes: pageIndexes,
      pageSize: pageSize,
      resourceRows: resourceRows,
      springyPage: window.springyPage ? {
        pageIndex: springyPage.pageIndex,
        pageSize: springyPage.pageSize,
        resourceRows: springyPage.resourceRows,
        resourceCount: springyPage.resourceCount,
        locationId: springyPage.locationId,
        groupId: springyPage.groupId,
        itemId: springyPage.itemId,
        isSeatBooking: springyPage.isSeatBooking,
        seatId: springyPage.seatId,
        zoneId: springyPage.zoneId,
        filterIds: springyPage.filterIds
      } : null,
      config: {
        eid: config.eid,
        gid: config.gid,
        lid: config.lid,
        roomName: config.roomName,
        date: config.date,
        startMinute: config.startMinute,
        startIso: config.startIso,
        endIso: config.endIso
      }
    });

    var chain = Promise.resolve(null);

    pageIndexes.forEach(function(pageIndex) {
      chain = chain.then(function(foundSlot) {
        if (foundSlot) return foundSlot;

        var payload = {
          lid: config.lid,

          // Important: keep your target gid/eid.
          gid: config.gid,
          eid: config.eid,

          seat: window.springyPage ? springyPage.isSeatBooking : 0,
          seatId: window.springyPage ? springyPage.seatId : 0,
          zone: window.springyPage ? springyPage.zoneId : 0,
          filters: window.springyPage ? springyPage.filterIds : '',

          start: config.date,
          end: addDays(config.date, 1),
          bookings: currentBookings(),
          pageIndex: pageIndex,
          pageSize: pageSize
        };

        log('grid-request-start', {
          pageIndex: pageIndex,
          payload: payload
        });

        return postJson('/spaces/availability/grid', payload)
          .then(function(data) {
            log('grid-request-success', {
              pageIndex: pageIndex,
              hasData: !!data,
              keys: data ? Object.keys(data) : [],
              slotCount: Array.isArray(data && data.slots) ? data.slots.length : null
            });

            var slot = findMatchingSlotInData(data, pageIndex);

            if (slot) {
              log('found-slot-on-page', {
                pageIndex: pageIndex,
                slot: summarizeSlot(slot)
              });

              return slot;
            }

            return null;
          })
          .catch(function(error) {
            log('grid-request-failed', {
              pageIndex: pageIndex,
              reason: error && error.message ? error.message : String(error)
            });

            return null;
          });
      });
    });

    return chain.then(function(foundSlot) {
      if (foundSlot) return foundSlot;

      throw new Error('Matching LibCal slot was not returned by /spaces/availability/grid on any pageIndex');
    });
  }

  function applyBookingAdd(slot) {
    var payload = {
      add: {
        eid: config.eid,
        seat_id: 0,
        gid: config.gid,
        lid: config.lid,
        start: phpDateTime(config.startIso),
        checksum: slot.checksum
      },
      lid: config.lid,
      gid: 0,
      start: config.date,
      end: addDays(config.date, 1),
      bookings: currentBookings()
    };

    log('booking-add-request', {
      payload: {
        add: {
          eid: payload.add.eid,
          seat_id: payload.add.seat_id,
          gid: payload.add.gid,
          lid: payload.add.lid,
          start: payload.add.start,
          checksumPrefix: payload.add.checksum ? String(payload.add.checksum).slice(0, 8) : null
        },
        lid: payload.lid,
        gid: payload.gid,
        start: payload.start,
        end: payload.end,
        bookingsCount: Array.isArray(payload.bookings) ? payload.bookings.length : null
      },
      slot: summarizeSlot(slot)
    });

    return postJson('/spaces/availability/booking/add', payload).then(function(data) {
      log('booking-add-response', {
        hasData: !!data,
        keys: data ? Object.keys(data) : [],
        error: data && data.error,
        limitIssues: data && data.limitIssues,
        bookingsCount: Array.isArray(data && data.bookings) ? data.bookings.length : null,
        hasGridUpdateData: !!(data && data.gridUpdateData)
      });

      if (data && data.error) throw new Error(data.error);

      try {
        if (typeof pendingBookingsLimitIssues !== 'undefined') {
          pendingBookingsLimitIssues = data.limitIssues || [];
        }
        if (window.updatePendingBookingsFromData && data && data.bookings) {
          updatePendingBookingsFromData(data.bookings);
        }
        if (window.renderPendingRoomBookings) {
          renderPendingRoomBookings();
        }

        log('booking-add-rendered-pending-bookings', {
          pendingBookingsCount: typeof pendingRoomBookings !== 'undefined'
            ? pendingRoomBookings.length
            : null,
          endSelectCount: document.querySelectorAll('select.b-end-date').length,
          submitButtonExists: !!document.querySelector('#submit_times')
        });
      } catch (e) {
        log('booking-add-render-failed', {
          reason: e.message || String(e)
        });

        throw new Error('LibCal accepted the slot, but BroncoPath could not render the pending booking: ' + e.message);
      }

      return data;
    });
  }

  function waitForEndSelect() {
    return new Promise(function(resolve, reject) {
      var tries = 0;
      var timer = setInterval(function() {
        tries += 1;

        var selects = Array.prototype.slice.call(document.querySelectorAll('select.b-end-date'));

        if (tries === 1 || tries % 5 === 0 || selects.length > 0) {
          log('waiting-for-end-select', {
            tries: tries,
            selectCount: selects.length,
            duration: config.duration,
            formBoxVisible: !!document.querySelector('#s-lc-eq-form-box'),
            pendingBookingEls: document.querySelectorAll('.s-lc-pending-booking').length,
            submitButtonExists: !!document.querySelector('#submit_times')
          });
        }

        if (selects.length > 0 || config.duration === 180) {
          clearInterval(timer);
          log('end-select-ready', {
            tries: tries,
            selectCount: selects.length,
            duration: config.duration
          });
          resolve(selects);
          return;
        }

        if (tries > 40) {
          clearInterval(timer);
          reject(new Error('LibCal end-time dropdown did not appear'));
        }
      }, 250);
    });
  }

  function selectEndTime(selects) {
    if (!selects || selects.length === 0) {
      log('select-end-time-skipped', {
        reason: 'no-selects',
        duration: config.duration
      });
      return Promise.resolve();
    }

    var targetEnd = normalizeSlotStart(config.endIso);

    log('select-end-time-started', {
      targetEnd: targetEnd,
      endIso: config.endIso,
      endValueSpace: config.endValueSpace,
      endLabel: config.endLabel,
      selectCount: selects.length
    });

    for (var i = 0; i < selects.length; i++) {
      var select = selects[i];
      var options = Array.prototype.slice.call(select.options || []);

      log('end-select-options', {
        selectIndex: i,
        optionCount: options.length,
        options: options.slice(0, 12).map(function(option) {
          return {
            value: option.value,
            normalizedValue: normalizeSlotStart(option.value),
            text: option.textContent
          };
        })
      });

      for (var j = 0; j < options.length; j++) {
        var option = options[j];
        var value = String(option.value || '');
        var label = normalize(option.textContent || '');

        if (
          normalizeSlotStart(value) === targetEnd ||
          value.indexOf(config.endValueSpace) !== -1 ||
          label.indexOf(normalize(config.endLabel)) !== -1
        ) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));

          log('selected-end-time', {
            value: option.value,
            text: option.textContent,
            normalizedValue: normalizeSlotStart(option.value)
          });

          return new Promise(function(resolve) {
            setTimeout(resolve, 1200);
          });
        }
      }
    }

    log('select-end-time-failed', {
      targetEnd: targetEnd,
      endIso: config.endIso,
      endValueSpace: config.endValueSpace,
      endLabel: config.endLabel
    });

    throw new Error('Requested end time was not available in LibCal dropdown');
  }

  function delayThenSubmitTimes() {
    return new Promise(function(resolve) {
      setTimeout(function() {
        submitTimes();
        log('submit-times-invoked');
        resolve();
      }, 500);
    });
  }

  function submitTimes() {
    log('submit-times-started', {
      submitFunctionExists: typeof window.submitPendingTimes === 'function',
      formExists: !!document.querySelector('#s-lc-eq-form-times'),
      buttonExists: !!document.querySelector('#submit_times'),
      buttonDisabled: !!(document.querySelector('#submit_times') && document.querySelector('#submit_times').disabled),
      pendingBookingsCount: typeof pendingRoomBookings !== 'undefined' ? pendingRoomBookings.length : null
    });

    if (typeof window.submitPendingTimes === 'function') {
      log('submitting-times-via-libcal-function');
      window.submitPendingTimes();
      return;
    }

    var form = document.querySelector('#s-lc-eq-form-times');
    if (form) {
      log('submitting-times-via-form-submit-event');

      var event;
      if (typeof Event === 'function') {
        event = new Event('submit', { bubbles: true, cancelable: true });
      } else {
        event = document.createEvent('Event');
        event.initEvent('submit', true, true);
      }

      form.dispatchEvent(event);
      return;
    }

    var button = document.querySelector('#submit_times');
    if (!button || button.disabled) {
      throw new Error('Submit Times button is unavailable');
    }

    log('submitting-times-via-button');
    button.scrollIntoView({ block: 'center' });
    button.click();
  }

  function datePhrase() {
    var d = new Date(config.date + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function findMatchingDomSlot() {
    var wantedRoom = normalize(config.roomName);
    var wantedTime = normalize(config.startLabel);
    var wantedDate = normalize(datePhrase());
    var candidates = Array.prototype.slice.call(
      document.querySelectorAll('a.s-lc-eq-avail[title], a.s-lc-eq-avail[aria-label]')
    );

    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var text = normalize(el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent || '');
      if (text.indexOf(wantedRoom) !== -1 && text.indexOf(wantedTime) !== -1 && text.indexOf(wantedDate) !== -1) {
        return el;
      }
    }

    return null;
  }

  function domClickFallback() {
    log('dom-click-fallback-started');
    var timer = setInterval(function() {
      attempts += 1;
      var slot = findMatchingDomSlot();
      if (!slot) {
        if (attempts > maxAttempts) {
          clearInterval(timer);
          log('failed', { reason: 'Matching visible DOM slot not found' });
        }
        return;
      }

      clearInterval(timer);
      slot.scrollIntoView({ block: 'center', inline: 'center' });
      slot.click();
      waitForEndSelect()
        .then(selectEndTime)
        .then(delayThenSubmitTimes)
        .catch(function(error) { log('failed', { reason: error.message || String(error) }); });
    }, 250);
  }

  function start() {
    if (location.hostname !== 'cpp.libcal.com' || location.pathname.indexOf('/reserve/') === -1) {
      return;
    }

    if (!window.jQuery || !window.moment || !window.springyPage) {
      attempts += 1;
      if (attempts > maxAttempts) {
        log('failed', { reason: 'LibCal scripts did not finish loading' });
        return;
      }
      setTimeout(start, 250);
      return;
    }

    log('direct-libcal-flow-started', config);

    fetchSlotFromLibCal()
      .then(function(slot) {
        log('found-slot-checksum');
        return applyBookingAdd(slot);
      })
      .then(waitForEndSelect)
      .then(selectEndTime)
      .then(function() {
        setTimeout(submitTimes, 500);
      })
      .catch(function(error) {
        log('direct-flow-failed', { reason: error.message || String(error) });
        domClickFallback();
      });
  }

  start();
})();
true;
  `.trim();
}


function stageFromLibCalMessage(stage: string | undefined): AutomationStage {
  switch (stage) {
    case "direct-libcal-flow-started":
      return "preparing";
    case "syncing-date-page":
    case "scanning-date-pages":
      return "scanning-date-pages";
    case "fetching-slot":
    case "found-slot-checksum":
    case "adding-pending-booking":
    case "dom-click-fallback-started":
      return "selecting-slot";
    case "selecting-end-time":
    case "selected-end-time":
      return "setting-duration";
    case "slot-prepared":
      return "slot-prepared";
    case "submitting-times":
      return "submitting-times";
    case "sso-redirect-ready":
      return "handoff";
    case "booking-form-ready":
      return "ready-for-user";
    case "manual-needed":
    case "failed":
      return "failed";
    default:
      return "preparing";
  }
}

function detailToText(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const maybeReason = (details as { reason?: unknown }).reason;
  if (typeof maybeReason === "string" && maybeReason.trim()) return maybeReason;
  return null;
}

function isLikelySsoOrCheckoutUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (!lower) return false;

  if (
    lower.includes("libauth") ||
    lower.includes("sso") ||
    lower.includes("saml") ||
    lower.includes("shibboleth") ||
    lower.includes("/login") ||
    lower.includes("/auth") ||
    lower.includes("idp") ||
    lower.includes("okta")
  ) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname.length > 0 && parsed.hostname !== "cpp.libcal.com";
  } catch {
    return false;
  }
}

export default function LibraryScreen() {
  const days = useMemo(() => getDays(), []);

  const [step, setStep] = useState<Step>("filter");
  const [filters, setFilters] = useState<Filters>({
    date: days[0]?.value ?? formatDateValue(new Date()),
    startTime: "10:00",
    duration: 60,
    groupSize: 2,
    floor: "any",
    needsPower: false,
    needsADA: false,
  });

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [results, setResults] = useState<RoomWithSlots[]>([]);
  const [bookingRoom, setBookingRoom] = useState<LibraryRoomResult | null>(null);
  const [automationStage, setAutomationStage] = useState<AutomationStage>("loading");
  const [automationDetail, setAutomationDetail] = useState<string | null>(null);
  const [webViewVisible, setWebViewVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateTo = useCallback((direction: 1 | -1) => {
    slideAnim.setValue(direction * 40);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [slideAnim]);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearHardRevealTimer = useCallback(() => {
    if (hardRevealTimerRef.current) {
      clearTimeout(hardRevealTimerRef.current);
      hardRevealTimerRef.current = null;
    }
  }, []);

  const revealWebViewForUser = useCallback((stage: AutomationStage = "ready-for-user", detail?: string) => {
    clearRevealTimer();
    clearHardRevealTimer();
    if (detail) setAutomationDetail(detail);
    setAutomationStage(stage);
    setWebViewVisible(true);
  }, [clearHardRevealTimer, clearRevealTimer]);

  const scheduleWebViewReveal = useCallback((delayMs: number) => {
    clearRevealTimer();
    revealTimerRef.current = setTimeout(() => {
      revealWebViewForUser("ready-for-user");
    }, delayMs);
  }, [clearRevealTimer, revealWebViewForUser]);

  const scheduleHardReveal = useCallback((delayMs: number, detail: string) => {
    clearHardRevealTimer();
    hardRevealTimerRef.current = setTimeout(() => {
      revealWebViewForUser("failed", detail);
    }, delayMs);
  }, [clearHardRevealTimer, revealWebViewForUser]);

  useEffect(() => () => {
    clearRevealTimer();
    clearHardRevealTimer();
  }, [clearHardRevealTimer, clearRevealTimer]);

  async function handleSearch() {
    setStep("results");
    setLoading(true);
    setApiError(null);
    setResults([]);
    animateTo(1);

    try {
      console.log("Searching for library rooms with filters:", filters);
      const rooms = await getLibraryAvailability(filters);
      console.log("Received library availability results:", rooms);
      setResults(rooms.map((room) => ({ room, isAvailable: room.isAvailable })));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LibCal error";
      setApiError(message);
    } finally {
      setLoading(false);
    }
  }

  function openBooking(room: LibraryRoomResult) {
    clearRevealTimer();
    clearHardRevealTimer();
    setBookingRoom(room);
    setAutomationStage("loading");
    setAutomationDetail(null);
    setWebViewVisible(false);
    animateTo(1);
    setStep("booking");
    scheduleHardReveal(30000, "LibCal did not finish the automatic handoff. The WebView is open so you can complete it manually.");
  }

  function goBack() {
    animateTo(-1);
    if (step === "booking") {
      clearRevealTimer();
      clearHardRevealTimer();
      setStep("results");
      setBookingRoom(null);
      setAutomationStage("loading");
      setAutomationDetail(null);
      setWebViewVisible(false);
    } else {
      setStep("filter");
    }
  }

  function handleLibCalMessage(event: { nativeEvent: { data: string } }) {
    let message: LibCalAutomationMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as LibCalAutomationMessage;
    } catch {
      return;
    }

    if (message.type !== "broncoPathLibCal") return;

    const nextStage = stageFromLibCalMessage(message.stage);
    setAutomationDetail(detailToText(message.details));

    if (message.stage === "slot-prepared") {
      setAutomationStage("slot-prepared");
      scheduleHardReveal(20000, "The slot was selected, but LibCal did not finish opening CPP SSO. Continue manually in the WebView.");
      return;
    }

    if (message.stage === "submitting-times") {
      setAutomationStage("submitting-times");
      scheduleHardReveal(20000, "LibCal did not return an SSO handoff. The WebView is open so you can press Submit Times manually.");
      return;
    }

    if (message.stage === "sso-redirect-ready") {
      clearHardRevealTimer();
      setAutomationStage("handoff");
      scheduleWebViewReveal(1500);
      return;
    }

    if (message.stage === "booking-form-ready") {
      revealWebViewForUser("ready-for-user");
      return;
    }

    if (nextStage === "failed") {
      clearHardRevealTimer();
      revealWebViewForUser("failed");
      return;
    }

    setAutomationStage(nextStage);
  }

  function handleBookingNavigation(nav: WebViewNavigation) {
    if (isLikelySsoOrCheckoutUrl(nav.url)) {
      revealWebViewForUser("ready-for-user");
    }
  }

  const bookingUrl = bookingRoom?.bookingUrl ?? "";
  const showChromeHeader = step !== "filter" && !(step === "booking" && !webViewVisible);

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: Colors.bg }}
    >
      {showChromeHeader && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 8,
            borderBottomColor: Colors.border,
            borderBottomWidth: 1,
          }}
        >
          <Pressable onPress={goBack} hitSlop={8} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </Pressable>
          <Text style={{ color: Colors.text, fontFamily: Fonts.display, fontSize: 20, flex: 1 }}>
            {step === "results"
              ? "Available Rooms"
              : bookingRoom?.name ?? "Reserve Room"}
          </Text>
          {step === "results" && (
            <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 11 }}>
              {results.filter((r) => r.isAvailable).length} open
            </Text>
          )}
        </View>
      )}

      <Animated.View style={{ flex: 1, transform: [{ translateY: slideAnim }] }}>
        {step === "filter" && (
          <FilterStep
            days={days}
            filters={filters}
            onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onSearch={handleSearch}
          />
        )}

        {step === "results" && (
          <ResultsStep
            loading={loading}
            error={apiError}
            results={results}
            filters={filters}
            onBook={openBooking}
            onOpenDirect={() => Linking.openURL(buildLibCalDirectUrl(filters.date))}
          />
        )}

        {step === "booking" && bookingRoom && (
          <BookingStep
            url={bookingUrl}
            injectJS={buildInjectJS(filters.date, filters.startTime, filters.duration, bookingRoom)}
            room={bookingRoom}
            filters={filters}
            automationStage={automationStage}
            automationDetail={automationDetail}
            webViewVisible={webViewVisible}
            onMessage={handleLibCalMessage}
            onNavigationStateChange={handleBookingNavigation}
            onCancel={goBack}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

type FilterStepProps = {
  days: { value: string; label: string }[];
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onSearch: () => void;
};

function FilterStep({ days, filters, onChange, onSearch }: FilterStepProps) {
  const endTime = addMins(filters.startTime, filters.duration);
  const [searchPressed, setSearchPressed] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ color: Colors.text, fontFamily: Fonts.display, fontSize: 28, marginBottom: 4 }}>
        Library Rooms
      </Text>
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 12, marginBottom: 24, lineHeight: 18 }}>
        Pick a date, time, capacity, and room specs. BroncoPath checks availability; CPP handles SSO.
      </Text>

      <FilterLabel icon="calendar">Date</FilterLabel>
      <HScroll>
        {days.map((d) => (
          <Chip
            key={d.value}
            label={d.label}
            selected={filters.date === d.value}
            onPress={() => onChange({ date: d.value })}
          />
        ))}
      </HScroll>

      <FilterLabel icon="clock">Start time</FilterLabel>
      <HScroll>
        {TIME_SLOTS.map((t) => (
          <Chip
            key={t}
            label={to12h(t)}
            selected={filters.startTime === t}
            onPress={() => onChange({ startTime: t })}
          />
        ))}
      </HScroll>

      <FilterLabel icon="watch">Duration</FilterLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        {DURATIONS.map((d) => (
          <Chip
            key={d.value}
            label={d.label}
            selected={filters.duration === d.value}
            onPress={() => onChange({ duration: d.value })}
          />
        ))}
      </View>

      <Text style={{
        color: Colors.muted,
        fontFamily: Fonts.body,
        fontSize: 11,
        marginTop: 6,
        marginBottom: 20,
      }}>
        {to12h(filters.startTime)} – {to12h(endTime)}
      </Text>

      <FilterLabel icon="users">Group size</FilterLabel>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.card,
        borderColor: Colors.border,
        borderWidth: 1,
        borderRadius: 16,
        alignSelf: "flex-start",
        marginBottom: 20,
        overflow: "hidden",
      }}>
        <StepperBtn
          icon="minus"
          disabled={filters.groupSize <= 2}
          onPress={() => onChange({ groupSize: Math.max(2, filters.groupSize - 1) })}
        />
        <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ color: Colors.text, fontFamily: Fonts.bodySemiBold, fontSize: 18 }}>
            {filters.groupSize}
          </Text>
        </View>
        <StepperBtn
          icon="plus"
          disabled={filters.groupSize >= 9}
          onPress={() => onChange({ groupSize: Math.min(9, filters.groupSize + 1) })}
        />
      </View>
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, marginTop: -14, marginBottom: 20 }}>
        CPP group rooms require 2 – 9 students
      </Text>

      <FilterLabel icon="layers">Preferred floor</FilterLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {FLOORS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            selected={filters.floor === f.value}
            onPress={() => onChange({ floor: f.value })}
          />
        ))}
      </View>

      <FilterLabel icon="sliders">Preferences</FilterLabel>
      <Toggle
        label="Power outlet"
        icon="zap"
        value={filters.needsPower}
        onPress={() => onChange({ needsPower: !filters.needsPower })}
      />
      <Toggle
        label="ADA accessible"
        icon="check-circle"
        value={filters.needsADA}
        onPress={() => onChange({ needsADA: !filters.needsADA })}
      />

      <Pressable
        onPress={onSearch}
        onPressIn={() => setSearchPressed(true)}
        onPressOut={() => setSearchPressed(false)}
        style={{
          marginTop: 28,
          backgroundColor: searchPressed ? Colors.accentDim : Colors.accent,
          borderRadius: 16,
          paddingVertical: 16,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Feather name="search" size={16} color={Colors.bg} />
        <Text style={{ color: Colors.bg, fontFamily: Fonts.bodySemiBold, fontSize: 15 }}>
          Find Available Rooms
        </Text>
      </Pressable>
    </ScrollView>
  );
}

type ResultsStepProps = {
  loading: boolean;
  error: string | null;
  results: RoomWithSlots[];
  filters: Filters;
  onBook: (room: LibraryRoomResult) => void;
  onOpenDirect: () => void;
};

function ResultsStep({
  loading,
  error,
  results,
  filters,
  onBook,
  onOpenDirect,
}: ResultsStepProps) {
  const endTime = addMins(filters.startTime, filters.duration);
  const available = results.filter((r) => r.isAvailable);
  const unavailable = results.filter((r) => !r.isAvailable);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 13, marginTop: 14 }}>
          Checking LibCal through BroncoPath…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Feather name="wifi-off" size={36} color={Colors.muted} style={{ marginBottom: 14 }} />
        <Text style={{
          color: Colors.text,
          fontFamily: Fonts.bodyMedium,
          fontSize: 16,
          textAlign: "center",
          marginBottom: 8,
        }}>
          Couldn't read LibCal availability
        </Text>
        <Text style={{
          color: Colors.muted,
          fontFamily: Fonts.body,
          fontSize: 12,
          textAlign: "center",
          marginBottom: 28,
          lineHeight: 18,
        }}>
          The backend could not reach or parse LibCal. Open LibCal directly to continue with CPP's booking page.
        </Text>
        <ActionButton
          icon="external-link"
          label="Open LibCal Directly"
          onPress={onOpenDirect}
        />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 10, marginTop: 18, textAlign: "center" }}>
          {error}
        </Text>
      </View>
    );
  }

  const summaryParts = [
    `${to12h(filters.startTime)} – ${to12h(endTime)}`,
    `${filters.groupSize} people`,
    filters.floor !== "any" ? `Floor ${filters.floor}` : null,
    filters.needsPower ? "Power" : null,
    filters.needsADA ? "ADA" : null,
  ].filter(Boolean).join(" · ");

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{
        backgroundColor: Colors.card,
        borderColor: Colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}>
        <Feather name="filter" size={13} color={Colors.muted} />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, flex: 1 }}>
          {summaryParts}
        </Text>
      </View>

      {available.length === 0 && unavailable.length === 0 && (
        <EmptyResults onOpenDirect={onOpenDirect} />
      )}

      {available.length > 0 && (
        <>
          <SectionLabel>Available ({available.length})</SectionLabel>
          {available.map(({ room }) => (
            <RoomCard
              key={room.eid}
              room={room}
              available
              onBook={() => onBook(room)}
            />
          ))}
        </>
      )}

      {unavailable.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: available.length > 0 ? 24 : 0 }}>
            Matching specs, unavailable now ({unavailable.length})
          </SectionLabel>
          {unavailable.map(({ room }) => (
            <RoomCard
              key={room.eid}
              room={room}
              available={false}
              onBook={() => onBook(room)}
            />
          ))}
        </>
      )}

      <Pressable
        onPress={onOpenDirect}
        style={{ marginTop: 24, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
      >
        <Feather name="external-link" size={12} color={Colors.muted} />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>
          Browse full LibCal calendar
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function EmptyResults({ onOpenDirect }: { onOpenDirect: () => void }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 32 }}>
      <Feather name="inbox" size={34} color={Colors.muted} style={{ marginBottom: 12 }} />
      <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 15, marginBottom: 4 }}>
        No rooms matched
      </Text>
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 12, textAlign: "center", lineHeight: 18 }}>
        Try another floor, group size, time, or preference combination.
      </Text>
      <Pressable onPress={onOpenDirect} style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather name="external-link" size={13} color={Colors.accent} />
        <Text style={{ color: Colors.accent, fontFamily: Fonts.bodySemiBold, fontSize: 12 }}>
          Open LibCal directly
        </Text>
      </Pressable>
    </View>
  );
}

type BookingStepProps = {
  url: string;
  injectJS: string;
  room: LibraryRoomResult;
  filters: Filters;
  automationStage: AutomationStage;
  automationDetail: string | null;
  webViewVisible: boolean;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  onNavigationStateChange: (nav: WebViewNavigation) => void;
  onCancel: () => void;
};

function BookingStep({
  url,
  injectJS,
  room,
  filters,
  automationStage,
  automationDetail,
  webViewVisible,
  onMessage,
  onNavigationStateChange,
  onCancel,
}: BookingStepProps) {
  const endTime = addMins(filters.startTime, filters.duration);

  return (
    <View style={{ flex: 1 }}>
      {webViewVisible && (
        <View style={{
          backgroundColor: Colors.surface,
          borderBottomColor: Colors.border,
          borderBottomWidth: 1,
          paddingHorizontal: 20,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}>
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: room.isAvailable ? Colors.accent : Colors.med,
          }} />
          <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 13, flex: 1 }} numberOfLines={1}>
            {room.name}
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 11 }}>
            {to12h(filters.startTime)}-{to12h(endTime)}
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <View
          pointerEvents={webViewVisible ? "auto" : "none"}
          style={{ flex: 1, opacity: webViewVisible ? 1 : 0 }}
        >
          <WebView
            source={{ uri: url }}
            injectedJavaScript={injectJS}
            javaScriptEnabled
            domStorageEnabled
            style={{ flex: 1, backgroundColor: Colors.bg }}
            onMessage={onMessage}
            onNavigationStateChange={onNavigationStateChange}
          />
        </View>

        {!webViewVisible && (
          <ReservationPrepOverlay
            room={room}
            filters={filters}
            stage={automationStage}
            detail={automationDetail}
            onCancel={onCancel}
          />
        )}
      </View>

      {webViewVisible && (
        <View style={{
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingHorizontal: 20,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}>
          <Feather
            name={automationStage === "failed" ? "alert-triangle" : "lock"}
            size={12}
            color={automationStage === "failed" ? Colors.med : Colors.muted}
          />
          <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, flex: 1, lineHeight: 16 }}>
            {automationStage === "failed"
              ? "Automation could not finish. Complete the selection manually in LibCal; no reservation has been made yet."
              : "Continue in CPP SSO or LibCal. The room is not reserved until you submit the final LibCal form."}
          </Text>
        </View>
      )}
    </View>
  );
}

function ReservationPrepOverlay({
  room,
  filters,
  stage,
  detail,
  onCancel,
}: {
  room: LibraryRoomResult;
  filters: Filters;
  stage: AutomationStage;
  detail: string | null;
  onCancel: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const endTime = addMins(filters.startTime, filters.duration);
  const activeIndex = prepActiveIndex(stage);
  const cards = [
    {
      index: 0,
      icon: "home" as const,
      prompt: "Which study room?",
      answer: room.name,
      hint: room.grouping,
    },
    {
      index: 1,
      icon: "calendar" as const,
      prompt: "When should it start?",
      answer: `${to12h(filters.startTime)}`,
      hint: filters.date,
    },
    {
      index: 2,
      icon: "watch" as const,
      prompt: "How long should it last?",
      answer: `${to12h(filters.startTime)} - ${to12h(endTime)}`,
      hint: `${filters.duration} minutes`,
    },
    {
      index: 3,
      icon: "send" as const,
      prompt: "Ready for CPP sign-in?",
      answer: "Submit Times",
      hint: "LibCal will hand this to CPP SSO",
    },
  ];
  const visualCards = [...cards, { ...cards[0], index: 4 }];

  useEffect(() => {
    progress.setValue(0);
    press.setValue(0);

    function clickBeat() {
      return Animated.sequence([
        Animated.delay(stage === "submitting-times" || stage === "handoff" ? 260 : 520),
        Animated.timing(press, {
          toValue: 1,
          duration: 105,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(press, {
          toValue: 0,
          duration: 155,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(stage === "submitting-times" || stage === "handoff" ? 420 : 700),
      ]);
    }

    function slideTo(index: number) {
      return Animated.timing(progress, {
        toValue: index,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    }

    const flowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 0,
          duration: 1,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        clickBeat(),
        slideTo(1),
        clickBeat(),
        slideTo(2),
        clickBeat(),
        slideTo(3),
        clickBeat(),
        slideTo(4),
        clickBeat(),
      ]),
    );

    flowAnimation.start();

    return () => {
      flowAnimation.stop();
    };
  }, [press, progress, stage]);

  const pointerY = progress.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [50, 72, 94, 114, 50],
  });
  const pointerScale = press.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.82],
  });

  return (
    <View style={{
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: Colors.bg,
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 24,
      zIndex: 20,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable
          onPress={onCancel}
          hitSlop={10}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: Colors.surface,
            borderColor: Colors.border,
            borderWidth: 1,
          }}
        >
          <Feather name="x" size={17} color={Colors.muted} />
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: stage === "failed" ? Colors.med : Colors.accent,
          }} />
          <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 11 }}>
            LibCal handoff
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ marginBottom: 28 }}>
          <Text style={{
            color: Colors.accent,
            fontFamily: Fonts.mono,
            fontSize: 12,
            marginBottom: 12,
          }}>
            1 → preparing your reservation
          </Text>
          <Text style={{ color: Colors.text, fontFamily: Fonts.display, fontSize: 34, lineHeight: 40 }}>
            Filling LibCal for you.
          </Text>
          <Text style={{
            color: Colors.muted,
            fontFamily: Fonts.body,
            fontSize: 13,
            lineHeight: 20,
            marginTop: 12,
            maxWidth: 330,
          }}>
            {prepStageCopy(stage)}
          </Text>
        </View>

        <View style={{
          height: 292,
          justifyContent: "center",
          overflow: "hidden",
        }}>
          {visualCards.map((card) => (
            <FlyingFormCard
              key={`${card.index}-${card.prompt}`}
              card={card}
              progress={progress}
              press={press}
              active={activeIndex === (card.index === 4 ? 0 : card.index)}
              isSubmit={card.index === 3}
            />
          ))}

          <Animated.View style={{
            position: "absolute",
            right: 94,
            top: 96,
            transform: [
              { translateY: pointerY },
              { scale: pointerScale },
            ],
            shadowColor: "#000",
            shadowOpacity: 0.26,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          }}>
            <Feather name="mouse-pointer" size={24} color={Colors.accent} />
          </Animated.View>
        </View>

        <View style={{
          marginTop: 26,
          backgroundColor: stage === "failed" ? Colors.medBg : Colors.surface,
          borderColor: stage === "failed" ? Colors.medBorder : Colors.border,
          borderWidth: 1,
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 13,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}>
          {stage === "failed" ? (
            <Feather name="alert-triangle" size={15} color={Colors.med} />
          ) : (
            <ActivityIndicator size="small" color={Colors.accent} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: stage === "failed" ? Colors.med : Colors.text, fontFamily: Fonts.bodySemiBold, fontSize: 12 }}>
              {prepStageLabel(stage)}
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, marginTop: 2 }} numberOfLines={2}>
              {detail ?? prepStageDetail(stage)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function FlyingFormCard({
  card,
  progress,
  press,
  active,
  isSubmit,
}: {
  card: {
    index: number;
    icon: keyof typeof Feather.glyphMap;
    prompt: string;
    answer: string;
    hint: string;
  };
  progress: Animated.Value;
  press: Animated.Value;
  active: boolean;
  isSubmit: boolean;
}) {
  const translateY = progress.interpolate({
    inputRange: [card.index - 0.75, card.index, card.index + 0.75],
    outputRange: [104, 0, -104],
    extrapolate: "clamp",
  });

  const opacity = progress.interpolate({
    inputRange: [card.index - 0.9, card.index - 0.2, card.index, card.index + 0.32, card.index + 0.9],
    outputRange: [0, 0.42, 1, 0.58, 0],
    extrapolate: "clamp",
  });
  const scale = progress.interpolate({
    inputRange: [card.index - 0.75, card.index, card.index + 0.75],
    outputRange: [0.94, 1, 0.94],
    extrapolate: "clamp",
  });
  const submitScale = press.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });
  const displayIndex = card.index === 4 ? 0 : card.index;

  return (
    <Animated.View style={{
      position: "absolute",
      left: 0,
      right: 0,
      opacity,
      transform: [{ translateY }, { scale }],
    }}>
      <View style={{
        backgroundColor: Colors.card,
        borderColor: active ? Colors.accentBorder : Colors.borderMd,
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <Text style={{ color: active ? Colors.accent : Colors.muted, fontFamily: Fonts.mono, fontSize: 12 }}>
            {displayIndex + 1} →
          </Text>
          <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 15, flex: 1 }}>
            {card.prompt}
          </Text>
        </View>

        {isSubmit ? (
          <Animated.View style={{
            transform: [{ scale: submitScale }],
            backgroundColor: active ? Colors.accent : Colors.accentBg,
            borderColor: Colors.accentBorder,
            borderWidth: 1,
            borderRadius: 16,
            paddingVertical: 15,
            paddingHorizontal: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          }}>
            <Feather name="send" size={15} color={active ? Colors.bg : Colors.accent} />
            <Text style={{ color: active ? Colors.bg : Colors.accent, fontFamily: Fonts.bodySemiBold, fontSize: 14 }}>
              {card.answer}
            </Text>
          </Animated.View>
        ) : (
          <View style={{
            minHeight: 70,
            backgroundColor: active ? Colors.accentBg : Colors.surface,
            borderColor: active ? Colors.accentBorder : Colors.border,
            borderWidth: 1,
            borderRadius: 18,
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}>
            <View style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: Colors.bg,
              alignItems: "center",
              justifyContent: "center",
              borderColor: active ? Colors.accentBorder : Colors.border,
              borderWidth: 1,
            }}>
              <Feather name={card.icon} size={15} color={active ? Colors.accent : Colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: active ? Colors.accent : Colors.text, fontFamily: Fonts.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                {card.answer}
              </Text>
              <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                {card.hint}
              </Text>
            </View>
          </View>
        )}

        {isSubmit && (
          <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, lineHeight: 16, marginTop: 12, textAlign: "center" }}>
            {card.hint}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

function prepActiveIndex(stage: AutomationStage): number {
  if (stage === "selecting-slot") return 1;
  if (stage === "setting-duration" || stage === "slot-prepared") return 2;
  if (stage === "submitting-times" || stage === "handoff") return 3;
  return 0;
}

function prepStageLabel(stage: AutomationStage): string {
  switch (stage) {
    case "loading":
      return "Opening LibCal";
    case "preparing":
      return "Waiting for LibCal scripts";
    case "scanning-date-pages":
      return "Checking date and room pages";
    case "selecting-slot":
      return "Choosing the matching room slot";
    case "setting-duration":
      return "Setting the reservation length";
    case "slot-prepared":
      return "Slot prepared";
    case "submitting-times":
      return "Pressing Submit Times";
    case "handoff":
      return "Opening CPP SSO";
    case "ready-for-user":
      return "Ready for sign-in";
    case "failed":
      return "Manual completion needed";
    default:
      return "Preparing LibCal";
  }
}

function prepStageDetail(stage: AutomationStage): string {
  switch (stage) {
    case "scanning-date-pages":
      return "Trying the exact date, surrounding date windows, and all LibCal room pages.";
    case "selecting-slot":
      return "Using LibCal's slot checksum instead of clicking the visible grid only.";
    case "setting-duration":
      return "Updating the pending booking with LibCal's own end-time checksum.";
    case "submitting-times":
      return "The selected time is being handed to LibCal's SSO route.";
    case "handoff":
      return "CPP sign-in is loading. The WebView will appear next.";
    case "failed":
      return "The WebView will open so you can finish on LibCal.";
    default:
      return "Keep this screen open while BroncoPath prepares the LibCal form.";
  }
}

function prepStageCopy(stage: AutomationStage): string {
  switch (stage) {
    case "scanning-date-pages":
      return "BroncoPath is checking the selected room across LibCal's date window and room pages, not just the visible grid.";
    case "submitting-times":
    case "handoff":
      return "The slot is selected. BroncoPath is pressing LibCal's Submit Times button so CPP can take over sign-in.";
    case "failed":
      return "BroncoPath could not finish the handoff. The WebView will be shown so you can complete it manually.";
    default:
      return "The room, start time, and duration are being selected inside LibCal. You will see CPP SSO when it needs your login.";
  }
}


function FilterLabel({
  icon,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  children: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10, marginTop: 4 }}>
      <Feather name={icon} size={13} color={Colors.accent} />
      <Text style={{
        color: Colors.muted,
        fontFamily: Fonts.bodySemiBold,
        fontSize: 11,
        letterSpacing: 0.9,
        textTransform: "uppercase",
      }}>
        {children}
      </Text>
    </View>
  );
}

function HScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 4, marginBottom: 20 }}
    >
      {children}
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        backgroundColor: selected
          ? Colors.accentBg
          : pressed
          ? Colors.cardHover
          : Colors.card,
        borderColor: selected ? Colors.accentBorder : Colors.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      <Text style={{
        color: selected ? Colors.accent : Colors.text,
        fontFamily: selected ? Fonts.bodySemiBold : Fonts.body,
        fontSize: 12,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StepperBtn({
  icon,
  disabled,
  onPress,
}: {
  icon: "plus" | "minus";
  disabled: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={{
        paddingHorizontal: 18,
        paddingVertical: 14,
        backgroundColor: pressed ? Colors.cardHover : "transparent",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Feather name={icon} size={16} color={Colors.text} />
    </Pressable>
  );
}

function Toggle({
  label,
  icon,
  value,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        backgroundColor: value
          ? Colors.accentBg
          : pressed
          ? Colors.cardHover
          : Colors.card,
        borderColor: value ? Colors.accentBorder : Colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Feather
        name={icon}
        size={15}
        color={value ? Colors.accent : Colors.muted}
      />
      <Text style={{
        flex: 1,
        color: value ? Colors.accent : Colors.text,
        fontFamily: value ? Fonts.bodySemiBold : Fonts.body,
        fontSize: 13,
      }}>
        {label}
      </Text>
      <View style={{
        width: 28,
        height: 17,
        borderRadius: 9,
        backgroundColor: value ? Colors.accent : Colors.border,
        justifyContent: "center",
        paddingHorizontal: 2,
      }}>
        <View style={{
          width: 13,
          height: 13,
          borderRadius: 7,
          backgroundColor: Colors.bg,
          alignSelf: value ? "flex-end" : "flex-start",
        }} />
      </View>
    </Pressable>
  );
}

function SectionLabel({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Text style={[{
      color: Colors.muted,
      fontFamily: Fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 0.9,
      textTransform: "uppercase",
      marginBottom: 10,
    }, style]}>
      {children}
    </Text>
  );
}

function RoomCard({
  room,
  available,
  onBook,
}: {
  room: LibraryRoomResult;
  available: boolean;
  onBook: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const nextAvailable = slotKeyTo12h(room.nextAvailableStart);

  return (
    <View style={{
      backgroundColor: Colors.card,
      borderColor: available ? Colors.accentBorder : Colors.border,
      borderWidth: 1,
      borderRadius: 18,
      marginBottom: 10,
      overflow: "hidden",
    }}>
      <View style={{
        height: 3,
        backgroundColor: available ? Colors.accent : Colors.border,
      }} />

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontFamily: Fonts.bodySemiBold, fontSize: 15, marginBottom: 3 }}>
              {room.name}
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, marginBottom: 8 }} numberOfLines={1}>
              {room.grouping}
            </Text>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {room.floor && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="layers" size={11} color={Colors.muted} />
                  <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>
                    Floor {room.floor}
                  </Text>
                </View>
              )}
              {room.capacity > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="users" size={11} color={Colors.muted} />
                  <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>
                    Up to {room.capacity}
                  </Text>
                </View>
              )}
              {!available && nextAvailable && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="clock" size={11} color={Colors.med} />
                  <Text style={{ color: Colors.med, fontFamily: Fonts.body, fontSize: 11 }}>
                    Next {nextAvailable}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 99,
            backgroundColor: available ? Colors.accentBg : Colors.surface,
            borderColor: available ? Colors.accentBorder : Colors.border,
            borderWidth: 1,
          }}>
            <Text style={{
              color: available ? Colors.accent : Colors.muted,
              fontFamily: Fonts.bodySemiBold,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}>
              {available ? "Open" : "Taken"}
            </Text>
          </View>
        </View>

        {(room.hasPower || room.isADA) && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {room.hasPower && <AttributeBadge icon="zap" label="Power" color={Colors.med} />}
            {room.isADA && <AttributeBadge icon="check-circle" label="ADA" color={Colors.low} />}
          </View>
        )}

        <Pressable
          onPress={onBook}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={{
            backgroundColor: available
              ? pressed ? Colors.accentDim : Colors.accent
              : pressed ? Colors.cardHover : Colors.surface,
            borderRadius: 12,
            paddingVertical: 11,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 7,
            borderColor: available ? "transparent" : Colors.border,
            borderWidth: available ? 0 : 1,
          }}
        >
          <Feather
            name="external-link"
            size={14}
            color={available ? Colors.bg : Colors.muted}
          />
          <Text style={{
            color: available ? Colors.bg : Colors.muted,
            fontFamily: Fonts.bodySemiBold,
            fontSize: 13,
          }}>
            {available ? "Reserve via LibCal" : "Check on LibCal"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AttributeBadge({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: Colors.surface,
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderColor: Colors.border,
      borderWidth: 1,
    }}>
      <Feather name={icon} size={11} color={color} />
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        backgroundColor: pressed ? Colors.cardHover : Colors.accentBg,
        borderColor: Colors.accentBorder,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 24,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Feather name={icon} size={15} color={Colors.accent} />
      <Text style={{ color: Colors.accent, fontFamily: Fonts.bodySemiBold, fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}
