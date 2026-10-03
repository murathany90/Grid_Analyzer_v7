import assert from 'node:assert/strict';
import test from 'node:test';
import { routeEndpointToStationSide } from '../../src/map/geometry';

test('split-bus routing moves only a path endpoint that already reaches the TM', () => {
  const path: [number, number][] = [[101, 100], [200, 140], [300, 200]];
  const moved = routeEndpointToStationSide(path, [100, 100], [92, 100]);
  assert.deepEqual(moved, [[92, 100], [200, 140], [300, 200]]);
  assert.deepEqual(path, [[101, 100], [200, 140], [300, 200]]);
});

test('split-bus routing leaves unrelated or distant line geometry untouched', () => {
  const path: [number, number][] = [[400, 400], [500, 500]];
  assert.deepEqual(routeEndpointToStationSide(path, [100, 100], [92, 100]), path);
});

test('split-bus routing moves the closer end when route direction is reversed', () => {
  const path: [number, number][] = [[300, 200], [200, 140], [101, 100]];
  assert.deepEqual(routeEndpointToStationSide(path, [100, 100], [108, 100]), [[300, 200], [200, 140], [108, 100]]);
});
