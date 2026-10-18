const textFields = new Set(['title', 'resumeId', 'userName', 'firstName', 'lastName', 'jobTitle', 'address', 'phone', 'email', 'summery', 'themeColor']);
const componentFields = {
  Experience: new Set(['title', 'companyName', 'city', 'state', 'startDate', 'endDate', 'currentlyWorking', 'workSummery']),
  education: new Set(['universityName', 'degree', 'major', 'startDate', 'endDate', 'description']),
  skills: new Set(['name', 'rating']),
};
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ApiError(status, message); };
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

async function readJson(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) fail(415, 'JSON content type required');
  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > 100000) fail(413, 'Request too large');
  // Vercel's Node helper may already have parsed the body before this handler runs.
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 100000) fail(413, 'Request too large');
    try { return JSON.parse(raw.toString()); }
    catch { fail(400, 'Invalid JSON'); }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 100000) fail(413, 'Request too large');
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400, 'Invalid JSON'); }
}

function resumeInput(body, creating) {
  if (!plainObject(body) || !plainObject(body.data)) fail(400, 'Invalid resume data');
  const data = {};
  for (const [key, value] of Object.entries(body.data)) {
    // Browser identity metadata never determines ownership.
    if (['userEmail', 'clerkUserId', 'id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt'].includes(key)) continue;
    if (textFields.has(key)) {
      if (typeof value !== 'string' || value.length > (key === 'summery' ? 16000 : 1000)) fail(400, 'Invalid resume field');
      data[key] = value;
    } else if (componentFields[key]) {
      if (!Array.isArray(value) || value.length > 50) fail(400, 'Invalid resume component');
      data[key] = value.map((entry) => {
        if (!plainObject(entry)) fail(400, 'Invalid resume component');
        const component = {};
        for (const [field, fieldValue] of Object.entries(entry)) {
          // Do not accept Strapi component identifiers or relation operations.
          if (!componentFields[key].has(field)) fail(400, 'Unknown resume component field');
          if (field === 'rating') {
            if (typeof fieldValue !== 'number' || fieldValue < 0 || fieldValue > 5) fail(400, 'Invalid skill rating');
          } else if (field === 'currentlyWorking') {
            if (typeof fieldValue !== 'boolean') fail(400, 'Invalid work status');
          } else if (typeof fieldValue !== 'string' || fieldValue.length > 16000) fail(400, 'Invalid resume component field');
          component[field] = fieldValue;
        }
        return component;
      });
    } else fail(400, 'Unknown resume field');
  }
  if (!creating && ('resumeId' in data || 'userName' in data)) fail(400, 'Immutable resume metadata');
  if (creating && (!data.title?.trim() || !/^[a-zA-Z0-9-]{1,64}$/.test(data.resumeId || ''))) fail(400, 'Title and resume ID are required');
  if (!Object.keys(data).length) fail(400, 'No resume changes');
  return data;
}

