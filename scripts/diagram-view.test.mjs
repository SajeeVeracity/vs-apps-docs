import assert from 'node:assert/strict';
import { test } from 'node:test';
import { disabledFlags, initialView, reset, zoomIn, zoomOut } from '../src/components/diagramView.ts';

const size = { width: 800, height: 400 };
const panKeys = ['panUp', 'panDown', 'panLeft', 'panRight'];

test('the initial view is 1x with no offset', () => {
  assert.deepEqual(initialView, { zoom: 1, x: 0, y: 0 });
});

test('zoom in multiplies by 1.5 about the viewport centre', () => {
  const view = zoomIn(initialView, size);
  assert.equal(view.zoom, 1.5);
  assert.deepEqual([view.x, view.y], [-200, -100]);
});

test('zoom steps compound and stop at 4x', () => {
  let view = initialView;
  const zooms = [];
  for (let i = 0; i < 5; i += 1) {
    view = zoomIn(view, size);
    zooms.push(view.zoom);
  }
  assert.deepEqual(zooms, [1.5, 2.25, 3.375, 4, 4]);
});

test('zoom out divides by 1.5 and stops at 1x with no offset', () => {
  let view = zoomIn(zoomIn(initialView, size), size);
  view = zoomOut(view, size);
  assert.equal(view.zoom, 1.5);
  view = zoomOut(view, size);
  assert.deepEqual(view, initialView);
  assert.deepEqual(zoomOut(view, size), initialView);
});

test('zoom out clamps the offset so the diagram still covers the viewport', () => {
  const out = zoomOut({ zoom: 3, x: -1600, y: -800 }, size);
  assert.equal(out.zoom, 2);
  assert.deepEqual([out.x, out.y], [-800, -400]);
});

test('reset returns to 1x', () => {
  assert.deepEqual(reset(), initialView);
});

test('zoom flags follow the limits', () => {
  const at1 = disabledFlags(initialView, size);
  assert.deepEqual([at1.zoomIn, at1.zoomOut, at1.reset], [false, true, true]);
  const above = disabledFlags(zoomIn(initialView, size), size);
  assert.deepEqual([above.zoomIn, above.zoomOut, above.reset], [false, false, false]);
  let top = initialView;
  for (let i = 0; i < 4; i += 1) top = zoomIn(top, size);
  assert.deepEqual(
    [disabledFlags(top, size).zoomIn, disabledFlags(top, size).zoomOut, disabledFlags(top, size).reset],
    [true, false, false],
  );
});

test('pan flags: all disabled at 1x, each disabled only at its own edge', () => {
  const at1 = disabledFlags(initialView, size);
  for (const key of panKeys) assert.equal(at1[key], true, key);
  const centred = disabledFlags({ zoom: 2, x: -400, y: -200 }, size);
  for (const key of panKeys) assert.equal(centred[key], false, key);
  const topLeft = disabledFlags({ zoom: 2, x: 0, y: 0 }, size);
  assert.deepEqual(
    [topLeft.panUp, topLeft.panLeft, topLeft.panDown, topLeft.panRight],
    [true, true, false, false],
  );
  const bottomRight = disabledFlags({ zoom: 2, x: -800, y: -400 }, size);
  assert.deepEqual(
    [bottomRight.panUp, bottomRight.panLeft, bottomRight.panDown, bottomRight.panRight],
    [false, false, true, true],
  );
});
