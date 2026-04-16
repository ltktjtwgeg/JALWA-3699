import { auth } from '../firebase';

const API_BASE = '/api';

export async function syncUser(uid: string, username: string, email: string) {
  try {
    const response = await fetch(`${API_BASE}/sync-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, username, email })
    });
    return await response.json();
  } catch (error) {
    console.error('Error syncing user:', error);
    return null;
  }
}

export async function getMySQLUser(uid: string) {
  try {
    const response = await fetch(`${API_BASE}/user/${uid}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching MySQL user:', error);
    return null;
  }
}

export async function placeMySQLBet(betData: {
  uid: string;
  roundId: string;
  gameType: string;
  selection: string;
  amount: number;
}) {
  try {
    const response = await fetch(`${API_BASE}/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(betData)
    });
    return await response.json();
  } catch (error) {
    console.error('Error placing MySQL bet:', error);
    return { error: 'Connection failed' };
  }
}

export async function getCurrentRound(gameType: string) {
  try {
    const response = await fetch(`${API_BASE}/current-round/${gameType}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching current round:', error);
    return null;
  }
}
