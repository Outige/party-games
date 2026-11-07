const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const combat = fs.readFileSync(require('node:path').join(__dirname, '..', 'combat.js'), 'utf8');

function simulate(left, right, seed) {
  let now = 0, nextId = 0;
  const random = Object.create(Math);
  random.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const timers = new Map();
  const elements = new Map();
  class Element {
    constructor() {
      this.children = [];
      this.style = { setProperty() {} };
      this.classList = { add() {}, remove() {} };
      this.attributes = {};
      this.listeners = {};
      this.value = '650';
      this.hidden = false;
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    append(child) { this.children.push(child); }
    prepend(child) { this.children.unshift(child); }
    remove() { this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
    replaceChildren() { this.children = []; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    get firstElementChild() { return this.children[0] || null; }
    get lastElementChild() { const child = this.children.at(-1); if (child) child.parent = this; return child; }
    click() { this.listeners.click?.(); }
    set src(value) { this.attributes.src = value; }
  }
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement() { return new Element(); }
  };
  const context = vm.createContext({
    document,
    performance: { now: () => now },
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
    Math: random,
    console
  });
  vm.runInContext(combat, context);
  vm.runInContext(script + `
    globalThis.dropAt = [];
    const originalDrop = startWeaponDrop;
    startWeaponDrop = () => { globalThis.dropAt.push(performance.now()); originalDrop(); };
    globalThis.testPick = (a, b) => { sides[0].character = a; sides[1].character = b; resetMatch(); };
    globalThis.testState = () => ({ finished, weaponDrops, hp: fighters.map(f => f.hp) });
  `, context);
  context.testPick(left, right);
  document.getElementById('start-button').click();
  while (!context.testState().finished && timers.size && now < 120000) {
    const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
    timers.delete(id); now = timer.at; timer.callback();
  }
  assert(context.testState().finished, 'fight should finish');
  return { seconds: now / 1000, drops: context.testState().weaponDrops, dropAt: context.dropAt.map(t => t / 1000) };
}

const results = [];
for (let i = 0; i < 400; i++) {
  const left = i % 8, right = (i + 1 + Math.floor(i / 8) % 7) % 8;
  results.push(simulate(left, right, i + 1));
}
const times = results.map(r => r.seconds).sort((a, b) => a - b);
const drops = results.filter(r => r.drops === 2).length;
assert.equal(drops, results.length, 'both weapon drops should appear in every sampled match');
assert(results.every(r => r.dropAt[0] >= 2 && r.dropAt[0] < 3 && r.dropAt[1] >= 10 && r.dropAt[1] < 11.5), 'drops should happen close to 2 and 10 seconds');
assert(times[200] >= 16 && times[200] <= 23, 'median match should finish near 20 seconds');
console.log({ matches: results.length, twoDrops: drops, median: times[200], p10: times[40], p90: times[360], min: times[0], max: times.at(-1) });
