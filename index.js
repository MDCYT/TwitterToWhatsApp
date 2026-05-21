import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode";
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

    const tweetsWithDate = tweets.list.filter(tweet => tweet.createdAt);
    
    if (tweetsWithDate.length === 0) {
      console.log("No se encontraron tweets con fecha válida");
      return null;
    }

    tweetsWithDate.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

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

async function sendMessageToWhatsApp(sock, message, attachments = []) {
  try {
    if (attachments && attachments.length > 0) {
      for (const url of attachments) {
        try {
          const response = await fetch(url);
          const buffer = Buffer.from(await response.arrayBuffer());
          await sock.sendMessage(WHATSAPP_CHANNEL_ID, {
            image: buffer,
            caption: message,
          });
        } catch (e) {
          console.log("No se pudo cargar media desde URL:", url);
        }
      }
    } else {
      await sock.sendMessage(WHATSAPP_CHANNEL_ID, { text: message });
    }
    console.log("Mensaje enviado a WhatsApp");
  } catch (error) {
    console.error("Error enviando mensaje:", error.message);
  }
}

function startTwitterPolling(sock) {
  console.log("Iniciando monitoreo de tweets...");

  const pollInterval = setInterval(async () => {
    const tweet = await getLatestTweet();

    if (tweet) {
      const message = await formatTweetMessage(tweet);
      await sendMessageToWhatsApp(sock, message, tweet?.media?.map((m) => m.url) || []);
      await saveLastTweetId(tweet.id);
    }
  }, 30000);

  console.log(`Monitoreando tweets de @${TWITTER_USER_ID} cada 30 segundos`);
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    browser: ["Twitter Bot", "Chrome", "120.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n=== ESCANEA ESTE CÓDIGO QR CON WHATSAPP ===");
      try {
        const qrCode = await qrcode.toString(qr, { type: "terminal", small: true });
        console.log(qrCode);
      } catch (e) {
        console.log("QR (copia en WhatsApp):", qr);
      }
      console.log("==========================================\n");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        "Conexión cerrada. Reconectando...",
        shouldReconnect ? "" : "(no reconectar)"
      );
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp conectado!");
      startTwitterPolling(sock);
    }
  });

  sock.ev.on("messages.upsert", (m) => {
    console.log("Mensaje recibido:", m);
  });
}

async function main() {
  console.log("🚀 Iniciando bot Twitter → WhatsApp (Baileys)");
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

  console.log("\nIniciando WhatsApp con Baileys...");
  console.log("Escanea el código QR que aparecerá con tu WhatsApp");
  await connectToWhatsApp();
}

main().catch(console.error);
