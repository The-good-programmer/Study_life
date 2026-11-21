/**
 * Sends email through Resend's HTTP API (https://resend.com), used for password reset links.
 * Set RESEND_API_KEY to turn it on, and MAIL_FROM to send from your own verified domain
 * (until then Resend only delivers to the address of the Resend account itself).
 */

const DEFAULT_FROM = 'Studify <onboarding@resend.dev>';

/** A mailer, or null when email isn't set up. */
export function createResendMailer({ apiKey = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM || DEFAULT_FROM } = {}) {
  if (!apiKey) return null;
  return {
    async send({ to, subject, text, html }) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
      });
      if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
  };
}
