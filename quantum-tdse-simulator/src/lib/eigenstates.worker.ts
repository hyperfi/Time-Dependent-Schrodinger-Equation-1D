import { TDSESolver } from './tdse-solver';
self.onmessage = event => {
  try {
    const { config, potential } = event.data;
    const solver = new TDSESolver({ gridSize: config.gridSize, xMin: config.xMin, xMax: config.xMax, dt: config.dt, mass: 1, hbar: 1 });
    solver.setPotential(Float64Array.from(potential));
    self.postMessage({ modes: solver.findEigenstates(4) });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
