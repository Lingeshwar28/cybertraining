# CyberShield – Cybersecurity Training Application

Java 21 · Spring Boot 4.1.1 · Spring Security · MySQL · React front end in `index.html`

The whole application now runs from **one page**: `http://localhost:8080` (or `/index.html`).
Every piece of data is saved in MySQL through the Spring Boot API. **Nothing is stored in
`localStorage` or `sessionStorage`.**

---

## 1. What changed in this version

| Area | Before | Now |
|---|---|---|
| Front end | `index.html` **plus** 17 separate Thymeleaf pages | Only `index.html` (design kept) |
| Registration | Saved in browser storage | `POST /api/auth/register` → MySQL, status `PENDING` |
| Login / 2FA | Worked, but logout only cleared the screen and a refresh logged you out | Same login + 2FA flow; real server logout; refresh keeps you signed in |
| 2FA setup | Separate Thymeleaf page | Inside the app (learner profile, "🔐 Security" button for owners/admins) |
| Admin: approve / reject / disable / roles | Browser storage only | MySQL via `/admin/api/...` |
| Password reset | Missing | Forgot-password form → admin approves/rejects |
| Modules, quizzes, videos, certificates | Browser storage | MySQL (videos saved in the `uploads/` folder) |
| Quiz marking | In the browser (answers visible in page code) | On the server, one answer at a time |
| Learner progress | Browser storage | `module_enrollments` + `quiz_attempts` tables |
| Audit log | Table existed, never used | Records logins, approvals, role changes, resets, module edits |

### Files removed (and why)

| Removed | Reason |
|---|---|
| `src/main/resources/templates/*` (17 pages) and `static/style.css` | Duplicate interface. Every feature now lives in `index.html`; no controller uses these pages anymore. |
| `AccountController`, `TwoFactorController`, `TwoFactorLoginController`, `UserDashboardController`, `UserModuleController`, `QuizController`, `QuizResultController`, `ModuleOwnerController`, `QuestionManagementController`, `HomeController`, `ModuleApiController`, `GlobalModelAttributes` | They only served the Thymeleaf pages. `ModuleApiController` also leaked the owner's password hash and 2FA secret (it returned the `Module` entity with its `owner`). |
| `Notification`, `Schedule`, `Pathway`, `PathwayModule`, `PasswordResetToken` (+ repositories) | Never used anywhere. Due dates live on the module; reminders are worked out from them. `PasswordResetToken` was replaced by `PasswordResetRequest` (admin-approved flow). |
| `AdminUserResponse` (model), `CreateUserRequest` (security) | Moved into the new `dto` package. |
| Thymeleaf + validation dependencies, `HELP.md`, `INTEGRATION-NOTES.md` | No longer used / out of date. |

### Project structure

```
src/main/java/com/cybersecurity/cybertraining/
├── CybertrainingApplication.java
├── config/DataInitializer.java        first admin + 4 starter modules
├── controller/
│   ├── AuthController.java            /api/auth/**   login, 2FA, register, forgot password, logout
│   ├── ProfileController.java         /api/me/**     profile, 2FA setup
│   ├── LearnerController.java         /api/learner/** modules, quiz attempts, progress
│   ├── OwnerController.java           /api/owner/**  module + quiz management
│   ├── AdminController.java           /admin/api/**  users, approvals, resets, audit
│   ├── VideoController.java           /api/modules/{id}/video
│   └── ApiExceptionHandler.java       turns errors into {"message": "..."}
├── dto/Requests.java, Responses.java  JSON shapes (never contain passwords or 2FA secrets)
├── model/                             JPA entities (tables)
├── repository/                        Spring Data repositories
├── security/                          SecurityConfig, TwoFactorConfig, RateLimiter, CurrentUser, ClientIp
└── service/                           business rules
src/main/resources/static/index.html   the only front end
src/test/java/.../CybertrainingApplicationTests.java   automated end-to-end tests
database/optional-cleanup.sql          drops the old unused tables (optional)
```

---

## 2. Run it in IntelliJ (step by step)

1. **Unzip** this project and open the `cybertraining` folder in IntelliJ (*File → Open*). Wait for Maven to finish loading (bottom-right progress bar).
2. Make sure **MySQL is running**. The database `cybersecuritytraining` is created automatically if it does not exist.
3. Open *Run → Edit Configurations… → CybertrainingApplication*. In **Environment variables** add:
   ```
   DB_PASSWORD=your_mysql_password;ADMIN_PASSWORD=Admin12345
   ```
   - `ADMIN_PASSWORD` is only used if your database has **no ADMIN account yet**. It then creates `admin@cybershield.local` with that password (must be 8+ characters with a letter and a number). Add `ADMIN_EMAIL=you@uni.edu` to choose a different email.
   - If you already have an admin in MySQL, it is left untouched.
