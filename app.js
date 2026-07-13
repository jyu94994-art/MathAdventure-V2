const DATA = window.MathAdventureData;
const SAVE_KEY = "math_adventure_v2_save";

const defaultState = {
  player: {
    name: "小冒险家",
    avatarIndex: 0,
    avatars: ["🧙", "🦊", "🐼", "🤖", "🧝"],
    title: "新手探险者",
    level: 1,
    xp: 0,
    coin: 60,
    diamond: 3,
    stamina: 20,
    currentWorld: 1,
    currentLevel: 1,
    combo: 0,
    maxCombo: 0
  },
  boss: { hp: 100, maxHp: 100 },
  inventory: { hint: 1, revive: 1, doubleXp: 0, doubleXpLeft: 0, skin: 0 },
  pet: { name: "小数苗", icon: "🐣", level: 1, xp: 0 },
  stats: {
    answered: 0,
    correct: 0,
    startTime: Date.now(),
    days: 1,
    skill: {
      add: { answered: 0, correct: 0 },
      sub: { answered: 0, correct: 0 },
      mul: { answered: 0, correct: 0 },
      div: { answered: 0, correct: 0 },
      word: { answered: 0, correct: 0 },
      geo: { answered: 0, correct: 0 }
    }
  },
  wrongbook: [],
  achievements: {},
  practice: { type: "mixed", grade: 1, answered: 0, correct: 0 },
  daily: { date: "", signed: false, answeredToday: 0 }
};

let state = loadState();
let currentQuestion = null;
let currentPracticeQuestion = null;
let timerId = null;
let timeLeft = 30;
let wrongPracticeMode = false;
let authToken = localStorage.getItem("math_adventure_token") || "";
let currentUser = null;
let syncTimer = null;
let adventureQuestionBag = [];

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return clone(defaultState);
    return mergeDeep(clone(defaultState), JSON.parse(raw));
  } catch {
    return clone(defaultState);
  }
}

function mergeDeep(base, saved) {
  Object.keys(saved || {}).forEach((key) => {
    if (saved[key] && typeof saved[key] === "object" && !Array.isArray(saved[key])) {
      base[key] = mergeDeep(base[key] || {}, saved[key]);
    } else {
      base[key] = saved[key];
    }
  });
  return base;
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  scheduleCloudSave();
}

async function api(path, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(path, Object.assign({}, options, { headers }));
  const data = await res.json().catch(() => ({ ok: false, error: "服务器响应格式错误" }));
  if (!res.ok || data.ok === false) throw new Error(data.error || "请求失败");
  return data;
}

function scheduleCloudSave() {
  if (!authToken || !currentUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => uploadCloudSave(true), 900);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDaily() {
  if (state.daily.date !== today()) {
    state.daily = { date: today(), signed: false, answeredToday: 0 };
    state.player.stamina = Math.max(state.player.stamina, 20);
    saveState();
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function switchView(id) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === id));
  $$(".nav").forEach(n => n.classList.toggle("active", n.dataset.view === id));
  renderAll();
}

function bindNavigation() {
  $$(".nav").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  $$("[data-jump]").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.jump)));
}

function renderAll() {
  ensureDaily();
  renderHeader();
  renderHome();
  renderMap();
  renderBattleStatus();
  renderPractice();
  renderWrongbook();
  renderPet();
  renderShop();
  renderAchievements();
  renderReport();
  renderAccount();
}

function renderHeader() {
  const p = state.player;
  $("playerName").textContent = p.name;
  $("playerTitle").textContent = p.title;
  $("levelValue").textContent = p.level;
  $("coinValue").textContent = p.coin;
  $("diamondValue").textContent = p.diamond;
  $("staminaValue").textContent = p.stamina;
  $$(".avatar, .player-sprite").forEach(el => el.textContent = p.avatars[p.avatarIndex]);
}

function renderHome() {
  const accuracy = getAccuracy(state.stats);
  $("comboHome").textContent = state.player.combo;
  $("accuracyHome").textContent = `${accuracy}%`;
  $("xpBar").style.width = `${Math.min(100, state.player.xp)}%`;
  $("xpText").textContent = `${state.player.xp} / 100`;
  $("bossPreviewBar").style.width = `${Math.max(0, (state.boss.hp / state.boss.maxHp) * 100)}%`;
  $("bossPreviewText").textContent = `${state.boss.hp}%`;

  const dailyTasks = [
    { text: "完成 5 道题", done: state.daily.answeredToday >= 5 },
    { text: "达成 3 连击", done: state.player.combo >= 3 },
    { text: "查看一次学习报告", done: false }
  ];
  $("dailyTasks").innerHTML = dailyTasks.map(t => `<li>${t.done ? "✅" : "⬜"} ${t.text}</li>`).join("");
}

