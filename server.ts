import dotenv from 'dotenv';
dotenv.config();

// Fix for unhandled rejections causing silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config with path resiliency AS EARLY AS POSSIBLE
let firebaseConfig: any;
try {
  const configPath = fs.existsSync(path.join(__dirname, 'firebase-applet-config.json')) 
    ? path.join(__dirname, 'firebase-applet-config.json')
    : path.join(process.cwd(), 'firebase-applet-config.json');
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // CRITICAL: Set environment variables before admin SDK is used or complex imports occur
  if (firebaseConfig.projectId) {
    process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
    process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
  }
} catch (err) {
  console.error('Core Error: Missing firebase-applet-config.json');
  firebaseConfig = { projectId: process.env.FIREBASE_PROJECT_ID };
}

import express from 'express';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { query } from './src/lib/mysql'; 
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Global service instances
let dbInstance: admin.firestore.Firestore;
let lastFirestoreError: string | null = null;
let razorpay: Razorpay | null = null;
let isMysqlEnabled = false;

// Finalized Firebase initialization function
async function initFirestore() {
  console.log('[INIT] Starting Firestore initialization...');
  
  try {
    const pId = firebaseConfig.projectId;
    const dId = firebaseConfig.firestoreDatabaseId;

    // Reset admin apps
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map(app => app ? app.delete() : Promise.resolve()));
    }

    console.log(`[INIT] Initializing Firebase App with Project: ${pId}`);
    
    // Explicitly use the project ID from the config
    const app = admin.initializeApp({ 
      projectId: pId,
    });

    const dbId = dId && dId !== '(default)' ? dId : undefined;
    
    // Explicit constructor is often more reliable for specific project/database routing
    dbInstance = new admin.firestore.Firestore({
      projectId: pId,
      databaseId: dbId
    });
    
    // Test connectivity
    try {
      const testDoc = dbInstance.collection('_health_').doc('boot');
      await testDoc.set({ 
        time: FieldValue.serverTimestamp(), 
        status: 'online',
        project: pId,
        database: dbId || 'default'
      });
      await testDoc.delete();
      lastFirestoreError = null;
      console.log(`[CONNECTED] Firestore active on ${pId} (${dbId || 'default'})`);
    } catch (e: any) {
      lastFirestoreError = e.message;
      console.error(`[WARN] Firestore connectivity test failed: ${e.message}`);
      // If we see the "Cloud Firestore API has not been used" error here, 
      // it means even with explicit ID, the credential doesn't have access or it's the wrong project.
    }
  } catch (e: any) {
    console.error('[FATAL] Firestore setup failed:', e.message);
  }
}

async function ensureSystemSettings() {
  if (!dbInstance) return;
  try {
    const settingsRef = dbInstance.collection('system_config').doc('settings');
    const doc = await settingsRef.get();
    if (!doc.exists) {
      await settingsRef.set({
        autoProfit: false, randomMode: true, wingoRandomMode: true,
        depositBonusPercentage: 2, withdrawLimit: 500, maintenanceMode: false,
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  } catch (e) {}
}

const initRazorpay = () => {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    console.log('Razorpay initialized');
  }
};

async function checkMysqlConnection() {
  if (!process.env.DB_HOST) return false;
  try {
    const { query: testQuery } = await import('./src/lib/mysql');
    await Promise.race([testQuery('SELECT 1'), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))]);
    return true;
  } catch (e) { return false; }
}

// Game History Cache
const gameHistoryCache = new Map<string, any[]>();
const GAME_MODES = { '30s': 30, '1m': 60, '3m': 180, '5m': 300 };

// Result Generator Logic
const generateDetails = (num: number) => {
  const color = [1,3,7,9].includes(num) ? 'Green' : ([2,4,6,8].includes(num) ? 'Red' : (num === 0 ? 'Red-Violet' : 'Green-Violet'));
  return { resultNumber: num, resultColor: color, resultSize: num <= 4 ? 'Small' : 'Big' };
};

