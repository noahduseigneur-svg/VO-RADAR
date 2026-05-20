import { getUserById, listAllActiveAlerts, recordAlertHit, markAlertHitEmailed, matchListingsForRule, getFreshListingIds } from "./db";
import { sendAlertEmail, buildEmailPayload } from "./notifier";
import { newId } from "./auth";
import type { Listing } from "./types";

// After a scrape, find new listings that match any user's active alerts.
export async function processNewListingsForAlerts(freshSince: string): Promise<{ hits: number; emails_sent: number }> {
  const freshSet = await getFreshListingIds(freshSince);
  if (freshSet.size === 0) return { hits: 0, emails_sent: 0 };

  const rules = await listAllActiveAlerts();
  let hits = 0;
  let emails = 0;

  for (const rule of rules) {
    const matches = (await matchListingsForRule(rule, 50)).filter((l) => freshSet.has(l.id));
    if (matches.length === 0) continue;

    const newlyHit: { id: string; listing: Listing }[] = [];
    for (const listing of matches) {
      const hitId = newId("h_");
      const isNew = await recordAlertHit({
        id: hitId,
        user_id: rule.user_id,
        rule_id: rule.id,
        listing_id: listing.id,
        notified_at: new Date().toISOString(),
        seen_at: null,
        email_sent_at: null,
      });
      if (isNew) {
        hits++;
        newlyHit.push({ id: hitId, listing });
      }
    }

    if (newlyHit.length > 0) {
      const user = await getUserById(rule.user_id);
      if (!user) continue;
      const result = await sendAlertEmail(buildEmailPayload(user, rule, newlyHit.map((h) => h.listing)));
      if (result.ok) {
        emails++;
        for (const h of newlyHit) await markAlertHitEmailed(h.id);
      }
    }
  }
  return { hits, emails_sent: emails };
}
