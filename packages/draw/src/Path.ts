import { Shape } from './Shape';
import { Point, Color } from './Point';
import { SceneOptions } from './Scene';
import { Line } from './Line';
import { Wait } from './Wait';
import { CubicCurve } from './CubicCurve';
import { SVGPathData } from 'svg-pathdata';
import { QuadCurve } from './QuadCurve';
import { flatten } from './helpers';
import arcToBezier = require('svg-arc-to-cubic-bezier');
import { CommandM, CommandL, CommandH, CommandV,
  CommandQ, CommandC, CommandA,
  SVGCommand } from 'svg-pathdata/lib/types';

interface PathOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: Color;
  path: string;
  waitAmount?: number;
  blankingAmount?: number;
}

export class Path extends Shape {
  x: number;
  y: number;
  width: number;
  height: number;
  color: Color;
  // Example: "M0.67 0 L0.33 0.88 L1 0.88 Z" draws a triangle
  // Works exactly like SVG path. Learn everything about it: https://css-tricks.com/svg-path-syntax-illustrated-guide/
  path: string;

  waitAmount: number | undefined;
  blankingAmount: number | undefined;

  private lastMoveCommand: CommandM | undefined;
  private prevX: number = 0;
  private prevY: number = 0;

  constructor(options: PathOptions) {
    super();
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = options.width || 1;
    this.height = options.height || 1;
    this.color = options.color;
    this.path = options.path;

    this.waitAmount = options.waitAmount;
    this.blankingAmount = options.blankingAmount;
  }

  transformSize = (command: SVGCommand) => {
    // TODO: yes this is a bit messy.
    if ('x' in command) {
      command.x = this.x + command.x / this.width;
    }
    if ('x1' in command) {
      command.x1 = this.x + command.x1 / this.width;
    }
    if ('x2' in command) {
      command.x2 = this.x + command.x2 / this.width;
    }
    if ('y' in command) {
      command.y = this.y + command.y / this.height;
    }
    if ('y1' in command) {
      command.y1 = this.y + command.y1 / this.height;
    }
    if ('y2' in command) {
      command.y2 = this.y + command.y2 / this.height;
    }
    if ('rX' in command) {
      command.rX = this.x + command.rX / this.width;
    }
    if ('rY' in command) {
      command.rY = this.y + command.rY / this.height;
    }
    return command;
  };

  getPathShapes(): Shape[] {
    const pathData = this.getSVGPathData();
    if (!pathData.commands.length) {
      return [];
    }

    return pathData.commands.flatMap(command => this.getShapesForCommand(command));
  }

  getSVGPathData(): SVGPathData {
    return new SVGPathData(this.path)
      // Transforms relative commands to absolute so we don't have to implement relative commands at all!
      .toAbs()
      // Transforms S and T commands to C and Q so we don't have to implement S and T commands!
      .normalizeST()
      .transform(this.transformSize);
  }

  // TODO: Pass blankingAmount into wait.draw().
  moveTo(command: CommandM): Wait {
    this.lastMoveCommand = command;
    this.prevX = command.x;
    this.prevY = command.y;

    return new Wait({
      x: command.x,
      y: command.y,
      amount: this.blankingAmount
    });
  }

  lineTo(command: CommandM | CommandL, blankAfter: boolean | undefined = undefined): Line {
    const prevX = this.prevX;
    const prevY = this.prevY;
    const toX = 'x' in command ? command.x : prevX;
    const toY = 'y' in command ? command.y : prevY;

    this.prevX = toX;
    this.prevY = toY;

    const x = new Line({
      from: { x: prevX, y: prevY },
      to: { x: toX, y: toY },
      color: this.color,
      blankAfter: blankAfter,
      waitAmount: this.waitAmount,
      blankingAmount: this.blankingAmount
    });
    return x;
  }

  horizTo(command: CommandH): Line {
    const lineCommand: CommandL = {
      ...command,
      y: this.prevY,
      type: SVGPathData.LINE_TO
    };
    return this.lineTo(lineCommand);
  }

  vertTo(command: CommandV): Line {
    const lineCommand: CommandL = {
      ...command,
      x: this.prevX,
      type: SVGPathData.LINE_TO
    };
    return this.lineTo(lineCommand);
  }

  curveTo(command: CommandC): CubicCurve {
    const prevX = this.prevX;
    const prevY = this.prevY;

    this.prevX = command.x;
    this.prevY = command.y;

    return new CubicCurve({
      from: {
        x: prevX,
        y: prevY,
        control: { x: command.x1, y: command.y1 }
      },
      to: {
        x: command.x,
        y: command.y,
        control: { x: command.x2, y: command.y2 }
      },
      color: this.color
    });
  }

  quadTo(command: CommandQ): QuadCurve {
    const prevX = this.prevX;
    const prevY = this.prevY;

    this.prevX = command.x;
    this.prevY = command.y;

    return new QuadCurve({
      from: { x: prevX, y: prevY },
      to: { x: command.x, y: command.y },
      control: { x: command.x1, y: command.y1 },
      color: this.color
    });
  }

