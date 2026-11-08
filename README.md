# Micros Santa Cruz – Rutas y Tránsito 🚌🗺️

Aplicación web interactiva y de alto rendimiento para consultar las líneas y recorridos de micros de **Santa Cruz de la Sierra, Bolivia**. Permite inspeccionar rutas de ida y vuelta, calcular trayectos óptimos entre dos puntos (directos o con transbordos), explorar puntos de interés urbanos, activar alertas sonoras/vibratorias de bajada por geocerca GPS y consultar un **Copiloto Agéntico con IA** (Gemini Flash con Function Calling y voz).

La aplicación procesa un archivo GeoJSON con cientos de miles de coordenadas de forma fluida en el navegador mediante tiles vectoriales al vuelo (`geojson-vt`), un Web Worker dedicado y un árbol espacial R-Tree (`rbush`).

---

## Características y Features

### 1. Copiloto Agéntico con IA (Gemini Flash + Function Calling)
- **Asistente conversacional de tránsito**: responde dudas y solicitudes en lenguaje natural adaptado a la jerga y referencias de Santa Cruz (ej. *"¿Qué micro me lleva de la Gabriel al Ventura Mall?"*, *"Mostrame la 72"* o *"Avísame cuando esté a 2 cuadras del Parque Urbano"*).
- **Function Calling en tiempo real**: el modelo de IA invoca herramientas de software en backend que interactúan directamente con el mapa:
  - `planRoute`: calcula la ruta entre origen y destino y dibuja el itinerario.
  - `searchNearbyMicros`: busca los micros que pasan cerca de un punto o lugar de referencia.
  - `highlightLine`: aísla e ilumina el recorrido oficial de ida y vuelta de cualquier línea.
  - `setGeofenceAlarm`: configura automáticamente una alarma geocercada para bajarse del micro.
  - `explorePlaces`: filtra puntos de interés urbanos por categoría o nombre.
- **Entrada y salida por voz**:
  - **Dictado por voz (STT)** usando la Web Speech Recognition API en español.
  - **Lectura en voz alta (TTS)** para escuchar instrucciones mientras estás en el micro.
- **Tarjetas de acción interactiva**: botones directos para ejecutar o inspeccionar las acciones generadas por la IA.
- **Respaldo heurístico de alta disponibilidad**: si el servicio de IA experimenta congestión temporal o falta de clave, un motor de reglas local responde de forma instantánea sin interrumpir al usuario.

### 2. Mapa Vectorial de Alto Rendimiento
- **Renderizado MapLibre GL JS**: mapa fluido con aceleración WebGL y capas vectoriales optimizadas.
- **Indexación y Vector Tiling al Vuelo**: procesa datasets pesados usando `geojson-vt` ejecutado en un Web Worker para mantener la interfaz a 60 FPS sin bloquear el hilo principal.
- **Árbol Espacial R-Tree (`rbush`)**: indexa decenas de miles de segmentos de ruta para consultas geométricas y de proximidad en milisegundos.

### 3. Explorador y Filtrado de Líneas de Micro
- Buscador reactivo por número o nombre de línea (ej. 72, 8, 11, 121, etc.).
- Filtrado por sentido: **Ida (Sentido 1)**, **Vuelta (Sentido 2)** o ambos.
- Paleta de colores distintiva para cada línea, cálculo de distancia total en kilómetros y centrado automático en el recorrido.

### 4. Detección de Rutas Cercanas ("¿Qué micro pasa por aquí?")
- Selección de cualquier coordenada en el mapa con un clic o pulsación móvil.
- Radio de búsqueda configurable (100 m, 200 m, 300 m, 500 m).
- Listado ordenado por distancia exacta al punto marcado y proyección del punto más cercano sobre la calzada.

### 5. Calculador de Rutas A → B (Rutas Directas y con Transbordo)
- Fijación de puntos de origen (A) y destino (B) mediante clics en el mapa, coordenadas GPS o selección de puntos de interés (POIs).
- **Rutas directas**: identifica micros que cubren ambos puntos sin bajarse, indicando distancia caminada, tramo en micro y tiempo estimado.
- **Rutas con 1 transbordo**: calcula transferencias viables entre dos líneas diferentes, especificando el punto de intersección óptimo y las instrucciones paso a paso.
- Visualización gráfica del tramo a pie de inicio, trayecto en micro 1, caminata de conexión, micro 2 y llegada a destino.

### 6. Alertas de Bajada por GPS (Geocercas Sonoras y Vibración)
- *"Avísame cuando esté cerca"*: geocerca reactiva con distancias configurables (100 m, 200 m, 300 m).
- Monitoreo de ubicación en tiempo real mediante `navigator.geolocation.watchPosition` con alta precisión (`enableHighAccuracy`).
- Alarma con sonido sintetizado (Web Audio API) y patrón de vibración en celulares (`navigator.vibrate`), ideal para quienes viajan de noche o desconocen la zona.
- Barra de estado flotante que muestra la distancia restante en tiempo real y la precisión del GPS.

### 7. Lugares de Interés de Santa Cruz (POIs)
- Catálogo de sitios clave categorizados: Universidades, Hospitales, Mercados, Terminales y Centros Comerciales.
- Botones de acción directa: *"Fijar como Origen A"*, *"Fijar como Destino B"* y *"Ver micros cercanos"*.

### 8. Diseño Adaptable (Mobile-First)
- Drawer deslizable inferior en dispositivos móviles con gestos suaves.
- Barra lateral expandible en pantallas de escritorio.
- Modo pantalla completa, geolocalización del usuario y controles de navegación.

