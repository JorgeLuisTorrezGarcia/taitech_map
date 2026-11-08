# Plan de Implementación: Copiloto Agéntico para Micros Santa Cruz (Gemini Flash + Function Calling)

Plan integral para dotar a la aplicación de un **Agente Copiloto Inteligente de Movilidad Urbana** especializado en Santa Cruz de la Sierra, capaz de interpretar lenguaje natural, ejecutar herramientas (Function Calling) sobre el motor geoespacial del mapa, responder por voz y texto, y automatizar acciones como trazar rutas, resaltar micros y configurar alarmas de bajada.

---

## Decisiones Críticas y Preferencias Confirmadas

> [!IMPORTANT]
> Decisiones confirmadas en la fase de clarificación interactiva:
> - **Capacidad Principal**: Copiloto interactivo con chat, síntesis/reconocimiento de voz y Function Calling.
> - **Stack y Modelo**: SDK oficial `@google/genai` con modelo `gemini-3.8-flash` en backend Express seguro.
> - **Integración UI**: Panel dedicado de Copiloto integrado con visualización sincronizada de acciones sobre el mapa MapLibre GL.

- **Confirmado**: El agente tiene acceso a herramientas ejecutables (Function Calling) conectadas al índice espacial RBush y al planificador de viajes A→B existente.
- **Confirmado**: Modo dual texto y voz (Web Speech API para dictado por voz y lectura de respuestas), ideal para pasajeros en movimiento o dentro del micro.
- **Predeterminado recomendado**: Streaming de respuestas con tarjetas de acción interactivas ("Ruta calculada", "Alarma fijada", "Micro resaltado") para que el usuario siempre vea lo que el agente hace en el mapa.

---

## 1. Visión General y Concepto del Agente

### ¿Qué hace el Copiloto Agéntico?
Es un asistente de tránsito en tiempo real entrenado en la jerga urbana cruceña (*"el Cristo"*, *"la Gabriel"*, *"la Ramada"*, *"los Pozos"*, *"el 2do anillo"*, *"la Bimodal"*). El usuario puede escribirle o hablarle de forma conversacional:
- *"Llevame de la Gabriel al Ventura Mall"*
- *"¿Qué micro pasa cerca de la Clínica Foianini y va hacia la Villa 1ro de Mayo?"*
- *"Voy en el 72, avísame cuando esté a 2 cuadras del Parque Urbano"*
- *"Mostrame en el mapa por dónde va la línea 17"*

El agente no solo responde con texto explicativo, sino que **acciona el mapa directamente**: fija los puntos A y B, calcula el itinerario óptimo, resalta la ruta en MapLibre GL y activa la geocerca de bajada sin que el usuario tenga que buscar manualmente entre cientos de opciones.

### Valor para el Usuario
- **Cero fricción**: En lugar de buscar manualmente entre 144 lugares y decenas de líneas, una sola frase resuelve el trayecto.
- **Accesibilidad nocturna y en marcha**: Manejo manos libres por voz para personas que viajan de noche, van cargadas o no conocen la ciudad.
- **Decisiones explicadas**: El agente no solo da la ruta, sino que explica por qué conviene (ej. *"El micro 72 te deja a 1 cuadra sin transbordos"*).

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujos Clave de Interacción
1. **Entrada Conversacional (Texto o Voz)**:
   - El usuario abre el panel **Copiloto** (o toca el botón de micrófono).
   - Puede dictar o escribir su destino en lenguaje natural.
   - Píldoras de sugerencias rápidas contextuales (*"Ir al Ventura Mall"*, *"Micros por el 2do Anillo"*, *"Alarma para mi destino"*).
2. **Razonamiento Agéntico y Ejecución de Herramientas**:
   - El agente analiza la intención y activa la herramienta correspondiente (`planRoute`, `searchNearbyMicros`, `highlightLine`, `setGeofenceAlarm`, `explorePlaces`).
   - Muestra un estado visual sutil de *"Buscando rutas de micro..."* o *"Calculando transbordos..."*.