const generateResult = async (gameType: string, periodId: string) => {
  if (!dbInstance) return generateDetails(Math.floor(Math.random()*10));
  try {
    const specificDoc = await dbInstance.collection('game_controls').doc(`wingo_next_${gameType}`).get();
    let controlUsed = false;
    let targetNum: number | undefined = undefined;

    if (specificDoc.exists && specificDoc.data()?.status === 'pending') {
      const control = specificDoc.data();
      targetNum = control?.targetNumber;
      if (targetNum === undefined && control?.targetSize) {
        const sizeNums = control.targetSize === 'Big' ? [5,6,7,8,9] : [0,1,2,3,4];
        targetNum = sizeNums[Math.floor(Math.random() * sizeNums.length)];
      }
      
      if (targetNum !== undefined) {
         await specificDoc.ref.update({ 
          status: 'used', 
          usedAt: FieldValue.serverTimestamp(),
          usedInPeriod: periodId 
        });
        controlUsed = true;
        return generateDetails(targetNum);
      }
    }

    if (!controlUsed) {
      const controlSnap = await dbInstance.collection('game_controls')
        .where('type', '==', 'wingo')
        .where('gameType', '==', gameType)
        .where('status', '==', 'pending')
        .limit(10)
        .get();

      if (!controlSnap.empty) {
        // Sort in memory to avoid index requirements
        const sortedDocs = controlSnap.docs.sort((a, b) => {
          const aTime = a.data().createdAt?.toMillis() || 0;
          const bTime = b.data().createdAt?.toMillis() || 0;
          return bTime - aTime; // desc order
        });
        
        const controlDoc = sortedDocs[0];
        const control = controlDoc.data();
        targetNum = control.targetNumber;
        if (targetNum === undefined && control.targetSize) {
          const sizeNums = control.targetSize === 'Big' ? [5,6,7,8,9] : [0,1,2,3,4];
          targetNum = sizeNums[Math.floor(Math.random() * sizeNums.length)];
        }

        if (targetNum !== undefined) {
          await controlDoc.ref.update({ 
            status: 'used', 
            usedAt: FieldValue.serverTimestamp(),
            usedInPeriod: periodId 
          });
          return generateDetails(targetNum);
        }
      }
    }

    const settingsSnap = await dbInstance.collection('system_config').doc('settings').get();
    const settings = settingsSnap.data();
    const isAutoControl = settings?.wingoAutoControl ?? settings?.autoProfit ?? false;
    const isRandomMode = settings?.wingoRandomMode ?? settings?.randomMode ?? true;

    if (isAutoControl && !isRandomMode) {
      const bets = await dbInstance.collection('bets').where('gameType', '==', gameType).where('periodId', '==', periodId).get();
      const payouts = new Array(10).fill(0);
      bets.forEach(d => {
        const b = d.data();
        for (let n=0; n<=9; n++) {
          const r = generateDetails(n);
          if (b.selection === r.resultColor || b.selection === r.resultSize || Number(b.selection) === n) payouts[n] += (b.amount || 0);
        }
      });
      const minPayout = Math.min(...payouts);
      const bestNums = payouts.map((p, i) => p === minPayout ? i : -1).filter(i => i !== -1);
      return generateDetails(bestNums[Math.floor(Math.random() * bestNums.length)]);
    }
  } catch(e) {}
  return generateDetails(Math.floor(Math.random()*10));
};

const settleBets = async (gameType: string, periodId: string, result: any) => {
  if (!dbInstance) {
    console.error('[SETTLE-FAIL] No DB instance available');
    return;
  }
  try {
    console.log(`[SETTLE] Checking bets for ${gameType} ${periodId}`);
    const snap = await dbInstance.collection('bets')
      .where('gameType', '==', gameType)
      .where('periodId', '==', periodId)
      .where('status', '==', 'pending')
      .get();
    
    if (snap.empty) {
      console.log(`[SETTLE] No pending bets found for ${gameType} ${periodId}`);
      return;
    }

    console.log(`[SETTLE] Found ${snap.size} pending bets for ${gameType} ${periodId}`);
    
    const batch = dbInstance.batch();
    const userUpdates = new Map<string, number>();

    snap.docs.forEach(doc => {
      const bet = doc.data();
      let win = false;
      const resNum = result.resultNumber;
      const selection = bet.selection;

      // Win Logic
      if (
        (selection === 'Green' && result.resultColor.includes('Green')) ||
        (selection === 'Red' && result.resultColor.includes('Red')) ||
        (selection === 'Violet' && result.resultColor.includes('Violet')) ||
        (selection === 'Big' && result.resultSize === 'Big') ||
        (selection === 'Small' && result.resultSize === 'Small') ||
        (Number(selection) === resNum)
      ) win = true;

      let mult = 0;
      if (win) {
        if (selection === 'Green') mult = resNum === 5 ? 1.5 : 2;
        else if (selection === 'Red') mult = resNum === 0 ? 1.5 : 2;
        else if (selection === 'Violet') mult = 4.5;
        else if (selection === 'Big' || selection === 'Small') mult = 2;
        else if (Number(selection) === resNum) mult = 9;
      }

      const winAmount = (bet.amount || 0) * mult;
      batch.update(doc.ref, { 
        status: win ? 'win' : 'lost', 
        winAmount: win ? winAmount : 0,
        settledAt: FieldValue.serverTimestamp(),
        resultDetails: result // Store result details in the bet for client-side popups
      });

      if (win && winAmount > 0) {
        const currentWin = userUpdates.get(bet.uid) || 0;
        userUpdates.set(bet.uid, currentWin + winAmount);
      }
    });

    // Update user balances in the same batch
    for (const [uid, amount] of userUpdates.entries()) {
      batch.update(dbInstance.collection('users').doc(uid), {
        balance: FieldValue.increment(amount)
      });
    }

    await batch.commit();
    console.log(`[SETTLE] Successfully committed settlement for ${gameType} ${periodId}`);
  } catch(e: any) {
    console.error(`[SETTLE-ERROR] Failure during settlement for ${gameType} ${periodId}:`, e.message);
  }
};

