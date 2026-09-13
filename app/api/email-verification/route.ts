import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { db } from "../../../lib/supabase";

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { action, email, code } = await req.json();

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (action === "send") {
      const verificationCode = String(
        crypto.randomInt(100000, 1000000)
      );

      const verificationToken = crypto.randomBytes(32).toString("hex");

      const codeHash = hashCode(verificationCode);

      const expiresAt = new Date(
        Date.now() + 10 * 60 * 1000
      ).toISOString();

      const { error } = await db()
        .from("email_verifications")
        .insert({
          email: cleanEmail,
          code_hash: codeHash,
          verification_token: verificationToken,
          expires_at: expiresAt,
        });

      if (error) throw error;

      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        return NextResponse.json(
          { error: "Email service is not configured." },
          { status: 500 }
        );
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: cleanEmail,
        subject: "Verify your email for your barber appointment",
        text: `Your verification code is ${verificationCode}.

This code expires in 10 minutes.

If you did not request this code, you can ignore this email.`,
        html: `
          <h2>Verify your email</h2>

          <p>Use the verification code below to continue booking your appointment:</p>

          <h1 style="letter-spacing: 6px;">${verificationCode}</h1>

          <p>This code expires in 10 minutes.</p>

          <p>If you did not request this code, you can ignore this email.</p>
        `,
      });

      return NextResponse.json({
        success: true,
        message: "Verification code sent.",
      });
    }

    if (action === "verify") {
      if (!code || !/^\d{6}$/.test(String(code))) {
        return NextResponse.json(
          { error: "Please enter the 6-digit verification code." },
          { status: 400 }
        );
      }

      const { data, error } = await db()
        .from("email_verifications")
        .select("*")
        .eq("email", cleanEmail)
        .is("verified_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return NextResponse.json(
          {
            error:
              "That verification code has expired. Please request a new one.",
          },
          { status: 400 }
        );
      }

      if (hashCode(String(code)) !== data.code_hash) {
        return NextResponse.json(
          { error: "Incorrect verification code." },
          { status: 400 }
        );
      }

      const { error: updateError } = await db()
        .from("email_verifications")
        .update({
          verified_at: new Date().toISOString(),
        })
        .eq("id", data.id);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        verificationToken: data.verification_token,
      });
    }

    return NextResponse.json(
      { error: "Invalid verification action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Email verification error:", error);

    return NextResponse.json(
      { error: "Could not process email verification." },
      { status: 500 }
    );
  }
}
