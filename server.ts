import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { query } from './src/lib/mysql'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config with path resiliency
let firebaseConfig: any;
try {
  const configPath = fs.existsSync(path.join(__dirname, 'firebase-applet-config.json')) 
    ? path.join(__dirname, 'firebase-applet-config.json')
    : path.join(process.cwd(), 'firebase-applet-config.json');
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('Core Error: Missing firebase-applet-config.json');
  firebaseConfig = { projectId: process.env.FIREBASE_PROJECT_ID };
}

// Initialize Firebase Admin
/**
 * PRODUCTION CHECKLIST FOR HOSTINGER DEPLOYMENT:
 * 1. Database: Update DB_HOST to 'srv2213.hstgr.io' (IP: 31.97.2.1).
 * 2. Domains: Add your domains to Firebase Console > Authentication > Settings > Authorized Domains:
 *    - seashell-tiger-696001.hostingersite.com
 *    - jalwa369.com
 * 3. Secrets: Set FIREBASE_SERVICE_ACCOUNT_JSON in your hosting environment.
 */
if (admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId;
  console.log(`Initializing Firebase Admin with Project: ${projectId}`);
  
  try {
    admin.initializeApp({
      projectId: projectId
    });
  } catch (err) {
    console.error('Firebase Admin Init Error:', err);
  }
}

// Ensure dbInstance is initialized even if databaseId is problematic
let dbInstance: admin.firestore.Firestore;

async function initFirestore() {
  try {
    const envProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const configProjectId = firebaseConfig.projectId;
    const projectId = envProjectId || configProjectId;
    const dbId = firebaseConfig.firestoreDatabaseId || undefined;
    
    console.log(`[DIAGNOSTIC] Env Project: ${envProjectId}, Config Project: ${configProjectId}`);

    // Try the configured database ID first
    try {
      dbInstance = getFirestore(dbId);
      // Canary Check: Try a simple query to see if this DB actually exists
      // If dbId is provided but doesn't exist, this will throw NOT_FOUND
      await dbInstance.collection('health').limit(1).get();
      console.log(`[DIAGNOSTIC] Firestore connected to Project: ${projectId}, Database: ${dbId || '(default)'}`);
    } catch (e: any) {
      const isNotFound = e.code === 5 || e.message?.includes('NOT_FOUND') || e.message?.includes('not found') || e.message?.includes('database id was provided but not found');
      
      if (isNotFound && dbId) {
        console.warn(`[DIAGNOSTIC] Database ${dbId} NOT FOUND. Falling back to (default) database.`);
        dbInstance = getFirestore();
      } else {
        // If it's not a NOT_FOUND error, or we're already on default, throw it
        throw e;
      }
    }
  } catch (err) {
    console.error('Firestore Instance Init Error:', err);
    dbInstance = getFirestore(); // Final fallback to default
  }
}

// Check if MySQL is configured and reachable
let isMysqlEnabled = !!process.env.DB_HOST && !!process.env.DB_USER && !!process.env.DB_NAME;

async function checkMysqlConnection() {
  if (!isMysqlEnabled) return false;
  try {
    const { query: testQuery } = await import('./src/lib/mysql');
    // Add a race to avoid hanging forever on poor connection
    const connectionTest = Promise.race([
      testQuery('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MySQL connection timeout')), 5000))
    ]);
    await connectionTest;
    return true;
  } catch (err) {
    console.error('MySQL Connection Failed. Falling back to Firebase mode.', (err as any).message);
    return false;
  }
}

