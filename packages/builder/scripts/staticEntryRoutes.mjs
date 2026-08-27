// Rewrites the routify-generated route tree so that the routes a signed-out
// visitor can actually render (auth, first-run admin setup, invites,
// maintenance, and the root layout) are imported statically with the entry
// bundle, while every authenticated surface stays a lazily imported chunk.
//
// Runs between `routify -b` and `vite build` (see the build script).
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const routesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.routify/routes.js"
)

// Route components a signed-out visitor needs before they can authenticate.
// Everything else is only reachable once logged in, so it can arrive late.
const STATIC_PATTERNS = [
  "/pages/builder/auth/",
  "/pages/builder/admin/",
  "/pages/builder/invite/",
  "/pages/builder/maintenance/",
  "/pages/builder/_layout.svelte",
  "/pages/builder/_fallback.svelte",
  "/pages/builder/index.svelte",
]

const source = fs.readFileSync(routesPath, "utf8")

const dynamicImportRe = /\(\) => import\('([^']+)'\)\.then\(m => m\.default\)/g

const staticImports = new Map()
const toIdentifier = file =>
  "_static" +
  file
    .replace(/^\.\.\/src\/pages\//, "")
    .replace(/\.svelte$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")

const rewritten = source.replace(dynamicImportRe, (match, file) => {
  if (!STATIC_PATTERNS.some(pattern => file.includes(pattern))) {
    return match
  }
  const identifier = toIdentifier(file)
  staticImports.set(identifier, file)
  // Routify expects a thunk here: a call that resolves synchronously to the
  // component marks the route as statically bundled
  return `() => ${identifier}`
})

const importBlock =
  [...staticImports.entries()]
    .map(([identifier, file]) => `import ${identifier} from '${file}'`)
    .join("\n") + "\n"

fs.writeFileSync(routesPath, importBlock + rewritten)
console.log(
  `staticEntryRoutes: ${staticImports.size} entry route components imported statically`
)
