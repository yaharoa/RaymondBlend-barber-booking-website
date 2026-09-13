import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      name,
      email,
      date,
      time,
    } = body;

    if (!name || !email || !date || !time) {
      return Response.json(
        { error: "Missing booking information" },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: "Barber Shop <onboarding@resend.dev>",
      to: [email],
      subject: "Your barber appointment is confirmed",
      html: `
        <h1>Appointment Confirmed!</h1>

        <p>Hi ${name},</p>

        <p>Your barber appointment has been confirmed.</p>

        <p>
          <strong>Date:</strong> ${date}<br />
          <strong>Time:</strong> ${time}
        </p>

        <p>We look forward to seeing you!</p>
      `,
    });

    if (error) {
      console.error(error);

      return Response.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
