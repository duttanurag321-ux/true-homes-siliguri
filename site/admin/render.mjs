import {sizeDefaults,sizeVariables} from './sizing.mjs';
import {customFrame,layoutStyle,projectCards,cardCSS} from './sections.mjs';
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function link(value) {
  const s = String(value || '').trim();
  if (/^https:\/\//i.test(s) || /^(?!\/\/)[\w./#?%-][\w./#?&=%+-]*$/.test(s)) return esc(s);
  return '';
}
const slugOK = s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && !['index','admin','buyer-guide','preview','404'].includes(s);
export function validate(d) {
  if (!d.brand.trim() || !/^\d{8,15}$/.test(d.phone)) throw Error('Enter a brand name and a WhatsApp number with country code and digits only.');
  const slugs = new Set();
  for (const p of d.projects) {
    if (!p.name.trim() || !slugOK(p.slug) || slugs.has(p.slug)) throw Error('Each project needs a name and a unique page address using small letters, numbers and hyphens.');
    slugs.add(p.slug);
    if (p.layout==='custom' && !p.code?.trim()) throw Error('Paste your custom HTML for '+p.name+' or choose the standard layout.');
    if (p.maps && !/^https:\/\/(?:maps\.app\.goo\.gl|(?:www\.)?google\.(?:com|co\.in)|maps\.google\.(?:com|co\.in)|goo\.gl)\//i.test(p.maps)) throw Error('Paste a full Google Maps share link for '+p.name);
  }
  if (!d.sections.length) throw Error('Add at least one homepage section.');
  for (const section of d.sections) {
    if(section.type==='custom' && !section.code?.trim()) throw Error('Add code to '+(section.title||'your custom section')+' before publishing.');
  }
  for (const item of [...d.menu,...d.sections]) {
    if (item.url && !link(item.url)) throw Error('Check the link for '+(item.label || item.title));
    if (item.url && !item.url.startsWith('https://')) {
      const [path,hash] = item.url.split('#');
      if (path && path !== 'index.html' && !d.projects.some(p=>path===p.slug+'.html')) throw Error('Update the link for '+(item.label||item.title)+'. Its project page is missing.');
      if (hash && (!path||path==='index.html') && !d.sections.some(s=>s.id===hash)) throw Error('Update the link for '+(item.label||item.title)+'. Its homepage section is missing.');
    }
    if (d.menu.includes(item) && (!item.label.trim() || !item.url.trim())) throw Error('Give every menu item a name and link.');
  }
}
const wa=(d,msg)=>'https://wa.me/'+d.phone+'?text='+encodeURIComponent(msg);
const button=(label,url,cls='button')=>url&&label?'<a class="'+cls+'" href="'+url+'">'+esc(label)+'</a>':'';
const media=(path,resolve)=>path && link(path)?esc(resolve(path)):'';
const isPDF=s=>/\.pdf(?:$|[?#])/i.test(s);
function legacySection(s,d,r) {
  const title='<h2>'+esc(s.title)+'</h2>';
  const copy=s.text?'<p>'+esc(s.text)+'</p>':'';
  const start='<section id="'+esc(s.id)+'" class="block '+esc(s.type)+'">';
  if (s.type==='hero') {
    const wide=media(s.image,r),tall=media(s.portrait||s.image,r);
    const pic=wide||tall?'<picture><source media="(max-width:700px) and (orientation:portrait)" srcset="'+tall+'"><img alt="" src="'+(wide||tall)+'"></picture>':'';
    const movie=s.mode==='video' && (s.wide||s.tall)?'<video muted playsinline loop preload="metadata" data-wide="'+media(s.wide||s.tall,r)+'" data-tall="'+media(s.tall||s.wide,r)+'"></video>':'';
    return '<section class="hero" id="'+esc(s.id)+'" style="--desktop:'+Math.min(100,Math.max(30,+s.height||90))+'svh;--mobile:'+Math.min(100,Math.max(30,+s.mobileHeight||82))+'svh;--fit:'+(s.fit==='contain'?'contain':'cover')+'">'+pic+movie+'<div class="hero-copy"><p>'+esc(s.text)+'</p><h1>'+esc(s.title)+'</h1>'+button(s.button,link(s.url))+'</div>'+'</section>';
  }
  if (s.type==='projects') return start+title+copy+'<div class="cards">'+d.projects.map(p=>'<article class="card">'+(p.cover?'<a href="'+esc(p.slug)+'.html"><img loading="lazy" alt="'+esc(p.name)+'" src="'+media(p.cover,r)+'"></a>':'')+'<small>'+esc(p.type)+'</small><h3><a href="'+esc(p.slug)+'.html">'+esc(p.name)+'</a></h3><p>'+esc(p.location)+'</p>'+(p.price?'<strong>'+esc(p.price)+'</strong>':'')+'<div class="actions">'+button('View project',esc(p.slug)+'.html')+button(p.price?'Ask about availability':'Ask price',wa(d,'Hello '+d.brand+', please share the current price and availability for '+p.name+'.'),'plain')+'</div></article>').join('')+'</div></section>';
  if (s.type==='help') return start+'<video class="texture" src="'+media('assets/texture.mp4',r)+'" poster="'+media('assets/texture.jpg',r)+'" muted playsinline loop preload="none"></video><div class="help-inner">'+title+copy+'<div class="help-links">'+(s.actions||[]).map(a=>button(a.label+' ↗',wa(d,'Hello '+d.brand+', '+a.message),'')).join('')+'</div></div></section>';
  if (s.type==='contact') return start+title+copy+'<form class="visit-form" action="https://wa.me/'+esc(d.phone)+'" method="get"><label>Which project?<select name="text">'+['Help me choose',...d.projects.map(p=>p.name)].map(n=>'<option>'+esc(n)+'</option>').join('')+'</select></label><label>Preferred day or question <small>(optional)</small><input maxlength="350" placeholder="For example, Sunday after 11 am"></label><button class="button">Request a visit on WhatsApp ↗</button></form></section>';
  return start+(s.title?title:'')+copy+(s.image?'<img class="story-img" alt="" src="'+media(s.image,r)+'">':'')+customFrame(s,d,r,visualSettings(d))+button(s.button,link(s.url))+'</section>';
}
function legacyDetail(p,d,r) {
 const facts=[['Location',p.location],['Property type',p.type],['Price',p.price],['Size',p.size],['Project status',p.status]].filter(v=>v[1]);
 const albums=[['Project photos',p.photos],['Floor plans',p.floor],['Site plans',p.site]];
 const gallery=albums.filter(([,a])=>a.length).map(([title,items])=>'<section class="block"><h2>'+title+'</h2><div class="photos">'+items.map((item,i)=>'<a href="'+media(item,r)+'">'+(isPDF(item)?'<span class="button">Open PDF '+(i+1)+' ↗</span>':'<img loading="lazy" src="'+media(item,r)+'" alt="'+esc(p.name)+' '+title+' '+(i+1)+'">')+'</a>').join('')+'</div></section>').join('');
 if(p.layout==='custom') return '<section class="custom-project"><p><a class="back" href="index.html">← Home</a></p><h1>'+esc(p.name)+'</h1>'+customFrame(p,d,r,visualSettings(d))+'<div class="actions">'+button('Enquire on WhatsApp',wa(d,'Hello '+d.brand+', I am interested in '+p.name+'.'))+button('Open Google Maps ↗',link(p.maps),'plain')+'</div></section>'+gallery;
 return '<section class="block project"><a class="back" href="index.html">← Home</a><p class="eyebrow">'+esc(p.type)+'</p><h1>'+esc(p.name)+'</h1><p>'+esc(p.location)+'</p>'+(p.cover?'<img class="story-img" src="'+media(p.cover,r)+'" alt="'+esc(p.name)+'">':'')+'<p>'+esc(p.about)+'</p><dl>'+facts.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl><div class="actions">'+button('Ask price on WhatsApp',wa(d,'Hello '+d.brand+', what is the current price and availability at '+p.name+'?'))+button('Book a site visit',wa(d,'Hello '+d.brand+', I would like to visit '+p.name+'. Please share available timings.'),'plain')+button('Open Google Maps ↗',link(p.maps),'plain')+'</div></section>'+gallery+(p.code?'<section class="custom-project">'+customFrame(p,d,r,visualSettings(d))+'</section>':'');
}
const icons={
 menu:'<path d="M3 8h18M3 16h18"/>',close:'<path d="m5 5 14 14M19 5 5 19"/>',
 search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
 projects:'<path d="m2 11 10-8 10 8M5 10v11h14V10M10 21v-7h4v7"/>',
 chat:'<path d="M21 11a9 9 0 0 1-13 8l-5 2 1.6-5A9 9 0 1 1 21 11Z"/><path d="M8 7c.5 5 3.4 8 8 9l1-2.4-3-1.3-1 1c-1.8-.9-2.7-1.9-3.4-3.6l1-1-1.4-2.5Z"/>',
 visit:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 10h18m-13 5 3 3 5-6"/>',
 price:'<path d="M6 5h12M6 9h12M8 5c7 0 7 8 0 8H6l10 8"/>',photo:'<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="9" r="1.6"/><path d="m4 18 6-5 4 3 3-4 4 4"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>'
};
const icon=k=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+icons[k]+'</svg>';
const photo=(path,r,alt='',cls='')=>'<img class="'+cls+'" loading="lazy" src="'+media(path,r)+'" alt="'+esc(alt)+'">';
const projectUrl=p=>esc(p.slug)+'.html';
function pane(id,title,body,logo){
 return '<dialog id="'+id+'" class="sheet" aria-label="'+title+'"><div class="sheet-top">'+logo+'<button type="button" data-dismiss aria-label="Close '+title+'">'+icon('close')+'</button></div>'+body+'</dialog>';
}
function carousel(items,kind,label,auto=false){
 if(!items.length)return '';
 const controls=items.length>1?'<button class="arrow prev" aria-label="Previous slide"></button><button class="arrow next" aria-label="Next slide"></button><div class="dots">'+items.map((_,i)=>'<button aria-label="Go to slide '+(i+1)+'" aria-pressed="'+(i===0)+'"></button>').join('')+'</div>'+(auto?'<button class="cycle" aria-label="Pause automatic slides">Ⅱ</button>':''):'';
 return '<div class="carousel '+kind+'" data-cycle="'+auto+'" aria-label="'+esc(label)+'"><div class="track" tabindex="0" aria-label="'+esc(label)+'">'+items.join('')+'</div>'+controls+'</div>';
}
function section(s,d,r){
 const open='<section id="'+esc(s.id)+'" class="chapter '+esc(s.type)+'">';
 const heading='<h2>'+esc(s.title)+'</h2>', intro=s.text?'<p>'+esc(s.text)+'</p>':'';
 if(['custom','collection'].includes(s.type)){
  const cover=s.sectionCover?'<img class="collection-cover" alt="" src="'+media(s.sectionCover,r)+'">':'';
  return '<section id="'+esc(s.id)+'" class="editable-section" style="'+layoutStyle(s)+'">'+cover+(s.title?heading:'')+intro+(s.type==='collection'?projectCards(s,d,r):customFrame(s,d,r,visualSettings(d)))+button(s.button,link(s.url))+'</section>';
 }
 if(s.type==='hero')return legacySection(s,d,r);
 if(s.type==='projects'||s.type==='spotlight'){
  const inset=s.type==='spotlight';
  const slides=d.projects.map((p,i)=>{
   const pic=p.cover||p.photos?.[0]||['assets/terrace.jpg','assets/glass.jpg'][i%2];
   return '<article class="scene">'+photo(pic,r,'','backdrop')+'<div class="scene-copy"><h3>'+esc(p.name)+'</h3><p>'+esc(p.location)+'</p></div>'+
    '<a class="glass-action" href="'+projectUrl(p)+'">Discover the project</a>'+
    (inset?'<a class="inset-photo" href="'+projectUrl(p)+'" aria-label="Explore '+esc(p.name)+'">'+photo(p.photos?.[0]||pic,r)+'</a>':'')+'</article>';
  });
  return open+(inset?'<div class="section-title">'+heading+intro+'</div>':'<div class="sr">'+heading+intro+'</div>')+carousel(slides,inset?'layered':'full',s.title,true)+'</section>';
 }
 if(s.type==='gallery'){
  let slides=d.projects.flatMap(p=>(p.photos?.length?p.photos:p.cover?[p.cover]:[]).map((f,i)=>'<figure><a href="'+projectUrl(p)+'">'+photo(f,r,p.name+' photo '+(i+1))+'</a><figcaption>'+esc(p.name)+'<small>'+esc(p.location)+'</small></figcaption></figure>'));
  if(!slides.length)slides=['terrace','glass','roof'].map(f=>'<figure>'+photo('assets/'+f+'.jpg',r,'True Homes architecture film still')+'<figcaption>True Homes<small>From the brand film</small></figcaption></figure>');
  return open+'<div class="section-title">'+heading+intro+'</div>'+carousel(slides,'inset','Project photos',true)+'</section>';
 }
 if(s.type==='help')return open+'<video class="texture" muted playsinline loop preload="none" poster="'+media('assets/texture.jpg',r)+'" src="'+media('assets/texture.mp4',r)+'"></video><div class="texture-content">'+heading+intro+'<div class="marks">'+(s.actions||[]).map((a,i)=>'<a href="'+wa(d,'Hello '+d.brand+', '+a.message)+'">'+icon(['price','pin','photo'][i%3])+'<span>'+esc(a.label)+'</span></a>').join('')+'</div></div></section>';
 if(s.type==='contact')return open+'<div class="connect-intro"><h2>Connect with <strong>'+esc(d.brand)+'</strong></h2></div><div class="contact-body">'+heading+intro+'<form class="visit-form" action="https://wa.me/'+esc(d.phone)+'"><label>Which project?<select name="text">'+['Help me choose',...d.projects.map(p=>p.name)].map(n=>'<option>'+esc(n)+'</option>').join('')+'</select></label><label>Preferred day or question<input maxlength="350" placeholder="For example, Sunday after 11 am"></label><button class="glass-action">Request a visit on WhatsApp</button></form></div></section>';
 return legacySection(s,d,r);
}
function detail(p,d,r){
 if(p.layout==='custom')return legacyDetail(p,d,r);
 const price=wa(d,'Hello '+d.brand+', please share the current price and availability for '+p.name+'.');
 const visit=wa(d,'Hello '+d.brand+', I would like to visit '+p.name+'. Please share the location and timings.');
 const facts=[['Type',p.type],['Location',p.location],['Price',p.price],['Size',p.size],['Status',p.status]].filter(([,v])=>v);
 const album=p.photos||[];
 const plans=[['Floor plans',p.floor],['Site plans',p.site]].filter(([,v])=>v?.length).map(([name,paths])=>'<section class="detail-chapter"><h2>'+name+'</h2><div class="plan-grid">'+paths.map((s,i)=>'<a class="plan" href="'+media(s,r)+'">'+(isPDF(s)?'':photo(s,r,name+' '+(i+1)))+'Open '+esc(name.toLowerCase())+' '+(i+1)+' ↗</a>').join('')+'</div></section>').join('');
 return '<article class="project-page"><section class="detail-hero">'+photo(p.cover||'assets/terrace.jpg',r,'','backdrop')+'<div><p>'+esc(p.type)+'</p><h1>'+esc(p.name)+'</h1>'+button('Explore project','#overview','glass-action')+'</div></section><section class="detail-chapter intro" id="overview"><p class="overline">Introducing</p><h2>'+esc(p.name)+'</h2><p>'+esc(p.about)+'</p>'+button('Ask price',price,'glass-action')+'</section>'+
 (album.length?'<section class="project-gallery">'+carousel(album.map((f,i)=>'<figure><a href="'+media(f,r)+'">'+photo(f,r,p.name+' photo '+(i+1))+'</a></figure>'),'inset','Project gallery')+'</section>':'')+
 '<section class="detail-chapter"><h2>Project details</h2><dl>'+facts.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+button('Open Google Maps ↗',link(p.maps),'glass-action')+'</section>'+plans+
 (p.code?customFrame(p,d,r,visualSettings(d)):'')+'<section class="detail-chapter interest"><h2>Register your interest</h2>'+button('Book a site visit',visit,'glass-action')+'</section></article>';
}
export const visualDefaults=Object.freeze({...sizeDefaults,blur:20,tint:46,radius:18,accent:'#d5dfef',heading:'modern',motion:'standard',speed:'normal',slides:'auto',interval:6,header:'scroll',letterCase:'uppercase',weight:380,bodySize:16,heroAlign:'left',shade:100,background:'#050505',foreground:'#fafafa'});
function visualSettings(d){
 const a={...visualDefaults,...d.appearance};
 function number(key,min,max){
   const value=Number(a[key]);
   return Number.isFinite(value)?Math.min(max,Math.max(min,value)):visualDefaults[key];
 }
 const accent=/^#[0-9a-f]{6}$/i.test(a.accent)?a.accent:visualDefaults.accent;
 const color=key=>/^#[0-9a-f]{6}$/i.test(a[key])?a[key]:visualDefaults[key];
 const layout=sizeVariables(a)+'--page-bg:'+color('background')+';--page-ink:'+color('foreground')+';--body-size:'+number('bodySize',14,22)+'px;--heading-case:'+(a.letterCase==='none'?'none':'uppercase')+';--heading-weight:'+number('weight',300,800)+';--hero-align:'+(['left','right','center'].includes(a.heroAlign)?a.heroAlign:'left')+';--hero-shade:'+number('shade',0,100)/100+';';
 const speed=({fast:0.65,normal:1,slow:1.5})[a.speed]||1;
 const align=['left','right','center'].includes(a.heroAlign)?a.heroAlign:'left';
 return 'data-hero-align="'+align+'" data-motion="'+(a.motion==='still'?'still':a.motion==='subtle'?'subtle':'standard')+'" data-auto="'+(a.slides!=='manual')+'" data-interval="'+number('interval',2,20)+'" data-header="'+(a.header==='fixed'?'fixed':'scroll')+'" style="'+layout+'--glass-blur:'+number('blur',0,40)+'px;--glass-tint:'+number('tint',20,88)+'%;--glass-radius:'+number('radius',0,36)+'px;--glass-accent:'+accent+';--motion-time:'+Math.round(450*speed)+'ms;--title-font:'+(a.heading==='serif'?'Georgia,serif':a.heading==='wide'?'Verdana,sans-serif':'Arial,sans-serif')+'"';
}
export function render(d,page='index',r=x=>x){
 const p=d.projects.find(p=>p.slug===page), name=esc(d.brand);
 const logo='<a class="brand" href="index.html" aria-label="'+name+' home">'+(d.logo?'<img src="'+media(d.logo,r)+'" alt="'+name+'">':name)+'</a>';
 const links=d.menu.map(m=>button(m.label,link(m.url),'')).join('');
 const options=d.projects.map(p=>'<a data-result href="'+projectUrl(p)+'">'+esc(p.name)+'<small>'+esc(p.location)+'</small></a>').join('');
 const general=wa(d,'Hello '+d.brand+', I am interested in '+(p?p.name:'your Siliguri projects')+'.');
 const projects=d.sections.find(s=>s.type==='projects'),visits=d.sections.find(s=>s.type==='contact');
 const quick=(label,to,k)=>'<a aria-label="'+label+'" title="'+label+'" href="'+to+'">'+icon(k)+'<span>'+label+'</span></a>';
 const dock='<nav class="dock '+(p?'round':'')+'" aria-label="Quick actions">'+(projects&&!p?quick('Projects','index.html#'+esc(projects.id),'projects'):'')+quick('WhatsApp',general,'chat')+quick('Site visit',p?wa(d,'Hello, I would like to visit '+p.name+'.'):visits?'index.html#'+esc(visits.id):general,'visit')+'</nav>';
 return '<!doctype html><html lang="en-IN" '+visualSettings(d)+'><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>'+(p?esc(p.name)+' | ':'')+name+' | Siliguri</title><meta name="description" content="'+esc(p?p.about:'Explore properties in Siliguri and arrange a site visit on WhatsApp.')+'"><meta name="theme-color" content="#080808"><link rel="icon" href="'+media(d.favicon||'assets/favicon.png',r)+'"><link rel="stylesheet" href="store.css"><style>'+cardCSS+'</style><script defer src="store.js"></script></head><body><a class="skip" href="#main">Skip to content</a><header class="mast">'+logo+'<div><button data-panel="search" aria-label="Search projects">'+icon('search')+'</button><button data-panel="navigation" aria-label="Open menu">'+icon('menu')+'</button></div></header>'+
 pane('navigation','Navigation','<nav class="sheet-links">'+links+options+'</nav><a class="sheet-contact" href="'+general+'">WhatsApp ↗</a>',logo)+
 pane('search','Search projects','<div class="find"><label for="query">Search projects</label><input id="query" type="search" placeholder="Project name or location"><div class="results">'+options+'</div><p id="empty" hidden>No projects found.</p></div>',logo)+
 '<main id="main">'+(p?detail(p,d,r):d.sections.map(s=>section(s,d,r)).join(''))+'</main><footer>'+logo+'<nav>'+links+'</nav><a href="'+general+'">WhatsApp +'+esc(d.phone)+'</a><p>Siliguri, West Bengal</p></footer>'+dock+'</body></html>';
}
