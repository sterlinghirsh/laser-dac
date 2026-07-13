import WebsocketClient from './websocket.js';

const host = window.document.location.host.replace(/:.*/, '');
const ws = new WebsocketClient();

const patternSelect = document.getElementById('pattern-select');
const patternDescription = document.getElementById('pattern-description');
const patternParamsEl = document.getElementById('pattern-params');
const globalParamsEl = document.getElementById('global-params');
const monochromeInput = document.getElementById('monochrome');
const statsTable = document.getElementById('stats-table');
const canvas = document.getElementById('expected-canvas');
const simulatorFrame = document.getElementById('simulator-frame');
const simulatorLink = document.getElementById('simulator-link');

const simulatorUrl = `http://${host}:8080`;
simulatorFrame.src = `${simulatorUrl}?embed`;
simulatorLink.href = simulatorUrl;

// Device-level settings are defined here; pattern params come from the server.
const SETTING_DEFS = [
  { key: 'pps', label: 'PPS', min: 1000, max: 65535, step: 500 },
  { key: 'resolution', label: 'Resolution', min: 10, max: 500, step: 10 },
  { key: 'blankingPoints', label: 'Blanking Points', min: 0, max: 100, step: 1 },
  { key: 'maxWaitPoints', label: 'Max Wait Points', min: 0, max: 50, step: 1 },
  { key: 'colorShift', label: 'Color Shift (points)', min: -20, max: 20, step: 0.25 },
];

let state = null;
let renderedPatternId = null;

function send(type, data) {
  ws.send(JSON.stringify({ type, data }));
}

function sendSettings() {
  const data = { monochrome: monochromeInput.checked };
  for (const def of SETTING_DEFS) {
    data[def.key] = readRow(globalParamsEl, def.key);
  }
  send('setSettings', data);
}

function sendPatternParams() {
  const pattern = currentPattern();
  const values = {};
  for (const def of pattern.params) {
    values[def.key] = readRow(patternParamsEl, def.key);
  }
  send('setPatternParams', { patternId: pattern.id, values });
}

function currentPattern() {
  return state.patterns.find((p) => p.id === state.patternId);
}

// A labeled slider+number pair. Either input updates the other and
// triggers onChange.
function buildRow(container, def, onChange) {
  const row = document.createElement('div');
  row.className = 'param-row';
  row.dataset.key = def.key;

  const label = document.createElement('label');
  label.textContent = def.label;

  const range = document.createElement('input');
  range.type = 'range';
  const number = document.createElement('input');
  number.type = 'number';
  for (const input of [range, number]) {
    input.min = def.min;
    input.max = def.max;
    input.step = def.step;
  }

  range.addEventListener('input', () => {
    number.value = range.value;
    onChange();
  });
  number.addEventListener('input', () => {
    range.value = number.value;
    onChange();
  });

  row.appendChild(label);
  row.appendChild(range);
  row.appendChild(number);
  container.appendChild(row);
}

function setRow(container, key, value) {
  const row = container.querySelector(`[data-key="${key}"]`);
  for (const input of row.querySelectorAll('input')) {
    // Don't clobber the input the user is interacting with.
    if (input !== document.activeElement) {
      input.value = value;
    }
  }
}

function readRow(container, key) {
  const row = container.querySelector(`[data-key="${key}"]`);
  return parseFloat(row.querySelector('input[type="number"]').value);
}

function renderControls() {
  // Pattern list (structure changes only on first state).
  if (!patternSelect.options.length) {
    for (const pattern of state.patterns) {
      const option = document.createElement('option');
      option.value = pattern.id;
      option.textContent = pattern.name;
      patternSelect.appendChild(option);
    }
  }
  if (patternSelect !== document.activeElement) {
    patternSelect.value = state.patternId;
  }

  const pattern = currentPattern();
  patternDescription.textContent = pattern.description;

  // Rebuild pattern param rows only when the pattern changes.
  if (renderedPatternId !== pattern.id) {
    renderedPatternId = pattern.id;
    patternParamsEl.innerHTML = '';
    for (const def of pattern.params) {
      buildRow(patternParamsEl, def, sendPatternParams);
    }
    if (!pattern.params.length) {
      patternParamsEl.innerHTML =
        '<p id="pattern-description">No pattern-specific settings.</p>';
    }
  }
  for (const def of pattern.params) {
    setRow(patternParamsEl, def.key, state.patternParams[pattern.id][def.key]);
  }

  for (const def of SETTING_DEFS) {
    setRow(globalParamsEl, def.key, state.settings[def.key]);
  }
  if (monochromeInput !== document.activeElement) {
    monochromeInput.checked = state.settings.monochrome;
  }
}

function drawExpected() {
  const expected = state.expected;
  const pixelRatio = window.devicePixelRatio || 1;
  const size = canvas.clientWidth * pixelRatio;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = 1.5 * pixelRatio;

  for (const line of expected.lines) {
    ctx.strokeStyle = line.color;
    ctx.setLineDash(line.dashed ? [4 * pixelRatio, 6 * pixelRatio] : []);
    ctx.beginPath();
    ctx.moveTo(line.x1 * size, line.y1 * size);
    ctx.lineTo(line.x2 * size, line.y2 * size);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const circle of expected.circles || []) {
    ctx.strokeStyle = circle.color;
    ctx.beginPath();
    ctx.arc(circle.x * size, circle.y * size, circle.radius * size, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#aaa';
  ctx.font = `${11 * pixelRatio}px sans-serif`;
  ctx.textAlign = 'center';
  for (const note of expected.notes) {
    ctx.fillText(note.text, note.x * size, note.y * size);
  }
}

// Build the device settings rows once, before the first state arrives.
for (const def of SETTING_DEFS) {
  buildRow(globalParamsEl, def, sendSettings);
}
monochromeInput.addEventListener('change', sendSettings);

patternSelect.addEventListener('change', () => {
  send('setPattern', { patternId: patternSelect.value });
});

ws.onmessage = function (ev) {
  const message = JSON.parse(ev.data);
  switch (message.type) {
    case 'state':
      state = message.data;
      renderControls();
      drawExpected();
      break;
    case 'stats':
      statsTable.innerText = JSON.stringify(message.data, null, 2);
      break;
    default:
      console.error('Unknown message type: ' + message.type, message);
  }
};

ws.onopen = function () {
  console.log('Websocket connection opened.');
};

ws.open(`ws://${host}:8321`);
