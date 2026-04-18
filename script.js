const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hpValue = document.getElementById("hpValue");
const coinsValue = document.getElementById("coinsValue");
const scoreValue = document.getElementById("scoreValue");

const shopItemsEl = document.getElementById("shopItems");
const slotEls = [...document.querySelectorAll(".slot")];

const baseStats = {
  fireRate: 0.22,
  bulletSpeed: 520,
  speed: 210,
  armor: 100,
  damage: 20,
};

const partsCatalog = [
  {
    id: "weapon-rapid",
    slot: "weapon",
    name: "Rapid Cannon",
    icon: "🔫",
    price: 40,
    effect: { fireRate: 0.12, damage: 16 },
  },
  {
    id: "weapon-plasma",
    slot: "weapon",
    name: "Plasma Lance",
    icon: "⚡",
    price: 90,
    effect: { fireRate: 0.2, damage: 34, bulletSpeed: 620 },
  },
  {
    id: "engine-afterburn",
    slot: "engine",
    name: "Afterburn Engine",
    icon: "🚀",
    price: 70,
    effect: { speed: 310 },
  },
  {
    id: "engine-eco",
    slot: "engine",
    name: "Eco Turbine",
    icon: "🌀",
    price: 40,
    effect: { speed: 260 },
  },
  {
    id: "armor-plate",
    slot: "armor",
    name: "Titanium Armor",
    icon: "🛡️",
    price: 75,
    effect: { armor: 170 },
  },
  {
    id: "armor-light",
    slot: "armor",
    name: "Light Composite",
    icon: "🧱",
    price: 35,
    effect: { armor: 130, speed: 230 },
  },
];

const state = {
  time: 0,
  score: 0,
  coins: 120,
  cameraX: 0,
  spawnTimer: 0,
  bullets: [],
  enemyBullets: [],
  enemies: [],
  stars: Array.from({ length: 70 }, () => ({
    x: Math.random() * 2400,
    y: Math.random() * canvas.height,
    s: Math.random() * 2 + 0.5,
  })),
  keys: { left: false, right: false, up: false, down: false, shoot: false },
  loadout: {
    weapon: null,
    engine: null,
    armor: null,
  },
  player: {
    x: 160,
    y: canvas.height / 2,
    w: 72,
    h: 38,
    hp: baseStats.armor,
    lastShot: 0,
    invincibleTimer: 0,
  },
};

function mergedStats() {
  const stats = { ...baseStats };
  for (const part of Object.values(state.loadout)) {
    if (!part) continue;
    for (const [k, v] of Object.entries(part.effect)) stats[k] = v;
  }
  return stats;
}

function updateHud() {
  hpValue.textContent = Math.max(0, Math.round(state.player.hp));
  coinsValue.textContent = Math.round(state.coins);
  scoreValue.textContent = Math.round(state.score);
}

function createShop() {
  partsCatalog.forEach((item) => {
    const row = document.createElement("div");
    row.className = "shop-item";
    row.draggable = true;
    row.dataset.part = item.id;
    row.innerHTML = `
      <span class="icon">${item.icon}</span>
      <div>
        <div class="name">${item.name}</div>
        <small>${item.slot.toUpperCase()}</small>
      </div>
      <span class="price">${item.price}c</span>
    `;

    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", item.id);
    });

    row.addEventListener("pointerdown", () => {
      state.pendingTapPart = item.id;
    });

    shopItemsEl.appendChild(row);
  });

  slotEls.forEach((slotEl) => {
    slotEl.addEventListener("dragover", (e) => e.preventDefault());
    slotEl.addEventListener("drop", (e) => {
      e.preventDefault();
      const partId = e.dataTransfer.getData("text/plain");
      tryEquip(partId, slotEl.dataset.slot);
    });

    slotEl.addEventListener("pointerup", () => {
      if (state.pendingTapPart) {
        tryEquip(state.pendingTapPart, slotEl.dataset.slot);
        state.pendingTapPart = null;
      }
    });
  });
}

function tryEquip(partId, slotId) {
  const part = partsCatalog.find((x) => x.id === partId);
  if (!part || part.slot !== slotId) return;
  if (state.coins < part.price) return;

  state.coins -= part.price;
  state.loadout[slotId] = part;
  const stats = mergedStats();
  state.player.hp = Math.min(stats.armor, state.player.hp + stats.armor * 0.15);
  renderSlots();
  updateHud();
}

