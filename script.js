import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import Stats from "https://cdnjs.cloudflare.com/ajax/libs/stats.js/r17/Stats.min.js"

let showStatsCounter = false;
let enableShadows = true;

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);
stats.dom.style.display = "none"; // disable by default

const mount = document.getElementById("game");
const scoreEl = document.getElementById("score");
const errorEl = document.getElementById("error");
const meterFill = document.getElementById("meterFill");
const securityText = document.getElementById("securityText");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const menuOverlay = document.getElementById("menuOverlay");
const hint = document.getElementById("hint");
const toast = document.getElementById("toast");

const gameFog = new THREE.Fog("#101827", 24, 105);
let scene, camera, renderer, clock;
let player, trackGroup, officeGroup;
let running = false,
  gameStarted = false,
  gameOver = false;
let lane = 0,
  jumpY = 0,
  jumpVelocity = 0;
let speed = 17,
  distance = 0,
  errorRate = 0,
  score = 0,
  best = 0;
let spawnTimer = 0,
  pickupTimer = 0,
  toastTimer = 0,
  hitCooldown = 0;
let obstacles = [],
  pickups = [],
  decorations = [],
  trackSegments = [];
const laneX = [-2.15, 0, 2.15];
const TRACK_LENGTH = 150;
const mat = (color, roughness = 0.75, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const materials = {
  floor: mat("#1a2638"),
  lane: mat("#42536b"),
  edge: mat("#67e8f9", 0.4, 0.2),
  player: mat("#67e8f9", 0.38, 0.12),
  playerTop: mat("#dffbff", 0.35),
  red: mat("#fb7185"),
  orange: mat("#fbbf24"),
  purple: mat("#a78bfa"),
  desk: mat("#4b5e76"),
  deskTop: mat("#647a96"),
  screen: mat("#182c44", 0.35),
  white: mat("#e2e8f0"),
  green: mat("#86efac"),
  coffee: mat("#a16207"),
  cup: mat("#f8fafc"),
  black: mat("#111827"),
  plant: mat("#22c55e"),
};
function box(w, h, d, material, x = 0, y = 0, z = 0, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = enableShadows;
  mesh.receiveShadow = enableShadows;
  parent.add(mesh);
  return mesh;
}
function makeLabelTexture(text, bg, fg = "#ffffff") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = fg;
  ctx.font = "900 48px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = text.split(" ");
  let lines = [],
    line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > 440 && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const lineH = 55,
    start = 128 - ((lines.length - 1) * lineH) / 2;
  lines.slice(0, 3).forEach((s, i) => ctx.fillText(s, 256, start + i * lineH));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex });
}
function makeObstacle(type, laneIndex, z) {
  const group = new THREE.Group();
  group.position.set(laneX[laneIndex], 0, z);
  group.userData = { type, lane: laneIndex, hit: false };
  if (type === "BUG") {
    box(1.1, 0.9, 0.9, materials.red, 0, 0.55, 0, group);
    box(0.65, 0.25, 0.1, materials.white, 0, 0.62, 0.51, group);
    box(0.15, 0.15, 0.12, materials.black, -0.2, 0.62, 0.58, group);
    box(0.15, 0.15, 0.12, materials.black, 0.2, 0.62, 0.58, group);
    const tag =  new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.22, 0.05),
      makeLabelTexture("BUG", "#9f1239"),
    );
    tag.position.set(0, 1.2, 0);
    group.add(tag);
  } else if (type === "TICKET") {
    box(1.2, 1.25, 0.25, materials.orange, 0, 0.65, 0, group);
    box(0.9, 0.13, 0.04, materials.white, 0, 0.9, 0.15, group);
    box(0.65, 0.1, 0.04, materials.white, -0.06, 0.62, 0.15, group);
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.4, 0.04),
      makeLabelTexture("REJECTED", "#9a3412"),
    );
    tag.position.set(0, 1.48, 0.15);
    group.add(tag);
  } else if (type === "MEETING") {
    box(1.4, 0.75, 0.8, materials.purple, 0, 0.38, 0, group);
    box(1.25, 0.12, 0.7, materials.deskTop, 0, 0.82, 0, group);
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.4, 0.04),
      makeLabelTexture("MEETING", "#5b21b6"),
    );
    tag.position.set(0, 1.2, 0.42);
    group.add(tag);
  } else {
    box(1.15, 1.3, 0.8, materials.desk, 0, 0.65, 0, group);
    box(1.22, 0.1, 0.84, materials.deskTop, 0, 1.32, 0, group);
    box(0.65, 0.45, 0.08, materials.screen, 0, 1.63, -0.18, group);
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.34, 0.04),
      makeLabelTexture("404 ERROR", "#991b1b"),
    );
    tag.position.set(0, 1.62, 0.25);
    group.add(tag);
  }
  scene.add(group);
  obstacles.push(group);
}
function makeCoffee(laneIndex, z) {
  const group = new THREE.Group();
  group.position.set(laneX[laneIndex], 0, z);
  group.userData = { lane: laneIndex, collected: false };
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.29, 0.55, 16),
    materials.cup,
  );
  cup.position.y = 0.48;
  cup.castShadow = enableShadows;
  group.add(cup);
  const coffeeTop = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 16),
    materials.coffee,
  );
  coffeeTop.rotation.x = -Math.PI / 2;
  coffeeTop.position.y = 0.76;
  group.add(coffeeTop);
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.27, 0.18, 16),
    mat("#a16207"),
  );
  sleeve.position.y = 0.47;
  group.add(sleeve);
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.06, 16),
    materials.black,
  );
  lid.position.y = 0.78;
  group.add(lid);
  const straw = box(0.05, 0.32, 0.05, materials.red, 0.11, 0.94, 0, group);
  straw.rotation.z = -0.18;
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.035, 8, 24),
    materials.orange,
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.y = 0.5;
  group.add(glow);
  scene.add(group);
  pickups.push(group);
}
function addOfficeDecor() {
  // Side desks, monitors, plants, and wall panels repeat along the route.
  for (let i = 0; i < 18; i++) {
    const z = -i * 8 - 2;
    for (const side of [-1, 1]) {
      const x = side * 5.25;
      const desk = box(1.55, 0.18, 1.7, materials.desk, x, 0.82, z);
      box(1.62, 0.12, 1.75, materials.deskTop, x, 0.96, z);
      for (const dx of [-0.58, 0.58])
        for (const dz of [-0.62, 0.62])
          box(0.09, 0.8, 0.09, materials.desk, x + dx, 0.4, z + dz);
      box(0.82, 0.64, 0.12, materials.screen, x, 0.0 + 1.48, z - 0.25);
      box(
        0.7,
        0.42,
        0.035,
        makeLabelTexture(
          i % 3 === 0 ? "OK" : i % 3 === 1 ? "EXCEL" : "QUEUE",
          "#193047",
          "#67e8f9",
        ),
        x,
        1.5,
        z - 0.17,
      );
      const pot = box(0.35, 0.38, 0.35, mat("#92400e"), side * 6.3, 0.2, z + 1);
      const leaves = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.38, 0),
        materials.plant,
      );
      leaves.position.set(side * 6.3, 0.62, z + 1);
      scene.add(leaves);
      decorations.push(leaves);
      const wall = box(
        0.12,
        2.6,
        2.6,
        mat(i % 2 ? "#23344b" : "#293b52"),
        side * 7.6,
        1.3,
        z - 1.5,
      );
    }
  }
}
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#101827");
  scene.fog = gameFog;
  camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 180);
  camera.position.set(0, 5.6, 10.5);
  camera.lookAt(0, 1.1, -5);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = enableShadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  mount.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight("#c9e8ff", "#263044", 2.0));
  const key = new THREE.DirectionalLight("#ffffff", 2.6);
  key.position.set(-4, 10, 5);
  key.castShadow = enableShadows;
  key.shadow.mapSize.set(2048, 2048);

  key.shadow.camera.left = -40;
  key.shadow.camera.top = 40;
  key.shadow.camera.updateProjectionMatrix();

  // helps in seeing the shadow camera boundaries
  // const helper = new THREE.CameraHelper(key.shadow.camera);
  // scene.add(helper);

  scene.add(key);
  const floor = box(17, 0.2, 190, materials.floor, 0, -0.22, -65);
  // Three lanes and glowing lane separators
  box(6.9, 0.06, 190, materials.lane, 0, -0.1, -65);
  for (const x of [-1.08, 1.08]) {
    for (let i = 0; i < 24; i++) {
      const dash = box(
        0.035,
        0.025,
        3.2,
        materials.edge,
        x,
        -0.055,
        -i * 7 + 4,
      );
      dash.userData.dash = true;
    }
  }
  for (const x of [-3.55, 3.55])
    box(0.12, 0.12, 190, materials.edge, x, -0.02, -65);
  // Player cube with small employee details.
  player = new THREE.Group();
  scene.add(player);
  player.position.set(0, 0.58, 2.5);
  const cube = box(0.82, 0.82, 0.82, materials.player, 0, 0, 0, player);
  cube.name = "cube";
  // A readable little employee face, tie, arms, and feet make the run cycle visible.
  box(0.44, 0.12, 0.045, materials.playerTop, 0, 0.13, 0.423, player);
  for (const x of [-0.17, 0.17])
    box(0.09, 0.11, 0.035, materials.black, x, -0.02, 0.43, player);
  box(0.22, 0.045, 0.035, materials.black, 0, -0.2, 0.43, player);
  const tie = box(0.09, 0.22, 0.045, materials.red, 0, -0.02, 0.46, player);
  const leftArm = box(
    0.16,
    0.38,
    0.2,
    materials.player,
    -0.49,
    -0.02,
    0,
    player,
  );
  const rightArm = box(
    0.16,
    0.38,
    0.2,
    materials.player,
    0.49,
    -0.02,
    0,
    player,
  );
  const leftLeg = box(
    0.19,
    0.28,
    0.24,
    materials.desk,
    -0.22,
    -0.53,
    0.02,
    player,
  );
  const rightLeg = box(
    0.19,
    0.28,
    0.24,
    materials.desk,
    0.22,
    -0.53,
    0.02,
    player,
  );
  player.userData.runParts = {
    cube,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    tie,
  };
  // Floor pattern and office environment
  addOfficeDecor();
  clock = new THREE.Clock();
  window.addEventListener("resize", onResize);
  renderer.domElement.addEventListener("pointerdown", onCanvasTap);
  requestAnimationFrame(animate);
}
function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < 600 ? 64 : 58;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
}
function laneMove(dir) {
  if (!running) return;
  lane = Math.max(-1, Math.min(1, lane + dir));
}
function jump() {
  if (!running) return;
  if (jumpY <= 0.02) {
    jumpVelocity = 8.4;
  }
}
function onCanvasTap(e) {
  if (!running) return;
  const x = e.clientX / innerWidth;
  if (innerWidth < 700) {
    if (x < 0.27) laneMove(-1);
    else if (x > 0.73) laneMove(1);
    else jump();
  }
}
function setError(value, reason) {
  errorRate = Math.max(0, Math.min(100, value));
  errorEl.textContent = errorRate + "%";
  meterFill.style.width = errorRate + "%";
  securityText.textContent =
    100 -
    errorRate +
    "% · " +
    (errorRate >= 65 ? "HR IS WATCHING" : "STILL EMPLOYED");
  if (errorRate >= 65) securityText.style.color = "#fb7185";
  else securityText.style.color = "#a9b7cb";
  if (errorRate >= 85) {
    endGame(reason || "Error threshold exceeded. HR has revoked your access.");
  }
}
function showToast() {
  toast.classList.add("show");
  toastTimer = 1.2;
}
function spawnRow() {
  const occupied = new Set();
  const count = Math.random() < 0.5 ? 1 : 2;
  while (occupied.size < count) occupied.add(Math.floor(Math.random() * 3));
  for (const l of occupied) {
    const type = ["BUG"][
      Math.floor(Math.random() * 4)
    ];
    makeObstacle(type, l, -78);
  }
}
function reset() {
  obstacles.forEach((o) => scene.remove(o));
  pickups.forEach((o) => scene.remove(o));
  obstacles = [];
  pickups = [];
  lane = 0;
  jumpY = 0;
  jumpVelocity = 0;
  speed = 17;
  distance = 0;
  errorRate = 0;
  score = 0;
  spawnTimer = 0.7;
  pickupTimer = 2.2;
  hitCooldown = 0;
  gameOver = false;
  running = true;
  gameStarted = true;
  player.position.set(0, 0.58, 2.5);
  player.rotation.set(0, 0, 0);
  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  hint.textContent = "← → SWITCH LANES  ·  SPACE / ↑ / TAP TO JUMP";
  updateHud();
  clock.getDelta();
}
function updateHud() {
  scoreEl.textContent = String(score).padStart(4, "0");
  errorEl.textContent = errorRate + "%";
  meterFill.style.width = errorRate + "%";
  securityText.textContent =
    100 -
    errorRate +
    "% · " +
    (errorRate >= 65 ? "HR IS WATCHING" : "STILL EMPLOYED");
}
function endGame(reason) {
  if (gameOver) return;
  gameOver = true;
  running = false;
  gameOverOverlay.classList.remove("hidden");
  hint.textContent = "";
  document.getElementById("deathReason").textContent = reason;
  document.getElementById("finalScore").textContent = score;
  try {
    best = Math.max(Number(localStorage.getItem("errorExeBest") || 0), score);
    localStorage.setItem("errorExeBest", String(best));
  } catch (e) {
    best = score;
  }
  document.getElementById("bestLine").textContent =
    "Personal best: " + best + " · Please return your ID card.";
}
function update(dt) {
  if (!running) return;
  distance += speed * dt;
  score = Math.floor(distance * 2);
  speed = Math.min(30, 17 + distance * 0.012);
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnRow();
    spawnTimer =
      Math.max(0.78, 1.42 - distance * 0.0008) + Math.random() * 0.28;
  }
  pickupTimer -= dt;
  if (pickupTimer <= 0) {
    makeCoffee(Math.floor(Math.random() * 3) - 1, -82);
    pickupTimer = 3.5 + Math.random() * 2.5;
  }
  hitCooldown = Math.max(0, hitCooldown - dt);
  // Smoothly slide between lanes and arc through jumps.
  const targetX = laneX[lane + 1];
  player.position.x += (targetX - player.position.x) * Math.min(1, dt * 13);
  jumpVelocity -= 22 * dt;
  jumpY += jumpVelocity * dt;
  if (jumpY < 0) {
    jumpY = 0;
    jumpVelocity = 0;
  }
  const runPhase = distance * 1.35;
  const runBob = Math.abs(Math.sin(runPhase * 2)) * 0.075;
  player.position.y = 0.58 + jumpY + runBob;
  player.rotation.z = (targetX - player.position.x) * -0.12;
  player.rotation.x = jumpY > 0.05 ? -0.12 : Math.sin(runPhase) * 0.045;
  const parts = player.userData.runParts;
  if (parts) {
    parts.leftArm.rotation.x = Math.sin(runPhase) * 0.65;
    parts.rightArm.rotation.x = -Math.sin(runPhase) * 0.65;
    parts.leftLeg.rotation.x = -Math.sin(runPhase) * 0.7;
    parts.rightLeg.rotation.x = Math.sin(runPhase) * 0.7;
    parts.cube.rotation.z += Math.sin(runPhase) * dt * 0.12;
  }
  // Move office objects towards the player.
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.position.z += speed * dt;
    if (!o.userData.hit && o.position.z > 1.55 && o.position.z < 3.45) {
      if (Math.abs(player.position.x - o.position.x) < 0.93 && jumpY < 0.72) {
        o.userData.hit = true;
        hitCooldown = 0.45;
        setError(
          errorRate + 22,
          "Critical error: " +
            o.userData.type +
            " collision. Your access has been revoked.",
        );
        if (!running) break;
        o.traverse((n) => {
          if (n.isMesh && n.material && n.material.color) {
            n.material = n.material.clone();
            n.material.color.set("#fb7185");
          }
        });
      }
    }
    if (o.position.z > 9) {
      scene.remove(o);
      obstacles.splice(i, 1);
    }
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.position.z += speed * dt;
    p.rotation.y += dt * 2.5;
    p.position.y = 0.1 + Math.sin(distance * 0.12 + i) * 0.08;
    if (
      !p.userData.collected &&
      Math.abs(p.position.z - 2.5) < 1.1 &&
      Math.abs(player.position.x - p.position.x) < 0.9
    ) {
      p.userData.collected = true;
      setError(errorRate - 12);
      showToast();
      scene.remove(p);
      pickups.splice(i, 1);
      continue;
    }
    if (p.position.z > 9) {
      scene.remove(p);
      pickups.splice(i, 1);
    }
  }
  // Endless office scenery illusion: recycle decorative objects down the corridor.
  for (const obj of decorations) {
    if (obj.position.z > 12) obj.position.z = -125;
  }
  // Shift lane dashes backwards to imply forward movement.
  scene.traverse((obj) => {
    if (obj.userData && obj.userData.dash) {
      obj.position.z += speed * dt;
      if (obj.position.z > 8) obj.position.z -= 168;
    }
  });
  camera.position.x += (player.position.x * 0.16 - camera.position.x) * dt * 2;
  camera.position.y = 5.6 + jumpY * 0.12;
  camera.lookAt(player.position.x * 0.1, 1.0, -5);
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) toast.classList.remove("show");
  }
  updateHud();
}
function animate() {
  stats.begin();

  requestAnimationFrame(animate);
  const dt = Math.min(clock ? clock.getDelta() : 0.016, 0.04);
  if (scene && renderer) {
    update(dt);
    renderer.render(scene, camera);
  }

  stats.end();
}
document.getElementById("startBtn").addEventListener("click", reset);
document.getElementById("restartBtn").addEventListener("click", reset);
document.getElementById("left").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  laneMove(-1);
});
document.getElementById("right").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  laneMove(1);
});
document.getElementById("jump").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  jump();
});
document.getElementById("shareBtn").addEventListener("click", async () => {
  const text = `I scored ${score} in ERROR.EXE — Office Runner. Error rate: ${errorRate}%. Can you survive the shift?`;
  try {
    await navigator.clipboard.writeText(text);
    document.getElementById("shareBtn").textContent =
      "COPIED · SEND IT TO THE GROUP";
  } catch (e) {
    window.prompt("Copy your score:", text);
  }
});
window.addEventListener("keydown", (e) => {
  if (
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      " ",
      "a",
      "A",
      "d",
      "D",
      "w",
      "W",
    ].includes(e.key)
  )
    e.preventDefault();
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") laneMove(-1);
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") laneMove(1);
  if (e.key === "ArrowUp" || e.key === " " || e.key === "w" || e.key === "W")
    jump();
  if ((e.key === "Enter" || e.key === " ") && !gameStarted && !running) reset();
  if (e.key === "Enter" && gameOver) reset();
});
document.getElementById("statsCounterToggle").addEventListener("click", () => {
  showStatsCounter = !showStatsCounter;
  stats.dom.style.display = showStatsCounter ? "block" : "none";
});
document.getElementById("shadowsToggle").addEventListener("click", () => {
  enableShadows = !enableShadows;
});
document.getElementById("fogToggle").addEventListener("change", (e) => {
  scene.fog = e.target.checked
    ? gameFog
    : null;
});

const menuOverlayButtons = document.querySelectorAll("#menuOverlayBtn");

menuOverlayButtons.forEach(
  button => {
    button.addEventListener("click", (e) => {
      console.log(gameOver);
      if(gameOver) {
        gameOverOverlay.classList.add("hidden");
      }
      else{
        startOverlay.classList.add("hidden");
      }
      menuOverlay.classList.remove("hidden");
    });
  }
)

document.getElementById("backToMenuBtn").addEventListener("click", () => {
  if(gameOver) {
    gameOverOverlay.classList.remove("hidden");
  }
  else {
    startOverlay.classList.remove("hidden");
  }
  menuOverlay.classList.add("hidden");
});
init();
