import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
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

// In-memory cloud save fallback for unauthenticated sessions
const cloudSaves: Record<string, any> = {};

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    game: 'Aetheria: Outcast Lands',
    unifiedProjectName: 'Aetheria: Outcast Lands',
    projectId: 'agile-gear-q3rp2',
    region: 'us-east1',
    geminiActive: !!ai,
    cloudSqlConfigured: !!process.env.SQL_HOST,
    timestamp: Date.now(),
  });
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
