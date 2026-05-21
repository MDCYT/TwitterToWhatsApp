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
    
    console.log('=== FILTRANDO SOLO CANALES DONDE ERES ADMIN ===\n');
    
    const channels = [];
    
    for (const chat of chats) {
      if (chat.id._serialized.includes('@g.us')) {
        try {
          const chatInfo = await client.getChatById(chat.id._serialized);
          const isGroup = chat.isGroup;
          
          if (isGroup || chatInfo.isGroup) {
            let participantCount = 'N/A';
            let isAdmin = 'N/A';
            
            try {
              const participants = await chatInfo.participants;
              participantCount = participants.length;
              
              const myNumber = client.info.wid._serialized;
              const me = participants.find(p => p.id._serialized === myNumber);
              if (me) {
                isAdmin = me.isAdmin ? '✅ SÍ' : '❌ NO';
              }
            } catch (e) {}
            
            channels.push({
              id: JSON.stringify(chat.id),
              name: chat.name || 'Sin nombre',
              participants: participantCount,
              isAdmin: isAdmin
            });
          }
        } catch (e) {}
      }
    }
    
    // Ordenar: primero donde eres admin
    channels.sort((a, b) => {
      if (a.isAdmin === '✅ SÍ' && b.isAdmin !== '✅ SÍ') return -1;
      if (a.isAdmin !== '✅ SÍ' && b.isAdmin === '✅ SÍ') return 1;
      return 0;
    });
    
    // Crear contenido del archivo
    let fileContent = '=== CANALES Y GRUPOS DE WHATSAPP ===\n';
    fileContent += `Fecha: ${new Date().toLocaleString()}\n`;
    fileContent += `Total: ${channels.length} canales/grupos\n\n`;
    fileContent += '==========================================\n\n';
    
    channels.forEach((channel, index) => {
      fileContent += `${index + 1}. ${channel.name}\n`;
      fileContent += `   ID: ${channel.id}\n`;
      fileContent += `   Participantes: ${channel.participants}\n`;
      fileContent += `   Eres admin: ${channel.isAdmin}\n\n`;
    });
    
    fileContent += '==========================================\n';
    fileContent += '\nPara identificar un canal específico:\n';
    fileContent += '1. Abre WhatsApp en tu celular\n';
    fileContent += '2. Busca el canal por nombre\n';
    fileContent += '3. Copia el ID de arriba que coincida\n';
    fileContent += '\nO usa el comando: npm run send-test <ID>\n';
    fileContent += 'para enviar un mensaje de prueba y confirmar\n';
    
    // Guardar en archivo
    const outputPath = join(basePath, 'channels_list.txt');
    await fs.writeFile(outputPath, fileContent, 'utf-8');
    
    console.log(`✅ Lista guardada en: channels_list.txt`);
    console.log(`📊 Total: ${channels.length} canales/grupos encontrados`);
    console.log('\nAbre el archivo channels_list.txt para ver la lista completa.');
    
    process.exit(0);
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
  });

  await client.initialize();
}

initWhatsApp().catch(console.error);