  arcTo(command: CommandA): CubicCurve[] {
    const prevX = this.prevX;
    const prevY = this.prevY;

    this.prevX = command.x;
    this.prevY = command.y;

    // TODO: Of course it would be better to implement this properly instead of converting arcs to a cubic bezier.
    const curves = arcToBezier({
      px: prevX,
      py: prevY,
      cx: command.x,
      cy: command.y,
      rx: command.rX,
      ry: command.rY,
      xAxisRotation: command.xRot,
      largeArcFlag: command.lArcFlag,
      sweepFlag: command.sweepFlag
    });

    let curvePrevX = prevX;
    let curvePrevY = prevY;

    return curves.map(curve => {
      const cubic = new CubicCurve({
        from: {
          x: curvePrevX,
          y: curvePrevY,
          control: { x: curve.x1, y: curve.y1 }
        },
        to: {
          x: curve.x,
          y: curve.y,
          control: { x: curve.x2, y: curve.y2 }
        },
        color: this.color
      });

      curvePrevX = curve.x;
      curvePrevY = curve.y;

      return cubic;
    });
  }

  closePath(): Line {
    if (!this.lastMoveCommand) {
      throw new Error(
        'Path parsing error: close path command called without a prior move command.'
      );
    }
    return this.lineTo(this.lastMoveCommand, true);
  }

  getShapesForCommand(command: SVGCommand): Shape[] {
    switch (command.type) {
      case SVGPathData.MOVE_TO:
        return [this.moveTo(command)];
      case SVGPathData.HORIZ_LINE_TO:
        return [this.horizTo(command)];
      case SVGPathData.VERT_LINE_TO:
        return [this.vertTo(command)];
      case SVGPathData.LINE_TO:
        return [this.lineTo(command)];
      case SVGPathData.CURVE_TO:
        return [this.curveTo(command)];
      case SVGPathData.QUAD_TO:
        return [this.quadTo(command)];
      case SVGPathData.ARC:
        return this.arcTo(command);
      case SVGPathData.CLOSE_PATH:
        return [this.closePath()];
      default:
        console.warn(
          `Path parsing warning: command ${command.type} is not supported`
        );
        return [];
    }
  }

  /**
   * Get the relative angle at p2 when a line goes from
   * p1 -> p2 -> p3
   * 0 is a straight line
   * .5 is 90 degrees
   * 1 is 180 degrees
   * This returns the absolute value, so it should only return from 0 to 1.
   */
  getRelativeAngle(p1: Point, p2: Point, p3: Point): number {
    // Get previous angle in radians.
    const previousAngle = Math.atan2(
      p1.y - p2.y,
      p1.x - p2.x
    );

    // Get next angle in radians.
    const nextAngle = Math.atan2(
      p2.y - p3.y,
      p2.x - p3.x
    );

    // Get difference in angle where 90 degrees is 0.5, and 180 is 1.
    return Math.abs(
      Math.atan2(
        Math.sin(previousAngle - nextAngle),
        Math.cos(previousAngle - nextAngle)
      )
    ) / Math.PI;
  }

  draw(options: SceneOptions): Point[] {
    const reducer = (accumulator: Point[], shape: Shape) => {
      const commandPoints = shape.draw(options);
      let waitPoints: Point[] = [];
      if (accumulator.length >= 2 && commandPoints.length) {
        const nextPoint: Point = commandPoints[0];
        const lastPoint: Point = accumulator[accumulator.length - 1];
        const secondLastPoint: Point = accumulator[accumulator.length - 2];

        // I'm not positive this is the right factor to use for
        // the wait time, but it works well enough most of the time.
        const relativeAngle = this.getRelativeAngle(secondLastPoint, lastPoint, nextPoint);

        const waitShape = new Wait({
          x: lastPoint.x,
          y: lastPoint.y,
          color: [lastPoint.r, lastPoint.g, lastPoint.b],
          fractionOfMax: relativeAngle
        });
        waitPoints = waitShape.draw(options);
      }

      return accumulator.concat(waitPoints, commandPoints);
    };
    return this.getPathShapes().reduce(reducer, []);
    // It would be nice if we could flatMap but I'm not sure that will
    // be enough info to calculate wait times yet.
    //return this.getPathShapes().flatMap(shape => shape.draw(options));
  }

