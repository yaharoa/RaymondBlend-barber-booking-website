import Link from "next/link";
import { db } from "../../lib/supabase";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  let b: any = null;

  if (id) {
    try {
      const x = await db()
        .from("bookings")
        .select("booking_date,start_time,customer_name,service")
        .eq("id", id)
        .single();
      b = x.data;
    } catch {}
  }

  const t = b
    ? new Date(`1970-01-01T${b.start_time}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <main className="confirm">
      <div className="confirmBox">
        <div className="check">✓</div>
        <small>BOOKING CONFIRMED</small>
        <h1>You&apos;re in the chair.</h1>

        {b ? (
          <>
            <p>
              Thanks, {b.customer_name}. A confirmation has been sent to your
              email.
            </p>
            <div className="summary">
              <div>
                <small>DATE</small>
                <b>{b.booking_date}</b>
              </div>
              <div>
                <small>TIME</small>
                <b>{t}</b>
              </div>
              <div>
                <small>SERVICE</small>
                <b>{b.service}</b>
              </div>
            </div>
            <div className="cancelPolicy">
              <b>Cancellation policy</b>
              <p>
                You can cancel this appointment no more than 24 hours before
                your booking.
              </p>
            </div>
          </>
        ) : (
          <p>
            Your booking was received. Check your email for the appointment
            details.
          </p>
        )}

        <div className="confirmActions">
          <Link className="btn dark" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
