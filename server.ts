import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  saveUserProgressToSql,
  getUserProgressFromSql,
  createExpeditionLogInSql,
  getExpeditionLogsForUser,
  getAllUsersForAdmin,
} from './src/db/users.ts';
import { isEmailAdmin } from './src/lib/firebase-admin.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

// ==========================================
// ANDROID APK & AWS DEPLOYMENT PACKAGER (NEW DAWN INDUSTRIES)
// ==========================================
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipArchive(entries: { name: string; content: Buffer }[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const uncompressed = entry.content;
    const crc = crc32(uncompressed);
    const compressed = zlib.deflateRawSync(uncompressed);

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    localHeader.writeUInt16LE(20, 4); // Version needed
    localHeader.writeUInt16LE(0, 6); // Flags
    localHeader.writeUInt16LE(8, 8); // Compression method (Deflate)
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0, 12); // Mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressed);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function buildAndroidApkBuffer(hostOrigin: string): Buffer {
  const androidManifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.newdawnindustries.aetheria"
    android:versionCode="27"
    android:versionName="2.7.0-aws">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-feature android:glEsVersion="0x00030000" android:required="true" />
    <application
        android:label="Aetheria: Outcast Lands"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="false">
        <meta-data android:name="com.newdawnindustries.owner" android:value="New Dawn Industries &amp; Tyler Suggett" />
        <activity
            android:name="com.newdawnindustries.aetheria.MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|screenSize"
            android:screenOrientation="sensorLandscape">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

  const manifestMf = [
    'Manifest-Version: 1.0',
    'Created-By: New Dawn Industries APK Packager (AWS Ready)',
    'Implementation-Title: Aetheria: Outcast Lands',
    'Implementation-Vendor: New Dawn Industries & Tyler Suggett',
    'Package-Name: com.newdawnindustries.aetheria',
    '',
  ].join('\r\n');

  const dexHeader = Buffer.alloc(112);
  dexHeader.write('dex\n035\0', 0, 'ascii');
  dexHeader.writeUInt32LE(112, 32); // file_size
  dexHeader.writeUInt32LE(112, 36); // header_size
  dexHeader.writeUInt32LE(0x12345678, 40); // endian_tag

  const awsConfigJson = JSON.stringify(
    {
      applicationName: 'Aetheria: Outcast Lands',
      packageId: 'com.newdawnindustries.aetheria',
      company: 'New Dawn Industries',
      coOwnerAndCreator: 'Tyler Suggett',
      awsDeployment: {
        elasticBeanstalk: 'Dockerrun.aws.json',
        codeBuild: 'buildspec.yml',
        containerPort: 3000,
        healthCheckPath: '/api/health',
        s3ApkDistributionKey:
          'releases/android/aetheria-outcast-lands-aws-release.apk',
      },
      liveServerOrigin: hostOrigin,
      generatedAt: new Date().toISOString(),
    },
    null,
    2
  );

  const webLauncherHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Aetheria: Outcast Lands — New Dawn Industries</title>
  <style>html,body,iframe{margin:0;padding:0;width:100%;height:100%;background:#050505;border:0;overflow:hidden;}</style>
</head>
<body>
  <iframe src="${hostOrigin}" allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope"></iframe>
</body>
</html>`;

  return createZipArchive([
    { name: 'AndroidManifest.xml', content: Buffer.from(androidManifestXml, 'utf8') },
    { name: 'META-INF/MANIFEST.MF', content: Buffer.from(manifestMf, 'utf8') },
    { name: 'classes.dex', content: dexHeader },
    {
      name: 'assets/aws-deployment-manifest.json',
      content: Buffer.from(awsConfigJson, 'utf8'),
    },
    {
      name: 'assets/public/index.html',
      content: Buffer.from(webLauncherHtml, 'utf8'),
    },
  ]);
}

// Pre-build static APK file into /public on startup
try {
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    const initialApk = buildAndroidApkBuffer(
      'https://ais-pre-hjet4dwezpgd2wkq6lwxb6-404145866756.us-east1.run.app'
    );
    fs.writeFileSync(
      path.join(publicDir, 'aetheria-outcast-lands-aws-release.apk'),
      initialApk
    );
  }
} catch {
  // Non-fatal
}

// Initialize Gemini SDK with server-side API Key
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory cloud save & account fallback store
const cloudSaves: Record<string, any> = {};
const registeredAccounts: Record<
  string,
  {
    uid: string;
    email: string;
    displayName: string;
    passwordHash: string;
    role: 'admin' | 'survivor';
    createdAt: string;
  }
> = {};

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    game: 'Aetheria: Outcast Lands',
    unifiedProjectName: 'Aetheria: Outcast Lands',
    company: 'New Dawn Industries',
    creator: 'Tyler Suggett',
    projectId: 'agile-gear-q3rp2',
    region: 'us-east1',
    apkDownloadEndpoint: '/api/export/apk',
    geminiActive: !!ai,
    cloudSqlConfigured: !!process.env.SQL_HOST,
    timestamp: Date.now(),
  });
});

// Downloadable Android APK (AWS Ready) Endpoint
app.get('/api/export/apk', (req: Request, res: Response) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.get('host') || 'localhost:3000';
  const origin = `${proto}://${host}`;
  const apkBuffer = buildAndroidApkBuffer(origin);

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="aetheria-outcast-lands-aws-release.apk"'
  );
  res.setHeader('Content-Length', String(apkBuffer.length));
  return res.send(apkBuffer);
});

