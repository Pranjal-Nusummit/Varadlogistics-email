/**
 * Varad Global Logistics — Enquiry Form Worker
 * ─────────────────────────────────────────────
 * Deploy this as a Cloudflare Worker.
 * Set RESEND_API_KEY as an environment secret (see README.txt).
 *
 * CONFIG — edit these before deploying
 */
const CONFIG = {
  MAIL_TO:       'waykarpranjal@gmail.com',   // ← Enquiries arrive HERE
  MAIL_FROM:     'onboarding@resend.dev', // ← Must be from your verified domain
  MAIL_FROM_NAME:'Varad Global Logistics',
  SITE_NAME:     'Varad Global Logistics',
  PHONE:         '+91 88797 74320',
  WHATSAPP:      'https://wa.me/918879774320',
  ALLOWED_ORIGINS: [
    'https://varadgloballogistics.com',
    'https://www.varadgloballogistics.com',
'https://varadlogistics-1.waykarpranjal.workers.dev',
    'https://varadlogistics-website.varadcargoexpress.workers.dev/'
    // Add your .pages.dev URL below while testing:
    // 'https://varad-global.pages.dev',
  ],
};

// ── Entry point ───────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, origin);
    }

    if (request.method !== 'POST') {
      return corsResponse({ success: false, message: 'Method not allowed.' }, 405, origin);
    }

    // ── Parse form data ───────────────────────────────────────────────────────
    let fields;
    try {
      const ct = request.headers.get('Content-Type') || '';
      if (ct.includes('application/json')) {
        fields = await request.json();
      } else {
        const fd = await request.formData();
        fields = Object.fromEntries(fd.entries());
      }
    } catch {
      return corsResponse({ success: false, message: 'Invalid request body.' }, 400, origin);
    }

    // ── Sanitise ──────────────────────────────────────────────────────────────
    const clean = (v) => String(v || '').trim().replace(/<[^>]*>/g, '').slice(0, 500);
    const name    = clean(fields.name);
    const company = clean(fields.company);
    const mobile  = clean(fields.mobile);
    const email   = clean(fields.email).toLowerCase();
    const service = clean(fields.service);
    const message = clean(fields.message);

    // ── Validate ──────────────────────────────────────────────────────────────
    const errors = [];
    if (!name)    errors.push('Name is required.');
    if (!mobile)  errors.push('Mobile number is required.');
    if (!email)   errors.push('Email address is required.');
    if (!service) errors.push('Please select a service.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email address.');
    const digits = mobile.replace(/\D/g, '');
    if (mobile && (digits.length < 10 || digits.length > 13)) errors.push('Invalid mobile number.');

    if (errors.length) {
      return corsResponse({ success: false, message: errors.join(' ') }, 422, origin);
    }

    // ── Check API key ─────────────────────────────────────────────────────────
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      return corsResponse({ success: false, message: 'Server configuration error.' }, 500, origin);
    }

    const submittedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'
    }) + ' IST';

    // ── Build emails ──────────────────────────────────────────────────────────
    const adminHtml = buildAdminEmail({ name, company, mobile, email, service, message, submittedAt });
    const customerHtml = buildCustomerEmail({ name, service, submittedAt, phone: CONFIG.PHONE, whatsapp: CONFIG.WHATSAPP });

    // ── Send both emails via Resend ───────────────────────────────────────────
    try {
      const [adminRes, customerRes] = await Promise.all([
        sendEmail(apiKey, {
          from:     `${CONFIG.MAIL_FROM_NAME} <${CONFIG.MAIL_FROM}>`,
          to:       [CONFIG.MAIL_TO],
          reply_to: email,
          subject:  `New Enquiry: ${service} — ${name}`,
          html:     adminHtml,
          text:     `New enquiry from ${name} (${email})\nMobile: ${mobile}\nCompany: ${company}\nService: ${service}\n\nMessage:\n${message}\n\nSubmitted: ${submittedAt}`,
        }),
        sendEmail(apiKey, {
          from:    `${CONFIG.MAIL_FROM_NAME} <${CONFIG.MAIL_FROM}>`,
          to:      [email],
          subject: `We've Received Your Enquiry — ${CONFIG.SITE_NAME}`,
          html:    customerHtml,
          text:    `Hi ${name},\n\nThank you for your enquiry about ${service}. We'll get back to you within 2–4 hours.\n\nVarad Global Logistics\n${CONFIG.PHONE}`,
        }),
      ]);

      if (!adminRes.ok) {
        const err = await adminRes.json();
        throw new Error(err.message || 'Failed to send admin email.');
      }

      return corsResponse({ success: true, message: 'Enquiry sent successfully!' }, 200, origin);

    } catch (err) {
      console.error('Resend error:', err.message);
      return corsResponse({
        success: false,
        message: 'Could not send email. Please try again or contact us directly.',
      }, 500, origin);
    }
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function sendEmail(apiKey, payload) {
  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function corsResponse(body, status, origin) {
  const allowed = CONFIG.ALLOWED_ORIGINS.includes(origin);
  const headers = {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': allowed ? origin : CONFIG.ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
  };
  return new Response(body ? JSON.stringify(body) : null, { status, headers });
}

// ── Email templates ───────────────────────────────────────────────────────────
function buildAdminEmail({ name, company, mobile, email, service, message, submittedAt }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f7fc;margin:0;padding:0}
.wrap{max-width:620px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.header{background:linear-gradient(135deg,#0a1628,#1a3a6e);padding:28px 32px;text-align:center}
.header h1{color:#fff;font-size:20px;margin:0}.header span{color:#f47c20;font-size:12px;letter-spacing:1px}
.body{padding:32px}
.badge{display:inline-block;background:#f47c20;color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:50px;margin-bottom:20px;letter-spacing:1px}
table{width:100%;border-collapse:collapse}
td{padding:12px 14px;font-size:14px;border-bottom:1px solid #e8edf5;vertical-align:top}
td:first-child{width:36%;font-weight:700;color:#0a1628;background:#f4f7fc}
.msg{background:#f4f7fc;border-left:4px solid #f47c20;padding:14px 16px;border-radius:6px;font-size:14px;color:#4a5568;line-height:1.7;margin-top:20px;white-space:pre-wrap}
.footer{background:#0a1628;padding:16px 32px;text-align:center}
.footer p{color:rgba(255,255,255,.4);font-size:11px;margin:0}
</style></head><body>
<div class="wrap">
  <div class="header"><h1>📬 New Enquiry Received</h1><span>VARAD GLOBAL LOGISTICS</span></div>
  <div class="body">
    <div class="badge">NEW ENQUIRY</div>
    <table>
      <tr><td>Name</td><td>${name}</td></tr>
      <tr><td>Company</td><td>${company || '—'}</td></tr>
      <tr><td>Mobile</td><td>${mobile}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${email}" style="color:#f47c20">${email}</a></td></tr>
      <tr><td>Service Required</td><td><strong>${service}</strong></td></tr>
      <tr><td>Submitted At</td><td>${submittedAt}</td></tr>
    </table>
    <div class="msg"><strong>Message:</strong>\n${message || '(no message provided)'}</div>
  </div>
  <div class="footer"><p>© 2024 Varad Global Logistics · Mumbai, India · GST: 27AQJPP5543L1Z9</p></div>
</div></body></html>`;
}

function buildCustomerEmail({ name, service, submittedAt, phone, whatsapp }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f7fc;margin:0;padding:0}
.wrap{max-width:620px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.header{background:linear-gradient(135deg,#0a1628,#1a3a6e);padding:36px 32px;text-align:center}
.header h1{color:#fff;font-size:22px;margin:0 0 6px}
.header p{color:rgba(255,255,255,.65);font-size:13px;margin:0}
.body{padding:36px 32px}
h2{color:#0a1628;font-size:18px;margin:0 0 12px}
p{color:#4a5568;font-size:14px;line-height:1.75;margin:0 0 16px}
.box{background:#f4f7fc;border-radius:10px;padding:20px 24px;margin:20px 0;font-size:13px;color:#4a5568}
.box strong{color:#0a1628}
.pills{margin-top:16px}
.pill{display:inline-block;background:#0a1628;color:#fff;font-size:12px;padding:7px 16px;border-radius:50px;text-decoration:none;margin:4px 4px 0 0}
.pill.wa{background:#25D366}
hr{border:none;border-top:1px solid #e8edf5;margin:24px 0}
.footer{background:#0a1628;padding:18px 32px;text-align:center}
.footer p{color:rgba(255,255,255,.4);font-size:11px;margin:0}
</style></head><body>
<div class="wrap">
  <div class="header"><h1>Thank You, ${name}! 🚢</h1><p>Your enquiry has been received successfully.</p></div>
  <div class="body">
    <h2>We've Got Your Enquiry</h2>
    <p>Thank you for reaching out to <strong>Varad Global Logistics</strong>. Our team has received your request for <strong>${service}</strong> and will get back to you within <strong>2–4 hours</strong> with a customised quote.</p>
    <div class="box">
      <strong>Your Enquiry Summary</strong><br><br>
      Service: <strong>${service}</strong><br>
      Submitted: <strong>${submittedAt}</strong>
    </div>
    <p>While you wait, feel free to reach us directly:</p>
    <div class="pills">
      <a href="tel:${phone}" class="pill">📞 ${phone}</a>
      <a href="${whatsapp}" class="pill wa">💬 WhatsApp Us</a>
    </div>
    <hr>
    <p style="font-size:12px;color:#8a96ab">This is an automated confirmation. For urgent matters, call or WhatsApp us directly.</p>
  </div>
  <div class="footer"><p>Varad Global Logistics · Navi Mumbai, Maharashtra · GST: 27AQJPP5543L1Z9</p></div>
</div></body></html>`;
}
