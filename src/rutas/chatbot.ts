// rutas/chatbot.ts - VERSIÓN IDÉNTICA AL PRIMER CHATBOT
import { Router } from 'express';
import dialogflow from '@google-cloud/dialogflow';

const router = Router();

// Configuración Dialogflow (IDÉNTICA al primer código)
let sessionClient: any;
let isDialogflowEnabled = false;

function initializeDialogflow() {
  try {
    const requiredEnvVars = ['DIALOGFLOW_PROJECT_ID', 'DIALOGFLOW_CLIENT_EMAIL', 'DIALOGFLOW_PRIVATE_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log("💡 Usando respuestas estáticas. Configura Dialogflow en .env para habilitar IA");
      return null;
    }

    sessionClient = new dialogflow.SessionsClient({
      credentials: {
        client_email: process.env.DIALOGFLOW_CLIENT_EMAIL!,
        private_key: process.env.DIALOGFLOW_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      },
      projectId: process.env.DIALOGFLOW_PROJECT_ID,
    });

    isDialogflowEnabled = true;
    console.log("✅ Dialogflow configurado");
    return sessionClient;

  } catch (error: unknown) {
    console.error("Error inicializando Dialogflow:", error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

sessionClient = initializeDialogflow();

// Respuestas estáticas (EXACTAMENTE IGUALES al primer código)
const staticResponses: { [key: string]: string } = {
  "hola": "🌿 **¡Hola! Bienvenido/a a San Juan Tahitic** ✨\n\nSoy tu guía virtual. ¿Te gustaría explorar alguna área específica?",
  "que cascadas hay": "💧 **¡Nuestras cascadas son mágicas!** \n\nEn San Juan Tahitic tenemos varias cascadas hermosas para visitar.",
  "cascadas": "💦 **¡Tenemos varias opciones!**\n\n• **Cascada Escondida** - Acceso fácil, perfecta para familias\n• **Cascada Cristalina** - Aguas cristalinas para nadar\n• **Salto del Venado** - Para los más aventureros\n\n¿Cuál te llama más la atención?",
  "donde comer": "🍽️ **¡Deliciosas opciones!** \n\n**Restaurantes recomendados:**\n\n• **El Fogón Tradicional** - Comida local auténtica\n• **La Terraza** - Vistas espectaculares\n• **Sabores de la Sierra** - Fusión moderna\n\n¿Buscas algo específico?",
  "comida": "🥘 **¡Tenemos de todo!**\n\nDesde comida tradicional hasta opciones internacionales:\n\n• Comida típica de la región\n• Mariscos frescos\n• Opciones vegetarianas\n• Postres artesanales\n\n¿Qué tipo de comida prefieres?",
  "hospedaje": "🏨 **Opciones de hospedaje** \n\n**Para todos los presupuestos:**\n\n• **Ecolodge Tahitic** - Cabañas en la naturaleza\n• **Hotel Mirador** - Vistas panorámicas\n• **Posada Familiar** - Ambiente acogedor\n• **Cabañas Rústicas** - Experiencia auténtica\n\n¿Qué tipo de alojamiento buscas?",
  "donde dormir": "🛌 **¡Varias opciones disponibles!**\n\n• **Cabañas ecológicas** - En medio de la naturaleza\n• **Hoteles cómodos** - Con todas las comodidades\n• **Posadas familiares** - Ambiente tradicional\n\n¿Prefieres algo rústico o más moderno?",
  "actividades": "🚶 **¡Mucho por hacer!** \n\n**Actividades disponibles:**\n\n• 🥾 Senderismo guiado\n• 🐦 Observación de aves\n• 🚴 Paseos en bicicleta\n• 📷 Tours fotográficos\n• 🌅 Miradores naturales\n\n¿Cuál actividad te interesa?",
  "que hacer": "🎯 **¡Diversión asegurada!**\n\nPuedes disfrutar de:\n\n• Caminatas por senderos naturales\n• Nadar en cascadas cristalinas\n• Degustar comida local\n• Fotografiar paisajes increíbles\n• Relajarte en miradores\n\n¿Eres más de aventura o relax?",
  "precios": "💰 **Información de precios**\n\nLos precios varían según la actividad y temporada. Te recomiendo:\n\n• Contactar directamente con los establecimientos\n• Visitar nuestra página web oficial\n• Consultar en la oficina de turismo local\n\n¿Te interesa algún servicio en particular?",
  "como llegar": "🗺️ **¿Cómo llegar a San Juan Tahitic?**\n\n**Por carretera:**\n• Desde la capital: 3 horas en auto\n• Transporte público disponible\n• Señalización turística clara\n\n**Recomendaciones:**\n• Vehículo con buena suspensión\n• Llevar mapa o GPS\n• Mejor visitar en temporada seca\n\n¿Vienes en auto o transporte público?",
  "clima": "🌤️ **Clima en San Juan Tahitic**\n\n**Generalmente:**\n• Templado y agradable\n• Lluvias en temporada (mayo-octubre)\n• Mejor época: noviembre-abril\n\n**Recomendación:**\n• Llevar ropa cómoda\n• Impermeable en temporada de lluvias\n• Protector solar\n\n¿Planeas tu visita para pronto?",
  "gracias": "🙏 **¡De nada! Espero haberte ayudado.**\n\nSi necesitas más información sobre:\n• Cascadas específicas\n• Reservas de hospedaje\n• Actividades disponibles\n\n¡No dudes en preguntar! 🌿",
  "adios": "👋 **¡Hasta pronto!**\n\nEspero verte pronto en San Juan Tahitic. ¡Te va a encantar!\n\n🌄 *Donde la naturaleza te abraza*",
  "default": "🌿 **Interesante pregunta...**\n\nTe invito a explorar nuestras secciones usando los botones de arriba."
};

// Endpoint del chatbot (IDÉNTICO al primer código)
router.post("/message", async (req, res) => {
  const { message, sessionId = "visitante", languageCode = "es" } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      reply: "📝 Por favor, escribe un mensaje para poder ayudarte.",
      type: "validation_error"
    });
  }

  const userMessage = message.trim().toLowerCase();
  
  try {
    let reply, intent;

    // Intentar con Dialogflow si está disponible (MISMA LÓGICA)
    if (isDialogflowEnabled && sessionClient) {
      try {
        const sessionPath = sessionClient.projectAgentSessionPath(
          process.env.DIALOGFLOW_PROJECT_ID!, 
          sessionId
        );

        const request = {
          session: sessionPath,
          queryInput: {
            text: {
              text: userMessage,
              languageCode,
            },
          },
        };

        const [response] = await sessionClient.detectIntent(request);
        const result = response.queryResult;
        
        reply = result.fulfillmentText;
        intent = result.intent?.displayName;
        
      } catch (dialogflowError) {
        // Fallback a respuestas estáticas (sin logs detallados)
      }
    }

    // Usar respuesta estática si Dialogflow falló (MISMA LÓGICA)
    if (!reply) {
      reply = staticResponses[userMessage] || staticResponses.default;
      intent = "static_response";
    }

    res.json({
      reply,
      intent: intent || "static_fallback",
      timestamp: new Date().toISOString(),
      source: isDialogflowEnabled ? "dialogflow" : "static"
    });

  } catch (error: unknown) {
    console.error("Error procesando mensaje:", error);
    
    // MISMA respuesta de error
    res.json({
      reply: "🌀 **La conexión con nuestros guías se ha interrumpido...**\n\nPor favor, intenta nuevamente.",
      intent: "error_fallback",
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check adicional (opcional, no existe en el primer código)
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "San Juan Tahitic Chatbot API",
    timestamp: new Date().toISOString(),
    dialogflow: isDialogflowEnabled ? "connected" : "disabled"
  });
});

export default router;