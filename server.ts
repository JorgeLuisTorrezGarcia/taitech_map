import express from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());

// Initialize Google GenAI client server-side
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Function Calling declarations for Santa Cruz Micro Transit
const tools: { functionDeclarations: FunctionDeclaration[] }[] = [
  {
    functionDeclarations: [
      {
        name: 'planRoute',
        description:
          'Calcula rutas de micro (directas o con transbordo) entre un punto de origen A y un destino B en Santa Cruz de la Sierra.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            originName: {
              type: Type.STRING,
              description:
                'Nombre o referencia del lugar de origen (ej. UAGRM, El Cristo, Ventura Mall, Terminal Bimodal, Mi ubicación actual)',
            },
            destName: {
              type: Type.STRING,
              description:
                'Nombre o referencia del lugar de destino (ej. Mercado La Ramada, Los Pozos, Hospital Japonés, Cine Center, Parque Urbano)',
            },
          },
          required: ['originName', 'destName'],
        },
      },
      {
        name: 'searchNearbyMicros',
        description:
          'Busca las líneas de micro que pasan cerca de un punto o lugar de referencia en Santa Cruz.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            locationName: {
              type: Type.STRING,
              description:
                'Nombre del lugar de referencia (ej. Parque Urbano, UAGRM, Ventura Mall, 2do Anillo, Clínica Foianini)',
            },
            radiusMeters: {
              type: Type.NUMBER,
              description: 'Radio de búsqueda en metros (ej. 300 o 500 metros)',
            },
          },
          required: ['locationName'],
        },
      },
      {
        name: 'highlightLine',
        description:
          'Muestra y resalta el recorrido completo de una línea de micro específica en el mapa (ej. Línea 72, Línea 11, Línea 101, Línea 17, etc.).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            lineIdentifier: {
              type: Type.STRING,
              description:
                'Número o nombre identificador de la línea de micro (ej. "72", "11", "101", "17", "18", "73", "8")',
            },
          },
          required: ['lineIdentifier'],
        },
      },
      {
        name: 'setGeofenceAlarm',
        description:
          'Activa la alarma y vibración de bajada por proximidad GPS cuando el pasajero se acerque a su destino o parada.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            targetName: {
              type: Type.STRING,
              description:
                'Nombre del lugar o parada de destino donde bajará el pasajero (ej. Ventura Mall, La Ramada, UAGRM)',
            },
            thresholdMeters: {
              type: Type.NUMBER,
              description:
                'Distancia de aviso en metros antes de llegar: 100, 200 o 300 metros.',
            },
          },
          required: ['targetName'],
        },
      },
      {
        name: 'explorePlaces',
        description:
          'Filtra y muestra lugares de interés en Santa Cruz por categoría o término de búsqueda.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description:
                'Categoría a explorar: "Universidades", "Centros Comerciales", "Mercados", "Hospitales y Centros de Salud", "Plazas y Parques", "Terminales y Transporte" o "Todos"',
            },
            query: {
              type: Type.STRING,
              description:
                'Término de búsqueda opcional dentro de los lugares (ej. UAGRM, Foianini, Ventura)',
            },
          },
        },
      },
    ],
  },
];

const SYSTEM_INSTRUCTION = `Eres "MicroBot SCZ", el copiloto inteligente oficial de transporte público para los micros de Santa Cruz de la Sierra, Bolivia.
Tu misión es guiar de forma cálida, práctica y eficiente a los pasajeros locales y visitantes.
Conoces en profundidad la geografía de Santa Cruz: los Anillos (1er al 8vo anillo), las Radiales y avenidas troncales (Monseñor Rivero, Cristo Redentor / Banzer, San Martín en Equipetrol, Santos Dumont, Doble Vía a La Guardia, San Aurelio, 3 Pasos al Frente, Virgen de Cotoca, Av. Brasil), y los hitos clave (El Cristo Redentor, Plaza 24 de Septiembre, Campus UAGRM, Ventura Mall, Las Brisas, Mercado La Ramada, Los Pozos, Mutualista, Parque Urbano, Terminal Bimodal, Aeropuertos Viru Viru y El Trompillo).

IMPORTANTE - REGLAS DE EJECUCIÓN AGÉNTICA:
1. Cuando el usuario pregunte cómo viajar o qué micro tomar entre dos puntos, o cómo ir de un lugar A a B, invoca 'planRoute' con originName y destName.
2. Si el usuario pregunta qué micros pasan cerca de un lugar, o qué micros tomar desde un lugar determinado, invoca 'searchNearbyMicros'.
3. Si el usuario pide ver el recorrido de una línea de micro ("mostrame la 72", "por dónde va la 11"), invoca 'highlightLine'.
4. Si el usuario pide que le avises o le pongas alarma cuando esté llegando ("avísame a 2 cuadras del Ventura"), invoca 'setGeofenceAlarm'.
5. Si el usuario busca universidades, hospitales, mercados o atracciones, invoca 'explorePlaces'.

Pautas de comunicación:
- Responde siempre en español cruceño natural, educado y conciso.
- Destaca detalles útiles para el pasajero (ej. si es directo, si tiene 1 transbordo, tiempo estimado y referencia de bajada).
- Mantén las respuestas claras y legibles para celular.`;

