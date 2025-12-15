import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';

import qrcode from 'qrcode-terminal';

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
      console.log('\nScan this QR code using WhatsApp → Linked Devices\n');
      qrcode.generate(qr, { small: true });
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
        console.log('Delete auth_info folder and restart to re-scan QR.');
      }
    }
  });

  return sock;
}
