// Creator Scorecard — scorecard.datalitica.com.co
// Ingreso con usuario y contraseña (Supabase Auth). Solo los correos en scorecard_analistas ven y piden fichas.
const CONFIG = {
  url: "https://tidctfgcbzziiqnbjjer.supabase.co",
  // clave pública (anon): segura en el navegador; los permisos los dan las políticas RLS
  anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZGN0ZmdjYnp6aWlxbmJqamVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzODc2NTQsImV4cCI6MjEwNDk2MzY1NH0.wpHMdTFvCVzzE56Nin4Nc1aYZqokCCa19gumNqQvZgs",
};
const sb = supabase.createClient(CONFIG.url, CONFIG.anon);
// Verificación de que no es un robot (Cloudflare Turnstile, widget propio de Creator Scorecard)
const TURNSTILE = { sitekey: "0x4AAAAAAGIjN2fIOq1Us6H5", token: "", widget: null };
function cargarTurnstile(){
  TURNSTILE.token = ""; TURNSTILE.widget = null;
  const pintar = () => {
    const el = document.getElementById("ts"); if(!el || !window.turnstile) return;
    TURNSTILE.widget = window.turnstile.render(el, { sitekey: TURNSTILE.sitekey, language: "es",
      callback: t => { TURNSTILE.token = t; },
      "expired-callback": () => { TURNSTILE.token = ""; },
      "error-callback": () => { TURNSTILE.token = ""; } });
  };
  if(window.turnstile) return pintar();
  window.onTurnstile = pintar;
  const sc = document.createElement("script");
  sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstile"; sc.async = true;
  document.head.appendChild(sc);
}
function reiniciarTurnstile(){ TURNSTILE.token = ""; if(window.turnstile && TURNSTILE.widget !== null) window.turnstile.reset(TURNSTILE.widget); }
const app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const REDES = {
  instagram: {n:"Instagram", c:"#E1306C", ej:"https://www.instagram.com/usuario/", re:/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/i,
              svg:'<rect x="3" y="3" width="18" height="18" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/>'},
  tiktok:    {n:"TikTok", c:"#16243A", ej:"https://www.tiktok.com/@usuario", re:/^https:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9._]{1,30}\/?$/i,
              svg:'<path fill="currentColor" d="M16 3c.5 2.6 2.2 4.2 4.8 4.4v3.1c-1.7.1-3.3-.4-4.8-1.4v6.6c0 3.5-2.8 6.3-6.3 6.3s-6.3-2.8-6.3-6.3 2.8-6.3 6.3-6.3c.3 0 .6 0 .9.1v3.2a3.1 3.1 0 1 0 2.2 3V3H16z"/>'},
  facebook:  {n:"Facebook", c:"#1877F2", ej:"https://www.facebook.com/pagina", re:/^https:\/\/(www\.|m\.)?facebook\.com\/[A-Za-z0-9._-]{1,80}\/?$/i,
              svg:'<circle cx="12" cy="12" r="10" fill="currentColor"/><path fill="#fff" d="M13.4 22v-8.1h2.4l.4-2.8h-2.8V9.4c0-.8.3-1.4 1.4-1.4h1.5V5.5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.7v2h-2.4v2.8h2.4V22z"/>'},
  youtube:   {n:"YouTube", c:"#FF0000", ej:"https://www.youtube.com/@canal", re:/^https:\/\/(www\.)?youtube\.com\/@[A-Za-z0-9._-]{1,60}\/?$/i,
              svg:'<rect x="2" y="5.5" width="20" height="13" rx="4" fill="currentColor"/><path fill="#fff" d="M10 9v6l5.2-3z"/>'},
};
const ic = r => REDES[r] ? `<span class="ic" style="color:${REDES[r].c}" role="img" aria-label="${REDES[r].n}" title="${REDES[r].n}"><svg viewBox="0 0 24 24" aria-hidden="true">${REDES[r].svg}</svg></span>` : "";
const ESTADOS = {recibida:"En cola", en_proceso:"Trabajando", lista:"Lista", error:"Con error"};
const ETAPAS = {alta:"preparando", captura:"leyendo Instagram", colaboraciones:"buscando marcas", comentarios:"leyendo comentarios",
                clasificacion:"clasificando comentarios", analisis:"analizando", ficha:"armando la ficha", validacion:"revisando", subida:"publicando",
                captura_tiktok:"leyendo TikTok con Chrome", captura_youtube:"leyendo YouTube con Chrome", captura_facebook:"leyendo Facebook con Chrome"};
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
        <p class="ayuda">Elige la red, pega el enlace del perfil y agrega las demás redes del creador. Se analizan los últimos 30 días.</p>
        <form class="nueva" id="f-nueva" novalidate>
          <div id="filas-redes" class="filas-redes"></div>
          <button class="secundario" id="otra-red" type="button">+ Agregar otra red</button>
          <div id="ts" class="ts" aria-label="Verificación de que no eres un robot"></div>
          <div id="msg-nueva"></div>
          <button class="primario" type="submit">Pedir ficha</button>
        </form></section>
      <section class="panel"><h2>Fichas</h2><p class="ayuda">Se actualiza solo cada 15 segundos.</p><div class="lista" id="lista"></div></section>
    </main></div>`;
  document.getElementById("salir").addEventListener("click", async () => { await sb.auth.signOut(); ingreso(); });
  document.getElementById("f-nueva").addEventListener("submit", pedir);
  document.getElementById("otra-red").addEventListener("click", () => agregarFila());
  agregarFila("instagram");
  cargarTurnstile();
  await listar();
  clearInterval(refresco);
  refresco = setInterval(listar, 15000);
}

function limpiar(u){ try { const x = new URL(u.trim()); return `https://${x.hostname}${x.pathname}`.replace(/\/+$/,"/"); } catch { return u.trim(); } }

