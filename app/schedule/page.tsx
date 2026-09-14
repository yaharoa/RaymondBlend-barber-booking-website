"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

// Uses the public anon key — safe to expose client-side. Access to the
// actual booking data is gated by the PIN check inside get_daily_schedule,
// not by this key. If your project already has a shared Supabase client
// (e.g. lib/supabase.ts), feel free to import that instead of creating
// a new one here.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PIN_STORAGE_KEY = "barber_schedule_pin";

type Booking = {
  id: string;
  booking_date: string;
  start_time: string;
  customer_name: string;
  phone: string;
  email: string;
  service: string;
};

const formatTime = (t: string) => {
  const [hStr, m] = t.split(":");
  const h = Number(hStr);
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

const shiftDate = (dateStr: string, delta: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(dt.getDate()).padStart(2, "0")}`;
};

const formatDateHeading = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const label = dt.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (dateStr === todayStr()) return `Today · ${label}`;
  if (dateStr === shiftDate(todayStr(), 1)) return `Tomorrow · ${label}`;
  if (dateStr === shiftDate(todayStr(), -1)) return `Yesterday · ${label}`;
  return label;
};

export default function SchedulePage() {
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [date, setDate] = useState(todayStr());
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadSchedule(forDate: string, forPin: string) {
    setBusy(true);
    setErr("");

    const { data, error } = await supabase.rpc("get_daily_schedule", {
      p_date: forDate,
      p_pin: forPin,
    });

    setBusy(false);

    if (error) {
      if (error.message?.includes("invalid_pin")) {
        setErr("That PIN doesn't look right.");
        setUnlocked(false);
        localStorage.removeItem(PIN_STORAGE_KEY);
      } else {
        setErr("Couldn't load the schedule. Try again.");
      }
      return false;
    }

    setBookings(data as Booking[]);
    setUnlocked(true);
    return true;
  }

  // On first load, try a saved PIN so returning each morning doesn't
  // require retyping it.
  useEffect(() => {
    const saved = localStorage.getItem(PIN_STORAGE_KEY);
    if (saved) {
      setPin(saved);
      loadSchedule(todayStr(), saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch whenever the viewed date changes, once unlocked.
  useEffect(() => {
    if (unlocked && pin) {
      loadSchedule(date, pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleUnlock() {
    const ok = await loadSchedule(date, pinInput);
    if (ok) {
      localStorage.setItem(PIN_STORAGE_KEY, pinInput);
      setPin(pinInput);
    }
  }

  async function cancelBooking(id: string) {
    setCancellingId(id);
    setErr("");

    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: id,
      p_pin: pin,
    });

    setCancellingId(null);
    setConfirmingId(null);

    if (error) {
      if (error.message?.includes("invalid_pin")) {
        setErr("That PIN doesn't look right.");
        setUnlocked(false);
        localStorage.removeItem(PIN_STORAGE_KEY);
      } else {
        setErr("Couldn't cancel that booking. Try again.");
      }
      return;
    }

    setBookings((prev) => (prev ? prev.filter((b) => b.id !== id) : prev));
  }

  function handleForget() {
    localStorage.removeItem(PIN_STORAGE_KEY);
    setPin("");
    setPinInput("");
    setUnlocked(false);
    setBookings(null);
  }

  if (!unlocked) {
    return (
      <main>
        <nav className="nav darknav">
          <Link href="/">
            <b>RAYMOND BLEND</b>
          </Link>
          <Link href="/">← Home</Link>
        </nav>

        <section className="shell">
          <div className="card gate">
            <small className="eyebrow">Barber view</small>
            <h1>Today&apos;s schedule.</h1>
            <p className="sub">Enter your PIN to see the day&apos;s bookings.</p>

            <div className="fields">
              <label>
                PIN
                <input
                  inputMode="numeric"
                  type="password"
                  placeholder="Enter your PIN"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                />
              </label>
            </div>

            <button
              type="button"
              className="btn dark full"
              disabled={busy || !pinInput}
              onClick={handleUnlock}
            >
              {busy ? "Checking…" : "Unlock"}
            </button>

            {err && <div className="error">{err}</div>}
          </div>
        </section>

        <style jsx>{`
          .eyebrow {
            text-transform: uppercase;
            letter-spacing: 0.06em;
            font-weight: 700;
            color: var(--muted);
          }

          .sub {
            color: var(--muted);
          }

          .gate h1 {
            margin: 4px 0 8px;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main>
      <nav className="nav darknav">
        <Link href="/">
          <b>RAYMOND BLEND</b>
        </Link>
        <Link href="/">← Home</Link>
      </nav>

      <section className="shell">
      <div className="card">
      <div className="sched-header">
        <button
          type="button"
          className="nav-btn"
          onClick={() => setDate((d) => shiftDate(d, -1))}
          aria-label="Previous day"
        >
          ←
        </button>

        <div className="sched-title">
          <small className="eyebrow">Schedule</small>
          <h2>{formatDateHeading(date)}</h2>
        </div>

        <button
          type="button"
          className="nav-btn"
          onClick={() => setDate((d) => shiftDate(d, 1))}
          aria-label="Next day"
        >
          →
        </button>
      </div>

      {date !== todayStr() && (
        <button
          type="button"
          className="today-link"
          onClick={() => setDate(todayStr())}
        >
          Jump to today
        </button>
      )}

      {busy && <p className="sub">Loading…</p>}

      {!busy && bookings && bookings.length === 0 && (
        <p className="empty">No bookings for this day.</p>
      )}

      {!busy && bookings && bookings.length > 0 && (
        <ul className="bookings">
          {bookings.map((b) => (
            <li key={b.id} className="booking">
              <div className="booking-time">{formatTime(b.start_time)}</div>
              <div className="booking-details">
                <b>{b.customer_name}</b>
                <span>{b.service}</span>
                <a href={`tel:${b.phone}`}>{b.phone}</a>
                <a href={`mailto:${b.email}`}>{b.email}</a>
              </div>

              <div className="booking-actions">
                {confirmingId === b.id ? (
                  <div className="confirm-row">
                    <span>Cancel this booking?</span>
                    <button
                      type="button"
                      className="confirm-yes"
                      disabled={cancellingId === b.id}
                      onClick={() => cancelBooking(b.id)}
                    >
                      {cancellingId === b.id ? "Cancelling…" : "Yes, cancel"}
                    </button>
                    <button
                      type="button"
                      className="confirm-no"
                      disabled={cancellingId === b.id}
                      onClick={() => setConfirmingId(null)}
                    >
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setConfirmingId(b.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {err && <div className="error">{err}</div>}

      <button type="button" className="forget-link" onClick={handleForget}>
        Lock schedule
      </button>

      <style jsx>{`
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
          color: var(--muted);
        }

        .sub {
          color: var(--muted);
        }

        .sched-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 4px;
        }

        .sched-title {
          text-align: center;
          flex: 1;
        }

        .sched-title h2 {
          margin: 2px 0 0;
          font-size: 22px;
        }

        .nav-btn {
          background: none;
          border: 1px solid var(--line);
          color: var(--ink);
          border-radius: 8px;
          width: 40px;
          height: 40px;
          font-size: 18px;
          cursor: pointer;
        }

        .today-link {
          display: block;
          margin: 4px auto 20px;
          background: none;
          border: none;
          color: var(--ink);
          font-size: 13px;
          font-weight: 600;
          text-decoration: underline;
          cursor: pointer;
        }

        .empty {
          color: var(--muted);
          padding: 24px 0;
          text-align: center;
        }

        .bookings {
          list-style: none;
          margin: 16px 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .booking {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 14px 16px;
          flex-wrap: wrap;
        }

        .booking-time {
          font-weight: 700;
          min-width: 76px;
        }

        .booking-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 160px;
        }

        .booking-details a {
          color: var(--ink);
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .booking-actions {
          margin-left: auto;
        }

        .cancel-btn {
          background: none;
          border: 1px solid #d8433c;
          color: #d8433c;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .confirm-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .confirm-yes {
          background: #d8433c;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .confirm-no {
          background: none;
          border: 1px solid var(--line);
          color: var(--ink);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
        }

        .confirm-yes:disabled,
        .confirm-no:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .forget-link {
          display: block;
          margin: 24px auto 0;
          background: none;
          border: none;
          color: var(--muted);
          font-size: 13px;
          cursor: pointer;
        }
      `}</style>
      </div>
      </section>
    </main>
  );
}
