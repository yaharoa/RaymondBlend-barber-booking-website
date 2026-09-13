"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const tl = (t: string) => {
  let [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${
    h >= 12 ? "PM" : "AM"
  }`;
};

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

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Could not send verification code."
      );
    } finally {
      setBusy(false);
    }
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
              onChange={(e) =>
                setF({
                  ...f,
                  [k]: e.target.value,
                })
              }
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
    </form>
  );
}
