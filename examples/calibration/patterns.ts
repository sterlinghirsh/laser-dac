import { Circle, Color, Line, Rect, Scene, Wait } from '@laser-dac/draw';

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export type ParamValues = Record<string, number>;

// Geometry the client draws on the "expected" canvas, in the same 0..1
// coordinate space as the laser. Colors are CSS strings.
export interface ExpectedLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  dashed?: boolean;
}

export interface ExpectedCircle {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface ExpectedNote {
  x: number;
  y: number;
  text: string;
}

export interface ExpectedView {
  lines: ExpectedLine[];
  circles?: ExpectedCircle[];
  notes: ExpectedNote[];
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  params: ParamDef[];
  render(scene: Scene, params: ParamValues): void;
  expected(params: ParamValues): ExpectedView;
}

const WHITE: Color = [1, 1, 1];
const RED: Color = [1, 0, 0];
const OFF: Color = [0, 0, 0];

// A line that turns the laser off at `mid` but keeps the mirrors moving
// through to `to`, for measuring on/off latency against a reference.
function addHalfBlankedLine(
  scene: Scene,
  from: { x: number; y: number },
  mid: { x: number; y: number },
  to: { x: number; y: number }
) {
  scene.add(new Line({ from, to: mid, color: RED, blankBefore: true }));
  scene.add(new Line({ from: mid, to, color: OFF }));
}

const latency: Pattern = {
  id: 'latency',
  name: 'On/Off Latency',
  description:
    'Measures the delay between laser on/off and mirror position. ' +
    'Each red line turns the laser off at the white crosshair but keeps the mirrors moving, ' +
    'and the arrows show draw direction. ' +
    'If a red line stops SHORT of the crosshair, the beam is switching off before the mirrors ' +
    'get there: INCREASE Color Shift. If it overshoots past the crosshair, DECREASE it. ' +
    'Horizontal and vertical lines should need the same shift. ' +
    'The calibrated shift is measured in points, so re-check it after changing PPS.',
  params: [],
  render(scene: Scene) {
    // Reference crosshair through the midpoint.
    scene.add(
      new Line({
        from: { x: 0.2, y: 0.5 },
        to: { x: 0.8, y: 0.5 },
        color: WHITE,
        blankBefore: true,
        blankAfter: true,
      })
    );
    scene.add(
      new Line({
        from: { x: 0.5, y: 0.2 },
        to: { x: 0.5, y: 0.8 },
        color: WHITE,
        blankBefore: true,
        blankAfter: true,
      })
    );
    // Two horizontal test lines drawn in opposite directions, and two
    // vertical ones. Latency shifts the visible end along the draw
    // direction, so opposite directions shifting opposite ways confirms
    // it's latency rather than a position offset.
    addHalfBlankedLine(
      scene,
      { x: 0.1, y: 0.35 },
      { x: 0.5, y: 0.35 },
      { x: 0.9, y: 0.35 }
    );
    addHalfBlankedLine(
      scene,
      { x: 0.9, y: 0.65 },
      { x: 0.5, y: 0.65 },
      { x: 0.1, y: 0.65 }
    );
    addHalfBlankedLine(
      scene,
      { x: 0.35, y: 0.1 },
      { x: 0.35, y: 0.5 },
      { x: 0.35, y: 0.9 }
    );
    addHalfBlankedLine(
      scene,
      { x: 0.65, y: 0.9 },
      { x: 0.65, y: 0.5 },
      { x: 0.65, y: 0.1 }
    );
  },
  expected() {
    const dark = '#555';
    return {
      lines: [
        { x1: 0.2, y1: 0.5, x2: 0.8, y2: 0.5, color: '#fff' },
        { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8, color: '#fff' },
        { x1: 0.1, y1: 0.35, x2: 0.5, y2: 0.35, color: '#f44' },
        { x1: 0.5, y1: 0.35, x2: 0.9, y2: 0.35, color: dark, dashed: true },
        { x1: 0.9, y1: 0.65, x2: 0.5, y2: 0.65, color: '#f44' },
        { x1: 0.5, y1: 0.65, x2: 0.1, y2: 0.65, color: dark, dashed: true },
        { x1: 0.35, y1: 0.1, x2: 0.35, y2: 0.5, color: '#f44' },
        { x1: 0.35, y1: 0.5, x2: 0.35, y2: 0.9, color: dark, dashed: true },
        { x1: 0.65, y1: 0.9, x2: 0.65, y2: 0.5, color: '#f44' },
        { x1: 0.65, y1: 0.5, x2: 0.65, y2: 0.1, color: dark, dashed: true },
      ],
      notes: [
        { x: 0.28, y: 0.33, text: 'drawn →' },
        { x: 0.72, y: 0.63, text: 'drawn ←' },
        { x: 0.3, y: 0.28, text: 'drawn ↓' },
        { x: 0.7, y: 0.72, text: 'drawn ↑' },
        {
          x: 0.5,
          y: 0.93,
          text: 'red must end exactly on the crosshair; dashes = mirror path with laser off',
        },
      ],
    };
  },
};

const boxCircle: Pattern = {
  id: 'box-circle',
  name: 'Circle in Box',
  description:
    'A circle inscribed in a box, touching the middle of all four sides. ' +
    'Raise PPS until the drawing degrades: box corners round off and the circle pulls away ' +
    'from the sides or goes egg-shaped. The highest clean PPS is your usable speed at this size. ' +
    'Shrink Size and repeat: smaller images need less mirror acceleration, so they should stay ' +
    'clean at higher PPS. Watch maxAccel in the stats to put a number on it.',
  params: [
    { key: 'size', label: 'Size', min: 0.1, max: 0.7, step: 0.05, value: 0.7 },
  ],
  render(scene: Scene, params: ParamValues) {
    const size = params.size;
    const corner = (1 - size) / 2;
    scene.add(
      new Rect({ x: corner, y: corner, width: size, height: size, color: WHITE })
    );
    scene.add(new Circle({ x: 0.5, y: 0.5, radius: size / 2, color: RED }));
  },
  expected(params: ParamValues) {
    const size = params.size;
    const c0 = (1 - size) / 2;
    const c1 = c0 + size;
    return {
      lines: [
        { x1: c0, y1: c0, x2: c1, y2: c0, color: '#fff' },
        { x1: c1, y1: c0, x2: c1, y2: c1, color: '#fff' },
        { x1: c1, y1: c1, x2: c0, y2: c1, color: '#fff' },
        { x1: c0, y1: c1, x2: c0, y2: c0, color: '#fff' },
      ],
      circles: [{ x: 0.5, y: 0.5, radius: size / 2, color: '#f44' }],
      notes: [
        {
          x: 0.5,
          y: Math.min(c1 + 0.06, 0.97),
          text: 'circle must touch all four sides at their midpoints',
        },
      ],
    };
  },
};

const acceleration: Pattern = {
  id: 'acceleration',
  name: 'Max Acceleration',
  description:
    'A zigzag with sharp corners and no dwell: the hardest move the mirrors can make. ' +
    'The white ticks mark where the peaks should reach. Raise PPS (or Teeth) until the peaks ' +
    'round off and stop reaching the ticks - the maxAccel stat at that moment is the real usable ' +
    'acceleration of your mirrors, which is what acceleration-aware point placement needs. ' +
    'Corner Dwell adds hold points at each vertex; find how few points still give sharp corners. ' +
    'Try small Amplitude at high PPS to confirm small moves tolerate far more speed.',
  params: [
    { key: 'teeth', label: 'Teeth', min: 1, max: 30, step: 1, value: 8 },
    {
      key: 'amplitude',
      label: 'Amplitude',
      min: 0.02,
      max: 0.35,
      step: 0.01,
      value: 0.2,
    },
    {
      key: 'cornerDwell',
      label: 'Corner Dwell (points)',
      min: 0,
      max: 20,
      step: 1,
      value: 0,
    },
  ],
  render(scene: Scene, params: ParamValues) {
    const left = 0.1;
    const right = 0.9;
    const yTop = 0.5 - params.amplitude;
    const yBottom = 0.5 + params.amplitude;
    const segments = Math.round(params.teeth) * 2;

    let previous = { x: left, y: yBottom };
    for (let i = 1; i <= segments; i++) {
      const vertex = {
        x: left + ((right - left) * i) / segments,
        y: i % 2 ? yTop : yBottom,
      };
      scene.add(
        new Line({
          from: previous,
          to: vertex,
          color: RED,
          blankBefore: i === 1,
        })
      );
      if (params.cornerDwell && i < segments) {
        scene.add(
          new Wait({
            x: vertex.x,
            y: vertex.y,
            color: RED,
            amount: params.cornerDwell,
          })
        );
      }
      previous = vertex;
    }

    // Reference ticks at both peak levels, outside the zigzag.
    for (const y of [yTop, yBottom]) {
      scene.add(
        new Line({
          from: { x: 0.02, y },
          to: { x: 0.08, y },
          color: WHITE,
          blankBefore: true,
        })
      );
      scene.add(
        new Line({
          from: { x: 0.92, y },
          to: { x: 0.98, y },
          color: WHITE,
          blankBefore: true,
          blankAfter: true,
        })
      );
    }
  },
  expected(params: ParamValues) {
    const left = 0.1;
    const right = 0.9;
    const yTop = 0.5 - params.amplitude;
    const yBottom = 0.5 + params.amplitude;
    const segments = Math.round(params.teeth) * 2;

    const lines: ExpectedLine[] = [
      { x1: 0, y1: yTop, x2: 1, y2: yTop, color: '#555', dashed: true },
      { x1: 0, y1: yBottom, x2: 1, y2: yBottom, color: '#555', dashed: true },
      { x1: 0.02, y1: yTop, x2: 0.08, y2: yTop, color: '#fff' },
      { x1: 0.92, y1: yTop, x2: 0.98, y2: yTop, color: '#fff' },
      { x1: 0.02, y1: yBottom, x2: 0.08, y2: yBottom, color: '#fff' },
      { x1: 0.92, y1: yBottom, x2: 0.98, y2: yBottom, color: '#fff' },
    ];
    let previous = { x: left, y: yBottom };
    for (let i = 1; i <= segments; i++) {
      const vertex = {
        x: left + ((right - left) * i) / segments,
        y: i % 2 ? yTop : yBottom,
      };
      lines.push({
        x1: previous.x,
        y1: previous.y,
        x2: vertex.x,
        y2: vertex.y,
        color: '#f44',
      });
      previous = vertex;
    }
    return {
      lines,
      notes: [
        {
          x: 0.5,
          y: Math.min(yBottom + 0.08, 0.97),
          text: 'peaks must stay sharp and reach the tick lines',
        },
      ],
    };
  },
};

export const patterns: Pattern[] = [latency, boxCircle, acceleration];

export function getPattern(id: string): Pattern | undefined {
  return patterns.find((pattern) => pattern.id === id);
}

export function defaultParamValues(pattern: Pattern): ParamValues {
  const values: ParamValues = {};
  for (const param of pattern.params) {
    values[param.key] = param.value;
  }
  return values;
}
