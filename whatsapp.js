import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';

import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

// Connection status object exported for API access
export const connectionStatus = {
  state: 'disconnected', // 'disconnected' | 'connecting' | 'open' | 'close'
  qrCode: null
};

export async function connectWhatsApp() {
  connectionStatus.state = 'connecting';
  
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state
  });

  // Save auth credentials
  sock.ev.on('creds.update', saveCreds);

  // Connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Show QR in terminal and store it
    if (qr) {
      connectionStatus.qrCode = qr;
      connectionStatus.state = 'qr';
      console.log('\n✅ QR CODE GENERATED - Scan this QR code using WhatsApp → Linked Devices\n');
      qrcode.generate(qr, { small: true });
      console.log('QR code stored in connectionStatus.qrCode, length:', qr.length);
    }

    // Connected
    if (connection === 'open') {
      connectionStatus.state = 'open';
      connectionStatus.qrCode = null;
      console.log('WhatsApp connected successfully');
    }

    // Disconnected
    if (connection === 'close') {
      connectionStatus.state = 'close';
      connectionStatus.qrCode = null; // Clear QR code on close
      
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        connectionStatus.state = 'connecting';
        console.log('Connection lost. Reconnecting...');
        connectWhatsApp();
      } else {
        connectionStatus.state = 'logged_out';
        console.log('Logged out from WhatsApp.');
        console.log('Use /api/reconnect endpoint or click reconnect in frontend to get new QR code.');
      }
    }
  });

  return sock;
}

// Reconnect function that clears auth and gets new QR
export async function reconnectWhatsApp() {
  try {
    console.log('reconnectWhatsApp called, current state:', connectionStatus.state);
    const authPath = path.join(process.cwd(), 'auth_info');
    
    if (fs.existsSync(authPath)) {
      console.log('Clearing old auth session from:', authPath);
      try {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('✅ Auth folder deleted successfully');
      } catch (deleteErr) {
        console.error('Error deleting auth folder:', deleteErr);
        // Try to delete individual files
        try {
          const files = fs.readdirSync(authPath);
          for (const file of files) {
            try {
              fs.unlinkSync(path.join(authPath, file));
            } catch (e) {
              console.error('Error deleting file:', file, e);
            }
          }
          fs.rmdirSync(authPath);
          console.log('✅ Auth folder cleared manually');
        } catch (e) {
          console.error('Could not fully delete auth folder:', e);
          throw new Error('Failed to clear auth folder: ' + e.message);
        }
      }
    } else {
      console.log('No auth folder found, proceeding with fresh connection');
    }
    
    connectionStatus.state = 'connecting';
    connectionStatus.qrCode = null;
    
    console.log('Calling connectWhatsApp...');
    const newSock = await connectWhatsApp();
    console.log('✅ New socket created, QR code will appear shortly...');
    
    // Return immediately - QR code will come via event handler
    return newSock;
  } catch (err) {
    console.error('❌ Failed to reconnect:', err);
    connectionStatus.state = 'disconnected';
    throw err;
  }
}
