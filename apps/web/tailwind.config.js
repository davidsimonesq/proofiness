/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Body — humanist sans, technical-feeling but readable.
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        // Display — condensed sans for headers and small-caps labels. Carries
        // the field-manual / instrument-panel feel.
        display: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        // Mono — for ids, search queries, request ids, source URLs.
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        // Serif — used very narrowly for emphatic prose blocks (the crux
        // declaration, italic notes). Plex Serif feels like a printed report.
        serif: ['"IBM Plex Serif"', "ui-serif", "Georgia", "serif"],
      },
      letterSpacing: {
        // For small-caps labels — wider tracking gives the engraved-plate look.
        widish: "0.08em",
        widest: "0.18em",
      },
      colors: {
        // Custom semantic colors mapped to stone (warm cool gray) for the
        // cool-paper / dark-ink contrast. A burnished-brass amber is used
        // very narrowly for crux markers; a deep oxblood for serious errors.
        ink: "#0c0a09",
        accent: {
          DEFAULT: "#92400e", // amber-800, burnished brass
          dim: "#a16207", // amber-700, slightly lighter for borders
        },
        oxblood: "#7f1d1d", // red-900, for high-severity warnings only
      },
    },
  },
  plugins: [],
};