function elegidas(){ return [...document.querySelectorAll(".fila-red select")].map(x => x.value); }
function agregarFila(red){
  const cont = document.getElementById("filas-redes");
  const usadas = elegidas();
  const libre = red || Object.keys(REDES).find(r => !usadas.includes(r));
  if(!libre) return;
  const f = document.createElement("div");
  f.className = "fila-red";
  f.innerHTML = `<label>Red<select name="red">${Object.entries(REDES).map(([k,v])=>`<option value="${k}" ${k===libre?"selected":""}>${v.n}</option>`).join("")}</select></label>
    <label>Enlace del perfil<input name="url" type="url" placeholder="${REDES[libre].ej}" required></label>
    <button type="button" class="quitar" aria-label="Quitar esta red" title="Quitar">×</button>`;
  f.querySelector("select").addEventListener("change", e => { f.querySelector("input").placeholder = REDES[e.target.value].ej; refrescarBotones(); });
  f.querySelector(".quitar").addEventListener("click", () => { f.remove(); refrescarBotones(); });
  cont.appendChild(f);
  refrescarBotones();
  f.querySelector("input").focus();
}
function refrescarBotones(){
  const filas = document.querySelectorAll(".fila-red");
  filas.forEach(f => f.querySelector(".quitar").hidden = filas.length === 1);
  document.getElementById("otra-red").hidden = filas.length >= 4;
}

