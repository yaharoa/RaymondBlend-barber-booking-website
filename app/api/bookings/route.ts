import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "../../../lib/supabase";
import { slots, today, minDate, maxDate } from "../../../lib/slots";

const validDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= minDate() && d <= maxDate();

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date") || "";
    const month = req.nextUrl.searchParams.get("month") || "";

    // Calendar view: return availability for every date in the requested month.
    // Dates outside the booking window are returned as unavailable so they can
    // remain visible but disabled on the calendar.
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: "Invalid month." }, { status: 400 });
      }

      const [year, monthNumber] = month.split("-").map(Number);
      const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      const firstDate = `${month}-01`;
      const lastDate = `${month}-${String(daysInMonth).padStart(2, "0")}`;

      const { data, error } = await db()
        .from("bookings")
        .select("booking_date,start_time")
        .gte("booking_date", firstDate)
        .lte("booking_date", lastDate);

      if (error) throw error;

      const allSlots = slots();
      const bookedByDate = new Map<string, Set<string>>();

      for (const booking of data || []) {
        const bookingDate = String(booking.booking_date);
        if (!bookedByDate.has(bookingDate)) {
          bookedByDate.set(bookingDate, new Set());
        }
        bookedByDate.get(bookingDate)!.add(
          String(booking.start_time).slice(0, 8)
        );
      }

      const availability: Record<string, boolean> = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const current = `${month}-${String(day).padStart(2, "0")}`;
        const inBookingWindow =
          current >= minDate() && current <= maxDate();
        const booked = bookedByDate.get(current) || new Set<string>();

        availability[current] =
          inBookingWindow && allSlots.some((slot) => !booked.has(slot));
      }

      return NextResponse.json({ availability });
    }

    if (!validDate(date)) {
      return NextResponse.json(
        { error: "Date is outside the booking window." },
        { status: 400 }
      );
    }

    const { data, error } = await db()
      .from("bookings")
      .select("start_time")
      .eq("booking_date", date);

    if (error) throw error;

    const booked = new Set(
      (data || []).map((x) => String(x.start_time).slice(0, 8))
    );

    return NextResponse.json({
      availableSlots: slots().filter((x) => !booked.has(x)),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load availability." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, time, name, phone, email } = await req.json();

    if (!validDate(date) || !slots().includes(time))
      return NextResponse.json(
        { error: "Please choose a valid date and time." },
        { status: 400 }
      );

    if (!name?.trim() || !phone?.trim() || !email?.trim())
      return NextResponse.json(
        { error: "Please complete all fields." },
        { status: 400 }
      );

    const { data, error } = await db()
      .from("bookings")
      .insert({
        booking_date: date,
        start_time: time,
        customer_name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        service: "Haircut",
      })
      .select("id,booking_date,start_time,customer_name,email")
      .single();

    if (error) {
      if (error.code === "23505")
        return NextResponse.json(
          { error: "Sorry, that slot was just booked. Please choose another time." },
          { status: 409 }
        );
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: "The booking could not be created." },
        { status: 500 }
      );
    }

    if (process.env.RESEND_API_KEY && process.env.BOOKING_FROM_EMAIL) {
      const t = new Date(`1970-01-01T${time}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.BOOKING_FROM_EMAIL,
        to: [data.email],
        subject: "Your barber appointment is confirmed",
        html: `<h1>Appointment confirmed</h1><p>Hi ${esc(
          data.customer_name
        )}, your haircut is booked.</p><p><b>Date:</b> ${
          data.booking_date
        }<br><b>Time:</b> ${t}<br><b>Service:</b> Haircut · 30 min</p>`,
      });
    }

    return NextResponse.json({ id: data.id });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
