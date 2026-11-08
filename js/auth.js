import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { setToken, clearToken } from "./api.js";

async function supabaseAuthFetch(path, body) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error_description || data?.msg || data?.error || "Error de autenticación";
    throw new Error(message);
  }

  return data;
}

// Returns { needsConfirmation: true } if the project requires email
// confirmation before a session is issued.
export async function signUp(email, password) {
  // Tells Supabase exactly where to send the confirmation link back to —
  // the page the person is actually using, local or deployed — instead
  // of falling back to whatever "Site URL" is set in the dashboard.
  const redirectTo = encodeURIComponent(location.origin + location.pathname);
  const data = await supabaseAuthFetch(`/signup?redirect_to=${redirectTo}`, { email, password });

  if (!data.access_token) {
    return { needsConfirmation: true, userId: data.id ?? data.user?.id };
  }

  setToken(data.access_token);
  return { needsConfirmation: false, userId: data.user.id };
}

export async function signIn(email, password) {
  const data = await supabaseAuthFetch("/token?grant_type=password", { email, password });
  setToken(data.access_token);
  return { userId: data.user.id };
}

export function signOut() {
  clearToken();
}
