import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clampView,
  disabledFlags,
  dragView,
  initialView,
  panDown,
  panLeft,
  panRight,
  panUp,
  pinchView,
  viewForKey,
  viewportLabel,
  wheelZoom,
  zoomAt,
  zoomIn,
  zoomOut,
} from '../src/components/diagramView.ts';

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

test('a pan arrow moves the view window 20% of the visible size in its direction', () => {
  const view = { zoom: 2, x: -400, y: -200 };
  assert.deepEqual(panRight(view, size), { zoom: 2, x: -560, y: -200 });
  assert.deepEqual(panLeft(view, size), { zoom: 2, x: -240, y: -200 });
  assert.deepEqual(panDown(view, size), { zoom: 2, x: -400, y: -280 });
  assert.deepEqual(panUp(view, size), { zoom: 2, x: -400, y: -120 });
});

test('a pan press stops at the diagram edge', () => {
  assert.deepEqual(panLeft({ zoom: 2, x: -100, y: -200 }, size), { zoom: 2, x: 0, y: -200 });
  assert.deepEqual(panRight({ zoom: 2, x: -700, y: -200 }, size), { zoom: 2, x: -800, y: -200 });
  assert.deepEqual(panUp({ zoom: 2, x: -400, y: -50 }, size), { zoom: 2, x: -400, y: 0 });
  assert.deepEqual(panDown({ zoom: 2, x: -400, y: -380 }, size), { zoom: 2, x: -400, y: -400 });
});

test('panning at 1x changes nothing', () => {
  for (const pan of [panUp, panDown, panLeft, panRight]) assert.deepEqual(pan(initialView, size), initialView);
});

test('repeated pans reach the edge and a pressed arrow ends disabled', () => {
  let view = { zoom: 2, x: 0, y: 0 };
  for (let i = 0; i < 6; i += 1) view = panRight(view, size);
  assert.equal(view.x, -800);
  assert.equal(disabledFlags(view, size).panRight, true);
  assert.equal(disabledFlags(view, size).panLeft, false);
});

test('clampView re-covers the viewport after it shrinks, and keeps a valid view', () => {
  const valid = { zoom: 2, x: -400, y: -200 };
  assert.deepEqual(clampView(valid, size), valid);
  assert.deepEqual(clampView({ zoom: 2, x: -800, y: -400 }, { width: 400, height: 200 }), {
    zoom: 2,
    x: -400,
    y: -200,
  });
});

test('zoomAt keeps the content point under the anchor fixed', () => {
  const view = { zoom: 2, x: -400, y: -200 };
  assert.deepEqual(zoomAt(view, 1.5, { x: 100, y: 50 }, size), { zoom: 3, x: -650, y: -325 });
  assert.deepEqual(zoomAt(initialView, 1.5, { x: 800, y: 400 }, size), { zoom: 1.5, x: -400, y: -200 });
});

test('zoomAt clamps the zoom to 4x and then re-covers the viewport', () => {
  const view = { zoom: 2, x: -400, y: -200 };
  assert.deepEqual(zoomAt(view, 3, { x: 100, y: 50 }, size), { zoom: 4, x: -900, y: -450 });
  assert.deepEqual(zoomAt(view, 1 / 3, { x: 100, y: 50 }, size), initialView);
});

test('zoomAt about the viewport centre matches the zoom buttons', () => {
  const centre = { x: size.width / 2, y: size.height / 2 };
  assert.deepEqual(zoomAt(initialView, 1.5, centre, size), zoomIn(initialView, size));
});

test('wheel up zooms in and wheel down zooms out about the pointer', () => {
  const view = { zoom: 2, x: -400, y: -200 };
  const anchor = { x: 100, y: 50 };
  const up = wheelZoom(view, -20, anchor, size);
  const down = wheelZoom(view, 20, anchor, size);
  assert.ok(up.zoom > 2 && down.zoom < 2);
  assert.ok(Math.abs((anchor.x - up.x) / up.zoom - 250) < 1e-9);
  assert.ok(Math.abs((anchor.y - up.y) / up.zoom - 125) < 1e-9);
  assert.deepEqual(wheelZoom(view, 0, anchor, size), view);
});

test('one wheel event never zooms by more than the capped step', () => {
  const view = { zoom: 2, x: -400, y: -200 };
  const anchor = { x: 100, y: 50 };
  assert.deepEqual(wheelZoom(view, -5000, anchor, size), wheelZoom(view, -50, anchor, size));
  assert.ok(wheelZoom(view, -5000, anchor, size).zoom < 2 * 2);
});

