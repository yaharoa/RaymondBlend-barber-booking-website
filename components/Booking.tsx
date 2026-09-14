"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const iso = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const label = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${
    h >= 12 ? "PM" : "AM"
  }`;
};

export default function Booking() {
  const r = useRouter();
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<Record<string, boolean>>(
    {}
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Which month is currently being browsed. Defaults to the current month,
  // but the person can page forward (or back, down to the current month)
  // to preview later dates — the 30-day booking window is still enforced
  // by the availability data itself, so far-future dates just show faded.
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;

    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }

    setViewYear(y);
    setViewMonth(m);
  }

  // Show the complete viewed month, without spilling dates from adjacent months.
  const dates = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, i) => {
      return new Date(viewYear, viewMonth, i + 1);
    });
  }, [viewYear, viewMonth]);

  const firstWeekday = dates[0]?.getDay() ?? 0;

  useEffect(() => {
    const month = iso(dates[0]);
    const loadAvailability = async () => {
      try {
        setErr("");
        const response = await fetch(`/api/bookings?month=${month.slice(0, 7)}`);
        const data = await response.json();

        if (!response.ok) throw Error(data.error);

        setAvailability(data.availability || {});
      } catch (e) {
        setErr(
          e instanceof Error
            ? e.message
            : "Could not load calendar availability."
        );
      }
    };

    loadAvailability();
  }, [dates]);

  async function pick(x: string) {
    if (!availability[x]) return;

    setDate(x);
    setTime("");
    setLoading(true);
    setErr("");

    try {
      const q = await fetch(`/api/bookings?date=${x}`);
      const j = await q.json();
      if (!q.ok) throw Error(j.error);
      setTimes(j.availableSlots);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load times");
    } finally {
      setLoading(false);
    }
  }

  const monthLabel = dates[0]?.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="card">
      <div className="step">
        <b>01</b>
        <div>
          <h2>Choose a date</h2>
          <p>Bookable up to 30 days out · unavailable dates are faded.</p>
        </div>
      </div>

      <div className="calendar">
        <div className="calendarNav">
          <button
            type="button"
            disabled={isCurrentMonth}
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            ←
          </button>

          <strong>{monthLabel}</strong>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="calendarWeekdays" aria-hidden="true">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <small key={day}>{day}</small>
          ))}
        </div>

        <div className="dates">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div className="datePlaceholder" key={`empty-${i}`} />
          ))}

          {dates.map((d) => {
            const x = iso(d);
            const available = availability[x] === true;
            const selected = x === date;

            return (
              <button
                className={[
                  selected ? "active" : "",
                  !available ? "unavailable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={x}
                disabled={!available}
                aria-label={`${d.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}${available ? "" : " — unavailable"}`}
                onClick={() => pick(x)}
              >
                <small>{d.toLocaleDateString("en-US", { weekday: "short" })}</small>
                <strong>{d.getDate()}</strong>
                <small>{d.toLocaleDateString("en-US", { month: "short" })}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="step">
        <b>02</b>
        <div>
          <h2>Choose a time</h2>
          <p>30-minute appointments. Booked times disappear automatically.</p>
        </div>
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : date ? (
        <div className="times">
          {times.map((t) => (
            <button
              key={t}
              className={t === time ? "active" : ""}
              onClick={() => setTime(t)}
            >
              {label(t)}
            </button>
          ))}
          {!times.length && (
            <div className="empty">No times are available.</div>
          )}
        </div>
      ) : (
        <div className="empty">Select a date to see available times.</div>
      )}

      {err && <div className="error">{err}</div>}

      <button
        className="btn dark full"
        disabled={!date || !time}
        onClick={() =>
          r.push(`/booking/details?date=${date}&time=${time}`)
        }
      >
        Continue →
      </button>
    </div>
  );
}
