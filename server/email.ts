/**
 * Lightweight transactional email helper.
 *
 * Uses Resend when RESEND_API_KEY is set; otherwise logs the message so local
 * and free-tier deploys can finish auth flows without SMTP.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult = { sent: boolean; mode: "resend" | "log" };

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "Sadhana <onboarding@resend.dev>";
}

export function appBaseUrl(): string {
  return (
    process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.NODE_ENV === "production"
      ? "https://sadhana-ou9m.onrender.com"
      : "http://localhost:5000")
  );
}

export async function sendAppEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info(`[email] to=${input.to} subject=${JSON.stringify(input.subject)}\n${input.text}`);
    return { sent: false, mode: "log" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html ?? input.text.replace(/\n/g, "<br/>"),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend failed ${res.status}: ${body.slice(0, 300)}`);
      console.info(`[email:fallback] to=${input.to}\n${input.text}`);
      return { sent: false, mode: "log" };
    }
    return { sent: true, mode: "resend" };
  } catch (err) {
    console.error("[email] Resend request error", err);
    console.info(`[email:fallback] to=${input.to}\n${input.text}`);
    return { sent: false, mode: "log" };
  }
}

export async function sendVerificationEmail(opts: {
  to: string;
  token: string;
}): Promise<SendEmailResult> {
  const link = `${appBaseUrl()}/verify?token=${encodeURIComponent(opts.token)}&email=${encodeURIComponent(opts.to)}`;
  const text = [
    "Welcome to Sadhana.",
    "",
    "Confirm your email to finish creating your account:",
    link,
    "",
    "Or enter this verification code on the Verify page:",
    opts.token,
    "",
    "This link expires in 48 hours. If you did not create an account, you can ignore this message.",
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    subject: "Verify your Sadhana email",
    text,
    html: `<p>Welcome to Sadhana.</p><p><a href="${link}">Confirm your email</a> to finish creating your account.</p><p>Or enter this code on the Verify page:</p><p><code>${opts.token}</code></p><p>This link expires in 48 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  token: string;
}): Promise<SendEmailResult> {
  const link = `${appBaseUrl()}/account?reset=1&email=${encodeURIComponent(opts.to)}`;
  const text = [
    "Reset your Sadhana password.",
    "",
    `Open ${link} and enter this reset code:`,
    opts.token,
    "",
    "The code expires in 60 minutes. If you did not request a reset, you can ignore this message.",
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    subject: "Reset your Sadhana password",
    text,
  });
}
