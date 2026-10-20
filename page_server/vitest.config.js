import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      // What ships, plus the code that answers, builds and serves it. The tests
      // themselves and the vendored scroll engine would only pad the number.
      include: [
        "index.js",
        "worker.js",
        "scripts/**/*.mjs",
        "bar.js",
        "world.js",
        "account.js",
        "blog.js",
        "blog-write.js",
      ],
      exclude: ["world/engine.js", "world/out/**", "dist/**"],
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});
