import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 7+ resolves tsconfig `paths` natively, so the @/* import alias
  // works without the older vite-tsconfig-paths plugin.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["lib/**/*.{test,spec}.ts", "test/**/*.{test,spec}.ts"],
    // We don't lean on globals (`describe`, `it`) without import — explicit
    // imports keep the tests grep-able and avoid surprises in editors.
    globals: false,
  },
});
