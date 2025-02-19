# Plugin InfoFlow para Obsidian

Este plugin integra [InfoFlow](https://www.infoflow.app) con Obsidian, permitiéndote sincronizar tus artículos guardados, páginas web, notas y resaltados directamente en tu bóveda de Obsidian.

InfoFlow es un Sistema de Gestión del Conocimiento Personal (PKMS) que te permite guardar artículos, páginas web, publicaciones de X, videos de YouTube, notas y resaltados desde tu navegador y sincronizarlos con tu bóveda de Obsidian.

[Versión en chino](./README_zh.md)

Este plugin aún está en desarrollo.
Por favor, informa cualquier problema a través de los "issues" de GitHub o al [Soporte de InfoFlow](https://www.infoflow.app/support). ¡Gracias por tu apoyo!

## Características

- Sincroniza elementos de InfoFlow con tu bóveda de Obsidian.
- Convierte contenido HTML a Markdown automáticamente.
- Plantillas personalizables para nombres de archivo.
- Plantillas personalizables para notas con frontmatter.
- Soporte para resaltados y anotaciones.
- Filtra la sincronización por fecha, etiquetas y carpetas.
- Opciones de sincronización manual y automática.

## Instalación

1. Abre la configuración de Obsidian.
2. Ve a "Community Plugins" y desactiva el "Safe Mode".
3. Haz clic en "Browse" y busca "InfoFlow".
4. Instala el plugin y actívalo.

## Configuración

1. Obtén tu token API de InfoFlow (puedes crearlo en <https://www.infoflow.app/user_portal/external_token>).
   - En el futuro, se requerirá una suscripción a InfoFlow para usar este token API.
2. Abre la configuración del plugin en Obsidian.
3. Ingresa tu token API.
4. Configura las opciones de sincronización:
   - Carpeta de destino para las notas sincronizadas.
   - Plantilla de nombre de archivo.
   - Plantilla de nota.
   - Frecuencia de sincronización.

### Variables de Plantilla Disponibles

#### Plantilla de Nombre de Archivo
- `{{title}}` - Título del elemento.
- `{{id}}` - ID del elemento.
- `{{itemType}}` - Tipo de elemento (web_page, pdf, etc.).

#### Plantilla de Nota
- `{{title}}` - Título del elemento.
- `{{url}}` - URL de origen.
- `{{itemType}}` - Tipo de elemento.
- `{{author}}` - Metadatos del autor.
- `{{tags}}` - Etiquetas del elemento.
- `{{createdAt}}` - Fecha de creación.
- `{{updatedAt}}` - Fecha de última actualización.
- `{{content}}` - Contenido principal.
- `{{notes}}` - Sección de resaltados/anotaciones.

## Uso

### Sincronización Manual
1. Haz clic en el icono de sincronización de InfoFlow en la cinta izquierda.
2. O usa la paleta de comandos y busca "Sync InfoFlow Items".

### Sincronización Automática
El plugin se sincronizará automáticamente según la frecuencia de sincronización configurada.

### Filtrado
Puedes filtrar los elementos a sincronizar por:
- Rango de fechas.
- Etiquetas.
- Carpetas.
- Hora de la última actualización.

## Requisitos

- Una cuenta activa de InfoFlow Cloud. Las versiones locales con Google Drive o OneDrive NO son compatibles debido a la naturaleza del plugin de Obsidian (se requiere un servidor centralizado para sincronizar los archivos).
- Token API de InfoFlow.
- Obsidian v0.15.0 o superior.

## Soporte

- Visita el [Soporte de InfoFlow](https://www.infoflow.app/support).
- Informa problemas en GitHub.

## Licencia

Licencia MIT. Consulta LICENSE para más detalles.