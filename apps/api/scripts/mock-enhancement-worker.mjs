import http from 'node:http';

const port = Number(process.env.MOCK_ENHANCEMENT_WORKER_PORT ?? 18081);

const server = http.createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/enhance') {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid json' }));
    return;
  }
  const startMs = numberValue(body.audioStartMs) ?? 0;
  const endMs = numberValue(body.audioEndMs) ?? startMs + 30_000;
  const midpoint = Math.max(startMs + 1000, Math.floor((startMs + endMs) / 2));

  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify({
      provider: 'mock-enhancement-worker',
      segments: [
        {
          localSpeaker: 'Speaker 1',
          startMs,
          endMs: midpoint,
          text: `这是第 ${(numberValue(body.chunkIndex) ?? 0) + 1} 段的模拟精修结果，第一位说话人正在说明问题。`,
          confidence: 0.98,
        },
        {
          localSpeaker: 'Speaker 2',
          startMs: midpoint,
          endMs,
          text: '第二位说话人补充了后续动作和风险点。',
          confidence: 0.96,
        },
      ],
    }),
  );
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock enhancement worker listening on http://127.0.0.1:${port}`);
});

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