function renderMap() {
  $("worldGrid").innerHTML = DATA.worlds.map(world => {
    const unlocked = world.id <= state.player.currentWorld;
    const current = world.id === state.player.currentWorld;
    return `
      <article class="world-card ${unlocked ? "" : "locked"}">
        <div class="world-icon">${world.icon}</div>
        <h3>${world.name}</h3>
        <p>${world.grade} · ${world.focus}</p>
        <div class="world-meta">
          <span class="tag">${unlocked ? "已解锁" : "未解锁"}</span>
          <span class="tag">${current ? `当前第 ${state.player.currentLevel} 关` : "10 关挑战"}</span>
          <span class="tag">Boss ${world.boss}</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderBattleStatus() {
  const world = getCurrentWorld();
  $("battleWorld").textContent = `${world.name} · 第 ${state.player.currentLevel} 关`;
  $("bossSprite").textContent = world.boss;
  $("bossHpBar").style.width = `${Math.max(0, (state.boss.hp / state.boss.maxHp) * 100)}%`;
  $("bossHpText").textContent = `${state.boss.hp} / ${state.boss.maxHp}`;
  $("comboValue").textContent = state.player.combo;
  $("answeredValue").textContent = state.stats.answered;
  $("correctValue").textContent = state.stats.correct;
  $("levelStageValue").textContent = `${state.player.currentWorld}-${state.player.currentLevel}`;
  renderSkillWeights();
}

function renderPractice() {
  if (!state.practice) state.practice = { type: "mixed", grade: 1, answered: 0, correct: 0 };
  if (!state.practice.grade) state.practice.grade = 1;
  $("practiceModeTitle").textContent = practiceTypeName(state.practice.type);
  $("practiceCount").textContent = state.practice.answered;
  $("practiceCorrect").textContent = state.practice.correct;
  $("practiceGradeSelect").value = String(state.practice.grade);
  $$(".practice-mode").forEach(btn => btn.classList.toggle("active", btn.dataset.practiceType === state.practice.type));
}

function renderSkillWeights() {
  const weights = calculateSkillWeights();
  $("skillWeights").innerHTML = DATA.skills.map(skill => {
    const value = Math.round(weights[skill.id] * 100);
    return `
      <div class="weight-row">
        <span>${skill.name}</span>
        <div class="bar"><i style="width:${value}%"></i></div>
        <b>${value}</b>
      </div>
    `;
  }).join("");
}

function renderWrongbook() {
  if (!state.wrongbook.length) {
    $("wrongList").innerHTML = `<p>暂无错题。答错题目后会自动记录在这里。</p>`;
    return;
  }
  $("wrongList").innerHTML = state.wrongbook.slice().reverse().map(item => `
    <div class="wrong-item">
      <b>${skillName(item.skill)}：${item.text}</b>
      <p>你的答案：${item.userAnswer}；正确答案：${item.answer}</p>
      <p>解析：${item.explain}</p>
    </div>
  `).join("");
}

function renderPet() {
  const pet = state.pet;
  $("petIcon").textContent = pet.level >= 5 ? "🦄" : pet.level >= 3 ? "🐲" : pet.icon;
  $("petName").textContent = pet.level >= 5 ? "星辰独角兽" : pet.level >= 3 ? "乘法小龙" : pet.name;
  $("petDesc").textContent = `技能：答对题目时额外获得 ${pet.level} 金币和 ${Math.ceil(pet.level / 2)} 经验。`;
  $("petBar").style.width = `${Math.min(100, pet.xp)}%`;
  $("petLevelText").textContent = `Lv.${pet.level}`;
}

function renderShop() {
  $("shopGrid").innerHTML = DATA.shop.map(item => `
    <article class="shop-card">
      <h3>${item.icon} ${item.name}</h3>
      <p>${item.desc}</p>
      <div class="price">
        <b>${item.price} ${item.type === "coin" ? "金币" : "钻石"}</b>
        <button class="primary" data-buy="${item.id}">购买</button>
      </div>
    </article>
  `).join("");
  $$("[data-buy]").forEach(btn => btn.addEventListener("click", () => buyItem(btn.dataset.buy)));
}

function renderAchievements() {
  $("achievementGrid").innerHTML = DATA.achievements.map(a => {
    const done = !!state.achievements[a.id];
    return `
      <article class="achievement-card ${done ? "done" : ""}">
        <h3>${done ? "✅" : "🏅"} ${a.name}</h3>
        <p>${a.desc}</p>
        <div class="reward">奖励：${a.coin} 金币 ${a.diamond ? `+ ${a.diamond} 钻石` : ""}</div>
      </article>
    `;
  }).join("");
}

function renderReport() {
  $("reportAnswered").textContent = state.stats.answered;
  $("reportAccuracy").textContent = `${getAccuracy(state.stats)}%`;
  $("reportDays").textContent = calcLearningDays();
  $("reportTime").textContent = `${Math.max(1, Math.round((Date.now() - state.stats.startTime) / 60000))} 分钟`;
  $("reportSkills").innerHTML = DATA.skills.map(skill => {
    const record = state.stats.skill[skill.id] || { answered: 0, correct: 0 };
    const acc = record.answered ? Math.round(record.correct / record.answered * 100) : 0;
    return `
      <div class="report-row">
        <b>${skill.name}</b>
        <div class="bar"><i style="width:${acc}%"></i></div>
        <span>${record.correct}/${record.answered} · ${acc}%</span>
      </div>
    `;
  }).join("");
}

function renderAccount() {
  const status = $("onlineStatus");
  const info = $("accountInfo");
  if (currentUser) {
    status.textContent = `在线：${currentUser.displayName}`;
    status.classList.add("online");
    info.textContent = `已登录 ${currentUser.displayName}（${currentUser.username}）。存档可同步到服务器数据库。`;
  } else {
    status.textContent = authToken ? "登录状态检查中" : "离线试玩模式";
    status.classList.remove("online");
    info.textContent = "当前未登录，游戏会保存在本机浏览器。启动服务器并登录后可同步云端。";
  }
  updateAuthGate();
}

function updateAuthGate() {
  const gate = $("authGate");
  const app = $("app");
  if (!gate || !app) return;
  const loggedIn = !!currentUser;
  gate.classList.toggle("hidden", loggedIn);
  app.classList.toggle("locked", !loggedIn);
}

function inputValue(primaryId, fallbackId) {
  const primary = $(primaryId);
  const fallback = $(fallbackId);
  return ((primary && primary.value) || (fallback && fallback.value) || "").trim();
}

async function checkLogin() {
  if (!authToken) {
    renderAccount();
    return;
  }
  try {
    const data = await api("/api/me");
    currentUser = data.user;
    if (!currentUser) {
      authToken = "";
      localStorage.removeItem("math_adventure_token");
    }
  } catch {
    currentUser = null;
  }
  renderAccount();
}

async function registerAccount() {
  try {
    const username = inputValue("authRegUsername", "regUsername");
    const displayName = inputValue("authRegDisplayName", "regDisplayName") || username;
    const password = inputValue("authRegPassword", "regPassword");
    await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, displayName, password })
    });
    showToast("注册成功，请登录。");
    if ($("authLoginUsername")) $("authLoginUsername").value = username;
    if ($("loginUsername")) $("loginUsername").value = username;
  } catch (err) {
    showToast(err.message);
  }
}

async function loginAccount() {
  try {
    const username = inputValue("authLoginUsername", "loginUsername");
    const password = inputValue("authLoginPassword", "loginPassword");
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem("math_adventure_token", authToken);
    state.player.name = currentUser.displayName;
    saveState();
    renderAll();
    switchView("home");
    showToast("登录成功，已进入游戏大厅。");
  } catch (err) {
    showToast(err.message);
  }
}

async function logoutAccount() {
  try {
    if (authToken) await api("/api/logout", { method: "POST", body: "{}" });
  } catch {
    // 退出时忽略网络错误
  }
  authToken = "";
  currentUser = null;
  localStorage.removeItem("math_adventure_token");
  renderAll();
  updateAuthGate();
  showToast("已退出登录，请重新登录后进入游戏。");
}

async function uploadCloudSave(silent = false) {
  if (!authToken || !currentUser) {
    if (!silent) showToast("请先登录。");
    return;
  }
  try {
    await api("/api/save", {
      method: "POST",
      body: JSON.stringify({ save: state })
    });
    if (!silent) showToast("存档已上传到服务器。");
  } catch (err) {
    if (!silent) showToast(err.message);
  }
}

async function loadCloudSave() {
  if (!authToken || !currentUser) return showToast("请先登录。");
  try {
    const data = await api("/api/save");
    if (!data.save) return showToast("云端暂无存档。");
    state = mergeDeep(clone(defaultState), data.save);
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    renderAll();
    showToast("已读取云端存档。");
  } catch (err) {
    showToast(err.message);
  }
}

function currentScore() {
  return state.player.level * 1000 +
    state.player.currentWorld * 500 +
    state.player.currentLevel * 100 +
    state.stats.correct * 20 +
    state.player.maxCombo * 30 +
    state.player.coin;
}

async function submitScore(silent = false) {
  if (!authToken || !currentUser) {
    if (!silent) showToast("登录后才能上报成绩。");
    return;
  }
  try {
    await api("/api/score", {
      method: "POST",
      body: JSON.stringify({
        score: currentScore(),
        level: state.player.level,
        world: state.player.currentWorld,
        accuracy: getAccuracy(state.stats),
        answered: state.stats.answered
      })
    });
    if (!silent) showToast("成绩已上报排行榜。");
    refreshLeaderboard();
  } catch (err) {
    if (!silent) showToast(err.message);
  }
}

async function refreshLeaderboard() {
  try {
    const data = await api("/api/leaderboard", { headers: {} });
    const items = data.items || [];
    $("leaderboardBody").innerHTML = items.length ? items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.display_name || item.username}</td>
        <td>${item.score}</td>
        <td>${item.level}</td>
        <td>${item.world}</td>
        <td>${item.accuracy}%</td>
        <td>${item.answered}</td>
      </tr>
    `).join("") : `<tr><td colspan="7">暂无排行榜数据。</td></tr>`;
  } catch (err) {
    $("leaderboardBody").innerHTML = `<tr><td colspan="7">${err.message}</td></tr>`;
  }
}

