/**
 * Copies the real onboarding demo track from the project root into Next.js public:
 *   demo_song.mp3  →  public/demo/demo-song.mp3
 *
 * Run from repo root: npm run sync:demo-audio
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "demo_song.mp3");
const destDir = path.join(root, "public", "demo");
const dest = path.join(destDir, "demo-song.mp3");

if (!fs.existsSync(src)) {
  console.error(
    "Missing demo_song.mp3 at project root. Place your audio file at:",
    src,
  );
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied", path.relative(root, src), "→", path.relative(root, dest));