3. **Respuesta Multimodal y Tarjeta de Acción**:
   - Respuesta concisa en lenguaje cruceño amable con resumen del viaje (duración, caminata, micros a tomar).
   - **Tarjeta de Acción Integrada**: Permite ejecutar con 1 toque en el mapa (*"Ver en el mapa"*, *"Activar Alarma de Bajada (200 m)"*, *"Ajustar zoom"*).
   - Lectura de voz opcional (TTS) para no tener que mirar la pantalla dentro del micro.

### Identidad Visual y Estilo (Constitución Frontend Design)
- **Paleta de Color**:
  - Fondo: Slate oscuro neutro (`#0B0F19` / `#111827`) coherente con la temática actual de la app.
  - Acento Agéntico: Índigo / Esmeralda (`#6366F1` / `#10B981`) para identificar visualmente al copiloto sin saturar.
  - Superficies: Tarjetas de mensaje con bordes de 1px (`border-slate-800`), sin sombras pesadas ni cards anidadas.
- **Tipografía**:
  - Títulos y navegación: `Plus Jakarta Sans` / `Outfit`.
  - Métricas de viaje y líneas de micro: `tabular-nums` con monoespaciado para tiempos y distancias (`~18 min`, `340 m`).
- **Disciplina Anti-Slop**:
  - Cero métricas ficticias ni puntajes inventados ("AI Score: 98%").
  - Cero comentarios de código decorativos en títulos (`// COPILOT_V1`).
  - Textos de estado reales ("Buscando líneas en el mapa", "Ruta trazada").

---

## 3. Decisiones de Producto y Trade-Offs

| Decisión | Opción Seleccionada | Justificación / Rationale | Alternativa Descartada |
| :--- | :--- | :--- | :--- |
| **Arquitectura de API** | Backend Express proxy (`/api/agent/chat`) con `@google/genai` | Seguridad de API Key en backend (`process.env.GEMINI_API_KEY`), compatibilidad con Node.js y políticas de AI Studio. | SDK en cliente directo (inseguro, expone credenciales y saturaría el bundle). |
| **Modelo de IA** | `gemini-3.8-flash` | Latencia ultrarrápida (<1s), excelente soporte nativo de Function Calling y bajo costo. | `gemini-4-argon` (innecesario para consultas de tránsito rápido; mayor latencia). |
| **Interacción de Voz** | Web Speech API nativa del navegador | Cero latencia adicional de streaming de audio externo, funciona de inmediato en smartphones Android/iOS sin paquetes pesados. | Gemini Live API WebSocket (más complejo de sincronizar con el dev server y mayor consumo de datos móviles). |
| **Manejo de Herramientas** | Tool Calling Server-Side con despacho de acciones al cliente | El backend define el esquema y el cliente recibe las llamadas estructuradas para ejecutarlas en su Web Worker y MapLibre GL. | Enviar todo el GeoJSON de 26MB a Gemini (inviable por límite de tokens y costo de contexto). |

---

## 4. Arquitectura Técnica y Estrategia de Datos

### Diagrama del Sistema Agéntico

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (REACT SPA)                           │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │    Panel Copiloto     │             │    Mapa (MapLibre GL)      │  │
│  │   (Chat + Micrófono)  │             │   - Resaltar líneas        │  │
│  │   - Web Speech API    │             │   - Trazar ruta A → B      │  │
│  └───────────┬───────────┘             │   - Marcadores A/B/P       │  │
│              │                         └─────────────▲──────────────┘  │
│              │ HTTP POST /api/agent/chat             │                 │
│              ▼                                       │ Acciones        │
│  ┌───────────────────────────────────────────────────┴──────────────┐  │
│  │               Dispatcher de Herramientas en Cliente               │  │
│  │  - planRoute()         → workerService.findRoutes()              │  │
│  │  - searchNearby()      → workerService.findNearby()              │  │
│  │  - highlightLine()     → setVisibleRouteIds() + flyTo()          │  │
│  │  - setGeofenceAlarm()  → handleActivateGeofence()                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────▲─────────────────────────────────────┘
                                   │
                                   │ JSON (Mensajes + FunctionCalls)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVIDOR (EXPRESS + TSX)                        │
