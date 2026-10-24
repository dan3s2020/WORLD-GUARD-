import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const result = await build({
  entryPoints: [resolve(root, "game-ui.mjs")],
  bundle: true,
  format: "iife",
  target: ["es2020"],
  minify: true,
  legalComments: "eof",
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
});
const output = resolve(root, "game.bundle.js"),
  bytes = result.outputFiles[0].text;
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8").replace(/\r\n?/g, "\n") !== bytes)
    throw Error("game.bundle.js is stale; run npm run build:game");
  console.log("PASS game bundle matches sources");
} else {
  writeFileSync(output, bytes);
  console.log(`Built standalone 3D game: ${Buffer.byteLength(bytes)} bytes`);
}
