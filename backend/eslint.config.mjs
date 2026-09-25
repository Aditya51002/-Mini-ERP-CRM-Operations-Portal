import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        process: "readonly",
        AbortSignal: "readonly",
        console: "readonly",
        fetch: "readonly",
        Buffer: "readonly"
      }
    },
    rules: { "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": "error" }
  }
);
