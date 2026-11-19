import {render,validate} from './render.mjs';
import {repository} from './github.mjs';
const $=s=>document.querySelector(s);
const tabs=['Overview','Brand & menu','Homepage','Projects'];
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
 input.oninput=()=>{obj[key]=opts.num?Number(input.value):input.value;};
 input.onchange=()=>{save();if(opts.refresh)draw();};
 wrap.append(input);parent.append(wrap);return input;
}
function move(list,from,to){if(to>=0&&to<list.length&&from!==to){list.splice(to,0,list.splice(from,1)[0]);save();draw();}}
function controls(parent,list,index,thing){
 const row=el('div','','tools');row.append(button('↑',()=>move(list,index,index-1)),button('↓',()=>move(list,index,index+1)),button('Remove',()=>{if(confirm('Remove '+thing+' from this draft?')){list.splice(index,1);save();draw();}},'danger'));parent.append(row);
}
function resolve(path){return urls.get(path)||path;}
const types={image:{jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif'},video:{mp4:'video/mp4',webm:'video/webm'}};
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
 const pub=box(panel,'Save and publish');pub.append(el('p','Changes are saved on this browser as a draft. Preview them, then connect GitHub and publish when you are ready.'));
 pub.append(button(repo?'Disconnect GitHub':'Connect GitHub',()=>{if(repo){repo=null;head=null;draw();}else $('#login').showModal();}));
 const util=box(panel,'Draft tools');util.append(button('Download content JSON',()=>{const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='true-homes-content.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}),el('p','The download contains text and file paths. New media stay in this browser until published.','hint'),button('Discard draft and reload latest',async()=>{if(!confirm('Discard this device’s draft and its unpublished uploads?'))return;try{const live=repo?await repo.load():{data:await publicData()};data=live.data;original=structuredClone(data);head=live.sha||null;for(const u of urls.values())URL.revokeObjectURL(u);urls.clear();pending.clear();save();draw();note('Latest version loaded.');}catch(e){note(e.message);}}));
}
function brand(panel){
 panel.append(el('h1','Brand & menu'));const b=box(panel,'Brand settings');field(b,'Company name',data,'brand');mediaField(b,'Logo',data,'logo');field(b,'WhatsApp number including country code',data,'phone');
 const nav=box(panel,'Menu links');data.menu.forEach((m,i)=>{const div=el('div','','subcard');nav.append(div);field(div,'Label',m,'label');destination(div,m,'url');controls(div,data.menu,i,'this menu link');});
 nav.append(button('Add menu link',()=>{data.menu.push({label:'New link',url:'index.html'});save();draw();}));
}
const captions={hero:'Hero banner',projects:'Project list',help:'WhatsApp quick links',contact:'Site visit form',text:'Text and image',custom:'Custom HTML'};
function codeFields(b,obj){field(b,'Custom HTML and CSS',obj,'code',{long:true,code:true,placeholder:'Paste an HTML section or page here'});field(b,'Code area height (pixels)',obj,'codeHeight',{num:[100,4000]});b.append(el('p','Paste clean HTML with its CSS. Code runs in an isolated frame. Use the button link field for navigation outside the frame.','hint'));}
function homepage(panel){
 panel.append(el('h1','Homepage editor'),el('p','Open a section to edit it. Drag its handle to change the order, or use the arrows.'));
 data.sections.forEach((s,i)=>{
  const card=el('details','','card'),title=el('summary');title.append(el('span','⠿ ','grip'),document.createTextNode((i+1)+'. '+(s.title||captions[s.type])));card.append(title);card.open=selected===s.id;card.ontoggle=()=>{if(card.open)selected=s.id;};
  title.draggable=true;title.ondragstart=e=>{dragging=s.id;e.dataTransfer.setData('text/plain',s.id);};title.ondragend=()=>dragging=null;
  card.ondragover=e=>{if(dragging)e.preventDefault();};card.ondrop=e=>{e.preventDefault();if(dragging){move(data.sections,data.sections.findIndex(x=>x.id===dragging),i);dragging=null;}};
  panel.append(card);controls(card,data.sections,i,'this section');field(card,'Heading',s,'title');field(card,'Short description',s,'text',{long:true});
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
 $('#connection').textContent=repo?'GitHub connected · main':'Owner dashboard';
 const nav=$('#tabs');nav.replaceChildren();for(const t of tabs){const b=button(t,()=>go(t));b.setAttribute('aria-current',String(t===tab));nav.append(b);}
 const panel=$('#panel');panel.replaceChildren();
 if(!repo){nav.replaceChildren();panel.append(el('h1','Website dashboard'));
   const b=box(panel,'Owner sign-in');b.append(el('p','Connect your GitHub account to edit and publish your True Homes website.'),button('Connect GitHub',()=>$('#login').showModal(),'primary'));
   if(JSON.stringify(original)!==JSON.stringify(data)){b.append(el('p','Your saved draft is waiting on this device.','hint'),button('Export draft text',()=>{const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)]));a.download='true-homes-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);}),button('Discard saved draft',async()=>{if(confirm('Discard this device’s saved draft and uploads?')){const fresh=await publicData();data=fresh;original=structuredClone(fresh);pending.clear();for(const u of urls.values())URL.revokeObjectURL(u);urls.clear();save();draw();}}));}
   return;
 }
 [overview,brand,homepage,projects][tabs.indexOf(tab)](panel);
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
$('#login').addEventListener('close',()=>{$('#token').value='';});
$('#connect').onclick=async()=>{
 const token=$('#token').value.trim();if(!token)return;
 $('#connect').disabled=true;
 try{const client=repository(token);const live=await client.load();
  if(JSON.stringify(live.data)!==JSON.stringify(original)){
   if(JSON.stringify(data)===JSON.stringify(original)){data=live.data;original=structuredClone(data);}
   else throw Error('Your draft started from an older version. Download it, then discard the draft and reload the latest site before editing again.');
  }
  repo=client;head=live.sha;save();$('#login').close();draw();note('Connected. Preview your changes, then choose Publish.');
 }catch(e){$('#login-error').textContent=e.message;}finally{$('#connect').disabled=false;}
};
$('#publish').onclick=async()=>{
 if(busy)return;if(!repo){$('#login').showModal();return;}
 try{validate(data);if(!confirm('Publish these changes to the True Homes production branch?'))return;busy=true;document.querySelector('.shell').inert=true;
  const files=new Map(),content=JSON.stringify(data,null,2)+'\n';
  files.set('content.json',content);for(const page of ['index',...data.projects.map(p=>p.slug)]){
    const html=render(data,page);
    const newPage=page!=='index'&&!original.projects.some(p=>p.slug===page);
    if(newPage||html!==render(original,page))files.set(page+'.html',html);
  }
  for(const [path,file]of pending)if(content.includes(JSON.stringify(path)))files.set(path,file);
  const removed=original.projects.filter(p=>!data.projects.some(n=>p.slug===n.slug)).map(p=>p.slug+'.html');
  head=await repo.publish(head,files,removed,note);original=structuredClone(data);pending.clear();save();
  note('Saved to GitHub. Cloudflare will update the live site after its connected build succeeds.');draw();
 }catch(e){note(e.message);}finally{busy=false;document.querySelector('.shell').inert=false;}
};
async function publicData(){const res=await fetch('../content.json',{cache:'no-store'});if(!res.ok)throw Error('Cannot read site/content.json. Check the upload folder.');return res.json();}
async function start(){
 data=await publicData();original=structuredClone(data);
 db=await new Promise((res,rej)=>{const req=indexedDB.open('true-homes-editor-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('draft');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});
 const draft=await new Promise((res,rej)=>{const req=db.transaction('draft').objectStore('draft').get('current');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});
 if(draft && (JSON.stringify(draft.data)!==JSON.stringify(draft.original)||draft.pending.size)){({data,original,pending}=draft);for(const [path,file]of pending)urls.set(path,URL.createObjectURL(file));}
 draw();note('Draft on this device. Only Publish changes the repository.');
}
start().catch(e=>note('Editor could not start. Open /admin/ on the hosted site in a browser with local storage enabled. '+e.message));
