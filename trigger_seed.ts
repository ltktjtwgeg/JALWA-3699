async function main() {
  for (let i = 0; i < 10; i++) {
    console.log(`Attempt ${i+1}...`);
    try {
      const res = await fetch('http://localhost:3000/api/test/seed-history?startId=202604220722&count=50&type=1m');
      const text = await res.text();
      console.log('Status:', res.status, 'Body:', text);
      if (res.ok) break;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 10000));
  }
}
main();
