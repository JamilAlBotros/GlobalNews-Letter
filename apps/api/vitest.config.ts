import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 10000,
    pool: "forks", // Run tests in separate processes
    poolOptions: {
      forks: {
        singleFork: true // Run tests sequentially to avoid DB conflicts
      }
    }
  }
});