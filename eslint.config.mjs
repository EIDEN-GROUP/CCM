import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint flat configuration.
 *
 * `eslint-config-next` v16 ships a native flat config, so it is used
 * directly rather than through the legacy `@eslint/eslintrc` compatibility
 * layer.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "apps/ccm-browser-bridge/**",
      "src/lib/supabase/database.types.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Honest errors beat silent fallbacks in a data-integrity product.
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}", "scripts/**/*", "apps/ccm-helper/**/*"],
    rules: {
      // The test harness, the scripts and the local helper log to stdout on
      // purpose.
      "no-console": "off",
    },
  },
];

export default eslintConfig;
