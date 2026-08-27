// CodeMirror 5 is only needed once an editor actually mounts, so it is
// loaded on demand to keep it off the entry bundle's critical path.
let loadPromise

export const loadCodeMirror = () => {
  if (!loadPromise) {
    loadPromise = Promise.all([
      import("codemirror"),
      import("codemirror/lib/codemirror.css"),

      // Modes
      import("codemirror/mode/javascript/javascript"),
      import("codemirror/mode/sql/sql"),
      import("codemirror/mode/xml/xml"),
      import("codemirror/mode/css/css"),
      import("codemirror/mode/handlebars/handlebars"),

      // Hints
      import("codemirror/addon/hint/show-hint"),
      import("codemirror/addon/hint/show-hint.css"),

      // Theming
      import("codemirror/theme/tomorrow-night-eighties.css"),

      // Functional addons
      import("codemirror/addon/selection/active-line"),
      import("codemirror/addon/edit/closebrackets"),
      import("codemirror/addon/edit/matchbrackets"),
    ]).then(([codemirror]) => codemirror.default)
  }
  return loadPromise
}
