const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,min,max,fallback)=>v==null||v===''||!Number.isFinite(Number(v))?fallback:Math.max(min,Math.min(max,Number(v)));
const pageSlug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function sectionSlots(code=''){
 const fields=new Map();
 for(const match of code.matchAll(/\{\{(text|image):([A-Za-z][A-Za-z0-9 _-]{0,39})\}\}/g))fields.set(match[1]+':'+match[2],{kind:match[1],label:match[2]});
 return [...fields.values()];
}
function imageUrl(path,resolve){
 if(!path || !/^(?:https:\/\/|(?:uploads|assets)\/)/i.test(path))return '';
 return escape(resolve(path));
}
export function layoutStyle(section){
 return ['top','bottom','side','phoneTop','phoneBottom','phoneSide'].flatMap(key=>{
   const value=clamp(section[key],0,240,null);
   return value===null?[]:['--space-'+key+':'+value+'px'];
 }).join(';');
}
export function projectCards(section,data,resolve){
 const cards=(section.cards||[]).map(item=>{
   const project=data.projects.find(p=>p.slug===item.slug);
   if(!project||!pageSlug.test(project.slug))return '';
   const src=imageUrl(item.image||project.cover||project.photos?.[0],resolve);
   return '<a class="th-project-card" data-project="'+project.slug+'" href="'+project.slug+'.html">'+(src?'<img loading="lazy" alt="" src="'+src+'">':'<span class="th-card-placeholder" aria-hidden="true"></span>')+'<strong>'+escape(project.name)+'</strong><small>'+escape(project.location)+'</small></a>';
 }).join('');
 return '<div class="th-project-grid">'+cards+'</div>';
}
export const cardCSS=`
.th-project-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,calc(260px * var(--size-cardWidth,1))),1fr));gap:calc(clamp(18px,3vw,42px) * var(--size-cardGap,1))}
.th-project-card{display:grid;align-content:start;gap:.35em;color:inherit;text-decoration:none;min-width:0}
.th-project-card img,.th-card-placeholder{display:block;width:100%;aspect-ratio:3 / calc(2 * var(--size-cardHeight,1));object-fit:cover;background:linear-gradient(135deg,#303438,#131518);margin-bottom:.65em}
.th-project-card strong{font:500 calc(clamp(1.2rem,2.5vw,2rem) * var(--size-projectTitle,1))/1.18 var(--title-font,Arial,sans-serif)}
.th-project-card small{font-size:.95rem;opacity:.78}
.th-project-card:focus-visible{outline:2px solid currentColor;outline-offset:3px}`;
const fitScript=`
const root=document.querySelector('[data-th-root]');
let last=-1,scheduled=false;
function measure(){
 scheduled=false;
 const height=Math.ceil(Math.max(root.getBoundingClientRect().height,root.scrollHeight));
 if(height!==last){last=height;parent.postMessage({thHeight:height},'*');}
}
function schedule(){if(!scheduled){scheduled=true;queueMicrotask(measure);}}
new ResizeObserver(schedule).observe(root);
new MutationObserver(schedule).observe(root,{subtree:true,childList:true,attributes:true,characterData:true});
window.addEventListener('load',schedule);document.addEventListener('load',schedule,true);
window.addEventListener('message',e=>{if(e.source===parent && e.data==='th-measure'){last=-1;schedule();}});document.fonts.ready.then(schedule);schedule();`;
export function customFrame(section,data,resolve,themeAttrs){
 let code=section.code||'';
 if(!code.trim())return '';
 code=code.replace(/\{\{(text|image):([A-Za-z][A-Za-z0-9 _-]{0,39})\}\}/g,(_,kind,label)=>{
   const value=section.values?.[kind+':'+label];
   return kind==='text'?escape(value??label):imageUrl(value,resolve);
 }).replaceAll('{{project_cards}}',()=>projectCards(section,data,resolve));
 const auto=section.frameMode!=='fixed', theme=section.frameTheme!=='original';
 const rules="default-src 'none'; style-src 'unsafe-inline' https:; img-src https: data: blob:; media-src https: blob:; font-src https: data:; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'";
 const css='*{box-sizing:border-box}body{margin:0;color:#f8f6f1;background:#101211;font:16px Arial,sans-serif}img,video,svg{max-width:100%}[data-th-root]{display:flow-root;min-width:0;overflow-wrap:anywhere}'+cardCSS+
 (auto?'html,body{overflow:hidden;margin:0;height:auto;min-height:0}':'')+
 (theme?'html,body{color:var(--page-ink);background:var(--page-bg);font:var(--body-size)/1.5 Arial,sans-serif}h1,h2,h3{font-family:var(--title-font);font-weight:var(--heading-weight);text-transform:var(--heading-case);line-height:1.08}':'');
 const themeLayer=theme?'<style>[data-th-root]>:is(section,article,main,div):only-of-type{font-family:Arial,sans-serif!important;margin-inline:0!important;max-width:100%!important;padding:0!important;background:var(--page-bg)!important}[data-th-root] :is(h1,h2,h3){font-family:var(--title-font)!important;font-weight:var(--heading-weight)!important;text-transform:var(--heading-case)!important}img[src=""]{display:none}</style>':'';
 const navigation="document.addEventListener('click',e=>{const a=e.target.closest('a[data-project]');if(a){e.preventDefault();parent.postMessage({thProject:a.dataset.project},'*')}});";
 const inner='<!doctype html><html '+themeAttrs+'><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="'+rules+'"><style>'+css+'</style></head><body><div data-th-root>'+code+'</div>'+themeLayer+'<script>'+navigation+(auto?fitScript:'')+'</script></body></html>';
 const height=clamp(section.codeHeight,100,4000,500);
 const allowed=(section.cards||[]).map(i=>i.slug).filter(s=>pageSlug.test(s)&&data.projects.some(p=>p.slug===s));
 return '<iframe class="section-frame" data-fit="'+(auto?'auto':'fixed')+'" data-projects="'+escape(allowed.join(' '))+'" sandbox="allow-scripts" title="'+escape(section.title||section.name||'Custom section')+'" style="--frame-height:'+height+'px;--phone-frame-height:'+clamp(section.phoneCodeHeight,100,4000,height)+'px" srcdoc="'+escape(inner)+'"></iframe>';
}
