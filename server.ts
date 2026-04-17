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

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const dbInstance = getFirestore(firebaseConfig.firestoreDatabaseId);

// Check if MySQL is configured
const isMysqlEnabled = !!process.env.DB_HOST;

async function startServer() {
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

    const generateResult = () => {
      const number = Math.floor(Math.random() * 10);
      let color = '';
      if ([1, 3, 7, 9].includes(number)) color = 'Green';
      else if ([2, 4, 6, 8].includes(number)) color = 'Red';
      else if (number === 0) color = 'Red-Violet';
      else if (number === 5) color = 'Green-Violet';
      const size = number <= 4 ? 'Small' : 'Big';
      return { resultNumber: number, resultColor: color, resultSize: size };
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

            if (isWin) {
              const winAmount = bet.amount * multiplier;
              await query('UPDATE users SET balance = balance + ? WHERE uid = ?', [winAmount, bet.uid]);
              await query('UPDATE bets SET status = "win", win_amount = ? WHERE id = ?', [winAmount, bet.id]);
              await query('INSERT INTO transactions (uid, type, amount, status, description) VALUES (?, "win", ?, "completed", ?)', 
                [bet.uid, winAmount, `Win on ${bet.selection} (Period: ${periodId})`]);
            } else {
              await query('UPDATE bets SET status = "lost" WHERE id = ?', [bet.id]);
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
                const res = generateResult();
                await query('UPDATE game_rounds SET result_number = ?, result_color = ?, result_size = ? WHERE id = ?', 
                  [res.resultNumber, res.resultColor, res.resultSize, round.id]);
              }
              if (remainingTime <= 0 && round.status === 'running') {
                await query('UPDATE game_rounds SET status = "completed" WHERE id = ?', [round.id]);
                if (round.result_number !== null) {
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
                const res = generateResult();
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
      } catch (err) { console.error('Scheduler Error:', err); }
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
        await query('UPDATE users SET balance = balance - ? WHERE uid = ?', [amount, uid]);
        await query('INSERT INTO bets (uid, round_id, game_type, selection, amount, status) VALUES (?, ?, ?, ?, ?, "pending")', [uid, roundId, gameType, selection, amount]);
        await query('INSERT INTO transactions (uid, type, amount, status, description) VALUES (?, "bet", ?, "completed", ?)', [uid, amount, `Bet on ${selection}`]);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: 'Betting failed' }); }
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
