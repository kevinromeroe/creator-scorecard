// Creator Scorecard — scorecard.datalitica.com.co
// Ingreso con usuario y contraseña (Supabase Auth). Solo los correos en scorecard_analistas ven y piden fichas.
const CONFIG = {
  url: "https://tidctfgcbzziiqnbjjer.supabase.co",
  // clave pública (anon): segura en el navegador; los permisos los dan las políticas RLS
  anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZGN0ZmdjYnp6aWlxbmJqamVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzODc2NTQsImV4cCI6MjEwNDk2MzY1NH0.wpHMdTFvCVzzE56Nin4Nc1aYZqokCCa19gumNqQvZgs",
};
const sb = supabase.createClient(CONFIG.url, CONFIG.anon);
const app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const NICHOS = ["gastronomía","viajes","belleza y moda","fitness y salud","tecnología","entretenimiento y humor",
                "familia y crianza","finanzas","gaming","estilo de vida","diseño y creatividad"];
const ESTADOS = {recibida:"En cola", en_proceso:"Trabajando", lista:"Lista", error:"Con error"};
const ETAPAS = {alta:"preparando", captura:"leyendo Instagram", colaboraciones:"buscando marcas", comentarios:"leyendo comentarios",
                clasificacion:"clasificando comentarios", analisis:"analizando", ficha:"armando la ficha", validacion:"revisando", subida:"publicando"};
let refresco = null;

function fecha(t){ return new Date(t).toLocaleString("es-CO",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
function duracion(s){ if(s==null) return ""; const m=Math.round(s/60); return m<1 ? `${Math.round(s)} s` : `${m} min`; }

/* ---------- ingreso */
function ingreso(error){
  clearInterval(refresco);
  app.innerHTML = `<div class="ingreso"><form id="f-ingreso" novalidate>
    <img src="assets/logo-datalitica.png" alt="Datalítica">
    <div><h1>Creator Scorecard</h1><p>Fichas de desempeño de creadores con datos públicos.</p></div>
    ${error?`<p class="msg error" role="alert">${esc(error)}</p>`:""}
    <label>Correo<input type="email" name="email" autocomplete="username" required></label>
    <label>Contraseña<input type="password" name="clave" autocomplete="current-password" required></label>
    <button class="primario" type="submit">Entrar</button>
  </form></div>`;
  document.getElementById("f-ingreso").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, b = f.querySelector("button");
    b.disabled = true; b.textContent = "Entrando…";
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.clave.value });
    if(error) return ingreso("El correo o la contraseña no coinciden.");
    inicio();
  });
}

/* ---------- aplicación */
async function inicio(){
  const { data: { session } } = await sb.auth.getSession();
  if(!session) return ingreso();
  app.innerHTML = `<header class="barra"><div class="wrap">
      <img src="assets/logo-datalitica.png" alt="Datalítica"><b>Creator Scorecard</b>
      <span class="quien">${esc(session.user.email)}</span>
      <button class="secundario" id="salir" type="button">Salir</button></div></header>
    <div class="wrap"><main>
      <section class="panel"><h2>Nueva ficha</h2>
        <p class="ayuda">Pega el perfil del creador. La ficha queda lista en unos 20 minutos.</p>
        <form class="nueva" id="f-nueva" novalidate>
          <label>Perfil de Instagram<input name="ig" type="url" placeholder="https://www.instagram.com/usuario/" required></label>
          <label>Perfil de TikTok <small>(opcional; por ahora se lee a mano)</small><input name="tt" type="url" placeholder="https://www.tiktok.com/@usuario"></label>
          <label>Nicho<select name="nicho">${NICHOS.map(n=>`<option>${n}</option>`).join("")}</select></label>
          <div id="msg-nueva"></div>
          <button class="primario" type="submit">Pedir ficha</button>
        </form></section>
      <section class="panel"><h2>Fichas</h2><p class="ayuda">Se actualiza solo cada 15 segundos.</p><div class="lista" id="lista"></div></section>
    </main></div>`;
  document.getElementById("salir").addEventListener("click", async () => { await sb.auth.signOut(); ingreso(); });
  document.getElementById("f-nueva").addEventListener("submit", pedir);
  await listar();
  clearInterval(refresco);
  refresco = setInterval(listar, 15000);
}

function limpiar(u){ try { const x = new URL(u.trim()); return `https://${x.hostname}${x.pathname}`.replace(/\/+$/,"/"); } catch { return u.trim(); } }

