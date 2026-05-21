import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

import qrcode from 'qrcode-terminal';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getBasePath = () => {
  if (process.platform === 'win32') {
    return __dirname.replace(/^\//, '');
  }
  return __dirname;
};

const basePath = getBasePath();
const sessionPath = join(basePath, 'whatsapp_session');

async function initWhatsApp() {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionPath
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    console.log('\n=== ESCANEA ESTE CÓDIGO QR CON WHATSAPP ===');
    qrcode.generate(qr, { small: true });
    console.log('==========================================\n');
  });

  client.on('ready', async () => {
    console.log('✅ WhatsApp conectado!\n');
    
    const chats = await client.getChats();
    
    console.log('=== TUS CHATS Y CANALES ===\n');
    
    const channels = chats.filter(chat => chat.id.server === 'g.us' || chat.id._serialized.includes('@g.us'));
    const privates = chats.filter(chat => chat.id.server === 'c.us' || chat.id._serialized.includes('@c.us'));
    
    if (channels.length > 0) {
      console.log('📢 CANALES/GRUPOS:');
      channels.forEach((chat, index) => {
        console.log(`${index + 1}. ${chat.name || 'Sin nombre'} - ID: ${chat.id._serialized}`);
      });
    }
    
    console.log('\n💬 CHATS PRIVADOS (primeros 10):');
    privates.slice(0, 10).forEach((chat, index) => {
      console.log(`${index + 1}. ${chat.name || chat.pushname || 'Sin nombre'} - ID: ${chat.id._serialized}`);
    });
    
    if (privates.length > 10) {
      console.log(`... y ${privates.length - 10} más`);
    }
    
    console.log('\n=================================');
    console.log('Copia el ID del canal que quieras usar');
    console.log('Ej: 120363XXX@g.us');
    console.log('\nPresiona Ctrl+C para salir');
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
  });

  await client.initialize();
}

initWhatsApp().catch(console.error);