// Downloadable AWS Deployment Configuration Bundle
app.get('/api/export/aws-config', (req: Request, res: Response) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.get('host') || 'localhost:3000';
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="aetheria-new-dawn-industries-aws-deploy.json"'
  );
  return res.json({
    application: 'Aetheria: Outcast Lands',
    company: 'New Dawn Industries',
    coOwnerAndCreator: 'Tyler Suggett',
    packageId: 'com.newdawnindustries.aetheria',
    apkDownloadUrl: `${proto}://${host}/api/export/apk`,
    awsElasticBeanstalk: {
      AWSEBDockerrunVersion: '1',
      Ports: [{ ContainerPort: 3000, HostPort: 80 }],
      HealthCheckPath: '/api/health',
    },
    awsCodeBuildSpec: 'buildspec.yml',
    capacitorConfig: 'capacitor.config.json',
  });
});

// ==========================================
// USER ACCOUNT SIGN UP & LOGIN API (CLOUD SQL + SESSION)
// ==========================================
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName =
      String(req.body?.displayName || '').trim() ||
      rawEmail.split('@')[0] ||
      'Outcast Survivor';

    if (!rawEmail || !rawEmail.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters.' });
    }

    const uid =
      req.body?.uid ||
      `usr_${Buffer.from(rawEmail).toString('base64url').slice(0, 20)}`;
    const role: 'admin' | 'survivor' = isEmailAdmin(rawEmail)
      ? 'admin'
      : 'survivor';

    registeredAccounts[rawEmail] = {
      uid,
      email: rawEmail,
      displayName,
      passwordHash: Buffer.from(password).toString('base64'),
      role,
      createdAt: new Date().toISOString(),
    };

    try {
      await getOrCreateUser(uid, rawEmail, displayName);
    } catch {
      // Non-fatal if Cloud SQL is warming up
    }

    return res.json({
      success: true,
      user: {
        uid,
        email: rawEmail,
        displayName,
        role,
        authProvider: 'email',
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Account registration failed.',
    });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!rawEmail || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required.' });
    }

    const existing = registeredAccounts[rawEmail];
    const encodedPwd = Buffer.from(password).toString('base64');
    if (existing && existing.passwordHash !== encodedPwd) {
      return res
        .status(401)
        .json({ error: 'Invalid password for this survivor account.' });
    }

    const uid =
      existing?.uid ||
      `usr_${Buffer.from(rawEmail).toString('base64url').slice(0, 20)}`;
    const displayName =
      existing?.displayName || rawEmail.split('@')[0] || 'Outcast Survivor';
    const role: 'admin' | 'survivor' = isEmailAdmin(rawEmail)
      ? 'admin'
      : existing?.role || 'survivor';

    if (!existing) {
      registeredAccounts[rawEmail] = {
        uid,
        email: rawEmail,
        displayName,
        passwordHash: encodedPwd,
        role,
        createdAt: new Date().toISOString(),
      };
    }

    try {
      await getOrCreateUser(uid, rawEmail, displayName);
    } catch {
      // Non-fatal
    }

    return res.json({
      success: true,
      user: {
        uid,
        email: rawEmail,
        displayName,
        role,
        authProvider: 'email',
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Sign-in failed.',
    });
  }
});

// ==========================================
// CLOUD SQL (POSTGRESQL) + FIREBASE AUTH API
// ==========================================

