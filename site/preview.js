// Render only inside the editor's sandbox. The preview never receives credentials.
if(window.parent!==window && window.origin==='null'){
  const siteOrigin=new URL(location.href).origin;
  addEventListener('message',function receive(event){
    if(event.source!==parent||event.origin!==siteOrigin||typeof event.data?.html!=='string')return;
    removeEventListener('message',receive);
    document.open();
    document.write(event.data.html);
    document.close();
  });
  parent.postMessage('true-homes-preview-ready',siteOrigin);
}
