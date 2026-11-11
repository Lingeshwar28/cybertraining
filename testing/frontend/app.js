const { useState, useEffect, useRef, useCallback, useMemo } = React;
const api = /* @__PURE__ */ (() => {
  let csrf = null;
  const getCsrf = async () => {
    if (csrf) return csrf;
    const r = await fetch("/api/auth/csrf", { credentials: "same-origin", headers: { "Accept": "application/json" } });
    if (!r.ok) throw new Error("Could not get a security token from the server.");
    csrf = await r.json();
    return csrf;
  };
  async function request(method, url, body, retried = false) {
    const headers = { "Accept": "application/json" };
    const opts = { method, credentials: "same-origin", headers };
    if (method !== "GET") {
      const t = await getCsrf();
      headers[t.headerName] = t.token;
    }
    if (body instanceof FormData) opts.body = body;
    else if (body !== void 0) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      throw new Error("Cannot reach the server. Make sure CyberShield is running and try again.");
    }
    if (res.status === 403 && method !== "GET" && !retried) {
      csrf = null;
      return request(method, url, body, true);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data && data.message || "Request failed (" + res.status + ").");
      err.status = res.status;
      if (res.status === 401 && !url.startsWith("/api/auth/")) window.dispatchEvent(new Event("cs-session-expired"));
      throw err;
    }
    return data;
  }
  return {
    get: (u) => request("GET", u),
    post: (u, b = {}) => request("POST", u, b),
    put: (u, b) => request("PUT", u, b),
    patch: (u, b) => request("PATCH", u, b),
    del: (u) => request("DELETE", u),
    upload: (u, formData) => request("POST", u, formData),
    resetCsrf: () => {
      csrf = null;
    }
  };
})();
const AVATAR_COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#ec4899", "#f59e0b"];
const initialsOf = (name) => (name || "U").trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const colorFor = (id) => AVATAR_COLORS[Math.abs(Number(id) || 0) % AVATAR_COLORS.length];
function toClientUser(u) {
  const role = String(u.role || "USER").toUpperCase();
  return {
    id: u.id,
    email: u.email,
    name: u.name || u.email,
    role: role === "ADMIN" ? "admin" : role === "MODULE_OWNER" ? "owner" : "user",
    twoFactorEnabled: !!u.twoFactorEnabled,
    avatar: initialsOf(u.name || u.email),
    color: colorFor(u.id),
    active: true
  };
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : "-";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString() : "-";
function embedUrl(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/i);
  if (m) return "https://www.youtube-nocookie.com/embed/" + m[1];
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (m) return "https://player.vimeo.com/video/" + m[1];
  return null;
}
function VideoPlayer({ url, style }) {
  const embed = embedUrl(url);
  if (embed) return /* @__PURE__ */ React.createElement("iframe", { src: embed, title: "Training video", allow: "encrypted-media; picture-in-picture; fullscreen", allowFullScreen: true, style: { width: "100%", aspectRatio: "16/9", border: "none", borderRadius: 14, background: "#000", ...style } });
  return /* @__PURE__ */ React.createElement("video", { controls: true, src: url, style: { width: "100%", borderRadius: 14, background: "#000", ...style } });
}
function Toast({ toasts, remove }) {
  return /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" } }, toasts.map((t) => /* @__PURE__ */ React.createElement("div", { key: t.id, onClick: () => remove(t.id), style: {
    background: t.type === "err" ? "rgba(239,68,68,0.95)" : t.type === "warn" ? "rgba(245,158,11,0.95)" : "rgba(16,185,129,0.95)",
    color: "white",
    padding: "12px 20px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    animation: "notif-in 0.3s ease",
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    maxWidth: 320,
    pointerEvents: "all"
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 16 } }, t.type === "err" ? "\u2715" : t.type === "warn" ? "\u26A0" : "\u2713"), t.msg)));
}
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4e3);
  }, []);
  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, add, remove };
}
function Confirm({ msg, onYes, onNo }) {
  if (!msg) return null;
  return /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2e3, display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "2rem", maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 40, marginBottom: 12 } }, "\u26A0\uFE0F"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: 24, color: "var(--textm)", lineHeight: 1.6 } }, msg), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "center" } }, /* @__PURE__ */ React.createElement("button", { onClick: onNo, style: { flex: 1, padding: "11px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, fontWeight: 600 } }, "Cancel"), /* @__PURE__ */ React.createElement("button", { onClick: onYes, style: { flex: 1, padding: "11px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, color: "#f87171", fontSize: 14, fontWeight: 600 } }, "Delete"))));
}
function Modal({ title, onClose, children, width = 560 }) {
  return /* @__PURE__ */ React.createElement("div", { onClick: (e) => e.target === e.currentTarget && onClose(), style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1e3, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, width: "100%", maxWidth: width, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "1.25rem 1.75rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 17, fontWeight: 700 } }, title), /* @__PURE__ */ React.createElement("button", { onClick: onClose, style: { background: "rgba(255,255,255,0.08)", border: "none", color: "var(--textm)", width: 32, height: 32, borderRadius: "50%", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" } }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: { padding: "1.5rem 1.75rem", overflowY: "auto", flex: 1 } }, children)));
}
function Inp({ label, value, onChange, type = "text", placeholder, rows, disabled }) {
  const [focus, setFocus] = useState(false);
  const base = { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: `1.5px solid ${focus ? "var(--purple)" : "var(--border)"}`, borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none", transition: "border-color 0.2s" };
  return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, label && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 } }, label), rows ? /* @__PURE__ */ React.createElement("textarea", { value, onChange: (e) => onChange(e.target.value), placeholder, rows, onFocus: () => setFocus(true), onBlur: () => setFocus(false), style: { ...base, resize: "vertical" } }) : /* @__PURE__ */ React.createElement("input", { type, value, onChange: (e) => onChange(e.target.value), placeholder, disabled, onFocus: () => setFocus(true), onBlur: () => setFocus(false), style: { ...base, opacity: disabled ? 0.5 : 1 } }));
}
function Btn({ children, onClick, variant = "primary", size = "md", disabled = false, style = {} }) {
  const vs = {
    primary: { background: "linear-gradient(135deg,#7c3aed,#9d5bff)", color: "white", border: "none" },
    secondary: { background: "rgba(124,58,237,0.15)", color: "var(--purple2)", border: "1px solid rgba(124,58,237,0.3)" },
    danger: { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" },
    success: { background: "linear-gradient(135deg,#059669,#10b981)", color: "white", border: "none" },
    cyan: { background: "linear-gradient(135deg,#0891b2,#06b6d4)", color: "white", border: "none" },
    ghost: { background: "rgba(255,255,255,0.06)", color: "var(--textm)", border: "1px solid var(--border)" },
    amber: { background: "linear-gradient(135deg,#d97706,#f59e0b)", color: "white", border: "none" }
  }[variant] || { background: "linear-gradient(135deg,#7c3aed,#9d5bff)", color: "white", border: "none" };
  const ss = { sm: { padding: "6px 14px", fontSize: 13, borderRadius: 8 }, md: { padding: "10px 20px", fontSize: 14, borderRadius: 10 }, lg: { padding: "13px 28px", fontSize: 15, borderRadius: 12 } }[size] || { padding: "10px 20px", fontSize: 14, borderRadius: 10 };
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick,
      disabled,
      style: { ...vs, ...ss, fontFamily: "Space Grotesk,sans-serif", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "opacity 0.2s,transform 0.15s", display: "inline-flex", alignItems: "center", gap: 6, ...style },
      onMouseEnter: (e) => {
        if (!disabled) e.currentTarget.style.transform = "translateY(-1px)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.transform = "";
      }
    },
    children
  );
}
function Badge({ color, children }) {
  return /* @__PURE__ */ React.createElement("span", { style: { background: `${color}22`, color, border: `1px solid ${color}44`, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.06em", display: "inline-block" } }, children);
}
function PBar({ value, color = "#7c3aed", height = 8 }) {
  return /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(255,255,255,0.08)", borderRadius: 100, height, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { height: "100%", width: `${Math.min(100, Math.max(0, value))}%`, background: `linear-gradient(90deg,${color},${color}bb)`, borderRadius: 100, transition: "width 0.6s ease" } }));
}
function Ava({ initials, color, size = 40 }) {
  return /* @__PURE__ */ React.createElement("div", { style: { width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${color},${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 700, color: "white", flexShrink: 0, boxShadow: `0 0 12px ${color}44` } }, initials);
}
function Spinner() {
  return /* @__PURE__ */ React.createElement("div", { style: { width: 20, height: 20, border: "2px solid rgba(255,255,255,0.2)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.7s linear infinite" } });
}
function LoginPage({ onLogin }) {
  const [step, setStep] = useState("creds");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [pendingUser, setPendingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { toasts, add, remove } = useToast();
  const refs = useRef([]);
  const finishLogin = (data) => {
    api.resetCsrf();
    const signedInUser = toClientUser(data.user);
    add("Welcome, " + signedInUser.name + "!", "ok");
    setTimeout(() => onLogin(signedInUser), 250);
  };
  const handleCreds = async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await api.post("/api/auth/login", { email: email.trim(), password });
      if (data.requiresTwoFactor) {
        setPendingUser({ email: email.trim(), setup: null });
        setStep("2fa");
        setCode("");
        add("Enter the code from your authenticator app", "ok");
        return;
      }
      if (data.requiresTwoFactorSetup) {
        setPendingUser({ email: email.trim(), setup: { qrCode: data.qrCode, secret: data.secret } });
        setStep("2fa");
        setCode("");
        add("Two-factor authentication is required \u2014 set it up now", "warn");
        return;
      }
      if (data.authenticated) {
        finishLogin(data);
        return;
      }
      setErr(data.message || "The server did not complete the login.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };
  const handle2FA = async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await api.post("/api/auth/verify-2fa", { code });
      if (!data.authenticated) {
        setErr(data.message || "Incorrect verification code. Please try again.");
        return;
      }
      finishLogin(data);
    } catch (e) {
      setErr(e.message);
      if (e.status === 401 && /expired|sign in again/i.test(e.message)) {
        setStep("creds");
        setCode("");
      }
    } finally {
      setLoading(false);
    }
  };
  const handleOTPInput = (i, val) => {
    const v = val.replace(/\D/g, "");
    const arr = code.split("");
    arr[i] = v;
    const newCode = arr.join("").slice(0, 6);
    setCode(newCode);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (!v && i > 0) refs.current[i - 1]?.focus();
  };
  return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" } }, /* @__PURE__ */ React.createElement(Toast, { toasts, remove }), showRegister && /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", padding: "2rem" } }, /* @__PURE__ */ React.createElement(RegisterPage, { onBack: () => setShowRegister(false), onRegistered: () => add("Registration submitted! Admin will review your request.", "ok") }))), showForgot && /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", padding: "2rem" } }, /* @__PURE__ */ React.createElement(ForgotPasswordPage, { initialEmail: email, onBack: () => setShowForgot(false) }))), ["#7c3aed", "#06b6d4", "#ec4899", "#10b981"].map((c, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: {
    position: "absolute",
    width: 350 + i * 80,
    height: 350 + i * 80,
    borderRadius: "50%",
    background: `radial-gradient(circle,${c}18,transparent 70%)`,
    top: ["-8%", "55%", "-15%", "45%"][i],
    left: ["-8%", "-12%", "68%", "62%"][i],
    animation: `float ${4 + i * 0.7}s ease-in-out infinite`,
    animationDelay: `${i * 0.4}s`,
    pointerEvents: "none"
  } })), /* @__PURE__ */ React.createElement("div", { style: { position: "relative", zIndex: 1, width: "100%", maxWidth: 440, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginBottom: 28 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 52, marginBottom: 8, animation: "float 3s ease-in-out infinite" } }, "\u{1F6E1}\uFE0F"), /* @__PURE__ */ React.createElement("h1", { style: { fontFamily: "Syne,sans-serif", fontSize: 30, fontWeight: 800, background: "linear-gradient(135deg,#7c3aed,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } }, "CyberShield"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", fontSize: 14, marginTop: 4 } }, "Cybersecurity Awareness Platform")), /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" } }, step === "creds" ? /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem" } }, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 } }, "Sign In"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", fontSize: 13, marginBottom: 24 } }, "Enter your credentials to continue"), err && /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16 } }, err), /* @__PURE__ */ React.createElement(Inp, { label: "Email Address", value: email, onChange: setEmail, type: "email", placeholder: "your@email.com" }), /* @__PURE__ */ React.createElement("div", { onKeyDown: (e) => e.key === "Enter" && !loading && email && password && handleCreds() }, /* @__PURE__ */ React.createElement(Inp, { label: "Password", value: password, onChange: setPassword, type: "password", placeholder: "Enter your password" })), /* @__PURE__ */ React.createElement(
    "button",
    {
      onKeyDown: (e) => e.key === "Enter" && !loading && email && password && handleCreds(),
      onClick: handleCreds,
      disabled: !email || !password || loading,
      style: { width: "100%", padding: "13px", background: !email || !password || loading ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg,#7c3aed,#9d5bff)", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: !email || !password || loading ? "not-allowed" : "pointer", transition: "all 0.2s", marginTop: 4 }
    },
    loading ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Spinner, null), " Verifying\u2026") : /* @__PURE__ */ React.createElement(React.Fragment, null, "Continue \u2192")
  ), /* @__PURE__ */ React.createElement("button", { onClick: () => setShowForgot(true), style: { width: "100%", background: "none", border: "none", color: "var(--textm)", fontSize: 12, cursor: "pointer", padding: "10px 0 0" } }, "Forgot password?")) : /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem" } }, /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 44, marginBottom: 10, animation: "pulse-dot 1.5s infinite" } }, "\u{1F4F1}"), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 } }, pendingUser?.setup ? "Set Up Two-Factor Authentication" : "Two-Factor Verification"), pendingUser?.setup ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { style: { fontSize: 13, color: "var(--textm)", lineHeight: 1.6 } }, "2FA is required for every account. Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy\u2026), then enter the 6-digit code it shows."), pendingUser.setup.qrCode && /* @__PURE__ */ React.createElement("img", { src: pendingUser.setup.qrCode, alt: "2FA QR code", style: { width: 170, height: 170, borderRadius: 12, background: "white", padding: 6, margin: "14px auto 8px", display: "block" } }), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12, color: "var(--textl)" } }, "Can't scan? Type this key: ", /* @__PURE__ */ React.createElement("code", { style: { color: "var(--cyan2)", wordBreak: "break-all" } }, pendingUser.setup.secret))) : /* @__PURE__ */ React.createElement("p", { style: { fontSize: 13, color: "var(--textm)" } }, "Enter the 6-digit code from your authenticator app"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12, color: "var(--textl)", marginTop: 4 } }, "Account: ", pendingUser?.email)), err && /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: "center" } }, err), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 } }, [0, 1, 2, 3, 4, 5].map((i) => /* @__PURE__ */ React.createElement(
    "input",
    {
      key: i,
      ref: (el) => {
        refs.current[i] = el;
      },
      inputMode: "numeric",
      autoComplete: "one-time-code",
      maxLength: 1,
      value: code[i] || "",
      onChange: (e) => handleOTPInput(i, e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus();
        if (e.key === "Enter" && code.length === 6) handle2FA();
      },
      style: { width: 48, height: 56, textAlign: "center", fontSize: 24, fontWeight: 700, background: "rgba(255,255,255,0.06)", border: `2px solid ${code[i] ? "var(--purple)" : "var(--border)"}`, borderRadius: 12, color: "var(--text)", outline: "none", transition: "border-color 0.2s" }
    }
  ))), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: handle2FA,
      disabled: code.length !== 6 || loading,
      style: { width: "100%", padding: "13px", background: code.length !== 6 ? "rgba(16,185,129,0.3)" : "linear-gradient(135deg,#059669,#10b981)", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: code.length !== 6 ? "not-allowed" : "pointer", transition: "all 0.2s", marginBottom: 12 }
    },
    loading ? "Verifying\u2026" : "\u2713 Verify & Sign In"
  ), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setStep("creds");
    setCode("");
    setErr("");
  }, style: { width: "100%", background: "none", border: "none", color: "var(--textm)", fontSize: 13, cursor: "pointer", padding: 8 } }, "\u2190 Back"))), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginTop: 16, display: "flex", gap: 4, justifyContent: "center", alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "var(--textl)" } }, "New to CyberShield?"), /* @__PURE__ */ React.createElement("button", { onClick: () => setShowRegister(true), style: { background: "none", border: "none", color: "var(--purple2)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 } }, "Request Access \u2192")), /* @__PURE__ */ React.createElement("p", { style: { textAlign: "center", fontSize: 11, color: "var(--textl)", marginTop: 8 } }, "Secure sign-in \xB7 Two-factor authentication")));
}
function CertView({ module, user, progress, onBack }) {
  const cert = module.certTemplate || {};
  const dateStr = progress?.completedDate ? new Date(progress.completedDate).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }) : (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  const [saving, setSaving] = useState(false);
  const download = async () => {
    setSaving(true);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const W = 1600, H = 1130, accent = cert.accentColor || module.color || "#7c3aed";
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const g = canvas.getContext("2d");
      const bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#1e1e42");
      bg.addColorStop(1, "#0d0d1a");
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      const glow = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.6);
      glow.addColorStop(0, accent + "33");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = accent;
      g.lineWidth = 10;
      g.strokeRect(40, 40, W - 80, H - 80);
      g.strokeStyle = accent + "66";
      g.lineWidth = 2;
      g.strokeRect(64, 64, W - 128, H - 128);
      g.strokeStyle = accent + "99";
      g.lineWidth = 3;
      [[90, 90], [W - 170, 90], [90, H - 170], [W - 170, H - 170]].forEach(([x, y]) => g.strokeRect(x, y, 80, 80));
      const text = (str, y, size, weight, color, family, maxW = W - 360) => {
        let fs = size;
        do {
          g.font = `${weight} ${fs}px ${family}`;
          fs -= 2;
        } while (g.measureText(str).width > maxW && fs > 14);
        g.fillStyle = color;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(str, W / 2, y);
      };
      const display = "Syne, 'Space Grotesk', Arial, sans-serif", body = "'Space Grotesk', Arial, sans-serif";
      text(cert.badge || "\u{1F3C6}", 215, 110, "400", "#ffffff", "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif");
      g.save();
      g.font = `600 26px ${display}`;
      text("C Y B E R S H I E L D   P L A T F O R M", 320, 26, "600", accent, display);
      g.restore();
      text(cert.title || "Certificate of Completion", 395, 64, "800", "#ffffff", display);
      g.fillStyle = accent;
      g.fillRect(W / 2 - 70, 450, 140, 5);
      text("This certifies that", 520, 30, "400", "rgba(255,255,255,0.7)", body);
      g.shadowColor = accent;
      g.shadowBlur = 30;
      text(user.name, 610, 84, "800", "#ffffff", display);
      g.shadowBlur = 0;
      text("has successfully completed", 700, 30, "400", "rgba(255,255,255,0.7)", body);
      text(cert.subtitle || module.title, 775, 48, "700", accent, display);
      g.strokeStyle = accent + "55";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(260, 860);
      g.lineTo(W - 260, 860);
      g.stroke();
      const cols = [["Score", (progress?.score ?? 100) + "%"], ["Date", dateStr], ["Module", module.title]];
      cols.forEach(([label, value], i) => {
        const x = W / 2 + (i - 1) * 400;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = "#ffffff";
        g.font = `700 26px ${body}`;
        g.fillText(label, x, 915);
        let fs = 26;
        do {
          g.font = `400 ${fs}px ${body}`;
          fs -= 1;
        } while (g.measureText(value).width > 360 && fs > 12);
        g.fillStyle = "rgba(255,255,255,0.7)";
        g.fillText(value, x, 960);
        if (i < 2) {
          g.fillStyle = "rgba(255,255,255,0.18)";
          g.fillRect(x + 200, 895, 2, 85);
        }
      });
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${user.name.replace(/\s+/g, "_")}_${module.title.replace(/[^\w]+/g, "_")}_Certificate.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 700, margin: "0 auto", padding: "2rem", animation: "slide-in 0.4s ease" } }, /* @__PURE__ */ React.createElement("button", { onClick: onBack, style: { background: "none", border: "none", color: "var(--textm)", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontSize: 14 } }, "\u2190 Back"), /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 20, textAlign: "center" } }, "\u{1F3C6} Your Certificate"), /* @__PURE__ */ React.createElement("div", { style: { background: "linear-gradient(135deg,#1e1e42,#0d0d1a)", border: `3px solid ${cert.accentColor || "#7c3aed"}`, borderRadius: 24, padding: "3rem", textAlign: "center", position: "relative", overflow: "hidden", marginBottom: 24, boxShadow: `0 0 60px ${cert.accentColor || "#7c3aed"}33` } }, [[{ top: 12, left: 12 }, { top: 12, right: 12 }, { bottom: 12, left: 12 }, { bottom: 12, right: 12 }]].flat().map((pos, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { position: "absolute", width: 40, height: 40, ...pos, border: `2px solid ${cert.accentColor || "#7c3aed"}55`, borderRadius: 4 } })), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 56, marginBottom: 12 } }, cert.badge || "\u{1F3C6}"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: cert.accentColor || "#7c3aed", marginBottom: 8, fontWeight: 600 } }, "CyberShield Platform"), /* @__PURE__ */ React.createElement("h1", { style: { fontFamily: "Syne,sans-serif", fontSize: 26, fontWeight: 800, color: "white", marginBottom: 6 } }, cert.title || "Certificate of Completion"), /* @__PURE__ */ React.createElement("div", { style: { width: 60, height: 2, background: cert.accentColor || "#7c3aed", margin: "14px auto", borderRadius: 2 } }), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 6 } }, "This certifies that"), /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 34, fontWeight: 800, color: "white", marginBottom: 6, textShadow: `0 0 30px ${cert.accentColor || "#7c3aed"}88` } }, user.name), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 4 } }, "has successfully completed"), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 700, color: cert.accentColor || "#7c3aed", marginBottom: 24 } }, cert.subtitle || module.title), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "center", gap: 32, fontSize: 13, borderTop: `1px solid ${cert.accentColor || "#7c3aed"}33`, paddingTop: 20 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, color: "white", marginBottom: 2 } }, "Score"), /* @__PURE__ */ React.createElement("div", { style: { color: "rgba(255,255,255,0.6)" } }, progress?.score || 100, "%")), /* @__PURE__ */ React.createElement("div", { style: { width: 1, background: "rgba(255,255,255,0.15)" } }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, color: "white", marginBottom: 2 } }, "Date"), /* @__PURE__ */ React.createElement("div", { style: { color: "rgba(255,255,255,0.6)" } }, dateStr)), /* @__PURE__ */ React.createElement("div", { style: { width: 1, background: "rgba(255,255,255,0.15)" } }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, color: "white", marginBottom: 2 } }, "Module"), /* @__PURE__ */ React.createElement("div", { style: { color: "rgba(255,255,255,0.6)" } }, module.title)))), /* @__PURE__ */ React.createElement(Btn, { onClick: download, disabled: saving, variant: "success", style: { width: "100%", justifyContent: "center" }, size: "lg" }, saving ? "Creating image\u2026" : "\u2B07\uFE0F Download Certificate (PNG)"));
}
function ModulePlayer({ module, user, onBack, onComplete, add }) {
  const [stage, setStage] = useState("intro");
  const [questions, setQuestions] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintTimer, setHintTimer] = useState(20);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);
  useEffect(() => {
    if (stage !== "quiz" || showResult) return;
    setHintTimer(20);
    setShowHint(false);
    timerRef.current = setInterval(() => {
      setHintTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setShowHint(true);
          return 0;
        }
        return t - 1;
      });
    }, 1e3);
    return () => clearInterval(timerRef.current);
  }, [currentQ, stage, showResult]);
  const q = questions[currentQ];
  const totalQ = questions.length || module.questionCount || 0;
  const startQuiz = async () => {
    setBusy(true);
    try {
      const data = await api.post("/api/learner/modules/" + module.id + "/attempts");
      setQuestions(data.questions);
      setAttemptId(data.attemptId);
      setCurrentQ(0);
      setSelected(null);
      setReveal(null);
      setShowResult(false);
      setStage("quiz");
    } catch (e) {
      add(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  const handleAnswer = async (opt) => {
    if (selected !== null || busy) return;
    clearInterval(timerRef.current);
    setSelected(opt);
    setBusy(true);
    try {
      const data = await api.post("/api/learner/attempts/" + attemptId + "/answers", { questionId: q.id, answer: opt });
      setReveal(data);
      setShowResult(true);
    } catch (e) {
      add(e.message, "err");
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };
  const nextQ = async () => {
    if (currentQ < totalQ - 1) {
      setCurrentQ((x) => x + 1);
      setSelected(null);
      setReveal(null);
      setShowResult(false);
      setShowHint(false);
      return;
    }
    setBusy(true);
    try {
      const data = await api.post("/api/learner/attempts/" + attemptId + "/finish");
      setResult(data);
      setStage("result");
      onComplete(data);
    } catch (e) {
      add(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  if (stage === "intro") return /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 680, margin: "0 auto", padding: "2.5rem 2rem", animation: "slide-in 0.4s ease" } }, /* @__PURE__ */ React.createElement("button", { onClick: onBack, style: { background: "none", border: "none", color: "var(--textm)", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontSize: 14 } }, "\u2190 Back to Dashboard"), /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { background: `linear-gradient(135deg,${module.color}44,${module.color}11)`, padding: "2.5rem", textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 60, marginBottom: 14, animation: "float 3s ease-in-out infinite" } }, module.thumbnail), /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 8 } }, module.title), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", fontSize: 14, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 } }, module.desc)), /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 } }, [["\u23F1", module.duration + " min", "Duration"], ["\u2753", module.questionCount + " Qs", "Quiz"], ["\u{1F3C6}", module.passingScore + "%", "Pass mark for certificate"]].map(([ic, v, l]) => /* @__PURE__ */ React.createElement("div", { key: l, style: { background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "1rem", textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, marginBottom: 4 } }, ic), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, fontSize: 15 } }, v), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, l)))), /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--purple3)" } }, "\u{1F4A1} If you spend more than 20 seconds on a question, a ", /* @__PURE__ */ React.createElement("strong", null, "magic hint"), " will automatically appear!"), /* @__PURE__ */ React.createElement(Btn, { onClick: () => setStage("video"), style: { width: "100%", justifyContent: "center" }, size: "lg" }, "\u{1F680} Start Module"))));
  if (stage === "video") return /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 680, margin: "0 auto", padding: "2.5rem 2rem", animation: "slide-in 0.4s ease" } }, /* @__PURE__ */ React.createElement("button", { onClick: () => setStage("intro"), style: { background: "none", border: "none", color: "var(--textm)", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontSize: 14 } }, "\u2190 Back"), /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "1.5rem 2rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 24 } }, module.thumbnail), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700 } }, module.title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, "Training Content"))), /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem" } }, module.videoUrl ? /* @__PURE__ */ React.createElement(VideoPlayer, { url: module.videoUrl, style: { marginBottom: 20 } }) : /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(0,0,0,0.4)", borderRadius: 16, aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: 20, border: `2px dashed ${module.color}44` } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 52, marginBottom: 12, animation: "pulse-dot 2s infinite" } }, module.thumbnail), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 8 } }, module.title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)", textAlign: "center", maxWidth: 320, lineHeight: 1.6, padding: "0 20px" } }, module.desc), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textl)", marginTop: 16 } }, "\u{1F4F9} No video uploaded for this module yet")), module.videoName && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)", marginBottom: 16, textAlign: "center" } }, "\u{1F4F9} ", module.videoName), module.content && /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem 1.5rem", marginBottom: 20, fontSize: 14, lineHeight: 1.75, color: "var(--text)", whiteSpace: "pre-wrap" } }, module.content), /* @__PURE__ */ React.createElement(Btn, { onClick: startQuiz, disabled: busy || !module.questionCount, style: { width: "100%", justifyContent: "center" }, size: "lg" }, busy ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Spinner, null), " Loading quiz\u2026") : "\u{1F4DD} Take the Quiz"))));
  if (stage === "quiz" && q) {
    const pct = Math.round(currentQ / totalQ * 100);
    const correctIdx = reveal ? reveal.correctAnswer : null;
    return /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 680, margin: "0 auto", padding: "2.5rem 2rem", animation: "slide-in 0.4s ease" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "var(--textm)" } }, "Question ", currentQ + 1, " / ", totalQ), !showResult && !showHint && /* @__PURE__ */ React.createElement("div", { style: { background: hintTimer <= 5 ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)", border: `1px solid ${hintTimer <= 5 ? "rgba(239,68,68,0.5)" : "rgba(245,158,11,0.4)"}`, borderRadius: 8, padding: "5px 14px", fontSize: 13, fontWeight: 700, color: hintTimer <= 5 ? "#f87171" : "#fbbf24", minWidth: 70, textAlign: "center" } }, "\u23F1 ", hintTimer, "s")), /* @__PURE__ */ React.createElement(PBar, { value: pct, color: module.color, height: 5 }), /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden", marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: `linear-gradient(135deg,${module.color}22,transparent)`, padding: "2rem", borderBottom: "1px solid var(--border)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "inline-block", background: `${module.color}33`, border: `1px solid ${module.color}55`, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: module.color, marginBottom: 12 } }, "Q", currentQ + 1), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 18, fontWeight: 700, lineHeight: 1.45 } }, q.q)), /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 } }, q.options.map((opt, i) => {
      let bg = "rgba(255,255,255,0.04)", bdr = "var(--border)", col = "var(--text)";
      if (reveal) {
        if (i === correctIdx) {
          bg = "rgba(16,185,129,0.12)";
          bdr = "#10b981";
          col = "#34d399";
        } else if (i === selected && selected !== correctIdx) {
          bg = "rgba(239,68,68,0.12)";
          bdr = "#ef4444";
          col = "#f87171";
        }
      } else if (i === selected) {
        bdr = "var(--purple)";
      }
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: i,
          onClick: () => handleAnswer(i),
          disabled: selected !== null,
          style: { background: bg, border: `1.5px solid ${bdr}`, borderRadius: 12, padding: "13px 18px", fontSize: 14, color: col, textAlign: "left", cursor: selected !== null ? "default" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 12 }
        },
        /* @__PURE__ */ React.createElement("div", { style: { width: 28, height: 28, borderRadius: "50%", background: `${bdr}22`, border: `1.5px solid ${bdr}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, color: col } }, String.fromCharCode(65 + i)),
        opt,
        reveal && i === correctIdx && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto" } }, "\u2713"),
        reveal && i === selected && selected !== correctIdx && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto" } }, "\u2717")
      );
    })), showHint && !showResult && q.hint && /* @__PURE__ */ React.createElement("div", { style: { background: "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(6,182,212,0.2))", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, animation: "hint-appear 0.5s cubic-bezier(0.34,1.56,0.64,1)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 18 } }, "\u2728"), /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 700, color: "var(--purple3)", fontSize: 13 } }, "Magic Hint")), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 13, color: "var(--textm)", lineHeight: 1.6 } }, q.hint)), showResult && reveal && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { background: reveal.correct ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${reveal.correct ? "#10b981" : "#ef4444"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 14, color: reveal.correct ? "#34d399" : "#f87171" } }, reveal.correct ? "\u{1F389} Correct!" : "\u274C Incorrect \u2014 correct answer is highlighted in green", reveal.explanation && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)", marginTop: 6 } }, reveal.explanation)), /* @__PURE__ */ React.createElement(Btn, { onClick: nextQ, disabled: busy, style: { width: "100%", justifyContent: "center" }, size: "lg" }, busy ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Spinner, null), " Saving\u2026") : currentQ < totalQ - 1 ? "Next \u2192" : "View Results \u{1F3C6}")))));
  }
  if (stage === "result" && result) {
    const sc = result.score;
    return /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 560, margin: "0 auto", padding: "3rem 2rem", textAlign: "center", animation: "slide-in 0.4s ease" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 72, marginBottom: 14, animation: "badge-pop 0.6s cubic-bezier(0.34,1.56,0.64,1)" } }, result.passed ? "\u{1F3C6}" : sc >= result.passingScore / 2 ? "\u{1F44D}" : "\u{1F4DA}"), /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 8 } }, result.passed ? "Excellent Work!" : "Keep Learning!"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 24 } }, "You finished ", /* @__PURE__ */ React.createElement("strong", null, module.title), " \u2014 ", result.correctAnswers, " of ", result.totalQuestions, " correct"), /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "2rem", marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 56, fontWeight: 800, background: result.passed ? "linear-gradient(135deg,#10b981,#06b6d4)" : "linear-gradient(135deg,#ef4444,#f87171)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 8 } }, sc, "%"), /* @__PURE__ */ React.createElement(PBar, { value: sc, color: result.passed ? "#10b981" : "#ef4444", height: 12 }), result.passed ? /* @__PURE__ */ React.createElement("p", { style: { marginTop: 14, color: "#34d399", fontSize: 14 } }, "\u{1F389} Passed! Your certificate is ready.") : /* @__PURE__ */ React.createElement("p", { style: { marginTop: 14, color: "#f87171", fontSize: 14 } }, "You need ", result.passingScore, "% to pass. Review the content and try again.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" } }, !result.passed && /* @__PURE__ */ React.createElement(Btn, { onClick: () => setStage("video"), variant: "secondary" }, "\u21BA Review & Retry"), /* @__PURE__ */ React.createElement("button", { onClick: onBack, style: { background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text)", padding: "12px 28px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" } }, "\u2190 Back to Dashboard")));
  }
  return null;
}
function UserDashboard({ user, onLogout }) {
  const [view, setView] = useState("home");
  const [activeModule, setActiveModule] = useState(null);
  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [userData, setUserData] = useState(user);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { toasts, add, remove } = useToast();
  const refresh = async () => {
    try {
      const [mods, profile] = await Promise.all([api.get("/api/learner/modules"), api.get("/api/me/profile")]);
      setModules(mods);
      setUserData((u) => ({ ...u, ...profile, avatar: initialsOf(profile.name) }));
      setActiveModule((a) => a ? mods.find((m) => m.id === a.id) || a : a);
    } catch (e) {
      add(e.message, "err");
    } finally {
      setLoadingModules(false);
    }
  };
  useEffect(() => {
    refresh();
  }, []);
  const progressOf = (m) => m.progress || {};
  const notifications = useMemo(() => {
    const n = [];
    modules.forEach((m) => {
      if (!m.dueDate) return;
      const due = new Date(m.dueDate);
      const today = /* @__PURE__ */ new Date();
      const diff = Math.ceil((due - today) / (1e3 * 60 * 60 * 24));
      const prog = progressOf(m);
      if (!prog?.completed && diff <= 7 && diff > 0) n.push({ id: m.id, msg: `"${m.title}" is due in ${diff} day${diff === 1 ? "" : "s"}`, type: "warn", moduleId: m.id });
      if (!prog?.completed && diff <= 0) n.push({ id: m.id + "_od", msg: `"${m.title}" is overdue!`, type: "err", moduleId: m.id });
    });
    return n;
  }, [modules, userData]);
  const completedMods = modules.filter((m) => progressOf(m).completed);
  const inProgressMods = modules.filter((m) => progressOf(m).started && !progressOf(m).completed);
  const overdueMods = modules.filter((m) => {
    if (!m.dueDate || progressOf(m).completed) return false;
    return /* @__PURE__ */ new Date(m.dueDate + "T23:59:59") < /* @__PURE__ */ new Date();
  });
  const overallPct = modules.length ? Math.round(completedMods.length / modules.length * 100) : 0;
  const goToModule = async (m, restart = false) => {
    if (restart) {
      try {
        await api.post("/api/learner/modules/" + m.id + "/restart");
        await refresh();
      } catch (e) {
        add(e.message, "err");
        return;
      }
    }
    setActiveModule(m);
    setView("module");
  };
  const NavBar = () => /* @__PURE__ */ React.createElement("div", { style: { background: "var(--bg2)", borderBottom: "1px solid var(--border)", padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 100 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }, onClick: () => setView("home") }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 22 } }, "\u{1F6E1}\uFE0F"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 800, background: "linear-gradient(135deg,#7c3aed,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } }, "CyberShield")), [["\u{1F3E0} Home", "home"], ["\u{1F4DA} Modules", "modules"], ["\u{1F3C6} Certificates", "certs"]].map(([l, v]) => /* @__PURE__ */ React.createElement("button", { key: v, onClick: () => setView(v), style: { background: view === v ? "rgba(124,58,237,0.15)" : "none", border: "none", color: view === v ? "var(--purple2)" : "var(--textm)", fontSize: 13, fontWeight: view === v ? 600 : 400, padding: "6px 12px", borderRadius: 8, cursor: "pointer" } }, l))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, position: "relative" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement("button", { onClick: () => setNotifOpen((o) => !o), style: { background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 10, width: 38, height: 38, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer" } }, "\u{1F514}", notifications.length > 0 && /* @__PURE__ */ React.createElement("span", { style: { position: "absolute", top: -4, right: -4, background: "var(--red)", color: "white", width: 17, height: 17, borderRadius: "50%", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" } }, notifications.length)), notifOpen && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 46, right: 0, width: 300, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 200, overflow: "hidden", animation: "fade-in 0.2s ease" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" } }, "Notifications ", /* @__PURE__ */ React.createElement("button", { onClick: () => setNotifOpen(false), style: { background: "none", border: "none", color: "var(--textm)", cursor: "pointer", fontSize: 16 } }, "\u2715")), notifications.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "1.5rem", textAlign: "center", color: "var(--textm)", fontSize: 13 } }, "All caught up! \u2713") : notifications.map((n) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: n.id,
      onClick: () => {
        const m = modules.find((x) => x.id === n.moduleId);
        if (m) {
          goToModule(m);
          setNotifOpen(false);
        }
      },
      style: { padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, color: n.type === "err" ? "#f87171" : "#fbbf24", cursor: "pointer", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "flex-start", gap: 8 },
      onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)",
      onMouseLeave: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"
    },
    /* @__PURE__ */ React.createElement("span", null, n.type === "err" ? "\u26A0\uFE0F" : "\u{1F4C5}"),
    /* @__PURE__ */ React.createElement("span", null, n.msg, " \u2014 ", /* @__PURE__ */ React.createElement("strong", null, "Click to open"))
  )))), /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement("div", { onClick: () => setProfileOpen((o) => !o), style: { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 12px", cursor: "pointer" } }, userData.photo ? /* @__PURE__ */ React.createElement("img", { src: userData.photo, style: { width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "2px solid #7c3aed55" } }) : /* @__PURE__ */ React.createElement(Ava, { initials: userData.avatar || userData.name.slice(0, 2).toUpperCase(), color: userData.color || "#7c3aed", size: 28 }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, userData.name.split(" ")[0]), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--textm)", fontSize: 11 } }, "\u25BE")), profileOpen && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 46, right: 0, width: 200, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 200, overflow: "hidden", animation: "fade-in 0.2s ease" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 600 } }, userData.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textm)" } }, userData.email)), /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: () => {
        setProfileOpen(false);
        setView("profile");
      },
      style: { padding: "11px 16px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "var(--text)" },
      onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)",
      onMouseLeave: (e) => e.currentTarget.style.background = "transparent"
    },
    "\u{1F464} My Profile"
  ), /* @__PURE__ */ React.createElement("div", { style: { height: 1, background: "var(--border)" } }), /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: onLogout,
      style: { padding: "11px 16px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#f87171" },
      onMouseEnter: (e) => e.currentTarget.style.background = "rgba(239,68,68,0.08)",
      onMouseLeave: (e) => e.currentTarget.style.background = "transparent"
    },
    "\u{1F6AA} Sign Out"
  )))));
  const ModuleCard = ({ m, compact = false }) => {
    const prog = progressOf(m);
    const due = m.dueDate ? /* @__PURE__ */ new Date(m.dueDate + "T23:59:59") : null;
    const today = /* @__PURE__ */ new Date();
    const overdue = due && due < today && !prog.completed;
    const dueSoon = due && Math.ceil((due - today) / (1e3 * 60 * 60 * 24)) <= 3 && !prog.completed && !overdue;
    const progPct = prog.completed ? 100 : prog.started ? prog.progressPercentage || 0 : 0;
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        style: { background: "var(--card)", border: `1px solid ${prog.completed ? m.color + "44" : "var(--border)"}`, borderRadius: 20, overflow: "hidden", transition: "transform 0.2s,box-shadow 0.2s", cursor: "pointer", boxShadow: prog.completed ? `0 0 20px ${m.color}22` : "none" },
        onMouseEnter: (e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = `0 12px 32px ${m.color}33`;
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = prog.completed ? `0 0 20px ${m.color}22` : "none";
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { background: `linear-gradient(135deg,${m.color}44,${m.color}11)`, padding: "1.5rem", borderBottom: "1px solid var(--border)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 36 } }, m.thumbnail), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" } }, prog.completed && /* @__PURE__ */ React.createElement(Badge, { color: "#10b981" }, "\u2713 Done"), prog.started && !prog.completed && /* @__PURE__ */ React.createElement(Badge, { color: "#06b6d4" }, "In Progress"), overdue && /* @__PURE__ */ React.createElement(Badge, { color: "#ef4444" }, "Overdue"), dueSoon && /* @__PURE__ */ React.createElement(Badge, { color: "#f59e0b" }, "Due Soon"), !prog.started && !overdue && !dueSoon && /* @__PURE__ */ React.createElement(Badge, { color: m.color }, m.category))), /* @__PURE__ */ React.createElement("h4", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 4 } }, m.title), !compact && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12, color: "var(--textm)", lineHeight: 1.5 } }, m.desc)),
      /* @__PURE__ */ React.createElement("div", { style: { padding: "1.25rem 1.5rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--textm)", marginBottom: 10 } }, /* @__PURE__ */ React.createElement("span", null, "\u23F1 ", m.duration, " min"), m.dueDate && /* @__PURE__ */ React.createElement("span", { style: { color: overdue ? "#f87171" : dueSoon ? "#fbbf24" : "var(--textm)" } }, "\u{1F4C5} ", new Date(m.dueDate).toLocaleDateString())), prog.started && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement(PBar, { value: progPct, color: m.color, height: 5 })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(Btn, { onClick: () => goToModule(m), style: { flex: 1, justifyContent: "center", background: `linear-gradient(135deg,${m.color},${m.color}99)` }, size: "sm" }, prog.completed ? "Review" : "Start"), prog.completed && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Btn, { onClick: () => {
        setActiveModule(m);
        setView("cert");
      }, variant: "ghost", size: "sm" }, "\u{1F3C6} Cert"), /* @__PURE__ */ React.createElement(Btn, { onClick: () => goToModule(m, true), variant: "danger", size: "sm" }, "\u21BA Restart"))))
    );
  };
  if (view === "home") return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: "var(--bg)" } }, /* @__PURE__ */ React.createElement(Toast, { toasts, remove }), /* @__PURE__ */ React.createElement(NavBar, null), /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 1100, margin: "0 auto", padding: "2rem" } }, overdueMods.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 20 } }, "\u26A0\uFE0F"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, fontSize: 14, color: "#f87171" } }, "You have ", overdueMods.length, " overdue module", overdueMods.length > 1 ? "s" : ""), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, "Click to go to your overdue modules"))), /* @__PURE__ */ React.createElement(Btn, { variant: "danger", size: "sm", onClick: () => setView("modules") }, "View Overdue \u2192")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24 } }, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 4 } }, "Welcome back, ", userData.name.split(" ")[0], "! \u{1F44B}"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", fontSize: 14 } }, "Continue your cybersecurity training journey")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 28 } }, [
    { icon: "\u{1F4DA}", l: "Modules Available", v: modules.length, c: "#7c3aed", g: "linear-gradient(135deg,#7c3aed22,#06b6d422)", click: () => setView("modules") },
    { icon: "\u2705", l: "Completed", v: completedMods.length, c: "#10b981", g: "linear-gradient(135deg,#10b98122,#06b6d422)", click: () => setView("modules") },
    { icon: "\u{1F3AF}", l: "Overall Progress", v: overallPct + "%", c: "#06b6d4", g: "linear-gradient(135deg,#06b6d422,#7c3aed22)", click: null },
    { icon: "\u{1F3C6}", l: "Certificates", v: completedMods.length, c: "#f59e0b", g: "linear-gradient(135deg,#f59e0b22,#ec489922)", click: () => setView("certs") }
  ].map((s) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: s.l,
      onClick: s.click || void 0,
      style: { background: s.g, border: `1px solid ${s.c}33`, borderRadius: 16, padding: "1.5rem", cursor: s.click ? "pointer" : "default", transition: "transform 0.2s" },
      onMouseEnter: (e) => {
        if (s.click) e.currentTarget.style.transform = "translateY(-2px)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.transform = "";
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 28, marginBottom: 8 } }, s.icon),
    /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 28, fontWeight: 800, color: s.c } }, s.v),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)", marginTop: 2 } }, s.l)
  ))), /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", marginBottom: 28 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 14 } }, "Overall Completion"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--cyan2)", fontWeight: 700, fontFamily: "Syne,sans-serif", fontSize: 18 } }, overallPct, "%")), /* @__PURE__ */ React.createElement(PBar, { value: overallPct, color: "#06b6d4", height: 10 }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)", marginTop: 8 } }, completedMods.length, " of ", modules.length, " modules completed")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 17, fontWeight: 700 } }, inProgressMods.length > 0 ? "Continue Training" : "Available Modules"), /* @__PURE__ */ React.createElement("button", { onClick: () => setView("modules"), style: { background: "none", border: "none", color: "var(--purple2)", fontSize: 13, cursor: "pointer", fontWeight: 600 } }, "View All \u2192")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 } }, (inProgressMods.length > 0 ? inProgressMods : modules).slice(0, 3).map((m) => /* @__PURE__ */ React.createElement(ModuleCard, { key: m.id, m })))));
  if (view === "module" && activeModule) return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: "var(--bg)" } }, /* @__PURE__ */ React.createElement(Toast, { toasts, remove }), /* @__PURE__ */ React.createElement(NavBar, null), /* @__PURE__ */ React.createElement(
    ModulePlayer,
    {
      module: activeModule,
      user: userData,
      onBack: () => {
        setView("home");
        setActiveModule(null);
        refresh();
      },
      onComplete: (result) => {
        refresh();
        if (result.passed) {
          add("\u{1F389} Module completed! Certificate ready.", "ok");
          setTimeout(() => {
            setView("cert");
          }, 1500);
        } else add("Quiz saved. You need " + result.passingScore + "% to pass.", "warn");
      },
      add
    }
  ));
  if (view === "cert" && activeModule) return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: "var(--bg)" } }, /* @__PURE__ */ React.createElement(Toast, { toasts, remove }), /* @__PURE__ */ React.createElement(NavBar, null), /* @__PURE__ */ React.createElement(CertView, { module: activeModule, user: userData, progress: progressOf(activeModule), onBack: () => {
    setView("home");
    setActiveModule(null);
  } }));
  if (view === "modules") return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: "var(--bg)" } }, /* @__PURE__ */ React.createElement(Toast, { toasts, remove }), /* @__PURE__ */ React.createElement(NavBar, null), /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 1100, margin: "0 auto", padding: "2rem" } }, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "Training Modules"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 24 } }, "All available cybersecurity modules"), overdueMods.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700, color: "#f87171", marginBottom: 12 } }, "\u26A0\uFE0F Overdue (", overdueMods.length, ")"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14, marginBottom: 28 } }, overdueMods.map((m) => /* @__PURE__ */ React.createElement(ModuleCard, { key: m.id, m })))), inProgressMods.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700, color: "var(--cyan2)", marginBottom: 12 } }, "\u{1F504} In Progress (", inProgressMods.length, ")"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14, marginBottom: 28 } }, inProgressMods.map((m) => /* @__PURE__ */ React.createElement(ModuleCard, { key: m.id, m })))), completedMods.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700, color: "var(--green2)", marginBottom: 12 } }, "\u2705 Completed (", completedMods.length, ")"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14, marginBottom: 28 } }, completedMods.map((m) => /* @__PURE__ */ React.createElement(ModuleCard, { key: m.id, m })))), loadingModules && /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem", textAlign: "center", color: "var(--textm)" } }, "Loading modules\u2026"), !loadingModules && modules.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem", textAlign: "center", color: "var(--textm)" } }, "No training modules have been published yet."), modules.filter((m) => !progressOf(m).started && !overdueMods.includes(m)).length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700, color: "var(--textm)", marginBottom: 12 } }, "\u{1F4DA} Not Started"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 } }, modules.filter((m) => !progressOf(m).started && !overdueMods.includes(m)).map((m) => /* @__PURE__ */ React.createElement(ModuleCard, { key: m.id, m }))))));
  if (view === "certs") return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: "var(--bg)" } }, /* @__PURE__ */ React.createElement(Toast, { toasts, remove }), /* @__PURE__ */ React.createElement(NavBar, null), /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 1100, margin: "0 auto", padding: "2rem" } }, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "My Certificates"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 24 } }, "Certificates earned from completed modules"), completedMods.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "4rem", color: "var(--textm)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u{1F3C6}"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 600, marginBottom: 8 } }, "No certificates yet"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 13 } }, "Complete a module to earn your first certificate"), /* @__PURE__ */ React.createElement(Btn, { onClick: () => setView("modules"), style: { marginTop: 16 } }, "Browse Modules")) : /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 } }, completedMods.map((m) => {
    const prog = progressOf(m);
    const cert = m.certTemplate || {};
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: m.id,
        style: { background: "linear-gradient(135deg,#1e1e42,#0d0d1a)", border: `2px solid ${cert.accentColor || m.color}`, borderRadius: 18, overflow: "hidden", cursor: "pointer", transition: "transform 0.2s,box-shadow 0.2s", boxShadow: `0 0 20px ${cert.accentColor || m.color}22` },
        onClick: () => {
          setActiveModule(m);
          setView("cert");
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = `0 16px 40px ${cert.accentColor || m.color}44`;
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = `0 0 20px ${cert.accentColor || m.color}22`;
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem", textAlign: "center", borderBottom: `1px solid ${cert.accentColor || m.color}33` } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 40, marginBottom: 8 } }, cert.badge || "\u{1F3C6}"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 14, fontWeight: 700, color: "white" } }, cert.title || "Certificate of Completion"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: cert.accentColor || m.color, marginTop: 4 } }, cert.subtitle || m.title)),
      /* @__PURE__ */ React.createElement("div", { style: { padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textl)" } }, "Score"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: "var(--green2)" } }, prog?.score || 100, "%")), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textl)" } }, "Completed"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, prog?.completedDate ? new Date(prog.completedDate).toLocaleDateString() : "-")))
    );
  }))));
  if (view === "profile") return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: "var(--bg)" } }, /* @__PURE__ */ React.createElement(Toast, { toasts, remove }), /* @__PURE__ */ React.createElement(NavBar, null), /* @__PURE__ */ React.createElement(
    ProfileEditor,
    {
      userData,
      completedMods,
      inProgressMods,
      modules,
      onBack: () => setView("home"),
      onSaved: (profile) => {
        setUserData((u) => ({ ...u, ...profile, avatar: initialsOf(profile.name) }));
        add("Profile updated!", "ok");
      },
      add
    }
  ));
  return null;
}
function TwoFactorPanel({ enabled, required, onChange, add }) {
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      setSetup(await api.post("/api/me/2fa/setup"));
      setCode("");
    } catch (e) {
      add(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const profile = await api.post("/api/me/2fa/enable", { code });
      setSetup(null);
      setCode("");
      onChange(profile);
      add("Two-factor authentication is now on.", "ok");
    } catch (e) {
      add(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    try {
      const profile = await api.post("/api/me/2fa/disable", { code });
      setDisabling(false);
      setCode("");
      onChange(profile);
      add("Two-factor authentication turned off.", "warn");
    } catch (e) {
      add(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  const codeInput = /* @__PURE__ */ React.createElement(
    "input",
    {
      value: code,
      onChange: (e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6)),
      placeholder: "6-digit code",
      inputMode: "numeric",
      style: { width: 140, padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 16, letterSpacing: "0.2em", textAlign: "center", outline: "none" }
    }
  );
  return /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, fontSize: 14, marginBottom: 2 } }, "\u{1F510} Two-Factor Authentication"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, "Use an authenticator app (Google Authenticator, Microsoft Authenticator, Authy\u2026) when signing in.")), /* @__PURE__ */ React.createElement(Badge, { color: enabled ? "#10b981" : "#64748b" }, enabled ? "Enabled" : "Off")), !enabled && !setup && /* @__PURE__ */ React.createElement(Btn, { onClick: start, disabled: busy, variant: "secondary", size: "sm", style: { marginTop: 14 } }, "Set up 2FA"), !enabled && setup && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("img", { src: setup.qrCode, alt: "2FA QR code", style: { width: 160, height: 160, borderRadius: 12, background: "white", padding: 6 } }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 200 } }, /* @__PURE__ */ React.createElement("ol", { style: { fontSize: 13, color: "var(--textm)", lineHeight: 1.7, paddingLeft: 18, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("li", null, "Scan the QR code with your authenticator app."), /* @__PURE__ */ React.createElement("li", null, "Or type this key: ", /* @__PURE__ */ React.createElement("code", { style: { color: "var(--cyan2)", wordBreak: "break-all" } }, setup.secret)), /* @__PURE__ */ React.createElement("li", null, "Enter the 6-digit code it shows.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, codeInput, /* @__PURE__ */ React.createElement(Btn, { onClick: confirm, disabled: busy || code.length !== 6, variant: "success", size: "sm" }, "Turn on"), /* @__PURE__ */ React.createElement(Btn, { onClick: () => {
    setSetup(null);
    setCode("");
  }, variant: "ghost", size: "sm" }, "Cancel")))), enabled && required && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textl)", marginTop: 12 } }, "2FA is required for every account. If you lose your phone, ask an administrator to reset it."), enabled && !required && !disabling && /* @__PURE__ */ React.createElement(Btn, { onClick: () => {
    setDisabling(true);
    setCode("");
  }, variant: "danger", size: "sm", style: { marginTop: 14 } }, "Turn off 2FA"), enabled && disabling && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "var(--textm)" } }, "Enter a current code to confirm:"), codeInput, /* @__PURE__ */ React.createElement(Btn, { onClick: turnOff, disabled: busy || code.length !== 6, variant: "danger", size: "sm" }, "Turn off"), /* @__PURE__ */ React.createElement(Btn, { onClick: () => setDisabling(false), variant: "ghost", size: "sm" }, "Cancel")));
}
function SecurityModal({ onClose, add }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    api.get("/api/me/profile").then(setProfile).catch((e) => add(e.message, "err"));
  }, []);
  return /* @__PURE__ */ React.createElement(Modal, { title: "Account Security", onClose }, !profile ? /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)" } }, "Loading\u2026") : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)", marginBottom: 14 } }, "Signed in as ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--text)" } }, profile.email)), /* @__PURE__ */ React.createElement(TwoFactorPanel, { enabled: profile.twoFactorEnabled, required: profile.twoFactorRequired, onChange: setProfile, add })));
}
function ProfileEditor({ userData, completedMods, inProgressMods, modules, onBack, onSaved, add }) {
  const [name, setName] = useState(userData.name || "");
  const [phone, setPhone] = useState(userData.phone || "");
  const [photo, setPhoto] = useState(userData.photo || "");
  const [saving, setSaving] = useState(false);
  const [twoFactor, setTwoFactor] = useState(!!userData.twoFactorEnabled);
  const [history, setHistory] = useState(null);
  const fileRef = useRef();
  useEffect(() => {
    api.get("/api/learner/attempts").then(setHistory).catch(() => setHistory([]));
  }, []);
  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
      add("Choose a PNG, JPG, GIF or WebP image", "err");
      return;
    }
    if (file.size > 1024 * 1024) {
      add("Image must be under 1MB", "err");
      return;
    }
    const r = new FileReader();
    r.onload = (ev) => setPhoto(ev.target.result);
    r.readAsDataURL(file);
  };
  const save = async () => {
    if (!name.trim()) {
      add("Name is required", "err");
      return;
    }
    setSaving(true);
    try {
      const profile = await api.put("/api/me/profile", { fullName: name.trim(), phone: phone.trim(), photo });
      onSaved(profile);
    } catch (e) {
      add(e.message, "err");
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 640, margin: "0 auto", padding: "2rem" } }, /* @__PURE__ */ React.createElement("button", { onClick: onBack, style: { background: "none", border: "none", color: "var(--textm)", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontSize: 14 } }, "\u2190 Back"), /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 20 } }, "My Profile"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 } }, [[completedMods.length, "Completed", "#10b981"], [inProgressMods.length, "In Progress", "#06b6d4"], [modules.length, "Total Modules", "#7c3aed"]].map(([v, l, c]) => /* @__PURE__ */ React.createElement("div", { key: l, style: { background: `${c}11`, border: `1px solid ${c}33`, borderRadius: 12, padding: "1rem", textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 24, fontWeight: 800, color: c } }, v), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, l)))), /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "linear-gradient(135deg,#7c3aed22,#06b6d422)", padding: "2rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, photo ? /* @__PURE__ */ React.createElement("img", { src: photo, style: { width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #7c3aed", boxShadow: "0 0 20px #7c3aed44" } }) : /* @__PURE__ */ React.createElement("div", { style: { width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#7c3aed88)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: "white", border: "3px solid #7c3aed55", boxShadow: "0 0 20px #7c3aed44" } }, initialsOf(name || userData.name)), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => fileRef.current?.click(),
      style: { position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "var(--purple)", border: "2px solid var(--card)", color: "white", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }
    },
    "\u{1F4F7}"
  ), /* @__PURE__ */ React.createElement("input", { ref: fileRef, type: "file", accept: "image/png,image/jpeg,image/gif,image/webp", onChange: handlePhoto, style: { display: "none" } })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 } }, name || userData.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)", marginBottom: 6 } }, userData.email), /* @__PURE__ */ React.createElement(Badge, { color: "#7c3aed" }, "Learner"), photo && /* @__PURE__ */ React.createElement("button", { onClick: () => setPhoto(""), style: { background: "none", border: "none", color: "#f87171", fontSize: 12, cursor: "pointer", marginLeft: 10 } }, "\u2715 Remove photo"))), /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 } }, "Full Name"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: name,
      onChange: (e) => setName(e.target.value),
      placeholder: "Your full name",
      style: { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none" }
    }
  )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 } }, "Phone Number"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: phone,
      onChange: (e) => setPhone(e.target.value),
      placeholder: "+61 400 000 000",
      type: "tel",
      style: { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none" }
    }
  ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 } }, "Email Address"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: userData.email,
      disabled: true,
      type: "email",
      style: { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none", opacity: 0.6 }
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textl)", marginTop: 5 } }, "Your email is your sign-in name. Ask an administrator if it needs to change.")), /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "1rem", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, fontWeight: 600, color: "var(--textl)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 } }, "Member Since"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14 } }, userData.joinDate ? fmtDate(userData.joinDate) : "-")), /* @__PURE__ */ React.createElement(Btn, { onClick: save, disabled: saving, style: { width: "100%", justifyContent: "center" }, size: "lg" }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Spinner, null), " Saving\u2026") : "\u{1F4BE} Save Changes"))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement(TwoFactorPanel, { enabled: twoFactor, required: !!userData.twoFactorRequired, onChange: (p) => setTwoFactor(!!p.twoFactorEnabled), add })), /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "1.5rem" } }, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 12 } }, "\u{1F4DD} Quiz Results"), history === null && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)", fontSize: 13 } }, "Loading\u2026"), history && history.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)", fontSize: 13 } }, "You have not completed any quizzes yet."), history && history.map((h) => /* @__PURE__ */ React.createElement("div", { key: h.attemptId, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600 } }, h.moduleTitle), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textl)" } }, fmtDateTime(h.completedAt), " \xB7 ", h.correctAnswers, "/", h.totalQuestions, " correct")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 700 } }, h.score, "%"), /* @__PURE__ */ React.createElement(Badge, { color: h.passed ? "#10b981" : "#ef4444" }, h.passed ? "Passed" : "Not passed"))))));
}
function RegisterPage({ onBack, onRegistered }) {
  const [step, setStep] = useState("form");
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setErr("");
    if (!f.name.trim() || !f.email.trim() || !f.password) {
      setErr("Please fill in all required fields.");
      return;
    }
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/[0-9]/.test(f.password)) {
      setErr("Password must be at least 8 characters and include a letter and a number.");
      return;
    }
    if (f.password !== f.confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/register", { fullName: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password });
      setStep("done");
      if (onRegistered) onRegistered();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };
  const inp = (label, key, type = "text", ph = "") => /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 } }, label), /* @__PURE__ */ React.createElement(
    "input",
    {
      type,
      value: f[key],
      onChange: (e) => setF((x) => ({ ...x, [key]: e.target.value })),
      placeholder: ph,
      style: { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none" }
    }
  ));
  if (step === "done") return /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "2rem" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 56, marginBottom: 16 } }, "\u2705"), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 } }, "Registration Submitted!"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", fontSize: 14, marginBottom: 20, lineHeight: 1.7 } }, "Your account request has been sent to the admin for approval.", /* @__PURE__ */ React.createElement("br", null), "You can sign in once your account is approved.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--cyan2)" } }, "Typically approved within 24 hours.")), /* @__PURE__ */ React.createElement(Btn, { onClick: onBack, variant: "secondary" }, "\u2190 Back to Sign In"));
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("button", { onClick: onBack, style: { background: "none", border: "none", color: "var(--textm)", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontSize: 14 } }, "\u2190 Back to Sign In"), /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 } }, "Create Account"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", fontSize: 13, marginBottom: 20 } }, "Register for access to CyberShield training"), err && /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 } }, err), inp("Full Name *", "name", "text", "Your full name"), inp("Email Address *", "email", "email", "your@email.com"), inp("Phone Number", "phone", "tel", "+61 400 000 000"), inp("Password * (min 8 chars, letter + number)", "password", "password", "Choose a password"), inp("Confirm Password *", "confirm", "password", "Repeat your password"), /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--cyan2)", marginBottom: 16, lineHeight: 1.6 } }, "\u2139\uFE0F Your registration will be reviewed and approved by the admin before you can sign in."), /* @__PURE__ */ React.createElement(Btn, { onClick: submit, disabled: loading, style: { width: "100%", justifyContent: "center" }, size: "lg" }, loading ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Spinner, null), " Submitting\u2026") : "Submit Registration \u2192"));
}
function ForgotPasswordPage({ initialEmail, onBack }) {
  const [f, setF] = useState({ email: initialEmail || "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setErr("");
    if (!f.email.trim() || !f.password) {
      setErr("Enter your email and a new password.");
      return;
    }
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/[0-9]/.test(f.password)) {
      setErr("Password must be at least 8 characters and include a letter and a number.");
      return;
    }
    if (f.password !== f.confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.post("/api/auth/forgot-password", { email: f.email.trim(), newPassword: f.password });
      setDone(data.message);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };
  const inp = (label, key, type, ph) => /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 } }, label), /* @__PURE__ */ React.createElement(
    "input",
    {
      type,
      value: f[key],
      onChange: (e) => setF((x) => ({ ...x, [key]: e.target.value })),
      placeholder: ph,
      style: { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none" }
    }
  ));
  if (done) return /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "2rem" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 56, marginBottom: 16 } }, "\u{1F4E8}"), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 } }, "Request Sent"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", fontSize: 14, marginBottom: 20, lineHeight: 1.7 } }, done), /* @__PURE__ */ React.createElement(Btn, { onClick: onBack, variant: "secondary" }, "\u2190 Back to Sign In"));
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("button", { onClick: onBack, style: { background: "none", border: "none", color: "var(--textm)", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontSize: 14 } }, "\u2190 Back to Sign In"), /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 } }, "Reset Password"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", fontSize: 13, marginBottom: 20 } }, "Choose a new password. An administrator must approve the change."), err && /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 } }, err), inp("Email Address *", "email", "email", "your@email.com"), inp("New Password * (min 8 chars, letter + number)", "password", "password", "New password"), inp("Confirm New Password *", "confirm", "password", "Repeat new password"), /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--amber2)", marginBottom: 16, lineHeight: 1.6 } }, "\u{1F512} Your current password keeps working until the administrator approves this request."), /* @__PURE__ */ React.createElement(Btn, { onClick: submit, disabled: loading, style: { width: "100%", justifyContent: "center" }, size: "lg" }, loading ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Spinner, null), " Sending\u2026") : "Send Reset Request \u2192"));
}
const moduleBody = (m) => ({
  title: m.title,
  desc: m.desc,
  content: m.content || "",
  category: m.category,
  duration: parseInt(m.duration) || 20,
  dueDate: m.dueDate || null,
  thumbnail: m.thumbnail,
  color: m.color,
  videoUrl: m.videoUrl || "",
  videoName: m.videoName || "",
  passingScore: parseInt(m.passingScore) || 70,
  certTemplate: m.certTemplate || null
});
function OwnerDashboard({ owner, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [modules, setModules] = useState([]);
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingModule, setEditingModule] = useState(null);
  const [editType, setEditType] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [showSecurity, setShowSecurity] = useState(false);
  const { toasts, add, remove } = useToast();
  const load = async () => {
    try {
      const [mods, people] = await Promise.all([api.get("/api/owner/modules"), api.get("/api/owner/learners")]);
      setModules(mods);
      setLearners(people);
    } catch (e) {
      add(e.message, "err");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const replaceModule = (updated) => setModules((ms) => ms.map((m) => m.id === updated.id ? updated : m));
  const closeEditor = () => {
    setEditingModule(null);
    setEditType(null);
  };
  const saveWith = async (action, okMsg) => {
    try {
      const updated = await action();
      if (updated && updated.id) replaceModule(updated);
      closeEditor();
      add(okMsg, "ok");
      return true;
    } catch (e) {
      add(e.message, "err");
      return false;
    }
  };
  const deleteModule = (id) => setConfirm({ msg: "Permanently delete this module and all its content?", cb: async () => {
    setConfirm(null);
    try {
      await api.del("/api/owner/modules/" + id);
      setModules((ms) => ms.filter((m) => m.id !== id));
      add("Module deleted", "ok");
    } catch (e) {
      add(e.message, "err");
    }
  } });
  const togglePublish = async (m) => {
    try {
      const updated = await api.patch("/api/owner/modules/" + m.id + "/published", { published: !m.published });
      replaceModule(updated);
      add(updated.published ? "Module published \u2014 learners can now see it." : "Module unpublished (hidden from learners).", updated.published ? "ok" : "warn");
    } catch (e) {
      add(e.message, "err");
    }
  };
  const getStats = (m) => m.stats || { total: 0, completed: 0, started: 0, pct: 0 };
  const totalCompletions = modules.reduce((s, m) => s + getStats(m).completed, 0);
  const TABS = [{ k: "overview", icon: "\u{1F4CA}", l: "Overview" }, { k: "modules", icon: "\u{1F4DA}", l: "Modules" }, { k: "completion", icon: "\u{1F4C8}", l: "Completion" }];
  return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: "var(--bg)", display: "flex" } }, /* @__PURE__ */ React.createElement(Toast, { toasts, remove }), /* @__PURE__ */ React.createElement(Confirm, { msg: confirm?.msg, onYes: confirm?.cb, onNo: () => setConfirm(null) }), showSecurity && /* @__PURE__ */ React.createElement(SecurityModal, { onClose: () => setShowSecurity(false), add }), editingModule && editType === "info" && /* @__PURE__ */ React.createElement(Modal, { title: `Edit: ${editingModule.title}`, onClose: closeEditor, width: 640 }, /* @__PURE__ */ React.createElement(EditInfoForm, { module: editingModule, onSave: (u) => saveWith(() => api.put("/api/owner/modules/" + u.id, moduleBody(u)), "Saved!") })), editingModule && editType === "video" && /* @__PURE__ */ React.createElement(Modal, { title: `Video: ${editingModule.title}`, onClose: closeEditor }, /* @__PURE__ */ React.createElement(
    EditVideoForm,
    {
      module: editingModule,
      onUpload: (file) => {
        const fd = new FormData();
        fd.append("file", file);
        return saveWith(() => api.upload("/api/owner/modules/" + editingModule.id + "/video", fd), "Video uploaded!");
      },
      onSave: (u) => saveWith(() => api.put("/api/owner/modules/" + u.id, moduleBody(u)), "Video updated!")
    }
  )), editingModule && editType === "quiz" && /* @__PURE__ */ React.createElement(Modal, { title: `Quiz: ${editingModule.title}`, onClose: closeEditor, width: 700 }, /* @__PURE__ */ React.createElement(EditQuizForm, { module: editingModule, onSave: (quiz) => saveWith(() => api.put("/api/owner/modules/" + editingModule.id + "/questions", quiz.map((q) => ({
    id: typeof q.id === "number" ? q.id : null,
    q: q.q,
    options: q.options,
    answer: q.answer,
    hint: q.hint || "",
    explanation: q.explanation || ""
  }))), "Quiz saved!") })), editingModule && editType === "cert" && /* @__PURE__ */ React.createElement(Modal, { title: `Certificate: ${editingModule.title}`, onClose: closeEditor }, /* @__PURE__ */ React.createElement(EditCertForm, { module: editingModule, onSave: (u) => saveWith(() => api.put("/api/owner/modules/" + u.id, moduleBody(u)), "Certificate saved!") })), /* @__PURE__ */ React.createElement("div", { style: { width: 220, background: "var(--bg2)", borderRight: "1px solid var(--border)", padding: "1.5rem", display: "flex", flexDirection: "column", flexShrink: 0, height: "100vh", position: "sticky", top: 0, overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 28 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 20 } }, "\u{1F6E1}\uFE0F"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "Syne,sans-serif", fontSize: 14, fontWeight: 800, background: "linear-gradient(135deg,#10b981,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } }, "CyberShield")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "12px", background: "rgba(16,185,129,0.1)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.2)" } }, /* @__PURE__ */ React.createElement(Ava, { initials: initialsOf(owner.name), color: "#10b981", size: 34 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, owner.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "#34d399" } }, "Module Owner"))), TABS.map((t) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: t.k,
      onClick: () => setTab(t.k),
      style: { background: tab === t.k ? "rgba(16,185,129,0.15)" : "transparent", border: `1px solid ${tab === t.k ? "rgba(16,185,129,0.4)" : "transparent"}`, borderRadius: 10, padding: "9px 14px", textAlign: "left", color: tab === t.k ? "#34d399" : "var(--textm)", fontSize: 13, fontWeight: tab === t.k ? 600 : 400, display: "flex", alignItems: "center", gap: 10, marginBottom: 4, cursor: "pointer", transition: "all 0.15s" }
    },
    /* @__PURE__ */ React.createElement("span", null, t.icon),
    t.l
  )), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => setShowSecurity(true), style: { width: "100%", padding: "9px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, color: "#34d399", fontSize: 13, cursor: "pointer" } }, "\u{1F510} Security"), /* @__PURE__ */ React.createElement("button", { onClick: onLogout, style: { width: "100%", padding: "9px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--textm)", fontSize: 13, cursor: "pointer" } }, "Sign Out"))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 960, margin: "0 auto", padding: "2rem" } }, loading && /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem", textAlign: "center", color: "var(--textm)" } }, "Loading your modules\u2026"), tab === "overview" && /* @__PURE__ */ React.createElement("div", { style: { animation: "slide-in 0.3s ease" } }, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "Owner Dashboard"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 24 } }, "Manage training content and track learner progress"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 28 } }, [{ ic: "\u{1F4DA}", l: "Modules", v: modules.length, c: "#7c3aed" }, { ic: "\u{1F465}", l: "Learners", v: learners.length, c: "#06b6d4" }, { ic: "\u2705", l: "Completions", v: totalCompletions, c: "#10b981" }, { ic: "\u{1F4CA}", l: "Avg Rate", v: modules.length ? Math.round(modules.reduce((s, m) => s + getStats(m).pct, 0) / modules.length) + "%" : "0%", c: "#f59e0b" }].map((s) => /* @__PURE__ */ React.createElement("div", { key: s.l, style: { background: `${s.c}11`, border: `1px solid ${s.c}33`, borderRadius: 14, padding: "1.25rem" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 26, marginBottom: 6 } }, s.ic), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 26, fontWeight: 800, color: s.c } }, s.v), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, s.l)))), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 14 } }, "Completion Rates"), !loading && modules.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)", fontSize: 14 } }, "You have not created any modules yet. Go to ", /* @__PURE__ */ React.createElement("strong", null, "Modules"), " to add one."), modules.map((m) => {
    const s = getStats(m);
    return /* @__PURE__ */ React.createElement("div", { key: m.id, style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem 1.5rem", marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 20 } }, m.thumbnail), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, m.title, " ", !m.published && /* @__PURE__ */ React.createElement(Badge, { color: "#64748b" }, "Draft")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textm)" } }, s.completed, "/", s.total, " completed \xB7 ", s.started, " in progress"))), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 800, color: m.color } }, s.pct, "%")), /* @__PURE__ */ React.createElement(PBar, { value: s.pct, color: m.color, height: 7 }));
  })), tab === "modules" && /* @__PURE__ */ React.createElement("div", { style: { animation: "slide-in 0.3s ease" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "Manage Modules"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)" } }, "Create, edit, publish and delete training modules")), /* @__PURE__ */ React.createElement(Btn, { variant: "success", onClick: () => setShowAdd((o) => !o) }, "+ New Module")), showAdd && /* @__PURE__ */ React.createElement(AddModuleForm, { onSave: async (m) => {
    try {
      const created = await api.post("/api/owner/modules", moduleBody(m));
      setModules((ms) => [...ms, created]);
      setShowAdd(false);
      add("Module created! Add quiz questions, then publish it.", "ok");
    } catch (e) {
      add(e.message, "err");
    }
  }, onCancel: () => setShowAdd(false) }), modules.map((m) => /* @__PURE__ */ React.createElement("div", { key: m.id, style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, marginBottom: 14, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, padding: "1.5rem" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${m.color}44,${m.color}22)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 } }, m.thumbnail), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 } }, m.title, " ", /* @__PURE__ */ React.createElement(Badge, { color: m.published ? "#10b981" : "#64748b" }, m.published ? "Published" : "Draft")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, m.desc), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, fontSize: 11, color: "var(--textl)", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", null, "\u23F1 ", m.duration, "min"), /* @__PURE__ */ React.createElement("span", null, "\u2753 ", m.questionCount, " questions"), /* @__PURE__ */ React.createElement("span", null, "\u{1F3AF} Pass ", m.passingScore, "%"), /* @__PURE__ */ React.createElement("span", null, "\u{1F4F9} ", m.videoName || "No video"), m.dueDate && /* @__PURE__ */ React.createElement("span", null, "\u{1F4C5} ", fmtDate(m.dueDate)), /* @__PURE__ */ React.createElement(Badge, { color: m.color }, m.category))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(Btn, { variant: m.published ? "ghost" : "success", size: "sm", onClick: () => togglePublish(m) }, m.published ? "\u23F8 Unpublish" : "\u{1F680} Publish"), /* @__PURE__ */ React.createElement(Btn, { variant: "secondary", size: "sm", onClick: () => {
    setEditingModule(m);
    setEditType("info");
  } }, "\u270F\uFE0F Edit"), /* @__PURE__ */ React.createElement(Btn, { variant: "cyan", size: "sm", onClick: () => {
    setEditingModule(m);
    setEditType("video");
  } }, "\u{1F4F9} Video"), /* @__PURE__ */ React.createElement(Btn, { variant: "secondary", size: "sm", onClick: () => {
    setEditingModule(m);
    setEditType("quiz");
  } }, "\u2753 Quiz"), /* @__PURE__ */ React.createElement(Btn, { variant: "amber", size: "sm", onClick: () => {
    setEditingModule(m);
    setEditType("cert");
  } }, "\u{1F3C6} Cert"), /* @__PURE__ */ React.createElement(Btn, { variant: "danger", size: "sm", onClick: () => deleteModule(m.id) }, "\u{1F5D1}")))))), tab === "completion" && /* @__PURE__ */ React.createElement("div", { style: { animation: "slide-in 0.3s ease" } }, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "Learner Progress"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 24 } }, "Detailed progress for every learner on your modules"), !loading && learners.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)", fontSize: 14 } }, "No approved learners yet."), learners.map((u) => /* @__PURE__ */ React.createElement("div", { key: u.id, style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement(Ava, { initials: initialsOf(u.name), color: colorFor(u.id), size: 38 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600 } }, u.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, u.email))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8 } }, modules.map((m) => {
    const p = (u.progress || {})[m.id] || {};
    return /* @__PURE__ */ React.createElement("div", { key: m.id, style: { background: `${m.color}11`, border: `1px solid ${m.color}33`, borderRadius: 10, padding: "9px 12px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 4 } }, m.title), p.completed ? /* @__PURE__ */ React.createElement(Badge, { color: "#10b981" }, "\u2713 ", p.score ?? 100, "%") : p.started ? /* @__PURE__ */ React.createElement(Badge, { color: "#06b6d4" }, "In Progress") : /* @__PURE__ */ React.createElement(Badge, { color: "#64748b" }, "Not Started"));
  }))))))));
}
const CATEGORIES = ["Threats", "Access Control", "Data Protection", "Network Security", "Compliance"];
function AddModuleForm({ onSave, onCancel }) {
  const [f, setF] = useState({ title: "", desc: "", content: "", category: "Threats", duration: "20", dueDate: "", thumbnail: "\u{1F512}", color: "#7c3aed", passingScore: "70" });
  const [saving, setSaving] = useState(false);
  const COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#ec4899", "#f59e0b", "#ef4444"];
  const ICONS = ["\u{1F512}", "\u{1F3A3}", "\u{1F6E1}\uFE0F", "\u{1F510}", "\u{1F3AD}", "\u{1F4BB}", "\u{1F310}", "\u26A0\uFE0F", "\u{1F511}", "\u{1F4F1}", "\u{1F5A5}\uFE0F", "\u{1F50D}"];
  return /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "1.75rem", marginBottom: 16, animation: "slide-in 0.3s ease" } }, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 18 } }, "\u2795 Create New Module"), /* @__PURE__ */ React.createElement(Inp, { label: "Module Title *", value: f.title, onChange: (v) => setF((x) => ({ ...x, title: v })), placeholder: "e.g. Ransomware Defence" }), /* @__PURE__ */ React.createElement(Inp, { label: "Description", value: f.desc, onChange: (v) => setF((x) => ({ ...x, desc: v })), placeholder: "Brief description...", rows: 2 }), /* @__PURE__ */ React.createElement(Inp, { label: "Training Content", value: f.content, onChange: (v) => setF((x) => ({ ...x, content: v })), placeholder: "The learning material learners read before the quiz...", rows: 5 }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Inp, { label: "Duration (minutes)", value: f.duration, onChange: (v) => setF((x) => ({ ...x, duration: v })), type: "number" }), /* @__PURE__ */ React.createElement(Inp, { label: "Pass Mark (%)", value: f.passingScore, onChange: (v) => setF((x) => ({ ...x, passingScore: v })), type: "number" }), /* @__PURE__ */ React.createElement(Inp, { label: "Due Date", value: f.dueDate, onChange: (v) => setF((x) => ({ ...x, dueDate: v })), type: "date" })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Category"), /* @__PURE__ */ React.createElement("select", { value: f.category, onChange: (e) => setF((x) => ({ ...x, category: e.target.value })), style: { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none" } }, CATEGORIES.map((c) => /* @__PURE__ */ React.createElement("option", { key: c, value: c }, c)))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Icon"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, ICONS.map((ic) => /* @__PURE__ */ React.createElement("button", { key: ic, onClick: () => setF((x) => ({ ...x, thumbnail: ic })), style: { width: 36, height: 36, fontSize: 18, background: f.thumbnail === ic ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.05)", border: `1.5px solid ${f.thumbnail === ic ? "#7c3aed" : "var(--border)"}`, borderRadius: 8, cursor: "pointer" } }, ic))))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Colour"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, COLORS.map((c) => /* @__PURE__ */ React.createElement("button", { key: c, onClick: () => setF((x) => ({ ...x, color: c })), style: { width: 30, height: 30, borderRadius: "50%", background: c, border: `3px solid ${f.color === c ? "white" : "transparent"}`, cursor: "pointer", boxShadow: f.color === c ? `0 0 0 2px ${c}` : "none" } })))), /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--cyan2)", marginBottom: 16 } }, "\u{1F4A1} New modules start as a ", /* @__PURE__ */ React.createElement("strong", null, "Draft"), ". Use the ", /* @__PURE__ */ React.createElement("strong", null, "\u{1F4F9} Video"), " and ", /* @__PURE__ */ React.createElement("strong", null, "\u2753 Quiz"), " buttons to add content, then ", /* @__PURE__ */ React.createElement("strong", null, "\u{1F680} Publish"), "."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement(Btn, { variant: "ghost", onClick: onCancel, style: { flex: 1, justifyContent: "center" } }, "Cancel"), /* @__PURE__ */ React.createElement(Btn, { variant: "success", disabled: !f.title.trim() || saving, onClick: async () => {
    setSaving(true);
    try {
      await onSave({ ...f, certTemplate: { title: "Certificate of Completion", subtitle: f.title, badge: "\u{1F3C6}", accentColor: f.color } });
    } finally {
      setSaving(false);
    }
  }, style: { flex: 2, justifyContent: "center" } }, saving ? "Creating\u2026" : "Create Module")));
}
function EditInfoForm({ module, onSave }) {
  const [f, setF] = useState({ ...module, dueDate: module.dueDate || "", content: module.content || "" });
  const [saving, setSaving] = useState(false);
  const COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#ec4899", "#f59e0b", "#ef4444"];
  const ICONS = ["\u{1F512}", "\u{1F3A3}", "\u{1F6E1}\uFE0F", "\u{1F510}", "\u{1F3AD}", "\u{1F4BB}", "\u{1F310}", "\u26A0\uFE0F", "\u{1F511}", "\u{1F4F1}", "\u{1F5A5}\uFE0F", "\u{1F50D}"];
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(Inp, { label: "Title", value: f.title, onChange: (v) => setF((x) => ({ ...x, title: v })) }), /* @__PURE__ */ React.createElement(Inp, { label: "Description", value: f.desc, onChange: (v) => setF((x) => ({ ...x, desc: v })), rows: 2 }), /* @__PURE__ */ React.createElement(Inp, { label: "Training Content", value: f.content, onChange: (v) => setF((x) => ({ ...x, content: v })), rows: 7, placeholder: "The learning material learners read before the quiz..." }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Inp, { label: "Duration (min)", value: String(f.duration), onChange: (v) => setF((x) => ({ ...x, duration: v })), type: "number" }), /* @__PURE__ */ React.createElement(Inp, { label: "Pass Mark (%)", value: String(f.passingScore), onChange: (v) => setF((x) => ({ ...x, passingScore: v })), type: "number" }), /* @__PURE__ */ React.createElement(Inp, { label: "Due Date", value: f.dueDate, onChange: (v) => setF((x) => ({ ...x, dueDate: v })), type: "date" })), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Category"), /* @__PURE__ */ React.createElement("select", { value: f.category, onChange: (e) => setF((x) => ({ ...x, category: e.target.value })), style: { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none" } }, [...new Set([...CATEGORIES, f.category].filter(Boolean))].map((c) => /* @__PURE__ */ React.createElement("option", { key: c, value: c }, c)))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Icon"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, ICONS.map((ic) => /* @__PURE__ */ React.createElement("button", { key: ic, onClick: () => setF((x) => ({ ...x, thumbnail: ic })), style: { width: 36, height: 36, fontSize: 18, background: f.thumbnail === ic ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.05)", border: `1.5px solid ${f.thumbnail === ic ? "#7c3aed" : "var(--border)"}`, borderRadius: 8, cursor: "pointer" } }, ic)))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Colour"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, COLORS.map((c) => /* @__PURE__ */ React.createElement("button", { key: c, onClick: () => setF((x) => ({ ...x, color: c })), style: { width: 30, height: 30, borderRadius: "50%", background: c, border: `3px solid ${f.color === c ? "white" : "transparent"}`, cursor: "pointer", boxShadow: f.color === c ? `0 0 0 2px ${c}` : "none" } })))), /* @__PURE__ */ React.createElement(Btn, { onClick: async () => {
    setSaving(true);
    await onSave(f);
    setSaving(false);
  }, disabled: saving, style: { width: "100%", justifyContent: "center" } }, saving ? "Saving\u2026" : "Save Changes"));
}
function EditVideoForm({ module, onSave, onUpload }) {
  const [videoName, setVideoName] = useState(module.videoName || "");
  const [videoUrl, setVideoUrl] = useState(module.videoUrl || "");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    await onUpload(file);
    setLoading(false);
  };
  const removeVideo = () => {
    setVideoUrl("");
    setVideoName("");
  };
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--cyan2)", marginBottom: 16, lineHeight: 1.6 } }, "\u{1F4F9} Upload a video file or paste a link (YouTube, Vimeo or a direct .mp4 link). Learners watch it before taking the quiz.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--textl)" } }, "Supported uploads: MP4, WebM, OGG, MOV (max 200 MB). Files are stored on the server.")), videoUrl ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(VideoPlayer, { url: videoUrl, style: { marginBottom: 12, maxHeight: 220 } }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "var(--textm)" } }, "\u{1F4F9} ", videoName || "Linked video"), /* @__PURE__ */ React.createElement(Btn, { variant: "danger", size: "sm", onClick: removeVideo }, "\u{1F5D1} Remove Video"))) : /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: () => !loading && fileRef.current?.click(),
      style: { border: "2px dashed var(--border)", borderRadius: 14, padding: "2.5rem", textAlign: "center", cursor: "pointer", marginBottom: 16, transition: "border-color 0.2s" },
      onMouseEnter: (e) => e.currentTarget.style.borderColor = "var(--cyan)",
      onMouseLeave: (e) => e.currentTarget.style.borderColor = "var(--border)"
    },
    /* @__PURE__ */ React.createElement("input", { ref: fileRef, type: "file", accept: "video/mp4,video/webm,video/ogg,video/quicktime,.m4v", onChange: handleFile, style: { display: "none" } }),
    loading ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "center" } }, /* @__PURE__ */ React.createElement(Spinner, null)), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginTop: 12, fontSize: 13 } }, "Uploading video\u2026")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 40, marginBottom: 10 } }, "\u{1F4F9}"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, marginBottom: 6, fontSize: 14 } }, "Click to upload video"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, "MP4, WebM, OGG or MOV"))
  ), !videoUrl && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement(Inp, { label: "Or enter a video URL", value: videoUrl, onChange: (v) => {
    setVideoUrl(v);
    if (v) setVideoName("Linked video");
  }, placeholder: "https://www.youtube.com/watch?v=..." })), /* @__PURE__ */ React.createElement(Btn, { onClick: () => onSave({ ...module, videoUrl, videoName }), disabled: loading, style: { width: "100%", justifyContent: "center" } }, "Save Video"));
}
function EditQuizForm({ module, onSave }) {
  const [quiz, setQuiz] = useState(() => module.quiz && module.quiz.length ? JSON.parse(JSON.stringify(module.quiz)).map((q) => ({ ...q, hint: q.hint || "", explanation: q.explanation || "" })) : [{ id: "new" + Date.now(), q: "", options: ["", "", "", ""], answer: 0, hint: "", explanation: "" }]);
  const [saving, setSaving] = useState(false);
  const updateQ = (qi, k, v) => setQuiz((q) => q.map((x, i) => i === qi ? { ...x, [k]: v } : x));
  const updateOpt = (qi, oi, v) => setQuiz((q) => q.map((x, i) => i === qi ? { ...x, options: x.options.map((o, j) => j === oi ? v : o) } : x));
  const addQ = () => setQuiz((q) => [...q, { id: "new" + Date.now(), q: "", options: ["", "", "", ""], answer: 0, hint: "", explanation: "" }]);
  const removeQ = (qi) => setQuiz((q) => q.filter((_, i) => i !== qi));
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "var(--purple3)", marginBottom: 16 } }, "\u2728 The ", /* @__PURE__ */ React.createElement("strong", null, "Magic Hint"), " field is shown to users after they spend 20 seconds on a question without answering."), /* @__PURE__ */ React.createElement("div", { style: { maxHeight: "55vh", overflowY: "auto", paddingRight: 4 } }, quiz.map((q, qi) => /* @__PURE__ */ React.createElement("div", { key: q.id, style: { background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, color: "var(--purple3)", fontSize: 14 } }, "Question ", qi + 1), quiz.length > 1 && /* @__PURE__ */ React.createElement("button", { onClick: () => removeQ(qi), style: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 7, padding: "4px 12px", fontSize: 12, cursor: "pointer" } }, "\u2715 Remove")), /* @__PURE__ */ React.createElement(Inp, { label: "Question Text *", value: q.q, onChange: (v) => updateQ(qi, "q", v), placeholder: "Type your question here..." }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Answer Options (click the circle to mark correct answer)"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } }, q.options.map((o, oi) => /* @__PURE__ */ React.createElement("div", { key: oi, style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ React.createElement("button", { onClick: () => updateQ(qi, "answer", oi), style: { width: 26, height: 26, borderRadius: "50%", background: q.answer === oi ? "var(--green)" : "rgba(255,255,255,0.06)", border: `2px solid ${q.answer === oi ? "var(--green)" : "var(--border)"}`, cursor: "pointer", flexShrink: 0, fontSize: 11, fontWeight: 700, color: "white", display: "flex", alignItems: "center", justifyContent: "center" } }, String.fromCharCode(65 + oi)), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: o,
      onChange: (e) => updateOpt(qi, oi, e.target.value),
      placeholder: `Option ${String.fromCharCode(65 + oi)}`,
      style: { flex: 1, padding: "8px 10px", background: `rgba(255,255,255,${q.answer === oi ? 0.08 : 0.04})`, border: `1.5px solid ${q.answer === oi ? "var(--green)" : "var(--border)"}`, borderRadius: 8, color: "var(--text)", fontSize: 13, outline: "none" }
    }
  )))), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 } }, "\u2728 Magic Hint (shown after 20 seconds)"), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: q.hint,
      onChange: (e) => updateQ(qi, "hint", e.target.value),
      placeholder: "Enter a helpful hint that guides the user towards the correct answer...",
      rows: 2,
      style: { width: "100%", padding: "10px 14px", background: "rgba(124,58,237,0.08)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 10, color: "var(--text)", fontSize: 13, outline: "none", resize: "vertical", marginBottom: 10 }
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 } }, "Explanation (shown after answering)"), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: q.explanation,
      onChange: (e) => updateQ(qi, "explanation", e.target.value),
      placeholder: "Why is the correct answer right?",
      rows: 2,
      style: { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13, outline: "none", resize: "vertical" }
    }
  )))), /* @__PURE__ */ React.createElement(Btn, { variant: "secondary", onClick: addQ, style: { width: "100%", justifyContent: "center", marginBottom: 10, marginTop: 6 } }, "+ Add Question"), /* @__PURE__ */ React.createElement(Btn, { onClick: async () => {
    setSaving(true);
    await onSave(quiz);
    setSaving(false);
  }, disabled: saving, style: { width: "100%", justifyContent: "center" } }, saving ? "Saving\u2026" : "\u{1F4BE} Save Quiz"));
}
function EditCertForm({ module, onSave }) {
  const [cert, setCert] = useState({ ...module.certTemplate });
  const COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#ec4899", "#f59e0b", "#ef4444"];
  const BADGES = ["\u{1F3C6}", "\u{1F947}", "\u{1F393}", "\u{1F6E1}\uFE0F", "\u2B50", "\u{1F31F}", "\u{1F396}\uFE0F", "\u2705", "\u{1F48E}", "\u{1F510}", "\u{1F3C5}", "\u{1F3AF}"];
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(Inp, { label: "Certificate Title", value: cert.title || "", onChange: (v) => setCert((c) => ({ ...c, title: v })) }), /* @__PURE__ */ React.createElement(Inp, { label: "Certificate Subtitle", value: cert.subtitle || "", onChange: (v) => setCert((c) => ({ ...c, subtitle: v })), placeholder: "e.g. Phishing Awareness Training" }), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Badge Emoji"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, BADGES.map((ic) => /* @__PURE__ */ React.createElement("button", { key: ic, onClick: () => setCert((c) => ({ ...c, badge: ic })), style: { width: 38, height: 38, fontSize: 20, background: cert.badge === ic ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.05)", border: `1.5px solid ${cert.badge === ic ? "#7c3aed" : "var(--border)"}`, borderRadius: 8, cursor: "pointer" } }, ic)))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Accent Colour"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, COLORS.map((c) => /* @__PURE__ */ React.createElement("button", { key: c, onClick: () => setCert((x) => ({ ...x, accentColor: c })), style: { width: 30, height: 30, borderRadius: "50%", background: c, border: `3px solid ${cert.accentColor === c ? "white" : "transparent"}`, cursor: "pointer", boxShadow: cert.accentColor === c ? `0 0 0 2px ${c}` : "none" } })))), /* @__PURE__ */ React.createElement("div", { style: { background: "linear-gradient(135deg,#1e1e42,#0d0d1a)", border: `2px solid ${cert.accentColor || "#7c3aed"}`, borderRadius: 14, padding: "1.5rem", textAlign: "center", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 32, marginBottom: 6 } }, cert.badge || "\u{1F3C6}"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 14, fontWeight: 700, color: "white" } }, cert.title || "Certificate of Completion"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: cert.accentColor || "#7c3aed", marginTop: 4 } }, cert.subtitle || module.title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 } }, "Learner Name \xB7 Date \xB7 Score")), /* @__PURE__ */ React.createElement(Btn, { onClick: () => onSave({ ...module, certTemplate: cert }), style: { width: "100%", justifyContent: "center" } }, "\u{1F4BE} Save Certificate"));
}
function AdminDashboard({ admin, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [modules, setModules] = useState([]);
  const [resets, setResets] = useState([]);
  const [audit, setAudit] = useState(null);
  const [showSecurity, setShowSecurity] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const { toasts, add, remove } = useToast();
  const [databaseUsers, setDatabaseUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [ownerForm, setOwnerForm] = useState({ show: false, name: "", email: "", password: "" });
  const [ownerErr, setOwnerErr] = useState("");
  const [userForm, setUserForm] = useState({ show: false, name: "", email: "", password: "" });
  const [userErr, setUserErr] = useState("");
  const mapUser = (u) => {
    const role = (u.role || "USER").toUpperCase();
    const name = u.fullName || "Unnamed user";
    return {
      id: u.id,
      name,
      email: u.email || "",
      phone: u.phone || "",
      role: role === "MODULE_OWNER" ? "owner" : role.toLowerCase(),
      databaseRole: role,
      active: !!u.enabled,
      approvalStatus: (u.approvalStatus || "APPROVED").toUpperCase(),
      twoFactorEnabled: !!u.twoFactorEnabled,
      avatar: initialsOf(name),
      color: role === "ADMIN" ? "#f59e0b" : role === "MODULE_OWNER" ? "#10b981" : "#7c3aed",
      joinDate: u.createdAt ? fmtDate(u.createdAt) : "N/A"
    };
  };
  const loadDatabaseUsers = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const data = await api.get("/admin/api/users");
      const mapped = data.map(mapUser);
      setDatabaseUsers(mapped);
      setSelectedUser((sel) => sel ? mapped.find((u) => u.id === sel.id) || null : sel);
    } catch (error) {
      setUsersError(error.message);
    } finally {
      setUsersLoading(false);
    }
  };
  const loadModules = () => api.get("/admin/api/modules").then(setModules).catch((e) => add(e.message, "err"));
  const loadResets = () => api.get("/admin/api/password-resets").then(setResets).catch((e) => add(e.message, "err"));
  const loadAudit = () => api.get("/admin/api/audit-logs").then(setAudit).catch((e) => add(e.message, "err"));
  useEffect(() => {
    loadDatabaseUsers();
    loadModules();
    loadResets();
  }, []);
  const applyUser = (u) => {
    const mapped = mapUser(u);
    setDatabaseUsers((list) => list.map((x) => x.id === mapped.id ? mapped : x));
    setSelectedUser((sel) => sel && sel.id === mapped.id ? mapped : sel);
    return mapped;
  };
  const allUsers = useMemo(
    () => databaseUsers.filter((u) => u.databaseRole !== "ADMIN").sort((a, b) => a.name.localeCompare(b.name)),
    [databaseUsers]
  );
  const statusOf = (u) => u.approvalStatus === "PENDING" ? "pending" : u.approvalStatus === "REJECTED" ? "rejected" : u.active ? "active" : "disabled";
  const STATUS_LABEL = { pending: "Pending", rejected: "Rejected", active: "Active", disabled: "Deactivated" };
  const STATUS_COLOR = { pending: "#f59e0b", rejected: "#ef4444", active: "#10b981", disabled: "#ef4444" };
  const filtered = useMemo(() => allUsers.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter !== "all" && statusOf(u) !== statusFilter) return false;
    const term = search.trim().toLowerCase();
    return !term || [u.name, u.email, u.role].some((v) => (v || "").toLowerCase().includes(term));
  }), [search, roleFilter, statusFilter, allUsers]);
  const pendingUsers = allUsers.filter((u) => u.approvalStatus === "PENDING");
  const users = allUsers.filter((u) => u.databaseRole === "USER" && u.approvalStatus === "APPROVED");
  const pendingResets = resets.filter((r) => r.status === "PENDING");
  const approveUser = async (id) => {
    try {
      const u = applyUser(await api.post("/admin/api/users/" + id + "/approve"));
      add(u.name + " approved and activated!", "ok");
      loadModules();
    } catch (e) {
      add(e.message, "err");
    }
  };
  const rejectUser = (id) => setConfirm({ msg: "Reject this registration? The person will not be able to sign in.", yes: "Reject", cb: async () => {
    setConfirm(null);
    try {
      applyUser(await api.post("/admin/api/users/" + id + "/reject"));
      add("Registration rejected", "ok");
    } catch (e) {
      add(e.message, "err");
    }
  } });
  const toggleActive = async (u) => {
    try {
      const updated = applyUser(await api.put("/admin/api/users/" + u.id + "/status", { enabled: !u.active }));
      add(updated.name + " " + (updated.active ? "activated" : "deactivated"), updated.active ? "ok" : "warn");
    } catch (e) {
      add(e.message, "err");
    }
  };
  const changeRole = async (u, role) => {
    try {
      const updated = applyUser(await api.put("/admin/api/users/" + u.id + "/role", { role }));
      add(updated.name + " is now " + (role === "MODULE_OWNER" ? "a Module Owner" : "a User"), "ok");
      loadModules();
    } catch (e) {
      add(e.message, "err");
    }
  };
  const resetTwoFactor = (u) => setConfirm({ msg: "Reset 2FA for " + u.name + "? They will have to scan a new QR code at their next sign-in.", yes: "Reset 2FA", cb: async () => {
    setConfirm(null);
    try {
      const updated = applyUser(await api.post("/admin/api/users/" + u.id + "/reset-2fa"));
      add("2FA reset for " + updated.name, "ok");
    } catch (e) {
      add(e.message, "err");
    }
  } });
  const decideReset = async (r, approve) => {
    try {
      await api.post("/admin/api/password-resets/" + r.id + (approve ? "/approve" : "/reject"));
      add(approve ? "New password activated for " + r.email : "Reset request rejected", approve ? "ok" : "warn");
      loadResets();
    } catch (e) {
      add(e.message, "err");
      loadResets();
    }
  };
  const createAccount = async (form, role, setErr, reset, okMsg) => {
    setErr("");
    const name = form.name.trim(), email = form.email.trim().toLowerCase(), password = form.password;
    if (!name || !email || !password) {
      setErr("Name, email and password are required.");
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErr("Password must be at least 8 characters and include a letter and a number.");
      return;
    }
    try {
      await api.post("/admin/api/users", { fullName: name, email, password, role });
      reset();
      add(okMsg, "ok");
      await loadDatabaseUsers();
    } catch (error) {
      setErr(error.message);
    }
  };
  const createOwner = () => createAccount(ownerForm, "MODULE_OWNER", setOwnerErr, () => setOwnerForm({ show: false, name: "", email: "", password: "" }), "Module owner account saved to the database.");
  const createUser = () => createAccount(userForm, "USER", setUserErr, () => setUserForm({ show: false, name: "", email: "", password: "" }), "Normal user account saved to the database.");
  const TABS = [
    { k: "overview", icon: "\u{1F4CA}", l: "Overview" },
    { k: "pending", icon: "\u23F3", l: "Pending", count: pendingUsers.length },
    { k: "users", icon: "\u{1F465}", l: "Users" },
    { k: "owners", icon: "\u{1F3D7}\uFE0F", l: "Owners" },
    { k: "modules", icon: "\u{1F4DA}", l: "Modules" },
    { k: "resets", icon: "\u{1F511}", l: "Password Resets", count: pendingResets.length },
    { k: "audit", icon: "\u{1F9FE}", l: "Audit Log" }
  ];
  const RC = { user: "#7c3aed", owner: "#10b981", admin: "#f59e0b" };
  const selectStyle = { padding: "11px 12px", background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 13, outline: "none" };
  const totalCompletions = modules.reduce((s, m) => s + (m.stats?.completed || 0), 0);
  return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: "var(--bg)", display: "flex" } }, /* @__PURE__ */ React.createElement(Toast, { toasts, remove }), confirm && /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2e3, display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "2rem", maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 40, marginBottom: 12 } }, "\u26A0\uFE0F"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: 24, color: "var(--textm)", lineHeight: 1.6 } }, confirm.msg), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "center" } }, /* @__PURE__ */ React.createElement("button", { onClick: () => setConfirm(null), style: { flex: 1, padding: "11px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, fontWeight: 600 } }, "Cancel"), /* @__PURE__ */ React.createElement("button", { onClick: confirm.cb, style: { flex: 1, padding: "11px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, color: "#f87171", fontSize: 14, fontWeight: 600 } }, confirm.yes || "Confirm")))), showSecurity && /* @__PURE__ */ React.createElement(SecurityModal, { onClose: () => setShowSecurity(false), add }), /* @__PURE__ */ React.createElement("div", { style: {
    width: 220,
    background: "var(--bg2)",
    borderRight: "1px solid var(--border)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    height: "100vh",
    position: "sticky",
    top: 0,
    overflowY: "auto"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 28 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 20 } }, "\u{1F6E1}\uFE0F"), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: "Syne,sans-serif",
    fontSize: 14,
    fontWeight: 800,
    background: "linear-gradient(135deg,#f59e0b,#ec4899)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent"
  } }, "CyberShield")), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
    padding: 12,
    background: "rgba(245,158,11,0.1)",
    borderRadius: 12,
    border: "1px solid rgba(245,158,11,0.2)"
  } }, /* @__PURE__ */ React.createElement(Ava, { initials: initialsOf(admin.name), color: "#f59e0b", size: 34 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, admin.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "#fbbf24" } }, "System Admin"))), TABS.map((t) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: t.k,
      onClick: () => {
        setTab(t.k);
        setSelectedUser(null);
        if (t.k === "pending" || t.k === "users" || t.k === "owners") loadDatabaseUsers();
        if (t.k === "modules" || t.k === "overview") loadModules();
        if (t.k === "resets") loadResets();
        if (t.k === "audit") loadAudit();
      },
      style: {
        background: tab === t.k ? "rgba(245,158,11,0.15)" : "transparent",
        border: `1px solid ${tab === t.k ? "rgba(245,158,11,0.4)" : "transparent"}`,
        borderRadius: 10,
        padding: "9px 14px",
        textAlign: "left",
        color: tab === t.k ? "#fbbf24" : "var(--textm)",
        fontSize: 13,
        fontWeight: tab === t.k ? 600 : 400,
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 4,
        cursor: "pointer"
      }
    },
    /* @__PURE__ */ React.createElement("span", null, t.icon),
    t.l,
    t.count > 0 && /* @__PURE__ */ React.createElement("span", { style: {
      marginLeft: "auto",
      background: "var(--red)",
      color: "white",
      borderRadius: "50%",
      width: 18,
      height: 18,
      fontSize: 10,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    } }, t.count)
  )), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => setShowSecurity(true), style: {
    width: "100%",
    padding: 9,
    background: "rgba(245,158,11,0.08)",
    border: "1px solid rgba(245,158,11,0.25)",
    borderRadius: 10,
    color: "#fbbf24",
    fontSize: 13,
    cursor: "pointer"
  } }, "\u{1F510} Security"), /* @__PURE__ */ React.createElement("button", { onClick: onLogout, style: {
    width: "100%",
    padding: 9,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--textm)",
    fontSize: 13,
    cursor: "pointer"
  } }, "Sign Out"))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 1e3, margin: "0 auto", padding: "2rem" } }, tab === "overview" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "System Overview"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 24 } }, "Platform-wide statistics"), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 14,
    marginBottom: 28
  } }, [
    { ic: "\u{1F464}", l: "Learners", v: users.length, c: "#7c3aed" },
    { ic: "\u{1F3D7}\uFE0F", l: "Module Owners", v: databaseUsers.filter((u) => u.databaseRole === "MODULE_OWNER").length, c: "#10b981" },
    { ic: "\u{1F4DA}", l: "Modules", v: modules.length, c: "#06b6d4" },
    { ic: "\u2705", l: "Completions", v: totalCompletions, c: "#f59e0b" }
  ].map((s) => /* @__PURE__ */ React.createElement("div", { key: s.l, style: {
    background: `${s.c}11`,
    border: `1px solid ${s.c}33`,
    borderRadius: 14,
    padding: "1.25rem"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 26, marginBottom: 6 } }, s.ic), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 26, fontWeight: 800, color: s.c } }, s.v), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, s.l)))), (pendingUsers.length > 0 || pendingResets.length > 0) && /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 14, padding: "14px 20px", marginBottom: 24, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, color: "#fbbf24" } }, "\u23F3 ", pendingUsers.length, " registration(s) and ", pendingResets.length, " password reset(s) waiting for review"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, pendingUsers.length > 0 && /* @__PURE__ */ React.createElement(Btn, { variant: "amber", size: "sm", onClick: () => setTab("pending") }, "Review registrations"), pendingResets.length > 0 && /* @__PURE__ */ React.createElement(Btn, { variant: "amber", size: "sm", onClick: () => {
    setTab("resets");
    loadResets();
  } }, "Review resets"))), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 14 } }, "Module Completion Rates"), modules.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)", fontSize: 14 } }, "No modules have been created yet."), modules.map((m) => {
    const st = m.stats || { completed: 0, total: 0, pct: 0 };
    return /* @__PURE__ */ React.createElement("div", { key: m.id, style: {
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "1.25rem 1.5rem",
      marginBottom: 10
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", null, m.thumbnail), /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 14 } }, m.title), /* @__PURE__ */ React.createElement(Badge, { color: m.color }, m.category), !m.published && /* @__PURE__ */ React.createElement(Badge, { color: "#64748b" }, "Draft")), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "Syne,sans-serif", fontWeight: 800, color: m.color } }, st.pct, "%")), /* @__PURE__ */ React.createElement(PBar, { value: st.pct, color: m.color, height: 6 }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textl)", marginTop: 5 } }, st.completed, "/", st.total, " learners completed"));
  })), tab === "users" && !selectedUser && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800 } }, "Users & Owners"), /* @__PURE__ */ React.createElement(Btn, { onClick: () => {
    setUserForm((f) => ({ ...f, show: !f.show }));
    setUserErr("");
  } }, "+ Create User")), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 16 } }, "Create normal user accounts or select an existing account to manage it."), userForm.show && /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 16, padding: "1.5rem", marginBottom: 18 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 14 } }, "Create New Normal User"), userErr && /* @__PURE__ */ React.createElement("div", { style: { color: "#f87171", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, padding: "10px 12px", marginBottom: 12, fontSize: 13 } }, userErr), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 } }, [["Full Name", "name", "text", "User full name"], ["Email", "email", "email", "user@example.com"], ["Temporary Password", "password", "password", "At least 8 characters"]].map(([label, key, type, ph]) => /* @__PURE__ */ React.createElement("div", { key }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", marginBottom: 5 } }, label), /* @__PURE__ */ React.createElement(
    "input",
    {
      type,
      value: userForm[key],
      onChange: (e) => setUserForm((f) => ({ ...f, [key]: e.target.value })),
      placeholder: ph,
      style: { width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)", fontSize: 13, outline: "none" }
    }
  )))), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: "var(--textl)", marginTop: 8 } }, "The password is sent to the backend and hashed with BCrypt before being stored in MySQL."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 14 } }, /* @__PURE__ */ React.createElement(Btn, { variant: "ghost", onClick: () => {
    setUserForm({ show: false, name: "", email: "", password: "" });
    setUserErr("");
  }, style: { flex: 1, justifyContent: "center" } }, "Cancel"), /* @__PURE__ */ React.createElement(Btn, { onClick: createUser, style: { flex: 2, justifyContent: "center" } }, "Create Normal User"))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative", flex: 1, minWidth: 220 } }, /* @__PURE__ */ React.createElement("span", { style: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15 } }, "\u{1F50D}"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: search,
      onChange: (e) => setSearch(e.target.value),
      placeholder: "Search by name, email or role\u2026",
      style: {
        width: "100%",
        padding: "12px 14px 12px 42px",
        background: "var(--card)",
        border: "1.5px solid var(--border)",
        borderRadius: 12,
        color: "var(--text)",
        fontSize: 14,
        outline: "none"
      }
    }
  )), /* @__PURE__ */ React.createElement("select", { value: roleFilter, onChange: (e) => setRoleFilter(e.target.value), style: selectStyle }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All roles"), /* @__PURE__ */ React.createElement("option", { value: "user" }, "Users"), /* @__PURE__ */ React.createElement("option", { value: "owner" }, "Module owners")), /* @__PURE__ */ React.createElement("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), style: selectStyle }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All statuses"), /* @__PURE__ */ React.createElement("option", { value: "active" }, "Active"), /* @__PURE__ */ React.createElement("option", { value: "disabled" }, "Deactivated"), /* @__PURE__ */ React.createElement("option", { value: "pending" }, "Pending"), /* @__PURE__ */ React.createElement("option", { value: "rejected" }, "Rejected"))), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)", marginBottom: 12 } }, filtered.length, " of ", allUsers.length, " accounts"), usersLoading && /* @__PURE__ */ React.createElement("div", { style: { padding: "1rem", color: "var(--textm)" } }, "Loading accounts from the database..."), usersError && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "1rem",
    marginBottom: 12,
    borderRadius: 10,
    color: "#f87171",
    background: "rgba(239,68,68,0.1)"
  } }, usersError, /* @__PURE__ */ React.createElement("button", { onClick: loadDatabaseUsers, style: { marginLeft: 12 } }, "Retry")), !usersLoading && filtered.length === 0 && !usersError && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "3rem", color: "var(--textm)", fontSize: 14 } }, "No users match your search"), filtered.map((u) => {
    const rc = RC[u.role] || "#7c3aed";
    const st = statusOf(u);
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: u.id,
        onClick: () => setSelectedUser(u),
        style: {
          background: st === "active" ? "var(--card)" : "rgba(239,68,68,0.04)",
          border: `1px solid ${st === "active" ? "var(--border)" : STATUS_COLOR[st] + "44"}`,
          borderRadius: 14,
          padding: "1.25rem 1.5rem",
          marginBottom: 10,
          cursor: "pointer"
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement(Ava, { initials: u.avatar, color: u.color || rc, size: 44 }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 15 } }, u.name), /* @__PURE__ */ React.createElement(Badge, { color: rc }, u.role), u.twoFactorEnabled && /* @__PURE__ */ React.createElement(Badge, { color: "#06b6d4" }, "2FA")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)" } }, u.email)), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 } }, /* @__PURE__ */ React.createElement(Badge, { color: STATUS_COLOR[st] }, STATUS_LABEL[st]), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textl)" } }, "Joined ", u.joinDate)), u.approvalStatus === "APPROVED" && /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
        e.stopPropagation();
        toggleActive(u);
      }, style: {
        background: u.active ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)",
        border: `1px solid ${u.active ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
        borderRadius: 7,
        padding: "5px 12px",
        fontSize: 11,
        fontWeight: 700,
        color: u.active ? "#f87171" : "#34d399",
        cursor: "pointer"
      } }, u.active ? "Deactivate" : "Activate"))
    );
  })), tab === "users" && selectedUser && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("button", { onClick: () => setSelectedUser(null), style: {
    background: "none",
    border: "none",
    color: "var(--textm)",
    cursor: "pointer",
    marginBottom: 20,
    fontSize: 14
  } }, "\u2190 All Users"), /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    background: `linear-gradient(135deg,${RC[selectedUser.role] || "#7c3aed"}22,transparent)`,
    padding: "2rem",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 16
  } }, /* @__PURE__ */ React.createElement(Ava, { initials: selectedUser.avatar, color: selectedUser.color || "#7c3aed", size: 60 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 6 } }, selectedUser.name), /* @__PURE__ */ React.createElement(Badge, { color: RC[selectedUser.role] || "#7c3aed" }, selectedUser.role), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)", marginTop: 6 } }, selectedUser.email))), /* @__PURE__ */ React.createElement("div", { style: { padding: "2rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 20 } }, [
    ["\u{1F4E7}", "Email", selectedUser.email],
    ["\u{1F4DE}", "Phone", selectedUser.phone || "Not set"],
    ["\u{1F3AD}", "Role", selectedUser.role],
    ["\u{1F4C5}", "Joined", selectedUser.joinDate],
    ["\u{1F534}", "Status", STATUS_LABEL[statusOf(selectedUser)]],
    ["\u{1F510}", "Two-factor authentication", selectedUser.twoFactorEnabled ? "Enabled" : "Not enabled"]
  ].map(([ic, l, v]) => /* @__PURE__ */ React.createElement("div", { key: l, style: { background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "1rem" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, marginBottom: 4 } }, ic), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "var(--textl)", textTransform: "uppercase", marginBottom: 2 } }, l), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, wordBreak: "break-all" } }, v)))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" } }, selectedUser.approvalStatus === "PENDING" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Btn, { variant: "success", size: "sm", onClick: () => approveUser(selectedUser.id) }, "\u2713 Approve"), /* @__PURE__ */ React.createElement(Btn, { variant: "danger", size: "sm", onClick: () => rejectUser(selectedUser.id) }, "\u2715 Reject")), selectedUser.approvalStatus === "APPROVED" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "var(--textm)" } }, "Role:"), /* @__PURE__ */ React.createElement("select", { value: selectedUser.databaseRole, onChange: (e) => changeRole(selectedUser, e.target.value), style: selectStyle }, /* @__PURE__ */ React.createElement("option", { value: "USER" }, "User (learner)"), /* @__PURE__ */ React.createElement("option", { value: "MODULE_OWNER" }, "Module Owner")), /* @__PURE__ */ React.createElement(Btn, { variant: selectedUser.active ? "danger" : "success", size: "sm", onClick: () => toggleActive(selectedUser) }, selectedUser.active ? "Deactivate account" : "Activate account"), selectedUser.twoFactorEnabled && /* @__PURE__ */ React.createElement(Btn, { variant: "amber", size: "sm", onClick: () => resetTwoFactor(selectedUser) }, "\u{1F510} Reset 2FA")))))), tab === "pending" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "Pending Registrations"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 20 } }, "Review and approve or reject registration requests."), pendingUsers.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "3rem", color: "var(--textm)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u2705"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 600 } }, "No pending registrations")) : pendingUsers.map((u) => /* @__PURE__ */ React.createElement("div", { key: u.id, style: {
    background: "var(--card)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: 14,
    padding: "1.5rem",
    marginBottom: 12
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, marginBottom: 14 } }, /* @__PURE__ */ React.createElement(Ava, { initials: u.avatar, color: u.color || "#7c3aed", size: 44 }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, fontSize: 15, marginBottom: 4 } }, u.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)" } }, u.email), u.phone && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textl)" } }, u.phone), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textl)", marginTop: 4 } }, "Requested: ", u.joinDate)), /* @__PURE__ */ React.createElement(Badge, { color: "#f59e0b" }, "Pending")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement(Btn, { variant: "success", size: "sm", onClick: () => approveUser(u.id), style: { flex: 1, justifyContent: "center" } }, "\u2713 Approve & Activate"), /* @__PURE__ */ React.createElement(Btn, { variant: "danger", size: "sm", onClick: () => rejectUser(u.id), style: { flex: 1, justifyContent: "center" } }, "\u2715 Reject"))))), tab === "owners" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "Module Owners"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)" } }, "Manage module owner accounts")), /* @__PURE__ */ React.createElement(Btn, { variant: "amber", onClick: () => setOwnerForm((f) => ({ ...f, show: true })) }, "+ Create Owner")), ownerForm.show && /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 16, padding: "1.75rem", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "Syne,sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 16 } }, "Create New Module Owner"), ownerErr && /* @__PURE__ */ React.createElement("div", { style: { color: "#f87171", padding: "9px 14px", marginBottom: 12 } }, ownerErr), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } }, [
    ["Full Name", "name", "text", "Module Owner Name"],
    ["Email", "email", "email", "owner@example.com"],
    ["Password", "password", "password", "Min 8 chars, letter + number"]
  ].map(([label, key, type, placeholder]) => /* @__PURE__ */ React.createElement("div", { key }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--textm)", marginBottom: 5 } }, label), /* @__PURE__ */ React.createElement(
    "input",
    {
      type,
      value: ownerForm[key] || "",
      onChange: (e) => setOwnerForm((f) => ({ ...f, [key]: e.target.value })),
      placeholder,
      style: {
        width: "100%",
        padding: "10px 14px",
        background: "rgba(255,255,255,0.05)",
        border: "1.5px solid var(--border)",
        borderRadius: 9,
        color: "var(--text)",
        fontSize: 13,
        outline: "none"
      }
    }
  )))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement(Btn, { variant: "ghost", onClick: () => {
    setOwnerForm({ show: false, name: "", email: "", password: "" });
    setOwnerErr("");
  }, style: { flex: 1, justifyContent: "center" } }, "Cancel"), /* @__PURE__ */ React.createElement(Btn, { variant: "amber", onClick: createOwner, style: { flex: 2, justifyContent: "center" } }, "Create Module Owner"))), databaseUsers.filter((u) => u.databaseRole === "MODULE_OWNER").length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)", fontSize: 14 } }, "No module owners yet."), databaseUsers.filter((u) => u.databaseRole === "MODULE_OWNER").map((u) => /* @__PURE__ */ React.createElement("div", { key: u.id, style: {
    background: "var(--card)",
    border: `1px solid ${u.active === false ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.2)"}`,
    borderRadius: 14,
    padding: "1.25rem 1.5rem",
    marginBottom: 10
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement(Ava, { initials: u.avatar, color: u.color || "#10b981", size: 44 }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, fontSize: 15, marginBottom: 4 } }, u.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)" } }, u.email), /* @__PURE__ */ React.createElement(Badge, { color: u.active === false ? "#ef4444" : "#10b981" }, u.active === false ? "Deactivated" : "Active")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--textm)" } }, modules.filter((m) => m.ownerName === u.name).length, " module(s)"), /* @__PURE__ */ React.createElement(Btn, { variant: u.active ? "danger" : "success", size: "sm", onClick: () => toggleActive(u) }, u.active ? "Deactivate" : "Activate"))))), tab === "modules" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "All Modules"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 20 } }, "Read-only overview of all training modules"), modules.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)", fontSize: 14 } }, "No modules have been created yet."), modules.map((m) => {
    const st = m.stats || { completed: 0, started: 0, pct: 0 };
    return /* @__PURE__ */ React.createElement("div", { key: m.id, style: {
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      marginBottom: 12,
      overflow: "hidden"
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 14, padding: "1.5rem", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: 50,
      height: 50,
      borderRadius: 12,
      background: `linear-gradient(135deg,${m.color}44,${m.color}22)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 24,
      flexShrink: 0
    } }, m.thumbnail), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700 } }, m.title), /* @__PURE__ */ React.createElement(Badge, { color: m.color }, m.category), /* @__PURE__ */ React.createElement(Badge, { color: m.published ? "#10b981" : "#64748b" }, m.published ? "Published" : "Draft")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12, fontSize: 11, color: "var(--textl)", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", null, "\u{1F464} ", m.ownerName || "No owner"), /* @__PURE__ */ React.createElement("span", null, "\u23F1 ", m.duration, "min"), /* @__PURE__ */ React.createElement("span", null, "\u2753 ", m.questionCount, "Q"), /* @__PURE__ */ React.createElement("span", null, "\u2705 ", st.completed, " done"), /* @__PURE__ */ React.createElement("span", null, "\u{1F504} ", st.started, " in progress"), m.dueDate && /* @__PURE__ */ React.createElement("span", null, "\u{1F4C5} ", fmtDate(m.dueDate)))), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, color: m.color } }, st.pct, "%")), /* @__PURE__ */ React.createElement("div", { style: { padding: "0 1.5rem 1rem" } }, /* @__PURE__ */ React.createElement(PBar, { value: st.pct, color: m.color, height: 5 })));
  })), tab === "resets" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "Password Reset Requests"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 20 } }, "The new password only becomes active when you approve it. Requests expire after 7 days."), resets.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "3rem", color: "var(--textm)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u{1F511}"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 600 } }, "No password reset requests")), resets.map((r) => {
    const col = { PENDING: "#f59e0b", APPROVED: "#10b981", REJECTED: "#ef4444", EXPIRED: "#64748b" }[r.status] || "#64748b";
    return /* @__PURE__ */ React.createElement("div", { key: r.id, style: { background: "var(--card)", border: `1px solid ${r.status === "PENDING" ? "rgba(245,158,11,0.3)" : "var(--border)"}`, borderRadius: 14, padding: "1.25rem 1.5rem", marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(Ava, { initials: initialsOf(r.userName), color: colorFor(r.userId), size: 40 }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 180 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, fontSize: 15 } }, r.userName), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--textm)" } }, r.email), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--textl)", marginTop: 4 } }, "Requested ", fmtDateTime(r.requestedAt), r.reviewedAt && /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 Reviewed ", fmtDateTime(r.reviewedAt), r.reviewedBy ? " by " + r.reviewedBy : ""))), /* @__PURE__ */ React.createElement(Badge, { color: col }, r.status), r.status === "PENDING" && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement(Btn, { variant: "success", size: "sm", onClick: () => decideReset(r, true) }, "\u2713 Approve"), /* @__PURE__ */ React.createElement(Btn, { variant: "danger", size: "sm", onClick: () => decideReset(r, false) }, "\u2715 Reject"))));
  })), tab === "audit" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 } }, "Audit Log"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--textm)", marginBottom: 20 } }, "The latest 200 security-relevant actions"), audit === null && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)" } }, "Loading\u2026"), audit && audit.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--textm)" } }, "Nothing recorded yet."), audit && audit.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { textAlign: "left", color: "var(--textl)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10 } }, ["Time", "Who", "Action", "Details", "IP"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "12px 14px", borderBottom: "1px solid var(--border)" } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, audit.map((a) => /* @__PURE__ */ React.createElement("tr", { key: a.id, style: { borderBottom: "1px solid var(--border)" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 14px", whiteSpace: "nowrap", color: "var(--textm)" } }, fmtDateTime(a.createdAt)), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 14px" } }, a.actor), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 14px" } }, /* @__PURE__ */ React.createElement(Badge, { color: /FAIL|REJECT|DISABLED/.test(a.action) ? "#ef4444" : "#06b6d4" }, a.action.replace(/_/g, " "))), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 14px", color: "var(--textm)" } }, a.description), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 14px", color: "var(--textl)", whiteSpace: "nowrap" } }, a.ipAddress))))))))));
}
function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    api.get("/api/auth/me").then((d) => {
      if (d && d.authenticated) setUser(toClientUser(d.user));
    }).catch(() => {
    }).finally(() => setChecking(false));
    const expired = () => {
      api.resetCsrf();
      setUser(null);
    };
    window.addEventListener("cs-session-expired", expired);
    return () => window.removeEventListener("cs-session-expired", expired);
  }, []);
  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (e) {
    }
    api.resetCsrf();
    setUser(null);
  };
  if (checking) return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React.createElement(Spinner, null));
  if (!user) return /* @__PURE__ */ React.createElement(LoginPage, { onLogin: setUser });
  if (user.role === "admin") return /* @__PURE__ */ React.createElement(AdminDashboard, { admin: user, onLogout: logout });
  if (user.role === "owner") return /* @__PURE__ */ React.createElement(OwnerDashboard, { owner: user, onLogout: logout });
  return /* @__PURE__ */ React.createElement(UserDashboard, { user, onLogout: logout });
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
