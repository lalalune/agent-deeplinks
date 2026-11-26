import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));
const staging = mkdtempSync(join(tmpdir(), "agent-deeplinks-"));
const artifacts = join(process.cwd(), "artifacts");
const zip = join(artifacts, `${name}.zip`);
const tarball = `${name}-${version}.tgz`;

try {
  mkdirSync(artifacts, { recursive: true });
  execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", staging], { stdio: "inherit" });
  for (const file of ["README.md", "LICENSE", "icons", "research"]) {
    cpSync(file, join(staging, file), { recursive: true });
  }
  mkdirSync(join(staging, "assets"));
  cpSync("assets/readme-buttons", join(staging, "assets/readme-buttons"), { recursive: true });
  cpSync(join(staging, tarball), join(artifacts, `${name}.tgz`));
  cpSync("site/dist", join(staging, "demo"), { recursive: true });
  writeFileSync(join(staging, "START-HERE.txt"), [
    `Agent Deeplinks ${version}`, "",
    `Install the bundled package with: npm install ./${tarball}`,
    "Serve the demo directory over HTTP, for example: python3 -m http.server 8000 --directory demo",
    "See README.md for TypeScript and shadcn/ui examples, and icons/README.md for SVG sources.", "",
  ].join("\n"));
  rmSync(zip, { force: true });
  execFileSync("zip", ["-q", "-r", zip, "."], { cwd: staging, stdio: "inherit" });
  console.log(zip);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