4. Click **Run ▶** on `CybertrainingApplication`. Wait for `Started CybertrainingApplication` in the console.
5. Open **http://localhost:8080** in your browser.

### First-time setup inside the app

1. Sign in as the admin.
2. **Owners → + Create Owner**: create a module-owner account.
3. **Restart** the application once. Because the modules table is empty and a module owner now exists, four starter modules (Phishing, Passwords & MFA, Social Engineering, Malware & Ransomware) are added and published, owned by that module owner. Turn this off with `app.seed-demo-content=false` in `application.properties`.
4. Sign out, click **Request Access** to register a learner, then approve them as admin.

> Hibernate's `ddl-auto=update` adds the new columns/tables automatically (`users.phone`, `users.photo`, several `modules` columns, `questions.hint`, and the `password_reset_requests` table). It never deletes data.

---

## 3. Run the automated tests

Right-click `src/test/java/com/cybersecurity/cybertraining/CybertrainingApplicationTests.java` → **Run**.
(Or in a terminal: `./mvnw test` on Mac/Linux, `mvnw.cmd test` on Windows.)

The tests start the real application with an in-memory H2 database (your MySQL data is not touched) and use the same API as `index.html`, including CSRF tokens and session cookies. They cover:

| Test | Expected result |
|---|---|
| Register a new user | Saved as `PENDING`, password BCrypt-hashed |
| Pending user attempts login | Blocked |
| Admin approves user | Status becomes `APPROVED` |
| Approved user logs in | Succeeds; `/api/auth/me` keeps the session |
| User with 2FA enabled logs in | Authenticator code required; wrong code rejected |
| Admin rejects registration | Login blocked |
| Admin disables account | Login blocked and the open session loses access |
| Admin changes role | New role saved; `ADMIN` cannot be assigned |
| User requests password reset | Pending request; old password still works; unknown email gets the same answer |
| Admin approves / rejects reset | New password active / unchanged |
| Module owner creates, edits, publishes | Saved; learners only see it once published; can't publish with no questions |
| User completes quiz | Attempt + answers saved, scored on the server, answers can't be changed |
| User completes module | Progress saved (`module_enrollments.completed = true`) |
| Log out and log in again | Progress and quiz history still there |
| Role-based access | Learner gets 403 on admin/owner APIs; anonymous gets 401; missing CSRF token gets 403 |
| `index.html` | Contains no `localStorage` / `sessionStorage` |

---

## 4. Manual demo checklist (in the browser)

1. **Register**: login page → *Request Access* → fill in → "Registration Submitted!". In MySQL: `SELECT email, approval_status FROM users;` → `PENDING`.
2. **Pending login**: try to sign in → red message, not signed in.
3. **Approve**: sign in as admin → *Pending* → *Approve & Activate*.
4. **Learner**: sign in → open a module → *Start Module* → read content/watch video → *Take the Quiz* → results → certificate. Refresh the page: still signed in. Sign out and back in: progress is still there.
5. **2FA**: learner → profile (name ▾ → My Profile) → *Set up 2FA* → scan the QR with Google/Microsoft Authenticator → enter code. Sign out, sign in again → 6-digit code required. Owners and admins use the **🔐 Security** button in the sidebar.
6. **Forgot password**: login page → *Forgot password?* → admin → *Password Resets* → *Approve*. The new password works; the old one stops working.
7. **Module owner**: *Modules → + New Module* (starts as **Draft**) → *❓ Quiz* (add questions) → *🚀 Publish* → *📹 Video* (upload a file or paste a YouTube/Vimeo/.mp4 link) → *🏆 Cert*.
8. **Admin**: *Users* tab → search and filter by role/status → click a user → change role / deactivate. *Audit Log* shows everything that happened.
9. **Browser storage check**: press F12 → *Application* tab → *Local Storage* and *Session Storage* for `localhost:8080` are empty.

---

## 5. API reference (used by `index.html`)

