/**
 * MMA Master import boundaries (eslint-plugin-boundaries + eslint-plugin-import).
 * Layers, low to high: shared -> core/* -> content -> platform -> services -> engine -> ui -> app.
 * See the boundaries table in docs/MMA_MASTER_PLAN.md §10 for the full allow-list.
 */
module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  ignorePatterns: ["dist", "node_modules", "ios", "android", ".eslintrc.cjs"],
  settings: {
    "import/resolver": { typescript: { alwaysTryTypes: true } },
    "import/internal-regex": "^@/",
    // Not classified: entry point, ambient types, root tool configs, build scripts.
    // Everything else under src/ must belong to an element or no-unknown-files fails.
    "boundaries/ignore": ["src/main.tsx", "src/env.d.ts", "*.config.ts", "scripts/**", "supabase/**"],
    "boundaries/elements": [
      { type: "app", pattern: "src/app" },
      { type: "ui", pattern: "src/ui" },
      { type: "engine", pattern: "src/engine" },
      { type: "services", pattern: "src/services" },
      { type: "platform", pattern: "src/platform" },
      { type: "content", pattern: "src/content" },
      { type: "core", pattern: "src/core/*", capture: ["module"] },
      { type: "shared", pattern: "src/shared" },
    ],
  },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:react-hooks/recommended"],
  plugins: ["@typescript-eslint", "react-hooks", "import", "boundaries"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
    "import/no-cycle": "error",
    "boundaries/no-unknown-files": "error",
    "boundaries/no-unknown": "error",
    "boundaries/element-types": [
      "error",
      {
        default: "disallow",
        rules: [
          { from: "shared", allow: ["shared"] },
          { from: "core", allow: ["core", "shared"] },
          { from: "content", allow: ["core", "shared"] },
          { from: "platform", allow: ["platform", "shared"] },
          { from: "services", allow: ["core", "shared", "platform"] },
          { from: "engine", allow: ["core", "content", "shared", "platform"] },
          { from: "ui", allow: ["core", "content", "shared", "services", "platform", "engine"] },
          { from: "app", allow: ["app", "ui", "engine", "services", "platform", "content", "core", "shared"] },
        ],
      },
    ],
    // Imports from another element go through its barrel; imports inside one element are unrestricted.
    "boundaries/entry-point": [
      "error",
      {
        default: "disallow",
        rules: [
          { target: ["core", "engine", "services", "platform", "ui"], allow: "index.ts" },
          { target: ["content", "shared", "app"], allow: "**" },
        ],
      },
    ],
    // Which npm packages each layer may touch: keeps core/ pure, and Capacitor and Supabase each behind one door.
    "boundaries/external": [
      "error",
      {
        default: "allow",
        rules: [
          { from: ["core", "content", "shared"], disallow: ["three", "react", "react-dom", "@capacitor/*", "@supabase/*"] },
          { from: ["services"], disallow: ["three", "react", "react-dom", "@capacitor/*"] },
          { from: ["engine"], disallow: ["react", "react-dom", "@capacitor/*", "@supabase/*"] },
          { from: ["ui"], disallow: ["three", "@capacitor/*", "@supabase/*"] },
          { from: ["platform"], disallow: ["three", "react", "react-dom", "@supabase/*"] },
          { from: ["app"], disallow: ["three", "@capacitor/*", "@supabase/*"] },
        ],
      },
    ],
  },
};
