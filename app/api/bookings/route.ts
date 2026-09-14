import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "../../../lib/supabase";
import { slots, minDate, maxDate } from "../../../lib/slots";

const validDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= minDate() && d <= maxDate();

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date") || "";
    const month = req.nextUrl.searchParams.get("month") || "";

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json(
          { error: "Invalid month." },
          { status: 400 }
        );
      }

      const [year, monthNumber] = month.split("-").map(Number);

      const daysInMonth = new Date(
        Date.UTC(year, monthNumber, 0)
      ).getUTCDate();

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

        bookedByDate
          .get(bookingDate)!
          .add(String(booking.start_time).slice(0, 8));
      }

      const availability: Record<string, boolean> = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const current = `${month}-${String(day).padStart(2, "0")}`;

        const inBookingWindow =
          current >= minDate() && current <= maxDate();

        const booked = bookedByDate.get(current) || new Set<string>();

        availability[current] =
          inBookingWindow &&
          allSlots.some((slot) => !booked.has(slot));
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
    const {
      date,
      time,
      name,
      phone,
      email,
      verificationToken,
    } = await req.json();

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

    if (!verificationToken) {
      return NextResponse.json(
        {
          error:
            "Please verify your email before confirming your booking.",
        },
        { status: 400 }
      );
    }

    const customerEmail = email.trim().toLowerCase();

    // Check that the email was actually verified.
    const { data: verification, error: verificationError } = await db()
      .from("email_verifications")
      .select("id,email,verified_at,used_at,expires_at")
      .eq("verification_token", verificationToken)
      .eq("email", customerEmail)
      .maybeSingle();

    if (verificationError) {
      throw verificationError;
    }

    if (!verification) {
      return NextResponse.json(
        {
          error:
            "Email verification was not found. Please verify your email again.",
        },
        { status: 400 }
      );
    }

    if (!verification.verified_at) {
      return NextResponse.json(
        {
          error:
            "Please verify your email before confirming your booking.",
        },
        { status: 400 }
      );
    }

    if (verification.used_at) {
      return NextResponse.json(
        {
          error:
            "This email verification has already been used. Please verify your email again.",
        },
        { status: 400 }
      );
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        {
          error:
            "Your email verification has expired. Please verify your email again.",
        },
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
        email: customerEmail,
        service: "Haircut",
      })
      .select("id,booking_date,start_time,customer_name,email")
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

    if (!data) {
      return NextResponse.json(
        { error: "The booking could not be created." },
        { status: 500 }
      );
    }

    // Mark the verification as used so it cannot be reused.
    const { error: usedError } = await db()
      .from("email_verifications")
      .update({
        used_at: new Date().toISOString(),
      })
      .eq("id", verification.id);

    if (usedError) {
      console.error("Could not mark verification as used:", usedError);
    }

    // Send confirmation email through Gmail.
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      const t = new Date(`1970-01-01T${time}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      const cancelUrl = `${req.nextUrl.origin}/cancellation?id=${data.id}`;

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: data.email,
        subject: "Your barber appointment is confirmed",

        text: `Hi ${data.customer_name},

Your haircut is confirmed.

Date: ${data.booking_date}
Time: ${t}
Service: Haircut · 30 min

Please present this email at the shop as proof of your booking.

Need to cancel? You can cancel up to 24 hours before your appointment here:
${cancelUrl}

Thank you for booking with us!`,

        html: `
          <h1>Appointment confirmed</h1>

          <p>Hi ${esc(data.customer_name)},</p>

          <p>Your haircut is confirmed.</p>

          <p>
            <b>Date:</b> ${data.booking_date}<br>
            <b>Time:</b> ${t}<br>
            <b>Service:</b> Haircut · 30 min
          </p>

          <p>
            Please present this email at the shop as proof of your booking.
          </p>

          <p>
            Plans changed? <a href="${cancelUrl}">Click here if you want to cancel</a>
            your appointment. Cancellations must be made at least 24 hours in advance.
          </p>

          <p>Thank you for booking with us!</p>
        `,
      });
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("Booking error:", error);

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