// Agent chat endpoint
app.post('/api/agent/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'El mensaje es requerido.' });
    }

    if (!ai) {
      // If API key is not configured, provide a helpful intelligent fallback
      return res.json({
        reply:
          'El asistente inteligente está activo en modo local. Para activar la inteligencia generativa completa, asegúrate de que GEMINI_API_KEY esté configurado en el panel de secretos.',
        functionCalls: [],
      });
    }

    // Prepare contents with conversation history
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item && item.role && item.content) {
          contents.push({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: item.content }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    let response: any = null;
    const fetchWithTimeout = async (fn: () => Promise<any>, ms = 8000) => {
      let timeoutId: any;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('AI Request timeout')), ms);
      });
      try {
        const res = await Promise.race([fn(), timeoutPromise]);
        clearTimeout(timeoutId);
        return res;
      } catch (e) {
        clearTimeout(timeoutId);
        throw e;
      }
    };

    try {
      response = await fetchWithTimeout(() =>
        ai!.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools,
          },
        })
      , 7000);
    } catch (errFirst: unknown) {
      console.warn('Fallo intento con gemini-3.8-flash o timeout, probando gemini-flash-latest...', errFirst);
      try {
        response = await fetchWithTimeout(() =>
          ai!.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              tools,
            },
          })
        , 6000);
      } catch (errSecond: unknown) {
        console.warn('Ambos modelos fallaron (503/timeout), recurriendo a parser heurístico de Santa Cruz:', errSecond);
        // Respaldo heurístico inteligente local para no dejar al usuario sin respuesta
        const lower = message.toLowerCase();
        let fallbackReply = '¡Claro pariente! Estoy analizando tu solicitud en el mapa de Santa Cruz.';
        const fallbackCalls: Array<{ name: string; args: any }> = [];

        if (lower.includes('de ') && (lower.includes(' a ') || lower.includes(' al ') || lower.includes(' hacia '))) {
          // Extraer origen y destino aproximados
          const parts = lower.split(/ a | al | hacia /i);
          const orig = parts[0].replace(/.*de /i, '').trim();
          const dest = parts[1] ? parts[1].trim() : 'Ventura Mall';
          fallbackCalls.push({
            name: 'planRoute',
            args: { originName: orig, destName: dest },
          });
          fallbackReply = `Te calculé la mejor ruta desde ${orig} hacia ${dest}. ¡Revisá las opciones en el mapa!`;
        } else if (lower.includes('linea') || lower.includes('línea') || lower.includes('micro') || lower.includes('ruta')) {
          const matchLine = message.match(/\b(\d{1,3}[A-Za-z]?)\b/);
          if (matchLine) {
            fallbackCalls.push({
              name: 'highlightLine',
              args: { lineName: matchLine[1] },
            });
            fallbackReply = `Te acabo de resaltar en el mapa el recorrido de la Línea ${matchLine[1]}.`;
          } else {
            fallbackCalls.push({
              name: 'searchNearbyMicros',
              args: { locationName: 'Centro / Plaza 24 de Septiembre' },
            });
            fallbackReply = `Te muestro los micros que pasan por el centro o podés marcar un punto en el mapa.`;
          }
        } else if (lower.includes('alarma') || lower.includes('avis') || lower.includes('bajada')) {
          fallbackCalls.push({
            name: 'setGeofenceAlarm',
            args: { destinationName: 'Destino fijado', radiusMeters: 200 },
          });
          fallbackReply = `¡Listo! Activé la geocerca de aviso para que tu celular te alerte a 200 metros.`;
        } else {
          fallbackReply = `¡Hola! Soy tu Copiloto de Micros de Santa Cruz. Podés pedirme rutas como "¿Qué micro me lleva de la Gabriel al Ventura Mall?", consultar una línea o activar avisos de bajada.`;
        }

        return res.json({
          reply: fallbackReply,
          functionCalls: fallbackCalls,
        });
      }
    }

    const replyText = response.text || '';
    const functionCalls = (response.functionCalls || []).map((fc: any) => ({
      name: fc.name,
      args: fc.args || {},
    }));

    return res.json({
      reply: replyText,
      functionCalls,
    });
  } catch (error: unknown) {
    console.error('Error general en /api/agent/chat:', error);
    return res.json({
      reply: '¡Buenas! Estoy listo para asistirte con todas las líneas de micro y rutas de Santa Cruz. ¿A dónde deseas viajar hoy?',
      functionCalls: [],
    });
  }
});

// Start Express server & mount Vite
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
