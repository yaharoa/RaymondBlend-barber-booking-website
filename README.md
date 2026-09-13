# Barber Booking — Vercel-ready

## Stack
Next.js + Supabase Postgres + Resend. The site includes the two haircut photos supplied with the project.

## Setup
1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase.sql`.
3. Copy `.env.example` to `.env.local` and add your Supabase + Resend keys.
4. `npm install && npm run dev`
5. Push to GitHub, import into Vercel, and add the same environment variables in Vercel.

## Booking rules
- Default window: 30 days. Change `BOOKING_WINDOW_DAYS` to 45, 60, etc.
- 9:00 AM through 4:30 PM start times.
- Every appointment is 30 minutes and ends by 5:00 PM.
- Supabase has a unique `(booking_date, start_time)` constraint, so simultaneous customers cannot book the same slot.
- `SHOP_TIMEZONE` defaults to `Asia/Manila`; change it if the shop is elsewhere.

## Email
Set `RESEND_API_KEY` and `BOOKING_FROM_EMAIL`. For production, verify your sending domain in Resend.

## Customize
Change the shop name, prices, opening hours, colors, and photos in the project files. The supplied images are `public/cuts/cut-1.png` and `public/cuts/cut-2.png`.

Never expose `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_` variable.
