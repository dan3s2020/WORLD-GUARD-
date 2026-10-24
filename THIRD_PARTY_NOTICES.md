# Third-party software

The standalone `game.bundle.js` contains Three.js 0.186.1, copyright 2010–2026 Three.js Authors, under the MIT license. The bundled license comment is preserved. The complete upstream license is included in `docs/licenses/THREE-MIT.txt`.

Build tooling: esbuild 0.25.12 (MIT). Browser verification: Playwright 1.56.1 (Apache-2.0). These tools do not execute in the delivered game runtime. See the exact dependency lockfile and each installed package's license.

The v0.4 globe and terrain land mask use Natural Earth 1:110m land coastlines (public domain), bundled in `sim/earth-land.mjs`; provenance and terms are in `docs/licenses/NATURAL-EARTH.md`. Procedural elevations, biomes, structures and game scale are independent of that dataset. The legacy Life Lab retains its earlier repository-native silhouettes.
