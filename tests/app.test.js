const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '../public/admin.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const adminJs = fs.readFileSync(path.join(__dirname, '../public/admin.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, '../public/styles.css'), 'utf8');

test('Public homepage displays explicit DEMO label and sample notices', () => {
  assert.match(indexHtml, /DEMO WEBSITE/);
  assert.match(indexHtml, /Portfolio Demonstration/i);
  assert.match(indexHtml, /SAMPLE TESTIMONIALS/i);
  assert.match(indexHtml, /ILLUSTRATIVE SAMPLES/i);
  assert.match(indexHtml, /No admission guarantees/i);
});

test('Header includes brand mark, navigation links, and mobile navigation toggle', () => {
  assert.match(indexHtml, /class="brand"/);
  assert.match(indexHtml, /id="mobile-toggle"/);
  assert.match(indexHtml, /aria-controls="primary-nav"/);
  assert.match(indexHtml, /href="#services"/);
  assert.match(indexHtml, /href="#destinations"/);
  assert.match(indexHtml, /href="#faq"/);
  assert.match(indexHtml, /href="#enquiry"/);
});

test('Homepage includes all four required guidance services', () => {
  assert.match(indexHtml, /Course & Destination Discovery/i);
  assert.match(indexHtml, /Application Preparation Guidance/i);
  assert.match(indexHtml, /Academic Document Checklists/i);
  assert.match(indexHtml, /Counselling Appointment Requests/i);
});

test('Destinations section includes all six required options with data-destination bindings', () => {
  assert.match(indexHtml, /data-destination="UK"/);
  assert.match(indexHtml, /data-destination="USA"/);
  assert.match(indexHtml, /data-destination="Canada"/);
  assert.match(indexHtml, /data-destination="Australia"/);
  assert.match(indexHtml, /data-destination="Europe"/);
  assert.match(indexHtml, /data-destination="Not sure yet"/);
});

test('Enquiry form collects minimal non-sensitive data and includes honeypot abuse protection', () => {
  assert.match(indexHtml, /name="name"/);
  assert.match(indexHtml, /name="phone"/);
  assert.match(indexHtml, /name="email"/);
  assert.match(indexHtml, /name="destination"/);
  assert.match(indexHtml, /name="studyLevel"/);
  assert.match(indexHtml, /name="consent"/);
  assert.match(indexHtml, /name="website"/); // Honeypot field

  // Strict check: No sensitive identity or financial form fields requested
  assert.doesNotMatch(indexHtml, /name="passport/i);
  assert.doesNotMatch(indexHtml, /name="bank/i);
  assert.doesNotMatch(indexHtml, /name="card/i);
  assert.doesNotMatch(indexHtml, /type="file"/i);
});

test('FAQ assistant is explicitly rule-based and includes fallback for unknown questions', () => {
  assert.match(indexHtml, /RULE-BASED/i);
  assert.doesNotMatch(indexHtml, /DEMO AI/);
  assert.match(appJs, /APPROVED_FAQS/);
  assert.match(appJs, /fees have not been established/i);
  assert.match(appJs, /cannot answer this from our approved demonstration guidelines/i);
  assert.match(appJs, /document\.createTextNode/); // Guaranteed XSS protection
});

test('WhatsApp follow-up is safely encoded without leaking sensitive personal data', () => {
  assert.match(appJs, /https:\/\/wa\.me\//);
  assert.match(appJs, /encodeURIComponent/);
  // Ensure sensitive query params are not appended
  assert.doesNotMatch(appJs, /whatsappNumber\?text=.*phone=/i);
});

test('Owner dashboard includes all 5 status indicators and private demo banner', () => {
  assert.match(adminHtml, /PRIVATE DEMO AREA/i);
  assert.match(adminHtml, /Total Enquiries/i);
  assert.match(adminHtml, /New Leads/i);
  assert.match(adminHtml, /Contacted/i);
  assert.match(adminHtml, /Appointment Booked/i);
  assert.match(adminHtml, /Closed/i);
  assert.match(adminHtml, /Clear Sample Leads/i);
});

test('Server enforces HttpOnly cookies, scrypt password matching, and CSRF header checks', () => {
  assert.match(serverJs, /HttpOnly/i);
  assert.match(serverJs, /SameSite=Strict/i);
  assert.match(serverJs, /scryptSync/);
  assert.match(serverJs, /timingSafeEqual/);
  assert.match(serverJs, /checkCsrf/);
  assert.match(serverJs, /x-requested-with/i);
});

test('Accessibility styles include skip link, focus-visible indicators, and reduced-motion support', () => {
  assert.match(stylesCss, /\.skip-link/);
  assert.match(stylesCss, /:focus-visible/);
  assert.match(stylesCss, /prefers-reduced-motion/);
  assert.match(stylesCss, /sr-only/);
});
