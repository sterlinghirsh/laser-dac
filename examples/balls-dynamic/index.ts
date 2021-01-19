import { DAC } from '@laser-dac/core';
import { getDevices } from '@laser-dac/device-selector';
import { Scene, Rect } from '@laser-dac/draw';
import { Ball } from './Ball';

const NUMBER_OF_BALLS = 4;

(async () => {
  const dac = new DAC();
  dac.useAll(await getDevices());
  await dac.start();

  const balls: Ball[] = [];
  for (let i = 0; i < NUMBER_OF_BALLS; i++) {
    balls.push(
      new Ball({
        x: Math.random(),
        y: Math.random(),
        radius: Math.random() / 5 + 0.05
      })
    );
  }

  const scene = new Scene({
    resolution: 70
  });

  let lastTime = Date.now();
  function renderFrame() {
    const bounds = new Rect({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: [0, 1, 0]
    });
    scene.add(bounds);

    const curTime = Date.now();
    const timeStep = (curTime - lastTime) / 1000;
    balls.forEach(ball => {
      ball.update(timeStep);
      scene.add(ball.draw());
    });
    lastTime = curTime;
  }

  /** timeStep and curTime both floats in seconds */
  function updateScene(timeStep: number) {
    const bounds = new Rect({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: [0, 1, 0]
    });
    scene.add(bounds);

    balls.forEach(ball => {
      ball.update(timeStep);
      scene.add(ball.draw());
    });
  }

  const dynamicScene = new Scene({
    resolution: 70
  });

  updateScene(0, 0);
  let curTime = 0;
  let timeStep = 0;
  const maxPoints = 4000;
  const pointsRate = 30000;

  dac.setPointsRate(pointsRate);

  function generateFrames() {
    while (dynamicScene.points.length < maxPoints * 2) {
      updateScene(timeStep);
      dynamicScene.points = dynamicScene.points.concat(scene.points);
      timeStep = scene.points.length / pointsRate;
      scene.reset();
      curTime += timeStep;
    }
  }

  setInterval(generateFrames, 10);

  dac.streamDynamic(dynamicScene);
})();
