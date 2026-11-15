import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Unified project name across platforms
export const UNIFIED_PROJECT_NAME = 'Aetheria: Outcast Lands';
export const ADMIN_EMAILS = [
  'new.dawn.industries2026@gmail.com',
  'just4funxxx7@gmail.com',
];

export function isClientAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

// Configure GoogleAuthProvider with exact Workspace scopes provisioned via set_up_oauth
export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => googleProvider.addScope(scope));

// In-memory OAuth access token storage (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on startup
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export const initAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
    }
    callback(user);
  });
};

export const googleSignIn = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cachedAccessToken = credential?.accessToken ?? null;
  return result.user;
};

export const getAccessToken = async (): Promise<string> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Failed to retrieve OAuth access token');
  }
  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
};

export const logout = async () => {
  cachedAccessToken = null;
  await signOut(auth);
};

// Sync Survivor Profile & Save to Firestore
export async function syncSurvivorToFirestore(
  user: User,
  level: number,
  karma: number,
  dayCount: number,
  savePayloadJson: string
) {
  const userPath = `users/${user.uid}`;
  const savePath = `cloud_saves/${user.uid}`;
  const role = isClientAdminEmail(user.email) ? 'admin' : 'survivor';

  try {
    const existingDoc = await getDoc(doc(db, 'users', user.uid));
    const existingRole = existingDoc.exists() ? existingDoc.data()?.role : role;
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Outcast Survivor',
        role: existingRole || role,
        unifiedProjectName: UNIFIED_PROJECT_NAME,
        createdAt: existingDoc.exists()
          ? existingDoc.data()?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }

  try {
    await setDoc(doc(db, 'cloud_saves', user.uid), {
      userId: user.uid,
      saveName: `${UNIFIED_PROJECT_NAME} - Cloud Save`,
      level,
      moralKarma: karma,
      dayCount,
      savePayloadJson,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, savePath);
  }
}

export async function loadSurvivorFromFirestore(user: User) {
  const savePath = `cloud_saves/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'cloud_saves', user.uid));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, savePath);
    return null;
  }
}

// ==========================================
// GOOGLE WORKSPACE: GOOGLE DOCS INTEGRATION
// ==========================================
export interface ExpeditionDocItem {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

export async function listUserSurvivalDocs(): Promise<ExpeditionDocItem[]> {
  const token = await getAccessToken();
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.document' and trashed=false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=6&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('Google Drive/Docs authorization expired. Please try again.');
  }
  if (!res.ok) {
    throw new Error('Failed to list Google Docs');
  }
  const data = await res.json();
  return data.files || [];
}

export async function createSurvivalChronicleDoc(
  title: string,
  contentBody: string
): Promise<{ documentId: string; title: string }> {
  const token = await getAccessToken();

  // 1. Create blank Google Doc
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (createRes.status === 401 || createRes.status === 403) {
    cachedAccessToken = null;
    throw new Error('Google Docs permission required. Please re-authorize.');
  }
  if (!createRes.ok) {
    throw new Error('Failed to create Google Doc');
  }

  const createdDoc = await createRes.json();
  const documentId = createdDoc.documentId;

  // 2. Populate content via batchUpdate insertText at index 1
  const updateRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: contentBody,
            },
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    throw new Error('Created Google Doc, but failed to write chronicle text.');
  }

  // Also record in Firestore expedition_logs if signed in
  if (auth.currentUser) {
    const logId = `log_${Date.now()}`;
    try {
      await setDoc(doc(db, 'expedition_logs', logId), {
        userId: auth.currentUser.uid,
        title,
        summary: contentBody.slice(0, 300),
        googleDocId: documentId,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Non-fatal
    }
  }

  return { documentId, title };
}

// ==========================================
// GOOGLE WORKSPACE: GMAIL INTEGRATION
// ==========================================
export interface GmailMessageSummary {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

export async function listRecentGmailDispatches(
  maxResults = 4
): Promise<GmailMessageSummary[]> {
  const token = await getAccessToken();
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (listRes.status === 401 || listRes.status === 403) {
    cachedAccessToken = null;
    throw new Error('Gmail authorization expired. Please re-authenticate.');
  }
  if (!listRes.ok) {
    throw new Error('Failed to fetch Gmail messages');
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];

  const details = await Promise.all(
    messages.map(async (m: { id: string }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const msg = await msgRes.json();
      const headers: { name: string; value: string }[] =
        msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
          ?.value || '';
      return {
        id: m.id,
        subject: getHeader('Subject') || '(No Subject)',
        from: getHeader('From') || 'Unknown Sender',
        date: getHeader('Date') || '',
        snippet: msg.snippet || '',
      };
    })
  );

  return details;
}

function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendGmailSurvivalDispatch(
  to: string,
  subject: string,
  bodyText: string
): Promise<void> {
  const token = await getAccessToken();
  const rawMime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText,
  ].join('\r\n');

  const raw = encodeBase64Url(rawMime);

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('Gmail send permission required. Please re-authenticate.');
  }
  if (!res.ok) {
    throw new Error('Failed to send Gmail dispatch');
  }
}
