import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default defineConfig([
 globalIgnores([".next/**",".next-e2e/**",".local/**",".agents/**",".taste-skill/**","test-results/**","playwright-report/**"]),
 ...tseslint.configs.recommended,
 { files:["src/**/*.tsx"], plugins:{"react-hooks":hooks},rules:{"react-hooks/rules-of-hooks":"error"} },
 { files:["tests/**/*.ts"],rules:{"@typescript-eslint/no-explicit-any":"off"} }
]);
