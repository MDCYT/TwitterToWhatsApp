import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;

import qrcode from "qrcode-terminal";
import { Rettiwt } from "rettiwt-api";
import dotenv from "dotenv";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { translateToSpanish } from "./translator.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getBasePath = () => {
  if (process.platform === "win32") {
    return __dirname.replace(/^\//, "");
  }
  return __dirname;
};

const basePath = getBasePath();
const sessionPath = join(basePath, "whatsapp_session");

const TWITTER_USER_ID = process.env.TWITTER_USER_ID;
const WHATSAPP_CHANNEL_ID = process.env.WHATSAPP_CHANNEL_ID;

let lastTweetId = null;
let rettiwt = null;

async function loadLastTweetId() {
  try {
    const data = await fs.readFile(join(basePath, "last_tweet.json"), "utf-8");
    const parsed = JSON.parse(data);
    lastTweetId = parsed.lastTweetId;
    console.log("Último tweet cargado:", lastTweetId);
  } catch (error) {
    console.log("No hay último tweet guardado, empezando desde cero");
  }
}

async function saveLastTweetId(tweetId) {
  lastTweetId = tweetId;
  await fs.writeFile(
    join(basePath, "last_tweet.json"),
    JSON.stringify({ lastTweetId, timestamp: Date.now() }),
  );
}

async function initTwitter() {
  const apiKey = process.env.RETTIWT_API_KEY;

  if (apiKey) {
    rettiwt = new Rettiwt({ apiKey });
    console.log("Rettiwt-API inicializado con autenticación");
  } else {
    rettiwt = new Rettiwt();
    console.log("Rettiwt-API inicializado (modo guest - limitado)");
    console.log("Para mejor estabilidad, agrega RETTIWT_API_KEY en .env");
  }
}

async function getLatestTweet() {
  try {
    const tweets = await rettiwt.user.timeline(TWITTER_USER_ID, 5);

    if (!tweets.list || tweets.list.length === 0) {
      console.log("No se encontraron tweets");
      return null;
    }

    // Filtrar tweets que tengan fecha de creación válida
    const tweetsWithDate = tweets.list.filter(tweet => tweet.createdAt);
    
    if (tweetsWithDate.length === 0) {
      console.log("No se encontraron tweets con fecha válida");
      return null;
    }

    // Ordenar por fecha de creación (más reciente primero)
    tweetsWithDate.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Obtener el tweet más reciente por fecha (no por posición)
    const latestTweet = tweetsWithDate[0];

    console.log(`Tweet más reciente: ${latestTweet.id} - ${latestTweet.createdAt}`);

    if (lastTweetId && latestTweet.id === lastTweetId) {
      console.log("No hay tweets nuevos");
      return null;
    }

    return latestTweet;
  } catch (error) {
    console.error("Error obteniendo tweets:");
    console.log(error);
    return null;
  }
}

async function formatTweetMessage(tweet) {
  const author =
    tweet.tweetBy?.fullName || tweet.tweetBy?.userName || "Unknown";
  const originalText = tweet.fullText || tweet.text || "";
  const url = `https://twitter.com/${tweet.tweetBy?.userName || "status"}/${tweet.id}`;

  const translatedText = await translateToSpanish(originalText);

  let message = `🐦 *Nuevo Tweet de ${author}*\n\n`;
  
  if (translatedText !== originalText) {
    message += `${translatedText}\n\n`;
    message += `Original (EN): ${originalText}\n\n`;
  } else {
    message += `${translatedText}\n\n`;
  }

  message += `\n🔗 ${url}`;

  return message;
}

async function sendMessageToWhatsApp(client, message, attachments = []) {
  try {
    // Si hay links adjuntos, se podrían enviar como media
    let mediaOptions = [];
    for (const url of attachments) {
      try {
        const media = await MessageMedia.fromUrl(url);
        mediaOptions.push(media);
      } catch (e) {
        console.log("No se pudo cargar media desde URL:", url);
      }
    }

    if (mediaOptions.length > 0) {
      for (const media of mediaOptions) {
        await client.sendMessage(WHATSAPP_CHANNEL_ID, media, {
          caption: message,
        });
      }
    } else {
      await client.sendMessage(WHATSAPP_CHANNEL_ID, message);
    }
    console.log("Mensaje enviado a WhatsApp");
  } catch (error) {
    console.error("Error enviando mensaje:", error.message);
  }
}
function startTwitterPolling(client) {
  console.log("Iniciando monitoreo de tweets...");

  const pollInterval = setInterval(async () => {
    const tweet = await getLatestTweet();

    if (tweet) {
      const message = await formatTweetMessage(tweet);
      await sendMessageToWhatsApp(client, message, tweet?.media?.map((m) => m.url) || []);
      await saveLastTweetId(tweet.id);
    }
  }, 30000);

  console.log(`Monitoreando tweets de @${TWITTER_USER_ID} cada 30 segundos`);
}

async function initWhatsApp() {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionPath,
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  // client.sendMessage(WHATSAPP_CHANNEL_ID, '🤖 Bot de Twitter → WhatsApp iniciado! Esperando nuevos tweets...');

  client.on("qr", (qr) => {
    console.log("\n=== ESCANEA ESTE CÓDIGO QR CON WHATSAPP ===");
    qrcode.generate(qr, { small: true });
    console.log("==========================================\n");
  });

  client.on("ready", async () => {
    console.log("✅ WhatsApp conectado!");

    startTwitterPolling(client);
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ Error de autenticación:", msg);
    console.log("Borra la carpeta whatsapp_session e intenta de nuevo");
  });

  client.on("disconnected", (reason) => {
    console.log("WhatsApp desconectado:", reason);
  });

  await client.initialize();
}

async function main() {
  console.log("🚀 Iniciando bot Twitter → WhatsApp");
  console.log("Usuario Twitter:", TWITTER_USER_ID);
  console.log("Canal WhatsApp:", WHATSAPP_CHANNEL_ID);

  if (!TWITTER_USER_ID || !WHATSAPP_CHANNEL_ID) {
    console.error(
      "❌ Error: Configura TWITTER_USER_ID y WHATSAPP_CHANNEL_ID en .env",
    );
    console.error("Copia .env.example a .env y edita los valores");
    process.exit(1);
  }

  await loadLastTweetId();
  await initTwitter();

  console.log("\nIniciando WhatsApp...");
  console.log("Escanea el código QR que aparecerá con tu WhatsApp");
  await initWhatsApp();
}

main().catch(console.error);
