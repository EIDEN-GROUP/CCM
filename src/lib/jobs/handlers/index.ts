import type { JobHandler } from "@/lib/jobs/runner";
import {
  adsCampaignHandler,
  ga4EventsHandler,
  ga4SessionsHandler,
  gscQueryHandler,
  gtmInventoryHandler,
  mailSyncHandler,
} from "./google";
import {
  rankSnapshotHandler,
  socialPostsHandler,
  socialSnapshotHandler,
} from "./providers";
import { alertsEvaluateHandler, retentionPruneHandler } from "./maintenance";
import { pageSpeedHandler, uptimeHandler } from "./site";
import { reportGenerateHandler } from "./reports";
import { siteCrawlHandler } from "./site-crawl";

/**
 * The job handler registry.
 *
 * A job kind with no handler is reported as failed rather than being left to
 * retry forever — that is a configuration error, not a transient failure.
 */
export function getJobHandlers(): Record<string, JobHandler> {
  return {
    "ga4.sessions": ga4SessionsHandler,
    "ga4.events": ga4EventsHandler,
    "gsc.query": gscQueryHandler,
    "ads.campaign": adsCampaignHandler,
    "ads.search_terms": adsCampaignHandler,
    "gtm.inventory": gtmInventoryHandler,
    "rank.snapshot": rankSnapshotHandler,
    "social.snapshot": socialSnapshotHandler,
    "social.posts": socialPostsHandler,
    "mail.sync": mailSyncHandler,
    "pagespeed.run": pageSpeedHandler,
    "uptime.check": uptimeHandler,
    "site.crawl": siteCrawlHandler,
    "reports.generate": reportGenerateHandler,
    "alerts.evaluate": alertsEvaluateHandler,
    "retention.prune": retentionPruneHandler,
  };
}

export { getJobHandlers as jobHandlers };
