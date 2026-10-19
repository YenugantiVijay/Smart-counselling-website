const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

// Set up test credentials and isolated test DB before requiring server
const TEST_SALT = 'test_salt_1234567890abcdef';
const TEST_PASSWORD = 'TestOwnerPassword2026!';
const TEST_HASH = crypto.scryptSync(TEST_PASSWORD, TEST_SALT, 64).toString('hex');
const TEST_SECRET = 'test_session_secret_very_long_and_secure_value_12345';
const TEST_DB_PATH = path.join(__dirname, 'test_enquiries.sqlite');

process.env.ADMIN_USERNAME = 'testowner';
process.env.ADMIN_PASSWORD_SALT = TEST_SALT;
process.env.ADMIN_PASSWORD_HASH = TEST_HASH;
process.env.SESSION_SECRET = TEST_SECRET;
process.env.WHATSAPP_NUMBER = '919876543210';
process.env.DB_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Remove any existing test DB file
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

const { app, db } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  await new Promise(resolve => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }
});

// Helper for fetch requests
async function req(pathName, options = {}) {
  const url = `${baseUrl}${pathName}`;
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, headers: response.headers, data };
}

test('1. Health check returns ok and demo status', async () => {
  const res = await req('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.ok, true);
  assert.equal(res.data.demo, true);
});

test('2. Valid enquiry submission stores record and returns 201', async () => {
  const res = await req('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Verma',
      phone: '+91 98765 43210',
      email: 'rohan.test@example.com',
      destination: 'UK',
      studyLevel: 'Postgraduate',
      message: 'Looking for computer science MSc programmes.',
      consent: true
    })
  });

  assert.equal(res.status, 201);
  assert.equal(res.data.success, true);
  assert.ok(res.data.id > 0);
  assert.match(res.data.message, /saved/i);
});

test('3. Rejects enquiry with missing required fields', async () => {
  const res = await req('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'incomplete@example.com'
    })
  });

  assert.equal(res.status, 400);
  assert.ok(res.data.errors);
  assert.ok(res.data.errors.name);
  assert.ok(res.data.errors.phone);
  assert.ok(res.data.errors.destination);
  assert.ok(res.data.errors.studyLevel);
  assert.ok(res.data.errors.consent);
});

test('4. Rejects enquiry with invalid phone number', async () => {
  const res = await req('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Patel',
      phone: '123-abc-not-a-number',
      destination: 'Canada',
      studyLevel: 'Undergraduate',
      consent: true
    })
  });

  assert.equal(res.status, 400);
  assert.ok(res.data.errors.phone);
});

test('5. Rejects enquiry with invalid email format', async () => {
  const res = await req('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Amit Kumar',
      phone: '+91 91234 56789',
      email: 'invalid-email-address',
      destination: 'USA',
      studyLevel: 'Undergraduate',
      consent: true
    })
  });

  assert.equal(res.status, 400);
  assert.ok(res.data.errors.email);
});

test('6. Rejects enquiry with invalid destination', async () => {
  const res = await req('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ananya Sen',
      phone: '+91 91234 56789',
      destination: 'Mars University',
      studyLevel: 'Undergraduate',
      consent: true
    })
  });

  assert.equal(res.status, 400);
  assert.ok(res.data.errors.destination);
});

test('7. Rejects enquiry with invalid study level', async () => {
  const res = await req('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ananya Sen',
      phone: '+91 91234 56789',
      destination: 'Australia',
      studyLevel: 'Elementary School',
      consent: true
    })
  });

  assert.equal(res.status, 400);
  assert.ok(res.data.errors.studyLevel);
});

test('8. Rejects spam submissions via honeypot field', async () => {
  const res = await req('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Spam Bot',
      phone: '+91 98765 00000',
      destination: 'UK',
      studyLevel: 'Postgraduate',
      website: 'http://spam.example.com',
      consent: true
    })
  });

  assert.equal(res.status, 400);
  assert.match(res.data.error, /unable to process/i);
});

test('9. Unauthenticated request to /api/admin/enquiries returns 401', async () => {
  const res = await req('/api/admin/enquiries');
  assert.equal(res.status, 401);
  assert.match(res.data.error, /sign in/i);
});

test('10. Invalid admin login credentials return 401', async () => {
  const res = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testowner',
      password: 'wrong-password-attempt'
    })
  });

  assert.equal(res.status, 401);
  assert.match(res.data.error, /failed/i);
});

test('11. Authenticated login sets HttpOnly, SameSite=Strict session cookie', async () => {
  const res = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testowner',
      password: TEST_PASSWORD
    })
  });

  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);

  const cookie = res.headers.get('set-cookie');
  assert.ok(cookie);
  assert.match(cookie, /sc_demo_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
});

test('12. Authenticated session retrieves enquiries and 5-state metrics', async () => {
  // Login first to get cookie
  const loginRes = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testowner', password: TEST_PASSWORD })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  const res = await req('/api/admin/enquiries', {
    headers: { 'Cookie': cookie }
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data.enquiries));
  assert.ok(res.data.enquiries.length > 0);
  assert.ok(res.data.stats);
  assert.ok('total' in res.data.stats);
  assert.ok('newCount' in res.data.stats);
  assert.ok('contactedCount' in res.data.stats);
  assert.ok('appointmentBookedCount' in res.data.stats);
  assert.ok('closedCount' in res.data.stats);
});

test('13. Authenticated status update changes enquiry state', async () => {
  // Submit an enquiry to update
  const createRes = await req('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Status Test Student',
      phone: '+91 99999 11111',
      destination: 'Europe',
      studyLevel: 'Postgraduate',
      consent: true
    })
  });
  const enquiryId = createRes.data.id;

  // Login
  const loginRes = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testowner', password: TEST_PASSWORD })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // Update status to Contacted
  const updateRes = await req(`/api/admin/enquiries/${enquiryId}`, {
    method: 'PATCH',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({ status: 'Contacted' })
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.success, true);
  assert.equal(updateRes.data.status, 'Contacted');
});

test('14. Updating with invalid status value returns 400', async () => {
  const loginRes = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testowner', password: TEST_PASSWORD })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  const updateRes = await req('/api/admin/enquiries/1', {
    method: 'PATCH',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({ status: 'InvalidStatus' })
  });

  assert.equal(updateRes.status, 400);
});

test('15. Updating non-existent enquiry returns 404', async () => {
  const loginRes = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testowner', password: TEST_PASSWORD })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  const updateRes = await req('/api/admin/enquiries/999999', {
    method: 'PATCH',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({ status: 'Closed' })
  });

  assert.equal(updateRes.status, 404);
});

test('16. Logout invalidates session token', async () => {
  const loginRes = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testowner', password: TEST_PASSWORD })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // Logout
  const logoutRes = await req('/api/admin/logout', {
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  assert.equal(logoutRes.status, 200);

  // Subsequent check should fail with 401
  const afterRes = await req('/api/admin/enquiries', {
    headers: { 'Cookie': cookie }
  });
  assert.equal(afterRes.status, 401);
});

test('17. SQLite persistence across database instance reload', async () => {
  const { createDatabase } = require('../db');
  // Connect to the same file database and verify saved records exist
  const freshDb = createDatabase(TEST_DB_PATH);
  const rows = freshDb.prepare('SELECT * FROM enquiries WHERE name = ?').all('Rohan Verma');
  assert.ok(rows.length >= 1);
  assert.equal(rows[0].destination, 'UK');
  assert.equal(rows[0].study_level, 'Postgraduate');
});
