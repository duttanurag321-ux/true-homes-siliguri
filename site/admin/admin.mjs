import {render,validate,visualDefaults} from './render.mjs';
import {repository,request} from './github.mjs';
const $=s=>document.querySelector(s);
const tabs=['Overview','Brand & menu','Homepage','Projects','Appearance'];
let data, original, repo, head, db, busy=false, tab='Overview', selected='', dragging=null;
let pending=new Map(), urls=new Map(), draftWrites=Promise.resolve();
const note=text=>$('#status').textContent=text;
function el(tag,text='',cls=''){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,fn,cls){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
function box(parent,title){const b=el('div','','box');if(title)b.append(el('h2',title));parent.append(b);return b;}
function save(){
  const paths=JSON.stringify(data);
  for(const path of pending.keys())if(!paths.includes(JSON.stringify(path))){pending.delete(path);URL.revokeObjectURL(urls.get(path));urls.delete(path);}
  const snap=structuredClone({data,original,pending});
  draftWrites=draftWrites.then(()=>new Promise((resolve,reject)=>{
    const tx=db.transaction('draft','readwrite');tx.objectStore('draft').put(snap,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  })).catch(()=>note('Device storage is full or unavailable. Keep this tab open and publish or download your draft.'));
}
function field(parent,label,obj,key,opts={}){
 const wrap=el('label',label,'field'), input=el(opts.choices?'select':opts.long?'textarea':'input');
 if(opts.choices)for(const [value,name] of opts.choices)input.add(new Option(name,value));
 if(opts.num){input.type='number';input.min=opts.num[0];input.max=opts.num[1];}
 if(opts.code)input.className='code';
 input.value=obj[key]??'';if(opts.placeholder)input.placeholder=opts.placeholder;
 input.oninput=()=>{obj[key]=opts.num && input.value!==''?Number(input.value):input.value;};
 input.onchange=()=>{save();if(opts.refresh)draw();};
 wrap.append(input);parent.append(wrap);return input;
}
function move(list,from,to){if(to>=0&&to<list.length&&from!==to){list.splice(to,0,list.splice(from,1)[0]);save();draw();}}
function controls(parent,list,index,thing){
 const row=el('div','','tools');row.append(button('↑',()=>move(list,index,index-1)),button('↓',()=>move(list,index,index+1)),button('Remove',()=>{if(confirm('Remove '+thing+' from this draft?')){list.splice(index,1);save();draw();}},'danger'));parent.append(row);
}
function resolve(path){return urls.get(path)||path;}
const types={icon:{png:'image/png',ico:'image/x-icon',webp:'image/webp'},image:{jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif'},video:{mp4:'video/mp4',webm:'video/webm'}};
function mediaField(parent,label,obj,key,kind='image',multi=false){
 const area=el('div','','subcard');parent.append(area);
 const allowed=kind==='plan'?{...types.image,pdf:'application/pdf'}:types[kind];
 const items=multi?obj[key]:[obj[key]].filter(Boolean);
 area.append(el('strong',label));
 items.forEach((path,i)=>{
   const line=el('div','','row');line.append(el('small',path.split('/').pop()));
   line.append(button('Remove',()=>{if(multi)obj[key].splice(i,1);else obj[key]='';save();draw();}));
   area.append(line);
   if(/\.(?:png|jpe?g|webp|gif|avif)$/i.test(path)){const im=el('img','','thumb');im.alt='';im.src=urls.get(path)||new URL('../'+path,location.href);area.append(im);}
 });
 const lab=el('label',multi?'Add files':'Choose file','upload'),inp=el('input');inp.type='file';inp.multiple=multi;inp.accept=Object.keys(allowed).map(x=>'.'+x).join(',');
 inp.onchange=()=>{
   try{
    const files=[...inp.files];for(const f of files){const ext=f.name.split('.').pop().toLowerCase();if(!allowed[ext]||!f.size||f.size>24*1024*1024)throw Error('Choose one of the listed file types, up to 24 MiB per file.');}
    for(const f of files){const ext=f.name.split('.').pop().toLowerCase(),path='uploads/'+crypto.randomUUID()+'-'+f.name.replace(/\.[^.]*$/,'').replace(/[^a-z0-9-]/gi,'-').slice(0,45)+'.'+ext;pending.set(path,f);urls.set(path,URL.createObjectURL(f));if(multi)obj[key].push(path);else obj[key]=path;}
    save();draw();
   }catch(e){note(e.message);}
 };
 lab.append(inp);area.append(lab);
}
function destination(parent,obj,key){
 const input=field(parent,'Button or menu link',obj,key);
 const select=el('select');select.setAttribute('aria-label','Choose an existing destination');
 select.add(new Option('Choose a page or section…',''));
 select.add(new Option('Homepage','index.html'));
 for(const s of data.sections)select.add(new Option(s.title||s.id,'index.html#'+s.id));
 for(const p of data.projects)select.add(new Option(p.name,p.slug+'.html'));
 select.onchange=()=>{if(select.value){obj[key]=select.value;input.value=select.value;save();}};parent.append(select);
}
function overview(panel){
 panel.append(el('h1','Website dashboard'));
 const b=box(panel,'Edit your website');b.append(el('p',data.projects.length+' projects · '+data.sections.length+' homepage sections'));
 const grid=el('div','','grid');for(const name of tabs.slice(1))grid.append(button(name,()=>go(name)));b.append(grid);
 const pub=box(panel,'Save and publish');pub.append(el('p','Changes are saved on this browser as a draft. Preview your draft on desktop and phone, then publish when you are ready.'));
 pub.append(button('Sign out',async()=>{try{await request('logout',{});repo=null;head=null;go('Overview');note('Signed out.');}catch(e){note(e.message);}}));
 const util=box(panel,'Draft tools');util.append(button('Download content JSON',()=>{const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='true-homes-content.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}),el('p','The download contains text and file paths. New media stay in this browser until published.','hint'),button('Discard draft and reload latest',async()=>{if(!confirm('Discard this device’s draft and its unpublished uploads?'))return;try{const live=repo?await repo.load():{data:await publicData()};data=live.data;original=structuredClone(data);head=live.sha||null;for(const u of urls.values())URL.revokeObjectURL(u);urls.clear();pending.clear();save();draw();note('Latest version loaded.');}catch(e){note(e.message);}}));
}
function appearance(panel){
 panel.append(el('h1','Appearance'));
 const a=data.appearance={...visualDefaults,...data.appearance};
 const glass=box(panel,'Glass surfaces');
 glass.append(el('p','Adjust the header, menus, buttons and floating controls. Use Preview to check the result over your own project photos.'));
 field(glass,'Frost / blur (0–40 px)',a,'blur',{num:[0,40]});
 field(glass,'Dark tint (20–88%)',a,'tint',{num:[20,88]});
 field(glass,'Corner radius (0–36 px)',a,'radius',{num:[0,36]});
 field(glass,'Glass highlight colour',a,'accent').type='color';
 field(glass,'Heading style',a,'heading',{choices:[['modern','Modern sans serif'],['serif','Classic serif'],['wide','Wide sans serif']]});
 const motion=box(panel,'Animation and scrolling');
 field(motion,'Page effects',a,'motion',{choices:[['standard','Cinematic movement'],['subtle','Gentle fades'],['still','Still — no automatic motion']]});
 field(motion,'Transition speed',a,'speed',{choices:[['fast','Fast'],['normal','Normal'],['slow','Slow']]});
 field(motion,'Project slides',a,'slides',{choices:[['auto','Automatic'],['manual','Swipe or use arrows']]});
 field(motion,'Seconds between automatic slides (2–20)',a,'interval',{num:[2,20]});
 field(motion,'Header behaviour',a,'header',{choices:[['scroll','Hide on scroll down'],['fixed','Always visible']]});
 const layout=box(panel,'Typography and layout');
 field(layout,'Heading capitalization',a,'letterCase',{choices:[['uppercase','Uppercase'],['none','As written']]});
 field(layout,'Heading weight',a,'weight',{choices:[['380','Light'],['500','Medium'],['700','Bold']]});
 field(layout,'Body text size (14–22 px)',a,'bodySize',{num:[14,22]});
 field(layout,'Hero text alignment',a,'heroAlign',{choices:[['left','Left'],['center','Center'],['right','Right']]});
 field(layout,'Hero image shading (0–100%)',a,'shade',{num:[0,100]});
 field(layout,'Page background',a,'background').type='color';
 field(layout,'Default text colour',a,'foreground').type='color';
 const identity=box(panel,'Browser tab icon');
 mediaField(identity,'Favicon',data,'favicon','icon');identity.append(el('p','Use a square PNG, WebP or ICO. The True Homes symbol is the default.','hint'));
}
function brand(panel){
 panel.append(el('h1','Brand & menu'));const b=box(panel,'Brand settings');field(b,'Company name',data,'brand');mediaField(b,'Logo',data,'logo');field(b,'WhatsApp number including country code',data,'phone');
 const nav=box(panel,'Menu links');data.menu.forEach((m,i)=>{const div=el('div','','subcard');nav.append(div);field(div,'Label',m,'label');destination(div,m,'url');controls(div,data.menu,i,'this menu link');});
 nav.append(button('Add menu link',()=>{data.menu.push({label:'New link',url:'index.html'});save();draw();}));
}
const captions={hero:'Hero banner',projects:'Project showcase',gallery:'Project photo gallery',spotlight:'Featured project carousel',help:'WhatsApp quick links',contact:'Site visit form',text:'Text and image',custom:'Custom code section'};
const starter = `<style>
  .visit { padding: clamp(24px, 7vw, 80px); background: #10251e; color: #fff; }
  .visit h2 { margin: 0 0 12px; font: 500 clamp(28px, 6vw, 56px)/1.1 Georgia, serif; }
  .visit p { max-width: 48ch; line-height: 1.6; }
</style>
<section class="visit"><h2>Plan your site visit</h2><p>Tell us which Siliguri project you would like to explore.</p></section>`;
function codeFields(b,obj){
 const guide=el('details','','code-guide');guide.append(el('summary','How to create a section with ChatGPT'));b.append(guide);
 const promptText='Create a responsive section for the True Homes real estate website. Return one paste-ready HTML fragment containing a <style> block, semantic HTML, and optional inline vanilla JavaScript in <script>. Use mobile-first CSS, accessible labels and keyboard controls. It runs in a sandboxed iframe. Use absolute HTTPS image URLs. Keep interactivity inside the section. Do not use Liquid, React, imports, fetch, forms, external scripts or Markdown fences. Use the editor’s separate button for outbound links. My section should show: [describe the content, colours and layout].';
 guide.append(el('p','Paste HTML, CSS and optional JavaScript together in one field. The section has its own styles. Use the preview to check each screen size.'),el('p',promptText,'prompt'));
 guide.append(button('Copy ChatGPT prompt',async()=>{try{await navigator.clipboard.writeText(promptText);note('Prompt copied. Replace the text in brackets with your section idea.');}catch{note('Select the prompt above and copy it.');}}));
 const code=field(b,'Section code',obj,'code',{long:true,code:true,placeholder:'Paste your <style>, HTML and optional <script> together'});
 b.append(button('Use starter section',()=>{if(code.value.trim()&&!confirm('Replace this section’s code with the starter?'))return;code.value=obj.code=starter;save();code.focus();}));
 field(b,'Desktop frame height (100–4000 px)',obj,'codeHeight',{num:[100,4000]});
 field(b,'Phone frame height (blank uses desktop)',obj,'phoneCodeHeight',{num:[100,4000]});
}
function homepage(panel){
 panel.append(el('h1','Homepage editor'),el('p','Open a section to edit it. Drag its handle to change the order, or use the arrows.'));
 data.sections.forEach((s,i)=>{
  const card=el('details','','card'),title=el('summary');title.append(el('span','⠿ ','grip'),document.createTextNode((i+1)+'. '+(s.title||captions[s.type])));card.append(title);card.open=selected===s.id;card.ontoggle=()=>{if(card.open)selected=s.id;};
  title.draggable=true;title.ondragstart=e=>{dragging=s.id;e.dataTransfer.setData('text/plain',s.id);};title.ondragend=()=>dragging=null;
  card.ondragover=e=>{if(dragging)e.preventDefault();};card.ondrop=e=>{e.preventDefault();if(dragging){move(data.sections,data.sections.findIndex(x=>x.id===dragging),i);dragging=null;}};
  panel.append(card);card.append(button('Duplicate section',()=>{const copy=structuredClone(s);copy.id=s.type+'-'+crypto.randomUUID().slice(0,8);data.sections.splice(i+1,0,copy);selected=copy.id;save();draw();}));controls(card,data.sections,i,'this section');field(card,'Heading',s,'title');field(card,'Short description',s,'text',{long:true});
  if(s.type==='hero'){
    field(card,'Show',s,'mode',{choices:[['video','Video'],['image','Image']],refresh:true});
    if(s.mode==='video'){mediaField(card,'Desktop hero video',s,'wide','video');mediaField(card,'Mobile hero video',s,'tall','video');}
    mediaField(card,'Desktop image / video cover',s,'image');mediaField(card,'Mobile image / video cover',s,'portrait');
    field(card,'Desktop height (% of screen)',s,'height',{num:[30,100]});field(card,'Mobile height (% of screen)',s,'mobileHeight',{num:[30,100]});
    field(card,'Media fit',s,'fit',{choices:[['cover','Fill the banner'],['contain','Show the whole image or video']]});
  }
  if(s.type==='help'){
    s.actions ||= [];
    s.actions.forEach((a,i)=>{const line=el('div','','subcard');card.append(line);field(line,'Action label',a,'label');field(line,'WhatsApp message',a,'message');controls(line,s.actions,i,'this action');});
    card.append(button('Add WhatsApp action',()=>{s.actions.push({label:'Ask True Homes',message:'I have a property enquiry.'});save();draw();}));
  }
  if(s.type==='text')mediaField(card,'Section image',s,'image');
  if(s.type==='custom')codeFields(card,s);
  if(['hero','text','custom'].includes(s.type)){field(card,'Button text',s,'button');destination(card,s,'url');}
 });
 const b=box(panel,'Add a section'),sel=el('select');for(const [k,v]of Object.entries(captions))sel.add(new Option(v,k));sel.value='text';
 const position=el('select');position.setAttribute('aria-label','Insert section at');
 data.sections.forEach((s,i)=>position.add(new Option('Before '+(s.title||captions[s.type]),i)));
 position.add(new Option('At the bottom',data.sections.length));position.value=data.sections.length;
 b.append(sel,position,button('Add section',()=>{const type=sel.value,id=type+'-'+crypto.randomUUID().slice(0,8);data.sections.splice(Number(position.value),0,{type,id,title:captions[type],text:'',url:'',button:'',mode:'image',height:85,mobileHeight:75,fit:'cover',codeHeight:500});selected=id;save();draw();}));
}
function projects(panel){
 panel.append(el('h1','Projects'));
 const actions=el('div','','actions');panel.append(actions);
 const pick=el('select');pick.setAttribute('aria-label','Choose project');
 for(const p of data.projects)pick.add(new Option(p.name,p.slug));
 const p=data.projects.find(p=>p.slug===selected)||data.projects[0];if(p)pick.value=p.slug;
 pick.onchange=()=>{selected=pick.value;draw();};actions.append(pick,button('Add project',()=>{
  const name=prompt('Project name');if(!name?.trim())return;
  const base=name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'property';
  let slug=base,n=2;while(data.projects.some(p=>p.slug===slug)||['index','admin','buyer-guide','preview','404'].includes(slug))slug=base+'-'+n++;
  data.projects.push({name:name.trim(),slug,type:'',location:'',price:'',size:'',status:'',about:'',maps:'',cover:'',photos:[],floor:[],site:[],code:'',codeHeight:700});selected=slug;save();draw();
 }));
 if(!p)return;
 const b=box(panel,'Project details');b.append(el('p','Page link: '+p.slug+'.html','hint'));
 for(const [k,l]of Object.entries({name:'Project name',type:'Property type',location:'Location',price:'Price (for example, From ₹65 lakh)',size:'Size (for example, 1,800 sq ft)',status:'Project status',about:'About the project',maps:'Google Maps share link'}))field(b,l,p,k,{long:k==='about'});
 const m=box(panel,'Photos and plans');mediaField(m,'Project cover photo',p,'cover');mediaField(m,'Project photos',p,'photos','image',true);mediaField(m,'Floor plans · image or PDF',p,'floor','plan',true);mediaField(m,'Site plans · image or PDF',p,'site','plan',true);
 const c=box(panel,'Custom project page');field(c,'Page layout',p,'layout',{choices:[['standard','Project details, then optional custom content'],['custom','My custom page with enquiry buttons']]});codeFields(c,p);
 const z=box(panel,'Remove project');z.append(button('Remove this project',()=>{if(!confirm('Remove '+p.name+'? Its page will be removed on publish.'))return;data.projects.splice(data.projects.indexOf(p),1);selected='';save();draw();},'danger'));
}
function go(name){tab=name;selected='';draw();window.scrollTo(0,0);}
function draw(){
 $('#connection').textContent=repo?'Signed in · True Homes':'Owner dashboard';
 const nav=$('#tabs');nav.replaceChildren();for(const t of tabs){const b=button(t,()=>go(t));b.setAttribute('aria-current',String(t===tab));nav.append(b);}
 const panel=$('#panel');panel.replaceChildren();
 if(!repo){nav.replaceChildren();panel.append(el('h1','Website dashboard'));
   const b=box(panel,'Owner sign-in');b.append(el('p','Sign in with your user ID and password to edit and publish.'),button('Sign in',()=>$('#login').showModal(),'primary'));
   return;
 }
 [overview,brand,homepage,projects,appearance][tabs.indexOf(tab)](panel);
}
let previewHTML='';
function updateFrame(){
 const page=$('#preview-page').value;
 const root=new URL('../',location.href).href;
 previewHTML=render(data,page,path=>urls.get(path)||new URL(path,root).href)
   .replace('<head>','<head><base href="'+root+'">').replace('<body>','<body data-preview>');
 $('#frame').src='../preview.html?view='+crypto.randomUUID();
}
$('#preview').onclick=()=>{if(!repo){$('#login').showModal();return;}const sel=$('#preview-page');sel.replaceChildren(new Option('Homepage','index'));for(const p of data.projects)sel.add(new Option(p.name,p.slug));sel.value=tab==='Projects'?(data.projects.find(p=>p.slug===selected)||data.projects[0])?.slug||'index':'index';updateFrame();$('#viewer').showModal();};
window.addEventListener('message',event=>{
 const frame=$('#frame');
 if(event.source!==frame.contentWindow||!$('#viewer').open)return;
 if(event.data==='true-homes-preview-ready'){frame.contentWindow.postMessage({html:previewHTML},'*');return;}
 if(!event.data?.previewPage)return;
 const page=event.data.previewPage;
 if(page==='index'||data.projects.some(p=>p.slug===page)){$('#preview-page').value=page;updateFrame();}
});
$('#preview-page').onchange=updateFrame;$('#phone').onclick=()=>$('#frame').classList.add('mobile');$('#desktop').onclick=()=>$('#frame').classList.remove('mobile');$('#close-preview').onclick=()=>{$('#viewer').close();$('#frame').src='about:blank';previewHTML='';};
async function resume(){
 const live=await repository.load();
 repo=repository;
 if(JSON.stringify(live.data)!==JSON.stringify(original) && JSON.stringify(data)!==JSON.stringify(original)){
   head=null;draw();note('Your draft is based on an older version. Download it under Draft tools, then discard and reload before publishing.');return;
 }
 if(JSON.stringify(data)===JSON.stringify(original)){data=live.data;original=structuredClone(data);}
 head=live.sha;save();draw();note('Signed in. Draft changes stay on this device until you publish.');
}
$('#login').addEventListener('close',()=>{$('#password').value='';$('#login-error').textContent='';});
$('#credentials').onsubmit=async event=>{
 event.preventDefault();$('#connect').disabled=true;
 try{await request('login',{user:$('#user').value,password:$('#password').value});await resume();$('#login').close();}
 catch(e){$('#login-error').textContent=e.message;}finally{$('#connect').disabled=false;}
};
$('#publish').onclick=async()=>{
 if(busy)return;if(!repo){$('#login').showModal();return;}
 try{validate(data);if(!confirm('Publish these changes to the True Homes production branch?'))return;busy=true;document.querySelector('.shell').inert=true;
  if(!head)throw Error('Download your draft and reload the latest version in Draft tools.');
  head=await repo.publish(head,data,pending,note);original=structuredClone(data);pending.clear();save();
  note('Saved to GitHub. Cloudflare will update the live site after its connected build succeeds.');draw();
 }catch(e){if(e.status===401){repo=null;draw();$('#login').showModal();}note(e.message);}finally{busy=false;document.querySelector('.shell').inert=false;}
};
async function publicData(){const res=await fetch('../content.json',{cache:'no-store'});if(!res.ok)throw Error('Cannot read site/content.json. Check the upload folder.');return res.json();}
async function start(){
 data=await publicData();original=structuredClone(data);
 db=await new Promise((res,rej)=>{const req=indexedDB.open('true-homes-editor-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('draft');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});
 const draft=await new Promise((res,rej)=>{const req=db.transaction('draft').objectStore('draft').get('current');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});
 if(draft && (JSON.stringify(draft.data)!==JSON.stringify(draft.original)||draft.pending.size)){({data,original,pending}=draft);for(const [path,file]of pending)urls.set(path,URL.createObjectURL(file));}
 draw();try{await resume();}catch(e){note(e.status===401?'Sign in to open the website editor.':e.message);}
}
start().catch(e=>note('Editor could not start. Open /admin/ on the hosted site in a browser with local storage enabled. '+e.message));
