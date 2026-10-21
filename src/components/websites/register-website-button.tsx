"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Globe, LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";

/**
 * Register a website.
 *
 * The registry is generic: a future Medical Bay microsite appears by adding
 * a row, so this form is the whole of the "add a site" feature. It stores
 * the domain and the provider identifiers — never a page snapshot of the
 * site.
 */
export function RegisterWebsiteButton({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          domain: String(form.get("domain") ?? ""),
          hostnames: String(form.get("hostnames") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          primaryLocale: String(form.get("primaryLocale") ?? "fr"),
          locales: String(form.get("locales") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          serviceLines: String(form.get("serviceLines") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          ownerLabel: String(form.get("ownerLabel") ?? ""),
          notes: String(form.get("notes") ?? ""),
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        website?: { name: string; domain: string };
      } | null;

      if (!response.ok || !body?.website) {
        setError(body?.error ?? `The request failed (HTTP ${response.status}).`);
        return;
      }

      setDone(`${body.website.name} — ${body.website.domain}`);
      setOpen(false);
      router.refresh();
    } catch {
      setError("CCM could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) return null;

  if (!open) {
    return (
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" className="size-4" />
        {t("pages.websites.register")}
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-label-lg font-semibold text-secondary">
          <Globe aria-hidden="true" className="size-4" />
          Register a website
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-body-sm text-error">
          {error}
        </p>
      ) : null}

      {done ? (
        <p className="mt-3 text-body-sm text-success">Registered {done}.</p>
      ) : null}

      <form
        action={(formData) => void submit(formData)}
        className="mt-4 grid gap-3 md:grid-cols-2"
      >
        <div>
          <label
            htmlFor="website-name"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            Name
          </label>
          <Input
            id="website-name"
            name="name"
            required
            placeholder="Medical Bay"
          />
        </div>

        <div>
          <label
            htmlFor="website-domain"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            Domain
          </label>
          <Input
            id="website-domain"
            name="domain"
            required
            placeholder="medicalbay.ma"
          />
        </div>

        <div>
          <label
            htmlFor="website-hostnames"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            Other hostnames
          </label>
          <Input
            id="website-hostnames"
            name="hostnames"
            placeholder="www.medicalbay.ma, medicalbay.ma (comma separated)"
          />
        </div>

        <div>
          <label
            htmlFor="website-owner"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            Owner
          </label>
          <Input
            id="website-owner"
            name="ownerLabel"
            placeholder="Optional"
          />
        </div>

        <div>
          <label
            htmlFor="website-locales"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            Locales
          </label>
          <Input
            id="website-locales"
            name="locales"
            defaultValue="fr, en, ar"
            placeholder="Comma separated"
          />
        </div>

        <div>
          <label
            htmlFor="website-services"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            Service lines
          </label>
          <Input
            id="website-services"
            name="serviceLines"
            placeholder="dentistry, hair_transplant, medical_tourism"
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="website-notes"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            Notes
          </label>
          <Textarea
            id="website-notes"
            name="notes"
            rows={2}
            placeholder="Optional"
          />
        </div>

        <div className="md:col-span-2">
          <Button type="submit" variant="primary" size="md" disabled={busy}>
            {busy ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Register
          </Button>
        </div>
      </form>
    </div>
  );
}