async function pedir(e){
  e.preventDefault();
  const f = e.target, msg = document.getElementById("msg-nueva"), b = f.querySelector("button[type=submit]");
  const redes = [...f.querySelectorAll(".fila-red")].map(x => ({ red: x.querySelector("select").value, url: limpiar(x.querySelector("input").value).replace(/\/$/, x.querySelector("select").value==="instagram" ? "/" : "") }));
  const error = m => { msg.innerHTML = `<p class="msg error" role="alert">${esc(m)}</p>`; };
  if(new Set(redes.map(r=>r.red)).size !== redes.length) return error("Cada red solo puede ir una vez.");
  const mala = redes.find(r => !REDES[r.red].re.test(r.url));
  if(mala) return error(`Revisa el enlace de ${REDES[mala.red].n}. Debe ser el del perfil, por ejemplo ${REDES[mala.red].ej}`);
  if(!TURNSTILE.token) return error("Marca la verificación de que no eres un robot y vuelve a intentar.");
  b.disabled = true; b.textContent = "Enviando…";
  const { data: { session } } = await sb.auth.getSession();
  let r, j = {};
  try {
    r = await fetch(`${CONFIG.url}/functions/v1/scorecard-pedir`, { method: "POST",
      headers: { "Content-Type": "application/json", apikey: CONFIG.anon, Authorization: `Bearer ${session?.access_token||""}` },
      body: JSON.stringify({ redes, token: TURNSTILE.token }) });
    j = await r.json().catch(() => ({}));
  } catch { j = { error: "No hay conexión. Intenta de nuevo." }; }
  b.disabled = false; b.textContent = "Pedir ficha";
  reiniciarTurnstile();
  if(!r || !r.ok) return error(j.error || "No se pudo enviar. Intenta de nuevo.");
  document.getElementById("filas-redes").innerHTML = ""; agregarFila("instagram");
  msg.innerHTML = `<p class="msg ok">Listo: quedó en la cola.</p>`;
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
      <p class="m">${(s.redes||[]).map(r=>ic(r.red)).join("")} últimos ${s.ventana_dias||30} días · pedida ${fecha(s.creado_en)}${s.segundos?` · tardó ${duracion(s.segundos)}`:""}</p>
      <div class="acc">${s.estado==="lista"?`<button class="primario" data-ver="${s.id}|ficha" data-t="@${esc(s.handle)}">Ver ficha</button>
        <button class="secundario" data-pdf="${s.id}" data-h="${esc(s.handle)}">Descargar PDF</button>
        <button class="secundario" data-ver="${s.id}|comercial" data-t="Notas internas · @${esc(s.handle)}">Notas internas</button>`:""}</div>
      ${notas.length?`<p class="notas">${notas.map(esc).join(" ")}</p>`:""}</article>`; }).join("");
  el.querySelectorAll("[data-ver]").forEach(b => b.addEventListener("click", () => ver(b.dataset.ver, b.dataset.t)));
  el.querySelectorAll("[data-pdf]").forEach(b => b.addEventListener("click", () => descargarPdf(b, b.dataset.pdf, b.dataset.h)));
}

async function descargarPdf(boton, id, handle){
  const txt = boton.textContent; boton.disabled = true; boton.textContent = "Preparando…";
  const { data, error } = await sb.from("scorecard_archivos").select("html").eq("solicitud_id", id).eq("tipo", "pdf").maybeSingle();
  boton.disabled = false; boton.textContent = txt;
  if(error || !data){ alert("El PDF de esta ficha todavía no está disponible."); return; }
  const bin = atob(data.html), bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  a.download = `Ficha-${handle}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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

/* ---------- crear contraseña (enlace de un solo uso: #crear=<token>) */
function crearClave(error){
  app.innerHTML = `<div class="ingreso"><form id="f-clave" novalidate>
    <img src="assets/logo-datalitica.png" alt="Datalítica">
    <div><h1>Crea tu contraseña</h1><p>Es la que usarás para entrar a Creator Scorecard. Mínimo 10 caracteres.</p></div>
    ${error?`<p class="msg error" role="alert">${esc(error)}</p>`:""}
    <label>Contraseña nueva<input type="password" name="c1" autocomplete="new-password" minlength="10" required></label>
    <label>Repítela<input type="password" name="c2" autocomplete="new-password" minlength="10" required></label>
    <button class="primario" type="submit">Guardar y entrar</button>
  </form></div>`;
  document.getElementById("f-clave").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    if(f.c1.value.length < 10) return crearClave("Usa al menos 10 caracteres.");
    if(f.c1.value !== f.c2.value) return crearClave("Las dos contraseñas no coinciden.");
    const { error } = await sb.auth.updateUser({ password: f.c1.value });
    if(error) return crearClave("No se pudo guardar. Pide un enlace nuevo.");
    inicio();
  });
}

async function arrancar(){
  const token = new URLSearchParams(location.hash.slice(1)).get("crear");
  if(token){
    history.replaceState(null, "", location.pathname);   // el enlace no queda en el historial
    const { error } = await sb.auth.verifyOtp({ token_hash: token, type: "recovery" });
    return error ? ingreso("El enlace ya se usó o venció. Pide uno nuevo.") : crearClave();
  }
  inicio();
}

sb.auth.onAuthStateChange((ev) => { if(ev === "SIGNED_OUT") ingreso(); });
arrancar();