function renderSlots() {
  slotEls.forEach((slotEl) => {
    const part = state.loadout[slotEl.dataset.slot];
    if (part) {
      slotEl.classList.add("filled");
      slotEl.innerHTML = `${part.icon} <strong>${part.name}</strong>`;
    } else {
      slotEl.classList.remove("filled");
      slotEl.textContent = `${slotEl.dataset.slot[0].toUpperCase()}${slotEl.dataset.slot.slice(1)} Slot`;
    }
  });
}

function spawnEnemy() {
  const y = 50 + Math.random() * (canvas.height - 100);
  const type = Math.random() > 0.5 ? "interceptor" : "heavy";
  state.enemies.push({
    x: state.cameraX + canvas.width + 120,
    y,
    w: 60,
    h: 30,
    hp: type === "heavy" ? 65 : 40,
    speed: type === "heavy" ? 110 : 170,
    shootCooldown: Math.random() * 1.2,
    type,
  });
}

function shootPlayer() {
  const stats = mergedStats();
  state.bullets.push({
    x: state.player.x + state.player.w * 0.7,
    y: state.player.y,
    vx: stats.bulletSpeed,
    vy: 0,
    damage: stats.damage,
  });
}

function shootEnemy(enemy) {
  state.enemyBullets.push({
    x: enemy.x - enemy.w * 0.5,
    y: enemy.y,
    vx: -260,
    vy: (state.player.y - enemy.y) * 0.6,
    damage: enemy.type === "heavy" ? 18 : 10,
  });
}

function overlap(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w &&
    Math.abs(a.y - b.y) * 2 < a.h + b.h
  );
}

function update(dt) {
  state.time += dt;
  const stats = mergedStats();

  state.cameraX += 140 * dt;

  if (state.keys.left) state.player.x -= stats.speed * dt;
  if (state.keys.right) state.player.x += stats.speed * dt;
  if (state.keys.up) state.player.y -= stats.speed * dt;
  if (state.keys.down) state.player.y += stats.speed * dt;

  const minX = state.cameraX + 60;
  const maxX = state.cameraX + canvas.width * 0.55;
  state.player.x = Math.max(minX, Math.min(maxX, state.player.x));
  state.player.y = Math.max(30, Math.min(canvas.height - 30, state.player.y));

  state.player.invincibleTimer = Math.max(0, state.player.invincibleTimer - dt);

  if (state.keys.shoot && state.time - state.player.lastShot > stats.fireRate) {
    shootPlayer();
    state.player.lastShot = state.time;
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = Math.max(0.45, 1.4 - state.score / 1500);
  }

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  state.bullets = state.bullets.filter((b) => b.x < state.cameraX + canvas.width + 40);

  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  state.enemyBullets = state.enemyBullets.filter((b) => b.x > state.cameraX - 50);

  for (const enemy of state.enemies) {
    enemy.x -= enemy.speed * dt;
    enemy.shootCooldown -= dt;
    if (enemy.shootCooldown <= 0) {
      shootEnemy(enemy);
      enemy.shootCooldown = enemy.type === "heavy" ? 1.6 : 1.1;
    }
  }

  state.enemies = state.enemies.filter((e) => e.x > state.cameraX - 120 && e.hp > 0);

  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (overlap({ ...bullet, w: 8, h: 4 }, enemy)) {
        enemy.hp -= bullet.damage;
        bullet.x = Infinity;
        if (enemy.hp <= 0) {
          state.score += enemy.type === "heavy" ? 100 : 55;
          state.coins += enemy.type === "heavy" ? 24 : 14;
        }
      }
    }
  }
  state.bullets = state.bullets.filter((b) => Number.isFinite(b.x));

  if (state.player.invincibleTimer <= 0) {
    for (const bullet of state.enemyBullets) {
      if (overlap({ ...bullet, w: 8, h: 8 }, { ...state.player, w: 62, h: 30 })) {
        state.player.hp -= bullet.damage;
        bullet.x = -Infinity;
        state.player.invincibleTimer = 0.2;
      }
    }

    for (const enemy of state.enemies) {
      if (overlap(enemy, { ...state.player, w: 60, h: 30 })) {
        state.player.hp -= 26;
        enemy.hp = 0;
        state.player.invincibleTimer = 0.5;
      }
    }
  }

  state.enemyBullets = state.enemyBullets.filter((b) => Number.isFinite(b.x));

  const maxHp = stats.armor;
  state.player.hp = Math.min(maxHp, state.player.hp + 2.5 * dt);

  if (state.player.hp <= 0) {
    state.player.hp = maxHp;
    state.score = Math.max(0, state.score - 120);
    state.coins = Math.max(0, state.coins - 45);
    state.enemies.length = 0;
    state.enemyBullets.length = 0;
    state.player.x = state.cameraX + 160;
    state.player.y = canvas.height / 2;
  }

  updateHud();
}