function getCurrentWorld() {
  return DATA.worlds.find(w => w.id === state.player.currentWorld) || DATA.worlds[0];
}

function skillName(id) {
  return (DATA.skills.find(s => s.id === id) || { name: id }).name;
}

function practiceTypeName(type) {
  const names = {
    mixed: "综合练习",
    word: "应用题",
    judge: "判断题",
    fill: "填空题",
    choice: "选择题",
    calc: "计算题"
  };
  return names[type] || "综合练习";
}

function getAccuracy(stats) {
  return stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0;
}

function calcLearningDays() {
  const diff = Date.now() - state.stats.startTime;
  return Math.max(1, Math.ceil(diff / 86400000));
}

function calculateSkillWeights() {
  const weights = {};
  let total = 0;
  DATA.skills.forEach(skill => {
    const s = state.stats.skill[skill.id];
    const wrongRate = s.answered ? 1 - s.correct / s.answered : 0.35;
    const base = 0.12 + wrongRate * 0.9;
    weights[skill.id] = base;
    total += base;
  });
  DATA.skills.forEach(skill => weights[skill.id] = weights[skill.id] / total);
  return weights;
}

function pickSkill() {
  if (wrongPracticeMode && state.wrongbook.length) {
    return state.wrongbook[Math.floor(Math.random() * state.wrongbook.length)].skill;
  }
  const weights = calculateSkillWeights();
  let r = Math.random();
  for (const skill of DATA.skills) {
    r -= weights[skill.id];
    if (r <= 0) return skill.id;
  }
  return "add";
}

