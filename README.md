# Smart Counselling Website — Education Consultancy Demo

A fictional, conversion-optimised demonstration website engineered to showcase modern web development capabilities for education consultancies and local professional businesses.

This project demonstrates a complete student inquiry and staff follow-up workflow:
1. High-impact, conversion-focused public homepage with study destinations, service cards, and transparent principles.
2. Rule-based FAQ Assistant answering questions from an approved knowledge base without hallucinating prices or making outcome guarantees.
3. Accessible, validated Smart Enquiry Form with bot protection and SQLite persistence.
4. Secure Owner Dashboard (`/admin.html`) featuring authenticated lead management, 5-stage status transitions, and data privacy safeguards.
5. WhatsApp and notification hand-off architecture.

---

## 1. Demo Transparency & Ethical Boundaries

- **Fictional Showcase**: All business names, testimonials, student profiles, and example leads are illustrative placeholders.
- **Explicit Demo Labels**: The public website displays a prominent **"DEMO WEBSITE"** banner, and the administration area is labeled **"PRIVATE DEMO AREA"**.
- **No False Claims**: The website does not invent real university accreditations, admission partnerships, scholarship awards, or visa guarantees.
- **Privacy By Design**: The enquiry form requests only basic contact information and study intent. It never requests passport numbers, banking records, or document uploads.

---

## 2. Technology Stack & Architecture

- **Frontend**: Semantic HTML5, Vanilla CSS (custom design system, responsive down to 360px), and Vanilla JavaScript (zero bloated frontend frameworks).
- **Backend**: Node.js & Express with security headers (`helmet`), strict JSON body limits (12kb), and IP rate limiting (`express-rate-limit`).
- **Database**: SQLite with persistent storage in `data/enquiries.sqlite`. Leverages Node's built-in `node:sqlite` (Node 22+) with fallback to `better-sqlite3`, avoiding native C++ build tool dependencies.
- **Security & Authentication**: Server-side authentication using `crypto.scrypt` password hashing, timing-safe equality checks, signed session tokens, `HttpOnly` and `SameSite=Strict` cookies, and custom header CSRF protection.

---

## 3. Quick Start (Local Development)

### Prerequisites
- Node.js version 20 or newer (tested on Node 22 and Node 26)
- npm

### Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Generate Owner Credentials & Environment Configuration:**
   Run the interactive helper script to generate a secure password hash, unique salt, and cryptographic session secret:
   ```bash
   node scripts/setup-owner.js "YourSecurePasswordHere"
   ```

   Copy the generated lines into a new `.env` file (or copy `.env.example` to `.env` and fill in the values):
   ```env
   PORT=3000
   ADMIN_USERNAME=owner
   ADMIN_PASSWORD_SALT=<generated_salt>
   ADMIN_PASSWORD_HASH=<generated_hash>
   SESSION_SECRET=<generated_secret>
   WHATSAPP_NUMBER=919876543210
   OWNER_NOTIFICATION_EMAIL=
   ```

