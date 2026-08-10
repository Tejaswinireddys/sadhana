/**
 * Transactional email — Resend when RESEND_API_KEY is set, else optional
 * EMAIL_WEBHOOK_URL POST, else structured console log (dev / demos).
 */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Tag for logs / webhooks (cancel_confirm, renewal_reminder, refund). */
  kind: string;
};

export type EmailResult = { ok: boolean; id?: string; skipped?: boolean; error?: string };

function fromAddress(): string {
  return process.env.EMAIL_FROM || "Sadhana <noreply@sadhana.app>";
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const to = msg.to.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return { ok: false, error: "No recipient email on file" };
  }

  const resendKey = process.env.RESEND_API_KEY || "";
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          tags: [{ name: "kind", value: msg.kind }],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) {
        console.error("[email] Resend failed:", data.message || res.status);
        return { ok: false, error: data.message || `Resend ${res.status}` };
      }
      return { ok: true, id: data.id };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  const webhook = process.env.EMAIL_WEBHOOK_URL || "";
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...msg, from: fromAddress(), to }),
      });
      if (!res.ok) return { ok: false, error: `webhook ${res.status}` };
      return { ok: true, id: `webhook-${Date.now()}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  console.info(
    `[email:${msg.kind}] to=${to} subject=${JSON.stringify(msg.subject)}\n${msg.text}`,
  );
  return { ok: true, skipped: true, id: `log-${Date.now()}` };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase() || "USD",
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

export function formatAccessDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
