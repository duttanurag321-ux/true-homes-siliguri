import { render, validate } from './site/admin/render.mjs';

const prefix = '/api/editor/';
const cookie = '__Host-th_admin';
const lifetime = 7 * 86400;
const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const digest = text => crypto.subtle.digest('SHA-256', encoder.encode(text));
const reply = (value, status = 200, headers = {}) => Response.json(value, {status, headers: {'Cache-Control':'no-store', ...headers}});
const fail = (message, status) => { throw Object.assign(new Error(message), {status}); };

async function signingKey(env) {
  const material = await digest(JSON.stringify([env.GITHUB_TOKEN, env.ADMIN_USER, env.ADMIN_PASSWORD]));
  return crypto.subtle.importKey('raw', material, {name:'HMAC', hash:'SHA-256'}, false, ['sign','verify']);
}
function setCookie(value, age) {
  return {'Set-Cookie': cookie+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age};
}
async function authenticated(req, env) {
  const value = (req.headers.get('Cookie') || '').split(/;\s*/).find(c => c.startsWith(cookie+'='))?.slice(cookie.length+1);
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(value || '');
  if (!match || Number(match[1]) <= Date.now()/1000) return false;
  return crypto.subtle.verify('HMAC', await signingKey(env), Uint8Array.from(match[2].match(/../g), h=>parseInt(h,16)), encoder.encode(match[1]));
}
function github(token) {
  return async (path, method='GET', body) => {
    const res = await fetch('https://api.github.com/repos/duttanurag321-ux/true-homes-siliguri/'+path, {
      method, headers:{Authorization:'Bearer '+token, 'User-Agent':'TrueHomes-Editor', Accept:'application/vnd.github+json', 'Content-Type':'application/json'}, body:body && JSON.stringify(body)
    });
    if (!res.ok) {
      if ([409,422].includes(res.status)) fail('The repository changed or rejected the update. Reload the latest version before publishing.',409);
      fail('GitHub could not complete the request ('+res.status+'). Check the publishing credential and repository access.',502);
    }
    return res.json();
  };
}
async function load(api) {
  const sha = (await api('git/ref/heads/main')).object.sha;
  let file = await api('contents/site/content.json?ref='+sha);
  if (file.encoding !== 'base64') file = await api('git/blobs/'+file.sha);
  return {sha, data:JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content), c=>c.charCodeAt(0))))};
}
async function publish(api, {head, data, uploads}) {
  const live = await load(api);
  if (head !== live.sha) fail('The website changed since this draft was opened. Download the draft and reload the latest version.',409);
  try { validate(data); } catch (error) { fail(error.message,400); }
  const tree = [];
  const entry = (path, value) => tree.push({path:'site/'+path, mode:'100644', type:'blob', ...value});
  const content = JSON.stringify(data,null,2)+'\n';
  entry('content.json',{content});
  for (const [path, sha] of uploads) {
    if (!/^uploads\/[a-zA-Z0-9-]+\.(?:png|ico|jpe?g|webp|gif|avif|mp4|webm|pdf)$/.test(path) || !/^[a-f0-9]{40}$/.test(sha) || !content.includes(JSON.stringify(path))) fail('Invalid uploaded media.',400);
    entry(path,{sha});
  }
  for (const page of ['index', ...data.projects.map(p=>p.slug)]) entry(page+'.html',{content:render(data,page)});
  for (const p of live.data.projects) if (!data.projects.some(n=>n.slug===p.slug)) entry(p.slug+'.html',{sha:null});
  const parent = await api('git/commits/'+head);
  const next = await api('git/trees','POST',{base_tree:parent.tree.sha, tree});
  const commit = await api('git/commits','POST',{message:'Publish True Homes website changes',parents:[head],tree:next.sha});
  await api('git/refs/heads/main','PATCH',{sha:commit.sha,force:false});
  return reply({sha:commit.sha});
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(prefix)) return env.ASSETS.fetch(req);
    try {
      const action = url.pathname.slice(prefix.length);
      if (!env.ADMIN_USER || !env.ADMIN_PASSWORD || !env.GITHUB_TOKEN) fail('Admin sign-in needs one-time setup in Cloudflare. Add ADMIN_USER, ADMIN_PASSWORD and GITHUB_TOKEN to this Worker.',503);
      if (req.method !== (action==='content'?'GET':'POST')) fail('Method unavailable.',405);
      if (req.method==='POST' && req.headers.get('Origin') !== url.origin) fail('Open the editor on this website.',403);
      if (action==='login') {
        if (!(await env.LOGIN_LIMIT.limit({key:req.headers.get('CF-Connecting-IP') || 'local'})).success) fail('Too many attempts. Try again in a minute.',429);
        const {user,password} = await req.json();
        if (!crypto.subtle.timingSafeEqual(await digest(JSON.stringify([user,password])), await digest(JSON.stringify([env.ADMIN_USER,env.ADMIN_PASSWORD])))) fail('Check your user ID and password.',401);
        const expires = String(Math.floor(Date.now()/1000)+lifetime);
        const signature = hex(await crypto.subtle.sign('HMAC',await signingKey(env),encoder.encode(expires)));
        return reply({ok:true},200,setCookie(expires+'.'+signature,lifetime));
      }
      if (action==='logout') return reply({ok:true},200,setCookie('',0));
      if (!await authenticated(req,env)) fail('Sign in to continue. Your local draft is saved.',401);
      const api = github(env.GITHUB_TOKEN);
      if (action==='content') return reply(await load(api));
      if (action==='upload') {
        const content = await req.text();
        if (!content.length || content.length>32*1024*1024) fail('Choose a file up to 24 MiB.',400);
        const {sha} = await api('git/blobs','POST',{content,encoding:'base64'});
        return reply({sha});
      }
      if (action==='publish') return await publish(api, await req.json());
      return reply({error:'Unknown action.'},404);
    } catch (error) { return reply({error:error.status?error.message:'The editor request failed. Your draft is saved.'},error.status || 500); }
  }
};
