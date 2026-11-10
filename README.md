# OnlyFrens

Una red social que dura un día.

## Qué es

OnlyFrens es para los amigos cercanos, no para el mundo entero. Publicas texto e imágenes, y a las 24 horas desaparece — sin archivo, sin "recuerdos de hace 3 años", sin nada que te persiga después. Solo lo de hoy, con la gente que realmente conoces.

No hay anuncios. No hay algoritmo decidiendo qué ves. No hay forma de buscar a desconocidos. Es, a propósito, lo contrario a una red social pensada para crecer sin límite.

## Por qué es distinta

- **Todo es efímero.** Cada publicación vive 24 horas y se borra de verdad — del feed, de la base de datos, y del almacenamiento de imágenes. No hay papelera ni forma de recuperarlo.
- **Solo se entra por invitación mutua.** No existe un buscador de usuarios. Para conectar con alguien hace falta que esa persona acepte tu solicitud — así nadie puede ver tu contenido sin que tú lo hayas permitido explícitamente.
- **Los likes son públicos, pero el detalle no.** Todos ven cuántos likes tiene algo; solo el autor ve quién los dio.
- **Las respuestas son privadas entre amigos.** Solo lees los comentarios de las personas que también tú has agregado, aunque el número total de respuestas sea visible para cualquiera.
- **Compartir sin exponer al autor.** Puedes compartir la publicación de alguien con tus propios amigos sin revelar de quién la sacaste — y si el autor desactivó esa opción al publicar, no se puede compartir en absoluto.
- **El cumpleaños de un amigo se nota.** El día que alguien cumple años, sus publicaciones llevan una pequeña insignia para que no se te pase.

## Privacidad que se puede comprobar

El código de este repositorio es público a propósito: cualquiera puede revisarlo y confirmar que no hay nada escondido.

- Sin rastreadores ni scripts de terceros.
- Sin CDNs externas — la tipografía y los íconos están incluidos en el repositorio.
- El dispositivo solo guarda el token de tu sesión, nunca tu contraseña.
- Las reglas de quién puede ver qué las aplica el servidor, no esta app — revisarlas en el frontend no sirve para saltárselas.

## Stack

HTML, CSS y JavaScript sin frameworks. PWA instalable. El backend vive en un repositorio aparte.