function drawJet(x, y, scale, color, facing = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);
  ctx.beginPath();
  ctx.moveTo(42, 0);
  ctx.lineTo(0, -14);
  ctx.lineTo(-26, -7);
  ctx.lineTo(-36, -2);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-36, 2);
  ctx.lineTo(-26, 7);
  ctx.lineTo(0, 14);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = "#d8f4ff";
  ctx.fillRect(-2, -5, 10, 10);

  ctx.fillStyle = "#294a8a";
  ctx.fillRect(-18, -3, 12, 6);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // distant sky elements
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  for (const star of state.stars) {
    const x = (star.x - state.cameraX * 0.2) % (canvas.width + 200);
    const wrappedX = x < -100 ? x + canvas.width + 200 : x;
    ctx.fillRect(wrappedX, star.y, star.s, star.s);
  }

  // clouds
  for (let i = 0; i < 6; i++) {
    const cloudX = ((i * 260 - state.cameraX * (0.45 + i * 0.04)) % (canvas.width + 260)) - 120;
    const y = 70 + ((i * 53) % 200);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(cloudX, y, 58, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX + 36, y + 7, 48, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // bullets
  ctx.fillStyle = "#ffdb69";
  for (const b of state.bullets) ctx.fillRect(b.x - state.cameraX, b.y - 2, 8, 4);
  ctx.fillStyle = "#ff5f76";
  for (const b of state.enemyBullets) ctx.fillRect(b.x - state.cameraX - 4, b.y - 3, 8, 6);

  for (const enemy of state.enemies) {
    drawJet(enemy.x - state.cameraX, enemy.y, enemy.type === "heavy" ? 1.02 : 0.9, "#ff6a7f", -1);
    const hpPct = Math.max(0, enemy.hp / (enemy.type === "heavy" ? 65 : 40));
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(enemy.x - state.cameraX - 24, enemy.y - 26, 48, 4);
    ctx.fillStyle = "#95ff95";
    ctx.fillRect(enemy.x - state.cameraX - 24, enemy.y - 26, 48 * hpPct, 4);
  }

  if (state.player.invincibleTimer <= 0 || Math.floor(state.time * 20) % 2 === 0) {
    drawJet(state.player.x - state.cameraX, state.player.y, 1, "#53d8fb", 1);
  }
}

let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.032, (now - previous) / 1000);
  previous = now;

  update(dt);
  render();

  requestAnimationFrame(frame);
}

const keyMap = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
  " ": "shoot",
};

window.addEventListener("keydown", (e) => {
  const k = keyMap[e.key];
  if (!k) return;
  e.preventDefault();
  state.keys[k] = true;
});
window.addEventListener("keyup", (e) => {
  const k = keyMap[e.key];
  if (!k) return;
  state.keys[k] = false;
});

[...document.querySelectorAll(".controls button")].forEach((btn) => {
  const action = btn.dataset.action;
  const press = () => (state.keys[action] = true);
  const release = () => (state.keys[action] = false);
  btn.addEventListener("pointerdown", press);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointerleave", release);
  btn.addEventListener("pointercancel", release);
});

window.addEventListener("resize", () => {
  const ratio = 16 / 9;
  const w = Math.min(window.innerWidth * 0.95, 960);
  canvas.width = Math.round(w);
  canvas.height = Math.round(w / ratio);
});

createShop();
renderSlots();
updateHud();
requestAnimationFrame(frame);
