import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/supabase";
import { SHOP_TIMEZONE } from "../../../lib/config";

const REASONS = new Map([
  ["schedule changes", "Schedule changes"],
  ["personal emergencies", "Personal emergencies"],
  ["booked the wrong date", "Booked the wrong date"],
]);

function normalizeReason(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
}

function toShopDateTime(date: string, time: string) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  let guess = new Date(Date.UTC(y, mo - 1, d, h, mi));

  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: SHOP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(guess);

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const local = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute)
    );

    guess = new Date(
      guess.getTime() + (Date.UTC(y, mo - 1, d, h, mi) - local)
    );
  }

  return guess;
}

export async function POST(req: NextRequest) {
  try {
    const { id, reason } = await req.json();
    const normalizedReason = normalizeReason(reason);

    // Accept the exact values sent by the UI, while also tolerating harmless
    // capitalization/trailing punctuation differences.
    if (!id || !REASONS.has(normalizedReason)) {
      return NextResponse.json(
        { error: "Please choose a valid cancellation reason." },
        { status: 400 }
      );
    }

    const database = db();
    const { data: booking, error: findError } = await database
      .from("bookings")
      .select("id,booking_date,start_time,customer_name,email")
      .eq("id", id)
      .single();

    if (findError || !booking) {
      return NextResponse.json(
        { error: "That booking could not be found. It may already have been cancelled." },
        { status: 404 }
      );
    }

    const start = toShopDateTime(
      booking.booking_date,
      String(booking.start_time).slice(0, 5)
    );
    const hoursUntilBooking = start.getTime() - Date.now();

    // The booking is cancellable only when it is at least 24 hours away.
    // This check is server-side so it cannot be bypassed by the customer UI.
    if (hoursUntilBooking < 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        {
          error:
            "Late cancellations are restricted because the booking time is too close",
        },
        { status: 400 }
      );
    }

    const { error: deleteError } = await database
      .from("bookings")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      date: booking.booking_date,
      time: String(booking.start_time).slice(0, 5),
      customerName: booking.customer_name,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