3. **Start the Application:**
   ```bash
   npm start
   ```

   The application will start on `http://localhost:3000`.
   - **Public Homepage**: [http://localhost:3000/](http://localhost:3000/)
   - **Owner Dashboard**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
   - **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## 4. Client Demonstration Walkthrough Script

Use this step-by-step walkthrough when presenting the website to prospective clients (e.g. education consultancies):

1. **Brand Identity & Transparency (Homepage)**:
   - Open `http://localhost:3000`. Point out the refined color palette (forest green, warm ivory, amber accents), the "DEMO WEBSITE" banner, and the clear value proposition.
   - Explain how the design establishes trust immediately without making unrealistic outcome promises.

2. **Interactive Destination Selection**:
   - Scroll to **"Popular Destinations"** and click on the **"Canada"** or **"UK"** card.
   - Show how it smoothly scrolls to the Enquiry Form and automatically pre-selects that destination in the dropdown.

3. **Approved Knowledge Base FAQ Assistant**:
   - Scroll to the **FAQ Assistant** section.
   - Click the suggested question **"What are your fees?"**: Show that the assistant transparently explains that fees are not arbitrary and must be confirmed with staff.
   - Type an unsupported question (e.g. *"Can you guarantee me a visa or scholarship at Oxford?"*): Demonstrate how the assistant acknowledges its boundaries and directs the user to talk to human staff.

4. **Smart Enquiry Submission**:
   - Fill in test information:
     - Name: `Aditya Roy`
     - Phone: `+91 98765 43210`
     - Email: `aditya.demo@example.com`
     - Destination: `Canada`
     - Study Level: `Postgraduate`
     - Check the mandatory consent box.
   - Click **"Send Enquiry"**.
   - Show the confirmation panel with the generated Reference ID (`#3`), followed by the **"Continue on WhatsApp"** button.
   - Click the WhatsApp button to show the pre-formatted, privacy-conscious message containing the reference number.

5. **Owner CRM Dashboard**:
   - Navigate to `http://localhost:3000/admin.html`.
   - Sign in using `owner` and your configured password.
   - Review the **5 Status Metric Cards**: *Total Enquiries*, *New Leads*, *Contacted*, *Appointment Booked*, and *Closed*.
   - Locate the newly submitted lead for `Aditya Roy`.
   - Demonstrate the status dropdown: Change `New` to `Contacted`, then `Appointment booked`.
   - Refresh the page to demonstrate database persistence.
   - Click **"Sign Out"** and demonstrate that private lead details cannot be accessed without re-authenticating.

---

## 5. Security & Privacy Architecture

- **Content Security Policy (CSP)**: Strict headers via `helmet` restricting scripts, objects, and framing (`frame-ancestors: none`).
- **CSRF Defense**: State-changing API endpoints (`PATCH`, `DELETE`, `POST /logout`) verify custom headers (`X-Requested-With`) in tandem with `SameSite=Strict` cookies.
- **Parameterised SQL**: All queries use positional parameter bindings (`?`) through SQLite prepared statements to prevent SQL injection.
- **Zero PII Logging**: Console logs never print student names, phone numbers, emails, passwords, or session tokens.
- **Rate Limiting**: IP-based rate limiting on sensitive login and enquiry endpoints prevents brute-force credential attacks and automated form abuse.
- **Honeypot Trap**: An invisible form field silently catches and rejects automated spam bots.

---

## 6. Configuration Guide

| Variable | Required | Description |
|---|---|---|
| `PORT` | Optional | Port for the HTTP server (default: `3000`). |
| `ADMIN_USERNAME` | Required | Username for the owner dashboard. |
| `ADMIN_PASSWORD_HASH` | Required | Hex-encoded scrypt hash of the owner password. |
| `ADMIN_PASSWORD_SALT` | Required | Unique random salt used to compute the scrypt hash. |
| `SESSION_SECRET` | Required | Cryptographic secret for signing session tokens with HMAC-SHA256. |
| `WHATSAPP_NUMBER` | Optional | WhatsApp business number in international format without `+` (e.g. `919876543210`). |
| `OWNER_NOTIFICATION_EMAIL` | Optional | Email recipient for new lead alerts when a mail provider is integrated. |

---

## 7. Production Deployment Notes

When deploying to a production host (e.g. Render, Railway, DigitalOcean, or an Indian cloud VPS):
1. **Enable HTTPS**: Ensure `NODE_ENV=production` is set so cookies automatically enforce the `Secure` flag.
2. **Persistent Storage**: Mount a persistent volume for the `data/` directory so SQLite records persist across container redeployments.
3. **Environment Secrets**: Configure environment variables directly in your hosting platform's secrets manager; never commit `.env` or `.sqlite` files to Git.
4. **Health Check**: Use the `/health` or `/api/health` endpoint for uptime monitoring and container health checks.
