import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { createApi } from '../server/handlers.js';

const settings = {
  APP_ORIGIN: 'https://resume.example', CLERK_ISSUER: 'https://clerk.example', CLERK_SECRET_KEY: 'fake-clerk-secret',
  STRAPI_BASE_URL: 'https://strapi.example', STRAPI_API_KEY: 'fake-strapi-secret',
  GEMINI_API_KEY: 'fake-gemini-secret', GEMINI_MODEL: 'gemini-test',
};
function fixture(options = {}) {
  const calls = [];
  const records = [
    { documentId: 'resumeA', clerkUserId: 'user_alice', title: 'Alice', resumeId: 'uuidA' },
    { documentId: 'resumeB', clerkUserId: 'user_bob', title: 'Bob', resumeId: 'uuidB' },
    { documentId: 'legacy', userEmail: 'alice@example.com', title: 'Unmapped legacy' },
  ];
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    assert.equal(init.redirect, 'error');
    assert(init.signal instanceof AbortSignal);
    if (options.failure) return { ok: false, status: 500, json: async () => ({ error: settings.STRAPI_API_KEY }) };
    if (url.hostname === 'generativelanguage.googleapis.com') {
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Generated response' }] } }] }) };
    }
    assert.equal(url.origin, settings.STRAPI_BASE_URL);
    assert.equal(init.headers.Authorization, 'Bearer ' + settings.STRAPI_API_KEY);
    if (init.method === 'GET') {
      const data = options.ignoreFilter ? records : records.filter(record =>
        record.clerkUserId === url.searchParams.get('filters[clerkUserId][$eq]') &&
        (!url.searchParams.has('filters[documentId][$eq]') || record.documentId === url.searchParams.get('filters[documentId][$eq]')));
      return { ok: true, json: async () => ({ data, meta: { pagination: { total: data.length } } }) };
    }
    if (init.method === 'DELETE') return { ok: true, status: 204 };
    const { data } = JSON.parse(init.body);
    return { ok: true, json: async () => ({ data: { documentId: 'resumeA', ...data } }) };
  };
  const verifySession = async (token, env) => {
    assert.equal(env.APP_ORIGIN, settings.APP_ORIGIN);
    if (token === 'alice') return { userId: 'user_alice' };
    if (token === 'bob') return { userId: 'user_bob' };
    throw new Error('Expired, forged or revoked token');
  };
  const api = createApi({ fetchImpl, verifySession, env: { ...settings, ...options.env } });
  async function invoke(route, { method = 'GET', token = 'alice', body, id, origin = settings.APP_ORIGIN, raw, parsed = false } = {}) {
    const req = Readable.from([Buffer.from(raw ?? (body ? JSON.stringify(body) : ''))]);
    req.method = method;
    req.headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), origin };
    if (parsed) req.body = body;
    req.query = { id, userEmail: 'bob@example.com', 'filters[clerkUserId][$eq]': 'user_bob' };
    const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.code = value; return this; }, json(value) { this.body = value; } };
    await api[route](req, res);
    return res;
  }
  return { calls, invoke };
}

