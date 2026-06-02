
const DEFAULT_POSITIONS = {
  unlock:   { left: 45, top: 4 },
  ability1: { left: 12, top: 22 },
  skill:    { left: 45, top: 36 },
  ability2: { left: 12, top: 54 },
  capacity: { left: 45, top: 68 },
  ability3: { left: 12, top: 84 }
};

let nodePositions = loadNodePositions();
let markerSize = loadMarkerSize();
let calibrating = false;

function loadNodePositions(){
  try {
    const saved = localStorage.getItem("t12_node_positions_v1");
    if(saved) return { ...DEFAULT_POSITIONS, ...JSON.parse(saved) };
  } catch(e) {}
  return { ...DEFAULT_POSITIONS };
}

function loadMarkerSize(){
  try {
    const saved = localStorage.getItem("t12_marker_size_v1");
    if(saved) return Number(saved) || 86;
  } catch(e) {}
  return 86;
}

function applyMarkerSize(){
  document.querySelectorAll(".node").forEach(btn=>{
    btn.style.width = `${markerSize}px`;
    btn.style.height = `${markerSize}px`;
  });
  const input = document.getElementById("markerSize");
  if(input) input.value = markerSize;
}

function applyNodePositions(){
  document.querySelectorAll(".node").forEach(btn=>{
    const key = btn.dataset.key;
    const pos = nodePositions[key] || DEFAULT_POSITIONS[key];
    btn.style.left = `${pos.left}%`;
    btn.style.top = `${pos.top}%`;
  });
}

function saveNodePositions(){
  localStorage.setItem("t12_node_positions_v1", JSON.stringify(nodePositions));
  localStorage.setItem("t12_marker_size_v1", String(markerSize));
  alert("レイアウトを登録しました。この端末では座標とサイズが固定表示されます。");
}

function resetNodePositions(){
  nodePositions = { ...DEFAULT_POSITIONS };
  markerSize = 86;
  localStorage.removeItem("t12_node_positions_v1");
  localStorage.removeItem("t12_marker_size_v1");
  applyMarkerSize();
  applyNodePositions();
}

function setCalibrationMode(on){
  calibrating = on;
  const tree = document.getElementById("treeBox");
  if(tree) tree.classList.toggle("calibrating", calibrating);
  document.querySelectorAll(".node").forEach(btn=>btn.classList.toggle("calibrating", calibrating));
  const btn = document.getElementById("toggleCalibrate");
  if(btn) btn.textContent = calibrating ? "位置調整モード ON" : "位置調整モード OFF";
}

function setupNodeDragging(){
  let dragging = null;

  document.querySelectorAll(".node").forEach(node=>{
    node.addEventListener("pointerdown", e=>{
      if(!calibrating) return;
      e.preventDefault();
      dragging = node;
      node.setPointerCapture(e.pointerId);
    });

    node.addEventListener("pointermove", e=>{
      if(!calibrating || dragging !== node) return;
      const box = document.getElementById("treeBox").getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const left = ((e.clientX - box.left - nodeRect.width / 2) / box.width) * 100;
      const top = ((e.clientY - box.top - nodeRect.height / 2) / box.height) * 100;
      const key = node.dataset.key;
      nodePositions[key] = {
        left: Math.max(0, Math.min(100, left)),
        top: Math.max(0, Math.min(100, top))
      };
      applyNodePositions();
    });

    node.addEventListener("pointerup", e=>{
      dragging = null;
    });
  });
}

function setupCalibrationButtons(){
  const toggle = document.getElementById("toggleCalibrate");
  const save = document.getElementById("savePositions");
  const reset = document.getElementById("resetPositions");
  const sizeInput = document.getElementById("markerSize");

  if(toggle) toggle.addEventListener("click", ()=>setCalibrationMode(!calibrating));
  if(save) save.addEventListener("click", saveNodePositions);
  if(reset) reset.addEventListener("click", ()=>{
    if(confirm("マーカー位置とサイズを初期状態に戻しますか？")) resetNodePositions();
  });

  if(sizeInput) {
    sizeInput.addEventListener("input", ()=>{
      markerSize = Math.max(40, Math.min(160, Number(sizeInput.value) || 86));
      applyMarkerSize();
      applyNodePositions();
    });
  }
}

