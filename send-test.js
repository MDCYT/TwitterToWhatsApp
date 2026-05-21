import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

const channelId = process.argv[2];

if (!channelId) {
  console.log('Uso: npm run send-test <ID_DEL_CANAL>');
  console.log('Ej: npm run send-test 120363021986567800@g.us');
  process.exit(1);
}

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

  client.on('ready', async () => {
    console.log('✅ WhatsApp conectado!\n');
    
    try {
      const chat = await client.getChatById(channelId);
      
      console.log('📢 INFORMACIÓN DEL CANAL:');
      console.log('Nombre:', chat.name || 'Sin nombre');
      console.log('ID:', channelId);
      console.log('Es grupo:', chat.isGroup);
      
      if (chat.isGroup) {
        try {
          const participants = await chat.participants;
          console.log('Participantes:', participants.length);
          
          const myNumber = client.info.wid._serialized;
          const me = participants.find(p => p.id._serialized === myNumber);
          if (me) {
            console.log('Eres admin:', me.isAdmin ? '✅ SÍ' : '❌ NO');
          }
        } catch (e) {}
      }
      
      console.log('\n📤 Enviando mensaje de prueba...');
      await client.sendMessage(channelId, {
        body: '🤖 **TEST DEL BOT**\n\nSi ves este mensaje, el bot puede publicar en este canal.\n\nID: `' + channelId + '`'
      });
      
      console.log('✅ Mensaje enviado!');
      console.log('\nRevisa WhatsApp para confirmar que llego al canal correcto.');
      console.log('Si es el canal que quieres, usa este ID en tu .env');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('\nVerifica que el ID sea correcto y que tengas acceso al canal.');
    }
    
    process.exit(0);
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
    process.exit(1);
  });

  await client.initialize();
}

initWhatsApp().catch(console.error);