test('all routes reject missing, invalid or cross-origin sessions before provider access', async () => {
  const { calls, invoke } = fixture();
  for (const route of ['resumes', 'resume', 'ai']) {
    const method = route === 'ai' ? 'POST' : 'GET';
    for (const token of ['', 'forged', 'expired', 'revoked']) assert.equal((await invoke(route, { method, token, id: 'resumeA' })).code, 401);
    assert.equal((await invoke(route, { method, origin: 'https://attacker.example', id: 'resumeA' })).code, 403);
  }
  assert.equal(calls.length, 0);
});
test('missing server configuration fails closed', async () => {
  const { calls, invoke } = fixture({ env: { CLERK_ISSUER: '' } });
  assert.equal((await invoke('resumes')).code, 503);
  assert.equal(calls.length, 0);
});
test('list is filtered by verified immutable identity, ignoring browser email and query filters', async () => {
  const { calls, invoke } = fixture();
  const response = await invoke('resumes');
  assert.equal(response.code, 200);
  assert.deepEqual(response.body.data.map(resume => resume.documentId), ['resumeA']);
  assert(!JSON.stringify(response.body).includes('clerkUserId'));
  assert.equal(calls[0].url.searchParams.get('filters[clerkUserId][$eq]'), 'user_alice');
});
test('create overwrites forged owner and discards browser email metadata', async () => {
  const { calls, invoke } = fixture();
  const response = await invoke('resumes', { method: 'POST', body: { data: { title: 'Mine', resumeId: 'uuid-new', clerkUserId: 'user_bob', userEmail: 'bob@example.com' } } });
  assert.equal(response.code, 200);
  const payload = JSON.parse(calls[0].init.body).data;
  assert.equal(payload.clerkUserId, 'user_alice');
  assert.equal(payload.userEmail, undefined);
});
test('read, update and delete cannot access another owner or unmapped historical record', async () => {
  const { calls, invoke } = fixture();
  for (const method of ['GET', 'PUT', 'DELETE']) {
    for (const id of ['resumeB', 'legacy']) assert.equal((await invoke('resume', { method, id, body: { data: { title: 'Hijack' } } })).code, 404);
  }
  assert(calls.every(call => call.init.method === 'GET'));
});
test('owned read/update/delete preserve existing Strapi response shape', async () => {
  const { calls, invoke } = fixture();
  assert.equal((await invoke('resume', { id: 'resumeA' })).body.data.documentId, 'resumeA');
  assert.equal((await invoke('resume', { id: 'resumeA', method: 'PUT', body: { data: { title: 'New title' } } })).body.data.title, 'New title');
  assert.equal((await invoke('resume', { id: 'resumeA', method: 'DELETE' })).code, 200);
  assert.deepEqual(calls.map(call => call.init.method), ['GET', 'GET', 'PUT', 'GET', 'DELETE']);
});
test('server independently checks returned owners if upstream filtering is misconfigured', async () => {
  const { invoke } = fixture({ ignoreFilter: true });
  assert.equal((await invoke('resumes')).code, 502);
  assert.equal((await invoke('resume', { id: 'resumeA' })).code, 404);
});
test('rejects path injection, relationship mutation, oversized bodies and unapproved methods', async () => {
  const { calls, invoke } = fixture();
  assert.equal((await invoke('resume', { id: '../users' })).code, 400);
  assert.equal((await invoke('resume', { id: 'resumeA', method: 'PATCH' })).code, 405);
  assert.equal((await invoke('resumes', { method: 'POST', body: { data: { title: 'Mine', resumeId: 'uuid-new', users: { connect: ['admin'] } } } })).code, 400);
  assert.equal((await invoke('resumes', { method: 'POST', raw: 'x'.repeat(100001) })).code, 413);
  assert.equal((await invoke('resumes', { method: 'POST', raw: '{' })).code, 400);
  assert.equal(calls.length, 0);
});
test('AI uses only a fixed server provider and maintains text result contract', async () => {
  const { calls, invoke } = fixture();
  const response = await invoke('ai', { method: 'POST', body: { prompt: 'Summarize a developer resume' } });
  assert.equal(response.body.text, 'Generated response');
  assert.equal(calls[0].url.origin, 'https://generativelanguage.googleapis.com');
  assert.equal(calls[0].init.headers['x-goog-api-key'], settings.GEMINI_API_KEY);
  assert.equal((await invoke('ai', { method: 'POST', body: { prompt: 'x', url: 'https://attacker.example' } })).code, 400);
  for (let i = 0; i < 9; i++) await invoke('ai', { method: 'POST', body: { prompt: 'x' } });
  assert.equal((await invoke('ai', { method: 'POST', body: { prompt: 'x' } })).code, 429);
});
test('provider failure responses never expose provider credentials', async () => {
  const { invoke } = fixture({ failure: true });
  for (const route of ['resumes', 'ai']) {
    const response = await invoke(route, route === 'ai' ? { method: 'POST', body: { prompt: 'x' } } : {});
    assert.equal(response.code, 502);
    assert(!JSON.stringify(response).includes(settings.STRAPI_API_KEY));
    assert(!JSON.stringify(response).includes(settings.GEMINI_API_KEY));
  }
});
test('browser services contain no public provider credential variables', () => {
  for (const file of ['service/GlobalApi.js', 'service/AIModal.js', 'service/ApiClient.js']) {
    const source = readFileSync(file, 'utf8');
    assert(!/VITE_(STRAPI|GOOGLE)|generativelanguage|@google\/generative-ai/.test(source));
  }
});

test('Clerk verifier pins issuer and authorized party and requires an active matching session', async () => {
  const { createSessionVerifier } = await import('../server/session.js');
  let claims = { sub: 'user_alice', sid: 'sess_alice', azp: settings.APP_ORIGIN };
  let session = { status: 'active', userId: 'user_alice' };
  const verify = createSessionVerifier({
    verifyToken: async (token, options) => {
      assert.equal(token, 'signed-jwt');
      assert.equal(options.issuer, settings.CLERK_ISSUER);
      assert.deepEqual(options.authorizedParties, [settings.APP_ORIGIN]);
      assert.equal(options.secretKey, settings.CLERK_SECRET_KEY);
      return claims;
    },
    createClerkClient: () => ({ sessions: { getSession: async (sid) => {
      assert.equal(sid, 'sess_alice');
      return session;
    } } }),
  });
  assert.deepEqual(await verify('signed-jwt', settings), { userId: 'user_alice' });
  session = { status: 'revoked', userId: 'user_alice' };
  await assert.rejects(verify('signed-jwt', settings));
  session = { status: 'active', userId: 'user_bob' };
  await assert.rejects(verify('signed-jwt', settings));
  claims = { sub: 'user_alice', azp: settings.APP_ORIGIN };
  await assert.rejects(verify('signed-jwt', settings));
  claims = { sub: 'user_alice', sid: 'sess_alice', azp: 'https://attacker.example' };
  await assert.rejects(verify('signed-jwt', settings));
  const badSignature = createSessionVerifier({ verifyToken: async () => { throw new Error('Invalid JWT signature'); }, createClerkClient: () => { assert.fail('Must not query session'); } });
  await assert.rejects(badSignature('forged-jwt', settings));
});

test('Vercel pre-parsed JSON bodies work and remain size-limited', async () => {
  const { invoke } = fixture();
  assert.equal((await invoke('resumes', { method: 'POST', parsed: true, body: { data: { title: 'Parsed', resumeId: 'uuid-new' } } })).code, 200);
  assert.equal((await invoke('resumes', { method: 'POST', parsed: true, body: { data: { title: 'x'.repeat(100001), resumeId: 'uuid-new' } } })).code, 413);
});
