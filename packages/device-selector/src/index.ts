import { ColorMode, Device } from '@laser-dac/core';

import { Simulator } from '@laser-dac/simulator';

// Device drivers are loaded lazily: most need native bindings (ffi-napi)
// that don't build on every Node version, and a missing driver shouldn't
// prevent simulator-only use.
const apis: Record<string, () => { new (): Device }> = {
  helios: () => require('@laser-dac/helios').Helios,
  laserdock: () => require('@laser-dac/laserdock').Laserdock,
  beyond: () => require('@laser-dac/beyond').Beyond,
  easylase: () => require('@laser-dac/easylase').Easylase,
  'ether-dream': () => require('@laser-dac/ether-dream').EtherDream, // This one is a bit slower to check.
};

function createDevice(api: string): Device | null {
  try {
    return new (apis[api]())();
  } catch (e) {
    console.error(`Could not load the ${api} driver: ${(e as Error).message}`);
    return null;
  }
}

// Get the first DAC that works.
export async function autoSelect(): Promise<Device | null> {
  console.log('Searching for DAC in ' + Object.keys(apis).join(', '));
  for (const api in apis) {
    const dac = createDevice(api);
    if (dac && (await dac.start())) {
      console.log('Auto Selected DAC ' + api);
      await dac.stop();
      return dac;
    }
  }
  console.log('No DAC found');
  return null;
}

// Get a Simulator and the first autodetected device.
// TODO: Get multiple devices instead of just the first?
export async function getDevices(): Promise<Device[]> {
  const devices: Device[] = [new Simulator()];
  const requestedDevice = process.env.DEVICE;

  if (requestedDevice) {
    if (requestedDevice in apis) {
      const device = createDevice(requestedDevice);
      if (device) {
        devices.push(device);
      }
    } else {
      const autoSelected = await autoSelect();
      if (autoSelected) {
        devices.push(autoSelected);
      }
    }
  }

  // COLOR_MODE=monochrome makes every device (including the simulator, so the
  // preview matches) render as a single-color projector would.
  const colorMode = process.env.COLOR_MODE;
  if (colorMode) {
    if (colorMode === 'rgb' || colorMode === 'monochrome') {
      devices.forEach((device) => device.setColorMode(colorMode as ColorMode));
    } else {
      console.error(`Unknown COLOR_MODE "${colorMode}", expected rgb or monochrome`);
    }
  }

  return devices;
}
