import { join } from "../../utilities/centralPath"
import { TOP_LEVEL_PATH, DEV_ASSET_PATH } from "../../utilities/fileSystem"
import { Ctx } from "@budibase/types"
import env from "../../environment"
import send from "koa-send"

// A short freshness window for the HTML document lets repeat visits within
// the window skip the revalidation round trip while still picking up new
// releases quickly.
const HTML_MAX_AGE_MS = 60 * 1000

// Build output under assets/ has a content hash in the filename, so it can
// be cached forever: any change to the content changes the URL.
const IMMUTABLE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

// this is a public endpoint with no middlewares
export const serveBuilderAssets = async function (ctx: Ctx<undefined, void>) {
  let topLevelPath = env.isDev() ? DEV_ASSET_PATH : TOP_LEVEL_PATH
  const builderPath = join(topLevelPath, "builder")
  const file = ctx.file || "index.html"
  const isHtml = file === "index.html"
  const isHashed = file.startsWith("assets/")
  await send(ctx, file, {
    root: builderPath,
    maxage: isHtml ? HTML_MAX_AGE_MS : isHashed ? IMMUTABLE_MAX_AGE_MS : 0,
    immutable: isHashed,
  })
}
