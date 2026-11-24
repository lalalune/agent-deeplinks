import { readdir, readFile, writeFile } from "node:fs/promises";

const folder = new URL("../icons/", import.meta.url);
const files = (await readdir(folder)).filter((file) => file.endsWith(".svg")).sort();
const icons = Object.fromEntries(await Promise.all(files.map(async (file) => {
  const raw = await readFile(new URL(file, folder), "utf8");
  const svg = raw.replace(/^\s*<\?xml[^?]*\?>/u, "").replace(/<!--[\s\S]*?-->/gu, "").trim();
  if (
    !svg.startsWith("<svg") || !svg.endsWith("</svg>") ||
    /<!|<\s*(?:script|foreignObject)\b|\son[a-z]+\s*=|\b(?:href|src)\s*=\s*['"](?!#)/iu.test(svg)
  ) {
    throw new Error(`Expected a standalone, inert SVG in ${file}`);
  }
  return [file.slice(0, -4), `data:image/svg+xml,${encodeURIComponent(svg)}`];
})));
await writeFile(
  new URL("../src/generated-icons.ts", import.meta.url),
  `// Generated from the SVG files in icons/.\nexport const iconSources: Readonly<Record<string, string | undefined>> = ${JSON.stringify(icons, null, 2)};\n`,
);
