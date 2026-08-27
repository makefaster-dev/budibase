type Posthog = typeof import("posthog-js").default

export default class PosthogClient {
  token: string
  posthog?: Posthog

  constructor(token: string) {
    this.token = token
  }

  // The analytics SDK is only loaded once analytics are confirmed enabled,
  // keeping it off the entry bundle's critical path. All capture methods
  // no-op until it has loaded, mirroring the previous initialised guard.
  async init() {
    if (!this.token || this.posthog) return

    const { default: posthog } = await import("posthog-js")
    posthog.init(this.token, {
      autocapture: false,
      capture_pageview: false,
      // disable by default
      disable_session_recording: true,
    })
    posthog.set_config({ persistence: "cookie" })

    this.posthog = posthog
  }

  /**
   * Set the posthog context to the current user
   * @param {String} id - unique user id
   */
  identify(id: string) {
    this.posthog?.identify(id)
  }

  /**
   * Update user metadata associated with current user in posthog
   * @param {Object} meta - user fields
   */
  updateUser(meta: Record<string, any>) {
    this.posthog?.people.set(meta)
  }

  /**
   * Capture analytics events and send them to posthog.
   * @param {String} event - event identifier
   * @param {Object} props - properties for the event
   */
  captureEvent(event: string, props: Record<string, any>) {
    if (!this.posthog) {
      return
    }

    props.sourceApp = "builder"
    this.posthog.capture(event, props)
  }

  enableSessionRecording() {
    this.posthog?.set_config({
      disable_session_recording: false,
    })
  }

  /**
   * Reset posthog user back to initial state on logout.
   */
  logout() {
    this.posthog?.reset()
  }
}