---

## Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Lucide React, Motion |
| **Mapas y GIS** | MapLibre GL JS, GeoJSON-VT, RBush, Turf.js |
| **Backend & Servidor** | Node.js, Express, tsx, Vite Middleware |
| **Inteligencia Artificial** | Google GenAI SDK (`@google/genai`), Gemini 3.8 Flash, Function Calling |
| **APIs Web Nativas** | Web Speech API (STT & TTS), Geolocation API, Web Audio API, Vibration API |

---

## Ejecución en un Entorno Local

### Prerrequisitos
- **Node.js**: versión 18 o superior (se recomienda Node.js 20 o 22 LTS).
- **npm**, **pnpm** o **bun** instalado.
- *(Opcional)* Clave de API de Google Gemini (para las funciones agénticas generativas avanzadas). Si no cuentas con una, la app cuenta con un parser heurístico local automático.

### Pasos de Instalación

1. **Clonar el repositorio**:

2. **Instalar dependencias**:
   ```bash
   bun install
   ```

3. **Configurar las variables de entorno**:
   Copia el archivo de ejemplo `.env.example` a un nuevo archivo `.env`:
   ```bash
   cp .env.example .env
   ```
   Edita `.env` y coloca tu clave de Google Gemini:
   ```env
   GEMINI_API_KEY="AIzaSy..."
   PORT=3000
   ```

4. **Iniciar en modo desarrollo**:
   El proyecto utiliza un servidor full-stack Express + Vite que gestiona tanto los endpoints de la API como la aplicación de React:
   ```bash
   bun run dev
   bun vite --port=4000
   ```

5. **Abrir en el navegador**:
   Visita en tu navegador web:
   ```
   http://localhost:3000
   ```

### Scripts Disponibles
- `npm run dev`: Inicia el servidor de desarrollo en `http://localhost:3000` con `server.ts`.
- `npm run build`: Compila los assets de producción de Vite en la carpeta `dist/`.
- `npm run lint`: Ejecuta el verificador de tipos de TypeScript (`tsc --noEmit`).
- `npm run start`: Inicia el servidor de producción con `tsx server.ts`.

---

## Cómo Realizar el Deploy en GitHub

Existen dos formas principales de desplegar este proyecto en GitHub dependiendo de la arquitectura deseada:

---

### Opción A: Despliegue Full-Stack en la Nube con Repositorio en GitHub (Recomendada para la IA)

Dado que la aplicación incluye un backend en Express (`server.ts`) para proteger la clave `GEMINI_API_KEY` y procesar el Function Calling de Gemini de forma segura, el método recomendado es conectar tu repositorio de GitHub a un servicio de hosting de Node.js (por ejemplo **Render**, **Railway**, **Vercel** o **Google Cloud Run**).

#### Despliegue en Render / Railway con GitHub:

1. **Sube tu código a GitHub**:
   ```bash
   git add .
   git commit -m "feat: micros santa cruz con copiloto agéntico"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

2. **Conectar el repositorio**:
   - En [Render.com](https://render.com) o [Railway.app](https://railway.app), crea un nuevo **Web Service**.
   - Conecta tu cuenta de GitHub y selecciona el repositorio de este proyecto.

3. **Configurar los comandos del servicio**:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start` (o `node --import tsx server.ts`)

4. **Variables de Entorno**:
   - En la sección **Environment Variables** del panel, agrega:
     - `GEMINI_API_KEY`: Tu clave de API de Google AI Studio / Gemini.
     - `NODE_ENV`: `production`


---

## Estructura del Proyecto

```text
├── public/
│   ├── data/
│   │   ├── rutas_micro_scz.geojson   # Dataset GeoJSON con todas las líneas de micro
│   │   ├── lugares_scz.json          # Puntos de interés (POIs) de Santa Cruz
│   │   └── categoria_lugares.json    # Categorías de lugares urbanos
│   └── maplibre-gl-worker.mjs        # Worker local de MapLibre GL
├── src/
│   ├── components/
│   │   ├── CopilotTab.tsx            # Interfaz de chat, voz y acciones de IA
│   │   ├── GeofenceAlarmModal.tsx    # Modal de alerta visual/sonora de bajada
│   │   ├── LinesTab.tsx              # Lista y buscador de líneas
│   │   ├── MapComponent.tsx          # Renderizado MapLibre GL y capas
│   │   ├── NearTab.tsx               # Consulta de micros cercanos a un punto
│   │   ├── PlacesTab.tsx             # Explorador de POIs y categorías
│   │   └── RouteTab.tsx              # Calculador de rutas A→B y transbordos
│   ├── services/
│   │   ├── agentService.ts           # Cliente para backend de IA y Web Speech
│   │   ├── audioService.ts           # Sintetizador de alarmas (Web Audio API)
│   │   └── routeService.ts           # Algoritmos de cálculo de ruta y transbordos
│   ├── types.ts                      # Definiciones TypeScript de datos y rutas
│   ├── App.tsx                       # Componente principal y gestión de estado
│   └── main.tsx                      # Punto de entrada de React
├── server.ts                         # Servidor Express + Vite y endpoints de Gemini
├── vite.config.ts                    # Configuración de Vite y plugins
└── package.json                      # Scripts y dependencias del proyecto
```

---

## Licencia

Este proyecto está disponible bajo la licencia Apache-2.0. Desarrollado para la comunidad de pasajeros y el transporte público de Santa Cruz de la Sierra.
