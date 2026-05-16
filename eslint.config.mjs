import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "prefer-const": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/static-components": "off",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "@next/next/no-assign-module-variable": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "no-var": "warn",
    },
  },
  {
    files: [
      "app/admin/intel/**/*.tsx",
      "app/api/admin/agent/**/*.ts",
      "app/api/admin/intel/**/*.ts",
      "app/api/admin/automation/route.ts",
      "app/api/admin/mastermind/stats/route.ts",
      "lib/ultimate-agent/security-manager.ts",
      "lib/ultimate-agent/agent-core.ts",
      "lib/ultimate-agent/memory-store.ts",
      "lib/ultimate-agent/learning-engine.ts",
      "lib/ultimate-agent/predictive-engine.ts",
      "lib/ultimate-agent/executor-omnipotent.ts",
      "lib/ultimate-agent/index.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "react-hooks/exhaustive-deps": "error",
      "prefer-const": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-build/**",
    "out/**",
    "build/**",
    ".netlify/**",
    "coverage/**",
    "aaca/**",
    "sandbox/**",
    "scratch/**",
    "docker/**",
    "data/browser-workspace/**",
    "logs/**",
    "scripts/**",
    "scratch_*.ts",
    "scratch_*.js",
    "scratch_*.mjs",
    "test_*.js",
    "test_*.ts",
    "verify_api.ts",
    "whatsapp-service.js",
    "fix-legacy-s.js",
    "check_tenant.ts",
    "get_company.ts",
    "tree_output.csv",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
