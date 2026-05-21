# Bot Twitter → WhatsApp

Bot que streamée tweets de @CRKingdomEN a un canal de WhatsApp.

## Configuración

1. Instala dependencias:
```bash
npm install
```

2. Obtén el ID de tu canal de WhatsApp:
```bash
npm run list-channels
```
Escanea el QR y verás la lista de tus canales con sus IDs.

3. Crea el archivo `.env`:
```bash
cp .env.example .env
```

4. Edita `.env` con:
   - `TWITTER_USERNAME`: El usuario de Twitter (ej: `CRKingdomEN`)
   - `WHATSAPP_CHANNEL_ID`: El ID del canal (ej: `120363XXX@g.us`)
   - `RETTIWT_API_KEY` (opcional): Para mejor estabilidad (ver abajo)

5. Ejecuta:
```bash
npm start
```

6. Escanea el código QR con WhatsApp

## Obtener API_KEY de Twitter (Opcional pero recomendado)

Para mejor estabilidad y evitar límites:

1. Instala la extensión [X Auth Helper](https://chromewebstore.google.com/detail/x-auth-helper/igpkhkjmpdecacocghpgkghdcmcmpfhp)
2. Abre Twitter en modo incógnito e inicia sesión
3. Haz clic en la extensión y luego en "Get Key"
4. Copia el API_KEY y pégalo en `.env`

## Notas

- El bot revisa tweets cada 30 segundos
- La sesión de WhatsApp se guarda en `whatsapp_session/`
- El último tweet procesado se guarda en `last_tweet.json`
- Requiere Chrome/Chromium instalado
