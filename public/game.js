const app = document.querySelector('#app');
const status = document.querySelector('#status');
const storageKey = 'bi-pub-quiz-player';
let session, state, controller, busy = false, clockOffset = 0;
let connected = false;
const initialCode = new URLSearchParams(location.search).get('room')?.toUpperCase();

function el(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}
function button(label, action, className) {
  const node = el('button', label, className);
  node.type = 'button';
  node.onclick = action;
  return node;
}
function message(value = '') { status.textContent = value; }

async function request(path, data, signal) {
  const headers = {};
  if (session) headers.authorization = 'Bearer ' + session.token;
  if (data) headers['content-type'] = 'application/json';
  const response = await fetch(path, { method: data ? 'POST' : 'GET', headers, body: data && JSON.stringify(data), signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || 'Could not reach the quiz server.');
    error.status = response.status;
    throw error;
  }
  return response;
}
function roomPath(action) { return '/api/rooms/' + session.code + '/' + action; }
function leave() {
  controller?.abort();
  sessionStorage.removeItem(storageKey);
  session = state = undefined;
  connected = false;
  history.replaceState(null, '', '/');
  home();
}

async function enter(path, nickname) {
  if (busy) return;
  busy = true;
  message();
  try {
    session = await (await request(path, { name: nickname })).json();
    sessionStorage.setItem(storageKey, JSON.stringify(session));
    connect();
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
  }
}
function home(prefill) {
  app.replaceChildren(document.querySelector('#home').content.cloneNode(true));
  const nickname = document.querySelector('#nickname');
  const code = document.querySelector('#code');
  if (prefill) code.value = prefill;
  document.querySelector('#join').onsubmit = event => {
    event.preventDefault();
    if (nickname.reportValidity()) enter('/api/rooms/' + code.value.trim().toUpperCase() + '/join', nickname.value);
  };
  document.querySelector('#create').onclick = () => {
    if (nickname.reportValidity()) enter('/api/rooms', nickname.value);
  };
}

