// Flat config (ESLint 9 / eslint-config-next 16 — `next lint` foi removido no
// Next 16; o script `lint` chama o eslint CLI direto). Migração 1:1 do antigo
// .eslintrc.json.
import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig([
  // `.worktrees/` e `.claude/worktrees/` são checkouts locais completos (de branches
  // candidatas e de outros agentes), cada um com seu próprio `.next/`/`node_modules/`
  // — nunca fonte deste repo; lintá-los explode o eslint com dezenas de milhares de
  // falsos positivos em JS gerado. Faltava `.worktrees/` aqui (só `.claude/worktrees/`
  // estava coberto) — achado em 2026-08-29 rodando `pnpm gov:verify` com 10 worktrees
  // de voz presentes: 46929 erros que sumiram ao adicionar este padrão. Mesma classe
  // de bug já corrigida em `vitest.config.ts` (exclude sem essas duas pastas). (Na CI,
  // checkout limpo, nenhum dos dois diretórios existe.)
  globalIgnores([".next/", "node_modules/", "dist/", "supabase/", "next-env.d.ts", ".worktrees/", ".claude/worktrees/"]),
  nextPlugin.configs["core-web-vitals"],
  reactHooks.configs.flat.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      // react-hooks 7 introduziu esta regra como error; o padrão setState-em-
      // effect é pré-existente em 14 componentes — warn até o mutirão de refactor.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Script CLI do gov-loop (roda via tsx, fora do bundle) — require() ok.
    files: ["loop/**/*.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