async function startServer() {
  await initFirestore();
  isMysqlEnabled = await checkMysqlConnection();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (isMysqlEnabled) console.log('MySQL Mode: Enabled');
    else console.log('Firebase Mode: Enabled');
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mode: isMysqlEnabled ? 'mysql' : 'firebase' });
  });

  try {
    app.use(express.json());

    const GAME_MODES = {
      '30s': 30,
      '1m': 60,
      '3m': 180,
      '5m': 300
    };

    const generateDetails = (num: number) => {
      let color = '';
      if ([1, 3, 7, 9].includes(num)) color = 'Green';
      else if ([2, 4, 6, 8].includes(num)) color = 'Red';
      else if (num === 0) color = 'Red-Violet';
      else if (num === 5) color = 'Green-Violet';
      const size = num <= 4 ? 'Small' : 'Big';
      return { resultNumber: num, resultColor: color, resultSize: size };
    };

    const generateResult = async (gameType: string, periodId: string) => {
      try {
        // 1. Check for manual controls first
        const controlsSnap = await dbInstance.collection('game_controls')
          .where('gameType', '==', gameType)
          .where('status', '==', 'pending')
          .limit(10) // Get more and sort in memory if needed
          .get();

        if (!controlsSnap.empty) {
          // Sort in memory to avoid mandatory composite index
          const docs = controlsSnap.docs.sort((a, b) => {
            const aTime = a.data().createdAt?.toMillis() || 0;
            const bTime = b.data().createdAt?.toMillis() || 0;
            return bTime - aTime;
          });
          
          const controlDoc = docs[0];
          const controlData = controlDoc.data();
          const targetNumber = controlData.targetNumber;
          const targetSize = controlData.targetSize;
          
          await controlDoc.ref.update({ status: 'used', processedAt: admin.firestore.FieldValue.serverTimestamp() });

          if (targetNumber !== undefined && targetNumber !== null) return generateDetails(targetNumber);
          if (targetSize === 'Big') {
            const nums = [5, 6, 7, 8, 9];
            return generateDetails(nums[Math.floor(Math.random() * nums.length)]);
          }
          if (targetSize === 'Small') {
            const nums = [0, 1, 2, 3, 4];
            return generateDetails(nums[Math.floor(Math.random() * nums.length)]);
          }
        }

        // 2. Check System Settings
        const settingsSnap = await dbInstance.collection('system_config').doc('settings').get();
        const settings = settingsSnap.data();

        if (settings?.autoProfit) {
          // AUTO PROFIT MODE: Analyze all bets and pick result with least payout
          const betsSnapshot = await dbInstance.collection('bets')
            .where('gameType', '==', gameType)
            .where('periodId', '==', periodId)
            .get();

          const payouts = new Array(10).fill(0);
          betsSnapshot.forEach(doc => {
            const bet = doc.data();
            const amount = bet.totalAmount || (bet.amount * 1) || 0;
            
            for (let n = 0; n <= 9; n++) {
              const res = generateDetails(n);
              let win = false;
              let mult = 0;
              if (bet.selection === 'Green' && res.resultColor.includes('Green')) { win = true; mult = n === 5 ? 1.5 : 2; }
              else if (bet.selection === 'Red' && res.resultColor.includes('Red')) { win = true; mult = n === 0 ? 1.5 : 2; }
              else if (bet.selection === 'Violet' && res.resultColor.includes('Violet')) { win = true; mult = 4.5; }
              else if (bet.selection === 'Big' && res.resultSize === 'Big') { win = true; mult = 2; }
              else if (bet.selection === 'Small' && res.resultSize === 'Small') { win = true; mult = 2; }
              else if (Number(bet.selection) === n) { win = true; mult = 9; }
              
              if (win) payouts[n] += (amount * mult);
            }
          });

          let minPayout = Infinity;
          let bestNumber = Math.floor(Math.random() * 10);
          payouts.forEach((p, n) => {
            if (p < minPayout) {
              minPayout = p;
              bestNumber = n;
            }
          });
          return generateDetails(bestNumber);
        }

        if (settings?.randomMode === false) {
           // If random mode is OFF and no manual/auto profit, handle as fixed (e.g., always 0 or Big)
           // But usually users want random ON.
        }

        // 3. RANDOM MODE (Default)
        return generateDetails(Math.floor(Math.random() * 10));
      } catch (err) {
        console.error('Result Generation Error:', err);
        return generateDetails(Math.floor(Math.random() * 10));
      }
    };

    // Settlement Logic
    const settleBets = async (gameType: string, periodId: string, result: any) => {
      try {
        if (isMysqlEnabled) {
          // MySQL Settlement
          const bets = await query('SELECT * FROM bets WHERE game_type = ? AND round_id = ? AND status = "pending"', [gameType, periodId]) as any[];
          for (const bet of bets) {
            let isWin = false;
            let multiplier = 0;
            const resNum = result.resultNumber;
            const resColor = result.resultColor;
            const resSize = result.resultSize;

            if (bet.selection === 'Green' && resColor.includes('Green')) { isWin = true; multiplier = resNum === 5 ? 1.5 : 2; }
            else if (bet.selection === 'Red' && resColor.includes('Red')) { isWin = true; multiplier = resNum === 0 ? 1.5 : 2; }
            else if (bet.selection === 'Violet' && resColor.includes('Violet')) { isWin = true; multiplier = 4.5; }
            else if (bet.selection === 'Big' && resSize === 'Big') { isWin = true; multiplier = 2; }
            else if (bet.selection === 'Small' && resSize === 'Small') { isWin = true; multiplier = 2; }
            else if (!isNaN(Number(bet.selection)) && Number(bet.selection) === resNum) { isWin = true; multiplier = 9; }

            const winAmount = isWin ? bet.amount * multiplier : 0;
            const status = isWin ? 'win' : 'lost';

            // Update MySQL
            if (isWin) {
              await query('UPDATE users SET balance = balance + ? WHERE uid = ?', [winAmount, bet.uid]);
              await query('UPDATE bets SET status = "win", win_amount = ? WHERE id = ?', [winAmount, bet.id]);
              await query('INSERT INTO transactions (uid, type, amount, status, description) VALUES (?, "win", ?, "completed", ?)', 
                [bet.uid, winAmount, `Win on ${bet.selection} (Period: ${periodId})`]);
            } else {
              await query('UPDATE bets SET status = "lost" WHERE id = ?', [bet.id]);
            }

            // Real-time Sync with Firestore
            try {
              const userRef = dbInstance.collection('users').doc(bet.uid);
              if (isWin) {
                await userRef.update({ balance: admin.firestore.FieldValue.increment(winAmount) });
              }

              // Update the corresponding Firestore bet if it exists
              const firestoreBets = await dbInstance.collection('bets')
                .where('uid', '==', bet.uid)
                .where('periodId', '==', periodId)
                .where('selection', '==', bet.selection)
                .where('status', '==', 'pending')
                .limit(1)
                .get();

              if (!firestoreBets.empty) {
                await firestoreBets.docs[0].ref.update({ status, winAmount });
              }
            } catch (fsErr) {
              console.error('Firestore sync error during settlement:', fsErr);
            }
          }
        } else {
          // Firebase Settlement
          const betsSnapshot = await dbInstance.collection('bets')
            .where('gameType', '==', gameType)
            .where('periodId', '==', periodId)
            .where('status', '==', 'pending')
            .get();

          for (const betDoc of betsSnapshot.docs) {
            const bet = betDoc.data();
            let isWin = false;
            let multiplier = 0;
            const resNum = result.resultNumber;
            const resColor = result.resultColor;
            const resSize = result.resultSize;

            if (bet.selection === 'Green' && resColor.includes('Green')) { isWin = true; multiplier = resNum === 5 ? 1.5 : 2; }
            else if (bet.selection === 'Red' && resColor.includes('Red')) { isWin = true; multiplier = resNum === 0 ? 1.5 : 2; }
            else if (bet.selection === 'Violet' && resColor.includes('Violet')) { isWin = true; multiplier = 4.5; }
            else if (bet.selection === 'Big' && resSize === 'Big') { isWin = true; multiplier = 2; }
            else if (bet.selection === 'Small' && resSize === 'Small') { isWin = true; multiplier = 2; }
            else if (!isNaN(Number(bet.selection)) && Number(bet.selection) === resNum) { isWin = true; multiplier = 9; }

            if (isWin) {
              const winAmount = bet.netAmount * multiplier;
              await dbInstance.runTransaction(async (t) => {
                const userRef = dbInstance.collection('users').doc(bet.uid);
                const userSnap = await t.get(userRef);
                if (userSnap.exists) {
                  const userData = userSnap.data();
                  const currentBalance = userData?.balance || 0;
                  t.update(userRef, { balance: currentBalance + winAmount });
                }
                t.update(betDoc.ref, { status: 'win', winAmount });
                t.set(dbInstance.collection('transactions').doc(), { 
                  uid: bet.uid, 
                  type: 'win', 
                  amount: winAmount, 
                  status: 'completed', 
                  description: `Win on ${bet.selection} (Period: ${periodId})`, 
                  createdAt: admin.firestore.FieldValue.serverTimestamp() 
                });
              });
            } else {
              await betDoc.ref.update({ status: 'lost', winAmount: 0 });
            }
          }
        }
      } catch (err) { console.error('Settlement Error:', err); }
    };

    // Round Scheduler
    setInterval(async () => {
      try {
        const now = Date.now();
        for (const [type, duration] of Object.entries(GAME_MODES)) {
          const durationSeconds = duration as number;
          const durationMs = durationSeconds * 1000;
          const roundIndex = Math.floor(now / durationMs);
          const startTime = roundIndex * durationMs;
          const endTime = startTime + durationMs;
          
          const date = new Date(startTime);
          const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
          const roundId = `${dateStr}${roundIndex}`;
          
          const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));

          if (isMysqlEnabled) {
            const [rows] = await query('SELECT * FROM game_rounds WHERE round_id = ? AND game_type = ?', [roundId, type]) as any;
            if (!rows || rows.length === 0) {
              await query('INSERT INTO game_rounds (round_id, game_type, start_time, end_time, status) VALUES (?, ?, ?, ?, "running")', 
                [roundId, type, new Date(startTime), new Date(endTime)]);
            } else {
              const round = rows[0];
              if (remainingTime <= 5 && !round.result_number && round.status === 'running') {
                const res = await generateResult(type, roundId);
                await query('UPDATE game_rounds SET result_number = ?, result_color = ?, result_size = ? WHERE id = ?', 
                  [res.resultNumber, res.resultColor, res.resultSize, round.id]);
              }
              if (remainingTime <= 0 && round.status === 'running') {
                await query('UPDATE game_rounds SET status = "completed" WHERE id = ?', [round.id]);
                
                // Sync Completed Round to Firestore for History
                if (round.result_number !== null) {
                  try {
                    await dbInstance.collection('games').doc(`${type}_${roundId}`).set({
                      periodId: roundId,
                      gameType: type,
                      resultNumber: round.result_number,
                      resultColor: round.result_color,
                      resultSize: round.result_size,
                      status: 'completed',
                      createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                  } catch (fsErr) {
                    console.error('Firestore game sync error:', fsErr);
                  }

                  await settleBets(type, roundId, { 
                    resultNumber: round.result_number, 
                    resultColor: round.result_color, 
                    resultSize: round.result_size 
                  });
                }
              }
            }
          } else {
            const roundRef = dbInstance.collection('games').doc(`${type}_${roundId}`);
            const doc = await roundRef.get();
            if (!doc.exists) {
              await roundRef.set({ 
                periodId: roundId, 
                gameType: type, 
                startTime: admin.firestore.Timestamp.fromMillis(startTime), 
                endTime: admin.firestore.Timestamp.fromMillis(endTime), 
                status: 'running', 
                createdAt: admin.firestore.FieldValue.serverTimestamp() 
              });
            } else {
              const data = doc.data();
              if (remainingTime <= 5 && !data?.resultNumber && data?.status === 'running') {
                const res = await generateResult(type, roundId);
                await roundRef.update({ 
                  resultNumber: res.resultNumber,
                  resultColor: res.resultColor,
                  resultSize: res.resultSize
                });
              }
              if (remainingTime <= 0 && data?.status === 'running') {
                await roundRef.update({ status: 'completed' });
                if (data?.resultNumber !== undefined) {
                  await settleBets(type, roundId, { 
                    resultNumber: data.resultNumber, 
                    resultColor: data.resultColor, 
                    resultSize: data.resultSize 
                  });
                }
              }
            }
          }
        }
      } catch (err: any) { 
        console.error('Scheduler Error Details:', {
          message: err.message,
          code: err.code,
          details: err.details,
          stack: err.stack
        }); 
      }
    }, 500);

    // API Endpoints
    app.get('/api/current-round/:gameType', async (req, res) => {
      const { gameType } = req.params;
      const duration = (GAME_MODES as any)[gameType];
      if (!duration) return res.status(400).json({ error: 'Invalid game type' });
      const now = Date.now();
      const roundIndex = Math.floor(now / (duration * 1000));
      const startTime = roundIndex * (duration * 1000);
      const endTime = startTime + (duration * 1000);
      res.json({ roundId: `${new Date(startTime).toISOString().slice(0, 10).replace(/-/g, '')}${roundIndex}`, remainingTime: Math.max(0, Math.floor((endTime - now) / 1000)), serverTime: now, endTime });
    });

    // User Balance API (For MySQL)
    app.get('/api/user/:uid', async (req, res) => {
      if (!isMysqlEnabled) return res.status(400).json({ error: 'MySQL not enabled' });
      const [rows] = await query('SELECT * FROM users WHERE uid = ?', [req.params.uid]) as any;
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(rows[0]);
    });

    // Place Bet API (For MySQL)
    app.post('/api/bet', async (req, res) => {
      if (!isMysqlEnabled) return res.status(400).json({ error: 'MySQL not enabled' });
      const { uid, roundId, gameType, selection, amount } = req.body;
      try {
        const [userRows] = await query('SELECT balance FROM users WHERE uid = ?', [uid]) as any;
        if (!userRows || userRows[0].balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
        
        // Update MySQL
        await query('UPDATE users SET balance = balance - ? WHERE uid = ?', [amount, uid]);
        const [betResult] = await query('INSERT INTO bets (uid, round_id, game_type, selection, amount, status) VALUES (?, ?, ?, ?, ?, "pending")', [uid, roundId, gameType, selection, amount]) as any;
        await query('INSERT INTO transactions (uid, type, amount, status, description) VALUES (?, "bet", ?, "completed", ?)', [uid, amount, `Bet on ${selection}`]);

        // Sync with Firestore for real-time updates
        const userRef = dbInstance.collection('users').doc(uid);
        const userDoc = await userRef.get();
        const currentTurnover = userDoc.data()?.requiredTurnover || 0;

        await userRef.update({
          balance: admin.firestore.FieldValue.increment(-amount),
          totalBets: admin.firestore.FieldValue.increment(amount),
          dailyBets: admin.firestore.FieldValue.increment(amount),
          requiredTurnover: Math.max(0, currentTurnover - amount)
        });

        // Add bet to Firestore for real-time history
        await dbInstance.collection('bets').add({
          uid,
          periodId: roundId,
          gameType,
          selection,
          amount,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          mysqlId: betResult.insertId // Link back if needed
        });

        res.json({ success: true });
      } catch (err) { 
        console.error('Betting failed:', err);
        res.status(500).json({ error: 'Betting failed' }); 
      }
    });

    // Sync User API (For MySQL)
    app.post('/api/sync-user', async (req, res) => {
      if (!isMysqlEnabled) return res.status(400).json({ error: 'MySQL not enabled' });
      const { uid, username, email } = req.body;
      try {
        const [rows] = await query('SELECT * FROM users WHERE uid = ?', [uid]) as any;
        if (!rows || rows.length === 0) {
          await query('INSERT INTO users (uid, username, email, balance) VALUES (?, ?, ?, 0)', [uid, username, email]);
          return res.json({ success: true, message: 'User created' });
        }
        res.json({ success: true, message: 'User exists' });
      } catch (err) { res.status(500).json({ error: 'Sync failed' }); }
    });

    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    }
  } catch (error) { console.error('Server Init Error:', error); }
}

startServer().catch(console.error);
