// lib/server/mail.ts — server-only OTP delivery (Gmail SMTP or Resend).
import nodemailer from "nodemailer"

const SMTP_USER = process.env.SMTP_USER || ""
const SMTP_PASS = process.env.SMTP_PASS || ""
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER
const KEY = process.env.RESEND_API_KEY || ""
const RESEND_FROM = process.env.RESEND_FROM || "onboarding@resend.dev"

export const mailConfigured = () => !!KEY || !!(SMTP_USER && SMTP_PASS)

function content(code: string) {
  return {
    subject: "Your AniVerse login code",
    text: `Your AniVerse login code is ${code}. It expires in 5 minutes. If you didn't ask for this, ignore this email.`,
    html: `<div style="font-family:system-ui;background:#12141b;color:#fff;padding:28px;border-radius:16px"><h2>AniVerse login code</h2><p style="font-size:28px;letter-spacing:8px;font-weight:700;color:#ff8a00">${code}</p><p>Expires in 5 minutes. If you didn't request it, ignore this email.</p></div>`,
  }
}

export async function sendOtp(email: string, code: string) {
  const body = content(code)
  // Gmail SMTP works with any recipient; Resend's sandbox sender is restricted
  // to the address verified on its account.
  if (SMTP_USER && SMTP_PASS) {
    const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_PASS } })
    try {
      await transport.sendMail({ from: SMTP_FROM, to: email, ...body })
    } catch {
      throw new Error("Could not send the login code. Check the mail credentials.")
    }
    return
  }
  if (!KEY) throw new Error("Email delivery is not configured (set SMTP_USER/SMTP_PASS or RESEND_API_KEY).")
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [email], ...body }),
  })
  if (!res.ok) throw new Error("Could not send the login code. Check the mail sender.")
}
