const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".npm-cache/**",
      "coverage/**",
      "frontend/**"
    ]
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        { allowExpressions: true }
      ]
    }
  },
  {
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off"
    }
  }
];
