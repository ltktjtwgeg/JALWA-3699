import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const configPath = path.join(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const options: any = {};

if (serviceAccountVar) {
  options.projectId = firebaseConfig.projectId;
  options.credential = admin.credential.cert(JSON.parse(serviceAccountVar));
}

if (!admin.apps.length) {
  admin.initializeApp(options);
}

// Try default project first
const db = getFirestore(admin.apps[0], firebaseConfig.firestoreDatabaseId || undefined);

async function seedHistory(startId: string, count: number, gameType: string = '1m') {
  const dateStr = startId.slice(0, 8);
  const startIndex = parseInt(startId.slice(8));
  const duration = 60; // 1m
  const durationMs = duration * 1000;

  console.log(`Seeding ${count} rounds starting from index ${startIndex} for ${gameType}...`);

  for (let i = 0; i < count; i++) {
    const currentIndex = startIndex - (count - 1 - i);
    if (currentIndex < 1) continue;

    const periodId = `${dateStr}${currentIndex.toString().padStart(4, '0')}`;
    const key = `${gameType}_${periodId}`;
    
    // Check if exists
    const doc = await db.collection('games').doc(key).get();
    if (doc.exists) {
      console.log(`Round ${periodId} already exists, skipping.`);
      continue;
    }

    const resNum = Math.floor(Math.random() * 10);
    const color = resNum === 0 ? 'Red-Violet' : resNum === 5 ? 'Green-Violet' : [1, 3, 7, 9].includes(resNum) ? 'Green' : 'Red';
    const size = resNum >= 5 ? 'Big' : 'Small';

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const timestamp = new Date(dayStart.getTime() + (currentIndex - 1) * durationMs);

    await db.collection('games').doc(key).set({
      periodId,
      gameType,
      resultNumber: resNum,
      resultColor: color,
      resultSize: size,
      status: 'completed',
      startTime: admin.firestore.Timestamp.fromDate(timestamp),
      endTime: admin.firestore.Timestamp.fromDate(new Date(timestamp.getTime() + durationMs)),
      createdAt: admin.firestore.Timestamp.fromDate(timestamp), // Use index time for historical accurate sorting
      isSeeded: true
    });
    console.log(`Seeded ${periodId}`);
  }
}

// User requested to seed multiple modes
const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
const hour = now.getUTCHours();
const min = now.getUTCMinutes();
const startId = `${dateStr}${hour.toString().padStart(2, '0')}${min.toString().padStart(2, '0')}`;

async function runAllSeeds() {
  await seedHistory(startId, 100, '30s');
  await seedHistory(startId, 100, '1m');
  await seedHistory(startId, 100, '3m');
  await seedHistory(startId, 100, '5m');
}

runAllSeeds()
  .then(() => {
    console.log('All seeding complete.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
