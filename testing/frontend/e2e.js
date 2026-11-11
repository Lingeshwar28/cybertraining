// Browser test of index.html against the mock API.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:8090';
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push('console: ' + m.text()); });
  await page.route(/react\/18\.2\.0\/umd\/react\.(development|production\.min)\.js/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, 'react-bundle.js')) }));
  await page.route(/react-dom\.(development|production\.min)\.js/, r => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.route(/cdnjs\.cloudflare\.com\/.*babel\.min\.js/, r => r.fulfill({ contentType: 'text/javascript', body: "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.src='/__app.js';document.body.appendChild(s);});" }));
  await page.route(/fonts\.googleapis\.com/, r => r.fulfill({ contentType: 'text/css', body: '' }));
  return page;
}
async function storageEmpty(page) {
  return page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0);
}
async function login(page, email, password, { complete2fa = true } = {}) {
  await page.goto(BASE + '/index.html');
  await page.getByPlaceholder('your@email.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: /Continue/ }).click();
  if (!complete2fa) return;
  const twoFa = page.locator('input[maxlength="1"]').first();
  const outcome = await Promise.race([
    twoFa.waitFor({ timeout: 8000 }).then(() => '2fa').catch(() => 'none'),
    page.getByText(/Sign-in failed/).first().waitFor({ timeout: 8000 }).then(() => 'failed').catch(() => 'none'),
  ]);
  if (outcome !== '2fa') return;
  page.lastLoginWasSetup = await page.getByText('Set Up Two-Factor Authentication').first().isVisible();
  const boxes = page.locator('input[maxlength="1"]');
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill('123456'[i]);
  await page.getByRole('button', { name: /Verify & Sign In/ }).click();
}
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: false });

