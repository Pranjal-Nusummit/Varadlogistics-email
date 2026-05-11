/**
 * Varad Global Logistics — Enquiry Form Worker
 * ─────────────────────────────────────────────
 * CONFIG — edit these values before deploying
 */
const CONFIG = {
  MAIL_TO:        'yourname@gmail.com',           // ← your Gmail (must match Resend signup email)
  MAIL_FROM:      'onboarding@resend.dev',         // ← Resend test address, no domain needed
  MAIL_FROM_NAME: 'Varad Global Logistics',
  SITE_NAME:      'Varad Global Logistics',
  PHONE:          '+91 88797 74320',
  WHATSAPP:       'https://wa.me/918879774320',
  ALLOWED_ORIGINS: [
    'https://varadlogistics-1.waykarpranjal.workers.dev',
  ],
};

// ── Entry point ───────────────────────────────────────────────────────────────
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return corsResponse(null, 204, origin);
  }

  if (request.method !== 'POST') {
    return corsResponse({ success: false, message: 'Method not allowed.' }, 405, origin);
  }

  // ── Parse form data ─────────────────────────────────────────────────────────
  let fields;
  try {
    const ct = request.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
      fields = await request.json();
    } else {
      const fd = await request.formData();
      fields = Object.fromEntries(fd.entries());
    }
  } catch (e) {
    return corsResponse({ success: false, message: 'Invalid request body.' }, 400, origin);
  }

  // ── Sanitise ────────────────────────────────────────────────────────────────
  const clean = (v) => String(v || '').trim().replace(/<[^>]*>/g, '').slice(0, 500);
  const name    = clean(fields.name);
  const company = clean(fields.company);
  const mobile  = clean(fields.mobile);
  const email   = clean(fields.email).toLowerCase();
  const service = clean(fields.service);
  const message = clean(fields.message);

  // ── Validate ────────────────────────────────────────────────────────────────
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

  // ── Check API key ───────────────────────────────────────────────────────────
  let apiKey;
  try {
    apiKey = RESEND_API_KEY;
  } catch(e) {
    return corsResponse({ success: false, message: 'Server configuration error: RESEND_API_KEY not set.' }, 500, origin);
  }

  if (!apiKey) {
    return corsResponse({ success: false, message: 'Server configuration error: API key is empty.' }, 500, origin);
  }

  const submittedAt = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'
  }) + ' IST';

  // ── Send admin email ────────────────────────────────────────────────────────
  try {
    const adminRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     CONFIG.MAIL_FROM_NAME + ' <' + CONFIG.MAIL_FROM + '>',
        to:       [CONFIG.MAIL_TO],
        reply_to: email,
        subject:  'New Enquiry: ' + service + ' — ' + name,
        html:     buildAdminEmail({ name, company, mobile, email, service, message, submittedAt }),
        text:     'Enquiry from ' + name + ' | ' + email + ' | ' + mobile + ' | ' + service + '\n\n' + message,
      }),
    });

    const adminData = await adminRes.json();

    if (!adminRes.ok) {
      return corsResponse({
        success: false,
        message: 'Resend error: ' + (adminData.message || adminData.name || JSON.stringify(adminData)),
      }, 500, origin);
    }

    // ── Send customer auto-reply ──────────────────────────────────────────────
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    CONFIG.MAIL_FROM_NAME + ' <' + CONFIG.MAIL_FROM + '>',
        to:      [email],
        subject: "We've Received Your Enquiry — " + CONFIG.SITE_NAME,
        html:    buildCustomerEmail({ name, service, submittedAt }),
        text:    'Hi ' + name + ', thank you for your enquiry about ' + service + '. We will get back to you within 2-4 hours.\n\nVarad Global Logistics\n' + CONFIG.PHONE,
      }),
    });

    return corsResponse({ success: true, message: 'Enquiry sent successfully!' }, 200, origin);

  } catch (err) {
    return corsResponse({ success: false, message: 'Worker error: ' + err.message }, 500, origin);
  }
}

// ── CORS helper ───────────────────────────────────────────────────────────────
function corsResponse(body, status, origin) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  return new Response(body ? JSON.stringify(body) : null, { status, headers });
}

