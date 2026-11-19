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
function custom(code,height) {
  if (!code?.trim()) return '';
  const rules="default-src 'none'; style-src 'unsafe-inline' https:; img-src https: data:; media-src https:; font-src https: data:; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none';";
  const inner='<meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="'+rules+'"><style>*{box-sizing:border-box}body{margin:0;color:#f8f6f1;background:#101211;font:16px Arial,sans-serif}img,video{max-width:100%}</style>'+code;
  return '<iframe title="Custom content" loading="lazy" sandbox="allow-scripts" style="height:'+Math.min(4000,Math.max(100,Number(height)||500))+'px" srcdoc="'+esc(inner)+'"></iframe>';
}
const media=(path,resolve)=>path && link(path)?esc(resolve(path)):'';
const isPDF=s=>/\.pdf(?:$|[?#])/i.test(s);
function section(s,d,r) {
  const title='<h2>'+esc(s.title)+'</h2>';
  const copy=s.text?'<p>'+esc(s.text)+'</p>':'';
  const start='<section id="'+esc(s.id)+'" class="block '+esc(s.type)+'">';
  if (s.type==='hero') {
    const wide=media(s.image,r),tall=media(s.portrait||s.image,r);
    const pic=wide||tall?'<picture><source media="(max-width:700px) and (orientation:portrait)" srcset="'+tall+'"><img alt="" src="'+(wide||tall)+'"></picture>':'';
    const movie=s.mode==='video' && (s.wide||s.tall)?'<video muted playsinline loop preload="metadata" data-wide="'+media(s.wide||s.tall,r)+'" data-tall="'+media(s.tall||s.wide,r)+'"></video>':'';
    return '<section class="hero" id="'+esc(s.id)+'" style="--desktop:'+Math.min(100,Math.max(30,+s.height||90))+'svh;--mobile:'+Math.min(100,Math.max(30,+s.mobileHeight||82))+'svh;--fit:'+(s.fit==='contain'?'contain':'cover')+'">'+pic+movie+'<div class="hero-copy"><p>'+esc(s.text)+'</p><h1>'+esc(s.title)+'</h1>'+button(s.button,link(s.url))+'</div>'+(movie?'<button class="film-control" hidden>Play film</button>':'')+'</section>';
  }
  if (s.type==='projects') return start+title+copy+'<div class="cards">'+d.projects.map(p=>'<article class="card">'+(p.cover?'<a href="'+esc(p.slug)+'.html"><img loading="lazy" alt="'+esc(p.name)+'" src="'+media(p.cover,r)+'"></a>':'')+'<small>'+esc(p.type)+'</small><h3><a href="'+esc(p.slug)+'.html">'+esc(p.name)+'</a></h3><p>'+esc(p.location)+'</p>'+(p.price?'<strong>'+esc(p.price)+'</strong>':'')+'<div class="actions">'+button('View project',esc(p.slug)+'.html')+button(p.price?'Ask about availability':'Ask price',wa(d,'Hello '+d.brand+', please share the current price and availability for '+p.name+'.'),'plain')+'</div></article>').join('')+'</div></section>';
  if (s.type==='help') return start+'<video class="texture" src="'+media('assets/texture.mp4',r)+'" poster="'+media('assets/texture.jpg',r)+'" muted playsinline loop preload="none"></video><div class="help-inner">'+title+copy+'<div class="help-links">'+(s.actions||[]).map(a=>button(a.label+' ↗',wa(d,'Hello '+d.brand+', '+a.message),'')).join('')+'</div></div><button class="film-control" hidden>Play texture</button></section>';
  if (s.type==='contact') return start+title+copy+'<form class="visit-form" action="https://wa.me/'+esc(d.phone)+'" method="get"><label>Which project?<select name="text">'+['Help me choose',...d.projects.map(p=>p.name)].map(n=>'<option>'+esc(n)+'</option>').join('')+'</select></label><label>Preferred day or question <small>(optional)</small><input maxlength="350" placeholder="For example, Sunday after 11 am"></label><button class="button">Request a visit on WhatsApp ↗</button></form></section>';
  return start+(s.title?title:'')+copy+(s.image?'<img class="story-img" alt="" src="'+media(s.image,r)+'">':'')+custom(s.code,s.codeHeight)+button(s.button,link(s.url))+'</section>';
}
function detail(p,d,r) {
 const facts=[['Location',p.location],['Property type',p.type],['Price',p.price],['Size',p.size],['Project status',p.status]].filter(v=>v[1]);
 const albums=[['Project photos',p.photos],['Floor plans',p.floor],['Site plans',p.site]];
 const gallery=albums.filter(([,a])=>a.length).map(([title,items])=>'<section class="block"><h2>'+title+'</h2><div class="photos">'+items.map((item,i)=>'<a href="'+media(item,r)+'">'+(isPDF(item)?'<span class="button">Open PDF '+(i+1)+' ↗</span>':'<img loading="lazy" src="'+media(item,r)+'" alt="'+esc(p.name)+' '+title+' '+(i+1)+'">')+'</a>').join('')+'</div></section>').join('');
 if(p.layout==='custom') return '<section class="custom-project"><p><a class="back" href="index.html">← Home</a></p><h1>'+esc(p.name)+'</h1>'+custom(p.code,p.codeHeight)+'<div class="actions">'+button('Enquire on WhatsApp',wa(d,'Hello '+d.brand+', I am interested in '+p.name+'.'))+button('Open Google Maps ↗',link(p.maps),'plain')+'</div></section>'+gallery;
 return '<section class="block project"><a class="back" href="index.html">← Home</a><p class="eyebrow">'+esc(p.type)+'</p><h1>'+esc(p.name)+'</h1><p>'+esc(p.location)+'</p>'+(p.cover?'<img class="story-img" src="'+media(p.cover,r)+'" alt="'+esc(p.name)+'">':'')+'<p>'+esc(p.about)+'</p><dl>'+facts.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl><div class="actions">'+button('Ask price on WhatsApp',wa(d,'Hello '+d.brand+', what is the current price and availability at '+p.name+'?'))+button('Book a site visit',wa(d,'Hello '+d.brand+', I would like to visit '+p.name+'. Please share available timings.'),'plain')+button('Open Google Maps ↗',link(p.maps),'plain')+'</div></section>'+gallery+(p.code?'<section class="custom-project">'+custom(p.code,p.codeHeight)+'</section>':'');
}
export function render(d,page='index',r=x=>x) {
 const p=d.projects.find(p=>p.slug===page);
 const name=esc(d.brand);
 const title=(p?esc(p.name)+' | ':'')+name+' | Siliguri';
 return '<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#101211"><title>'+title+'</title><meta name="description" content="'+esc(p?p.about:'Explore property in Siliguri. Ask about prices, location and site visits on WhatsApp.')+'"><link rel="stylesheet" href="store.css"><script defer src="store.js"></script></head><body><a class="skip" href="#main">Skip to content</a><header><a href="index.html" class="brand">'+(d.logo?'<img src="'+media(d.logo,r)+'" alt="'+name+'">':name)+'</a><details><summary>Menu</summary><nav>'+d.menu.map(m=>button(m.label,link(m.url),'')).join('')+'</nav></details></header><main id="main">'+(p?detail(p,d,r):d.sections.map(s=>section(s,d,r)).join(''))+'</main><footer><b>'+name+'</b><span>Property enquiries · Siliguri</span>'+button('WhatsApp +'+d.phone,wa(d,'Hello '+d.brand+', I have a property enquiry.'),'')+'</footer><a class="chat" href="'+wa(d,'Hello '+d.brand+', '+(p?'I am interested in '+p.name+'.':'I am looking for a property in Siliguri.'))+'">WhatsApp enquiry ↗</a></body></html>';
}