  drawOld(options: SceneOptions): Point[] {
    const pathData = this.getSVGPathData();
    if (!pathData.commands.length) {
      return [];
    }

    // The path can end by going to back to the first drawn line
    let lastMoveCommand: CommandM | undefined;
    // Keep track of where the last line was drawn so relative positions work
    let prevX = 0;
    let prevY = 0;

    // Any shapes should be constructed with undefined blankingAmount
    // if this.blankingAmount is undefined. This will cause drawing to
    // use the value from SceneOptions at render time. The same goes
    // for waitAmount.
    const blankingAmount = this.blankingAmount ?? options.blankingPoints;
    const waitAmount = this.waitAmount ?? options.maxWaitPoints;

    const points = pathData.commands.reduce(
      (accumulator: Point[], command: SVGCommand) => {
        let commandPoints: Point[] = [];

        switch (command.type) {
          case SVGPathData.MOVE_TO:
            commandPoints = new Wait({
              x: command.x,
              y: command.y,
              amount: blankingAmount
            }).draw(options);

            lastMoveCommand = command;
            prevX = command.x;
            prevY = command.y;
            break;

          case SVGPathData.HORIZ_LINE_TO:
          case SVGPathData.VERT_LINE_TO:
          case SVGPathData.LINE_TO:
            const toX = 'x' in command ? command.x : prevX;
            const toY = 'y' in command ? command.y : prevY;
            commandPoints = new Line({
              from: { x: prevX, y: prevY },
              to: { x: toX, y: toY },
              color: this.color,
              waitAmount: this.waitAmount,
              blankingAmount: this.blankingAmount
            }).draw(options);
            prevX = toX;
            prevY = toY;
            break;

          case SVGPathData.CURVE_TO:
            commandPoints = new CubicCurve({
              from: {
                x: prevX,
                y: prevY,
                control: { x: command.x1, y: command.y1 }
              },
              to: {
                x: command.x,
                y: command.y,
                control: { x: command.x2, y: command.y2 }
              },
              color: this.color
            }).draw(options);
            prevX = command.x;
            prevY = command.y;
            break;

          case SVGPathData.QUAD_TO:
            commandPoints = new QuadCurve({
              from: { x: prevX, y: prevY },
              to: { x: command.x, y: command.y },
              control: { x: command.x1, y: command.y1 },
              color: this.color
            }).draw(options);
            prevX = command.x;
            prevY = command.y;
            break;

          case SVGPathData.ARC:
            // TODO: Of course it would be better to implement this properly instead of converting arcs to a cubic bezier.
            const curves = arcToBezier({
              px: prevX,
              py: prevY,
              cx: command.x,
              cy: command.y,
              rx: command.rX,
              ry: command.rY,
              xAxisRotation: command.xRot,
              largeArcFlag: command.lArcFlag,
              sweepFlag: command.sweepFlag
            });
            let curvePrevX = prevX;
            let curvePrevY = prevY;
            curves.forEach(curve => {
              const curvePoints = new CubicCurve({
                from: {
                  x: curvePrevX,
                  y: curvePrevY,
                  control: { x: curve.x1, y: curve.y1 }
                },
                to: {
                  x: curve.x,
                  y: curve.y,
                  control: { x: curve.x2, y: curve.y2 }
                },
                color: this.color
              }).draw(options);
              curvePrevX = curve.x;
              curvePrevY = curve.y;
              Array.prototype.push.apply(commandPoints, curvePoints);
            });
            prevX = command.x;
            prevY = command.y;
            break;

          case SVGPathData.CLOSE_PATH:
            if (!lastMoveCommand) {
              throw new Error(
                'Path parsing error: close path command called without a prior move command.'
              );
            }
            commandPoints = new Line({
              from: { x: prevX, y: prevY },
              to: { x: lastMoveCommand.x, y: lastMoveCommand.y },
              color: this.color,
              blankAfter: true,
              waitAmount: this.waitAmount,
              blankingAmount: this.blankingAmount
            }).draw(options);
            prevX = lastMoveCommand.x;
            prevY = lastMoveCommand.y;
            break;

          default:
            console.warn(
              `Path parsing warning: command ${command.type} is not supported`
            );
        }

        let wait: Point[] = [];
        if (accumulator.length >= 2 && commandPoints.length) {
          const nextPoint: Point = commandPoints[0];
          const lastPoint: Point = accumulator[accumulator.length - 1];
          const secondLastPoint: Point = accumulator[accumulator.length - 2];

          // Get previous angle in radians.
          const previousAngle = Math.atan2(
            secondLastPoint.y - lastPoint.y,
            secondLastPoint.x - lastPoint.x
          );

          // Get next angle in radians.
          const nextAngle = Math.atan2(
            lastPoint.y - nextPoint.y,
            lastPoint.x - nextPoint.x
          );

          // Get difference in angle where 90 degrees is 0.5, and 180 is 1.
          const relativeAngle =
            Math.abs(
              Math.atan2(
                Math.sin(previousAngle - nextAngle),
                Math.cos(previousAngle - nextAngle)
              )
            ) / Math.PI;

          const waitShape = new Wait({
            x: lastPoint.x,
            y: lastPoint.y,
            color: [lastPoint.r, lastPoint.g, lastPoint.b],
            amount: Math.floor(waitAmount * relativeAngle)
          });
          wait = waitShape.draw(options);
        }

        return [...accumulator, ...wait, ...commandPoints];
      },
      []
    );

    return flatten(points) as Point[];
  }
}