async function pedir(e){
  e.preventDefault();
  const f = e.target, msg = document.getElementById("msg-nueva"), b = f.querySelector("button");
  const ig = limpiar(f.ig.value), tt = f.tt.value.trim() ? limpiar(f.tt.value).replace(/\/$/,"") : null;
  if(!/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/i.test(ig)){
    msg.innerHTML = `<p class="msg error" role="alert">Pega el enlace del perfil, por ejemplo https://www.instagram.com/usuario/</p>`; return; }
  if(tt && !/^https:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9._]{1,30}$/i.test(tt)){
    msg.innerHTML = `<p class="msg error" role="alert">El enlace de TikTok debe ser el del perfil: https://www.tiktok.com/@usuario</p>`; return; }
  b.disabled = true; b.textContent = "Enviando…";
  const { error } = await sb.from("scorecard_solicitudes").insert({ enlace_instagram: ig, enlace_tiktok: tt, nicho: f.nicho.value });
  b.disabled = false; b.textContent = "Pedir ficha";
  if(error){ msg.innerHTML = `<p class="msg error" role="alert">${esc(/límite/.test(error.message) ? error.message : "No se pudo enviar. Revisa el enlace e intenta de nuevo.")}</p>`; return; }
  f.reset(); msg.innerHTML = `<p class="msg ok">Listo: quedó en la cola.</p>`;
  listar();
}

async function listar(){
  const el = document.getElementById("lista"); if(!el) return;
  const { data, error } = await sb.from("scorecard_solicitudes").select("*").order("creado_en", { ascending:false }).limit(50);
  if(error){ el.innerHTML = `<p class="msg error">No se pudo cargar la lista. Si acabas de entrar, pide que activen tu correo como analista.</p>`; return; }
  if(!data.length){ el.innerHTML = `<p class="vacio">Todavía no has pedido fichas. Empieza con el formulario de la izquierda.</p>`; return; }
  el.innerHTML = data.map(s => {
    const est = s.estado==="en_proceso" && s.etapa ? `${ESTADOS[s.estado]}: ${ETAPAS[s.etapa]||s.etapa}` : ESTADOS[s.estado];
    const notas = [...(s.notas||[]), s.por_confirmar ? `${s.por_confirmar} colaboraciones por confirmar.` : null, s.estado==="error" ? s.error : null].filter(Boolean);
    return `<article class="sol"><div><span class="h">@${esc(s.handle||"")}</span><span class="estado ${s.estado}">${esc(est)}</span></div>
      <p class="m">${esc(s.nicho)} · pedida ${fecha(s.creado_en)}${s.segundos?` · tardó ${duracion(s.segundos)}`:""}</p>
      <div class="acc">${s.estado==="lista"?`<button class="primario" data-ver="${s.id}|ficha" data-t="@${esc(s.handle)}">Ver ficha</button>
        <button class="secundario" data-ver="${s.id}|comercial" data-t="Notas internas · @${esc(s.handle)}">Notas internas</button>`:""}</div>
      ${notas.length?`<p class="notas">${notas.map(esc).join(" ")}</p>`:""}</article>`; }).join("");
  el.querySelectorAll("[data-ver]").forEach(b => b.addEventListener("click", () => ver(b.dataset.ver, b.dataset.t)));
}

async function ver(clave, titulo){
  const [id, tipo] = clave.split("|");
  const { data, error } = await sb.from("scorecard_archivos").select("html").eq("solicitud_id", id).eq("tipo", tipo).single();
  if(error || !data){ alert("No se pudo abrir la ficha."); return; }
  const html = data.html;
  const v = document.createElement("div");
  v.className = "visor"; v.setAttribute("role","dialog"); v.setAttribute("aria-label", titulo);
  v.innerHTML = `<div class="top"><b>${esc(titulo)}</b><button class="secundario" type="button">Cerrar</button></div><iframe sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" title="${esc(titulo)}"></iframe>`;
  v.querySelector("iframe").srcdoc = html;
  const cerrar = () => { v.remove(); document.removeEventListener("keydown", tecla); };
  const tecla = e => { if(e.key==="Escape") cerrar(); };
  v.querySelector("button").addEventListener("click", cerrar);
  document.addEventListener("keydown", tecla);
  document.body.appendChild(v);
  v.querySelector("button").focus();
}

sb.auth.onAuthStateChange((ev) => { if(ev === "SIGNED_OUT") ingreso(); });
inicio();
