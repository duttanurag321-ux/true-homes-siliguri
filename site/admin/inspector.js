// This file is loaded only inside the draft editor canvas.
(()=>{
 const editorOrigin=new URL(document.querySelector('base').href).origin;
 const sections=()=>Array.from(document.querySelectorAll('main > section[id]'));
 let picking=false;
 function send(value){parent.postMessage(value,editorOrigin);}
 addEventListener('message',event=>{
   if(event.source!==parent||event.origin!==editorOrigin||event.data?.type!=='editor-view')return;
   const {select,id,scroll}=event.data;
   picking=select===true;
   document.documentElement.classList.toggle('editor-pick',picking);
   for(const section of sections())section.classList.toggle('editor-selected',section.id===id);
   if(scroll && id)sections().find(s=>s.id===id)?.scrollIntoView({block:'start'});
 });
 document.addEventListener('click',e=>{
   if(!picking)return;const section=e.target.closest('main > section[id]');if(!section)return;
   e.preventDefault();e.stopImmediatePropagation();send({type:'editor-select',id:section.id});
 },true);
 const style=document.createElement('style');style.textContent='.editor-pick main>section[id]{cursor:crosshair}.editor-pick main>section[id]:hover,.editor-selected{outline:2px solid #3585fa;outline-offset:-3px}.editor-pick main iframe{pointer-events:none}';document.head.append(style);
 send({type:'editor-mounted'});
})();
