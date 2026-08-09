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
    // These are excluded rather than fixed because they are not shipped and not
    // imported by the application.
    //
    // A-9/A-10 have since happened: the loose root scripts are gone (the two
    // remaining root files are this config and postcss.config.mjs), and 54
    // one-shot files moved to scripts/archive/, which has a README explaining
    // each era. What is left under scripts/ is live tooling, so the `scripts/**`
    // ignore is now broader than it needs to be — narrowing it to
    // `scripts/archive/**` and fixing the handful of real problems in the
    // survivors is a reasonable follow-up, not a prerequisite for anything.
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

    // The shared QA harness, vendored so a clone can run its own E2E suite
    // (playwright.config.ts imported it from OUTSIDE the repo until 2026-08-09,
    // which is why CI could not run Playwright at all).
    //
    // Not this project's code to lint. It is shared, deliberately untyped
    // JS-style code — three `no-explicit-any` errors on arrival — and it is
    // already excluded from tsconfig.json for the same reason, with
    // tsconfig.e2e.json type-checking it at `strict: false`.
    //
    // Fixing the `any`s here would be worse than ignoring them: the vendored
    // copy must stay byte-identical to the shared kit (src/lib/qa-kit-drift.test.ts
    // enforces that), so a local fix would show up as drift on the next run.
    // Corrections belong in aprojects/ops/qa, then get copied back down.
    "ops/qa/**",

    // Git worktrees live under .claude/worktrees/, i.e. INSIDE the repository.
    // Without this, eslint walks into them and lints a second full copy of the
    // codebase: 116 of the 167 problems remaining after the first pass were
    // duplicates of src/ files reported at a .claude/worktrees/... path.
    ".claude/**",
  ]),

  {
    rules: {
      // `_foo` means "this parameter exists to hold a position, and I know it is
      // unused". It is the standard convention and eslint does not assume it by
      // default. Without this, every mock declared to type `mock.calls` — the
      // parameters exist ONLY so `mock.calls[0][1]` type-checks — is reported as
      // a problem, which is 20 of the warnings in this project and none of them
      // real. Silencing them by deleting the parameters would reintroduce the
      // "Tuple type '[]' has no element at index 1" compile errors they fix.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