// ── Admin email template ──────────────────────────────────────────────────────
function buildAdminEmail({ name, company, mobile, email, service, message, submittedAt }) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    + 'body{font-family:Arial,sans-serif;background:#f4f7fc;margin:0;padding:0}'
    + '.wrap{max-width:620px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden}'
    + '.header{background:linear-gradient(135deg,#0a1628,#1a3a6e);padding:28px 32px;text-align:center}'
    + '.header h1{color:#fff;font-size:20px;margin:0}'
    + '.header span{color:#f47c20;font-size:12px;letter-spacing:1px}'
    + '.body{padding:32px}'
    + '.badge{display:inline-block;background:#f47c20;color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:50px;margin-bottom:20px}'
    + 'table{width:100%;border-collapse:collapse}'
    + 'td{padding:12px 14px;font-size:14px;border-bottom:1px solid #e8edf5;vertical-align:top}'
    + 'td:first-child{width:36%;font-weight:700;color:#0a1628;background:#f4f7fc}'
    + '.msg{background:#f4f7fc;border-left:4px solid #f47c20;padding:14px 16px;border-radius:6px;font-size:14px;color:#4a5568;line-height:1.7;margin-top:20px}'
    + '.footer{background:#0a1628;padding:16px 32px;text-align:center}'
    + '.footer p{color:rgba(255,255,255,.4);font-size:11px;margin:0}'
    + '</style></head><body>'
    + '<div class="wrap">'
    + '<div class="header"><h1>📬 New Enquiry Received</h1><span>VARAD GLOBAL LOGISTICS</span></div>'
    + '<div class="body"><div class="badge">NEW ENQUIRY</div>'
    + '<table>'
    + '<tr><td>Name</td><td>' + name + '</td></tr>'
    + '<tr><td>Company</td><td>' + (company || '—') + '</td></tr>'
    + '<tr><td>Mobile</td><td>' + mobile + '</td></tr>'
    + '<tr><td>Email</td><td>' + email + '</td></tr>'
    + '<tr><td>Service</td><td><strong>' + service + '</strong></td></tr>'
    + '<tr><td>Submitted</td><td>' + submittedAt + '</td></tr>'
    + '</table>'
    + '<div class="msg"><strong>Message:</strong><br>' + (message || '(none)') + '</div>'
    + '</div>'
    + '<div class="footer"><p>Varad Global Logistics · Mumbai · GST: 27AQJPP5543L1Z9</p></div>'
    + '</div></body></html>';
}

// ── Customer email template ───────────────────────────────────────────────────
function buildCustomerEmail({ name, service, submittedAt }) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    + 'body{font-family:Arial,sans-serif;background:#f4f7fc;margin:0;padding:0}'
    + '.wrap{max-width:620px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden}'
    + '.header{background:linear-gradient(135deg,#0a1628,#1a3a6e);padding:36px 32px;text-align:center}'
    + '.header h1{color:#fff;font-size:22px;margin:0 0 6px}'
    + '.header p{color:rgba(255,255,255,.65);font-size:13px;margin:0}'
    + '.body{padding:36px 32px}'
    + 'h2{color:#0a1628;font-size:18px;margin:0 0 12px}'
    + 'p{color:#4a5568;font-size:14px;line-height:1.75;margin:0 0 16px}'
    + '.box{background:#f4f7fc;border-radius:10px;padding:20px 24px;margin:20px 0;font-size:13px}'
    + '.footer{background:#0a1628;padding:18px 32px;text-align:center}'
    + '.footer p{color:rgba(255,255,255,.4);font-size:11px;margin:0}'
    + '</style></head><body>'
    + '<div class="wrap">'
    + '<div class="header"><h1>Thank You, ' + name + '! 🚢</h1><p>Your enquiry has been received.</p></div>'
    + '<div class="body">'
    + '<h2>We\'ve Got Your Enquiry</h2>'
    + '<p>Thank you for contacting <strong>Varad Global Logistics</strong>. Our team received your request for <strong>' + service + '</strong> and will reply within <strong>2–4 hours</strong>.</p>'
    + '<div class="box"><strong>Summary</strong><br><br>Service: <strong>' + service + '</strong><br>Submitted: <strong>' + submittedAt + '</strong></div>'
    + '<p>For urgent matters call <strong>+91 88797 74320</strong> or WhatsApp us.</p>'
    + '</div>'
    + '<div class="footer"><p>Varad Global Logistics · Navi Mumbai · GST: 27AQJPP5543L1Z9</p></div>'
    + '</div></body></html>';
}
