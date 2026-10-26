import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parse as parseJS} from 'acorn';
import {parse as parseICU} from '@formatjs/icu-messageformat-parser';
import {fileURLToPath} from 'node:url';

const cwd=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
const source=path.resolve(args[0]||'');
const target=path.resolve(args[1]||'');
if(args.length!==2)throw Error('Usage: node localize.mjs <original-app-directory> <NEW-output-app-directory>');
if(target===source||target.startsWith(source+path.sep)||source.startsWith(target+path.sep))throw Error('Source and output must be separate directories');
if(fs.existsSync(target))throw Error('Output already exists; choose a new empty location');
const expected=JSON.parse(fs.readFileSync(path.join(cwd,'localization-report.json'),'utf8'));
for(const item of [...expected.binaries,...expected.modifiedBundles.map(x=>({file:x.path,sha256:x.before}))]){
 const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(source,item.file))).digest('hex');
 if(actual!==item.sha256)throw Error('Unsupported or modified source file: '+item.file);
}
console.log('Source verified. Copying app to '+target);
fs.cpSync(source,target,{recursive:true,errorOnExist:true,force:false});
const upstream=cwd;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,data)=>fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n','utf8');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const en=read(path.join(source,'resources/ion-dist/i18n/en-US.json'));
const pack=read(path.join(upstream,'translations/frontend-zh-CN.json'));
const overrides=read(path.join(cwd,'translations/overrides.json'));

function signature(text){
 const names=new Set();
 function visit(nodes){for(const node of nodes){
  if([1,2,3,4,5,6,8].includes(node.type))names.add(`${node.type===8?'tag':'arg'}:${node.value}`);
  if(node.children)visit(node.children);
  if(node.options)for(const option of Object.values(node.options))visit(option.value);
 }}
 visit(parseICU(text));return [...names].sort().join('|');
}
function valid(a,b){try{return typeof b==='string'&&signature(a)===signature(b);}catch{return false;}}
const byText=new Map();
const rejected=[];
for(const [id,english] of Object.entries(en)){
 const translated=pack[id];
 if(translated&&translated!==english&&valid(english,translated)&&!byText.has(english))byText.set(english,translated);
}
const zh={};let reused=0;
for(const [id,english] of Object.entries(en)){
 let translated=overrides[english]??overrides[id]??pack[id]??byText.get(english)??english;
 if(!valid(english,translated)){rejected.push({id,english,translation:translated});translated=english;}
 if(!(id in pack)&&byText.has(english)&&translated!==english)reused++;
 zh[id]=translated;
}
const res=path.join(target,'resources');
const ion=path.join(res,'ion-dist');
write(path.join(ion,'i18n/zh-CN.json'),zh);
const desktopEn=read(path.join(source,'resources/en-US.json'));
const desktopPack=read(path.join(upstream,'translations/desktop-zh-CN.json'));
const desktopNative=read(path.join(source,'resources/zh-Hans.json'));
const desktop={};
for(const [id,text] of Object.entries(desktopEn)){
 const translated=desktopNative[id]??desktopPack[id]??text;
 desktop[id]=valid(text,translated)?translated:text;
}
write(path.join(res,'zh-CN.json'),desktop);
const dynamicEn=read(path.join(source,'resources/ion-dist/i18n/dynamic/en-US.json'));
const dynamic={};
for(const [id,text] of Object.entries(dynamicEn))dynamic[id]=overrides[text]??byText.get(text)??text;
for(const [id,text] of Object.entries(dynamic))if(!valid(dynamicEn[id],text))throw Error('Invalid dynamic ICU '+id);
write(path.join(ion,'i18n/dynamic/zh-CN.json'),dynamic);

const assets=path.join(ion,'assets/v1');
const base='["en-US","de-DE","fr-FR","ko-KR","ja-JP","es-419","es-ES","it-IT","hi-IN","pt-BR","id-ID"]';
const files=[];let registrations=0,defaults=0;
const missingByFile={};
for(const name of fs.readdirSync(assets).filter(x=>x.endsWith('.js'))){
 const original=fs.readFileSync(path.join(source,'resources/ion-dist/assets/v1',name),'utf8');
 let text=original;
 if(text.includes(base)){registrations+=text.split(base).length-1;text=text.split(base).join(base.slice(0,-1)+',"zh-CN"]');}
 if(text.includes('defaultMessage:')){
  const ast=parseJS(text,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});
  const edits=[]; const pending=[ast]; const missing=[];
  while(pending.length){const node=pending.pop();
   if(node.type==='ObjectExpression'){
    const properties=new Map(node.properties.filter(p=>p.type==='Property'&&!p.computed).map(p=>[p.key.name??p.key.value,p.value]));
    const message=properties.get('defaultMessage'),id=properties.get('id');
    if(message?.type==='Literal'&&typeof message.value==='string'){
     const translation=(id?.type==='Literal'?zh[id.value]:undefined)??overrides[message.value]??byText.get(message.value);
     if(translation&&translation!==message.value&&valid(message.value,translation)){
      edits.push({start:message.start,end:message.end,value:JSON.stringify(translation)});
     }else if(/[A-Za-z]{3}/.test(message.value))missing.push({id:id?.value,text:message.value});
    }
   }
   for(const value of Object.values(node)){
    if(Array.isArray(value)){for(const item of value)if(item&&typeof item.type==='string')pending.push(item);}
    else if(value&&typeof value.type==='string')pending.push(value);
   }
  }
  for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.value+text.slice(edit.end);
  defaults+=edits.length;
  if(missing.length)missingByFile[name]=missing;
 }
 if(text!==original){
  parseJS(text,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});
  fs.writeFileSync(path.join(assets,name),text,'utf8');
  files.push({path:'resources/ion-dist/assets/v1/'+name,before:crypto.createHash('sha256').update(original).digest('hex'),after:hash(path.join(assets,name))});
 }
}
if(!registrations)throw Error('Language whitelist not found');
const binaries=['Claude.exe','resources/app.asar'];
for(const file of binaries)if(hash(path.join(source,file))!==hash(path.join(target,file)))throw Error('Unexpected binary modification: '+file);
const count=Object.keys(en).length;
const translated=Object.keys(en).filter(k=>zh[k]!==en[k]).length;
const report={version:'3.6556.2',upstream:'https://github.com/javaht/claude-desktop-zh-cn',revision:'b2d5a8394549d9a9f38a66b4aa6e53f1226a62d4',publicCatalog:{total:count,translated,englishFallback:count-translated,reusedByEnglishText:reused,rejected:rejected.length},dynamic:{total:Object.keys(dynamic).length,translated:Object.keys(dynamic).filter(k=>dynamic[k]!==dynamicEn[k]).length},defaultMessagesPatched:defaults,whitelistsPatched:registrations,modifiedBundles:files,binaries:binaries.map(file=>({file,sha256:hash(path.join(target,file)),unchanged:true}))};
write(path.join(target,'localization-report.json'),report);write(path.join(target,'rejected-translations.json'),rejected);write(path.join(target,'missing-by-file.json'),missingByFile);
console.log(JSON.stringify({...report,modifiedBundles:files.length},null,2));