const GOALS = {
  unlock: { name: "T12兵解放", steel: 1620000, refined: 440, particle: 3080, meat: 0, wood: 0, coal: 0, iron: 0, time: 0 },
  skill:  { name: "スキルまで解放", steel: 4263000, refined: 898, particle: 6235, meat: 112440000, wood: 112440000, coal: 22560000, iron: 5634000, time: 0 },
  max:    { name: "カンストまで", steel: 17774250, refined: 3895, particle: 67944, meat: 570110000, wood: 570110000, coal: 114600000, iron: 29046000, time: 0 }
};

const MAX_LEVELS = { unlock: 1, ability1: 20, skill: 3, ability2: 50, capacity: 15, ability3: 50 };
const NODE_NAMES = { unlock:"T12解放", ability1:"能力Ⅰ", skill:"スキル", ability2:"能力Ⅱ", capacity:"容量", ability3:"能力Ⅲ" };
const TROOP_NAMES = { shield:"盾", spear:"槍", bow:"弓" };

// Ver1は大枠差分用に、各ノードを全体比率で仮配分。
// 後でスプシ/JSONから正確な行データ読み込みへ差し替え可能。
const NODE_WEIGHTS = {
  unlock: .0912, ability1: .1150, skill: .0894, ability2: .1800, capacity: .2700, ability3: .2544
};

let selectedGoal = "unlock";
let selectedTroop = "shield";
let selectedNode = "unlock";

const state = {
  shield: makeTroopState(),
  spear: makeTroopState(),
  bow: makeTroopState()
};

function makeTroopState(){
  return {
    enabled: true,
    current: { unlock:0, ability1:0, skill:0, ability2:0, capacity:0, ability3:0 },
    target:  { unlock:0, ability1:0, skill:0, ability2:0, capacity:0, ability3:0 }
  };
}

function fmt(n){
  if(!n) return "0";
  if(n >= 100000000) return (n/100000000).toFixed(2).replace(/\.00$/,"") + "億";
  if(n >= 1000000) return (n/1000000).toFixed(2).replace(/\.00$/,"") + "M";
  return Math.round(n).toLocaleString("ja-JP");
}

function materialCard(label, value){
  return `<div class="result-card"><div class="label">${label}</div><div class="value">${fmt(value)}</div></div>`;
}

function calcGoal(base, count){
  const out = {};
  for(const k of ["steel","refined","particle","meat","wood","coal","iron","time"]){
    out[k] = (base[k] || 0) * count;
  }
  return out;
}

function renderQuick(){
  const base = GOALS[selectedGoal];
  const rows = [1,2,3].map(count => {
    const r = calcGoal(base, count);
    return `<div class="panel" style="margin:0">
      <h3 style="margin:0 0 10px">${count}兵種：${base.name}</h3>
      <div class="result-grid">
        ${materialCard("鋼材", r.steel)}
        ${materialCard("精錬火晶", r.refined)}
        ${materialCard("火晶微粒子", r.particle)}
        ${materialCard("生肉", r.meat)}
        ${materialCard("木材", r.wood)}
        ${materialCard("石炭", r.coal)}
        ${materialCard("鉄鉱", r.iron)}
      </div>
    </div>`;
  }).join("");
  document.getElementById("quickResults").innerHTML = rows;
}

function renderLevelTable(){
  document.getElementById("currentTroopTitle").textContent = `${TROOP_NAMES[selectedTroop]}の詳細設定`;
  const t = state[selectedTroop];
  const html = Object.keys(NODE_NAMES).map(key => {
    const max = MAX_LEVELS[key];
    const opts = Array.from({length:max+1}, (_,i)=>`<option value="${i}">Lv${i}${i===0?"（未解放）":""}</option>`).join("");
    return `<div class="level-row">
      <label>${NODE_NAMES[key]}</label>
      <div>
        <div class="subtle">現在</div>
        <select data-type="current" data-key="${key}">${opts}</select>
      </div>
      <div>
        <div class="subtle">目標</div>
        <select data-type="target" data-key="${key}">${opts}</select>
      </div>
    </div>`;
  }).join("");
  document.getElementById("levelTable").innerHTML = html;
  document.querySelectorAll("#levelTable select").forEach(sel=>{
    const key = sel.dataset.key;
    const type = sel.dataset.type;
    sel.value = t[type][key];
    sel.addEventListener("change", e=>{
      t[type][key] = Number(e.target.value);
      renderDetail();
    });
  });
  markNodes();
}

