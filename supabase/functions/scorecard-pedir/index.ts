// Creator Scorecard — pedir una ficha.
// Verifica: sesión del analista (JWT), que su correo esté en scorecard_analistas y que sea humano (Cloudflare
// Turnstile, el mismo secreto TURNSTILE_SECRET del proyecto). Solo entonces crea la solicitud.
// El navegador ya no puede insertar directo en la tabla (migración 004).
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = ["https://scorecard.datalitica.com.co", "http://localhost:8830"];
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

class Falla extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}

async function humano(token: unknown, ip: string) {
  const secret = Deno.env.get("SCORECARD_TURNSTILE_SECRET") ?? Deno.env.get("TURNSTILE_SECRET");
  if (!secret) throw new Falla(500, "Falta configurar la verificación. Avísale a Datalítica.");
  if (typeof token !== "string" || !token) throw new Falla(400, "Espera a que termine la verificación de que no eres un robot.");
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: new URLSearchParams({ secret, response: token, remoteip: ip }) });
  const j = await r.json();
  if (!j.success) {
    console.log("turnstile", JSON.stringify(j["error-codes"] ?? []), j.hostname ?? "");
    throw new Falla(400, "La verificación venció o no pasó. Márcala de nuevo y vuelve a intentar.");
  }
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  try {
    if (req.method !== "POST") throw new Falla(405, "Método no permitido.");
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: eu } = await db.auth.getUser(jwt);
    if (eu || !u?.user?.email) throw new Falla(401, "Tu sesión venció. Vuelve a entrar.");
    const { count } = await db.from("scorecard_analistas").select("email", { count: "exact", head: true })
      .ilike("email", u.user.email);
    if (!count) throw new Falla(403, "Tu correo no está autorizado como analista.");
    const body = await req.json().catch(() => ({}));
    await humano(body.token, req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "");
    const redes = Array.isArray(body.redes) ? body.redes.map((x: { red?: string; url?: string }) => ({ red: String(x?.red ?? ""), url: String(x?.url ?? "") })) : [];
    const ig = redes.find((x: { red: string }) => x.red === "instagram");
    const { data, error } = await db.from("scorecard_solicitudes")
      .insert({ creado_por: u.user.id, redes, ventana_dias: 30, enlace_instagram: ig ? ig.url : null })
      .select("id, handle").single();
    if (error) {
      console.log("insert", error.message);
      throw new Falla(400, /límite/.test(error.message) ? error.message : "Revisa los enlaces: deben ser perfiles de Instagram, TikTok, Facebook o YouTube.");
    }
    return new Response(JSON.stringify({ ok: true, ...data }), { headers: { ...h, "Content-Type": "application/json" } });
  } catch (e) {
    const f = e instanceof Falla ? e : new Falla(500, "Algo falló. Intenta de nuevo en un momento.");
    if (!(e instanceof Falla)) console.log("error", String(e));
    return new Response(JSON.stringify({ error: f.message }), { status: f.status, headers: { ...h, "Content-Type": "application/json" } });
  }
});
