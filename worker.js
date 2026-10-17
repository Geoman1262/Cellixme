const COOKIE = "cellix_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const fail = (message, status = 400) => json({ error: message }, status);
const id = () => crypto.randomUUID();
const enc = new TextEncoder();
function b64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function unb64(s) { s=s.replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); }
async function passwordHash(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt, iterations:210000, hash:"SHA-256" }, key, 256);
  return `${b64(salt)}.${b64(bits)}`;
}
async function passwordMatches(password, stored) {
  const [saltPart, hashPart] = (stored || "").split("."); if (!saltPart || !hashPart) return false;
  const candidate = await passwordHash(password, unb64(saltPart));
  const a = enc.encode(candidate.split(".")[1]), b = enc.encode(hashPart);
  if (a.length !== b.length) return false; let diff=0; for(let i=0;i<a.length;i++) diff |= a[i]^b[i]; return diff===0;
}
async function sign(payload, secret) {
  const data = b64(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), {name:"HMAC",hash:"SHA-256"}, false,["sign"]);
  const sig = b64(await crypto.subtle.sign("HMAC", key, enc.encode(data))); return `${data}.${sig}`;
}
async function verify(token, secret) {
  if (!token || !secret) return null; const parts=token.split("."); if(parts.length!==2) return null;
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  const ok=await crypto.subtle.verify("HMAC",key,unb64(parts[1]),enc.encode(parts[0])); if(!ok) return null;
  try { const p=JSON.parse(new TextDecoder().decode(unb64(parts[0]))); return p.exp>Date.now()/1000?p:null; } catch { return null; }
}
function cookie(value, maxAge=SESSION_SECONDS) { return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function getCookie(req) { return (req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)||""; }
async function currentUser(req, env) { const p=await verify(getCookie(req),env.SESSION_SECRET); if(!p) return null; return await env.DB.prepare("SELECT id,email,display_name,role,plan FROM users WHERE id=?").bind(p.sub).first(); }
const safeUser = u => ({id:u.id,email:u.email,displayName:u.display_name,role:u.role,plan:u.plan});
const slugOK = s => /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(s) && !["admin","api","login","register","dashboard","settings","assets","pricing","about","contact"].includes(s);
const cardFields = ["slug","card_type","title","display_name","company","bio","avatar_url","phone","email","website","whatsapp","instagram","facebook","linkedin","tiktok","address","is_published"];
function cardOut(c) { if(!c) return c; return {id:c.id,slug:c.slug,cardType:c.card_type,title:c.title,displayName:c.display_name,company:c.company,bio:c.bio,avatarUrl:c.avatar_url,phone:c.phone,email:c.email,website:c.website,whatsapp:c.whatsapp,instagram:c.instagram,facebook:c.facebook,linkedin:c.linkedin,tiktok:c.tiktok,address:c.address,isPublished:!!c.is_published,createdAt:c.created_at,updatedAt:c.updated_at}; }
async function route(req, env) {
 const url=new URL(req.url), path=url.pathname, method=req.method;
 if(path==="/api/health"&&method==="GET") return json({ok:true,app:"Cellix Me"});
 if(path==="/api/register"&&method==="POST") {
  const b=await req.json().catch(()=>null); if(!b) return fail("Invalid request.");
  const email=String(b.email||"").trim().toLowerCase(), password=String(b.password||""), name=String(b.displayName||"").trim().slice(0,80);
  if(!/^\S+@\S+\.\S+$/.test(email)) return fail("Please enter a valid email."); if(password.length<10) return fail("Password must be at least 10 characters."); if(!name) return fail("Please enter your name.");
  const exists=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first(); if(exists) return fail("An account with this email already exists.",409);
  const userId=id(), slugBase=(String(b.slug||name).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30))||"member";
  let slug=slugBase, n=1; while(await env.DB.prepare("SELECT id FROM cards WHERE slug=?").bind(slug).first()) { n++; slug=`${slugBase.slice(0,Math.max(1,29-String(n).length))}-${n}`; }
  const role=env.ADMIN_EMAIL&&email===env.ADMIN_EMAIL.toLowerCase()?"admin":"user";
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,display_name,role) VALUES(?,?,?,?,?)").bind(userId,email,await passwordHash(password),name,role).run();
  const cardId=id(); await env.DB.prepare("INSERT INTO cards(id,user_id,slug,title,display_name) VALUES(?,?,?,?,?)").bind(cardId,userId,slug,name,name).run();
  const token=await sign({sub:userId,exp:Math.floor(Date.now()/1000)+SESSION_SECONDS},env.SESSION_SECRET);
  return json({user:safeUser({id:userId,email,display_name:name,role,plan:"free"}),card:{id:cardId,slug,displayName:name,title:name}},201,{"set-cookie":cookie(token)});
 }
 if(path==="/api/login"&&method==="POST") {
  const b=await req.json().catch(()=>null); if(!b) return fail("Invalid request."); const email=String(b.email||"").trim().toLowerCase(), password=String(b.password||"");
  const u=await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first(); if(!u||!(await passwordMatches(password,u.password_hash))) return fail("Email or password is incorrect.",401);
  const token=await sign({sub:u.id,exp:Math.floor(Date.now()/1000)+SESSION_SECONDS},env.SESSION_SECRET); return json({user:safeUser(u)},200,{"set-cookie":cookie(token)});
 }
 if(path==="/api/logout"&&method==="POST") return json({ok:true},200,{"set-cookie":cookie("",0)});
 if(path==="/api/me"&&method==="GET") { const u=await currentUser(req,env); if(!u) return fail("Not signed in.",401); const cards=await env.DB.prepare("SELECT * FROM cards WHERE user_id=? ORDER BY created_at DESC").bind(u.id).all(); return json({user:safeUser(u),cards:cards.results.map(cardOut)}); }
 if(path==="/api/cards"&&method==="POST") { const u=await currentUser(req,env); if(!u) return fail("Please sign in.",401); if(u.plan==="free") { const count=await env.DB.prepare("SELECT COUNT(*) n FROM cards WHERE user_id=?").bind(u.id).first(); if(count.n>=1) return fail("The free plan allows one card. More cards will be available in a future paid plan.",403); }
  const b=await req.json().catch(()=>({})); let slug=String(b.slug||"").toLowerCase().trim(); if(!slugOK(slug)) return fail("Choose a URL name using 3–30 lowercase letters, numbers, or hyphens."); if(await env.DB.prepare("SELECT id FROM cards WHERE slug=?").bind(slug).first()) return fail("That card URL is already taken.",409);
  const cid=id(); await env.DB.prepare("INSERT INTO cards(id,user_id,slug,title,display_name,card_type) VALUES(?,?,?,?,?,?)").bind(cid,u.id,slug,String(b.title||"").slice(0,100),String(b.displayName||u.display_name).slice(0,100),b.cardType==="business"?"business":"personal").run(); const c=await env.DB.prepare("SELECT * FROM cards WHERE id=?").bind(cid).first(); return json({card:cardOut(c)},201); }
 if(path.startsWith("/api/cards/")&&method==="PUT") { const u=await currentUser(req,env); if(!u) return fail("Please sign in.",401); const cid=path.split("/")[3]; const old=await env.DB.prepare("SELECT * FROM cards WHERE id=? AND user_id=?").bind(cid,u.id).first(); if(!old) return fail("Card not found.",404); const b=await req.json().catch(()=>null); if(!b) return fail("Invalid request.");
  const v={}; for(const f of cardFields) if(Object.prototype.hasOwnProperty.call(b,f)) v[f]=b[f]; if(v.slug!==undefined) { v.slug=String(v.slug).toLowerCase().trim(); if(!slugOK(v.slug)) return fail("Invalid card URL."); const dup=await env.DB.prepare("SELECT id FROM cards WHERE slug=? AND id<>?").bind(v.slug,cid).first(); if(dup) return fail("That URL is already taken.",409); }
  const limits={title:100,display_name:100,company:120,bio:500,avatar_url:500,phone:40,email:150,website:300,whatsapp:80,instagram:300,facebook:300,linkedin:300,tiktok:300,address:250}; for(const [k,max] of Object.entries(limits)) if(v[k]!==undefined) v[k]=String(v[k]||"").slice(0,max);
  if(v.card_type!==undefined) v.card_type=v.card_type==="business"?"business":"personal"; if(v.is_published!==undefined) v.is_published=v.is_published?1:0;
  const keys=Object.keys(v); if(!keys.length) return json({card:cardOut(old)}); const sql=`UPDATE cards SET ${keys.map(k=>`${k}=?`).join(",")}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`; await env.DB.prepare(sql).bind(...keys.map(k=>v[k]),cid,u.id).run(); return json({card:cardOut(await env.DB.prepare("SELECT * FROM cards WHERE id=?").bind(cid).first())}); }
 if(path.startsWith("/api/public/slug/")&&method==="GET") { const slug=decodeURIComponent(path.slice("/api/public/slug/".length)); const c=await env.DB.prepare("SELECT * FROM cards WHERE slug=? AND is_published=1").bind(slug).first(); if(!c) return fail("Card not found.",404); await env.DB.prepare("INSERT INTO visits(id,card_id) VALUES(?,?)").bind(id(),c.id).run(); return json({card:cardOut(c)}); }
 if(path==="/api/admin/overview"&&method==="GET") { const u=await currentUser(req,env); if(!u) return fail("Please sign in.",401); if(u.role!=="admin") return fail("Admin access required.",403); const [users,cards,visits]=await Promise.all([env.DB.prepare("SELECT COUNT(*) n FROM users").first(),env.DB.prepare("SELECT COUNT(*) n FROM cards").first(),env.DB.prepare("SELECT COUNT(*) n FROM visits").first()]); const latest=await env.DB.prepare("SELECT c.id,c.slug,c.display_name,c.is_published,u.email FROM cards c JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 100").all(); return json({users:users.n,cards:cards.n,visits:visits.n,latest:latest.results}); }
 return null;
}
export default { async fetch(req,env) { const url=new URL(req.url); if(url.pathname.startsWith("/api/")) { if(!env.SESSION_SECRET) return fail("Server setup incomplete: SESSION_SECRET is missing.",500); try { const res=await route(req,env); return res||fail("Not found.",404); } catch(e) { console.error(e); return fail("Unexpected server error.",500); } } const allowed = new Set(["/index.html", "/app.js", "/styles.css", "/manifest.webmanifest"]);
 const assetPath = url.pathname === "/" ? "/index.html" : url.pathname;
 if (allowed.has(assetPath)) {
   const assetUrl = new URL(req.url);
   assetUrl.pathname = assetPath;
   return env.ASSETS.fetch(new Request(assetUrl, req));
 }
 if (!url.pathname.startsWith("/api/") && !url.pathname.includes(".")) {
   const assetUrl = new URL(req.url);
   assetUrl.pathname = "/index.html";
   return env.ASSETS.fetch(new Request(assetUrl, req));
 }
 return new Response("Not found", {status:404}); } };