function markNodes(){
  document.querySelectorAll(".node").forEach(btn=>{
    btn.classList.toggle("selected", btn.dataset.key === selectedNode);
    const t = state[selectedTroop];
    btn.classList.toggle("target", (t.target[btn.dataset.key] || 0) > (t.current[btn.dataset.key] || 0));
  });
}

function setGoalButtons(){
  document.querySelectorAll(".goal-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.goal === selectedGoal);
    b.addEventListener("click", ()=>{
      selectedGoal = b.dataset.goal;
      document.querySelectorAll(".goal-btn").forEach(x=>x.classList.toggle("active", x.dataset.goal === selectedGoal));
      renderQuick();
    });
  });
}

function setTroopButtons(){
  document.querySelectorAll(".troop-btn").forEach(b=>{
    b.addEventListener("click", ()=>{
      selectedTroop = b.dataset.troop;
      document.querySelectorAll(".troop-btn").forEach(x=>x.classList.toggle("active", x.dataset.troop === selectedTroop));
      renderLevelTable();
      renderDetail();
    });
  });
}


function presetLevels(kind){
  const presets = {
    zero:   { unlock:0, ability1:0,  skill:0, ability2:0,  capacity:0,  ability3:0 },
    unlock: { unlock:1, ability1:0,  skill:0, ability2:0,  capacity:0,  ability3:0 },
    skill:  { unlock:1, ability1:20, skill:3, ability2:0,  capacity:0,  ability3:0 },
    max:    { unlock:1, ability1:20, skill:3, ability2:50, capacity:15, ability3:50 }
  };
  return {...presets[kind]};
}

function applyCurrentPreset(kind){
  state[selectedTroop].current = presetLevels(kind);
  renderLevelTable();
  renderDetail();
}

function setCurrentPresetButtons(){
  document.querySelectorAll(".current-preset").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      applyCurrentPreset(btn.dataset.current);
      document.querySelectorAll(".current-preset").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function applyGoalToTroop(){
  const t = state[selectedTroop];
  t.target = presetLevels(selectedGoal);
  renderLevelTable();
  renderDetail();
}

function resetTroop(){
  state[selectedTroop].current = { unlock:0, ability1:0, skill:0, ability2:0, capacity:0, ability3:0 };
  state[selectedTroop].target  = { unlock:0, ability1:0, skill:0, ability2:0, capacity:0, ability3:0 };
  renderLevelTable();
  renderDetail();
}

function calcTroopDetail(troopKey){
  const t = state[troopKey];
  const total = { steel:0, refined:0, particle:0, meat:0, wood:0, coal:0, iron:0, time:0 };
  for(const key of Object.keys(NODE_NAMES)){
    const max = MAX_LEVELS[key];
    const cur = t.current[key] || 0;
    const target = t.target[key] || 0;
    const diffRate = Math.max(0, target - cur) / max;
    const weight = NODE_WEIGHTS[key] || 0;
    for(const m of Object.keys(total)){
      total[m] += GOALS.max[m] * weight * diffRate;
    }
  }
  return total;
}

function renderDetail(){
  let total = { steel:0, refined:0, particle:0, meat:0, wood:0, coal:0, iron:0, time:0 };
  for(const troop of Object.keys(state)){
    const r = calcTroopDetail(troop);
    for(const k of Object.keys(total)) total[k] += r[k];
  }
  document.getElementById("detailResults").innerHTML = `
    ${materialCard("鋼材", total.steel)}
    ${materialCard("精錬火晶", total.refined)}
    ${materialCard("火晶微粒子", total.particle)}
    ${materialCard("生肉", total.meat)}
    ${materialCard("木材", total.wood)}
    ${materialCard("石炭", total.coal)}
    ${materialCard("鉄鉱", total.iron)}
  `;
  markNodes();
}

document.addEventListener("DOMContentLoaded", ()=>{
  setGoalButtons();
  setTroopButtons();
  setCurrentPresetButtons();
  applyMarkerSize();
  applyNodePositions();
  setupNodeDragging();
  setupCalibrationButtons();
  document.querySelectorAll(".node").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      selectedNode = btn.dataset.key;
      markNodes();
      const sel = document.querySelector(`select[data-type="target"][data-key="${selectedNode}"]`);
      if(sel) sel.focus();
    });
  });
  document.getElementById("applyGoalToTroop").addEventListener("click", applyGoalToTroop);
  document.getElementById("resetTroop").addEventListener("click", resetTroop);
  renderQuick();
  renderLevelTable();
  applyGoalToTroop();
});