| Method & URL | Who | Purpose |
|---|---|---|
| `GET /api/auth/csrf` | anyone | CSRF token for POST/PUT/PATCH/DELETE (header `X-XSRF-TOKEN`) |
| `GET /api/auth/me` | anyone | Who is signed in (after a refresh) |
| `POST /api/auth/login` | anyone | Step 1: email + password |
| `POST /api/auth/verify-2fa` | anyone | Step 2: authenticator code |
| `POST /api/auth/register` | anyone | New account (PENDING) |
| `POST /api/auth/forgot-password` | anyone | Password reset request |
| `POST /api/auth/logout` | signed in | Ends the session |
| `GET/PUT /api/me/profile` | signed in | Own profile (name, phone, photo) |
| `POST /api/me/2fa/setup` · `/enable` · `/disable` | signed in | Authenticator setup |
| `GET /api/learner/modules` | USER | Published modules + own progress |
| `POST /api/learner/modules/{id}/attempts` | USER | Start quiz (questions without answers) |
| `POST /api/learner/attempts/{id}/answers` | USER | Answer one question |
| `POST /api/learner/attempts/{id}/finish` | USER | Submit → score / pass |
| `POST /api/learner/modules/{id}/restart` | USER | Reset own progress |
| `GET /api/learner/attempts` | USER | Quiz history |
| `GET/POST /api/owner/modules` | MODULE_OWNER | Own modules / create |
| `PUT /api/owner/modules/{id}` | MODULE_OWNER | Edit details, content, video link, certificate |
| `PATCH /api/owner/modules/{id}/published` | MODULE_OWNER | Publish / unpublish |
| `PUT /api/owner/modules/{id}/questions` | MODULE_OWNER | Save quiz |
| `POST /api/owner/modules/{id}/video` | MODULE_OWNER | Upload video (multipart `file`) |
| `DELETE /api/owner/modules/{id}` | MODULE_OWNER | Delete (only if no learner has attempted it) |
| `GET /api/owner/learners` | MODULE_OWNER | Learner progress on own modules |
| `GET/POST /admin/api/users` | ADMIN | List / create USER or MODULE_OWNER |
| `POST /admin/api/users/{id}/approve` · `/reject` | ADMIN | Registration decisions |
| `PUT /admin/api/users/{id}/role` · `/status` | ADMIN | Role (USER ↔ MODULE_OWNER) / enable-disable |
| `GET /admin/api/modules` | ADMIN | All modules with completion stats |
| `GET /admin/api/password-resets`, `POST …/{id}/approve` · `/reject` | ADMIN | Reset requests |
| `GET /admin/api/audit-logs` | ADMIN | Latest 200 audit entries |
| `GET /api/modules/{id}/video` | signed in | Stream an uploaded video |

---

## 6. Security review summary

- **Passwords**: BCrypt for accounts and for pending reset passwords. Policy: 8–72 characters with a letter and a number (checked in the browser *and* on the server).
- **Pending / rejected / disabled accounts** cannot sign in (`DatabaseUserDetailsService` + `AuthController`). They also lose access mid-session: every API call re-checks the account (`CurrentUser`).
- **2FA**: TOTP (authenticator app). The session is not authenticated until the code is verified. The setup secret stays in the server session until confirmed. Turning 2FA off needs a current code.
- **Sessions**: the session ID changes at login (prevents session fixation). Logout invalidates the session. Cookies are `HttpOnly`, `SameSite=Lax`, 30-minute timeout. Set `server.servlet.session.cookie.secure=true` when using HTTPS.
- **CSRF**: required on every POST/PUT/PATCH/DELETE, including login.
- **Role-based access**: enforced by URL in `SecurityConfig`. Owners can only change their own modules (checked in `ModuleService`). Admins cannot be demoted or disabled through the API.
- **No sensitive data in responses**: all endpoints return DTO records, never entities, so no password hashes or 2FA secrets. Error messages are generic, with no stack traces.
- **No user enumeration**: registration and forgot-password give the same answer whether or not the email exists. Login failures use one generic message.
- **Brute-force protection**: rate limits on login (per IP and per email), 2FA codes, registration and forgot-password.
- **SQL injection**: only Spring Data JPA derived queries are used (parameterised), with no hand-built SQL.
- **Input validation**: lengths, email format, hex colours, video links must be `http(s)://` (no `javascript:`), uploads limited to video types and 200 MB, profile photos limited to images under 1 MB.
- **Quiz integrity**: correct answers are never sent before the learner answers. Each answer is locked once submitted, and scores are calculated on the server.
- **Audit log** of security-relevant actions.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `Access denied for user 'root'` | `DB_PASSWORD` is wrong or missing in the run configuration. |
| Console says "No ADMIN account exists" | Add `ADMIN_PASSWORD=...` to the environment variables and restart. |
| Emojis (🎣) show as `?` or saving a module fails | Your database was created with an old character set. In MySQL run `ALTER DATABASE cybersecuritytraining CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;` and `ALTER TABLE modules CONVERT TO CHARACTER SET utf8mb4;` |
| "Your security token expired" | Refresh the page; the app also retries once automatically. |
| Port 8080 already in use | Stop the other running copy, or change `server.port`. |
| The page is blank | `index.html` loads React and Babel from cdnjs, so the computer needs internet access. |
