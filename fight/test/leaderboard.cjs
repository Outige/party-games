const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'combat.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'simulation-worker.js'), 'utf8');
let result;
const scope = { postMessage(message) { result = message; } };
const context = vm.createContext({ self:scope, Math, importScripts(file) { assert.equal(file, 'combat.js'); vm.runInContext(core, context); } });
vm.runInContext(worker, context);
const started = performance.now();
scope.onmessage({ data:'run' });
const elapsed = Math.round(performance.now() - started);
assert.equal(result.total, 28000);
assert.equal(result.wins.length, 8);
assert.equal(result.wins.reduce((sum,n)=>sum+n,0)+result.draws,28000);
console.log({matches:result.total,draws:result.draws,elapsedMs:elapsed,wins:result.wins});
