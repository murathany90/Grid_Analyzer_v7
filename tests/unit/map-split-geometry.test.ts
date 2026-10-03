import assert from 'node:assert/strict';
import test from 'node:test';
import { qEndpointDirections, routeEndpointToStationSide, splitBusMarksVisible } from '../../src/map/geometry';

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

test('split-bus highlights appear only in island modes', () => {
  assert.equal(splitBusMarksVisible('island'), true);
  assert.equal(splitBusMarksVisible('n1-island'), true);
  assert.equal(splitBusMarksVisible('n1-risk'), false);
  assert.equal(splitBusMarksVisible('q'), false);
});

test('Q endpoint arrow directions honor each endpoint sign independently', () => {
  assert.deepEqual(qEndpointDirections(30, -20), { fromForward: true, toForward: true });
  assert.deepEqual(qEndpointDirections(-30, 20), { fromForward: false, toForward: false });
  assert.deepEqual(qEndpointDirections(30, 20), { fromForward: true, toForward: false });
});