(async () => {
  const browser = await chromium.launch();

  // ---------------- Login failures, register, forgot password
  {
    const page = await newPage(browser);
    await page.goto(BASE + '/index.html');
    await page.getByText('Sign In', { exact: true }).first().waitFor();
    await shot(page, '01-login');
    await login(page, 'pat@test.local', 'Pending123');
    await page.getByText(/New accounts can only sign in after an administrator approves/).first().waitFor();
    check('pending user login blocked with message', true);

    await page.getByRole('button', { name: /Request Access/ }).click();
    await page.getByPlaceholder('Your full name').fill('Nina New');
    await page.getByPlaceholder('your@email.com').nth(0).fill('nina@test.local');
    await page.getByPlaceholder('Choose a password').fill('short');
    await page.getByPlaceholder('Repeat your password').fill('short');
    await page.getByRole('button', { name: /Submit Registration/ }).click();
    check('register rejects weak password client-side', await page.getByText(/at least 8 characters/).first().isVisible());
    await page.getByPlaceholder('Choose a password').fill('NinaPass123');
    await page.getByPlaceholder('Repeat your password').fill('NinaPass123');
    await page.getByRole('button', { name: /Submit Registration/ }).click();
    await page.getByText('Registration Submitted!').first().waitFor();
    check('registration submitted to API', true);
    await shot(page, '02-registered');
    await page.getByRole('button', { name: /Back to Sign In/ }).click();

    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.getByText('Reset Password', { exact: true }).first().waitFor();
    const fp = page.locator('div', { hasText: 'Reset Password' }).last();
    await page.getByPlaceholder('your@email.com').nth(0).fill('lena@test.local');
    await page.getByPlaceholder('New password', { exact: true }).fill('LenaNew123');
    await page.getByPlaceholder('Repeat new password').fill('LenaNew123');
    await page.getByRole('button', { name: /Send Reset Request/ }).click();
    await page.getByText('Request Sent').first().waitFor();
    check('forgot-password request sent', await page.getByText(/current password keeps working/).first().isVisible());
    await shot(page, '03-forgot');
    check('no browser storage (login page)', await storageEmpty(page));
    check('no JS errors (login page)', page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();
  }

  // ---------------- 2FA login
  {
    const page = await newPage(browser);
    await login(page, 'tom@test.local', 'TwoFactor123', { complete2fa: false });
    await page.getByText('Two-Factor Verification').first().waitFor();
    const boxes = page.locator('input[maxlength="1"]');
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill('9');
    await page.getByRole('button', { name: /Verify & Sign In/ }).click();
    await page.getByText(/authenticator code is invalid/).first().waitFor();
    check('wrong 2FA code rejected', true);
    for (let i = 5; i >= 0; i--) await boxes.nth(i).fill('');
    const code = '123456';
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(code[i]);
    await page.getByRole('button', { name: /Verify & Sign In/ }).click();
    await page.getByText(/Welcome back, Tom/).first().waitFor();
    check('2FA login reaches learner dashboard', true);
    check('no JS errors (2FA)', page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();
  }

  // ---------------- Learner journey
  {
    const page = await newPage(browser);
    await login(page, 'lena@test.local', 'Learner123', { complete2fa: false });
    await page.getByText('Set Up Two-Factor Authentication').first().waitFor();
    check('first sign-in forces 2FA setup with QR code', await page.locator('img[alt="2FA QR code"]').isVisible() && await page.getByText('JBSWY3DPEHPK3PXP').first().isVisible());
    await shot(page, '05-forced-2fa-setup');
    const sboxes = page.locator('input[maxlength="1"]');
    for (let i = 0; i < 6; i++) await sboxes.nth(i).fill('123456'[i]);
    await page.getByRole('button', { name: /Verify & Sign In/ }).click();
    await page.getByText(/Welcome back, Lena/).first().waitFor();
    await page.getByText('Phishing Awareness').first().waitFor();
    await shot(page, '10-learner-home');
    check('learner sees published module from API', true);
    check('due-soon notification badge shown', await page.locator('button', { hasText: '🔔' }).innerText().then(t => /\d/.test(t)));

    // reload keeps session
    await page.reload();
    await page.getByText(/Welcome back, Lena/).first().waitFor();
    check('page refresh keeps the user signed in', true);

    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await page.getByRole('button', { name: /Start Module/ }).click();
    await page.getByText(/Phishing is pretending/).first().waitFor();
    check('training content shown', true);
    check('YouTube link embedded as iframe', await page.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]').count() === 1);
    await shot(page, '11-content');
    await page.getByRole('button', { name: /Take the Quiz/ }).click();
    await page.getByText('Which link is safe?').first().waitFor();
    await page.getByRole('button', { name: /university\.edu/ }).first().click();
    await page.getByText('🎉 Correct!').first().waitFor();
    check('answer marked correct by server', true);
    await shot(page, '12-quiz-answer');
    await page.getByRole('button', { name: /Next/ }).click();
    await page.getByText('Report phishing to?').first().waitFor();
    await page.getByRole('button', { name: /Nobody/ }).click();
    await page.getByText(/Incorrect — correct answer/).first().waitFor();
    check('wrong answer marked incorrect and explained', await page.getByText('IT handles it.').first().isVisible());
    await page.getByRole('button', { name: /View Results/ }).click();
    await page.getByText('50%').first().waitFor();
    check('result shows server score 50% and pass', await page.getByText(/Passed! Your certificate is ready/).first().isVisible());
    await shot(page, '13-result');
    await page.getByText('🏆 Your Certificate').first().waitFor({ timeout: 5000 });
    check('certificate view opens after passing', true);
    await shot(page, '14-cert');

    await page.getByRole('button', { name: /Certificates/ }).click();
    check('certificate listed', await page.getByText('Phishing Awareness').first().isVisible());

    // profile
    await page.locator('span', { hasText: '▾' }).click();
    await page.getByText('👤 My Profile').click();
    await page.getByText('My Profile', { exact: true }).first().waitFor();
    await page.getByText(/Phishing Awareness/).first().waitFor();
    check('quiz history listed on profile', await page.getByText(/1\/2 correct/).first().isVisible());
    await page.getByPlaceholder('+61 400 000 000').fill('0499 999 999');
    await page.getByPlaceholder('Your full name').fill('Lena L. Learner');
    await page.getByRole('button', { name: /Save Changes/ }).click();
    await page.getByText('Profile updated!').first().waitFor();
    check('profile saved via API', true);
    check('profile shows 2FA enabled', await page.getByText('Enabled', { exact: true }).first().isVisible());
    check('2FA cannot be turned off when required', !(await page.getByRole('button', { name: 'Turn off 2FA' }).isVisible()) && await page.getByText(/2FA is required for every account/).first().isVisible());
    await shot(page, '15-profile');

    // restart
    await page.getByRole('button', { name: /Modules/ }).first().click();
    await page.getByRole('button', { name: /Restart/ }).click();
    await page.getByText('🚀 Start Module').first().waitFor();
    check('restart resets progress via API', true);
    await page.getByRole('button', { name: /Back to Dashboard/ }).click();

    check('no browser storage (learner)', await storageEmpty(page));
    // sign out
    await page.locator('span', { hasText: '▾' }).click();
    await page.getByText('🚪 Sign Out').click();
    await page.getByText('Sign In', { exact: true }).first().waitFor();
    await page.reload();
    await page.getByText('Sign In', { exact: true }).first().waitFor();
    check('sign out ends server session (refresh stays signed out)', true);
    check('no JS errors (learner)', page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();
  }

  // ---------------- Owner journey
  {
    const page = await newPage(browser);
    await login(page, 'owner@test.local', 'Owner12345');
    await page.getByText('Owner Dashboard').first().waitFor();
    await shot(page, '20-owner-overview');
    await page.getByRole('button', { name: /📚 Modules/ }).click();
    await page.getByRole('button', { name: '+ New Module' }).click();
    await page.getByPlaceholder('e.g. Ransomware Defence').fill('Ransomware Defence');
    await page.getByPlaceholder('Brief description...').fill('Stop ransomware');
    await page.getByPlaceholder(/learning material/).first().fill('Back up your files.');
    await page.getByRole('button', { name: 'Create Module' }).click();
    await page.getByText(/Module created!/).first().waitFor();
    const row = page.locator('div', { hasText: 'Ransomware Defence' }).filter({ has: page.getByRole('button', { name: /publish/i }) }).last();
    check('new module created as Draft', await row.getByText('Draft').first().isVisible());
    await row.getByRole('button', { name: /🚀 Publish/ }).click();
    await page.getByText(/Add at least one quiz question/).first().waitFor();
    check('cannot publish without questions', true);

    await row.getByRole('button', { name: /❓ Quiz/ }).click();
    await page.getByPlaceholder('Type your question here...').fill('What should you keep?');
    for (const [i, t] of ['Backups', 'Ransom notes', 'Passwords on paper', 'Nothing'].entries()) await page.getByPlaceholder('Option ' + 'ABCD'[i]).fill(t);
    await page.getByRole('button', { name: /Save Quiz/ }).click();
    await page.getByText('Quiz saved!').first().waitFor();
    check('quiz saved via API', await row.getByText('1 questions').first().isVisible());
    await row.getByRole('button', { name: /🚀 Publish/ }).click();
    await page.getByText(/Module published/).first().waitFor();
    check('module published', await row.getByText('Published').first().isVisible());

    await row.getByRole('button', { name: /Edit/ }).click();
    await page.getByRole('textbox').first().fill('Ransomware Defence 2');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.getByText('Saved!').first().waitFor();
    check('module edit persisted', await page.getByText('Ransomware Defence 2').first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false));

    const row2 = page.locator('div', { hasText: 'Ransomware Defence 2' }).filter({ has: page.getByRole('button', { name: /publish/i }) }).last();
    await row2.getByRole('button', { name: /📹 Video/ }).click();
    await page.getByPlaceholder(/youtube\.com\/watch/).fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save Video' }).click();
    await page.getByText(/must start with http/).first().waitFor();
    check('javascript: video link rejected', true);
    await page.getByRole('button', { name: '🗑 Remove Video' }).click();
    await page.getByPlaceholder(/youtube\.com\/watch/).fill('https://vimeo.com/76979871');
    await page.getByRole('button', { name: 'Save Video' }).click();
    await page.getByText('Video updated!').first().waitFor();
    check('video link saved', await row2.getByText('Linked video').first().isVisible());

    await row2.getByRole('button', { name: /🏆 Cert/ }).click();
    await page.getByPlaceholder('e.g. Phishing Awareness Training').fill('Ransomware Ready');
    await page.getByRole('button', { name: /Save Certificate/ }).click();
    await page.getByText('Certificate saved!').first().waitFor();
    check('certificate saved', true);

    // delete attempted module -> conflict
    const phish = page.locator('div', { hasText: 'Phishing Awareness' }).filter({ has: page.getByRole('button', { name: /publish/i }) }).last();
    await phish.getByRole('button', { name: '🗑' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByText(/kept for their records/).first().waitFor();
    check('cannot delete module with learner attempts', true);
    await shot(page, '21-owner-modules');

    await page.getByRole('button', { name: /📈 Completion/ }).click();
    await page.getByText('Learner Progress').first().waitFor();
    check('learner progress tab lists learners', await page.getByText('lena@test.local').first().isVisible());
    await shot(page, '22-owner-completion');
    await page.getByRole('button', { name: '🔐 Security' }).click();
    await page.getByText('Account Security').first().waitFor();
    await page.getByText('2FA is required for every account').first().waitFor();
    check('owner security window shows 2FA on, no turn-off', !(await page.getByRole('button', { name: 'Turn off 2FA' }).isVisible()));
    check('no browser storage (owner)', await storageEmpty(page));
    check('no JS errors (owner)', page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();
  }

  // ---------------- Admin journey
  {
    const page = await newPage(browser);
    await login(page, 'admin@test.local', 'AdminPass123');
    await page.getByText('System Overview').first().waitFor();
    await page.getByText(/registration\(s\) and/).first().waitFor();
    await shot(page, '30-admin-overview');
    check('overview shows pending work banner', true);

    await page.getByRole('button', { name: /⏳ Pending/ }).click();
    await page.getByText('Pending Registrations').first().waitFor();
    const nina = page.locator('div', { hasText: 'nina@test.local' }).filter({ has: page.getByRole('button', { name: /Approve/ }) }).last();
    await nina.getByRole('button', { name: /Approve & Activate/ }).click();
    await page.getByText(/Nina New approved/).first().waitFor();
    check('approve registration via API', true);
    const pat = page.locator('div', { hasText: 'pat@test.local' }).filter({ has: page.getByRole('button', { name: /Reject/ }) }).last();
    await pat.getByRole('button', { name: /Reject/ }).click();
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await page.getByText('Registration rejected').first().waitFor();
    check('reject registration via API', await page.getByText('No pending registrations').first().isVisible());

    await page.getByRole('button', { name: /👥 Users/ }).click();
    await page.getByText(/accounts$/).first().waitFor();
    await page.getByPlaceholder(/Search by name/).fill('pat');
    check('search filters users', await page.getByText('1 of').first().isVisible() && await page.getByText('Rejected').first().isVisible());
    await page.getByPlaceholder(/Search by name/).fill('');
    await page.locator('select').nth(0).selectOption('owner');
    check('role filter works', await page.getByText('Owen Owner').first().isVisible() && !(await page.getByText('Lena Learner').first().isVisible()));
    await page.locator('select').nth(0).selectOption('all');
    await page.locator('select').nth(1).selectOption('active');
    check('status filter works', !(await page.getByText('Pat Pending').first().isVisible()));
    await page.locator('select').nth(1).selectOption('all');
    check('2FA badge visible in list', await page.getByText('2FA', { exact: true }).first().isVisible());
    await shot(page, '31-admin-users');

    await page.getByText('Nina New', { exact: true }).click();
    await page.getByText('← All Users').first().waitFor();
    await page.locator('select').selectOption('MODULE_OWNER');
    await page.getByText(/is now a Module Owner/).first().waitFor();
    check('role change saved', await page.getByText('owner', { exact: true }).first().isVisible());
    await page.getByRole('button', { name: 'Deactivate account' }).click();
    await page.getByText(/Nina New deactivated/).first().waitFor();
    check('deactivate account', await page.getByRole('button', { name: 'Activate account' }).isVisible());
    await shot(page, '32-admin-user-detail');

    await page.getByText('← All Users').click();
    await page.getByText('Tom Totp', { exact: true }).click();
    await page.getByRole('button', { name: /Reset 2FA/ }).click();
    await page.getByRole('button', { name: 'Reset 2FA', exact: true }).click();
    await page.getByText('2FA reset for Tom Totp').first().waitFor();
    check('admin resets a user\'s 2FA', await page.getByText('Not enabled').first().isVisible());

    await page.getByRole('button', { name: /🔑 Password Resets/ }).click();
    await page.getByText('Password Reset Requests').first().waitFor();
    await page.getByRole('button', { name: '✓ Approve' }).click();
    await page.getByText(/New password activated for lena@test.local/).first().waitFor();
    check('approve password reset', await page.getByText('APPROVED').first().isVisible());
    await shot(page, '33-admin-resets');

    await page.getByRole('button', { name: /📚 Modules/ }).click();
    await page.getByText('All Modules').first().waitFor();
    check('admin module list from API with owner', await page.getByText('👤 Owen Owner').first().isVisible());

    await page.getByRole('button', { name: /🧾 Audit Log/ }).click();
    await page.locator('table').waitFor();
    check('audit log shows entries', await page.getByText('REGISTRATION APPROVED').first().isVisible());
    await shot(page, '34-admin-audit');
    check('no browser storage (admin)', await storageEmpty(page));
    check('no JS errors (admin)', page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();
  }

  // ---------------- new password works after approval; disabled user blocked
  {
    const page = await newPage(browser);
    await login(page, 'lena@test.local', 'LenaNew123');
    // Lena enabled 2FA earlier
    await page.getByText('Two-Factor Verification').first().waitFor();
    check('approved new password accepted (2FA step shown)', true);
    await page.context().close();
    const p3 = await newPage(browser);
    await login(p3, 'tom@test.local', 'TwoFactor123', { complete2fa: false });
    await p3.getByText('Set Up Two-Factor Authentication').first().waitFor();
    check('after admin reset, user must set up 2FA again', true);
    await p3.context().close();
    const p2 = await newPage(browser);
    await login(p2, 'nina@test.local', 'NinaPass123');
    await p2.getByText(/Sign-in failed/).first().waitFor();
    check('deactivated account cannot sign in', true);
    await p2.context().close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'e2e-results.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
