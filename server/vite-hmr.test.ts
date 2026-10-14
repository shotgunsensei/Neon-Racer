import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import type { Socket } from "node:net";
import express from "express";
import WebSocket, { Receiver } from "ws";
import { setupVite } from "./vite";

// Exercise the real dev entry point without server/index, storage or a database.
const app = express();
const server = createServer(app);
const sockets = new Set<Socket>();
server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
let vite: Awaited<ReturnType<typeof setupVite>>;
let origin: string;
let accepted = 0;
const clients = new Set<WebSocket>();
const inbox = new WeakMap<WebSocket, any[]>();
let embeddedReceiver: Receiver & { _maxFragments: number; _maxBufferedChunks: number };

before(async () => {
  vite = await setupVite(server, app);
  vite.ws.on("connection", client => {
    accepted++;
    embeddedReceiver = (client as unknown as { _receiver: typeof embeddedReceiver })._receiver;
  });
  vite.ws.on("neon:qa", (data, client) => client.send("neon:ack", data));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  for (const client of clients) client.terminate();
  for (const client of vite?.ws.clients ?? []) client.socket.terminate();
  await vite?.close();
  for (const socket of sockets) socket.destroy();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

async function connect(path = "/vite-hmr", protocol = "vite-hmr", browserOrigin?: string) {
  const client = new WebSocket(origin.replace("http:", "ws:") + path, protocol, {
    handshakeTimeout: 500, ...(browserOrigin ? { origin: browserOrigin } : {}),
  });
  clients.add(client);
  inbox.set(client, []);
  client.on("close", () => clients.delete(client));
  client.on("error", () => {});
  client.on("message", data => {
    try { inbox.get(client)!.push(JSON.parse(data.toString())); } catch {}
  });
  await new Promise<void>((resolve, reject) => {
    client.once("open", resolve);
    // Deliberately omit URLs and ephemeral websocket tokens from errors/logs.
    client.once("error", () => { client.terminate(); reject(new Error("HMR handshake rejected")); });
  });
  return client;
}

async function payload(client: WebSocket, predicate: (value: any) => boolean) {
  const known = inbox.get(client)!.find(predicate);
  if (known) return known;
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => { client.off("message", onMessage); reject(new Error("HMR message timeout")); }, 1500);
    function onMessage(data: WebSocket.RawData) {
      const value = JSON.parse(data.toString());
      if (predicate(value)) { clearTimeout(timeout); client.off("message", onMessage); resolve(value); }
    }
    client.on("message", onMessage);
  });
}

test("actual HMR accepts ordinary custom messages and broadcasts without changing dev routing", async () => {
  const client = await connect();
  assert.equal((await payload(client, value => value.type === "connected")).type, "connected");
  client.send(JSON.stringify({ type: "custom", event: "neon:qa", data: { mode: "arcade", text: "pilot λ" } }));
  const ack = await payload(client, value => value.event === "neon:ack");
  assert.deepEqual(ack.data, { mode: "arcade", text: "pilot λ" });
  vite.ws.send({ type: "full-reload", path: "/play" });
  assert.equal((await payload(client, value => value.type === "full-reload")).path, "/play");
  client.terminate();
});

async function receive(Constructor: typeof Receiver, frames: number[][], limits: object) {
  const receiver = new Constructor({ isServer: false, maxPayload: 128, ...limits });
  receiver.on("error", () => {});
  let message: Buffer | undefined;
  receiver.on("message", data => { message = Buffer.from(data as Buffer); });
  let error: (Error & { code?: string }) | null = null;
  for (const frame of frames) {
    error = await new Promise(resolve => receiver.write(Buffer.from(frame), err => resolve(err ?? null)));
    if (error) break;
  }
  receiver.destroy();
  return { error, message };
}

test("Vite's embedded receiver enforces finite fragment/chunk limits and preserves legitimate fragments", async () => {
  const client = await connect();
  const raw = embeddedReceiver;
  assert.ok(Number.isFinite(raw._maxFragments) && raw._maxFragments > 0);
  assert.ok(Number.isFinite(raw._maxBufferedChunks) && raw._maxBufferedChunks > 0);
  const Constructor = raw.constructor as typeof Receiver;
  assert.notEqual(Constructor, Receiver, "test the embedded implementation, not the standalone dependency");
  const fragmented = await receive(Constructor, [[0x02, 1, 97], [0x00, 1, 98], [0x80, 1, 99]], { maxFragments: 2 });
  assert.equal(fragmented.error?.code, "WS_ERR_TOO_MANY_BUFFERED_PARTS");
  const chunks = await receive(Constructor, [[0x82, 126, 0, 32], [97], [98], [99]], { maxBufferedChunks: 2 });
  assert.equal(chunks.error?.code, "WS_ERR_TOO_MANY_BUFFERED_PARTS");
  const normal = await receive(Constructor, [[0x02, 1, 97], [0x80, 1, 98]], { maxFragments: 2, maxBufferedChunks: 2 });
  assert.equal(normal.error, null);
  assert.equal(normal.message?.toString(), "ab");
  client.terminate();
});

test("browser-origin HMR requires its generated token and rejects missing/invalid tokens", async () => {
  const count = accepted;
  await assert.rejects(connect("/vite-hmr", "vite-hmr", origin), /rejected/);
  await assert.rejects(connect("/vite-hmr?token=invalid", "vite-hmr", origin), /rejected/);
  assert.equal(accepted, count);
  const client = await connect(`/vite-hmr?token=${vite.config.webSocketToken}`, "vite-hmr", origin);
  assert.equal((await payload(client, value => value.type === "connected")).type, "connected");
  client.terminate();
});

test("HMR fragment rejection closes that connection while the dev server remains usable", async () => {
  const client = await connect();
  const limit = embeddedReceiver._maxFragments;
  assert.ok(limit > 0 && limit <= 20000, "keep the local regression's input bounded");
  const closed = new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("HMR rejection timeout")), 4000);
    client.once("close", code => { clearTimeout(timeout); resolve(code); });
  });
  // A few kilobytes of payload, far below maxPayload, must still hit the part limit.
  for (let i = 0; i <= limit; i++) client.send("a", { binary: true, fin: false });
  assert.equal(await closed, 1008);
  assert.equal((await fetch(origin + "/play")).status, 200);
  const next = await connect();
  assert.equal((await payload(next, value => value.type === "connected")).type, "connected");
  next.terminate();
});

test("wrong HMR path/protocol do not reach the receiver", async () => {
  const count = accepted;
  await assert.rejects(connect("/other", "vite-hmr"), /rejected/);
  await assert.rejects(connect("/vite-hmr", "other"), /rejected/);
  assert.equal(accepted, count);
});

test("Vite 8 middleware transforms the play page, client and React entry without database access", async () => {
  assert.equal(vite.watcher.options.disableGlobbing, true,
    "development watcher treats added file paths literally instead of expanding brace ranges");
  for (const [path, expected] of [["/play?mode=arcade", "/@vite/client"],
    ["/@vite/client", "WebSocket"], ["/src/main.tsx", "createRoot"]]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(expected));
  }
});
