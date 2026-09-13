import {
  BOOKING_WINDOW_DAYS,
  CLOSE_HOUR,
  OPEN_HOUR,
  SLOT_MINUTES,
} from "./config";

export function slots() {
  const result: string[] = [];

  for (
    let minutes = OPEN_HOUR * 60;
    minutes < CLOSE_HOUR * 60;
    minutes += SLOT_MINUTES
  ) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;

    result.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
    );
  }

  return result;
}

export function today() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.SHOP_TIMEZONE || "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Same-day booking is NOT allowed.
export function minDate() {
  return addDays(today(), 1);
}

// 30-day booking window.
// Example: if today is Sept 13, bookings can start Sept 14.
export function maxDate() {
  return addDays(today(), BOOKING_WINDOW_DAYS);
}