│                                                                        │
│  POST /api/agent/chat                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Google GenAI SDK (gemini-3.8-flash)                              │  │
│  │ - System Instruction: Experto en tránsito y micros de Santa Cruz │  │
│  │ - Tools:                                                         │  │
│  │   • planRoute(origen, destino)                                   │  │
│  │   • searchNearbyMicros(lugar, radioMetros)                       │  │
│  │   • highlightLine(linea)                                         │  │
│  │   • setGeofenceAlarm(destino, radioMetros)                       │  │
│  │   • explorePlaces(categoria, consulta)                           │  │
│  │ - Contexto: Lista de POIs conocidos de Santa Cruz                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Herramientas Agénticas (Function Declarations)
1. **`planRoute`**:
   - Parámetros: `originName` (string), `destName` (string), `originCoords` (opcional [lon, lat]), `destCoords` (opcional [lon, lat]).
   - Acción: Resuelve nombres de lugares usando los POIs cargados (`lugares_scz.json`), fija A y B y dispara el cálculo de rutas directas o con 1 transbordo.
2. **`searchNearbyMicros`**:
   - Parámetros: `locationName` (string), `radiusMeters` (número, ej. 300 o 500).
   - Acción: Fija el punto de consulta P y activa la búsqueda en el índice espacial RBush.
3. **`highlightLine`**:
   - Parámetros: `lineIdentifier` (string, ej. "72", "11", "101", "17").
   - Acción: Busca la línea en el dataset, la hace visible en el mapa y enfoca la vista (`fitBounds`).
4. **`setGeofenceAlarm`**:
   - Parámetros: `targetName` (string), `thresholdMeters` (100, 200 o 300).
   - Acción: Activa de inmediato la alarma de bajada con el audio y vibración configurados.
5. **`explorePlaces`**:
   - Parámetros: `category` ("Universidades", "Hospitales", "Mercados", etc.) o `query` (string).
   - Acción: Filtra la pestaña de lugares y destaca los resultados en el mapa.

---

## 5. Fases de Implementación Propuestas

1. **Fase 1: Endpoint de Backend y SDK Gemini**:
   - Crear `server.ts` con Express montando `vite.middlewares` en desarrollo (`npm run dev` vía `tsx server.ts`).
   - Implementar `/api/agent/chat` utilizando `@google/genai` con `gemini-3.8-flash` y las declaraciones de herramientas.
   - Proteger la API Key con `process.env.GEMINI_API_KEY` y encabezado `User-Agent: 'aistudio-build'`.
2. **Fase 2: Cliente y Dispatcher de Acciones**:
   - Crear `src/services/agentService.ts` para comunicarse con `/api/agent/chat`.
   - Implementar el ejecutor de herramientas en el cliente que conecta las respuestas del agente con el estado de `App.tsx` (Rutas, Líneas, Alarma de bajada, Lugares).
3. **Fase 3: Componente de UI del Copiloto**:
   - Crear `src/components/CopilotTab.tsx` con historial de conversación, sugerencias de inicio rápido y tarjetas de acción directa.
   - Añadir botón de dictado por voz (Speech-to-Text) y botón de audio para reproducir la respuesta (TTS).
   - Integrar la pestaña en la navegación de escritorio y en el cajón móvil.
4. **Fase 4: Verificación y Pruebas**:
   - Pruebas de preguntas complejas en lenguaje natural (*"Cómo voy de la UAGRM al Ventura"*, *"Avisame cuando llegue al 3er anillo"*).
   - Verificación de compilación (`compile_applet`) y tipado estricto (`lint_applet`).
