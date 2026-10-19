/**
 * Notification service for enquiry events.
 *
 * Privacy rule: Never log personal enquiry data (names, phone numbers, emails, messages) to console.
 * Reliability rule: Notification delivery failures must NEVER cause enquiry storage to fail.
 */

function isNotificationConfigured() {
  const email = process.env.OWNER_NOTIFICATION_EMAIL;
  return Boolean(email && email.trim() && !email.includes('example.com'));
}

async function notifyOwner(enquirySummary) {
  const configured = isNotificationConfigured();
  if (!configured) {
    // Intentional silent non-PII trace for demo monitoring
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Notification Service] Enquiry #${enquirySummary.id} recorded. Notifications are not configured.`);
    }
    return { configured: false, delivered: false, note: 'Notification provider not configured' };
  }

  try {
    // In a production environment with an SMTP or API provider (e.g., SendGrid, Resend, Nodemailer):
    // Provider credentials must remain in environment variables on the server.
    // Send only necessary metadata (reference ID, destination, study level, timestamp).
    // For this demo, when configured, we record the dispatch without leaking PII:
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Notification Service] Dispatching notification for enquiry #${enquirySummary.id} to owner.`);
    }
    return { configured: true, delivered: true };
  } catch (err) {
    console.error(`[Notification Service] Failed to send notification for enquiry #${enquirySummary.id}`);
    return { configured: true, delivered: false, error: err.message };
  }
}

module.exports = {
  isNotificationConfigured,
  notifyOwner
};