function pickCalculationSkill() {
  const skills = ["add", "sub", "mul", "div", "geo"];
  return skills[rand(0, skills.length - 1)];
}

function nextAdventureQuestionType() {
  if (!adventureQuestionBag.length) {
    adventureQuestionBag = ["calc", "word", "judge", "fill"].sort(() => Math.random() - 0.5);
  }
  return adventureQuestionBag.pop();
}

function buildMathQuestion(skillId = pickSkill(), questionType = "choice", gradeOverride = null) {
  const grade = gradeOverride || state.player.currentWorld;
  const max = 10 + grade * 12;
  const a = rand(2, max);
  const b = rand(2, Math.max(8, Math.floor(max / 2)));
  let text = "";
  let answer = 0;
  let explain = "";
  let skill = skillId;

  if (skill === "add") {
    answer = a + b;
    text = `${a} + ${b} = ?`;
    explain = `把两个数相加：${a} + ${b} = ${answer}。`;
  } else if (skill === "sub") {
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    answer = big - small;
    text = `${big} - ${small} = ?`;
    explain = `用较大的数减去较小的数：${big} - ${small} = ${answer}。`;
  } else if (skill === "mul") {
    const x = rand(2, Math.min(12, 4 + grade * 2));
    const y = rand(2, Math.min(12, 4 + grade * 2));
    answer = x * y;
    text = `${x} × ${y} = ?`;
    explain = `乘法表示 ${x} 个 ${y} 相加，结果是 ${answer}。`;
  } else if (skill === "div") {
    const y = rand(2, Math.min(12, 4 + grade * 2));
    const q = rand(2, Math.min(12, 4 + grade * 2));
    answer = q;
    text = `${y * q} ÷ ${y} = ?`;
    explain = `因为 ${y} × ${q} = ${y * q}，所以答案是 ${q}。`;
  } else if (skill === "geo") {
    const length = rand(3, 8 + grade);
    const width = rand(2, 6 + grade);
    answer = length * width;
    text = `长方形长 ${length} 米，宽 ${width} 米，面积是多少平方米？`;
    explain = `长方形面积 = 长 × 宽 = ${length} × ${width} = ${answer}。`;
  } else {
    const each = rand(3, 10 + grade);
    const count = rand(2, 8 + grade);
    answer = each * count;
    text = `每个宝箱有 ${each} 枚金币，${count} 个宝箱一共有多少枚金币？`;
    explain = `${count} 个宝箱，每个 ${each} 枚，${each} × ${count} = ${answer}。`;
    skill = "word";
  }

  if (questionType === "judge") {
    const displayed = Math.random() > 0.5 ? answer : Math.max(0, answer + (rand(1, 6) * (Math.random() > 0.5 ? 1 : -1)));
    return {
      skill,
      type: "judge",
      text: `判断：${text.replace("?", displayed)} 这个结论是否正确？`,
      answer: displayed === answer ? "正确" : "错误",
      options: ["正确", "错误"],
      explain: displayed === answer ? `判断正确。${explain}` : `判断错误。正确结果应该是 ${answer}。${explain}`
    };
  }

  if (questionType === "fill") {
    return { skill, type: "fill", text: text.replace("?", "____"), answer, options: [], explain };
  }

  const options = makeOptions(answer);
  return { skill, type: "choice", text, answer, options, explain };
}

