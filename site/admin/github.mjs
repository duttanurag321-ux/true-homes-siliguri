// One non-forced branch update publishes the content, generated pages and media together.
const base='https://api.github.com/repos/duttanurag321-ux/true-homes-siliguri/';
const branch='main';
function base64(bytes) {
  let s=''; for(let i=0;i<bytes.length;i+=8192) s+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(s);
}
export function repository(token) {
  async function api(path,method='GET',body) {
    const res=await fetch(path?base+path:base.slice(0,-1),{method,cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const data=await res.json();
    if(!res.ok) throw Error('GitHub '+res.status+': '+(data.message||'Request failed')+(res.status===409||res.status===422?' — reconnect to load the latest revision before publishing.':''));
    return data;
  }
  async function head(){return (await api('git/ref/heads/'+branch)).object.sha;}
  async function load(){
    const access=await api('');
    if(!access.permissions?.push) throw Error('Connect a GitHub account with write access to this repository.');
    const sha=await head();
    let file=await api('contents/site/content.json?ref='+sha);
    if(file.encoding!=='base64')file=await api('git/blobs/'+file.sha);
    return {sha,data:JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content),c=>c.charCodeAt(0))))};
  }
  async function publish(sha,files,removed,onProgress) {
    if(await head()!==sha)throw Error('The repository changed. Download your draft, then reconnect and apply your edits to the latest version.');
    const parent=await api('git/commits/'+sha);
    const tree=[];
    for(const [path,value] of files) {
      onProgress('Saving '+path+'…');
      let blob;
      if(typeof value==='string') blob=await api('git/blobs','POST',{content:value,encoding:'utf-8'});
      else blob=await api('git/blobs','POST',{content:base64(new Uint8Array(await value.arrayBuffer())),encoding:'base64'});
      tree.push({path:'site/'+path,mode:'100644',type:'blob',sha:blob.sha});
    }
    for(const path of removed)tree.push({path:'site/'+path,mode:'100644',type:'blob',sha:null});
    const next=await api('git/trees','POST',{base_tree:parent.tree.sha,tree});
    const commit=await api('git/commits','POST',{message:'Publish True Homes website changes',tree:next.sha,parents:[sha]});
    await api('git/refs/heads/'+branch,'PATCH',{sha:commit.sha,force:false});
    return commit.sha;
  }
  return {load,publish};
}