async function connect() {
  controller?.abort();
  const connection = new AbortController();
  controller = connection;
  if (!state) app.replaceChildren(el('p', 'Connecting to the room…'));
  while (!connection.signal.aborted) {
    try {
      const response = await request(roomPath('events'), undefined, connection.signal);
      const stream = response.body.pipeThrough(new TextDecoderStream());
      let buffer = '';
      for await (const chunk of stream) {
        buffer += chunk;
        let divider;
        while ((divider = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, divider);
          buffer = buffer.slice(divider + 2);
          if (!frame.startsWith('data: ')) continue;
          const next = JSON.parse(frame.slice(6));
          const changed = !state || next.phase !== state.phase || next.index !== state.index;
          const previousInput = document.querySelector('#estimate');
          const draft = previousInput?.value;
          const inputFocused = previousInput === document.activeElement;
          const wasConnected = connected;
          state = next;
          clockOffset = Date.now() - state.now;
          connected = true;
          if (!wasConnected || changed) message();
          render();
          if (!changed && draft !== undefined) {
            const input = document.querySelector('#estimate');
            if (input) {
              input.value = draft;
              if (inputFocused) input.focus();
            }
          }
          if (changed) document.querySelector('#screen-title')?.focus();
        }
      }
    } catch (error) {
      if (connection.signal.aborted) return;
      if ([401, 404].includes(error.status)) {
        const code = session.code;
        leave();
        home(code);
        message(error.message);
        return;
      }
    }
    if (connection.signal.aborted) return;
    connected = false;
    message('Connection lost. Reconnecting…');
    if (state) render();
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
}
async function act(action, value) {
  if (busy || !connected) return;
  busy = true;
  message();
  try {
    await request(roomPath(action), { phase: state.phase, index: state.index, value });
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
  }
}
function playerList(scored) {
  const list = el('ol', undefined, 'players');
  const sorted = scored ? [...state.players].sort((a, b) => b.score - a.score) : state.players;
  for (const p of sorted) {
    const item = el('li');
    item.append(el('span', p.name + (p.you ? ' (you)' : '') + (p.host ? ' · Host' : '')));
    if (scored) item.append(el('span', p.score + ' pts', 'score'));
    list.append(item);
  }
  return list;
}
function chartView(chart) {
  const figure = el('figure', undefined, 'chart');
  figure.append(el('figcaption', chart.title));
  const max = Math.max(...chart.values);
  chart.values.forEach((value, index) => {
    const row = el('div', undefined, 'bar');
    const track = el('span');
    track.setAttribute('aria-hidden', 'true');
    const fill = el('i');
    fill.style.width = (100 * value / max) + '%';
    track.append(fill);
    row.append(el('span', chart.labels[index]), track, el('span', value));
    figure.append(row);
  });
  return figure;
}
function title(panel, label, className) {
  const heading = el('h2', label, className);
  heading.id = 'screen-title';
  heading.tabIndex = -1;
  panel.append(heading);
}
function note(panel, label) { panel.append(el('p', label, 'muted')); }
function advance(panel, label, allowed = true) {
  if (!state.host) return note(panel, 'Waiting for the host to continue.');
  const next = button(label, () => act('advance'));
  next.disabled = !connected || !allowed;
  panel.append(next);
}
function timer() {
  const counter = el('span', undefined, 'timer');
  counter.id = 'timer';
  counter.setAttribute('role', 'timer');
  return counter;
}
function updateTimer() {
  const counter = document.querySelector('#timer');
  if (counter && state?.ends) counter.textContent = Math.max(0, Math.ceil((state.ends + clockOffset - Date.now()) / 1000)) + 's';
}

function render() {
  const game = el('div', undefined, 'game');
  const head = el('div', undefined, 'room-head');
  head.append(el('p', 'Room ' + state.code, 'muted'));
  if (state.ends) head.append(timer());
  game.append(head);
  const panel = el('section', undefined, 'panel');
  game.append(panel);
  const { phase } = state;

  if (phase === 'lobby') {
    title(panel, 'Quiz lobby');
    panel.append(el('p', state.code, 'code'));
    note(panel, 'Share the code or invite players with a link.');
    const invite = button('Copy invite link', async () => {
      const url = new URL('/', location.href);
      url.searchParams.set('room', state.code);
      try {
        await navigator.clipboard.writeText(url.href);
        message('Invite link copied.');
      } catch {
        message(url.href);
      }
    }, 'outline');
    panel.append(invite, playerList(false));
    note(panel, state.players.length + ' of 8 seats filled · 2 needed to start');
    advance(panel, 'Start quiz', state.players.length >= 2);
  } else if (phase === 'question' || phase === 'reveal') {
    const q = state.question;
    panel.append(el('p', state.round + ' · Question ' + (state.index + 1) + ' of 15', 'eyebrow'));
    title(panel, q.prompt);
    if (q.chart) panel.append(chartView(q.chart));
    const options = el('div', undefined, 'options');
    q.choices.forEach((choice, i) => {
      const option = button('', () => act('answer', i), 'option');
      option.append(el('b', 'ABCD'[i]), document.createTextNode(choice));
      option.disabled = !connected || phase === 'reveal' || state.answered;
      if (phase === 'reveal' && q.correct === i) option.classList.add('correct');
      if (phase === 'reveal' && state.selected === i) option.classList.add('selected');
      options.append(option);
    });
    panel.append(options);
    if (phase === 'question') {
      note(panel, (state.answered ? 'Answer locked · ' : '') + state.count + ' of ' + state.players.length + ' answered');
    } else {
      const reveal = el('div', undefined, 'reveal');
      reveal.append(el('strong', (state.selected === q.correct ? '+100 pts · ' : '') + 'Correct answer: ' + q.choices[q.correct]),
        el('div', q.explanation));
      panel.append(reveal);
      advance(panel, state.index % 5 === 4 ? 'Show leaderboard' : 'Next question');
    }
  } else if (phase === 'leaderboard') {
    panel.append(el('p', state.round, 'eyebrow'));
    title(panel, 'Leaderboard');
    panel.append(playerList(true));
    advance(panel, state.index === 14 ? 'See final result' : 'Start next round');
  } else if (phase === 'estimate') {
    panel.append(el('p', 'TIEBREAK', 'eyebrow'));
    title(panel, state.estimate);
    if (state.eligible && !state.answered) {
      const form = el('form', undefined, 'estimate-form');
      const input = el('input');
      input.id = 'estimate';
      input.type = 'number';
      input.min = 0;
      input.max = Number.MAX_SAFE_INTEGER;
      input.required = true;
      input.setAttribute('aria-label', 'Your estimate');
      const submit = el('button', 'Lock estimate');
      submit.disabled = !connected;
      form.append(input, submit);
      form.onsubmit = event => { event.preventDefault(); act('answer', input.valueAsNumber); };
      panel.append(form);
    }
    if (!state.eligible) note(panel, 'The players tied for first are answering.');
    if (state.answered) note(panel, 'Estimate locked.');
    note(panel, state.count + ' of ' + state.eligibleCount + ' estimates submitted');
  } else {
    panel.append(el('p', state.winners.length > 1 ? 'JOINT WINNERS' : 'WINNER', 'eyebrow'));
    title(panel, state.winners.join(' & '), 'winner');
    if (state.guesses) {
      note(panel, 'Tiebreak answer: ' + state.target.toLocaleString() + ' ' + state.unit);
      for (const entry of state.guesses) {
        note(panel, entry.name + ' · ' + (entry.guess?.toLocaleString() ?? 'No estimate'));
      }
    }
    panel.append(playerList(true), button('Back to home', () => { leave(); message(); }, 'outline'));
  }
  app.replaceChildren(game);
  updateTimer();
}

try { session = JSON.parse(sessionStorage.getItem(storageKey)); } catch {}
if (session && (!initialCode || initialCode === session.code)) connect();
else {
  session = undefined;
  home(initialCode);
}
setInterval(updateTimer, 200);
