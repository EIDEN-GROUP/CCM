/**
 * Timezone helpers.
 *
 * Provider reports are bound to a property/account timezone, so "today" must
 * be computed in that timezone rather than on the server clock in UTC.
 */

export function getTodayInTimezone(timezone: string, now = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // en-CA formats as YYYY-MM-DD.
    return formatter.format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function getTimezoneOffsetLabel(timezone: string, now = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
  } catch {
    return timezone;
  }
}

/** True when the timezone observes daylight saving at the given instant. */
export function observesDaylightSaving(timezone: string, now = new Date()): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });
    const name = formatter
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value;
    return name === "GMT+2" || name === "EDT" || name === "CEST";
  } catch {
    return false;
  }
}
