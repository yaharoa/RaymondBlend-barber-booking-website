"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const tl = (t: string) => {
  let [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${
    h >= 12 ? "PM" : "AM"
  }`;
};

const RESEND_COOLDOWN = 30;

export default function Details({
  date,
  time,
}: {
  date: string;
  time: string;
}) {
  const r = useRouter();

  const [f, setF] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [justResent, setJustResent] = useState(false);

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Tick the resend cooldown down once a second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setErr("");

    try {
      const q = await fetch("/api/email-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send",
          email: f.email,
        }),
      });

      const j = await q.json();

      if (!q.ok) throw Error(j.error);

      setCodeSent(true);
      setCooldown(RESEND_COOLDOWN);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Could not send verification code."
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setCode("");
    setJustResent(false);
    await sendCode();
    setJustResent(true);
  }

  async function verifyCode() {
    setBusy(true);
    setErr("");

    try {
      const q = await fetch("/api/email-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify",
          email: f.email,
          code,
        }),
      });

      const j = await q.json();

      if (!q.ok) throw Error(j.error);

      setVerificationToken(j.verificationToken);
      setVerified(true);
      setErr("");
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Verification failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    if (!verified || !verificationToken) {
      setErr("Please verify your email before confirming your booking.");
      return;
    }

    setBusy(true);
    setErr("");

    try {
      const q = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date,
          time,
          ...f,
          verificationToken,
        }),
      });

      const j = await q.json();

      if (!q.ok) throw Error(j.error);

      r.push(`/confirmation?id=${j.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Booking failed.");
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="summary">
        <div>
          <small>DATE</small>
          <b>{date}</b>
        </div>

        <div>
          <small>TIME</small>
          <b>{tl(time)}</b>
        </div>

        <div>
          <small>SERVICE</small>
          <b>Haircut · 30 min</b>
        </div>
      </div>

      <div className="fields">
        {(
          [
            ["name", "Full name", "Your name"],
            ["phone", "Phone number", "09XX XXX XXXX"],
            ["email", "Email", "you@example.com"],
          ] as const
        ).map(([k, l, ph]) => (
          <label key={k}>
            {l}

            <input
              required
              type={
                k === "email"
                  ? "email"
                  : k === "phone"
                  ? "tel"
                  : "text"
              }
              value={f[k]}
              placeholder={ph}
              disabled={verified}
              onChange={(e) => {
                setF({
                  ...f,
                  [k]: e.target.value,
                });
                // Editing the email after a code was sent invalidates
                // that code — make the person send a fresh one.
                if (k === "email" && codeSent) {
                  setCodeSent(false);
                  setCode("");
                  setCooldown(0);
                  setErr("");
                }
              }}
            />
          </label>
        ))}
      </div>

      {!verified && (
        <>
          {!codeSent ? (
            <button
              type="button"
              className="btn dark full"
              disabled={busy || !f.email}
              onClick={sendCode}
            >
              {busy ? "Sending code…" : "Verify Email →"}
            </button>
          ) : (
            <>
              <div className="fields">
                <label>
                  Verification code
                  <input
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, ""))
                    }
                  />
                </label>
              </div>

              <div className="resend-row">
                <span className="resend-hint">
                  {justResent && cooldown > 0
                    ? "New code sent."
                    : "Didn't get it, or used the wrong email?"}
                </span>

                <button
                  type="button"
                  className="resend-btn"
                  disabled={busy || cooldown > 0}
                  onClick={resendCode}
                >
                  {cooldown > 0
                    ? `Resend code in ${cooldown}s`
                    : "Resend code"}
                </button>
              </div>

              <button
                type="button"
                className="btn dark full"
                disabled={busy || code.length !== 6}
                onClick={verifyCode}
              >
                {busy ? "Verifying…" : "Verify Email"}
              </button>
            </>
          )}
        </>
      )}

      {verified && (
        <>
          <div className="success">
            ✓ Email verified successfully
          </div>

          <button
            type="submit"
            className="btn dark full"
            disabled={busy}
          >
            {busy ? "Confirming…" : "Confirm Booking →"}
          </button>
        </>
      )}

      {err && <div className="error">{err}</div>}

      <style jsx>{`
        .resend-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 8px 0 16px;
          flex-wrap: wrap;
        }

        .resend-hint {
          font-size: 13px;
          color: var(--muted);
        }

        .resend-btn {
          background: none;
          border: none;
          padding: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer;
          white-space: nowrap;
        }

        .resend-btn:disabled {
          color: #6f6b63;
          text-decoration: none;
          cursor: default;
        }
      `}</style>
    </form>
  );
}