function buildPracticeQuestion() {
  let type = state.practice.type || "mixed";
  if (type === "mixed") {
    const types = ["choice", "word", "judge", "fill"];
    type = types[rand(0, types.length - 1)];
  }
  const grade = Number(state.practice.grade || 1);
  if (type === "word") return buildMathQuestion("word", "choice", grade);
  if (type === "judge") return buildMathQuestion(pickSkill(), "judge", grade);
  if (type === "fill") return buildMathQuestion(pickSkill(), "fill", grade);
  return buildMathQuestion(pickSkill(), "choice", grade);
}

function generateQuestion(skillId = null) {
  if (skillId) {
    currentQuestion = buildMathQuestion(skillId, "choice");
  } else {
    currentQuestion = buildAdventureQuestion();
  }
  renderQuestion();
  startTimer();
}

function buildAdventureQuestion() {
  const type = nextAdventureQuestionType();
  if (type === "word") return buildMathQuestion("word", "choice");
  if (type === "judge") return buildMathQuestion(pickCalculationSkill(), "judge");
  if (type === "fill") return buildMathQuestion(pickCalculationSkill(), "fill");
  return buildMathQuestion(pickCalculationSkill(), "choice");
}

function generatePracticeQuestion() {
  currentPracticeQuestion = buildPracticeQuestion();
  $("practiceQuestionTitle").textContent = `${state.practice.grade}年级 · ${practiceTypeName(currentPracticeQuestion.type === "choice" && currentPracticeQuestion.skill === "word" ? "word" : currentPracticeQuestion.type)} · ${skillName(currentPracticeQuestion.skill)}`;
  $("practiceQuestionBox").innerHTML = `<p>${currentPracticeQuestion.text}</p>`;
  renderAnswerArea(currentPracticeQuestion, "practiceAnswerGrid", answerPracticeQuestion);
}

function makeOptions(answer) {
  const set = new Set([answer]);
  while (set.size < 4) {
    const delta = rand(-10, 10) || 1;
    const value = Math.max(0, answer + delta);
    set.add(value);
  }
  return Array.from(set).sort(() => Math.random() - 0.5);
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderQuestion() {
  const typeName = currentQuestion.skill === "word" && currentQuestion.type === "choice"
    ? "应用题"
    : currentQuestion.type === "choice"
      ? "计算题"
      : practiceTypeName(currentQuestion.type);
  $("questionTitle").textContent = `${typeName} · ${skillName(currentQuestion.skill)}`;
  $("questionBox").innerHTML = `<p>${currentQuestion.text}</p>`;
  renderAnswerArea(currentQuestion, "answerGrid", answerQuestion);
}

function renderAnswerArea(question, containerId, handler) {
  const container = $(containerId);
  if (question.type === "fill") {
    const inputId = `${containerId}Input`;
    container.innerHTML = `
      <div class="fill-answer">
        <input id="${inputId}" type="number" placeholder="请输入答案">
        <button class="primary" data-fill-submit="${containerId}">提交答案</button>
      </div>
    `;
    const input = $(inputId);
    const submit = container.querySelector("[data-fill-submit]");
    submit.addEventListener("click", () => handler(input.value.trim(), submit));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handler(input.value.trim(), submit);
    });
    input.focus();
    return;
  }
  container.innerHTML = question.options.map(option => (
    `<button data-answer="${option}">${option}</button>`
  )).join("");
  Array.from(container.querySelectorAll("[data-answer]")).forEach(btn => {
    btn.addEventListener("click", () => handler(btn.dataset.answer, btn));
  });
}

