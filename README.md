# OnlyFrens

Red social efímera y privada para tus amigos cercanos. Solo texto e imágenes, sin anuncios, y todo desaparece a las 24 horas.

Este repositorio es el **frontend** (PWA). El servidor vive en [`onlyfrens-backend`](../onlyfrens-backend).

## Cómo funciona

- **Efímero**: cada publicación dura 24 horas. Pasado ese tiempo se borra de forma permanente, junto con sus imágenes.
- **Solo amigos**: ves lo que publican tus amigos, y ellos lo que publicas tú. Para conectar hay que enviar una solicitud y que la otra persona la acepte. No existe buscador de usuarios.
- **Likes y respuestas**: todos ven el número total. Quién dio like solo lo ve el autor, y solo lees las respuestas de personas que también son tus amigos.
- **Compartir**: un amigo puede compartir tu publicación (si lo permitiste al publicar) y aparece en el feed de sus amigos con la etiqueta "Compartido", sin mostrar quién la escribió. Mientras alguien la siga compartiendo, el contenido sigue vivo.
- **Cumpleaños**: el día del cumpleaños de un amigo aparece una etiqueta junto a sus publicaciones y recibes un aviso.
- **Borrar**: puedes eliminar tus publicaciones antes de las 24 horas. Si borras la original, desaparece para todos, incluidos quienes la compartieron.

## Privacidad que puedes comprobar en este código

- No hay analíticas, rastreadores ni scripts de terceros.
- No se carga nada desde CDNs: la tipografía y los íconos están incluidos en el repositorio.
- La app solo se comunica con dos servidores, los de `js/config.js`: el backend de OnlyFrens y la autenticación de Supabase.
- En el dispositivo solo se guarda el token de sesión (`localStorage`). Nunca contraseñas.
- Las imágenes se comprimen en tu dispositivo antes de subirse.
- Las reglas de quién puede ver qué las aplica el servidor, no esta app.

## Stack

HTML, CSS y JavaScript sin frameworks ni dependencias. PWA instalable con Service Worker. Tipografía [Jost](https://fonts.google.com/specimen/Jost) e íconos [Phosphor](https://phosphoricons.com), ambos autoalojados.

## Estructura

```
index.html
manifest.json
sw.js
css/style.css
js/
  app.js            pantallas y navegación
  config.js         URLs y claves públicas
  api.js            llamadas al backend
  auth.js           registro e inicio de sesión
  auth-screen.js    pantalla de acceso
  home.js           feed
  post-card.js      tarjeta de publicación
  comments-sheet.js respuestas
  composer.js       crear publicación
  compress.js       compresión de imágenes
  friends.js        amigos y solicitudes
  notifications.js  notificaciones
  profile.js        perfil
  icons.js          íconos
  utils.js          utilidades
assets/
  icons/            avatar por defecto
  opengraph/        logo, favicon e íconos de instalación
typography/         fuente Jost
```

## Configuración

Edita `js/config.js`:

```js
export const API_BASE_URL = "https://tu-backend.deno.dev";
export const SUPABASE_URL = "https://tu-proyecto.supabase.co";
export const SUPABASE_ANON_KEY = "tu-anon-key";
```

La `anon key` es pública por diseño. **Nunca** pongas aquí la `service_role key`.

Coloca en `assets/opengraph/`:

| Archivo | Tamaño | Transparencia | Para qué |
|---|---|---|---|
| `logo.png` | cuadrado, cualquier tamaño ≥512px | puede tener | favicon de la pestaña |
| `opengraph.png` | 1200×630 | sin transparencia (ocuparía fondo negro al compartir) | vista previa al compartir el link |
| `apple-touch-icon.png` | 180×180 exacto | **sin transparencia** | ícono al instalar en iPhone/iPad |
| `icon-192.png` | 192×192 | puede tener | ícono de instalación (Android/PWA) |
| `icon-512.png` | 512×512 | puede tener | ícono de instalación, resolución alta |
| `icon-512-maskable.png` | 512×512, contenido centrado dejando ~20% de margen alrededor | puede tener | Android recorta este en distintas formas (círculo, squircle...) según el launcher; el margen evita que recorte el logo |

**Por qué `apple-touch-icon.png` no puede tener transparencia:** iOS no respeta la transparencia en este ícono — la parte transparente se rellena con un color inconsistente según el dispositivo, y se ve roto. iOS tampoco redondea las esquinas por ti del todo bien si el PNG ya trae formas raras; sube un cuadrado completo, sin esquinas redondeadas (el sistema las aplica).

## Ejecutar en local

Necesita servirse por `http://` (no funciona abriendo el archivo directamente). Desde esta carpeta:

```bash
python3 -m http.server 5500
```

y abre `http://localhost:5500`. En `js/config.js`, apunta `API_BASE_URL` a tu backend local (`http://localhost:8000`).

Mientras desarrollas, activa "Update on reload" en DevTools → Application → Service Workers, o usa una ventana de incógnito.

## Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a la rama principal del repositorio.
2. En *Settings → Pages*, elige esa rama y la carpeta raíz.
3. Cuando cambies archivos de la app, sube el número de `CACHE_NAME` en `sw.js` si quieres forzar la actualización inmediata en los dispositivos.

## Invitar amigos

En *Perfil → Compartir perfil* se genera un enlace terminado en `#add=tu_username`. Quien lo abra con sesión iniciada puede enviarte una solicitud de amistad.
