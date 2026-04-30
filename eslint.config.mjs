import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
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
    "data/browser-workspace/**",
    "logs/**",
    "scripts/**",
    "scratch_*.ts",
    "tree_output.csv",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
