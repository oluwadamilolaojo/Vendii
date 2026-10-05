import { registrarEmail } from "./registrars";
import type { Claim, OutboundMessage } from "./types";

function weeksSince(label: string | null): number {
  if (!label) return 1;
  const t = Date.parse(label);
  if (Number.isNaN(t)) return 1;
  return Math.max(1, Math.round((Date.now() - t) / (7 * 86_400_000)));
}

/** First-contact status request. Ops can edit before sending. */
export function buildChaseMessage(c: Claim): OutboundMessage {
  const weeks = weeksSince(c.submittedOn);
  const ref = c.ref ? `Ref ${c.ref}` : "reference pending";
  const span = weeks === 1 ? "a week" : `${weeks} weeks`;
  const opening = c.status === "submitted"
    ? `We filed the above claim with you ${span} ago and have not yet received confirmation that it arrived.`
    : `It has been ${span} since submission and we have not received a status update.`;
  return {
    to: registrarEmail(c.registrar),
    subject: `Status request: ${c.company}, ${c.ownerName} (${ref})`,
    body:
      `Dear ${c.registrar} Unclaimed Dividends Desk,\n\n` +
      `We write on behalf of our client, ${c.ownerName}, under the limited power of attorney executed for this claim (${ref}): ` +
      `${c.years} dividends on ${c.units.toLocaleString("en-NG")} units of ${c.company}.\n\n` +
      `${opening} Please confirm the current status and tell us of any outstanding requirements.\n\n` +
      `Our client's authority is scoped strictly to this claim and does not extend to any other action on the account.\n\n` +
      `Thank you,\nVendii, on behalf of ${c.ownerName}`,
  };
}
