import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../server/src/app.js";

let server, base;
before(() => new Promise((r) => {
  server = createApp().listen(0, () => { base = `http://localhost:${server.address().port}`; r(); });
}));
after(() => server.close());

test("returns status for a known file number", async () => {
  const res = await fetch(`${base}/api/status/HYD1234567`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "Appointment confirmed");
});

test("rejects a badly formatted file number with a helpful message", async () => {
  const res = await fetch(`${base}/api/status/abc`);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /3 letters followed by 7 digits/);
});

test("returns 404 for an unknown file number", async () => {
  const res = await fetch(`${base}/api/status/HYD0000000`);
  assert.equal(res.status, 404);
});
