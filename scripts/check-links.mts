/**
 * Check that every internal link points at a route that exists.
 *
 * A dead navigation link is exactly the kind of thing the brief forbids
 * ("no dead buttons"), so it is worth a mechanical check.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const APP_DIR = "src/app";

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

/** Every route the app serves, normalised to "/segment". */
const routes = new Set<string>();
for (const file of walk(APP_DIR)) {
  if (!file.endsWith("page.tsx")) continue;
  let route = relative(APP_DIR, file).replace(/\\/g, "/");
  route = route.replace(/\/?page\.tsx$/, "").replace(/\(app\)/g, "");
  route = ("/" + route).replace(/\/+$/, "").replace(/\/{2,}/g, "/");
  if (route === "") route = "/overview";
  routes.add(route);
}

/** Every internal href in the source. */
const links = new Map<string, string[]>();
for (const file of walk("src")) {
  if (!/\.(tsx?|jsx?)$/.test(file)) continue;
  const content = readFileSync(file, "utf8");
  // Both forms: a JSX attribute (`href="/x"`) and a navigation entry
  // (`href: "/x"`).
  for (const match of content.matchAll(/href\s*[=:]\s*"(\/[^"#?]*)"/g)) {
    let href = match[1]!;
    if (href.length > 1) href = href.replace(/\/+$/, "");
    if (href === "") href = "/overview";
    const list = links.get(href) ?? [];
    list.push(file);
    links.set(href, list);
  }
}

let broken = 0;
for (const [href, files] of [...links].sort()) {
  const ok = routes.has(href);
  if (!ok) broken += 1;
  console.log(
    `  ${ok ? "OK     " : "MISSING"} ${href.padEnd(24)} ${[...new Set(files)].join(", ")}`,
  );
}

console.log(`\n${routes.size} routes, ${links.size} internal links, ${broken} broken.`);
process.exit(broken > 0 ? 1 : 0);
