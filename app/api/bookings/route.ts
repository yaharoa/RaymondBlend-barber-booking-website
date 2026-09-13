import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "../../../lib/supabase";
import { slots, minDate, maxDate } from "../../../lib/slots";

const validDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  d >= minDate() &&
  d <= maxDate();

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date") || "";

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

    if (error) {
      throw error;
    }

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

    if (!validDate(date) || !slots().includes(time)) {
      return NextResponse.json(
        { error: "Please choose a valid date and time." },
        { status: 400 }
      );
    }

    if (!name?.trim() || !phone?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Please complete all fields." },
        { status: 400 }
      );
    }

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
      .select(
        "id,booking_date,start_time,customer_name,email"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Sorry, that slot was just booked. Please choose another time.",
          },
          { status: 409 }
        );
      }

      throw error;
    }

    // Supabase can return null data even when TypeScript
    // cannot guarantee that a row was returned.
    if (!data) {
      return NextResponse.json(
        { error: "The booking could not be created." },
        { status: 500 }
      );
    }

    if (
      process.env.RESEND_API_KEY &&
      process.env.BOOKING_FROM_EMAIL
    ) {
      const t = new Date(
        `1970-01-01T${time}`
      ).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      await new Resend(
        process.env.RESEND_API_KEY
      ).emails.send({
        from: process.env.BOOKING_FROM_EMAIL,
        to: [data.email],
        subject: "Your barber appointment is confirmed",
        html: `
          <h1>Appointment confirmed</h1>

          <p>
            Hi ${esc(data.customer_name)}, your haircut is booked.
          </p>

          <p>
            <b>Date:</b> ${data.booking_date}<br>
            <b>Time:</b> ${t}<br>
            <b>Service:</b> Haircut · 30 min
          </p>
        `,
      });
    }

    return NextResponse.json({
      id: data.id,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Something went wrong. Please try again.",
      },
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
```
