// Loads the game's data tables in Node and prints a JSON content inventory.
const vm=require('vm'),fs=require('fs');
const ctx={IF:{},console,Math,Object,Array,JSON};vm.createContext(ctx);
for(const f of ['src/data/items.js','src/data/world.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const I=ctx.IF;const pick=(a,k)=>a.map(x=>{const o={};k.forEach(q=>{if(x[q]!==undefined)o[q]=x[q]});return o});
const out={
 weapons:pick(I.WEAPONS,['id','name','type','cls','dmg','rarity','ammo','price']),
 enemies:pick(I.ENEMIES,['id','name','hp','dmg','speed','role']),
 bosses:pick(I.BOSSES,['id','name','hp','biome']),
 biomes:pick(I.BIOMES,['id','name']),
 armourSets:pick(I.ARMOUR_SETS,['id','name']),
 slots:I.ARMOUR_SLOTS,
 skillTrees:I.SKILL_TREES.map(t=>({id:t.id,name:t.name,nodes:(t.nodes||[]).map(n=>({id:n.id,name:n.name,cost:n.cost,max:n.max}))})),
 abilities:Object.entries(I.ABILITIES).map(([k,v])=>({id:k,name:v.name,cd:v.cd})),
 achievements:pick(I.ACHIEVEMENTS,['id','name','desc']),
 modes:Object.entries(I.MODES).map(([k,v])=>({id:k,name:v.name||v})),
 accessories:pick(I.ACCESSORIES,['id','name']),
 rarities:pick(I.RARITIES,['id','name']),
 perks:Object.keys(I.PERKS), affixes:I.AFFIXES.map(a=>a.stat), dailyModifiers:(I.DAILY_MODIFIERS||[]).map(d=>d.id||d.name)
};
fs.writeFileSync(process.argv[2]||'/tmp/inv.json',JSON.stringify(out,null,1));
console.log(Object.entries(out).map(([k,v])=>k+':'+(Array.isArray(v)?v.length:'')).join('  '));
console.log('skill nodes:',out.skillTrees.reduce((s,t)=>s+t.nodes.length,0));
