// The host only relays messages. All draft HTML executes in the opaque child.
const child=document.querySelector('iframe');
let latest=0,resources;
async function show(html){
 const version=++latest;
 try{
  resources??=Promise.all(['../store.css','../store.js','inspector.js'].map(async path=>{
   const res=await fetch(path);if(!res.ok)throw Error();return res.text();
  }));
  const [css,store,inspector]=await resources;if(version!==latest)return;
  const inspect=html.includes('admin/inspector.js"></script>');
  html=html.replace(/<link rel="stylesheet" href="[^"]*store\.css">/,()=>'<style>'+css+'</style>')
    .replace(/<script defer src="[^"]*store\.js"><\/script>/,'')
    .replace(/<script src="[^"]*admin\/inspector\.js"><\/script>/,'');
  child.srcdoc=html.replace('</body>',()=>'<script>'+store+'</script>'+(inspect?'<script>'+inspector+'</script>':'')+'</body>');
 }catch{resources=null;child.srcdoc='<p>The website preview could not load. Refresh the editor to try again.</p>';}
}
if(parent!==window){
 addEventListener('message',event=>{
  if(event.source===parent && event.origin===location.origin){
   if(typeof event.data?.html==='string')show(event.data.html);
   else if(event.data?.type==='editor-view')child.contentWindow.postMessage(event.data,'*');
  }else if(event.source===child.contentWindow && event.origin==='null'){
   const msg=event.data;
   if(msg?.type==='editor-mounted'||msg?.type==='editor-select'||typeof msg?.previewPage==='string')parent.postMessage(msg,location.origin);
  }
 });
 parent.postMessage('true-homes-preview-ready',location.origin);
}
