import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { rounds, estimates } from './questions.mjs';

process.env.QUIZ_TEST = '1';
const { server } = await import('./server.mjs');

test('question and estimate bank', () => {
  const questions = rounds.flatMap(round => round.items);
  assert.equal(questions.length, 74);
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  assert.equal(estimates.length, 10);
  for (const q of questions) {
    assert.ok(q.prompt && q.explanation);
    assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.every(Boolean));
    if (q.chart) assert.equal(q.chart.labels.length, q.chart.values.length);
  }
});

test('room capacity, reconnect, full match, scoring and final tiebreak', async t => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function post(path, data, token) {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token && { authorization: 'Bearer ' + token }) },
      body: JSON.stringify(data)
    });
    return { status: r.status, data: await r.json() };
  }
  async function stream(path, token) {
    const controller = new AbortController();
    t.after(() => controller.abort());
    const r = await fetch(base + path + '/events', {
      headers: { authorization: 'Bearer ' + token }, signal: controller.signal
    });
    assert.equal(r.status, 200);
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    return {
      stop: () => controller.abort(),
      async next() {
        while (true) {
          const divider = buffer.indexOf('\n\n');
          if (divider >= 0) {
            const frame = buffer.slice(0, divider);
            buffer = buffer.slice(divider + 2);
            if (frame.startsWith('data: ')) return JSON.parse(frame.slice(6));
          } else {
            const item = await reader.read();
            assert.equal(item.done, false);
            buffer += item.value;
          }
        }
      }
    };
  }
  const create = name => post('/api/rooms', { name });
  const capacity = (await create('Capacity host')).data;
  for (let i = 1; i <= 8; i++) {
    const result = await post('/api/rooms/' + capacity.code + '/join', { name: 'Player ' + i });
    assert.equal(result.status, i < 8 ? 201 : 400);
  }
  const host = (await create('Host')).data;
  const path = '/api/rooms/' + host.code;
  const action = (player, verb, { phase, index }, value) => post(path + '/' + verb, { phase, index, value }, player.token);
  const hostStream = await stream(path, host.token);
  let screen = await hostStream.next();
  assert.equal((await action(host, 'advance', screen)).status, 400);
  const guest = (await post(path + '/join', { name: 'Guest' })).data;
  screen = await hostStream.next();
  assert.equal(screen.players.length, 2);
  let guestStream = await stream(path, guest.token);
  assert.equal((await guestStream.next()).host, false);
  assert.equal((await action(guest, 'advance', screen)).status, 400);
  assert.equal((await action(host, 'advance', screen)).status, 200);
  const seen = new Set();
  for (let index = 0; index < 15; index++) {
    const current = await hostStream.next();
    assert.equal(current.index, index);
    assert.equal(current.phase, 'question');
    assert.equal(current.question.correct, undefined);
    const candidates = rounds[Math.floor(index / 5)].items;
    const q = candidates.find(q => q.prompt === current.question.prompt && q.chart?.title === current.question.chart?.title);
    assert.ok(q);
    assert.equal(seen.has(q.id), false);
    seen.add(q.id);
    const correct = current.question.choices.indexOf(q.choices[0]);
    assert.equal((await action(host, 'answer', current, correct)).status, 200);
    assert.equal((await hostStream.next()).answered, true);
    assert.equal((await action(host, 'answer', current, correct)).status, 400);
    if (index === 0) {
      guestStream.stop();
      guestStream = await stream(path, guest.token);
      const resumed = await guestStream.next();
      assert.equal(resumed.count, 1);
      assert.equal(resumed.answered, false);
    }
    assert.equal((await action(guest, 'answer', current, correct)).status, 200);
    screen = await hostStream.next();
    assert.equal(screen.phase, 'reveal');
    assert.equal(screen.question.correct, correct);
    assert.ok(screen.players.every(p => p.score === (index + 1) * 100));
    assert.equal((await action(host, 'advance', screen)).status, 200);
    if (index % 5 === 4) {
      screen = await hostStream.next();
      assert.equal(screen.phase, 'leaderboard');
      assert.equal((await action(host, 'advance', screen)).status, 200);
    }
  }
  screen = await hostStream.next();
  assert.equal(screen.phase, 'estimate');
  assert.equal(screen.target, undefined);
  const target = estimates.find(q => q.prompt === screen.estimate).target;
  assert.equal((await action(host, 'answer', screen, target)).status, 200);
  assert.equal((await hostStream.next()).count, 1);
  assert.equal((await action(guest, 'answer', screen, target + 2)).status, 200);
  screen = await hostStream.next();
  assert.equal(screen.phase, 'finished');
  assert.deepEqual(screen.winners, ['Host']);
  assert.equal(screen.target, target);
});
