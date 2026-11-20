export async function request(action, body, raw=false) {
  const options = body===undefined ? {} : {method:'POST',headers:{'Content-Type':raw?'text/plain':'application/json'},body:raw?body:JSON.stringify(body)};
  const res = await fetch('/api/editor/'+action,{...options,cache:'no-store'});
  const result = await res.json().catch(()=>({error:'The editor service is unavailable. Check the Cloudflare Worker deployment.'}));
  if (!res.ok || result.error) throw Object.assign(new Error(result.error),{status:res.status});
  return result;
}
function encoded(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result.split(',')[1]);
    reader.onerror=()=>reject(Error('Could not read '+file.name));
    reader.readAsDataURL(file);
  });
}
export const repository = {
  load:()=>request('content'),
  async publish(head,data,pending,note) {
    const uploads=[];
    for (const [path,file] of pending) {
      note('Uploading '+file.name+'…');
      const {sha}=await request('upload',await encoded(file),true);
      uploads.push([path,sha]);
    }
    note('Publishing pages…');
    return (await request('publish',{head,data,uploads})).sha;
  }
};
