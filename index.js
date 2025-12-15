import express from 'express';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectWhatsApp, connectionStatus } from './whatsapp.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const FILE = './schedule.json';

/* ---------- Middleware ---------- */

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Utils ---------- */

function loadJobs() {
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function saveJobs(jobs) {
  fs.writeFileSync(FILE, JSON.stringify(jobs, null, 2));
}

function nowMYT() {
  return new Date(
    new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kuala_Lumpur'
    })
  );
}

function getNextId(jobs) {
  if (jobs.length === 0) return 1;
  return Math.max(...jobs.map(j => j.id)) + 1;
}

/* ---------- App ---------- */

const sock = await connectWhatsApp();

/* ---------- REST API ---------- */

// Get all jobs
app.get('/api/jobs', (req, res) => {
  const jobs = loadJobs();
  res.json(jobs);
});

// Create new job
app.post('/api/jobs', (req, res) => {
  const { phone, message, sendAt } = req.body;
  
  if (!phone || !message || !sendAt) {
    return res.status(400).json({ error: 'phone, message, and sendAt are required' });
  }
  
  const jobs = loadJobs();
  const newJob = {
    id: getNextId(jobs),
    phone,
    message,
    sendAt,
    sent: false
  };
  
  jobs.push(newJob);
  saveJobs(jobs);
  res.status(201).json(newJob);
});

// Update job
app.put('/api/jobs/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { phone, message, sendAt } = req.body;
  
  const jobs = loadJobs();
  const jobIndex = jobs.findIndex(j => j.id === id);
  
  if (jobIndex === -1) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  if (phone) jobs[jobIndex].phone = phone;
  if (message) jobs[jobIndex].message = message;
  if (sendAt) {
    jobs[jobIndex].sendAt = sendAt;
    jobs[jobIndex].sent = false; // Reset sent status when time changes
  }
  
  saveJobs(jobs);
  res.json(jobs[jobIndex]);
});

// Delete job
app.delete('/api/jobs/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  const jobs = loadJobs();
  const jobIndex = jobs.findIndex(j => j.id === id);
  
  if (jobIndex === -1) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  jobs.splice(jobIndex, 1);
  saveJobs(jobs);
  res.json({ success: true });
});

// Get WhatsApp connection status
app.get('/api/status', (req, res) => {
  console.log('Status API called - state:', connectionStatus.state, 'qrCode exists:', !!connectionStatus.qrCode);
  res.json(connectionStatus);
});

// Debug time and trigger
app.get('/api/debug/time', async (req, res) => {
  const now = nowMYT();
  const serverTime = new Date();
  
  // Force process jobs
  await processJobs();
  
  res.json({
    serverTime: serverTime.toISOString(),
    mytTime: now.toISOString(),
    localeString: now.toLocaleString(),
    message: 'Processed jobs'
  });
});

/* ---------- Scheduler ---------- */

async function processJobs() {
  const now = nowMYT();
  const jobs = loadJobs();

  for (const job of jobs) {
    const sendTime = new Date(job.sendAt);

    if (!job.sent && sendTime <= now) {
      try {
        const jid = `${job.phone}@s.whatsapp.net`;

        await sock.sendMessage(jid, { text: job.message });

        job.sent = true;
        console.log(`[SENT] ${job.phone} at MYT`);
      } catch (err) {
        console.error(`[FAILED] ${job.phone}`, err.message);
      }
    }
  }

  saveJobs(jobs);
}

cron.schedule(
  '* * * * *',
  async () => {
    console.log('Checking schedule (MYT)');
    await processJobs();
  },
  { timezone: 'Asia/Kuala_Lumpur' }
);

/* ---------- Server ---------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
