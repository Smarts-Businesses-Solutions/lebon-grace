import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // ── Not application code ────────────────────────────────────────────────
    // Lint was reporting 233 problems, of which 182 were here: 130 in loose
    // root scripts and 52 under scripts/. Almost all are no-require-imports on
    // one-shot CommonJS tooling, much of it left over from the abandoned CJ
    // dropship model. The signal-to-noise ratio was bad enough that nobody ran
    // lint at all, which is the real cost — the ~51 genuine problems in src/
    // were invisible behind the noise.
    //
    // These are excluded rather than fixed because they are not shipped, not
    // imported by the application, and mostly slated for deletion or archival
    // (ACTION_PLAN.md A-9/A-10). Anything here that survives that clear-out and
    // becomes real tooling should be moved under scripts/catalog/ and linted.
    "scripts/**",
    "*.js",
    "*.mjs",
    "*.cjs",
    "!eslint.config.mjs",
    "!postcss.config.mjs",

    // Emitted from Postgres by scripts/catalog/04-generate-catalog.mjs.
    // Hand-editing it is always wrong — the next regenerate discards the edit —
    // so there is nothing useful for a linter to say about it.
    "src/lib/products.generated.ts",

    // Python and browser-automation scratch files from earlier sessions.
    "_pw_*.py",
    "test-screenshots/**",
    "screenshots/**",

    // Git worktrees live under .claude/worktrees/, i.e. INSIDE the repository.
    // Without this, eslint walks into them and lints a second full copy of the
    // codebase: 116 of the 167 problems remaining after the first pass were
    // duplicates of src/ files reported at a .claude/worktrees/... path.
    ".claude/**",
  ]),
]);

export default eslintConfig;
