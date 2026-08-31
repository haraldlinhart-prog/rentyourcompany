// api/contact.js — RentYourCompany.com
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONTACT_FROM = process.env.CONTACT_FROM || 'noreply@pan21.com';
const CONTACT_TO = process.env.CONTACT_TO || 'rentyourcompany@pan21.com';

function isGibberish(str) {
  if (!str) return false;
  var s = str.trim();
  var len = s.length;
  if (len < 6) return false;
  var vowels = (s.match(/[aeiouAEIOU]/g) || []).length;
  var letters = (s.match(/[a-zA-Z]/g) || []).length;
  if (letters === 0) return false;
  var vowelRatio = vowels / letters;
  var transitions = 0;
  for (var i = 1; i < s.length; i++) {
    var prevUpper = s[i-1] === s[i-1].toUpperCase() && /[a-zA-Z]/.test(s[i-1]);
    var curUpper = s[i] === s[i].toUpperCase() && /[a-zA-Z]/.test(s[i]);
    if (prevUpper !== curUpper) transitions++;
  }
  var transitionRatio = transitions / len;
  var vowelThreshold = len <= 10 ? 0.16 : (len <= 13 ? 0.22 : 0.28);
  return vowelRatio < vowelThreshold && transitionRatio > 0.3;
}

function looksHuman(str) {
  if (!str) return true;
  return str.replace(/\s/g, '').length <= 60;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

var JURISDICTION_LABELS = {
  us_llc: 'USA (LLC)',
  uk_ltd: 'United Kingdom (Ltd)',
  de_gmbh: 'Germany (GmbH / UG)',
  hk_ltd: 'Hong Kong',
  either: 'Not sure yet / advise me'
};

var DURATION_LABELS = {
  '1_2_months': '1–2 months',
  '3_6_months': '3–6 months',
  'over_6_months': 'Over 6 months',
  'not_sure': 'Not sure yet / with extension option'
};

var TIMELINE_LABELS = {
  asap: 'As soon as possible',
  weeks: 'Within a few weeks',
  open: 'Timing still open'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    var body = req.body || {};
    var name = (body.name || '').toString().trim();
    var email = (body.email || '').toString().trim();
    var phone = (body.phone || '').toString().trim();
    var usage = (body.usage || '').toString().trim();
    var jurisdiction = (body.jurisdiction || '').toString().trim();
    var duration = (body.duration || '').toString().trim();
    var branch = (body.branch || '').toString().trim();
    var timeline = (body.timeline || '').toString().trim();
    var notes = (body.notes || '').toString().trim();
    var website = (body.website || '').toString();
    var elapsed = parseInt(body.elapsed, 10);
    var consent = !!body.consent;

    if (website) { res.status(200).json({ success: true }); return; }
    if (isNaN(elapsed) || elapsed < 3) { res.status(200).json({ success: true }); return; }
    if (!name || !email || !usage) { res.status(400).json({ error: 'Please fill in all required fields.' }); return; }
    if (!consent) { res.status(400).json({ error: 'Please confirm the Privacy Policy.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'Please enter a valid email address.' }); return; }
    if (!looksHuman(name) || !looksHuman(usage) || isGibberish(name) || isGibberish(usage)) { res.status(200).json({ success: true }); return; }

    if (!RESEND_API_KEY) { res.status(500).json({ error: 'Configuration error. Please contact us directly by email.' }); return; }

    var html = '<h2>New enquiry via rentyourcompany.com</h2>' +
      '<p><strong>Name:</strong> ' + escapeHtml(name) + '</p>' +
      '<p><strong>Email:</strong> ' + escapeHtml(email) + '</p>' +
      (phone ? '<p><strong>Phone:</strong> ' + escapeHtml(phone) + '</p>' : '') +
      '<p><strong>Intended use:</strong><br>' + escapeHtml(usage).replace(/\n/g, '<br>') + '</p>' +
      (jurisdiction ? '<p><strong>Preferred jurisdiction:</strong> ' + escapeHtml(JURISDICTION_LABELS[jurisdiction] || jurisdiction) + '</p>' : '') +
      (duration ? '<p><strong>Preferred lease duration:</strong> ' + escapeHtml(DURATION_LABELS[duration] || duration) + '</p>' : '') +
      (branch ? '<p><strong>Preferred industry:</strong> ' + escapeHtml(branch) + '</p>' : '') +
      (timeline ? '<p><strong>Preferred start:</strong> ' + escapeHtml(TIMELINE_LABELS[timeline] || timeline) + '</p>' : '') +
      (notes ? '<p><strong>Special requirements:</strong><br>' + escapeHtml(notes).replace(/\n/g, '<br>') + '</p>' : '');

    var resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'RentYourCompany.com <' + CONTACT_FROM + '>',
        to: [CONTACT_TO],
        reply_to: email,
        subject: 'New enquiry: ' + name,
        html: html
      })
    });

    if (!resendRes.ok) { res.status(500).json({ error: 'Sending failed.' }); return; }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