function normalizeAnswer(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function startTimer() {
  clearInterval(timerId);
  timeLeft = 30;
  $("timer").textContent = timeLeft;
  timerId = setInterval(() => {
    timeLeft -= 1;
    $("timer").textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerId);
      answerQuestion(null, null);
    }
  }, 1000);
}

function answerQuestion(value, btn) {
  if (!currentQuestion) return;
  clearInterval(timerId);
  const correct = normalizeAnswer(value) === normalizeAnswer(currentQuestion.answer);
  Array.from($("answerGrid").querySelectorAll("[data-answer]")).forEach(b => {
    b.disabled = true;
    if (normalizeAnswer(b.dataset.answer) === normalizeAnswer(currentQuestion.answer)) b.classList.add("correct");
  });
  if (btn && !correct) btn.classList.add("wrong");

  state.stats.answered += 1;
  state.daily.answeredToday += 1;
  const skillStats = state.stats.skill[currentQuestion.skill];
  skillStats.answered += 1;

  if (correct) {
    skillStats.correct += 1;
    state.stats.correct += 1;
    state.player.combo += 1;
    state.player.maxCombo = Math.max(state.player.maxCombo, state.player.combo);
    const damage = 18 + Math.min(18, state.player.combo * 2);
    state.boss.hp = Math.max(0, state.boss.hp - damage);
    gainReward();
    showEffect(`-${damage}`);
    showToast(`答对了！Boss 受到 ${damage} 点伤害。`);
    if (state.boss.hp <= 0) clearLevel();
  } else {
    state.player.combo = 0;
    state.player.stamina = Math.max(0, state.player.stamina - 1);
    addWrong(value === null ? "超时" : value, currentQuestion);
    showEffect("MISS");
    showToast(`答错了，正确答案是 ${currentQuestion.answer}。已加入错题本。`);
  }

  checkAchievements();
  saveState();
  renderAll();
  currentQuestion = null;
}

function answerPracticeQuestion(value, btn) {
  if (!currentPracticeQuestion) return;
  const correct = normalizeAnswer(value) === normalizeAnswer(currentPracticeQuestion.answer);
  Array.from($("practiceAnswerGrid").querySelectorAll("[data-answer]")).forEach(b => {
    b.disabled = true;
    if (normalizeAnswer(b.dataset.answer) === normalizeAnswer(currentPracticeQuestion.answer)) b.classList.add("correct");
  });
  if (btn && !correct) btn.classList.add("wrong");

  state.stats.answered += 1;
  state.daily.answeredToday += 1;
  state.practice.answered += 1;
  const skillStats = state.stats.skill[currentPracticeQuestion.skill] || state.stats.skill.word;
  skillStats.answered += 1;

  if (correct) {
    skillStats.correct += 1;
    state.stats.correct += 1;
    state.practice.correct += 1;
    state.player.combo += 1;
    state.player.maxCombo = Math.max(state.player.maxCombo, state.player.combo);
    gainReward();
    showToast("练习答对了！获得金币和经验。");
  } else {
    state.player.combo = 0;
    addWrong(value === "" ? "未填写" : value, currentPracticeQuestion);
    showToast(`练习答错了，正确答案是 ${currentPracticeQuestion.answer}。已加入错题本。`);
  }

  checkAchievements();
  saveState();
  renderAll();
  currentPracticeQuestion = null;
}

function gainReward() {
  const petBonusCoin = state.pet.level;
  const petBonusXp = Math.ceil(state.pet.level / 2);
  const xpBase = state.inventory.doubleXpLeft > 0 ? 20 : 10;
  if (state.inventory.doubleXpLeft > 0) state.inventory.doubleXpLeft -= 1;
  state.player.coin += 8 + petBonusCoin;
  state.player.xp += xpBase + petBonusXp;
  state.pet.xp += 10;
  if (state.pet.xp >= 100) {
    state.pet.xp -= 100;
    state.pet.level += 1;
    showToast(`宠物升级到 Lv.${state.pet.level}！`);
  }
  while (state.player.xp >= 100) {
    state.player.xp -= 100;
    state.player.level += 1;
    state.player.diamond += 1;
    state.player.stamina += 5;
    showToast(`升级了！当前等级 ${state.player.level}。`);
  }
}

