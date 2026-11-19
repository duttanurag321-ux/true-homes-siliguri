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
document.querySelector('header nav')?.addEventListener('click',()=>document.querySelector('header details').open=false);

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


// Present the editor's project cards as the swipeable filmstrip on the public site.
for (const section of document.querySelectorAll('.projects')) {
  const track = section.querySelector('.cards');
  if (!track || !track.children.length) continue;
  const slides = [...track.children];
  const stage = document.createElement('div');
  stage.className = 'collection-stage';
  track.before(stage);
  stage.append(track);
  if (slides.length < 2) continue;
  track.tabIndex = 0;
  track.setAttribute('aria-label','Browse projects');
  const pages = document.createElement('div');
  pages.className = 'slide-pages';
  const current = () => Math.max(0,Math.min(slides.length-1,Math.round(track.scrollLeft / (track.clientWidth || 1))));
  function select(index) {
    const next = (index + slides.length) % slides.length;
    track.scrollTo({left:next * track.clientWidth,behavior:reduced.matches?'instant':'smooth'});
  }
  function control(label,action,cls) {
    const b=document.createElement('button');
    b.type='button'; b.className=cls; b.setAttribute('aria-label',label);
    b.addEventListener('click',action);
    return b;
  }
  const dots=slides.map((slide,i)=>{
    const b=control('Show '+(slide.querySelector('h3')?.textContent||'project '+(i+1)),()=>select(i),'slide-dot');
    pages.append(b);
    return b;
  });
  stage.append(control('Previous project',()=>select(current()-1),'slide-arrow previous'),
               control('Next project',()=>select(current()+1),'slide-arrow next'),pages);
  function sync(){dots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===current())));}
  track.addEventListener('scroll',sync,{passive:true});
  window.addEventListener('resize',sync);
  track.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(current()+(e.key==='ArrowLeft'?-1:1));}
  });sync();
}

// Lift the existing title and cover into the project banner; all links and details remain editor-owned.
for (const project of document.querySelectorAll('.block.project')) {
  const heading=project.querySelector('h1');
  if (!heading) continue;
  const hero=document.createElement('div');hero.className='property-banner';
  const group=document.createElement('div');group.className='property-title';
  const location=heading.nextElementSibling;
  const cover=project.querySelector('.story-img');
  for(const n of [project.querySelector('.eyebrow'),heading,location?.matches('p')?location:null])if(n)group.append(n);
  if(cover)hero.append(cover);
  hero.append(group);project.prepend(hero);
}
const mast=document.querySelector('header');
if(mast){
  const details=mast.querySelector('details');
  const updateHeader=()=>mast.classList.toggle('scrolled',window.scrollY>48);
  updateHeader();window.addEventListener('scroll',updateHeader,{passive:true});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&details?.open){details.open=false;details.querySelector('summary').focus();}
  });
  document.addEventListener('click',e=>{if(details?.open&&!mast.contains(e.target))details.open=false;});
}
const chat=document.querySelector('.chat');
if(chat){
  const dock=document.createElement('div');dock.className='mobile-dock';
  for(const a of [...document.querySelectorAll('header nav a')].filter(a=>!/^index\.html(?:#home)?$/.test(a.getAttribute('href'))).slice(0,2))dock.append(a.cloneNode(true));
  const whatsapp=chat.cloneNode(true);whatsapp.className='';whatsapp.textContent='WhatsApp ↗';dock.append(whatsapp);document.body.append(dock);
}
