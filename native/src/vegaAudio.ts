// Vega media and packaged-file adapters. Import only from the platform root.
import type { AudioServices } from './audio';
import { createSounds } from './sound';
import { createMusic, loadCatalogue } from './music';

export const vegaAudio: AudioServices = {
  createSounds,
  createMusic,
  loadCatalogue,
};
