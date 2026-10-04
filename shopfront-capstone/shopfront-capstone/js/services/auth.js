/**
 * auth.js
 * Simulated authentication. There is no server, so accounts live in
 * localStorage, but it follows real-world habits:
 *  - passwords are never stored: only a PBKDF2-SHA-256 hash with a random salt per user
 *  - sign-in errors don't reveal whether the email exists
 *  - 5 wrong passwords lock that email for 30 seconds
 *  - sessions expire (12 hours, or 30 days with "Keep me signed in")
 * This is a front-end simulation for a portfolio project: anyone with access
 * to the browser can read localStorage, so it is not real security.
 */
export const DEMO_ACCOUNTS = [
  { name: "Store Admin", email: "admin@shopfront.dev", password: "Admin1234", role: "admin" },
  { name: "Demo Customer", email: "demo@shopfront.dev", password: "Demo1234", role: "customer" },
];

const MAX_ATTEMPTS = 5;
const LOCK_MS = 30 * 1000;
const SESSION_SHORT = 12 * 60 * 60 * 1000;
const SESSION_LONG = 30 * 24 * 60 * 60 * 1000;
const ITERATIONS = 100000;

export class AuthError extends Error {
  constructor(code, message, field) {
    super(message);
    this.name = "AuthError";
    this.code = code;   // email-taken | invalid-credentials | locked | invalid-input
    this.field = field; // which form field the message belongs to, if any
  }
}

export const normalizeEmail = (email = "") => email.trim().toLowerCase();
export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

/** Returns what's missing, e.g. ["a number"]. Empty array means the password is OK. */
export function passwordProblems(password = "") {
  const missing = [];
  if (password.length < 8) missing.push("at least 8 characters");
  if (!/[A-Za-z]/.test(password)) missing.push("a letter");
  if (!/\d/.test(password)) missing.push("a number");
  return missing;
}

const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const randomId = (bytes = 8, cryptoImpl = globalThis.crypto) => toHex(cryptoImpl.getRandomValues(new Uint8Array(bytes)));

export async function hashPassword(password, salt, cryptoImpl = globalThis.crypto) {
  const encoder = new TextEncoder();
  const key = await cryptoImpl.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await cryptoImpl.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}

/** Compares every character, so the time taken doesn't hint at how much matched. */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const publicUser = ({ id, name, email, role, createdAt }) => ({ id, name, email, role, createdAt });

export function createAuth({ storage, now = Date.now, cryptoImpl = globalThis.crypto } = {}) {
  const users = () => storage.get("users", []);
  const saveUsers = (list) => storage.set("users", list);

  async function createUser({ name, email, password, role = "customer" }) {
    const salt = randomId(16, cryptoImpl);
    const user = {
      id: `u_${randomId(6, cryptoImpl)}`,
      name: name.trim(),
      email: normalizeEmail(email),
      role,
      salt,
      hash: await hashPassword(password, salt, cryptoImpl),
      createdAt: now(),
    };
    saveUsers([...users(), user]);
    return user;
  }

  function startSession(user, remember) {
    storage.set("session", { userId: user.id, expiresAt: now() + (remember ? SESSION_LONG : SESSION_SHORT) });
    return publicUser(user);
  }

  return {
    /** Creates the demo accounts the first time the app runs. */
    async seedDemoAccounts() {
      for (const account of DEMO_ACCOUNTS) {
        if (!users().some((u) => u.email === account.email)) await createUser(account);
      }
    },

    async signUp({ name = "", email = "", password = "" }, { remember = false } = {}) {
      if (name.trim().length < 2) throw new AuthError("invalid-input", "Enter your name.", "name");
      if (!isValidEmail(normalizeEmail(email))) throw new AuthError("invalid-input", "Enter a valid email address.", "email");
      const missing = passwordProblems(password);
      if (missing.length) throw new AuthError("invalid-input", `Password needs ${missing.join(", ")}.`, "password");
      if (users().some((u) => u.email === normalizeEmail(email))) {
        throw new AuthError("email-taken", "An account with this email already exists. Sign in instead.", "email");
      }
      const user = await createUser({ name, email, password });
      return startSession(user, remember);
    },

    async signIn({ email = "", password = "" }, { remember = false } = {}) {
      const key = normalizeEmail(email);
      const attempts = storage.get("auth-attempts", {});
      const record = attempts[key] ?? { count: 0, lockedUntil: 0 };
      if (record.lockedUntil > now()) {
        const seconds = Math.ceil((record.lockedUntil - now()) / 1000);
        throw new AuthError("locked", `Too many attempts. Try again in ${seconds} seconds.`);
      }

      const user = users().find((u) => u.email === key);
      // Hash even when the user doesn't exist, so response time doesn't reveal which emails are registered
      const hash = await hashPassword(password, user?.salt ?? "no-such-user", cryptoImpl);

      if (!user || !safeEqual(hash, user.hash)) {
        const count = record.count + 1;
        attempts[key] = count >= MAX_ATTEMPTS ? { count: 0, lockedUntil: now() + LOCK_MS } : { count, lockedUntil: 0 };
        storage.set("auth-attempts", attempts);
        throw new AuthError("invalid-credentials", "Email or password is incorrect.");
      }

      delete attempts[key];
      storage.set("auth-attempts", attempts);
      return startSession(user, remember);
    },

    signOut() {
      storage.remove("session");
    },

    /** The signed-in user, or null if there is no valid session. */
    currentUser() {
      const session = storage.get("session");
      if (!session || session.expiresAt <= now()) {
        if (session) storage.remove("session");
        return null;
      }
      const user = users().find((u) => u.id === session.userId);
      return user ? publicUser(user) : null;
    },

    listUsers: () => users().map(publicUser),
  };
}
