const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width:700px) and (orientation:portrait)');
const look=document.documentElement.dataset;
const still=()=>reduced.matches||look.motion==='still';
for (const video of document.querySelectorAll('.hero video,.texture')) {
  let visible=false;
  video.muted=true;
  function update(){
    if(visible&&!document.hidden&&!still())video.play().catch(()=>{});
    else video.pause();
  }
  function source(){
    if(video.dataset.wide){
      video.classList.remove('playing');
      video.src=mobile.matches?video.dataset.tall:video.dataset.wide;
    }
    update();
  }
  source();
  video.addEventListener('playing',()=>video.classList.add('playing'));
  video.addEventListener('error',()=>video.classList.remove('playing'));
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();}).observe(video);
  mobile.addEventListener('change',source);
  reduced.addEventListener('change',update);
  document.addEventListener('visibilitychange',update);
  video.parentElement.addEventListener('click',update);
}
for(const form of document.querySelectorAll('.visit-form')) form.onsubmit=e=>{
  e.preventDefault();
  const url=new URL(form.action);
  url.searchParams.set('text',['Hello, I would like to visit a property in Siliguri.','Project: '+form.querySelector('select').value,form.querySelector('input').value.trim()].filter(Boolean).join('\n'));
  location.assign(url);
};


if(document.body.hasAttribute('data-preview')) {
  document.addEventListener('click',e=>{
    const a=e.target.closest('a');if(!a)return;
    const href=a.getAttribute('href')||'';
    e.preventDefault();
    if(href.startsWith('#')){document.getElementById(href.slice(1))?.scrollIntoView();return;}
    if(/^[a-z0-9-]+\.html(?:#.*)?$/.test(href))parent.postMessage({previewPage:href.split('.')[0]},'*');
  });
  document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
}



for(const opener of document.querySelectorAll('[data-panel]')){
  const panel=document.getElementById(opener.dataset.panel);
  opener.setAttribute('aria-haspopup','dialog');
  opener.setAttribute('aria-controls',panel.id);
  opener.addEventListener('click',()=>{
    panel.showModal();
    const input=panel.querySelector('input');
    if(input){input.value='';input.dispatchEvent(new Event('input'));input.focus();}
  });
  panel.addEventListener('click',e=>{if(e.target.closest('a,[data-dismiss]')||e.target===panel)panel.close();});
}
document.querySelectorAll('.sheet-links a').forEach((a,i)=>a.style.setProperty('--i',i));
const query=document.querySelector('#query');
query?.addEventListener('input',()=>{
  const terms=query.value.toLowerCase().trim().split(/\s+/);
  let count=0;
  for(const a of document.querySelectorAll('.results [data-result]')){
    a.hidden=!terms.every(q=>a.textContent.toLowerCase().includes(q));if(!a.hidden)count++;
  }
  document.querySelector('#empty').hidden=count>0;
});
const mast=document.querySelector('.mast');let previous=scrollY;
function updateMast(){
  mast.classList.toggle('solid',scrollY>50);
  if(Math.abs(scrollY-previous)>7||scrollY<60){
    mast.classList.toggle('away',look.header!=='fixed'&&scrollY>90&&scrollY>previous&&!mast.contains(document.activeElement));
    previous=scrollY;
  }
}
updateMast();window.addEventListener('scroll',updateMast,{passive:true});

for(const gallery of document.querySelectorAll('.carousel')){
  const track=gallery.querySelector('.track'),slides=[...track.children];
  if(slides.length<2)continue;
  const toggle=gallery.querySelector('.cycle'),dots=[...gallery.querySelectorAll('.dots button')];
  let paused=false,shown=false,hover=false,touching=false,focus=false,timer,raf;
  function index(){return Math.min(slides.length-1,Math.max(0,Math.round(track.scrollLeft/(track.clientWidth||1))));}
  function select(i){track.scrollTo({left:((i+slides.length)%slides.length)*track.clientWidth,behavior:still()?'instant':'smooth'});}
  function schedule(){
    clearTimeout(timer);
    if(toggle){toggle.hidden=look.auto==='false'||still();toggle.textContent=paused||still()?'▷':'Ⅱ';toggle.disabled=still();toggle.setAttribute('aria-label',paused?'Resume automatic slides':'Pause automatic slides');}
    if(toggle&&look.auto!=='false'&&shown&&!paused&&!hover&&!touching&&!focus&&!document.hidden&&!still()&&!document.querySelector('dialog[open]')){
      timer=setTimeout(()=>{select(index()+1);schedule();},(Number(look.interval)||6)*1000);
    }
  }
  function sync(){
    const i=index();slides.forEach((s,n)=>{s.dataset.current=String(i===n);s.inert=i!==n;s.style.setProperty('--pan',Math.max(-3,Math.min(3,(track.scrollLeft/(track.clientWidth||1)-n)*3))+'%');dots[n]?.setAttribute('aria-pressed',String(n===i));});
  }
  gallery.querySelector('.prev').onclick=()=>{select(index()-1);schedule();};
  gallery.querySelector('.next').onclick=()=>{select(index()+1);schedule();};
  dots.forEach((d,i)=>d.onclick=()=>{select(i);schedule();});
  if(toggle)toggle.onclick=()=>{paused=!paused;schedule();};
  track.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(index()+(e.key==='ArrowLeft'?-1:1));}};
  track.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(sync);schedule();},{passive:true});
  track.addEventListener('touchstart',()=>{touching=true;schedule();},{passive:true});
  for(const name of ['touchend','touchcancel'])track.addEventListener(name,()=>{touching=false;schedule();},{passive:true});
  gallery.addEventListener('pointerenter',e=>{hover=e.pointerType==='mouse';schedule();});
  gallery.addEventListener('pointerleave',()=>{hover=false;schedule();});
  gallery.addEventListener('focusin',()=>{focus=true;schedule();});
  gallery.addEventListener('focusout',e=>{focus=gallery.contains(e.relatedTarget);schedule();});
  new IntersectionObserver(([e])=>{shown=e.isIntersecting;schedule();},{threshold:.4}).observe(gallery);
  window.addEventListener('resize',sync);document.addEventListener('visibilitychange',schedule);
  reduced.addEventListener('change',schedule);document.querySelectorAll('dialog').forEach(dialog=>new MutationObserver(schedule).observe(dialog,{attributes:true,attributeFilter:['open']}));
  sync();schedule();
}
if(!still()&&'IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.remove('waiting');observer.unobserve(e.target);}},{threshold:.07});
  for(const node of document.querySelectorAll('.section-title,.texture-content,.connect-intro h2,.contact-body>h2,.detail-chapter>h2')){
    node.classList.add('reveal','waiting');observer.observe(node);
  }
  reduced.addEventListener('change',()=>{if(still())document.querySelectorAll('.waiting').forEach(el=>el.classList.remove('waiting'));});
}

// A sandboxed section can resize itself or open one of its selected project pages.
window.addEventListener('message',event=>{
 const message=event.data;
 if(!message || typeof message!=='object' || !('thHeight' in message || 'thProject' in message))return;
 const frame=Array.from(document.querySelectorAll('iframe.section-frame')).find(f=>f.contentWindow===event.source);
 if(!frame)return;
 if(frame.dataset.fit==='auto' && Number.isFinite(message.thHeight)){
   frame.style.height=Math.min(200000,Math.max(1,Math.ceil(message.thHeight)))+'px';
 }
 if(typeof message.thProject==='string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(message.thProject) && frame.dataset.projects.split(' ').includes(message.thProject)){
   if(document.body.hasAttribute('data-preview'))parent.postMessage({previewPage:message.thProject},'*');
   else location.assign(message.thProject+'.html');
 }
});

for(const frame of document.querySelectorAll('iframe[data-fit="auto"]')){
 const measure=()=>frame.contentWindow?.postMessage('th-measure','*');
 frame.addEventListener('load',measure);measure();
}
