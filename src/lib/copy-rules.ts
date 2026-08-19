import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

/**
 * The house copy rules, and the machinery that finds where they are broken.
 *
 * THE RULE. No em dashes or en dashes in anything a customer reads. It is an
 * operator instruction, not a style preference: the dash is the single clearest
 * tell that a human did not write the sentence, and this shop sells hand-made
 * objects.
 *
 * WHY THIS IS A CHECKER AND NOT A FIND-AND-REPLACE. A blanket substitution gets
 * it wrong in both directions. `Mon–Fri` and `AED 15–20` are ranges where the
 * dash means "to" and the fix is a hyphen, not a comma. A quoted source title
 * or a company's own name is a transcription of someone else's words and must
 * not be restyled at all. So this reports and blocks; a person decides.
 *
 * WHY IT PARSES RATHER THAN GREPS. The rule explicitly exempts comments and
 * docstrings — this file is full of prose that would trip a regex. Walking the
 * TypeScript AST means only real string literals and JSX text are considered,
 * which is exact rather than approximately right.
 *
 * Modelled on cancel-atlas, where the same rule lived in three documents and
 * was enforced in two peripheral scripts, and 2,076 pages shipped with em
 * dashes anyway because the generators never called it. One checker, called at
 * the exit every path goes through.
 */

/** Em dash and en dash. Hyphen-minus is fine and is usually the right answer. */
export const BANNED_DASHES = /[—–]/;

/**
 * Directories whose strings are read by an operator, not a customer.
 *
 * The rule says so itself: internal tooling is out of scope. /admin is the
 * workshop console, seen only by someone who logged in, and holding it to
 * marketing copy standards would be enforcing a rule against its own stated
 * purpose.
 */
const INTERNAL = ["src/app/admin/", "src/components/OperationsDashboard"];

/**
 * Calls whose arguments are logs, not copy.
 *
 * `console.error("could not load — retrying")` is a diagnostic. It reaches a
 * developer and GlitchTip, never a customer.
 */
const LOG_CALLS = new Set(["console.log", "console.warn", "console.error", "console.info", "console.debug"]);

export interface Offender {
  file: string;
  line: number;
  text: string;
}

const isInternal = (rel: string) =>
  INTERNAL.some((p) => rel.replace(/\\/g, "/").startsWith(p) || rel.replace(/\\/g, "/").includes(p));

/** Every .ts/.tsx under src, minus tests and minus the checker's own fixtures. */
function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(path.join(root, "src"));
  return out;
}

/** Is this node an argument to console.something? */
function insideLogCall(node: ts.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && LOG_CALLS.has(p.expression.getText())) return true;
  }
  return false;
}

/**
 * Find every banned dash in customer-visible text under `root`.
 *
 * Returns offenders rather than throwing, so a test can print all of them at
 * once. Being handed one failure at a time across forty files is how a cleanup
 * gets abandoned halfway.
 */
export function findDashOffenders(root: string): Offender[] {
  const offenders: Offender[] = [];

  for (const file of sourceFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (isInternal(rel)) continue;

    const src = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const visit = (node: ts.Node) => {
      const carriesCopy =
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node) ||
        ts.isJsxText(node);

      if (carriesCopy && BANNED_DASHES.test(node.text) && !insideLogCall(node)) {
        const { line } = src.getLineAndCharacterOfPosition(node.getStart(src));
        // The dash plus a little either side, so the report says enough to act
        // on without printing a whole template literal.
        // [\s\S] rather than the dotAll flag: tsconfig targets below es2018,
        // where /s is a compile error rather than a runtime one.
        const match = node.text.match(/[\s\S]{0,40}[—–][\s\S]{0,40}/);
        offenders.push({
          file: rel,
          line: line + 1,
          text: (match?.[0] ?? node.text).replace(/\s+/g, " ").trim(),
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(src);
  }

  return offenders;
}
