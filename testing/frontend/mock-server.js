// Mock of the Spring Boot API contract, used only to test index.html in a real browser.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const INDEX = process.argv[2] || path.join(__dirname, '..', '..', 'src', 'main', 'resources', 'static', 'index.html');
const PORT = 8090;
const ESB = process.env.ESBUILD || path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');

function buildApp() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const a = html.indexOf('<script type="text/babel">') + '<script type="text/babel">'.length;
  const b = html.indexOf('</script>', a);
  fs.writeFileSync(path.join(__dirname, 'app.jsx'), html.slice(a, b));
  let esbuild = null;
  try { esbuild = require('esbuild'); } catch (e) { /* fall back to the esbuild program */ }
  if (esbuild) {
    // JavaScript API: works the same on Windows, macOS and Linux.
    esbuild.buildSync({ entryPoints: [path.join(__dirname, 'app.jsx')], loader: { '.jsx': 'jsx' }, jsx: 'transform', outfile: path.join(__dirname, 'app.js'), logLevel: 'error' });
  } else {
    execFileSync(ESB, [path.join(__dirname, 'app.jsx'), '--loader:.jsx=jsx', '--jsx=transform', '--outfile=' + path.join(__dirname, 'app.js'), '--log-level=error']);
  }
}

let nextId = 100;
const now = () => new Date().toISOString().slice(0, 19);
const db = {
  users: [
    { id: 1, fullName: 'Ada Admin', email: 'admin@test.local', password: 'AdminPass123', role: 'ADMIN', enabled: true, approvalStatus: 'APPROVED', twoFactorEnabled: false, phone: null, photo: null, createdAt: '2026-01-01T09:00:00' },
    { id: 2, fullName: 'Owen Owner', email: 'owner@test.local', password: 'Owner12345', role: 'MODULE_OWNER', enabled: true, approvalStatus: 'APPROVED', twoFactorEnabled: false, phone: null, photo: null, createdAt: '2026-01-02T09:00:00' },
    { id: 3, fullName: 'Lena Learner', email: 'lena@test.local', password: 'Learner123', role: 'USER', enabled: true, approvalStatus: 'APPROVED', twoFactorEnabled: false, phone: '0400', photo: null, createdAt: '2026-02-01T09:00:00' },
    { id: 4, fullName: 'Pat Pending', email: 'pat@test.local', password: 'Pending123', role: 'USER', enabled: true, approvalStatus: 'PENDING', twoFactorEnabled: false, phone: null, photo: null, createdAt: '2026-10-30T09:00:00' },
    { id: 5, fullName: 'Tom Totp', email: 'tom@test.local', password: 'TwoFactor123', role: 'USER', enabled: true, approvalStatus: 'APPROVED', twoFactorEnabled: true, phone: null, photo: null, createdAt: '2026-03-01T09:00:00' },
  ],
  modules: [
    { id: 10, ownerId: 2, title: 'Phishing Awareness', desc: 'Spot fake emails', content: 'Phishing is pretending to be someone you trust.\nHover over links.', category: 'Threats', duration: 20, dueDate: '2026-11-03', thumbnail: '🎣', color: '#7c3aed', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoName: 'Linked video', passingScore: 50, published: true, certTemplate: { title: 'Certificate of Completion', subtitle: 'Phishing Awareness', badge: '🏆', accentColor: '#7c3aed' } },
  ],
  questions: [
    { id: 20, moduleId: 10, q: 'Which link is safe?', options: ['evil.com', 'university.edu', 'uni.edu.evil.com', 'bit.ly/x'], answer: 1, hint: 'Look at the domain', explanation: 'The real domain.', active: true },
    { id: 21, moduleId: 10, q: 'Report phishing to?', options: ['IT', 'Nobody', 'Sender', 'Friends'], answer: 0, hint: 'Who runs email?', explanation: 'IT handles it.', active: true },
  ],
  enrollments: [], attempts: [], answers: [], resets: [], audit: [],
};
const sessions = {}; // sid -> {userId, pending2fa}
const CSRF = 'mock-csrf-token';
const REQUIRE_2FA = true;
const QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const audit = (userId, action, description) => db.audit.unshift({ id: nextId++, actor: userId ? (u => u.fullName + ' (' + u.email + ')')(db.users.find(x => x.id === userId)) : 'Anonymous', action, entityType: 'User', entityId: null, description, ipAddress: '127.0.0.1', createdAt: now() });
const adminView = u => ({ id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, role: u.role, enabled: u.enabled, approvalStatus: u.approvalStatus, twoFactorEnabled: u.twoFactorEnabled, createdAt: u.createdAt });
const sessionUser = u => ({ id: u.id, name: u.fullName, email: u.email, role: u.role, twoFactorEnabled: u.twoFactorEnabled });
const profile = u => ({ id: u.id, name: u.fullName, email: u.email, phone: u.phone, photo: u.photo, role: u.role, joinDate: u.createdAt.slice(0, 10), twoFactorEnabled: u.twoFactorEnabled, twoFactorRequired: REQUIRE_2FA });
const learners = () => db.users.filter(u => u.role === 'USER' && u.enabled && u.approvalStatus === 'APPROVED');
const qs = (mid, all) => db.questions.filter(q => q.moduleId === mid && (all || q.active));
function progressOf(uid, m) {
  const e = db.enrollments.find(x => x.userId === uid && x.moduleId === m.id);
  const best = db.attempts.filter(a => a.userId === uid && a.moduleId === m.id && a.completedAt).reduce((mx, a) => Math.max(mx, a.score), -1);
  const score = best < 0 ? null : best;
  if (!e) return { started: false, completed: false, score, completedDate: null, currentQ: 0, progressPercentage: 0 };
  const pct = e.completed ? 100 : e.progress;
  return { started: true, completed: e.completed, score, completedDate: e.completedAt, currentQ: Math.round(pct * qs(m.id).length / 100), progressPercentage: pct };
}
function stats(m) {
  const es = db.enrollments.filter(e => e.moduleId === m.id);
  const total = learners().length, completed = es.filter(e => e.completed).length;
  return { total, completed, started: es.length - completed, pct: total ? Math.round(completed * 100 / total) : 0 };
}
function view(m, { quiz = false, progressFor = null, withStats = false } = {}) {
  const owner = db.users.find(u => u.id === m.ownerId);
  return { id: m.id, title: m.title, desc: m.desc, content: m.content, category: m.category || 'General', duration: m.duration, dueDate: m.dueDate, thumbnail: m.thumbnail, color: m.color, videoUrl: m.videoUrl, videoName: m.videoName, passingScore: m.passingScore, published: m.published, questionCount: qs(m.id).length, ownerName: owner ? owner.fullName : null, certTemplate: m.certTemplate, quiz: quiz ? qs(m.id).map(q => ({ id: q.id, q: q.q, options: q.options, answer: q.answer, hint: q.hint, explanation: q.explanation })) : null, progress: progressFor ? progressOf(progressFor, m) : null, stats: withStats ? stats(m) : null };
}
function enrollment(uid, mid) {
  let e = db.enrollments.find(x => x.userId === uid && x.moduleId === mid);
  if (!e) { e = { userId: uid, moduleId: mid, completed: false, completedAt: null, progress: 0 }; db.enrollments.push(e); }
  return e;
}
function applyModule(m, b) {
  if (!b.title || b.title.trim().length < 3) throw [400, 'Module title must be between 3 and 200 characters.'];
  if (b.videoUrl && !/^https?:\/\//i.test(b.videoUrl) && b.videoUrl !== '/api/modules/' + m.id + '/video') throw [400, 'Video link must start with http:// or https://'];
  Object.assign(m, { title: b.title.trim(), desc: b.desc || '', content: b.content || '', category: b.category, duration: b.duration || 20, dueDate: b.dueDate || null, thumbnail: b.thumbnail, color: b.color, videoUrl: b.videoUrl || null, videoName: b.videoUrl ? (b.videoName || 'Linked video') : null, passingScore: b.passingScore || 70 });
  if (b.certTemplate) m.certTemplate = b.certTemplate;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(INDEX)); }
  if (p === '/__app.js') { buildApp(); res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, 'app.js'))); }
  if (p === '/__react.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, 'react-bundle.js'))); }

  const cookies = Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => c.split('=')));
  let sid = cookies.SID; let setCookie = {};
  if (!sid || !sessions[sid]) { sid = 's' + Math.random().toString(36).slice(2); sessions[sid] = {}; setCookie = { 'Set-Cookie': 'SID=' + sid + '; Path=/; HttpOnly' }; }
  const sess = sessions[sid];
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body = {};
  if ((req.headers['content-type'] || '').includes('json') && raw) { try { body = JSON.parse(raw); } catch { return send(res, 400, { message: 'bad json' }); } }
  const ok = (b, s = 200) => send(res, s, b, setCookie);
  const fail = (s, m) => send(res, s, { message: m }, setCookie);

  if (req.method !== 'GET' && req.headers['x-xsrf-token'] !== CSRF) return fail(403, 'CSRF token missing');

  const me = sess.userId ? db.users.find(u => u.id === sess.userId) : null;
  const need = role => {
    if (!me || !me.enabled || me.approvalStatus !== 'APPROVED') { fail(401, 'Please sign in to continue.'); return false; }
    if (role && me.role !== role) { fail(403, 'You do not have permission to do that.'); return false; }
    return true;
  };
  let m;
  try {
    // ---- auth
    if (p === '/api/auth/csrf') return ok({ headerName: 'X-XSRF-TOKEN', token: CSRF });
    if (p === '/api/auth/me') return ok(me && me.enabled && me.approvalStatus === 'APPROVED' ? { authenticated: true, user: sessionUser(me) } : { authenticated: false });
    if (p === '/api/auth/login') {
      const u = db.users.find(x => x.email === (body.email || '').toLowerCase().trim());
      if (!u || u.password !== body.password || !u.enabled || u.approvalStatus !== 'APPROVED') { audit(u && u.id, 'LOGIN_FAILED', 'Failed sign-in'); return fail(401, 'Sign-in failed. Check your email and password. New accounts can only sign in after an administrator approves them.'); }
      if (u.twoFactorEnabled) { sess.pending2fa = u.id; sess.setup = false; sess.userId = null; return ok({ requiresTwoFactor: true, message: 'Enter the current code' }); }
      if (REQUIRE_2FA) { sess.pending2fa = u.id; sess.setup = true; sess.userId = null; return ok({ requiresTwoFactorSetup: true, qrCode: QR, secret: 'JBSWY3DPEHPK3PXP', message: 'Two-factor authentication is required.' }); }
      sess.userId = u.id; audit(u.id, 'LOGIN_SUCCESS', 'Signed in'); return ok({ authenticated: true, user: sessionUser(u) });
    }
    if (p === '/api/auth/verify-2fa') {
      if (!sess.pending2fa) return fail(401, 'Your sign-in session expired. Please sign in again.');
      if (body.code !== '123456') return fail(401, 'The authenticator code is invalid. Try the current six-digit code.');
      if (sess.setup) db.users.find(u => u.id === sess.pending2fa).twoFactorEnabled = true;
      sess.userId = sess.pending2fa; sess.pending2fa = null; return ok({ authenticated: true, user: sessionUser(db.users.find(u => u.id === sess.userId)) });
    }
    if (p === '/api/auth/register') {
      if (!body.password || body.password.length < 8) return fail(400, 'Password must be 8-72 characters and include at least one letter and one number.');
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(body.email || '')) return fail(400, 'Enter a valid email address.');
      if (!db.users.find(u => u.email === body.email.toLowerCase())) db.users.push({ id: nextId++, fullName: body.fullName, email: body.email.toLowerCase(), password: body.password, role: 'USER', enabled: true, approvalStatus: 'PENDING', twoFactorEnabled: false, phone: body.phone || null, photo: null, createdAt: now() });
      return ok({ message: 'Registration submitted. An administrator will review your request before you can sign in.' }, 202);
    }
    if (p === '/api/auth/forgot-password') {
      const u = db.users.find(x => x.email === (body.email || '').toLowerCase());
      if (u) { db.resets.forEach(r => { if (r.userId === u.id && r.status === 'PENDING') r.status = 'REJECTED'; }); db.resets.unshift({ id: nextId++, userId: u.id, userName: u.fullName, email: u.email, status: 'PENDING', requestedAt: now(), reviewedAt: null, reviewedBy: null, newPassword: body.newPassword }); }
      return ok({ message: 'If an approved account uses that email, a reset request has been sent to the administrator. Your current password keeps working until it is approved.' }, 202);
    }
    if (p === '/api/auth/logout') { delete sessions[sid]; return ok({ message: 'Signed out.' }); }

    // ---- me
    if (p === '/api/me/profile' && req.method === 'GET') { if (!need()) return; return ok(profile(me)); }
    if (p === '/api/me/profile' && req.method === 'PUT') { if (!need()) return; if (!body.fullName || body.fullName.trim().length < 2) return fail(400, 'Full name must be between 2 and 100 characters.'); me.fullName = body.fullName.trim(); me.phone = body.phone || null; me.photo = body.photo || null; return ok(profile(me)); }
    if (p === '/api/me/2fa/setup') { if (!need()) return; return ok({ qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', secret: 'JBSWY3DPEHPK3PXP' }); }
    if (p === '/api/me/2fa/enable') { if (!need()) return; if (body.code !== '123456') return fail(400, 'That code is not correct.'); me.twoFactorEnabled = true; return ok(profile(me)); }
    if (p === '/api/me/2fa/disable') { if (!need()) return; if (REQUIRE_2FA) return fail(403, 'Two-factor authentication is required for every account and cannot be turned off.'); if (body.code !== '123456') return fail(400, 'Enter the current 6-digit code.'); me.twoFactorEnabled = false; return ok(profile(me)); }

    // ---- learner
    if (p.startsWith('/api/learner/')) {
      if (!need('USER')) return;
      if (p === '/api/learner/modules') return ok(db.modules.filter(x => x.published).map(x => view(x, { progressFor: me.id })));
      if ((m = p.match(/^\/api\/learner\/modules\/(\d+)\/attempts$/))) {
        const mod = db.modules.find(x => x.id === +m[1] && x.published); if (!mod) return fail(404, 'Module not found.');
        const a = { id: nextId++, userId: me.id, moduleId: mod.id, total: qs(mod.id).length, completedAt: null, startedAt: now() }; db.attempts.push(a);
        const e = enrollment(me.id, mod.id); if (!e.completed) e.progress = 0;
        return ok({ attemptId: a.id, moduleId: mod.id, questions: qs(mod.id).map(q => ({ id: q.id, q: q.q, options: q.options, answer: null, hint: q.hint, explanation: null })) });
      }
      if ((m = p.match(/^\/api\/learner\/attempts\/(\d+)\/answers$/))) {
        const a = db.attempts.find(x => x.id === +m[1] && x.userId === me.id); if (!a) return fail(404, 'Quiz attempt not found.');
        if (db.answers.find(x => x.attemptId === a.id && x.questionId === body.questionId)) return fail(409, 'This question has already been answered.');
        const q = db.questions.find(x => x.id === body.questionId); const correct = q.answer === body.answer;
        db.answers.push({ attemptId: a.id, questionId: q.id, correct });
        const answered = db.answers.filter(x => x.attemptId === a.id).length;
        const e = enrollment(me.id, a.moduleId); if (!e.completed) e.progress = Math.min(99, Math.round(answered * 100 / a.total));
        return ok({ correct, correctAnswer: q.answer, explanation: q.explanation, answered, total: a.total });
      }
      if ((m = p.match(/^\/api\/learner\/attempts\/(\d+)\/finish$/))) {
        const a = db.attempts.find(x => x.id === +m[1] && x.userId === me.id); const mod = db.modules.find(x => x.id === a.moduleId);
        const correct = db.answers.filter(x => x.attemptId === a.id && x.correct).length;
        a.score = Math.round(correct * 100 / a.total); a.correct = correct; a.completedAt = now(); a.passed = a.score >= mod.passingScore;
        const e = enrollment(me.id, mod.id); if (a.passed && !e.completed) { e.completed = true; e.completedAt = a.completedAt; }
        return ok({ attemptId: a.id, moduleId: mod.id, moduleTitle: mod.title, score: a.score, correctAnswers: correct, totalQuestions: a.total, passingScore: mod.passingScore, passed: a.passed, startedAt: a.startedAt, completedAt: a.completedAt });
      }
      if ((m = p.match(/^\/api\/learner\/modules\/(\d+)\/restart$/))) { const e = db.enrollments.find(x => x.userId === me.id && x.moduleId === +m[1]); if (e) Object.assign(e, { completed: false, completedAt: null, progress: 0 }); return ok({ message: 'Progress reset.' }); }
      if (p === '/api/learner/attempts') return ok(db.attempts.filter(a => a.userId === me.id && a.completedAt).reverse().map(a => { const mod = db.modules.find(x => x.id === a.moduleId); return { attemptId: a.id, moduleId: mod.id, moduleTitle: mod.title, score: a.score, correctAnswers: a.correct, totalQuestions: a.total, passingScore: mod.passingScore, passed: a.passed, startedAt: a.startedAt, completedAt: a.completedAt }; }));
    }

    // ---- owner
    if (p.startsWith('/api/owner/')) {
      if (!need('MODULE_OWNER')) return;
      const own = id => { const x = db.modules.find(y => y.id === id); if (!x) throw [404, 'Module not found.']; if (x.ownerId !== me.id) throw [403, 'You can only change your own modules.']; return x; };
      if (p === '/api/owner/modules' && req.method === 'GET') return ok(db.modules.filter(x => x.ownerId === me.id).map(x => view(x, { quiz: true, withStats: true })));
      if (p === '/api/owner/modules' && req.method === 'POST') { const x = { id: nextId++, ownerId: me.id, published: false, certTemplate: null }; applyModule(x, body); db.modules.push(x); return ok(view(x, { quiz: true, withStats: true }), 201); }
      if (p === '/api/owner/learners') return ok(learners().map(u => ({ id: u.id, name: u.fullName, email: u.email, progress: Object.fromEntries(db.modules.filter(x => x.ownerId === me.id).filter(x => db.enrollments.find(e => e.userId === u.id && e.moduleId === x.id)).map(x => [x.id, progressOf(u.id, x)])) })));
      if ((m = p.match(/^\/api\/owner\/modules\/(\d+)$/))) {
        const x = own(+m[1]);
        if (req.method === 'PUT') { applyModule(x, body); return ok(view(x, { quiz: true, withStats: true })); }
        if (req.method === 'DELETE') { if (db.attempts.find(a => a.moduleId === x.id)) return fail(409, 'Learners have already taken this quiz, so the module is kept for their records. Unpublish it instead.'); db.modules = db.modules.filter(y => y !== x); return ok({ message: 'Module deleted.' }); }
      }
      if ((m = p.match(/^\/api\/owner\/modules\/(\d+)\/published$/))) { const x = own(+m[1]); if (body.published && !qs(x.id).length) return fail(400, 'Add at least one quiz question before publishing this module.'); x.published = !!body.published; return ok(view(x, { quiz: true, withStats: true })); }
      if ((m = p.match(/^\/api\/owner\/modules\/(\d+)\/questions$/))) {
        const x = own(+m[1]);
        if (!Array.isArray(body) || !body.length) return fail(400, 'A quiz needs at least one question.');
        body.forEach((q, i) => { if (!q.q || !q.q.trim()) throw [400, 'Question ' + (i + 1) + ': enter the question text.']; if (q.options.some(o => !o || !o.trim())) throw [400, 'Question ' + (i + 1) + ': fill in all four answer options.']; });
        const kept = [];
        body.forEach(q => { let ex = q.id && db.questions.find(y => y.id === q.id && y.moduleId === x.id); if (!ex) { ex = { id: nextId++, moduleId: x.id }; db.questions.push(ex); } Object.assign(ex, { q: q.q, options: q.options, answer: q.answer, hint: q.hint, explanation: q.explanation, active: true }); kept.push(ex.id); });
        db.questions.forEach(y => { if (y.moduleId === x.id && !kept.includes(y.id)) y.active = false; });
        return ok(view(x, { quiz: true, withStats: true }));
      }
      if ((m = p.match(/^\/api\/owner\/modules\/(\d+)\/video$/))) { const x = own(+m[1]); x.videoUrl = '/api/modules/' + x.id + '/video'; x.videoName = 'uploaded.mp4'; return ok(view(x, { quiz: true, withStats: true })); }
    }

    // ---- admin
    if (p.startsWith('/admin/')) {
      if (!need('ADMIN')) return;
      const target = id => { const u = db.users.find(x => x.id === id); if (!u) throw [404, 'User not found.']; return u; };
      if (p === '/admin/api/users' && req.method === 'GET') return ok(db.users.map(adminView));
      if (p === '/admin/api/users' && req.method === 'POST') { if (db.users.find(u => u.email === body.email)) return fail(409, 'An account with this email already exists.'); const u = { id: nextId++, fullName: body.fullName, email: body.email, password: body.password, role: body.role, enabled: true, approvalStatus: 'APPROVED', twoFactorEnabled: false, phone: null, photo: null, createdAt: now() }; db.users.push(u); return ok(adminView(u), 201); }
      if ((m = p.match(/^\/admin\/api\/users\/(\d+)\/(approve|reject)$/))) { const u = target(+m[1]); if (u.approvalStatus !== 'PENDING') return fail(409, 'This registration is no longer pending.'); u.approvalStatus = m[2] === 'approve' ? 'APPROVED' : 'REJECTED'; u.enabled = m[2] === 'approve'; audit(me.id, m[2] === 'approve' ? 'REGISTRATION_APPROVED' : 'REGISTRATION_REJECTED', u.email); return ok(adminView(u)); }
      if ((m = p.match(/^\/admin\/api\/users\/(\d+)\/role$/))) { const u = target(+m[1]); if (!['USER', 'MODULE_OWNER'].includes(body.role)) return fail(400, 'Role must be USER or MODULE_OWNER.'); u.role = body.role; audit(me.id, 'ROLE_CHANGED', u.email + ' -> ' + body.role); return ok(adminView(u)); }
      if ((m = p.match(/^\/admin\/api\/users\/(\d+)\/status$/))) { const u = target(+m[1]); if (u.id === me.id) return fail(403, 'You cannot disable your own administrator account.'); u.enabled = !!body.enabled; audit(me.id, body.enabled ? 'ACCOUNT_ENABLED' : 'ACCOUNT_DISABLED', u.email); return ok(adminView(u)); }
      if ((m = p.match(/^\/admin\/api\/users\/(\d+)\/reset-2fa$/))) { const u = target(+m[1]); if (u.id === me.id) return fail(403, 'You cannot reset your own 2FA here.'); u.twoFactorEnabled = false; audit(me.id, '2FA_RESET', u.email); return ok(adminView(u)); }
      if (p === '/admin/api/modules') return ok(db.modules.map(x => view(x, { withStats: true })));
      if (p === '/admin/api/password-resets') return ok(db.resets.map(({ newPassword, ...r }) => r));
      if ((m = p.match(/^\/admin\/api\/password-resets\/(\d+)\/(approve|reject)$/))) { const r = db.resets.find(x => x.id === +m[1]); if (r.status !== 'PENDING') return fail(409, 'Already decided.'); r.status = m[2] === 'approve' ? 'APPROVED' : 'REJECTED'; r.reviewedAt = now(); r.reviewedBy = me.fullName; if (m[2] === 'approve') db.users.find(u => u.id === r.userId).password = r.newPassword; return ok(r); }
      if (p === '/admin/api/audit-logs') return ok(db.audit.slice(0, 200));
    }
    if (p.startsWith('/api/modules/')) { if (!need()) return; return fail(404, 'Video file not found.'); }
    return fail(404, 'Not found.');
  } catch (e) {
    if (Array.isArray(e)) return fail(e[0], e[1]);
    console.error(e); return fail(500, 'mock error');
  }
});
buildApp();
server.listen(PORT, () => console.log('mock on ' + PORT));
