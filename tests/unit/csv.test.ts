import { describe, expect, it } from "vitest";
import {
  escapeCsvCell,
  exportFilename,
  maskIdentifier,
  toCsv,
} from "@/lib/reports/csv";

describe("CSV escaping", () => {
  it("quotes a cell containing a comma", () => {
    expect(escapeCsvCell("Agadir, Morocco")).toBe('"Agadir, Morocco"');
  });

  it("doubles a quote inside a cell", () => {
    expect(escapeCsvCell('the "best" clinic')).toBe(
      '"the ""best"" clinic"',
    );
  });

  it("quotes a cell containing a newline", () => {
    expect(escapeCsvCell("line one\nline two")).toBe(
      '"line one\nline two"',
    );
  });

  it("neutralises a formula a spreadsheet would execute", () => {
    expect(escapeCsvCell("=HYPERLINK(\"http://evil.test\")")).toBe(
      '"\'=HYPERLINK(""http://evil.test"")"',
    );
    expect(escapeCsvCell("+1+1")).toBe("'+1+1");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("writes an empty cell for null and undefined", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
});

describe("share safe masking", () => {
  it("masks an email address but keeps the domain", () => {
    expect(maskIdentifier("hello@medicalbay.ma")).toBe("h****@medicalbay.ma");
  });

  it("masks a long identifier but keeps its ends", () => {
    const masked = maskIdentifier("1234567890abcdef");
    expect(masked.startsWith("123")).toBe(true);
    expect(masked.endsWith("def")).toBe(true);
    expect(masked).toContain("*");
  });

  it("fully masks a short value", () => {
    expect(maskIdentifier("abc")).toBe("***");
  });
});

describe("CSV documents", () => {
  interface Row {
    campaign: string;
    spend: number;
    owner: string;
  }

  const rows: Row[] = [
    { campaign: "Dentistry", spend: 2480, owner: "ops@medicalbay.ma" },
  ];

  const columns = [
    { key: "campaign", header: "Campaign", value: (row: Row) => row.campaign },
    { key: "spend", header: "Spend", value: (row: Row) => row.spend },
    {
      key: "owner",
      header: "Owner",
      value: (row: Row) => row.owner,
      sensitive: true,
    },
  ];

  it("writes a header and one line per row", () => {
    const csv = toCsv(columns, rows);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Campaign,Spend,Owner");
    expect(lines).toHaveLength(2);
  });

  it("masks a sensitive column in share safe mode", () => {
    const csv = toCsv(columns, rows, { safeMode: true });
    expect(csv).toContain("o***@medicalbay.ma");
    expect(csv).not.toContain("ops@medicalbay.ma");
  });

  it("keeps a sensitive column intact when share safe mode is off", () => {
    const csv = toCsv(columns, rows, { safeMode: false });
    expect(csv).toContain("ops@medicalbay.ma");
  });

  it("writes only a header when there are no rows", () => {
    const csv = toCsv(columns, []);
    expect(csv.trim()).toBe("Campaign,Spend,Owner");
  });
});

describe("export filenames", () => {
  it("builds a filename that states the period", () => {
    expect(exportFilename("Google Ads", "2026-03-01", "2026-03-28")).toBe(
      "ccm-google-ads-2026-03-01_to_2026-03-28.csv",
    );
  });

  it("strips characters a filesystem would object to", () => {
    expect(exportFilename("a/b?c", "2026-01-01", "2026-01-31")).toBe(
      "ccm-a-b-c-2026-01-01_to_2026-01-31.csv",
    );
  });
});
