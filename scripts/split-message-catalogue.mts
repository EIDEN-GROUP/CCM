/**
 * Split the message catalogue's `pages` namespace into per-group files.
 *
 * The catalogue is one object per locale, and the three locales must have
 * exactly the same shape. Splitting the `pages` namespace into per-group
 * files lets two people work on the catalogue at once without one
 * overwriting the other's keys.
 *
 * The split is done with the TypeScript parser rather than with regular
 * expressions, because the objects nest and the file has a formatting
 * quirk (`},    next: {` on one line) that a line-based split would
 * mis-handle.
 *
 * Run once. It is idempotent in the sense that it refuses to run against
 * an already-split catalogue.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const MESSAGES = join("src", "messages");

/** Which sub-namespaces of `pages` belong to which group. */
const GROUPS: Record<string, string[]> = {
  channels: ["overview", "websites", "googleAds", "analytics", "gtm", "seo"],
  insights: ["ux", "social", "inbox", "launcher"],
  admin: [
    "alerts",
    "reports",
    "integrations",
    "audit",
    "settings",
    "people",
    "search",
  ],
};

const GROUP_OF = new Map<string, string>();
for (const [group, names] of Object.entries(GROUPS)) {
  for (const name of names) GROUP_OF.set(name, group);
}

interface Parsed {
  /** The sub-namespace name → its source text (including the name and braces). */
  blocks: Map<string, string>;
  /** The whole `pages: { ... }` property text. */
  pagesText: string;
}

/** Find the `pages` property of the exported object in a catalogue file. */
function parseCatalogue(file: string): Parsed {
  const source = readFileSync(file, "utf8");
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  let catalogue: ts.ObjectLiteralExpression | undefined;

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.length === 1
    ) {
      const declaration = node.declarationList.declarations[0]!;
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return;

      // The catalogue is written `export const en = { ... } as const`, so
      // the initializer is an assertion rather than the object itself.
      const initializer = ts.isAsExpression(declaration.initializer)
        ? declaration.initializer.expression
        : declaration.initializer;

      if (ts.isObjectLiteralExpression(initializer)) {
        catalogue = initializer;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);

  if (!catalogue) {
    throw new Error(`${file}: no exported object literal found`);
  }

  const pagesProperty = catalogue.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "pages",
  );

  if (!pagesProperty || !ts.isObjectLiteralExpression(pagesProperty.initializer)) {
    throw new Error(`${file}: no \`pages\` object literal found`);
  }

  const blocks = new Map<string, string>();

  for (const property of pagesProperty.initializer.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (!ts.isIdentifier(property.name)) continue;
    if (!ts.isObjectLiteralExpression(property.initializer)) continue;

    const name = property.name.text;
    const text = property.getText(parsed);
    blocks.set(name, text);
  }

  return { blocks, pagesText: pagesProperty.getText(parsed) };
}

/** Write a group file for one locale. */
function writeGroup(
  locale: "en" | "fr" | "ar",
  group: string,
  blocks: Map<string, string>,
): void {
  const names = GROUPS[group]!;
  const parts = names.map((name) => blocks.get(name)).filter(Boolean) as string[];

  const languageName =
    locale === "en" ? "English" : locale === "fr" ? "French" : "Arabic";

  const header =
    locale === "en"
      ? `/**\n * The \`pages.${group}\` strings, in English.\n *\n * Part of the message catalogue. The three locales must have the same\n * shape, which the \`Messages\` type enforces at build time.\n */\n`
      : `/**\n * The \`pages.${group}\` strings, in ${languageName}.\n *\n * Hand-written; never machine-translated at render time. Typed against the\n * English shape, so a missing key fails the build.\n */\n`;

  let typeImport = "";
  let typeAnnotation = ": ChannelsShape";
  let shapeName = "ChannelsShape";

  if (locale === "en") {
    typeAnnotation = "";
    shapeName = "";
  } else {
    const englishGroup = group;
    typeImport = `import type { DeepStringify } from "../../en";\nimport { ${englishGroup} as english } from "../en/${englishGroup}";\n\n/** The shape this file must satisfy. */\nexport type ${shapeName} = DeepStringify<typeof english>;\n\n`;
  }

  const body = `export const ${group}${typeAnnotation} = {\n${parts
    .map((part) => part.replace(/^ {4}/gm, "  "))
    .join(",\n")},\n} as const;\n`;

  const content = locale === "en" ? `${header}${body}` : `${header}${typeImport}${body}`;

  const dir = join(MESSAGES, "pages", locale);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${group}.ts`), content, "utf8");
}

/** Replace the `pages` property in a catalogue file with an import and a spread. */
function rewriteCatalogue(
  locale: "en" | "fr" | "ar",
  pagesText: string,
): void {
  const file = join(MESSAGES, `${locale}.ts`);
  const source = readFileSync(file, "utf8");

  const importPath = locale === "en" ? "./pages/en" : `./pages/${locale}`;

  const groupNames = Object.keys(GROUPS);
  const importLines = groupNames
    .map((group) => `import { ${group} } from "${importPath}/${group}";`)
    .join("\n");

  const spread = groupNames.map((group) => `    ...${group},`).join("\n");

  // The `pages` property becomes nothing but the three spreads. The
  // trailing comma is left to the source, which already has one after the
  // property.
  const replacement = `  pages: {\n${spread}\n  }`;

  const index = source.indexOf(pagesText);
  if (index < 0) {
    throw new Error(`${file}: could not find the pages property`);
  }

  const next =
    source.slice(0, index) + replacement + source.slice(index + pagesText.length);

  // The imports go at the top of the file, after the last existing import.
  const lastImport = [...next.matchAll(/^import .*?;$/gm)].at(-1);
  const insertAt = lastImport ? lastImport.index! + lastImport[0].length : 0;

  const withImports =
    next.slice(0, insertAt) +
    `\n${importLines}` +
    next.slice(insertAt);

  writeFileSync(file, withImports, "utf8");
}

function main(): void {
  if (existsSync(join(MESSAGES, "pages"))) {
    console.log("The catalogue is already split. Nothing to do.");
    return;
  }

  for (const locale of ["en", "fr", "ar"] as const) {
    const file = join(MESSAGES, `${locale}.ts`);
    const { blocks, pagesText } = parseCatalogue(file);

    for (const group of Object.keys(GROUPS)) {
      writeGroup(locale, group, blocks);
    }

    rewriteCatalogue(locale, pagesText);
    console.log(`${locale}: split into ${Object.keys(GROUPS).length} groups`);
  }

  // `DeepStringify` must be exported for the other locales' group files to
  // type themselves against the English shape.
  const enFile = join(MESSAGES, "en.ts");
  const en = readFileSync(enFile, "utf8");
  writeFileSync(
    enFile,
    en.replace("type DeepStringify<T> = {", "export type DeepStringify<T> = {"),
    "utf8",
  );

  console.log("done.");
}

main();
