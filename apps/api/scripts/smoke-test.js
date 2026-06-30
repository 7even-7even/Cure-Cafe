const { app } = require('../src/app');
const { prisma } = require('../src/config/prisma');

async function request(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${path} failed ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    await request(base, '/health');
    const login = await request(base, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@hfms.test', password: 'Admin@1234' })
    });
    const token = login.data.accessToken;
    const auth = { Authorization: `Bearer ${token}` };
    await request(base, '/api/auth/me', { headers: auth });
    await request(base, '/api/patients', { headers: auth });
    await request(base, '/api/diets/types', { headers: auth });
    await request(base, '/api/meals/kitchen/dashboard', { headers: auth });
    await request(base, '/api/inventory/low-stock', { headers: auth });
    await request(base, '/api/reports/daily-meals', { headers: auth });
    console.log('Smoke test passed. Core APIs are reachable.');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
