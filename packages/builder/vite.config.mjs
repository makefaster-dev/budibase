import { svelte } from "@sveltejs/vite-plugin-svelte"
import replace from "@rollup/plugin-replace"
import { defineConfig, loadEnv } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import zlib from "zlib"

// Pre-generate .br and .gz siblings for compressible static output so the
// server (koa-send) can serve maximum-compression encodings without paying
// runtime compression cost. Runtime gzip on the 2MB+ entry bundle is both
// slower and ~25% larger than build-time brotli.
const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|txt|ttf|eot)$/
const MIN_COMPRESS_SIZE = 1024

// Start the entry module only after the first frame has painted, so the
// static boot shell's first paint is never gated on the bundle's fetch or
// evaluation. On constrained networks this matches the scheduling a
// low-priority fetch would get anyway: render-critical CSS and fonts first,
// then the bundle at full bandwidth.
const deferEntryModule = () => ({
  name: "defer-entry-module",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler(html) {
      const scriptRe = /<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/
      const match = html.match(scriptRe)
      if (!match) {
        return html
      }
      const src = match[1]
      const loader =
        `<script>requestAnimationFrame(function () {` +
        `requestAnimationFrame(function () {` +
        `var s = document.createElement("script");` +
        `s.type = "module";` +
        `s.crossOrigin = "";` +
        `s.src = ${JSON.stringify(src)};` +
        `document.body.appendChild(s);` +
        `});});</script>`
      return html.replace(scriptRe, loader)
    },
  },
})

const precompress = () => ({
  name: "precompress-static-assets",
  apply: "build",
  closeBundle: {
    sequential: true,
    order: "post",
    async handler() {
      const outDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../server/builder"
      )
      const walk = dir =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
          const full = path.join(dir, entry.name)
          return entry.isDirectory() ? walk(full) : [full]
        })
      const brotli = file =>
        new Promise((resolve, reject) => {
          const contents = fs.readFileSync(file)
          zlib.brotliCompress(
            contents,
            {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                [zlib.constants.BROTLI_PARAM_SIZE_HINT]: contents.length,
              },
            },
            (err, compressed) => {
              if (err) {
                return reject(err)
              }
              fs.writeFileSync(`${file}.br`, compressed)
              zlib.gzip(contents, { level: 9 }, (gzErr, gzipped) => {
                if (gzErr) {
                  return reject(gzErr)
                }
                fs.writeFileSync(`${file}.gz`, gzipped)
                resolve()
              })
            }
          )
        })
      const files = walk(outDir).filter(
        file =>
          COMPRESSIBLE.test(file) && fs.statSync(file).size >= MIN_COMPRESS_SIZE
      )
      await Promise.all(files.map(brotli))
    },
  },
})

const ignoredWarnings = [
  "unused-export-let",
  "css-unused-selector",
  "module-script-reactive-declaration",
  "a11y-no-onchange",
  "a11y-click-events-have-key-events",
  "element_invalid_self_closing_tag",
]

const copyFonts = dest =>
  viteStaticCopy({
    targets: [
      {
        src: "./assets/source-sans-3",
        dest,
      },
      {
        src: "./assets/phosphor-icons",
        dest,
      },
      {
        src: "./assets/inter",
        dest,
      },
      {
        src: "./assets/rest-template-icons",
        dest,
      },
      {
        src: "../../node_modules/remixicon/fonts/*",
        dest,
      },
    ],
  })

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production"
  const env = loadEnv(mode, process.cwd())
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  // Plugins to only run in dev
  const devOnlyPlugins = [
    // Copy fonts to an additional path so that svelte's automatic
    // prefixing of the base URL path can still resolve assets
    copyFonts("builder/fonts"),
  ]

  return {
    test: {
      setupFiles: ["./vitest.setup.js"],
      globals: true,
      environment: "jsdom",
      deps: {
        web: {
          transformCss: true,
        },
      },
      server: {
        deps: {
          inline: [/@budibase\/bbui/, /@spectrum-css/, /easymde/],
        },
      },
    },
    server: {
      fs: {
        strict: false,
      },
      hmr: {
        protocol: env.VITE_HMR_PROTOCOL || "ws",
        clientPort: env.VITE_HMR_CLIENT_PORT || 3000,
        path: env.VITE_HMR_PATH || "/",
      },
      port: 3000,
    },
    base: "/builder/",
    build: {
      minify: isProduction,
      outDir: "../server/builder",
      sourcemap: !isProduction,
    },
    plugins: [
      svelte({
        // Ensure this package's Svelte config is used
        configFile: path.resolve(__dirname, "svelte.config.mjs"),
        emitCss: true,
        // HMR is enabled automatically in dev; prefer compilerOptions.hmr (see svelte.config.mjs)
        onwarn: (warning, handler) => {
          // Ignore some warnings
          if (!ignoredWarnings.includes(warning.code)) {
            handler(warning)
          }
        },
      }),
      replace({
        preventAssignment: true,
        "process.env.NODE_ENV": JSON.stringify(
          isProduction ? "production" : "development"
        ),
        "process.env.POSTHOG_TOKEN": JSON.stringify(process.env.POSTHOG_TOKEN),
      }),
      copyFonts("fonts"),
      ...(isProduction ? [deferEntryModule(), precompress()] : devOnlyPlugins),
    ],
    optimizeDeps: {
      // Let vite-plugin-svelte manage Svelte library prebundling
      exclude: ["@roxi/routify", "fsevents"],
    },
    resolve: {
      conditions:
        mode === "test"
          ? ["browser"]
          : !isProduction
            ? ["svelte", "development", "browser", "default"]
            : ["svelte", "production", "browser", "default"],

      dedupe: ["@roxi/routify", "svelte"],
      alias: {
        "@budibase/types": path.resolve(__dirname, "../types/src"),
        "@budibase/shared-core": path.resolve(__dirname, "../shared-core/src"),
        "@budibase/bbui": path.resolve(__dirname, "../bbui/src"),
        "@": path.resolve(__dirname, "src"),
        assets: path.resolve(__dirname, "assets"),
      },
    },
  }
})
