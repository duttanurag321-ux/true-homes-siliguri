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
