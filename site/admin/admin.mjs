import {sizingGroups} from './sizing.mjs';
import {fieldHelp,actionHelp,attachHelp,enableHelp} from './help.mjs';
import {sectionSlots} from './sections.mjs';
import {render,validate,visualDefaults} from './render.mjs';
import {repository,request} from './github.mjs';
const $=s=>document.querySelector(s);
const tabs=['Overview','Brand & menu','Homepage','Projects','Appearance'];
let data, original, repo, head, db, busy=false, tab='Homepage', selected='', dragging=null;
let filter='',pickMode=false,canvasHTML='',canvasTimer,canvasReady=false;
let pending=new Map(), urls=new Map(), draftWrites=Promise.resolve();
const note=text=>{ $('#status').textContent=text;if(!repo)$('#login-error').textContent=text; };
function el(tag,text='',cls=''){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,fn,cls){const b=el('button',text,cls);b.type='button';b.onclick=fn;if(text==='↑'||text==='↓')b.setAttribute('aria-label',text==='↑'?'Move earlier':'Move later');if(actionHelp(text))b.dataset.tip=actionHelp(text);return b;}
function box(parent,title){const b=el('div','','box');if(title)b.append(el('h2',title));parent.append(b);return b;}
// Compare editor defaults consistently for older content and restored drafts.
function snapshot(value){
 const sections=value.sections.map(s=>({...s,values:s.values||{},...(s.type==='help'?{actions:s.actions||[]}:{} )}));
 const projects=value.projects.map(p=>({...p,values:p.values||{}}));
 return JSON.stringify({...value,appearance:{...visualDefaults,...value.appearance},sections,projects},(_,v)=>{
  if(v && typeof v==='object' && !Array.isArray(v))return Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]]));
  return v;
 });
}
let baseline=null,baselineText='';
function changed(){
 if(!data||!original)return false;
 if(baseline!==original){baseline=original;baselineText=snapshot(original);}
 return snapshot(data)!==baselineText||pending.size>0;
}
function updatePublish(){
 $('#publish').disabled=!repo||!head||busy||!changed();
}
function syncFavicon(){
 const icon=$('#admin-icon'),path=data?.favicon||'assets/favicon.png';
 const href=urls.get(path)||new URL(path,new URL('../',location.href)).href;
 if(icon.href!==href)icon.href=href;
}
function save(){
  queueCanvas();
  const paths=JSON.stringify(data);
  for(const path of pending.keys())if(!paths.includes(JSON.stringify(path))){pending.delete(path);URL.revokeObjectURL(urls.get(path));urls.delete(path);}
  updatePublish();syncFavicon();
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
 const hadValue=Object.hasOwn(obj,key);
 input.value=obj[key]??opts.defaultValue??'';if(opts.placeholder)input.placeholder=opts.placeholder;
 const initialInput=input.value;
 input.oninput=()=>{
   if(!hadValue && input.value===initialInput)delete obj[key];
   else obj[key]=opts.num && input.value!==''?Number(input.value):input.value;
   updatePublish();queueCanvas();
 };
 input.onchange=()=>{save();if(opts.refresh)draw();else if(key==='title'&&parent.dataset.section){parent.querySelector('.section-name').textContent=obj.title||captions[obj.type];parent.dataset.search=((obj.title||'')+' '+captions[obj.type]).toLowerCase();}};
 wrap.append(input);parent.append(wrap);attachHelp(wrap,input,label,fieldHelp(label,key));return input;
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
 lab.append(inp);area.append(lab);const purpose=key==='favicon'?'This small icon appears in the browser tab. ':key==='logo'?'This identifies your business in the website header. ':'';attachHelp(lab,inp,label,purpose+'Choose '+label.toLowerCase()+' from your device. Accepted files: '+Object.keys(allowed).join(', ')+'. Up to 24 MiB each.');
}
function destination(parent,obj,key){
 const input=field(parent,'Button or menu link',obj,key);
 const select=el('select');select.dataset.tip='Pick a page or homepage section to fill in the link automatically.';select.setAttribute('aria-label','Choose an existing destination');
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
function sizeSlider(parent, settings, key, label, min, max, unit, help){
 const row=el('label',label,'field size-slider');
 const input=el('input'), value=el('span');
 input.type='range';input.min=min;input.max=max;input.value=settings[key];
 const updateLabel=()=>{value.textContent=input.value+unit;input.setAttribute('aria-valuetext',value.textContent);};
 updateLabel();
 input.oninput=()=>{settings[key]=Number(input.value);updateLabel();updatePublish();queueCanvas();};
 input.onchange=save;
 row.append(value,input);parent.append(row);attachHelp(row,input,label,help);
}
function appearance(panel){
 panel.append(el('h1','Appearance'));
 const a=data.appearance={...visualDefaults,...data.appearance};
 for(const [name,options] of Object.entries(sizingGroups)){
  const group=box(panel,name);
  for(const [key,label,min,max,help] of options)sizeSlider(group,a,key,label,min,max,'%',help+' 100% is the original size.');
  group.append(button('Reset '+name.toLowerCase(),()=>{
   for(const [key] of options)a[key]=visualDefaults[key];
   save();draw();
  }));
 }
 const glass=box(panel,'Glass surfaces');
 glass.append(el('p','Adjust the header, menus, buttons and floating controls. Use Preview to check the result over your own project photos.'));
 sizeSlider(glass,a,'blur','Frost / blur',0,40,' px',fieldHelp('Frost / blur','blur'));
 sizeSlider(glass,a,'tint','Dark tint',20,88,'%',fieldHelp('Dark tint','tint'));
 sizeSlider(glass,a,'radius','Corner radius',0,36,' px',fieldHelp('Corner radius','radius'));
 field(glass,'Glass highlight colour',a,'accent').type='color';
 field(glass,'Heading style',a,'heading',{choices:[['modern','Modern sans serif'],['serif','Classic serif'],['wide','Wide sans serif']]});
 const motion=box(panel,'Animation and scrolling');
 field(motion,'Page effects',a,'motion',{choices:[['standard','Cinematic movement'],['subtle','Gentle fades'],['still','Still — no automatic motion']]});
 field(motion,'Transition speed',a,'speed',{choices:[['fast','Fast'],['normal','Normal'],['slow','Slow']]});
 field(motion,'Project slides',a,'slides',{choices:[['auto','Automatic'],['manual','Swipe or use arrows']]});
 sizeSlider(motion,a,'interval','Seconds between automatic slides',2,20,' s',fieldHelp('Seconds between automatic slides','interval'));
 field(motion,'Header behaviour',a,'header',{choices:[['scroll','Hide on scroll down'],['fixed','Always visible']]});
 const layout=box(panel,'Typography and layout');
 field(layout,'Heading capitalization',a,'letterCase',{choices:[['uppercase','Uppercase'],['none','As written']]});
 field(layout,'Heading weight',a,'weight',{choices:[['380','Light'],['500','Medium'],['700','Bold']]});
 sizeSlider(layout,a,'bodySize','Body text size',14,22,' px',fieldHelp('Body text size','bodySize'));
 field(layout,'Hero text alignment',a,'heroAlign',{choices:[['left','Left'],['center','Center'],['right','Right']]});
 sizeSlider(layout,a,'shade','Hero image shading',0,100,'%',fieldHelp('Hero image shading','shade'));
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
const captions={hero:'Hero banner',projects:'Project showcase',gallery:'Project photo gallery',spotlight:'Featured project carousel',help:'WhatsApp quick links',contact:'Site visit form',text:'Text and image',collection:'Project collection',custom:'Custom code section'};
function projectPicker(parent,section){
 const list=section.cards||[];
 const group=box(parent,'Projects in this section');
 group.append(el('p','Choose the project each card opens. Its current name, location and cover are filled in automatically.'));
 for(const [i,item] of list.entries()){
  const card=el('div','','subcard');group.append(card);
  field(card,'Project page',item,'slug',{choices:data.projects.map(p=>[p.slug,p.name]),refresh:true});
  const p=data.projects.find(p=>p.slug===item.slug);
  if(!item.image && p){const path=p.cover||p.photos?.[0];if(path){const img=el('img','','thumb');img.alt=p.name;img.src=urls.get(path)||new URL('../'+path,location.href);card.append(img);}else card.append(el('p','This project has no photo yet. Choose a card image below.','hint'));}
  mediaField(card,'Card image override',item,'image');controls(card,list,i,'this project card');
 }
 const add=button('Add project card',()=>{const project=data.projects.find(p=>!list.some(item=>item.slug===p.slug))||data.projects[0];if(!project)return;section.cards=list;list.push({slug:project.slug,image:''});save();draw();});
 add.disabled=!data.projects.length;group.append(add);
}
function sectionLayout(parent,section){
 const details=el('details','','code-guide');details.append(el('summary','Spacing and section cover'));parent.append(details);
 details.append(el('p','Leave a field blank for site spacing. Enter 0 for an edge-to-edge layout. Phone settings override desktop settings.'));
 for(const [key,label] of Object.entries({top:'Desktop top',bottom:'Desktop bottom',side:'Desktop sides',phoneTop:'Phone top',phoneBottom:'Phone bottom',phoneSide:'Phone sides'}))field(details,label+' padding (px)',section,key,{num:[0,240],placeholder:'Site default'});
 mediaField(details,'Section cover image',section,'sectionCover');
}
const starter = `<section><h2>{{text:Heading}}</h2><p>{{text:Description}}</p>{{project_cards}}</section>`;
function codeFields(b,obj){
 const guide=el('details','','code-guide');guide.append(el('summary','How to create a section with ChatGPT'));b.append(guide);
 const promptText='Create one mobile-first HTML fragment with inline CSS for the True Homes section editor. It runs in an auto-height sandbox. Use normal document flow, no viewport heights, fixed heights, nested scroll panels or outer padding. The editor controls spacing. Inherit fonts and use --page-bg, --page-ink, --glass-accent and --title-font. Use {{text:Heading}} and other named text placeholders wherever I should edit copy. Use <img src="{{image:Cover}}" alt=""> for editable images. For selected projects insert {{project_cards}} in the markup. The editor supplies cards, photos, titles and project links. Style .th-project-grid and .th-project-card as needed. Use simple descriptive field names. Optional inline vanilla JS only. Return raw HTML without Markdown fences. My section should show: [describe the section].';
 guide.append(el('p',promptText,'prompt'),button('Copy ChatGPT prompt',async()=>{try{await navigator.clipboard.writeText(promptText);note('Prompt copied.');}catch{note('Select and copy the prompt.');}}));
 const code=field(b,'Section code',obj,'code',{long:true,code:true,placeholder:'Paste your HTML and CSS'});
 const slots=el('div');const refreshFields=()=>{
  slots.replaceChildren();
  for(const {kind,label} of sectionSlots(obj.code)){
   obj.values ||= {};const key=kind+':'+label;
   if(kind==='image')mediaField(slots,label,obj.values,key);
   else field(slots,label,obj.values,key,{placeholder:label});
  }
  if(obj.code?.includes('{{project_cards}}'))projectPicker(slots,obj);
 };
 code.addEventListener('change',refreshFields);
 b.append(button('Use starter section',()=>{if(code.value.trim()&&!confirm('Replace this section’s code with the starter?'))return;code.value=obj.code=starter;refreshFields();save();code.focus();}),slots);
 refreshFields();
 field(b,'Section styling',obj,'frameTheme',{choices:[['site','Match website'],['original','Keep code styling']],defaultValue:'site'});
 field(b,'Height',obj,'frameMode',{choices:[['auto','Auto-fit content'],['fixed','Fixed height']],defaultValue:'auto',refresh:true});
 if(obj.frameMode==='fixed'){
  field(b,'Desktop frame height (100–4000 px)',obj,'codeHeight',{num:[100,4000]});
  field(b,'Phone frame height (blank uses desktop)',obj,'phoneCodeHeight',{num:[100,4000]});
 }
 b.append(button('Auto-fit section',()=>{obj.frameMode='auto';save();draw();note('Auto-fit enabled for desktop and phone. Open Preview to see the result.');}));
}
function homepage(panel){
 panel.append(el('h1','Homepage'));
 const search=el('input','','section-search');search.type='search';search.placeholder='Find a section…';search.setAttribute('aria-label','Find a homepage section');search.value=filter;search.dataset.tip='Type a section name, such as Gallery, to narrow the list. Clear the search to see all sections.';
 const outline=el('div','','outline');const empty=el('p','No matching sections.','hint');
 panel.append(search,outline,empty);
 const applyFilter=()=>{let found=0;for(const card of outline.children){card.hidden=!card.dataset.search.includes(filter.trim().toLowerCase());if(!card.hidden)found++;}empty.hidden=found>0;};
 search.oninput=()=>{filter=search.value;applyFilter();};
 data.sections.forEach((s,i)=>{
  const card=el('details','','card'),title=el('summary');
  const name=s.title||captions[s.type]||s.id;
  title.append(el('span','','section-symbol'),el('span',name,'section-name'));title.dataset.tip='Open '+name+' settings. Drag this row or use the move buttons to change its position.';
  card.dataset.search=(name+' '+(captions[s.type]||'')).toLowerCase();card.dataset.section=s.id;card.append(title);card.open=selected===s.id;
  card.ontoggle=()=>{
    if(!card.isConnected)return;
    if(card.open){selected=s.id;for(const other of outline.children)if(other!==card)other.open=false;sendView(true);}
    else if(selected===s.id){selected='';sendView(false);}
  };
  title.draggable=true;title.ondragstart=e=>{dragging=s.id;e.dataTransfer.setData('text/plain',s.id);};title.ondragend=()=>dragging=null;
  card.ondragover=e=>{if(dragging)e.preventDefault();};card.ondrop=e=>{e.preventDefault();if(dragging){move(data.sections,data.sections.findIndex(x=>x.id===dragging),i);dragging=null;}};
  outline.append(card);card.append(button('Duplicate section',()=>{const copy=structuredClone(s);copy.id=s.type+'-'+crypto.randomUUID().slice(0,8);data.sections.splice(i+1,0,copy);selected=copy.id;save();draw();}));controls(card,data.sections,i,'this section');field(card,'Heading',s,'title');field(card,'Short description',s,'text',{long:true});
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
  if(['custom','collection'].includes(s.type))sectionLayout(card,s);
  if(s.type==='collection')projectPicker(card,s);
  if(s.type==='custom')codeFields(card,s);
  if(['hero','text','custom'].includes(s.type)){field(card,'Button text',s,'button');destination(card,s,'url');}
 });
 applyFilter();
 const b=box(panel,'Add a section'),sel=el('select');sel.setAttribute('aria-label','Section type');sel.dataset.tip='Choose a layout. Project collection lets you pick properties. Custom code accepts a section from ChatGPT.';for(const [k,v]of Object.entries(captions))sel.add(new Option(v,k));sel.value='text';
 const position=el('select');position.setAttribute('aria-label','Insert section at');position.dataset.tip='Choose where the new section will appear on your homepage.';
 data.sections.forEach((s,i)=>position.add(new Option('Before '+(s.title||captions[s.type]),i)));
 position.add(new Option('At the bottom',data.sections.length));position.value=data.sections.length;
 b.append(sel,position,button('Add section',()=>{const type=sel.value,id=type+'-'+crypto.randomUUID().slice(0,8);data.sections.splice(Number(position.value),0,{type,id,title:type==='custom'?'':type==='collection'?'Trending projects in Siliguri':captions[type],text:'',url:'',button:'',mode:'image',height:85,mobileHeight:75,fit:'cover',codeHeight:500});selected=id;filter='';save();draw();}));
}
function projects(panel){
 panel.append(el('h1','Projects'));
 const actions=el('div','','actions');panel.append(actions);
 const pick=el('select');pick.setAttribute('aria-label','Choose project');pick.dataset.tip='Select the property whose details you want to edit and preview.';
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
 const z=box(panel,'Remove project');z.append(button('Remove this project',()=>{if(!confirm('Remove '+p.name+'? Its page will be removed on publish.'))return;data.projects.splice(data.projects.indexOf(p),1);for(const item of [...data.sections,...data.projects])if(item.cards)item.cards=item.cards.filter(card=>card.slug!==p.slug);selected='';save();draw();},'danger'));
}
function go(name){tab=name;selected='';filter='';pickMode=false;mobilePane(false);draw();window.scrollTo(0,0);}
function draw(){
 updatePublish();syncFavicon();
 $('#connection').textContent=repo?'Signed in · True Homes':'Owner dashboard';
 const nav=$('#tabs');nav.replaceChildren();for(const t of tabs){const b=button(t,()=>go(t));b.setAttribute('aria-current',String(t===tab));nav.append(b);}
 const panel=$('#panel');panel.replaceChildren();
 document.body.classList.toggle('signed-out',!repo);
 $('#login').hidden=Boolean(repo);
 if(!repo){nav.replaceChildren();$('#canvas').hidden=true;$('#live').src='about:blank';canvasHTML='';return;}
 [overview,brand,homepage,projects,appearance][tabs.indexOf(tab)](panel);
 $('.mobile-switch').hidden=tab==='Overview';$('#canvas').hidden=tab==='Overview';$('.workspace').classList.toggle('dashboard',tab==='Overview');$('#inspect').hidden=tab!=='Homepage';$('#inspect').setAttribute('aria-pressed',String(pickMode));queueCanvas(0);
}
function previewDocument(page,canvas){
 const root=new URL('../',location.href).href;
 let html=render(data,page,path=>urls.get(path)||new URL(path,root).href)
   .replace('<head>','<head><base href="'+root+'">').replace('<body>','<body data-preview>');
 if(canvas)html=html.replace('href="store.css"','href="'+root+'store.css"').replace('src="store.js"','src="'+root+'store.js"').replace('</body>','<script src="'+root+'admin/inspector.js"></script></body>');
 return html;
}
function currentPage(){return tab==='Projects'?(data.projects.find(p=>p.slug===selected)||data.projects[0])?.slug||'index':'index';}
function sendView(scroll){if(canvasReady)$('#live').contentWindow.postMessage({type:'editor-view',id:tab==='Homepage'?selected:'',select:tab==='Homepage'&&pickMode,scroll},location.origin);}
function queueCanvas(delay=420){
 clearTimeout(canvasTimer);
 if(!repo||$('#canvas').hidden)return;
 canvasTimer=setTimeout(()=>{
  if(!repo||$('#canvas').hidden)return;
  const html=previewDocument(currentPage(),true);
  if(html===canvasHTML){sendView(false);return;}
  canvasHTML=html;canvasReady=false;if($('#live').getAttribute('src')==='canvas.html')$('#live').contentWindow.postMessage({html},location.origin);else $('#live').src='canvas.html';
 },delay);
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==$('#live').contentWindow||!repo||$('#canvas').hidden)return;
 
 if(event.data==='true-homes-preview-ready'){event.source.postMessage({html:canvasHTML},location.origin);return;}
 if(event.data?.type==='editor-mounted'){canvasReady=true;sendView(true);return;}
 if(event.data?.type==='editor-select'&&pickMode&&tab==='Homepage'&&data.sections.some(s=>s.id===event.data.id)){
  selected=event.data.id;filter='';pickMode=false;mobilePane(false);draw();
  const card=[...document.querySelectorAll('[data-section]')].find(el=>el.dataset.section===selected);
  card?.querySelector('summary')?.focus({preventScroll:true});card?.scrollIntoView({block:'nearest'});return;
 }
 const page=event.data?.previewPage;
 if(page==='index')go('Homepage');else if(data.projects.some(p=>p.slug===page)){tab='Projects';selected=page;pickMode=false;draw();}
});
$('#inspect').onclick=()=>{pickMode=!pickMode;$('#inspect').setAttribute('aria-pressed',String(pickMode));sendView(false);};
function mobilePane(canvas){$('.workspace').classList.toggle('canvas-on',canvas);$('#show-settings').setAttribute('aria-pressed',String(!canvas));$('#show-canvas').setAttribute('aria-pressed',String(canvas));}
$('#show-settings').onclick=()=>mobilePane(false);$('#show-canvas').onclick=()=>mobilePane(true);
function device(phone){$('#live').classList.toggle('phone-canvas',phone);$('#wide').setAttribute('aria-pressed',String(!phone));$('#narrow').setAttribute('aria-pressed',String(phone));}
$('#wide').onclick=()=>device(false);$('#narrow').onclick=()=>device(true);
for(const id of ['inspect','wide','narrow','preview','publish','phone','desktop','close-preview']){
 const button=$('#'+id);button.dataset.tip=actionHelp(button.textContent);
}
$('#preview-page').dataset.tip='Choose which draft page you want to preview.';
enableHelp();
let previewHTML='';
function updateFrame(){
 const page=$('#preview-page').value;
 previewHTML=previewDocument(page,false);
 if($('#frame').getAttribute('src')==='canvas.html')$('#frame').contentWindow.postMessage({html:previewHTML},location.origin);else $('#frame').src='canvas.html';
}
$('#preview').onclick=()=>{if(!repo){$('#user').focus();return;}const sel=$('#preview-page');sel.replaceChildren(new Option('Homepage','index'));for(const p of data.projects)sel.add(new Option(p.name,p.slug));sel.value=tab==='Projects'?(data.projects.find(p=>p.slug===selected)||data.projects[0])?.slug||'index':'index';updateFrame();$('#viewer').showModal();};
window.addEventListener('message',event=>{
 const frame=$('#frame');
 if(event.origin!==location.origin||event.source!==frame.contentWindow||!$('#viewer').open)return;
 if(event.data==='true-homes-preview-ready'){frame.contentWindow.postMessage({html:previewHTML},location.origin);return;}
 if(!event.data?.previewPage)return;
 const page=event.data.previewPage;
 if(page==='index'||data.projects.some(p=>p.slug===page)){$('#preview-page').value=page;updateFrame();}
});
$('#preview-page').onchange=updateFrame;$('#phone').onclick=()=>$('#frame').classList.add('mobile');$('#desktop').onclick=()=>$('#frame').classList.remove('mobile');$('#close-preview').onclick=()=>{$('#viewer').close();$('#frame').src='about:blank';previewHTML='';};
async function resume(){
 const live=await repository.load();
 repo=repository;
 if(snapshot(live.data)!==snapshot(original) && changed()){
   head=null;draw();note('Your draft is based on an older version. Download it under Draft tools, then discard and reload before publishing.');return;
 }
 if(!changed()){data=live.data;original=structuredClone(data);}
 head=live.sha;save();draw();note('Signed in. Draft changes stay on this device until you publish.');
}

