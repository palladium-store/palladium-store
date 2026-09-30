// Verifies every "@/..." import resolves to a file and every named import exists as an export there.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');const src=path.join(root,'src');
const files=[];(function w(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);f.isDirectory()?w(p):/\.(ts|tsx)$/.test(f.name)&&files.push(p)}})(src);
function resolve(spec,from){let base=spec.startsWith('@/')?path.join(src,spec.slice(2)):path.resolve(path.dirname(from),spec);
 for(const c of [base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx'),base])if(fs.existsSync(c)&&fs.statSync(c).isFile())return c;return null}
const exportsOf=f=>{const t=fs.readFileSync(f,'utf8');const s=new Set();let m;
 const re=/export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/g;while(m=re.exec(t))s.add(m[1]);
 const re2=/export\s*\{([^}]*)\}/g;while(m=re2.exec(t))m[1].split(',').forEach(x=>{const n=x.trim().split(/\s+as\s+/).pop();if(n)s.add(n)});
 if(/export\s+default/.test(t))s.add('default');if(/export\s*\*\s*from/.test(t))s.add('*');return s};
let bad=0;const cache={};
for(const f of files){const t=fs.readFileSync(f,'utf8');const re=/import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;let m;
 while(m=re.exec(t)){const spec=m[3];if(!(spec.startsWith('@/')||spec.startsWith('.')))continue;
  const r=resolve(spec,f);if(!r){console.log('UNRESOLVED',path.relative(root,f),spec);bad++;continue}
  const ex=cache[r]||(cache[r]=exportsOf(r));if(ex.has('*'))continue;
  const clause=m[2];const named=clause.match(/\{([\s\S]*)\}/);
  if(named)named[1].split(',').map(x=>x.trim().replace(/^type\s+/,'')).filter(Boolean).forEach(x=>{const n=x.split(/\s+as\s+/)[0].trim();if(!ex.has(n)){console.log('MISSING',path.relative(root,f),n,'from',spec);bad++}});
  const def=clause.replace(/\{[\s\S]*\}/,'').replace(/,/g,'').trim();if(def&&!def.startsWith('*')&&!ex.has('default')){console.log('NODEFAULT',path.relative(root,f),spec);bad++}
 }}
// client components importing server-only modules
const server=/@\/lib\/(db|auth|guard|settings|orders|inventory|products|cart|shipping|payments|email|storage|exports|audit|api|queries\/)/;
for(const f of files){const t=fs.readFileSync(f,'utf8');if(/^\s*['"]use client['"]/.test(t)){const re=/from\s+['"](@\/lib\/[^'"]+)['"]/g;let m;while(m=re.exec(t))if(server.test(m[1])){console.log('CLIENT-IMPORTS-SERVER',path.relative(root,f),m[1]);bad++}}}
console.log(files.length+' files, '+bad+' problems');process.exit(bad?1:0);
