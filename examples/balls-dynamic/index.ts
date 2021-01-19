import { DAC } from '@laser-dac/core';
import { getDevices } from '@laser-dac/device-selector';
import { Scene, DynamicScene, Rect } from '@laser-dac/draw';
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

  function updateScene(scene: Scene): Scene {
    const bounds = new Rect({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: [0, 1, 0]
    });
    scene.add(bounds);

    balls.forEach(ball => {
      ball.update(scene.timeStep);
      scene.add(ball.draw());
    });
  }

  const pointsRate = 30000;

  const dynamicScene = new DynamicScene(updateScene, {
    pointsRate,
    resolution: 70
  });

  dac.streamDynamic(dynamicScene);
})();
