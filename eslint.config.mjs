import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Browser APIs
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        console: "readonly",
        fetch: "readonly",
        requestAnimationFrame: "readonly",
        AudioContext: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLElement: "readonly",
        PointerEvent: "readonly",
        Image: "readonly",
        URL: "readonly",
        getComputedStyle: "readonly",
        // Node APIs (used by api/ and server)
        process: "readonly",
        require: "readonly",
        module: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["info", "warn", "error"] }],
      eqeqeq: ["error", "always"],
      "prefer-const": ["error"],
      quotes: ["error", "double"],
    },
  },
  {
    files: ["scripts/**/*"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: ["node_modules/*", "vendor/**/*", "data/*", ".vercel/**/*"],
  },
];
