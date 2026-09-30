// Syntax check for every .ts/.tsx file (no dependencies needed). Usage: node tests/syntax-check.cjs [dir...]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ts = require(path.join(cp.execSync('npm root -g').toString().trim(), 'typescript'));
const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['src', 'prisma', 'tests'];
let bad = 0, n = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.name === 'node_modules' || e.name === '.next' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const r of roots) for (const f of walk(r).filter((f) => /\.tsx?$/.test(f))) {
  n++;
  const src = fs.readFileSync(f, 'utf8');
  const out = ts.transpileModule(src, { fileName: f, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  for (const d of out.diagnostics ?? []) { bad++; const { line, character } = ts.getLineAndCharacterOfPosition(d.file, d.start); console.log(`${f}:${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`); }
}
console.log(`${n} files checked, ${bad} syntax error(s)`);
process.exit(bad ? 1 : 0);
