import { createServer } from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { rounds, estimates } from './questions.mjs';

const rooms = new Map();
const ttl = 3 * 60 * 60 * 1000;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pick = items => items[randomInt(items.length)];
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function player(room, name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 24) {
    throw new Error('Enter a nickname of 1–24 characters.');
  }
  name = name.trim();
  if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('That nickname is already taken.');
  }
  const p = { token: randomBytes(24).toString('hex'), name, score: 0 };
  room.players.push(p);
  return p;
}

function snapshot(room, p) {
  const { phase, code, index, ends, players, answers } = room;
  const question = room.deck?.[index];
  const state = {
    code, phase, index, ends, now: Date.now(), host: players[0] === p,
    players: players.map(entry => ({
      name: entry.name, score: entry.score, host: entry === players[0], you: entry === p
    })),
    count: answers.size, answered: answers.has(p), round: rounds[Math.floor(index / 5)]?.name
  };
  if (phase === 'question' || phase === 'reveal') {
    state.question = { prompt: question.prompt, choices: question.choices, chart: question.chart };
  }
  if (phase === 'reveal') {
    Object.assign(state.question, { correct: question.correct, explanation: question.explanation });
    state.selected = answers.get(p);
  }
  if (phase === 'estimate') {
    state.estimate = room.estimate.prompt;
    state.eligible = room.tied.includes(p);
    state.eligibleCount = room.tied.length;
  }
  if (phase === 'finished') {
    state.winners = room.winners.map(entry => entry.name);
    if (room.estimate) {
      state.target = room.estimate.target;
      state.unit = room.estimate.unit;
      state.guesses = room.tied.map(entry => ({ name: entry.name, guess: answers.get(entry) }));
    }
  }
  return state;
}

function broadcast(room) {
  room.touched = Date.now();
  for (const [res, p] of room.streams) {
    if (res.writableLength > 65536) {
      res.destroy();
    } else {
      res.write('data: ' + JSON.stringify(snapshot(room, p)) + '\n\n');
    }
  }
}

function finishTimedPhase(room) {
  clearTimeout(room.timer);
  room.ends = null;
  if (room.phase === 'question') {
    const correct = room.deck[room.index].correct;
    for (const [p, value] of room.answers) if (value === correct) p.score += 100;
    room.phase = 'reveal';
  } else if (room.phase === 'estimate') {
    const distance = p => Math.abs(room.estimate.target - room.answers.get(p));
    const submitted = room.tied.filter(p => room.answers.has(p));
    const best = Math.min(...submitted.map(distance));
    room.winners = submitted.length ? submitted.filter(p => distance(p) === best) : room.tied;
    room.phase = 'finished';
  }
  broadcast(room);
}

function timed(room, phase) {
  room.phase = phase;
  room.answers = new Map();
  room.ends = Date.now() + 25000;
  room.timer = setTimeout(() => finishTimedPhase(room), 25000).unref();
  broadcast(room);
}

function advance(room) {
  if (room.phase === 'lobby') {
    if (room.players.length < 2) throw new Error('At least two players are needed.');
    room.deck = rounds.flatMap(round => shuffle(round.items).slice(0, 5).map(q => {
      const choices = shuffle(q.choices);
      return { ...q, choices, correct: choices.indexOf(q.choices[0]) };
    }));
    room.index = 0;
    timed(room, 'question');
  } else if (room.phase === 'reveal' && room.index % 5 === 4) {
    room.phase = 'leaderboard';
    broadcast(room);
  } else if (room.phase === 'reveal' || room.phase === 'leaderboard' && room.index < 14) {
    room.index++;
    timed(room, 'question');
  } else if (room.phase === 'leaderboard') {
    const top = Math.max(...room.players.map(p => p.score));
    room.tied = room.players.filter(p => p.score === top);
    if (room.tied.length > 1) {
      room.estimate = pick(estimates);
      timed(room, 'estimate');
    } else {
      room.winners = room.tied;
      room.phase = 'finished';
      broadcast(room);
    }
  } else {
    throw new Error('The game cannot advance yet.');
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Invalid request.');
  return data;
}

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css'],
  '/game.js': ['game.js', 'text/javascript']
};
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url, [file, type]]) =>
  [url, { bytes: await readFile(new URL('./public/' + file, import.meta.url)), type }]
)));