function addWrong(userAnswer, question = currentQuestion) {
  if (!question) return;
  state.wrongbook.push({
    id: Date.now(),
    skill: question.skill,
    text: question.text,
    answer: question.answer,
    userAnswer,
    explain: question.explain
  });
  if (state.wrongbook.length > 50) state.wrongbook.shift();
}

function clearLevel() {
  const world = getCurrentWorld();
  showToast(`击败 ${world.name} Boss！获得通关奖励。`);
  adventureQuestionBag = [];
  state.player.coin += 50;
  state.player.diamond += 1;
  state.boss.hp = state.boss.maxHp;
  if (state.player.currentLevel < 10) {
    state.player.currentLevel += 1;
  } else if (state.player.currentWorld < DATA.worlds.length) {
    state.player.currentWorld += 1;
    state.player.currentLevel = 1;
  } else {
    state.player.title = "数学大师";
  }
  submitScore(true);
}

function showEffect(text) {
  const effect = $("battleEffect");
  effect.textContent = text;
  effect.classList.remove("show");
  void effect.offsetWidth;
  effect.classList.add("show");
}

function useHint() {
  if (!currentQuestion) return showToast("请先生成题目。");
  if (state.inventory.hint <= 0) return showToast("提示卡不足，可以去商城购买。");
  state.inventory.hint -= 1;
  revealHint(currentQuestion, "answerGrid");
  saveState();
  renderAll();
}

function revealHint(question, containerId) {
  if (question.type === "fill") {
    showToast(`提示：答案是 ${String(question.answer).length} 位数。`);
    return;
  }
  let removed = 0;
  Array.from($(containerId).querySelectorAll("[data-answer]")).forEach(btn => {
    if (removed < 2 && normalizeAnswer(btn.dataset.answer) !== normalizeAnswer(question.answer)) {
      btn.disabled = true;
      btn.style.opacity = ".35";
      removed += 1;
    }
  });
  showToast("已排除两个错误答案。");
}

function usePracticeHint() {
  if (!currentPracticeQuestion) return showToast("请先生成练习题。");
  revealHint(currentPracticeQuestion, "practiceAnswerGrid");
}

function setPracticeType(type) {
  state.practice.type = type;
  currentPracticeQuestion = null;
  $("practiceQuestionTitle").textContent = "准备练习";
  $("practiceQuestionBox").innerHTML = `<p>已切换到${practiceTypeName(type)}，点击“生成练习题”。</p>`;
  $("practiceAnswerGrid").innerHTML = "";
  saveState();
  renderAll();
}

function setPracticeGrade(grade) {
  state.practice.grade = Number(grade) || 1;
  currentPracticeQuestion = null;
  $("practiceQuestionTitle").textContent = "准备练习";
  $("practiceQuestionBox").innerHTML = `<p>已切换到${state.practice.grade}年级，点击“生成练习题”。</p>`;
  $("practiceAnswerGrid").innerHTML = "";
  saveState();
  renderAll();
}

function useRevive() {
  if (state.inventory.revive <= 0) return showToast("复活卡不足，可以去商城购买。");
  state.inventory.revive -= 1;
  state.player.stamina += 5;
  state.boss.hp = Math.min(state.boss.maxHp, state.boss.hp + 30);
  saveState();
  renderAll();
  showToast("复活成功：体力 +5，Boss 生命恢复部分用于继续挑战。");
}

function buyItem(id) {
  const item = DATA.shop.find(i => i.id === id);
  if (!item) return;
  const wallet = item.type === "coin" ? "coin" : "diamond";
  if (state.player[wallet] < item.price) return showToast(`${item.type === "coin" ? "金币" : "钻石"}不足。`);
  state.player[wallet] -= item.price;
  if (id === "skin") {
    state.inventory.skin = 1;
    state.player.title = "星光冒险家";
  } else if (id === "doubleXp") {
    state.inventory.doubleXp += 1;
    state.inventory.doubleXpLeft += 5;
  } else {
    state.inventory[id] += 1;
  }
  saveState();
  renderAll();
  showToast(`购买成功：${item.name}`);
}

