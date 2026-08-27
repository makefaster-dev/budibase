import "remixicon/fonts/remixicon.css"
import "@spectrum-css/vars/dist/spectrum-global.css"
import "@spectrum-css/vars/dist/spectrum-medium.css"
import "@spectrum-css/vars/dist/spectrum-darkest.css"
import "@spectrum-css/vars/dist/spectrum-dark.css"
import "@spectrum-css/vars/dist/spectrum-light.css"
import "@spectrum-css/vars/dist/spectrum-lightest.css"
import "@budibase/frontend-core/src/themes/nord.css"
import "@budibase/frontend-core/src/themes/midnight.css"
import "@spectrum-css/page/dist/index-vars.css"
import "./global.css"
import { suppressWarnings } from "./helpers/warnings"
import { mount } from "svelte"
import App from "./App.svelte"

// Suppress svelte runtime warnings
suppressWarnings([
  "was created with unknown prop",
  "was created without expected prop",
  "received an unexpected slot",
])

// Give the static boot shell in index.html a guaranteed painted frame before
// mounting the app, so first paint is never gated on the bundle's execution
await new Promise(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))
)

const app = mount(App, {
  target: document.getElementById("app"),
})

export default app
