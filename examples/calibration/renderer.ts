import { DAC } from '@laser-dac/core';
import { getDevices } from '@laser-dac/device-selector';
import { Scene, Rect, loadIldaFile, Ilda } from '@laser-dac/draw';
import * as path from 'path';

interface IClient {
  x: number;
  y: number;
  id: string;
}

export class Renderer {
  pps = 25000;
  resolution = 70;

  dac: DAC;
  scene: Scene;

  constructor() {
    this.dac = new DAC();

    this.scene = new Scene({
      resolution: 70
    });

    this.start();
  }

  getStats() {
    return this.dac.getStats();
  }

  updateParams(data: any) {
    this.pps = data.pps;
    this.dac.setPointsRate(this.pps);
    this.resolution = data.resolution;
  }

  getParams() {
    return {
      pps: this.pps,
      resolution: this.resolution,
    }
  }

  removeClient(id: string) {
    const index = this.activeClients.findIndex(client => client.id === id);
    if (index >= 0) {
      this.activeClients.splice(index, 1);
    }
  }

  renderTestPattern() {
    const bounds = new Rect({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: [1, 1, 1]
    });
    this.scene.add(bounds);
  }

  async start() {
    this.dac.useAll(await getDevices());
    await this.dac.start();

    this.scene.start(this.renderTestPattern.bind(this), 60);
    this.dac.stream(this.scene, this.pps);
  }
}
