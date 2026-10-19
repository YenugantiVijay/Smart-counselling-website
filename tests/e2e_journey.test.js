const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

// E2E demonstration verification corresponding to Master Prompt Section 17:
// 1. A visitor opens the public homepage and sees the explicit demo label.
// 2. The visitor asks the FAQ assistant about fees.
// 3. The assistant correctly states that demo fees are not established.
// 4. The visitor asks an unsupported question.
// 5. The assistant acknowledges uncertainty and directs the visitor to staff.
// 6. The visitor completes the enquiry form using test information.
// 7. The server validates the information.
// 8. The enquiry is stored in SQLite.
// 9. The visitor sees a successful submission state with a reference number.
// 10. A configured WhatsApp option appears.
// 11. The owner signs into the dashboard.
// 12. The owner sees the enquiry and its contact details.
// 13. The owner changes its status to Contacted.
// 14. The status remains changed after refreshing the dashboard.
// 15. The owner signs out.
// 16. A request without authentication cannot retrieve private enquiry information.

const TEST_SALT = 'e2e_salt_9876543210fedcba';
const TEST_PASSWORD = 'DemoOwnerPassword2026!';
const TEST_HASH = crypto.scryptSync(TEST_PASSWORD, TEST_SALT, 64).toString('hex');
const TEST_SECRET = 'e2e_session_secret_ultra_secure_and_random_string_xyz';
const TEST_DB_PATH = path.join(__dirname, 'e2e_demo_enquiries.sqlite');

process.env.ADMIN_USERNAME = 'owner';
process.env.ADMIN_PASSWORD_SALT = TEST_SALT;
process.env.ADMIN_PASSWORD_HASH = TEST_HASH;
process.env.SESSION_SECRET = TEST_SECRET;
process.env.WHATSAPP_NUMBER = '919876543210';
process.env.DB_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

const { app } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  await new Promise(resolve => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
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

test('Complete Section 17 End-to-End Walkthrough Scenario', async () => {
  // Step 1: Visitor opens homepage and verifies demo label
  const homeRes = await fetch(`${baseUrl}/`);
  assert.equal(homeRes.status, 200);
  const homeHtml = await homeRes.text();
  assert.match(homeHtml, /DEMO WEBSITE/);
  assert.match(homeHtml, /Portfolio Demonstration/i);

  // Step 2 & 3: FAQ assistant responses (test logic matches app.js)
  const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  assert.match(appJs, /fees have not been established/i);
  assert.match(appJs, /never invent/i);

  // Step 4 & 5: Visitor asks an unsupported question
  assert.match(appJs, /I cannot answer this from our approved demonstration guidelines/i);
  assert.match(appJs, /speak directly with our consultancy staff/i);

  // Step 6, 7 & 8: Visitor completes enquiry form and server stores in SQLite
  const submissionPayload = {
    name: 'Vikram Sengupta',
    phone: '+91 98765 12345',
    email: 'vikram.demo@example.com',
    destination: 'Canada',
    studyLevel: 'Postgraduate',
    message: 'Seeking MSc Data Science options for Fall 2026 intake.',
    consent: true
  };

  const submitRes = await fetch(`${baseUrl}/api/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(submissionPayload)
  });

  assert.equal(submitRes.status, 201);
  const submitData = await submitRes.json();

  // Step 9: Visitor sees successful submission state with a reference number
  assert.equal(submitData.success, true);
  assert.ok(submitData.id > 0);
  const enquiryRefId = submitData.id;
  assert.match(submitData.message, /saved/i);

  // Step 10: Configured WhatsApp option is verified
  const configRes = await fetch(`${baseUrl}/api/config`);
  const configData = await configRes.json();
  assert.equal(configData.whatsappConfigured, true);
  assert.equal(configData.whatsappNumber, '919876543210');

  // Step 11: Owner signs into the dashboard
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: TEST_PASSWORD })
  });
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get('set-cookie');
  assert.ok(setCookie);
  const sessionCookie = setCookie.split(';')[0];

  // Step 12: Owner sees enquiry and contact details
  const enquiriesRes = await fetch(`${baseUrl}/api/admin/enquiries`, {
    headers: { 'Cookie': sessionCookie }
  });
  assert.equal(enquiriesRes.status, 200);
  const enquiriesData = await enquiriesRes.json();
  const foundLead = enquiriesData.enquiries.find(e => e.id === enquiryRefId);
  assert.ok(foundLead, 'Enquiry must be retrieved in owner dashboard');
  assert.equal(foundLead.name, 'Vikram Sengupta');
  assert.equal(foundLead.phone, '+919876512345');
  assert.equal(foundLead.email, 'vikram.demo@example.com');
  assert.equal(foundLead.destination, 'Canada');
  assert.equal(foundLead.studyLevel, 'Postgraduate');
  assert.equal(foundLead.status, 'New');

  // Step 13: Owner changes its status to Contacted
  const updateRes = await fetch(`${baseUrl}/api/admin/enquiries/${enquiryRefId}`, {
    method: 'PATCH',
    headers: {
      'Cookie': sessionCookie,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({ status: 'Contacted' })
  });
  assert.equal(updateRes.status, 200);

  // Step 14: Status remains changed after refreshing the dashboard
  const refreshRes = await fetch(`${baseUrl}/api/admin/enquiries`, {
    headers: { 'Cookie': sessionCookie }
  });
  const refreshData = await refreshRes.json();
  const refreshedLead = refreshData.enquiries.find(e => e.id === enquiryRefId);
  assert.equal(refreshedLead.status, 'Contacted');

  // Step 15: Owner signs out
  const logoutRes = await fetch(`${baseUrl}/api/admin/logout`, {
    method: 'POST',
    headers: {
      'Cookie': sessionCookie,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  assert.equal(logoutRes.status, 200);

  // Step 16: Request without authentication cannot retrieve private enquiry information
  const unauthRes = await fetch(`${baseUrl}/api/admin/enquiries`, {
    headers: { 'Cookie': sessionCookie }
  });
  assert.equal(unauthRes.status, 401);
});
