import { Shape } from './Shape';
import { Point, Color } from './Point';
import { SceneOptions } from './Scene';

interface WaitOptions {
  x: number;
  y: number;
  color?: Color;
  amount?: number;
  fractionOfMax?: number;
}

export class Wait extends Shape {
  x: number;
  y: number;
  color?: Color;
  amount?: number;
  fractionOfMax: number;

  constructor(options: WaitOptions) {
    super();
    this.x = options.x;
    this.y = options.y;
    this.amount = options.amount;
    const hasColor = options.color &&
      (options.color[0] || options.color[1] || options.color[2]);
    this.color = hasColor ? options.color : undefined;
    this.fractionOfMax = options.fractionOfMax ?? 1;
  }

  draw(options: SceneOptions): Point[] {
    const amount = this.amount ?? Math.floor(
      this.fractionOfMax *
      (this.color ? options.maxWaitPoints : options.blankingPoints)
    );
    const points: Point[] = [];
    for (let i = 0; i < amount; i++) {
      points.push(new Point(this.x, this.y, this.color));
    }
    return points;
  }
}
