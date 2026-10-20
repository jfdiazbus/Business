// ESLint, flat config.
//
// Three worlds share this repository: the browser scripts the pages load, the
// Worker that answers API routes on Cloudflare, and the Node code that serves,
// builds, deploys and tests them. Each gets the globals it actually has, so an
// accidental `window` in the server or `process` in the browser is an error
// rather than a runtime surprise.
//
// The vendored scroll engine is not ours to reformat, so it is ignored.

import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "dist/**",
      "world/out/**",
      "world/build/**",
      "world/engine.js",
      ".agents/**",
      ".venv/**",
      "coverage/**",
      ".lighthouseci/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
    },
    rules: {
      // `_stderr` and friends are deliberate in the exec callbacks.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      // The scripts are meant to talk: that is their output.
      "no-console": "off",
    },
  },

  {
    files: [
      "index.js",
      "scripts/**/*.mjs",
      "test/**/*.js",
      "world/*.mjs",
      "*.config.js",
      "eslint.config.js",
    ],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["bar.js", "account.js", "blog.js", "blog-write.js"],
    languageOptions: { globals: globals.browser },
  },

  {
    // The engine is loaded as a classic script and leaves this name on the
    // page, which world.js then calls.
    files: ["world.js"],
    languageOptions: {
      globals: { ...globals.browser, mountScrollWorld: "readonly" },
    },
  },

  {
    // Cloudflare runs this one: Web APIs and no Node built-ins.
    files: ["worker.js"],
    languageOptions: { globals: globals.worker },
  },

  // The browser specs run in Node and hand callbacks to `page.evaluate`, which
  // the browser executes, so both sets of globals are legitimate here.
  {
    files: ["e2e/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // Last, so it can turn off anything that would fight the formatter.
  prettier,
];
