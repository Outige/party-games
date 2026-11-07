(function (scope) {
  'use strict';
  const characters = [
    {name:'Blaze', image:'fire1.png', class:'Fire', color:'#ff795c', stats:[8,4,4,94]},
    {name:'Ember', image:'fire2.png', class:'Fire', color:'#ff956a', stats:[7,5,5,98]},
    {name:'Gale', image:'air1.png', class:'Air', color:'#a5e5ef', stats:[7,4,7,90]},
    {name:'Zephyr', image:'air2.png', class:'Air', color:'#9cc9ff', stats:[6,5,8,92]},
    {name:'Tide', image:'water1.png', class:'Water', color:'#75caff', stats:[6,7,5,108]},
    {name:'Bubbles', image:'water2.png', class:'Water', color:'#88e5ec', stats:[7,5,6,100]},
    {name:'Boulder', image:'earth1.png', class:'Earth', color:'#c9ad83', stats:[7,8,3,115]},
    {name:'Moss', image:'earth2.png', class:'Earth', color:'#b8d883', stats:[5,8,7,112]}
  ];
  const weapons = [
    {name:'Hot Rod',icon:'🏏',bonus:[2,0,0,0],special:'Meteor swing',type:'damage',value:15,description:'A heavy extra hit.'},
    {name:'Iron Wall',icon:'🛡️',bonus:[0,2,2,0],special:'Fortify',type:'shield',value:16,description:'A shield absorbs upcoming damage.'},
    {name:'Heart Wand',icon:'🪄',bonus:[0,0,0,12],special:'Second wind',type:'heal',value:20,description:'Restore health once.'},
    {name:'Lucky Dice',icon:'🎲',bonus:[1,0,1,0],special:'Loaded roll',type:'crit',value:0,description:'Next hit is guaranteed and critical.'},
    {name:'Storm Fan',icon:'🪭',bonus:[1,0,2,0],special:'Gust lock',type:'stun',value:0,description:'Opponent misses their next turn.'},
    {name:'Glass Spear',icon:'🔱',bonus:[3,0,0,0],special:'Piercing strike',type:'pierce',value:0,description:'Next attack ignores defence and block.'},
    {name:'Root Hammer',icon:'🔨',bonus:[1,2,0,0],special:'Ground slam',type:'damage',value:12,description:'Deal unavoidable damage.'},
    {name:'Moon Mirror',icon:'🪞',bonus:[0,1,2,0],special:'Reflect',type:'reflect',value:0,description:'Reflect the next hit back.'}
  ];
  const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
  const roll = (sides,rng=Math.random) => Math.floor(rng()*sides)+1;
  function createFighter(index) {
    const character=characters[index], stats=[...character.stats];
    return {character,weapon:null,stats,hp:stats[3],shield:0,specialUsed:true,crit:false,pierce:false,stunned:false,reflect:false};
  }
  function classEdge(attacker,defender) {
    const beats={Fire:'Air',Air:'Water',Water:'Fire'};
    return beats[attacker]===defender?1:beats[defender]===attacker?-1:0;
  }
  function applyDamage(target,amount) {
    const absorbed=Math.min(target.shield,amount);
    target.shield-=absorbed;
    const dealt=Math.min(target.hp,amount-absorbed);
    target.hp-=dealt;
    return {dealt,absorbed};
  }
  function drawWeapon(deck,rng=Math.random) {
    if(!deck.length) deck.push(...weapons.map((_,i)=>i));
    return weapons[deck.splice(roll(deck.length,rng)-1,1)[0]];
  }
  function claimWeapon(fighter,weapon) {
    const oldBonus=fighter.weapon?fighter.weapon.bonus:[0,0,0,0];
    fighter.weapon=weapon;
    fighter.stats=fighter.character.stats.map((n,i)=>n+weapon.bonus[i]);
    fighter.hp=clamp(fighter.hp+weapon.bonus[3]-oldBonus[3],0,fighter.stats[3]);
    fighter.specialUsed=false;
  }
  function useSpecial(fighters,i) {
    const user=fighters[i], enemy=fighters[1-i], weapon=user.weapon;
    user.specialUsed=true;
    let result='';
    if(weapon.type==='damage') {
      const damage=applyDamage(enemy,weapon.value);
      result=`${damage.dealt} damage${damage.absorbed?' ('+damage.absorbed+' shielded)':''}`;
    }
    if(weapon.type==='shield') { user.shield+=weapon.value; result=`${weapon.value} shield gained`; }
    if(weapon.type==='heal') { const healed=Math.min(weapon.value,user.stats[3]-user.hp); user.hp+=healed; result=`${healed} HP restored`; }
    if(weapon.type==='crit') { user.crit=true; result='next hit is guaranteed and critical'; }
    if(weapon.type==='stun') { enemy.stunned=true; result=`${enemy.character.name} loses their next turn`; }
    if(weapon.type==='pierce') { user.pierce=true; result='next attack pierces defence and block'; }
    if(weapon.type==='reflect') { user.reflect=true; result='next hit will be reflected'; }
    return {weapon,result};
  }
  function attack(fighters,i,round,rng=Math.random) {
    const a=fighters[i],d=fighters[1-i];
    if(a.stunned) { a.stunned=false; return {type:'stunned'}; }
    const die=roll(20,rng),edge=classEdge(a.character.class,d.character.class);
    const hitTarget=clamp(Math.round(9+d.stats[1]*.6-a.stats[0]*.7-edge*3),3,18);
    if(!(a.crit||die===20||die>=hitTarget)) return {type:'miss',die,hitTarget};
    const blockDie=roll(20,rng),blockTarget=clamp(17-d.stats[2],4,18);
    const blocked=!a.pierce&&blockDie>=blockTarget;
    const damageDie=roll(6,rng),critical=a.crit||die===20;
    let damage=Math.max(4,Math.round(9+a.stats[0]*1.4+damageDie*1.5-d.stats[1]*.45+edge*4));
    if(critical) damage+=9;
    if(a.pierce) damage+=Math.ceil(d.stats[1]*.45);
    if(blocked) damage=Math.max(1,Math.ceil(damage*.35));
    if(round<=6) damage=Math.min(damage,12);
    a.crit=false; a.pierce=false;
    const result=applyDamage(d,damage);
    let reflected=null;
    if(d.reflect&&result.dealt>0) { d.reflect=false; reflected=applyDamage(a,Math.max(1,Math.ceil(result.dealt*.6))); }
    return {type:'hit',die,hitTarget,blockDie,blockTarget,blocked,damageDie,critical,edge,result,reflected};
  }
  scope.CombatCore={characters,weapons,roll,createFighter,classEdge,applyDamage,drawWeapon,claimWeapon,useSpecial,attack};
})(typeof self !== 'undefined' ? self : globalThis);