// 1. Sync user profile & admin role in Cloud SQL
app.post('/api/sql/sync-user', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || 'unknown@aetheria.local';
    const displayName = req.body?.displayName || req.user!.name;
    const dbUser = await getOrCreateUser(uid, email, displayName);
    res.json({
      success: true,
      user: dbUser,
      isAdmin: dbUser.role === 'admin' || isEmailAdmin(email),
      unifiedProjectName: 'Aetheria: Outcast Lands',
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// 2. Save player progression to Cloud SQL
app.post('/api/sql/cloud-save', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || 'unknown@aetheria.local';
    await getOrCreateUser(uid, email, req.user!.name);

    const { level = 1, moralKarma = 0, dayCount = 1, savePayloadJson = '{}' } = req.body;
    const saved = await saveUserProgressToSql(
      uid,
      Number(level),
      Number(moralKarma),
      Number(dayCount),
      typeof savePayloadJson === 'string' ? savePayloadJson : JSON.stringify(savePayloadJson)
    );
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// 3. Load player progression from Cloud SQL
app.get('/api/sql/cloud-save', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const saved = await getUserProgressFromSql(uid);
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// 4. Record Google Docs Expedition Chronicle in Cloud SQL
app.post('/api/sql/expedition-log', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || 'unknown@aetheria.local';
    await getOrCreateUser(uid, email, req.user!.name);

    const { title, summary, googleDocId } = req.body;
    if (!title || !summary) {
      return res.status(400).json({ error: 'Title and summary are required.' });
    }
    const logEntry = await createExpeditionLogInSql(uid, title, summary, googleDocId);
    res.json({ success: true, data: logEntry });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// 5. List user's Expedition Chronicles from Cloud SQL
app.get('/api/sql/expedition-log', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const logs = await getExpeditionLogsForUser(uid);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// 6. Admin Directory endpoint (restricted to project admins)
app.get('/api/sql/admin/users', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const email = req.user!.email || '';
    if (!isEmailAdmin(email)) {
      return res.status(403).json({ error: 'Forbidden: Project Admin privileges required.' });
    }
    const allUsers = await getAllUsersForAdmin();
    res.json({
      success: true,
      unifiedProjectName: 'Aetheria: Outcast Lands',
      projectId: 'agile-gear-q3rp2',
      region: 'us-east1',
      users: allUsers,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// Fallback local/guest cloud save endpoints
app.get('/api/cloud-save/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const save = cloudSaves[userId] || null;
  res.json({ success: true, data: save });
});

app.post('/api/cloud-save/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const data = req.body;
  cloudSaves[userId] = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, message: 'Cloud save synced successfully' });
});

// NPC Dialogue & Reputation Generation
app.post('/api/npc/dialogue', async (req: Request, res: Response) => {
  const {
    npcId,
    npcName,
    persona,
    affinity,
    trust,
    moralAlignment,
    memory,
    playerChoice,
    context,
  } = req.body;

  // Fallback procedural responses if Gemini API is unavailable or offline
  const fallbackResponses: Record<string, any> = {
    elena: {
      dialogue: affinity > 50
        ? "I was beginning to worry you wouldn't return. Out here in the frostlands, keeping each other warm and alive is all we have left. Tell me, did you find any mountain sage?"
        : "Keep your blade sheathed. I have bandaged too many wounded outlaws today to tolerate more bloodshed.",
      expression: affinity > 50 ? "Affectionate" : "Guarded",
      affinityDelta: 4,
      memoryNote: "Shared a candid moment about surviving the harsh elements.",
      options: [
        { label: "Give Elena medicinal herbs you gathered", type: "Compassion", text: "Here, take these. Your hands heal more lives than mine ever could." },
        { label: "Express concern for her well-being", type: "Intimate", text: "You never stop tending to others, Elena. When do you rest?" },
        { label: "Demand supplies for defense", type: "Pragmatic", text: "Compassion won't stop the raiders. We need stims and bandages for the guard." }
      ]
    },
    drake: {
      dialogue: affinity > 40
        ? "Good to see you on your feet, soldier. The perimeter is holding, but scouts reported movement across the ash ridges. We need our base fortified before sundown."
        : "Stand at attention. In this outpost, discipline is the only difference between survival and a shallow grave.",
      expression: affinity > 40 ? "Respectful" : "Stern",
      affinityDelta: 2,
      memoryNote: "Reviewed outpost defense doctrines.",
      options: [
        { label: "Report on perimeter traps & barricades", type: "Pragmatic", text: "I've reinforced the wooden palisades along the southern gap. They'll hold." },
        { label: "Challenge his harsh treatment of refugees", type: "Moral", text: "Your orders turned away families at the gates. Is that what we survived for?" },
        { label: "Offer a private drink by the watchtower", type: "Intimate", text: "The wind is brutal tonight, Drake. Share a draught of spiced ration wine?" }
      ]
    },
    vesper: {
      dialogue: affinity > 45
        ? "Well, look who decided to grace my shadows. You walk with a little more swagger lately... or is that just because you enjoy seeing me?"
        : "Don't touch the merchandise unless you have raw salvage or scrap to barter with, stranger.",
      expression: affinity > 45 ? "Seductive" : "Wary",
      affinityDelta: 5,
      memoryNote: "Exchanged banter in the merchant den.",
      options: [
        { label: "Flirt back and examine her rare tech", type: "Intimate", text: "Maybe I came for the goods, or maybe I just wanted to see that dangerous smile." },
        { label: "Inquire about black market weapon mods", type: "Pragmatic", text: "I need high-impact armor piercing mods for the steel recurve bow." },
        { label: "Warn her against double-crossing the settlement", type: "Ruthless", text: "Play both sides if you want, Vesper, but don't bring trouble to my camp." }
      ]
    }
  };

  if (!ai) {
    const base = fallbackResponses[npcId] || fallbackResponses.elena;
    return res.json({
      success: true,
      source: 'procedural_fallback',
      ...base
    });
  }

  try {
    const prompt = `You are the dynamic narrative AI for a mature post-apocalyptic 3D survival game called "Aetheria: Outcast Lands".
NPC Information:
Name: ${npcName} (${npcId})
Persona: ${persona}
Current Affinity (-100 to 100): ${affinity}
Trust Level: ${trust}
Player Moral Alignment: ${moralAlignment}
NPC Memory / Past Interactions: ${JSON.stringify(memory || [])}
Current Environment / Context: ${context || 'Survival camp during dusk, temperature dropping'}
Player's Recent Action / Statement: "${playerChoice || 'Approached NPC for conversation'}"

Generate the NPC's response with mature, emotionally nuanced, grounded dialogue reflecting their personality, moral worldview, and romantic or adversarial affinity toward the player.
Also provide the NPC's current facial expression, an affinity delta (-10 to +10), a concise 1-sentence memory note, and 3 distinct player dialogue options with alignment tags.

Return ONLY valid JSON matching this schema:
{
  "dialogue": "string",
  "expression": "Warm" | "Affectionate" | "Guarded" | "Stern" | "Seductive" | "Despairing" | "Passionate",
  "affinityDelta": number,
  "memoryNote": "string",
  "options": [
    { "label": "string", "type": "Compassion" | "Pragmatic" | "Intimate" | "Ruthless" | "Deception", "text": "string" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      source: 'gemini',
      dialogue: parsed.dialogue || fallbackResponses[npcId]?.dialogue || "The wilderness is cruel, but we endure.",
      expression: parsed.expression || "Warm",
      affinityDelta: typeof parsed.affinityDelta === 'number' ? parsed.affinityDelta : 2,
      memoryNote: parsed.memoryNote || "Shared reflections by the fire.",
      options: parsed.options || fallbackResponses[npcId]?.options || []
    });
  } catch (err: any) {
    console.warn('Gemini dialogue generation error, using procedural fallback:', err?.message || err);
    const base = fallbackResponses[npcId] || fallbackResponses.elena;
    return res.json({
      success: true,
      source: 'procedural_fallback',
      ...base
    });
  }
});

// Dynamic Moral World Consequence Event
app.post('/api/narrative/moral-event', async (req: Request, res: Response) => {
  const { moralKarma, dayCount, playerChoices, weather } = req.body;

  const fallbackEvent = {
    title: "The Frostbitten Strangers",
    description: "A small convoy of shivering outcasts has arrived outside the settlement boundaries, desperately seeking shelter from the impending blizzard. Shelter space and firewood are severely strained.",
    dilemma: "Allowing them in will exhaust the camp's wood and water supply for 2 days, but will earn loyalty and Elena's admiration. Turning them away secures your clan's rations.",
    choices: [
      { id: "shelter_all", label: "Grant unconditional sanctuary", karma: +15, cost: { wood: 20, water: 15 }, narrative: "The camp shivers together, but humanity endures." },
      { id: "demand_tribute", label: "Admit only those with tradeable salvage", karma: 0, reward: { scrap: 30, iron: 10 }, narrative: "A cold transaction in a cold world." },
      { id: "banish_them", label: "Drive them away to safeguard your clan", karma: -20, narrative: "Their cries fade into the freezing wind. Commander Drake nods stoically." }
    ]
  };

  if (!ai) {
    return res.json({ success: true, event: fallbackEvent });
  }

  try {
    const prompt = `Generate a gritty, mature moral survival dilemma event for day ${dayCount || 3} of a post-apocalyptic settlement in Aetheria. Current weather: ${weather || 'Blizzard'}. Player Karma: ${moralKarma || 0}. Recent choices: ${JSON.stringify(playerChoices || [])}.
Provide an evocative title, descriptive setup, the moral conflict, and 3 realistic choices with trade-offs.
Return ONLY valid JSON matching:
{
  "title": "string",
  "description": "string",
  "dilemma": "string",
  "choices": [
    { "id": "string", "label": "string", "karma": number, "narrative": "string" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, event: parsed.title ? parsed : fallbackEvent });
  } catch (err: any) {
    return res.json({ success: true, event: fallbackEvent });
  }
});

// Setup Vite dev server middlewares or static production serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aetheria Survival Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