const startGameScheduler = () => {
  const processed = new Set<string>();
  
  // Also periodically check for "orphan" pending bets from older periods
  setInterval(async () => {
    if (!dbInstance) return;
    try {
      const now = Date.now();
      const olderThan = new Date(now - 30000); // 30 seconds ago
      const snap = await dbInstance.collection('bets')
        .where('status', '==', 'pending')
        .where('createdAt', '<', admin.firestore.Timestamp.fromDate(olderThan))
        .limit(20)
        .get();

      if (!snap.empty) {
        console.log(`[AUTO-SETTLE] Found ${snap.size} orphan pending bets. Attempting to match with history...`);
        for (const doc of snap.docs) {
          const bet = doc.data();
          const gameKey = `${bet.gameType}_${bet.periodId}`;
          
          // Check cache first
          const history = gameHistoryCache.get(bet.gameType) || [];
          const matched = history.find(h => h.periodId === bet.periodId);
          
          if (matched) {
            await settleBets(bet.gameType, bet.periodId, matched);
          } else {
            // Check DB
            const gameDoc = await dbInstance.collection('games').doc(gameKey).get();
            if (gameDoc.exists) {
              await settleBets(bet.gameType, bet.periodId, gameDoc.data());
            }
          }
        }
      }
    } catch (e: any) {}
  }, 15000);

  const loadInitialHistory = async () => {
    if (!dbInstance) return;
    try {
      const snap = await dbInstance.collection('games').orderBy('createdAt', 'desc').limit(2000).get();
      const allGames = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      for (const type of Object.keys(GAME_MODES)) {
        const filtered = allGames.filter((g: any) => g.gameType === type && g.status === 'completed').slice(0, 100);
        if (filtered.length > 0) {
          const jsonHistory = filtered.map((g: any) => ({
            ...g,
            startTime: g.startTime?.toDate?.()?.toISOString() || g.startTime,
            endTime: g.endTime?.toDate?.()?.toISOString() || g.endTime,
            createdAt: g.createdAt?.toDate?.()?.toISOString() || g.createdAt
          }));
          gameHistoryCache.set(type, jsonHistory);
        }
      }
    } catch (e) {}
  };

  loadInitialHistory();

  setInterval(async () => {
    if (!dbInstance) return;
    const now = Date.now();
    for (const [type, dur] of Object.entries(GAME_MODES)) {
      const durMs = (dur as number) * 1000;
      const rIdx = Math.floor(now / durMs);
      const lastRIdx = rIdx - 1;
      const lastDate = new Date(lastRIdx * durMs);
      const dateStr = lastDate.toISOString().slice(0, 10).replace(/-/g, '');
      const dayStart = new Date(lastDate);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayIndex = Math.floor((lastDate.getTime() - dayStart.getTime()) / durMs) + 1;
      
      // Prefix based on game type to ensure total separation
      const typePrefix = type === '30s' ? '1' : type === '1m' ? '2' : type === '3m' ? '3' : '4';
      const lastRId = `${dateStr}${typePrefix}${dayIndex.toString().padStart(4, '0')}`;
      const key = `${type}_${lastRId}`;
      
      if (processed.has(key)) continue;

        try {
          const res = await generateResult(type, lastRId);
          const startTime = new Date(lastRIdx * durMs);
          const endTime = new Date(lastRIdx * durMs + durMs);
          
          console.log(`[SCHEDULER] Generated result for ${type} ${lastRId}: ${res.resultNumber}`);

          // Prepare data for both DB and Cache
          const gameData = { 
            ...res, 
            status: 'completed', 
            periodId: lastRId, 
            gameType: type,
            startTime: startTime, 
            endTime: endTime,
            createdAt: new Date().toISOString() 
          };

          // 1. Update In-Memory Cache IMMEDIATELY so users see the result
          const current = gameHistoryCache.get(type) || [];
          gameHistoryCache.set(type, [gameData, ...current].slice(0, 100));
          console.log(`[CACHE] Updated history for ${type}, count: ${gameHistoryCache.get(type)?.length}`);
          processed.add(key);

          // 2. Attempt Firestore Write (Non-blocking)
          if (dbInstance) {
            try {
              await dbInstance.collection('games').doc(key).set({
                ...gameData,
                startTime: admin.firestore.Timestamp.fromDate(startTime),
                endTime: admin.firestore.Timestamp.fromDate(endTime),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
              console.log(`[DB] Saved game result ${key}`);
            } catch(dbErr: any) {
              console.error(`[DB-SAVE-FAIL] Failed to persist game ${key}:`, dbErr.message);
            }

            // 3. Settle Bets 
            try {
              await settleBets(type, lastRId, res);
            } catch (settleErr: any) {
              console.error(`[SETTLE-INIT-FAIL] Failed to initiate settlement for ${key}:`, settleErr.message);
            }
          }
        } catch (e: any) {
          console.error(`[SCHEDULER-ERROR] ${type}:`, e.message);
        }
    }
  }, 1000);
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Background Init (Non-blocking but critical)
  initFirestore().then(async () => {
    console.log('[BOOT] Firestore Ready. Continuing initialization...');
    await ensureSystemSettings();
    initRazorpay();
    isMysqlEnabled = await checkMysqlConnection();
    startGameScheduler();
    console.log('[BOOT] Game Scheduler Started.');
  }).catch(e => console.error('Background init error:', e));

  // 2. Immediate Health Check & API Routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      firestore: !!dbInstance, 
      firestoreError: lastFirestoreError,
      mysql: isMysqlEnabled,
      configProject: firebaseConfig?.projectId,
      resolvedProject: admin.apps[0]?.options?.projectId || 'N/A',
      numApps: admin.apps.length,
      databaseId: firebaseConfig?.firestoreDatabaseId,
      envProject: process.env.GOOGLE_CLOUD_PROJECT || 'N/A'
    });
  });

  app.get('/api/test/seed-history', async (req, res) => {
    if (!dbInstance) return res.status(503).send('Init...');
    const { startId = '202604220722', count = '50', type = '1m' } = req.query;
    const startIndex = parseInt(startId as string);
    const dateStr = (startId as string).slice(0, 8);
    const durationCount = parseInt(count as string);
    const durationMs = (GAME_MODES[type as keyof typeof GAME_MODES] || 60) * 1000;

    try {
      for (let i = 0; i < durationCount; i++) {
        const currentIndex = startIndex - (durationCount - 1 - i);
        if (currentIndex < 1) continue;
        const periodId = `${dateStr}${currentIndex.toString().padStart(4, '0')}`;
        const key = `${type}_${periodId}`;
        
        const docRef = dbInstance.collection('games').doc(key);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        const resNum = Math.floor(Math.random() * 10);
        const color = resNum === 0 ? 'Red-Violet' : resNum === 5 ? 'Green-Violet' : [1, 3, 7, 9].includes(resNum) ? 'Green' : 'Red';
        const size = resNum >= 5 ? 'Big' : 'Small';
        const dayStart = new Date();
        dayStart.setUTCHours(0, 0, 0, 0);
        const timestamp = new Date(dayStart.getTime() + (currentIndex - 1) * durationMs);

        await docRef.set({
          periodId,
          gameType: type,
          resultNumber: resNum,
          resultColor: color,
          resultSize: size,
          status: 'completed',
          startTime: admin.firestore.Timestamp.fromDate(timestamp),
          endTime: admin.firestore.Timestamp.fromDate(new Date(timestamp.getTime() + durationMs)),
          createdAt: admin.firestore.Timestamp.fromDate(timestamp),
          isSeeded: true
        });
      }
      res.json({ success: true, message: 'Seeded' });
    } catch (e: any) {
      res.status(500).send(e.message);
    }
  });

  app.get('/api/test-write', async (req, res) => {
    if (!dbInstance) return res.send('No DB instance');
    try {
      await dbInstance.collection('_health_').doc('test').set({ time: Date.now() });
      res.send('Write Success');
    } catch (e: any) {
      res.status(500).send(`Write Failed: ${e.message}`);
    }
  });

  app.get('/api/diagnostic', (req, res) => {
    res.json({
      env: process.env.NODE_ENV,
      port: PORT,
      hasFirestore: !!dbInstance,
      hasRazorpay: !!razorpay,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      firebaseConfig: {
        projectId: firebaseConfig?.projectId,
        databaseId: firebaseConfig?.firestoreDatabaseId
      },
      apps: admin.apps.length
    });
  });

  // API Endpoints with Error Handling
  app.get('/api/current-round/:gameType', (req, res) => {
    try {
      const dur = (GAME_MODES as any)[req.params.gameType];
      if (!dur) throw new Error(`Invalid game type: ${req.params.gameType}`);
      
      const now = Date.now(); 
      const durMs = dur * 1000;
      const rIdx = Math.floor(now / durMs);
      const date = new Date(rIdx * durMs);
      
      if (isNaN(date.getTime())) throw new Error('Calculated invalid date');
      
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayIndex = Math.floor((date.getTime() - dayStart.getTime()) / durMs) + 1;
      const typePrefix = req.params.gameType === '30s' ? '1' : req.params.gameType === '1m' ? '2' : req.params.gameType === '3m' ? '3' : '4';
      const roundId = `${dateStr}${typePrefix}${dayIndex.toString().padStart(4, '0')}`;

      res.json({ 
        roundId: roundId, 
        remainingTime: Math.max(0, Math.floor(((rIdx*durMs + durMs) - now) / 1000)),
        serverTime: now
      });
    } catch (e: any) {
      console.error(`[API] current-round error for ${req.params.gameType}:`, e.message);
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/user/:uid', async (req, res) => {
    if (!dbInstance) return res.status(503).json({ error: 'System Initializing' });
    try {
      const user = await dbInstance.collection('users').doc(req.params.uid).get();
      if (!user.exists) return res.status(404).json({ error: 'User not found' });
      res.json(user.data());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/sync-user', async (req, res) => {
    if (!dbInstance) return res.status(503).json({ error: 'System Initializing' });
    const { uid, username, email } = req.body;
    try {
      const userRef = dbInstance.collection('users').doc(uid);
      const snap = await userRef.get();
      const isSuperAdmin = email === 'triloksinghrathore51@gmail.com';
      
      if (!snap.exists) {
        await userRef.set({
          uid, username, email,
          balance: 0,
          totalBets: 0,
          dailyBets: 0,
          requiredTurnover: 0,
          role: isSuperAdmin ? 'admin' : 'user',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else if (isSuperAdmin && snap.data()?.role !== 'admin') {
        // Auto-promote super-admin if they somehow lost the role
        await userRef.update({ role: 'admin' });
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/history/:gameType', async (req, res) => {
    const { gameType } = req.params;
    let results = [...(gameHistoryCache.get(gameType) || [])];

    try {
      if (dbInstance) {
        const snapshot = await dbInstance.collection('games')
          .where('gameType', '==', gameType)
          .where('status', '==', 'completed')
          .orderBy('periodId', 'desc')
          .limit(50)
          .get();

        if (!snapshot.empty) {
          const dbResults = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              startTime: data.startTime && typeof data.startTime.toMillis === 'function' ? data.startTime.toMillis() : data.startTime,
              endTime: data.endTime && typeof data.endTime.toMillis === 'function' ? data.endTime.toMillis() : data.endTime,
              createdAt: data.createdAt && typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : data.createdAt
            };
          });

          // Deduplicate and merge strictly by periodId and gameType
          const merged = new Map();
          [...results, ...dbResults].forEach((item: any) => {
            if (item.gameType === gameType && !merged.has(item.periodId)) {
              merged.set(item.periodId, item);
            }
          });

          results = Array.from(merged.values())
            .sort((a: any, b: any) => b.periodId.localeCompare(a.periodId))
            .slice(0, 100);
            
          gameHistoryCache.set(gameType, results);
        }
      }
    } catch (e: any) {
      console.warn(`[API-HISTORY-WARN] DB fetch failed for ${gameType}:`, e.message);
    }
    res.json(results);
  });

  app.post('/api/bet', async (req, res) => {
    if (!dbInstance) return res.status(503).send('System Initializing...');
    const { uid, amount: reqAmount, selection, gameType, roundId } = req.body;
    
    try {
      const amount = Number(reqAmount);
      if (!uid || isNaN(amount) || amount <= 0 || !selection || !gameType || !roundId) {
        throw new Error('Invalid or missing bet parameters');
      }

      const userRef = dbInstance.collection('users').doc(uid);
      await dbInstance.runTransaction(async (t) => {
        const snap = await t.get(userRef);
        if (!snap.exists) throw new Error('User not found');
        
        const data = snap.data();
        const balance = data?.balance || 0;
        const currentTurnover = data?.requiredTurnover || 0;
        
        if (balance < amount) throw new Error('Insufficient Balance');
        
        const fee = amount * 0.04;
        const netAmount = amount - fee;
        
        // Update user
        t.update(userRef, { 
          balance: FieldValue.increment(-amount),
          totalBets: FieldValue.increment(amount),
          dailyBets: FieldValue.increment(amount),
          requiredTurnover: Math.max(0, currentTurnover - amount),
          updatedAt: FieldValue.serverTimestamp()
        });
        
        // Save bet with ALL fields expected by rules (for consistency)
        const betDoc = dbInstance.collection('bets').doc();
        t.set(betDoc, { 
          uid, 
          amount: amount, 
          periodId: roundId, 
          gameType, 
          selection, 
          multiplier: 1, 
          totalAmount: amount,
          fee,
          netAmount,
          status: 'pending', 
          createdAt: FieldValue.serverTimestamp() 
        });

        // Add transaction record
        const transDoc = dbInstance.collection('transactions').doc();
        t.set(transDoc, {
          uid,
          type: 'bet',
          amount: amount,
          description: `Bet on ${selection} (${gameType})`,
          status: 'completed',
          createdAt: FieldValue.serverTimestamp()
        });
      });
      
      console.log(`[BET] User ${uid} placed bet of ${amount} on ${selection} in ${gameType} ${roundId}`);
      res.json({ success: true });
    } catch(e: any) { 
      console.error(`[BET-ERROR] User ${uid} bet failed:`, e.message);
      res.status(400).send(e.message); 
    }
  });

  // Razorpay Endpoints
  app.post('/api/payment/razorpay/create', async (req, res) => {
    if (!razorpay) return res.status(503).json({ error: 'Razorpay Loading' });
    try {
      const order = await razorpay.orders.create({ amount: Math.round(req.body.amount * 100), currency: 'INR', receipt: `r_${Date.now()}` });
      res.json({ ...order, keyId: process.env.RAZORPAY_KEY_ID });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/payment/razorpay/verify', async (req, res) => {
    if (!razorpay || !dbInstance) return res.status(503).json({ error: 'System Initializing' });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, uid, amount } = req.body;
    
    try {
      const crypto = await import('crypto');
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(body.toString())
        .digest('hex');

      if (expectedSignature === razorpay_signature) {
        const userRef = dbInstance.collection('users').doc(uid);
        await dbInstance.runTransaction(async (t) => {
          t.update(userRef, { 
            balance: admin.firestore.FieldValue.increment(amount),
            totalDeposits: admin.firestore.FieldValue.increment(amount),
            dailyDeposits: admin.firestore.FieldValue.increment(amount)
          });
          const transRef = dbInstance.collection('transactions').doc();
          t.set(transRef, {
            uid,
            type: 'deposit',
            amount,
            status: 'completed',
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: 'Invalid signature' });
      }
    } catch (e: any) {
      console.error('[RAZORPAY] Verify error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 3. Setup Frontend (Vite or Static)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const publicPath = path.join(process.cwd(), 'public');
    
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    
    // Always fallback to public folder for static assets if not found in dist
    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath));
    }
    
    app.get('*', (req, res) => {
      const indexPath = fs.existsSync(path.join(distPath, 'index.html')) 
        ? path.join(distPath, 'index.html')
        : path.join(process.cwd(), 'index.html');
      res.sendFile(indexPath);
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[EXPRESS] Global Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  });

  // 4. Finally, LISTEN
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BOOT] Server is now listening on port ${PORT}`);
  });
}

startServer().catch(console.error);
