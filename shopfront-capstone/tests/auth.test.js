import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuth, hashPassword, passwordProblems, AuthError, DEMO_ACCOUNTS } from "../js/services/auth.js";
import { memoryStorage, fakeClock } from "./helpers.js";

const setup = () => { const storage = memoryStorage(); const now = fakeClock(); return { storage, now, auth: createAuth({ storage, now }) }; };

test("password rules", () => {
  assert.deepEqual(passwordProblems("short1"), ["at least 8 characters"]);
  assert.deepEqual(passwordProblems("longpassword"), ["a number"]);
  assert.deepEqual(passwordProblems("Good1234"), []);
});

test("hashing is salted and repeatable", async () => {
  const a = await hashPassword("Secret123", "salt-a");
  assert.equal(a, await hashPassword("Secret123", "salt-a"));
  assert.notEqual(a, await hashPassword("Secret123", "salt-b"));
  assert.equal(a.length, 64);
});

test("sign up stores a hash, never the password, and signs the user in", async () => {
  const { auth, storage } = setup();
  const user = await auth.signUp({ name: "Harshita", email: " Harshita@Example.com ", password: "Secret123" });
  assert.equal(user.email, "harshita@example.com");
  assert.equal(auth.currentUser().id, user.id);
  const raw = JSON.stringify(storage.get("users"));
  assert.ok(!raw.includes("Secret123"));
  assert.ok(!("hash" in user) && !("salt" in user), "public user object must not expose hash or salt");
});

test("duplicate email and weak password are rejected", async () => {
  const { auth } = setup();
  await auth.signUp({ name: "A", email: "a@b.co", password: "Secret123" }).catch(() => {}); // name too short
  await auth.signUp({ name: "Ann", email: "a@b.co", password: "Secret123" });
  await assert.rejects(auth.signUp({ name: "Ann", email: "A@B.CO", password: "Secret123" }), (e) => e.code === "email-taken");
  await assert.rejects(auth.signUp({ name: "Bob", email: "bob@b.co", password: "weak" }), (e) => e.field === "password");
});

test("sign in works with the right password only, with the same message for unknown emails", async () => {
  const { auth } = setup();
  await auth.signUp({ name: "Ann", email: "ann@b.co", password: "Secret123" });
  auth.signOut();
  assert.equal(auth.currentUser(), null);
  const wrong = await auth.signIn({ email: "ann@b.co", password: "nope" }).catch((e) => e);
  const unknown = await auth.signIn({ email: "who@b.co", password: "nope" }).catch((e) => e);
  assert.equal(wrong.message, unknown.message);
  const user = await auth.signIn({ email: "ANN@b.co", password: "Secret123" });
  assert.equal(user.name, "Ann");
});

test("5 wrong passwords lock the account for 30 seconds", async () => {
  const { auth, now } = setup();
  await auth.signUp({ name: "Ann", email: "ann@b.co", password: "Secret123" });
  for (let i = 0; i < 5; i++) await auth.signIn({ email: "ann@b.co", password: "bad" }).catch(() => {});
  await assert.rejects(auth.signIn({ email: "ann@b.co", password: "Secret123" }), (e) => e instanceof AuthError && e.code === "locked");
  now.advance(31_000);
  assert.ok(await auth.signIn({ email: "ann@b.co", password: "Secret123" }));
});

test("sessions expire: 12 hours by default, 30 days when remembered", async () => {
  const { auth, now } = setup();
  await auth.signUp({ name: "Ann", email: "ann@b.co", password: "Secret123" });
  now.advance(13 * 3600_000);
  assert.equal(auth.currentUser(), null);
  await auth.signIn({ email: "ann@b.co", password: "Secret123" }, { remember: true });
  now.advance(29 * 24 * 3600_000);
  assert.ok(auth.currentUser());
});

test("demo accounts are created once with the right roles", async () => {
  const { auth } = setup();
  await auth.seedDemoAccounts();
  await auth.seedDemoAccounts();
  assert.equal(auth.listUsers().length, DEMO_ACCOUNTS.length);
  const admin = await auth.signIn({ email: "admin@shopfront.dev", password: "Admin1234" });
  assert.equal(admin.role, "admin");
});
