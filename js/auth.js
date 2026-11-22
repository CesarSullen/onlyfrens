import { API_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { setSession, clearToken, getToken } from "./api.js";
import { clearCache } from "./cache.js";

const AUTH_ERRORS = {
  invalid_credentials: "Email o contraseña incorrectos",
  email_not_confirmed: "Confirma tu email antes de iniciar sesión",
  user_already_exists: "Ya existe una cuenta con ese email",
  email_exists: "Ya existe una cuenta con ese email",
  weak_password: "La contraseña es demasiado débil",
  same_password: "La nueva contraseña debe ser distinta a la actual",
  over_email_send_rate_limit: "Se enviaron demasiados correos. Intenta de nuevo en un rato",
  over_request_rate_limit: "Demasiados intentos. Espera un momento",
  email_address_invalid: "El email no es válido",
  validation_failed: "Revisa los datos ingresados",
  signup_disabled: "El registro de cuentas está desactivado",
  provider_disabled: "Ese método de inicio de sesión no está activado",
  otp_expired: "El enlace caducó o ya se usó. Pide uno nuevo",
  access_denied: "Se canceló el inicio de sesión",
  bad_jwt: "Tu sesión caducó. Pide un enlace nuevo",
  session_not_found: "Tu sesión caducó. Pide un enlace nuevo",
  no_authorization: "Tu sesión caducó. Pide un enlace nuevo",
};

const GENERIC_AUTH_ERROR = "No se pudo completar la acción";

async function supabaseAuthFetch(path, body, { method = "POST", token } = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(AUTH_ERRORS[data?.error_code ?? data?.error] ?? GENERIC_AUTH_ERROR);
  }

  return data;
}

export function startSession(session) {
  clearCache();
  setSession(session);
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

  startSession(data);
  return { needsConfirmation: false, userId: data.user.id };
}

export async function signIn(email, password) {
  const data = await supabaseAuthFetch("/token?grant_type=password", { email, password });
  startSession(data);
  return { userId: data.user.id };
}

const PHONE_EMAIL_DOMAIN = "phone.onlyfrens.invalid";

// Phone accounts are stored under an email built from the number; the backend uses the same rule.
function phoneToEmail(phone) {
  return `${phone.replace(/\D/g, "")}@${PHONE_EMAIL_DOMAIN}`;
}

export function isPhoneEmail(email) {
  return Boolean(email) && email.endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}

// Called without a session, so it skips apiFetch, which would treat a 401 as an expired session.
async function backendAuthFetch(path, body) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("No hay conexión con el servidor");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? GENERIC_AUTH_ERROR);
  return data;
}

export async function signUpWithPhone(phone, password) {
  await backendAuthFetch("/auth/phone-signup", { phone, password });
  return signIn(phoneToEmail(phone), password);
}

export async function signInWithPhone(phone, password) {
  try {
    return await signIn(phoneToEmail(phone), password);
  } catch (err) {
    if (err.message !== AUTH_ERRORS.invalid_credentials) throw err;
  }

  // The account may have swapped the internal email for a real one.
  const data = await backendAuthFetch("/auth/phone-login", { phone, password });
  startSession(data);
  return { userId: data.user.id };
}

export function signOut() {
  clearToken();
}

export async function requestPasswordReset(email) {
  const redirectTo = encodeURIComponent(location.origin + location.pathname);
  await supabaseAuthFetch(`/recover?redirect_to=${redirectTo}`, { email });
}

export async function updatePassword(accessToken, password) {
  await supabaseAuthFetch("/user", { password }, { method: "PUT", token: accessToken });
}

// Supabase emails a confirmation link; the address only changes once it is opened.
export async function requestEmailChange(email) {
  const redirectTo = encodeURIComponent(location.origin + location.pathname);
  await supabaseAuthFetch(`/user?redirect_to=${redirectTo}`, { email }, { method: "PUT", token: getToken() });
}

export function getAuthUser(accessToken) {
  return supabaseAuthFetch("/user", null, { method: "GET", token: accessToken });
}

export function oauthUrl(provider) {
  const redirectTo = encodeURIComponent(location.origin + location.pathname);
  return `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${redirectTo}`;
}

// Supabase sends people back to the app with the session (or an error) in the URL hash.
// The hash is wiped right away so tokens never stay in the address bar or history.
export function readAuthRedirect() {
  const params = new URLSearchParams(location.hash.slice(1));
  const hasSession = params.has("access_token");
  const errorCode = params.get("error_code") ?? params.get("error");

  if (!hasSession && !errorCode) return null;

  history.replaceState(null, "", location.pathname + location.search);

  if (!hasSession) {
    return { type: "error", message: AUTH_ERRORS[errorCode] ?? GENERIC_AUTH_ERROR };
  }

  return {
    type: params.get("type") === "recovery" ? "recovery" : "session",
    session: {
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token"),
      expires_in: Number(params.get("expires_in")),
      expires_at: Number(params.get("expires_at")) || undefined,
    },
  };
}
