"""Generates prisma/migrations/0001_init/migration.sql from schema.prisma (offline fallback for `prisma migrate dev`).
Once npm is available prefer: npx prisma migrate dev. Custom constraints live in prisma/migrations/0002_constraints."""
import re,sys
src=open('prisma/schema.prisma').read()
enums=dict((m.group(1),m.group(2).split()) for m in re.finditer(r'enum (\w+) \{([^}]*)\}',src))
models={}
for m in re.finditer(r'\nmodel (\w+) \{(.*?)\n\}',src,re.S):
    models[m.group(1)]=m.group(2)
TYPE={'String':'TEXT','Int':'INTEGER','Boolean':'BOOLEAN','DateTime':'TIMESTAMP(3)','Json':'JSONB'}
tab={}
for n,b in models.items():
    mm=re.search(r'@@map\("(\w+)"\)',b); tab[n]=mm.group(1) if mm else n
out=[]
for e,vals in enums.items():
    out.append(f'CREATE TYPE "{e}" AS ENUM ({", ".join(chr(39)+v+chr(39) for v in vals)});')
fks=[];idx=[];uniq=[]
for n,b in models.items():
    cols=[];pk=None
    lines=[l.split('//')[0].strip() for l in b.split('\n')]
    lines=[l for l in lines if l]
    relfields={}
    for l in lines:
        m=re.match(r'(\w+)\s+(\w+)(\[\]|\?)?\s*(.*)',l)
        if l.startswith('@@') or not m: continue
        f,t,mod,rest=m.groups()
        if t in models:
            r=re.search(r'@relation\((?:"\w+",\s*)?fields: \[(\w+)\], references: \[(\w+)\](?:, onDelete: (\w+))?',rest)
            if r and mod!='[]': relfields[r.group(1)]=(t,r.group(2),r.group(3))
    for l in lines:
        m=re.match(r'(\w+)\s+(\w+)(\[\]|\?)?\s*(.*)',l)
        if l.startswith('@@') or not m: continue
        f,t,mod,rest=m.groups()
        if t in models: continue
        if t in enums: sqlt=f'"{t}"'
        else: sqlt=TYPE[t]
        if mod=='[]': sqlt+='[]'
        notnull='' if mod=='?' else ' NOT NULL'
        d=''
        if mod=='[]': d=" DEFAULT ARRAY[]::TEXT[]" if t=='String' else ''
        dm=re.search(r'@default\(([^)]*(?:\([^)]*\))?[^)]*)\)',rest)
        if dm:
            v=dm.group(1)
            if v=='now()': d=' DEFAULT CURRENT_TIMESTAMP'
            elif v in('cuid()',): d=''
            elif v in('true','false'): d=f' DEFAULT {v}'
            elif v.startswith('"'): d=f" DEFAULT '{v.strip(chr(34))}'"
            elif re.fullmatch(r'-?\d+',v): d=f' DEFAULT {v}'
            else: d=f' DEFAULT \'{v}\''
        if '@id' in rest: pk=f
        if '@unique' in rest: uniq.append((n,[f]))
        cols.append(f'    "{f}" {sqlt}{notnull}{d}')
    for l in lines:
        if l.startswith('@@unique'):
            uniq.append((n,re.findall(r'\w+',re.search(r'\[(.*?)\]',l).group(1))))
        if l.startswith('@@index'):
            idx.append((n,re.findall(r'\w+',re.search(r'\[(.*?)\]',l).group(1))))
    cols.append(f'    CONSTRAINT "{tab[n]}_pkey" PRIMARY KEY ("{pk}")')
    out.append(f'CREATE TABLE "{tab[n]}" (\n'+',\n'.join(cols)+'\n);')
    # FKs
    for l in lines:
        m=re.match(r'(\w+)\s+(\w+)(\[\]|\?)?\s*(.*)',l)
        if l.startswith('@@') or not m: continue
        f,t,mod,rest=m.groups()
        r=re.search(r'@relation\((?:"\w+",\s*)?fields: \[(\w+)\], references: \[(\w+)\](?:, onDelete: (\w+))?',rest)
        if t in models and r and mod!='[]':
            od=r.group(3)
            act={'Cascade':'CASCADE','SetNull':'SET NULL'}.get(od) or ('SET NULL' if mod=='?' else 'RESTRICT')
            fks.append(f'ALTER TABLE "{tab[n]}" ADD CONSTRAINT "{tab[n]}_{r.group(1)}_fkey" FOREIGN KEY ("{r.group(1)}") REFERENCES "{tab[t]}"("{r.group(2)}") ON DELETE {act} ON UPDATE CASCADE;')
for n,c in uniq:
    out.append(f'CREATE UNIQUE INDEX "{tab[n]}_{"_".join(c)}_key" ON "{tab[n]}"({", ".join(chr(34)+x+chr(34) for x in c)});')
for n,c in idx:
    out.append(f'CREATE INDEX "{tab[n]}_{"_".join(c)}_idx" ON "{tab[n]}"({", ".join(chr(34)+x+chr(34) for x in c)});')
out+=fks
open('prisma/migrations/0001_init/migration.sql','w').write('\n\n'.join(out)+'\n')
print(len(models),'models',len(enums),'enums',len(fks),'fks')
