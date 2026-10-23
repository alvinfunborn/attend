import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import config from './config.mjs';
const root=path.resolve(fileURLToPath(new URL('../_site/',import.meta.url)));
for(const name of ['index.html','zh/index.html']) {
  const html=await fs.readFile(path.join(root,name),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,`${name}: duplicate IDs`);
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const value=m[1];
    if(/^(https?:|mailto:|data:)/.test(value))continue;
    if(value.startsWith('#')){assert(ids.includes(value.slice(1)),`${name}: broken anchor ${value}`);continue;}
    const target=path.resolve(root,path.dirname(name),value);
    assert(target===root||target.startsWith(root+path.sep),`${name}: path escapes output`);
    await fs.access(value.endsWith('/')?path.join(target,'index.html'):target);
  }
  assert.match(html,/<html lang="(?:en|zh-CN)">/);
  assert.match(html,/<link rel="canonical"/);
  assert.match(html,/<meta property="og:image"/);
  assert.match(html,/type="application\/json" id="demo-data"/);
  assert(!html.includes('undefined'),'Unresolved page content');
  if(config.kofi)assert(html.includes(config.kofi));
  else assert(!html.includes('ko-fi.com/'),'Unconfigured donation links must not be published');
  console.log(`${name}: links, anchors, assets, metadata OK`);
}