test('drag moves the content with the pointer and stops at the diagram edge', () => {
  const view = { zoom: 2, x: -400, y: -200 };
  assert.deepEqual(dragView(view, 100, -50, size), { zoom: 2, x: -300, y: -250 });
  assert.deepEqual(dragView(view, 500, -500, size), { zoom: 2, x: 0, y: -400 });
});

test('drag at 1x changes nothing', () => {
  assert.deepEqual(dragView(initialView, 120, -80, size), initialView);
});

test('pinch spreading the fingers zooms about their midpoint', () => {
  const start = { zoom: 2, x: -400, y: -200 };
  const from = { centre: { x: 400, y: 200 }, spread: 100 };
  assert.deepEqual(pinchView(start, from, { centre: from.centre, spread: 150 }, size), { zoom: 3, x: -800, y: -400 });
  assert.deepEqual(
    pinchView(initialView, from, { centre: from.centre, spread: 150 }, size),
    { zoom: 1.5, x: -200, y: -100 },
  );
});

test('pinch moving the midpoint pans the content with the fingers', () => {
  const start = { zoom: 2, x: -400, y: -200 };
  const from = { centre: { x: 400, y: 200 }, spread: 100 };
  const to = { centre: { x: 350, y: 200 }, spread: 100 };
  assert.deepEqual(pinchView(start, from, to, size), { zoom: 2, x: -450, y: -200 });
});

test('pinch clamps the zoom to 1x-4x and re-covers the viewport', () => {
  const start = { zoom: 2, x: -400, y: -200 };
  const from = { centre: { x: 400, y: 200 }, spread: 100 };
  assert.equal(pinchView(start, from, { centre: from.centre, spread: 1000 }, size).zoom, 4);
  assert.deepEqual(pinchView(start, from, { centre: from.centre, spread: 10 }, size), initialView);
});

test('a pinch that starts with the fingers together does not change the zoom', () => {
  const start = { zoom: 2, x: -400, y: -200 };
  const from = { centre: { x: 400, y: 200 }, spread: 0 };
  assert.deepEqual(pinchView(start, from, { centre: from.centre, spread: 80 }, size), start);
});

test('arrow keys pan above 1x', () => {
  const view = { zoom: 2, x: -400, y: -200 };
  assert.deepEqual(viewForKey(view, 'ArrowRight', size), panRight(view, size));
  assert.deepEqual(viewForKey(view, 'ArrowLeft', size), panLeft(view, size));
  assert.deepEqual(viewForKey(view, 'ArrowUp', size), panUp(view, size));
  assert.deepEqual(viewForKey(view, 'ArrowDown', size), panDown(view, size));
});

test('arrow keys are left to the page at 1x', () => {
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
    assert.equal(viewForKey(initialView, key, size), null, key);
  }
});

test('an arrow key at the diagram edge is still handled above 1x', () => {
  const edge = { zoom: 2, x: 0, y: -200 };
  assert.deepEqual(viewForKey(edge, 'ArrowLeft', size), edge);
});

test('plus and minus zoom about the centre and zero resets, at any zoom', () => {
  const view = { zoom: 2, x: -400, y: -200 };
  assert.deepEqual(viewForKey(view, '+', size), zoomIn(view, size));
  assert.equal(viewForKey(view, '=', size), null);
  assert.deepEqual(viewForKey(view, '-', size), zoomOut(view, size));
  assert.deepEqual(viewForKey(view, '0', size), initialView);
  assert.deepEqual(viewForKey(initialView, '+', size), zoomIn(initialView, size));
});

test('other keys are not handled', () => {
  for (const key of ['Tab', 'a', 'Enter', ' ', 'PageDown']) assert.equal(viewForKey({ zoom: 2, x: -400, y: -200 }, key, size), null, key);
});

test('the viewport label is the diagram accTitle', () => {
  assert.equal(viewportLabel('How the token travels'), 'How the token travels');
  assert.equal(viewportLabel('  How the token travels in the harness \n'), 'How the token travels in the harness');
});

test('the viewport label falls back when the SVG has no accTitle', () => {
  for (const title of [null, undefined, '', '   ']) assert.equal(viewportLabel(title), 'Diagram view', String(title));
});