export function createApi({ verifySession, fetchImpl = fetch, env = process.env, now = Date.now } = {}) {
  const limits = new Map();
  let windowStart = now();
  function rateLimit(userId, kind) {
    if (now() - windowStart > 60000) { limits.clear(); windowStart = now(); }
    if (limits.size > 5000 && !limits.has(`${kind}:${userId}`)) fail(429, 'Request limit reached');
    const key = `${kind}:${userId}`;
    const count = (limits.get(key) || 0) + 1;
    limits.set(key, count);
    if (count > (kind === 'ai' ? 10 : 60)) fail(429, 'Request limit reached');
  }
  function config() {
    if (!env.CLERK_SECRET_KEY || !env.CLERK_ISSUER || !env.APP_ORIGIN || !env.STRAPI_API_KEY || !env.STRAPI_BASE_URL) fail(503, 'Server is not configured');
    const origin = new URL(env.APP_ORIGIN);
    const base = new URL(env.STRAPI_BASE_URL);
    if (origin.origin !== env.APP_ORIGIN || !['https:', 'http:'].includes(origin.protocol) ||
        (origin.protocol === 'http:' && origin.hostname !== 'localhost') ||
        base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') fail(503, 'Server is not configured');
    return base;
  }
  async function authenticate(req, kind) {
    config();
    if (req.headers.origin && req.headers.origin !== env.APP_ORIGIN) fail(403, 'Invalid origin');
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer [^\s]+$/.test(header) || header.length > 10000) fail(401, 'Sign in required');
    let user;
    try { user = await verifySession(header.slice(7), env); }
    catch { fail(401, 'Session is invalid or unavailable'); }
    if (!/^user_[a-zA-Z0-9]+$/.test(user?.userId || '')) fail(401, 'Invalid session');
    rateLimit(user.userId, kind);
    return user.userId;
  }
  async function strapi(path, { method = 'GET', data, query } = {}) {
    const url = new URL(`/api/user-resumes${path}`, config());
    if (query) url.search = query.toString();
    const response = await fetchImpl(url, {
      method, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${env.STRAPI_API_KEY}`, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify({ data }) } : {}),
    });
    if (!response.ok) fail(response.status === 404 ? 404 : 502, 'Resume provider request failed');
    if (response.status === 204) return { data: null };
    const result = await response.json();
    if (result.error) fail(502, 'Resume provider request failed');
    return result;
  }
  function ownedQuery(userId, id) {
    const query = new URLSearchParams();
    query.set('filters[clerkUserId][$eq]', userId);
    if (id) query.set('filters[documentId][$eq]', id);
    query.set('populate', '*');
    return query;
  }
  async function ownedResume(userId, id) {
    const result = await strapi('', { query: ownedQuery(userId, id) });
    if (!Array.isArray(result.data) || result.data.length !== 1 || result.data[0].documentId !== id || result.data[0].clerkUserId !== userId) fail(404, 'Resume not found');
    return { data: result.data[0] };
  }
  function wrapper(action) {
    return async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      try { const result = await action(req); const serialized = JSON.stringify(result, (key, value) => key === 'clerkUserId' ? undefined : value);
        const safe = [env.STRAPI_API_KEY, env.GEMINI_API_KEY, env.CLERK_SECRET_KEY].filter(Boolean).reduce((text, secret) => text.split(secret).join('[redacted]'), serialized);
        res.status(200).json(JSON.parse(safe)); }
      catch (error) { res.status(error instanceof ApiError ? error.status : 502).json({ error: error instanceof ApiError ? error.message : 'Service request failed' }); }
    };
  }
  return {
    resumes: wrapper(async (req) => {
      if (!['GET', 'POST'].includes(req.method)) fail(405, 'Method not allowed');
      const userId = await authenticate(req, 'resumes');
      if (req.method === 'GET') {
        const result = await strapi('', { query: ownedQuery(userId) });
        if (!Array.isArray(result.data) || result.data.some(resume => resume.clerkUserId !== userId)) fail(502, 'Resume provider ownership check failed');
        return result;
      }
      const data = resumeInput(await readJson(req), true);
      return strapi('', { method: 'POST', data: { ...data, clerkUserId: userId } });
    }),
    resume: wrapper(async (req) => {
      if (!['GET', 'PUT', 'DELETE'].includes(req.method)) fail(405, 'Method not allowed');
      const userId = await authenticate(req, 'resumes');
      const id = req.query?.id;
      if (typeof id !== 'string' || !/^[a-zA-Z0-9]{1,64}$/.test(id)) fail(400, 'Invalid resume ID');
      const owned = await ownedResume(userId, id);
      if (req.method === 'GET') return owned;
      if (req.method === 'DELETE') return strapi(`/${id}`, { method: 'DELETE' });
      const data = resumeInput(await readJson(req), false);
      return strapi(`/${id}`, { method: 'PUT', data });
    }),
    ai: wrapper(async (req) => {
      if (req.method !== 'POST') fail(405, 'Method not allowed');
      await authenticate(req, 'ai');
      if (!env.GEMINI_API_KEY || !/^[a-zA-Z0-9.-]+$/.test(env.GEMINI_MODEL || '')) fail(503, 'AI is not configured');
      const body = await readJson(req);
      if (!plainObject(body) || typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 16000 || !['json', 'html'].includes(body.format || 'json') || Object.keys(body).some(key => !['prompt', 'format'].includes(key))) fail(400, 'Invalid prompt');
      const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: body.prompt }] }], generationConfig: { temperature: 1, topP: 0.95, topK: 64, maxOutputTokens: 2048, responseMimeType: body.format === 'html' ? 'text/plain' : 'application/json' } }),
      });
      if (!response.ok) fail(502, 'AI provider request failed');
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
      if (!text) fail(502, 'AI provider returned no result');
      return { text: text.split(env.GEMINI_API_KEY).join('[redacted]') };
    }),
  };
}
