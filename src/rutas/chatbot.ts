// rutas/chatbot.ts - VERSIÓN MEJORADA CON RESPUESTAS ESTÁTICAS
import { Router } from 'express';
import dialogflow from '@google-cloud/dialogflow';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Configuración Dialogflow
let sessionClient: any;
let isDialogflowEnabled = false;

function initializeDialogflow() {
  try {
    console.log('🔧 Inicializando Dialogflow...');
    
    const requiredEnvVars = ['DIALOGFLOW_PROJECT_ID', 'DIALOGFLOW_CLIENT_EMAIL', 'DIALOGFLOW_PRIVATE_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log("💡 Usando respuestas estáticas. Faltan variables en .env:", missingVars);
      return null;
    }

    console.log('🔑 Configurando SessionsClient con variables de entorno...');
    
    // ✅ USAR EL MISMO MÉTODO QUE EL SERVIDOR FUNCIONAL
    sessionClient = new dialogflow.SessionsClient({
      credentials: {
        client_email: process.env.DIALOGFLOW_CLIENT_EMAIL!,
        private_key: process.env.DIALOGFLOW_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      },
      projectId: process.env.DIALOGFLOW_PROJECT_ID,
    });

    isDialogflowEnabled = true;
    console.log("✅ Dialogflow configurado desde variables de entorno");
    return sessionClient;

  } catch (error: unknown) {
    console.error("❌ Error inicializando Dialogflow:");
    if (error instanceof Error) {
      console.error("🔍 Detalles:", error.message);
    }
    return null;
  }
}

sessionClient = initializeDialogflow();

// Respuestas estáticas mejoradas
const staticResponses: { [key: string]: string } = {
  "hola": "🌿 **¡Hola! Bienvenido/a a San Juan Tahitic** ✨\n\nSoy tu guía virtual. ¿Te gustaría explorar alguna área específica? Puedo ayudarte con:\n\n• 🏞️ Cascadas y naturaleza\n• 🍽️ Restaurantes y comida\n• 🏨 Hospedaje\n• 🚶 Actividades y tours\n\n¿Qué te interesa conocer?",
  "que cascadas hay": "💧 **¡Nuestras cascadas son mágicas!** \n\nEn San Juan Tahitic tenemos:\n\n• **Cascada Escondida** - Perfecta para fotos\n• **Cascada Cristalina** - Aguas transparentes\n• **Salto del Venado** - Ideal para aventureros\n\n¿Te gustaría saber más sobre alguna en particular?",
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
  "default": "🌿 **¡Interesante pregunta!**\n\nComo guía virtual de San Juan Tahitic, puedo ayudarte con:\n\n• 🏞️ **Cascadas y naturaleza**\n• 🍽️ **Comida y restaurantes**  \n• 🏨 **Hospedaje y cabañas**\n• 🚶 **Actividades y tours**\n• 🗺️ **Cómo llegar y clima**\n\n¿Sobre qué tema te gustaría saber más?"
};

// Endpoint del chatbot
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
    let usedDialogflow = false;

    // Intentar con Dialogflow si está disponible
    if (isDialogflowEnabled && sessionClient) {
      try {
        console.log(`🤖 Intentando Dialogflow: "${userMessage}"`);
        
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
        
        // Solo usar Dialogflow si devuelve una respuesta útil
        if (result.fulfillmentText && result.fulfillmentText.length > 10) {
          console.log('✅ Dialogflow funcionó!');
          reply = result.fulfillmentText;
          intent = result.intent?.displayName;
          usedDialogflow = true;
        } else {
          console.log('💡 Dialogflow no devolvió respuesta útil, usando estática');
        }
        
      } catch (dialogflowError: unknown) {
        console.log("❌ Dialogflow falló, usando respuestas estáticas");
        // No mostrar el error completo para no saturar logs
      }
    }

    // Usar respuesta estática si Dialogflow falló o no está disponible
    if (!reply) {
      reply = staticResponses[userMessage] || staticResponses.default;
      intent = "static_response";
    }

    res.json({
      reply,
      intent: intent || "static_fallback",
      timestamp: new Date().toISOString(),
      source: usedDialogflow ? "dialogflow" : "static"
    });

  } catch (error: unknown) {
    console.error("💥 Error procesando mensaje:");
    
    // Respuesta de error amigable
    res.json({
      reply: "🌀 **Parece que hay un problema temporal con nuestro sistema...**\n\nPero puedo ayudarte con información sobre:\n\n• 🏞️ Cascadas y naturaleza\n• 🍽️ Restaurantes\n• 🏨 Hospedaje\n• 🚶 Actividades\n\n¿Qué te gustaría saber?",
      intent: "error_fallback",
      timestamp: new Date().toISOString(),
      source: "static"
    });
  }
});

// Endpoint para verificar estado del chatbot
router.get("/chatbot/debug", (req, res) => {
  const credentialsPath = join(__dirname, '../../dialogflow-key.json');
  const fileExists = existsSync(credentialsPath);
  
  let fileInfo: any = { exists: fileExists, path: credentialsPath };
  
  if (fileExists) {
    try {
      const fileContent = readFileSync(credentialsPath, 'utf8');
      const credentials = JSON.parse(fileContent);
      
      fileInfo = {
        ...fileInfo,
        project_id: credentials.project_id,
        client_email: credentials.client_email,
        private_key_id: credentials.private_key_id?.substring(0, 10) + '...',
        private_key_length: credentials.private_key?.length,
        private_key_valid: credentials.private_key?.includes('BEGIN PRIVATE KEY')
      };
      
    } catch (parseError: unknown) {
      fileInfo.parse_error = parseError instanceof Error ? parseError.message : 'Unknown error';
    }
  }
  
  res.json({
    dialogflow_configured: isDialogflowEnabled,
    project_id: process.env.DIALOGFLOW_PROJECT_ID,
    credentials_file: fileInfo,
    static_responses_available: Object.keys(staticResponses).length,
    status: isDialogflowEnabled ? 'configured' : 'static_only'
  });
});

export default router;