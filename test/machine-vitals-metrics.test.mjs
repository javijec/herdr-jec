import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMetrics } from '../mods/jec-sidebar/views/metrics.js';

test('parseMetrics accepts numeric values emitted as strings by Windows PowerShell', () => {
  assert.deepEqual(parseMetrics('{"cpu":"23.5","memUsed":"1073741824","memTotal":"4294967296"}'), {
    cpu: 23.5,
    memUsed: 1073741824,
    memTotal: 4294967296,
  });
});