export const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const url = new URL(req.url, 'http://localhost');
    const asset = Object.hasOwn(assets, url.pathname) && assets[url.pathname];
    if (req.method === 'GET' && asset) {
      res.writeHead(200, { 'content-type': asset.type });
      return res.end(asset.bytes);
    }
    if (req.method === 'POST' && url.pathname === '/api/rooms') {
      const data = await body(req);
      if (rooms.size >= 500) throw new Error('The server is full. Try again later.');
      let code;
      do {
        code = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('');
      } while (rooms.has(code));
      const room = { code, players: [], phase: 'lobby', index: 0, ends: null, answers: new Map(), streams: new Map(), touched: Date.now() };
      const p = player(room, data.name);
      rooms.set(code, room);
      return json(res, 201, { code, token: p.token });
    }
    const match = /^\/api\/rooms\/([A-Z2-9]{5})\/(join|events|advance|answer)$/.exec(url.pathname);
    if (!match) return json(res, 404, { error: 'Page unavailable.' });
    const room = rooms.get(match[1]);
    const action = match[2];
    if (!room) return json(res, 404, { error: 'Room unavailable. Check the code or create a room.' });
    if (req.method === 'POST' && action === 'join') {
      const data = await body(req);
      if (room.phase !== 'lobby') throw new Error('That quiz has already started.');
      if (room.players.length >= 8) throw new Error('That room is full.');
      const p = player(room, data.name);
      broadcast(room);
      return json(res, 201, { code: room.code, token: p.token });
    }
    const p = room.players.find(entry => entry.token === req.headers.authorization?.slice(7));
    if (!p) return json(res, 401, { error: 'Your player session could not be found.' });
    if (req.method === 'GET' && action === 'events') {
      for (const [old, owner] of room.streams) if (owner === p) old.end();
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' });
      room.streams.set(res, p);
      res.on('close', () => room.streams.delete(res));
      return res.write('data: ' + JSON.stringify(snapshot(room, p)) + '\n\n');
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Method unavailable.' });
    const data = await body(req);
    if (room.ends && Date.now() >= room.ends) finishTimedPhase(room);
    if (data.phase !== room.phase || data.index !== room.index) throw new Error('This question or screen has already closed.');
    if (action === 'advance') {
      if (room.players[0] !== p) throw new Error('Only the host can advance the game.');
      advance(room);
    } else if (action === 'answer') {
      const value = data.value;
      if (room.answers.has(p)) throw new Error('Your answer is already locked.');
      let expected;
      if (room.phase === 'question' && Number.isInteger(value) && value >= 0 && value < 4) {
        expected = room.players.length;
      } else if (room.phase === 'estimate' && room.tied.includes(p) && Number.isSafeInteger(value) && value >= 0) {
        expected = room.tied.length;
      } else {
        throw new Error('Enter a valid answer before time runs out.');
      }
      room.answers.set(p, value);
      if (room.answers.size === expected) finishTimedPhase(room);
      else broadcast(room);
    } else {
      return json(res, 405, { error: 'Method unavailable.' });
    }
    json(res, 200, { ok: true });
  } catch (error) {
    if (!res.headersSent && !res.destroyed) json(res, 400, { error: error instanceof SyntaxError ? 'Invalid request.' : error.message });
  }
});

setInterval(() => {
  for (const [code, room] of rooms) {
    if (Date.now() - room.touched > ttl) {
      for (const res of room.streams.keys()) res.end();
      rooms.delete(code);
    } else {
      for (const res of room.streams.keys()) res.write(': heartbeat\n\n');
    }
  }
}, 15000).unref();

if (!process.env.QUIZ_TEST) {
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
    console.log('BI Pub Quiz · http://localhost:' + server.address().port);
  });
}
