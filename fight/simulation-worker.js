importScripts('combat.js');

const core = self.CombatCore;
const STEP_MS = 650;

function simulate(left, right) {
  const fighters = [core.createFighter(left), core.createFighter(right)];
  const deck = [];
  let elapsed = 300, drops = 0, round = 0, turns = [];
  while (fighters[0].hp > 0 && fighters[1].hp > 0) {
    if (drops < 2 && elapsed >= [2000, 10000][drops]) {
      const weapon = core.drawWeapon(deck);
      core.claimWeapon(fighters[core.roll(2) - 1], weapon);
      drops++;
      elapsed += 2400;
      continue;
    }
    if (!turns.length) {
      round++;
      turns = core.roll(2) === 1 ? [0, 1] : [1, 0];
    }
    const acting = turns[0], fighter = fighters[acting];
    if (fighter.weapon && !fighter.specialUsed && !fighter.stunned) {
      core.useSpecial(fighters, acting);
    } else {
      core.attack(fighters, turns.shift(), round);
    }
    elapsed += STEP_MS;
  }
  return fighters[0].hp === 0 && fighters[1].hp === 0 ? null : fighters[0].hp > 0 ? left : right;
}

self.onmessage = event => {
  if (event.data !== 'run') return;
  const wins = Array(core.characters.length).fill(0);
  let draws = 0;
  for (let left = 0; left < core.characters.length; left++) {
    for (let right = left + 1; right < core.characters.length; right++) {
      for (let game = 0; game < 1000; game++) {
        const winner = game % 2 === 0 ? simulate(left, right) : simulate(right, left);
        if (winner === null) draws++;
        else wins[winner]++;
      }
    }
  }
  self.postMessage({wins, draws, total:28000});
};