$('#credentials').onsubmit=async event=>{
 event.preventDefault();$('#connect').disabled=true;
 try{await request('login',{user:$('#user').value,password:$('#password').value});await resume();$('#password').value='';$('#login-error').textContent='';}
 catch(e){$('#login-error').textContent=e.message;}finally{$('#connect').disabled=false;}
};
$('#publish').onclick=async()=>{
 if(busy||!repo||!head||!changed())return;
 try{validate(data);if(!confirm('Publish these changes to the True Homes production branch?'))return;busy=true;updatePublish();document.querySelector('.shell').inert=true;
  if(!head)throw Error('Download your draft and reload the latest version in Draft tools.');
  head=await repo.publish(head,data,pending,note);original=structuredClone(data);pending.clear();save();
  note('Saved to GitHub. Cloudflare will update the live site after its connected build succeeds.');draw();
 }catch(e){if(e.status===401){repo=null;draw();$('#user').focus();}note(e.message);}finally{busy=false;updatePublish();document.querySelector('.shell').inert=false;}
};
async function publicData(){const res=await fetch('../content.json',{cache:'no-store'});if(!res.ok)throw Error('Cannot read site/content.json. Check the upload folder.');return res.json();}
async function start(){
 data=await publicData();original=structuredClone(data);
 db=await new Promise((res,rej)=>{const req=indexedDB.open('true-homes-editor-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('draft');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});
 const draft=await new Promise((res,rej)=>{const req=db.transaction('draft').objectStore('draft').get('current');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});
 if(draft && (snapshot(draft.data)!==snapshot(draft.original)||draft.pending.size)){({data,original,pending}=draft);for(const [path,file]of pending)urls.set(path,URL.createObjectURL(file));}
 draw();try{await resume();}catch(e){note(e.status===401?'Sign in to open the website editor.':e.message);}
}
start().catch(e=>note('Editor could not start. Open /admin/ on the hosted site in a browser with local storage enabled. '+e.message));