function feedPet() {
  if (state.player.coin < 30) return showToast("金币不足，答题可获得金币。");
  state.player.coin -= 30;
  state.pet.xp += 35;
  if (state.pet.xp >= 100) {
    state.pet.xp -= 100;
    state.pet.level += 1;
    showToast(`宠物升级到 Lv.${state.pet.level}！`);
  } else {
    showToast("宠物开心地吃下了能量果。");
  }
  checkAchievements();
  saveState();
  renderAll();
}

function practiceWrong() {
  if (!state.wrongbook.length) return showToast("暂无错题可复练。");
  wrongPracticeMode = true;
  switchView("battle");
  generateQuestion(state.wrongbook[Math.floor(Math.random() * state.wrongbook.length)].skill);
  unlockAchievement("wrongClear");
  showToast("已进入错题专项训练。");
}

function clearWrongbook() {
  if (!confirm("确定清空错题本吗？")) return;
  state.wrongbook = [];
  saveState();
  renderAll();
  showToast("错题本已清空。");
}

function checkAchievements() {
  if (state.stats.answered >= 1) unlockAchievement("firstAnswer");
  if (state.player.maxCombo >= 5) unlockAchievement("combo5");
  if (state.stats.answered >= 20) unlockAchievement("answer20");
  if (state.player.currentWorld > 1 || state.player.currentLevel > 1) unlockAchievement("boss1");
  if (state.pet.level >= 3) unlockAchievement("petLv3");
}

function unlockAchievement(id) {
  if (state.achievements[id]) return;
  const a = DATA.achievements.find(item => item.id === id);
  if (!a) return;
  state.achievements[id] = true;
  state.player.coin += a.coin;
  state.player.diamond += a.diamond;
  showToast(`解锁成就：${a.name}`);
}

function exportSave() {
  $("saveText").value = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  showToast("存档已导出。");
}

function importSave() {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob($("saveText").value.trim()))));
    state = mergeDeep(clone(defaultState), parsed);
    saveState();
    renderAll();
    showToast("存档导入成功。");
  } catch {
    showToast("导入失败：存档内容无效。");
  }
}

function resetGame() {
  if (!confirm("确定重置全部游戏进度吗？")) return;
  state = clone(defaultState);
  saveState();
  renderAll();
  switchView("home");
  showToast("游戏已重置。");
}

function changeAvatar() {
  state.player.avatarIndex = (state.player.avatarIndex + 1) % state.player.avatars.length;
  saveState();
  renderAll();
}

function bindActions() {
  $("newQuestionBtn").addEventListener("click", () => {
    if (state.player.stamina <= 0) return showToast("体力不足，请稍后恢复或使用复活卡。");
    generateQuestion();
  });
  $("hintBtn").addEventListener("click", useHint);
  $("reviveBtn").addEventListener("click", useRevive);
  $("newPracticeBtn").addEventListener("click", generatePracticeQuestion);
  $("practiceHintBtn").addEventListener("click", usePracticeHint);
  $("practiceGradeSelect").addEventListener("change", (event) => setPracticeGrade(event.target.value));
  $$(".practice-mode").forEach(btn => btn.addEventListener("click", () => setPracticeType(btn.dataset.practiceType)));
  $("feedPetBtn").addEventListener("click", feedPet);
  $("practiceWrongBtn").addEventListener("click", practiceWrong);
  $("clearWrongBtn").addEventListener("click", clearWrongbook);
  $("exportBtn").addEventListener("click", exportSave);
  $("importBtn").addEventListener("click", importSave);
  $("resetBtn").addEventListener("click", resetGame);
  $("avatarBtn").addEventListener("click", changeAvatar);
  $("registerBtn").addEventListener("click", registerAccount);
  $("loginBtn").addEventListener("click", loginAccount);
  $("authRegisterBtn").addEventListener("click", registerAccount);
  $("authLoginBtn").addEventListener("click", loginAccount);
  $("authLoginPassword").addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginAccount();
  });
  $("authRegPassword").addEventListener("keydown", (event) => {
    if (event.key === "Enter") registerAccount();
  });
  $("logoutBtn").addEventListener("click", logoutAccount);
  $("syncSaveBtn").addEventListener("click", () => uploadCloudSave(false));
  $("loadCloudBtn").addEventListener("click", loadCloudSave);
  $("submitScoreBtn").addEventListener("click", () => submitScore(false));
  $("refreshRankBtn").addEventListener("click", refreshLeaderboard);
}

function init() {
  ensureDaily();
  bindNavigation();
  bindActions();
  updateAuthGate();
  renderAll();
  checkLogin();
  refreshLeaderboard();
  saveState();
}

init();
