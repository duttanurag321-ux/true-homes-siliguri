const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width:700px) and (orientation:portrait)');
for (const video of document.querySelectorAll('video')) {
  const button = video.parentElement.querySelector('.film-control');
  const noun = video.classList.contains('texture') ? 'texture' : 'film';
  let wanted = !reduced.matches;
  let visible = false;
  function label() {button.textContent = (video.paused ? 'Play ' : 'Pause ') + noun;}
  function update() {
    if (wanted && visible && !document.hidden) video.play().catch(label);
    else video.pause();
  }
  function source() {
    if (video.dataset.wide) {
      video.classList.remove('playing');
      video.src = mobile.matches ? video.dataset.tall : video.dataset.wide;
    }
    update();
  }
  button.hidden = false;
  label(); source();
  button.onclick = () => {wanted = video.paused; if (video.error) video.load(); update();};
  video.addEventListener('playing',()=>{video.classList.add('playing');label();});
  video.addEventListener('error',()=>{video.classList.remove('playing');label();});
  video.addEventListener('pause',label);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();}).observe(video);
  mobile.addEventListener('change',source);
  reduced.addEventListener('change',()=>{wanted=!reduced.matches;update();});
  document.addEventListener('visibilitychange',update);
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
    mast.classList.toggle('away',scrollY>90&&scrollY>previous&&!mast.contains(document.activeElement));
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
  function select(i){track.scrollTo({left:((i+slides.length)%slides.length)*track.clientWidth,behavior:reduced.matches?'instant':'smooth'});}
  function schedule(){
    clearTimeout(timer);
    if(toggle){toggle.textContent=paused||reduced.matches?'▷':'Ⅱ';toggle.disabled=reduced.matches;toggle.setAttribute('aria-label',paused?'Resume automatic slides':'Pause automatic slides');}
    if(toggle&&shown&&!paused&&!hover&&!touching&&!focus&&!document.hidden&&!reduced.matches&&!document.querySelector('dialog[open]')){
      timer=setTimeout(()=>{select(index()+1);schedule();},5500);
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
if(!reduced.matches&&'IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.remove('waiting');observer.unobserve(e.target);}},{threshold:.07});
  for(const node of document.querySelectorAll('.section-title,.texture-content,.connect-intro h2,.contact-body>h2,.detail-chapter>h2')){
    node.classList.add('reveal','waiting');observer.observe(node);
  }
  reduced.addEventListener('change',()=>{if(reduced.matches)document.querySelectorAll('.waiting').forEach(el=>el.classList.remove('waiting'));});
}
