import { DAC } from '@laser-dac/core';
import { getDevices } from '@laser-dac/device-selector';
import { Scene } from '@laser-dac/draw';
import {
  defaultParamValues,
  getPattern,
  ParamValues,
  Pattern,
  patterns,
} from './patterns';

export interface Settings {
  pps: number;
  resolution: number;
  blankingPoints: number;
  maxWaitPoints: number;
  colorShift: number;
  monochrome: boolean;
}

export class Renderer {
  settings: Settings = {
    pps: 20000,
    resolution: 70,
    blankingPoints: 24,
    maxWaitPoints: 10,
    colorShift: 0,
    monochrome: false,
  };

  patternId: string = patterns[0].id;
  // Remember each pattern's params so switching back and forth keeps them.
  patternParams: Record<string, ParamValues> = {};

  dac: DAC;
  scene: Scene;

  constructor() {
    for (const pattern of patterns) {
      this.patternParams[pattern.id] = defaultParamValues(pattern);
    }

    this.dac = new DAC();
    this.scene = new Scene({
      resolution: this.settings.resolution,
      blankingPoints: this.settings.blankingPoints,
      maxWaitPoints: this.settings.maxWaitPoints,
    });

    this.start();
  }

  private get pattern(): Pattern {
    return getPattern(this.patternId) ?? patterns[0];
  }

  getStats() {
    return this.dac.getStats();
  }

  updateSettings(data: Partial<Settings>) {
    Object.assign(this.settings, data);

    this.dac.setPointsRate(this.settings.pps);
    this.dac.setColorShift(this.settings.colorShift);
    this.dac.setColorMode(this.settings.monochrome ? 'monochrome' : 'rgb');
    this.scene.setOptions({
      resolution: this.settings.resolution,
      blankingPoints: this.settings.blankingPoints,
      maxWaitPoints: this.settings.maxWaitPoints,
    });
  }

  selectPattern(patternId: string) {
    if (getPattern(patternId)) {
      this.patternId = patternId;
    }
  }

  updatePatternParams(patternId: string, values: ParamValues) {
    const pattern = getPattern(patternId);
    if (!pattern) {
      return;
    }
    for (const param of pattern.params) {
      const value = values[param.key];
      if (typeof value === 'number' && !Number.isNaN(value)) {
        this.patternParams[patternId][param.key] = Math.min(
          param.max,
          Math.max(param.min, value)
        );
      }
    }
  }

  // Everything the client needs to render its controls and expected view.
  getState() {
    return {
      patterns: patterns.map((pattern) => ({
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        params: pattern.params,
      })),
      patternId: this.patternId,
      patternParams: this.patternParams,
      settings: this.settings,
      expected: this.pattern.expected(this.patternParams[this.patternId]),
    };
  }

  private renderFrame = () => {
    this.pattern.render(this.scene, this.patternParams[this.patternId]);
  };

  async start() {
    this.dac.useAll(await getDevices());
    this.updateSettings({});
    await this.dac.start();

    this.scene.start(this.renderFrame, 60);
    this.dac.stream(this.scene, this.settings.pps);
  }
}
