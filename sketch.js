let creatures = [];
let feedbackEffects = []; 
let maxCreatures = 80;    
let mouseKillRadius = 80; 
let spawnInterval = 25;

// --- 心流与连击系统变量 ---
let comboCount = 0;
let lastKillTime = 0;
let comboTimeout = 1800; // 1.8秒，符合果冻质感的流畅节奏
let screenShake = 0;
let scaleNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

// --- 长线生态收集与里程碑系统变量 ---
let ecoStats = {
  highestHarmony: 0,      // 历史最高共鸣
  totalHarmonyPoints: 0,  // 累计总和谐度（得分）
  purifiedCount: 0,       // 本局抚慰数
  totalKills: 0,          // 历史总消除数
  speciesEmpathy: { Pinky: 0, Minty: 0, Sky: 0, Honey: 0, Spoiler: 0 }
};

let milestones = [100, 200, 500, 1000, 2000, 5000];
// --- 新增：游戏流程状态 (建议插入在此处) ---
let gameStarted = false; // 是否已点击开始
let isGameOver = false;  // 是否已结束
let startTime = 0;       // 记录游戏开始时间
let gameDuration = 60000; // 60秒（单位毫秒）
let startButton;         // 按钮变量

function setup() {
createCanvas(windowWidth, windowHeight);
  textFont('Helvetica');
  
  // 简化 audio 启动逻辑
  userStartAudio(); 
  
  // 修改这里：仅在触摸且处于有效区域时才阻止默认行为
  document.addEventListener('touchmove', function(e) { 
    if (e.touches.length > 1) e.preventDefault(); // 只在多指操作时锁定，方便单指互动
  }, { passive: false });

  loadLocalEcoData();

  for (let i = 0; i < 15; i++) {
    creatures.push(new Creature(random(width), random(height)));
  }

  // --- 新增：创建开始按钮 ---
  startButton = createButton('点击开始');
  startButton.position(width / 2 - 75, height / 2 + 15);
  startButton.size(150, 50);
  startButton.style('background-color', '#5EAAE3'); // Tagi青蓝
  startButton.style('color', '#FFFFFF');
  startButton.style('font-size', '18px');
  startButton.style('border', 'none');
  startButton.style('border-radius', '10px');
  startButton.style('cursor', 'pointer');
  startButton.style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)');
  startButton.mousePressed(startGame); // 绑定点击事件，触发 startGame()
  startButton.touchEnded(startGame); // 增加这一行，专门兼容移动端
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

// --- 核心状态机：draw 主循环 ---

function draw() {
  background(248, 249, 246);

  if (!gameStarted && !isGameOver) {
    drawStartScreen();
    // 按钮的显示/隐藏交给 setup 中的 startButton 对象管理
  } else if (gameStarted && !isGameOver) {
    startButton.hide(); 
    runGameLoop();
  } else if (isGameOver) {
    startButton.hide(); 
    drawGameOverScreen();
  }
}

function resetGame() {
  isGameOver = false;
  gameStarted = true;
  startTime = millis();
  creatures = []; // 清空现有生物
  ecoStats.purifiedCount = 0; // 如果你想每局重置数据
  ecoStats.totalHarmonyPoints = 0; 
  for (let i = 0; i < 15; i++) creatures.push(new Creature(random(width), random(height)));
}

// --- 游戏进行中逻辑 ---
function runGameLoop() {
  // 1. 计时逻辑
  let elapsed = millis() - startTime;
  let timeLeft = max(0, Math.ceil((gameDuration - elapsed) / 1000));
  
  if (elapsed >= gameDuration) {
    isGameOver = true;
    gameStarted = false;
  }

  // --- 原有的核心游戏逻辑 ---
  if (comboCount > 0 && millis() - lastKillTime > comboTimeout) {
    triggerComboBreak();
  }

  push();
  if (screenShake > 0) {
    let dx = random(-screenShake, screenShake);
    let dy = random(-screenShake, screenShake);
    translate(dx, dy);
    screenShake *= 0.85; 
    if (screenShake < 0.5) screenShake = 0;
  }

  if (creatures.length > maxCreatures * 0.8) {
    fill(244, 91, 105, map(creatures.length, maxCreatures * 0.8, maxCreatures, 10, 35));
    rect(0, 0, width, height);
  }
  drawGrid();

  let tx = (touches.length > 0) ? touches[0].x : mouseX;
  let ty = (touches.length > 0) ? touches[0].y : mouseY;
  let isTouching = (touches.length > 0 || mouseIsPressed);

  // 如果点击在 UI 区域（高度 90）内，则不应触发清除生物
if (isTouching && ty < 90) {
  isTouching = false; 
}

  if (creatures.length < 12) {
    if (frameCount % 20 === 0) creatures.push(new Creature(random(width), random(height)));
  } else if (frameCount % Math.floor(spawnInterval) === 0 && creatures.length < maxCreatures) {
    creatures.push(new Creature(random(width), random(height)));
    if (frameCount % 400 === 0 && spawnInterval > 8) spawnInterval -= 2; 
  }

  if (isTouching) {
    push();
    fill(94, 170, 227, 12);
    stroke(94, 170, 227, 60); 
    strokeWeight(1.5);
    circle(tx, ty, mouseKillRadius * 2); 
    pop();
  }

  for (let i = creatures.length - 1; i >= 0; i--) {
    let c = creatures[i];
    c.reactToInput(tx, ty, isTouching);
    c.checkCollision(creatures); 
    c.update();
    c.display(tx, ty); 
    if (c.isDead()) creatures.splice(i, 1);
  }
  
  for (let i = feedbackEffects.length - 1; i >= 0; i--) {
    let fx = feedbackEffects[i];
    fx.update();
    fx.display();
    if (fx.isDone()) feedbackEffects.splice(i, 1);
  }
  pop(); 
  
  drawUI(timeLeft); // 传入倒计时给 UI 显示
}
// --- 5. 辅助函数块 ---


function startGame() {
  // 强制音频上下文运行
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
  
  gameStarted = true;
  startTime = millis(); // 记录开始时间
  startButton.hide();   // 隐藏按钮
}

function resetGame() {
  isGameOver = false;
  gameStarted = true;
  startTime = millis();
  creatures = [];
  ecoStats.purifiedCount = 0;
  ecoStats.totalHarmonyPoints = 0;
  comboCount = 0;
  for (let i = 0; i < 15; i++) creatures.push(new Creature(random(width), random(height)));
}

function touchStarted() {
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
  // 仅在游戏结束界面点击时处理重置
  if (isGameOver) {
    if (dist(mouseX, mouseY, width/2, height/2 + 80) < 100) {
      resetGame();
    }
  }
  // 注意：不要在这里 return false，否则会导致 DOM 按钮无法触发
  return true; 
}

// --- 旋律化音效引擎 ---
function playMelodySound() {
  let osc = new p5.Oscillator();
  let env = new p5.Envelope();
  
  let noteIndex = comboCount % scaleNotes.length;
  let baseFreq = scaleNotes[noteIndex];
  let finalFreq = baseFreq + (comboCount > 5 ? random(-5, 5) : 0);
  let releaseTime = map(constrain(comboCount, 0, 15), 0, 15, 0.1, 0.3);
  env.setADSR(0.002, 0.05, 0.1, releaseTime); 
  
  osc.freq(finalFreq);
  osc.setType(comboCount > 8 ? 'triangle' : 'sine');
  
  osc.amp(env);
  osc.start();
  env.play();
  
  setTimeout(() => osc.stop(), 400);
}

// --- 完美双击净化寄生怪的水滴音效 ---
function playPurifySound() {
  let osc = new p5.Oscillator('sine');
  let env = new p5.Envelope();
  env.setADSR(0.002, 0.04, 0.3, 0.15);
  osc.freq(523.25); 
  osc.amp(env);
  osc.start();
  env.play();
  osc.freq(783.99, 0.1); 
  setTimeout(() => osc.stop(), 250);
}

// --- 连击中断与被寄生怪吞噬的失落音效 ---
// --- 连击中断后的柔和提示音效 ---
function triggerComboBreak() {
  comboCount = 0;
  
  let osc = new p5.Oscillator('sine'); // 改为柔和的正弦波
  let env = new p5.Envelope();
  
  // 调整参数：缩短 Attack，增加 Release，让声音变成“噗”的一声轻响或类似水滴消失的声音
  env.setADSR(0.01, 0.1, 0.1, 0.4); 
  env.setRange(0.2, 0); // 降低音量，避免刺耳
  
  osc.freq(220); // 调高一点频率，减少那种沉重的低频感
  osc.amp(env);
  osc.start();
  env.play();
  
  // 增加一点音高滑落，模拟一种“泄气”但优雅的听感
  osc.freq(110, 0.3); 
  
  setTimeout(() => osc.stop(), 500);
}

function drawGrid() {
  stroke(232, 236, 230); // 柔和网格
  for (let x = 0; x < width; x += 40) line(x, 0, x, height);
  for (let y = 0; y < height; y += 40) line(0, y, width, y);
}

function drawUI(timeLeft) { // 这里添加了 timeLeft 参数
  noStroke();
  let uiH = 90; // 面板统一高度
  fill(255, 245);
  rect(0, 0, width, uiH);
  stroke(240);
  line(0, uiH, width, uiH);
  noStroke();

  // 定义常用比例
  let padL = width * 0.04;      // 左内边距
  let padR = width - width * 0.04; // 右内边距

  // 1. 左侧：核心数据
  fill(60, 65, 70);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(14);
  text("✨ 情绪和谐度: " + ecoStats.totalHarmonyPoints, padL, 15);
  textStyle(NORMAL);
  textSize(11);
  fill(140);
  text("净化: " + ecoStats.purifiedCount + " | 累计: " + ecoStats.totalKills, padL, 38);

  // 2. 中间：图鉴收集
  if (width > 500) {
    let species = ['Pinky', 'Minty', 'Sky', 'Honey', 'Spoiler'];
    let colThemes = [color(248, 172, 174), color(158, 219, 182), color(94, 170, 227), color(249, 216, 123), color(100, 102, 105)];
    
    let graphStart = width * 0.35; 
    let itemW = width * 0.08; 
    let gap = width * 0.10; 

    for (let i = 0; i < 5; i++) {
      let count = ecoStats.speciesEmpathy[species[i]];
      let progress = count % 100;
      let itemX = graphStart + (i * gap);
      
      fill(235);
      rect(itemX, 55, itemW, 4, 2);
      fill(colThemes[i]);
      rect(itemX, 55, map(progress, 0, 100, 0, itemW), 4, 2);
      
      fill(110);
      textSize(9);
      textAlign(CENTER);
      text("Lv." + (Math.floor(count / 100) + 1), itemX + itemW/2, 65);
    }
  }

  // 3. 右侧：连击、生态容量与倒计时
  textAlign(RIGHT, TOP);
  
  // 倒计时显示 (新增部分)
  fill(94, 170, 227);
  textStyle(BOLD);
  textSize(14);
  text("⏱️ " + timeLeft + "s", padR, 10);
  
  textStyle(NORMAL);
  if (comboCount > 1) {
    fill(comboCount > 5 ? color(244, 91, 105) : color(249, 160, 63));
    textStyle(BOLD);
    textSize(14);
    text(comboCount + " Hz", padR, 30);
  }

  fill(150);
  textSize(10);
  textStyle(NORMAL);
  text(creatures.length + "/" + maxCreatures, padR, 50);
  
  let nextMilestone = milestones.find(m => ecoStats.totalKills < m) || "MAX";
  fill(100, 102, 105);
  text(nextMilestone === "MAX" ? "圆满" : "目标:" + nextMilestone, padR, 65);
  // 在 drawUI 内部的末尾，加上这一行来显示倒计时
  textAlign(RIGHT, TOP);
  fill(60);
  textSize(14);
  text("剩余时间: " + timeLeft + "s", width - 20, 70);
}
function loadLocalEcoData() {
  let saved = localStorage.getItem('jelly_eco_player_data');
  if (saved) {
    try {
      let parsed = JSON.parse(saved);
      if (parsed.highestHarmony !== undefined) ecoStats.highestHarmony = parsed.highestHarmony;
      if (parsed.totalKills !== undefined) ecoStats.totalKills = parsed.totalKills;
      if (parsed.speciesEmpathy !== undefined) ecoStats.speciesEmpathy = parsed.speciesEmpathy;
      if (parsed.totalHarmonyPoints !== undefined) ecoStats.totalHarmonyPoints = parsed.totalHarmonyPoints;
      if (ecoStats.speciesEmpathy.Spoiler === undefined) ecoStats.speciesEmpathy.Spoiler = 0;
    } catch (e) { console.log("重置环境"); }
  }
}

function saveLocalEcoData() {
  localStorage.setItem('jelly_eco_player_data', JSON.stringify(ecoStats));
}

class Creature {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(2.4); 
    this.acc = createVector(0, 0);
    this.r = random(22, 35); // 稍微放宽尺寸，留出印花展示空间
    this.killed = false;
    this.spawnTimer = 20; 

    // Q弹形变
    this.wobbleX = 1.0;
    this.wobbleY = 1.0;
    this.wobbleSpeed = random(0.08, 0.14);
    this.wobblePhase = random(TWO_PI);

    this.lastTouchTime = 0;
    this.isPressedBefore = false;

    // 随机波点印花偏移量偏移量 (为斑点怪兽准备)
    this.patternSeed = random(100);

    let roll = random(1);
    if (roll < 0.15) {
      this.speciesType = 'Spoiler';
      // Tagi高级灰墨色
      this.color = color(58, 64, 70); 
      this.r = random(26, 33); 
    } else {
      let typeRoll = random(0.85);
      if (typeRoll < 0.21) {
        this.speciesType = 'Pinky';
        this.color = color(248, 172, 174); 
      } else if (typeRoll < 0.42) {
        this.speciesType = 'Minty';
        this.color = color(158, 219, 182); 
      } else if (typeRoll < 0.63) {
        this.speciesType = 'Sky';
        this.color = color(94, 170, 227);  
      } else {
        this.speciesType = 'Honey';
        this.color = color(249, 216, 123); 
      }
    }
  }
  
  reactToInput(tx, ty, isTouching) {
    let d = dist(this.pos.x, this.pos.y, tx, ty);
    
    if (isTouching && d < mouseKillRadius + this.r) {
      let distFactor = map(d, 0, mouseKillRadius + this.r, 1.0, 0.0);
      this.wobbleX = 1.0 + distFactor * 0.38;
      this.wobbleY = 1.0 - distFactor * 0.38;

      if (this.spawnTimer <= 0 && d < this.r * 1.25 && !this.killed) {
        
       // 1. 检查是否为 Spoiler 煤球
        if (this.speciesType === 'Spoiler') {
          let currentTime = millis();
          
          // A. 逻辑：双击消除 (必须在阈值内再次点击)
          if (this.isPressedBefore && (currentTime - this.lastTouchTime < 350)) {
            this.killed = true; 
            ecoStats.purifiedCount++;
            ecoStats.totalKills++;
            ecoStats.speciesEmpathy.Spoiler++;
            ecoStats.totalHarmonyPoints += 50;
            saveLocalEcoData();
            screenShake = 2;
            feedbackEffects.push(new FeedbackFX(this.pos.x, this.pos.y, "✨ 双击净化 +50", color(94, 170, 227), 22));
            playPurifySound();
            this.isPressedBefore = false; // 重置
            return; // 结束函数，成功消除
          }
          
          // B. 逻辑：单次触碰减分 (触发后不消除)
          if (!this.isPressedBefore) {
            comboCount = 0;
            ecoStats.totalHarmonyPoints = max(0, ecoStats.totalHarmonyPoints - 100);
            saveLocalEcoData();
            screenShake = 6;
            feedbackEffects.push(new FeedbackFX(this.pos.x, this.pos.y, "⚠️ 能量流失 -100", color(120, 125, 120), 20));
            triggerComboBreak();
            this.isPressedBefore = true;
          }
          
          this.lastTouchTime = currentTime; // 记录时间以便后续双击判断
          return; // 这里非常重要！触碰减分后立刻退出，确保不执行下面的普通消除逻辑
        } 
        
        // 2. 如果不是 Spoiler，则执行普通生物的消除逻辑
        else {
          this.killed = true;
          comboCount++;
          lastKillTime = millis();
          if (comboCount > ecoStats.highestHarmony) ecoStats.highestHarmony = comboCount;
          
          ecoStats.purifiedCount++;
          ecoStats.totalKills++;
          ecoStats.speciesEmpathy[this.speciesType]++; 
          
          let pointGain = 10 * comboCount;
          ecoStats.totalHarmonyPoints += pointGain;
          saveLocalEcoData();
          
          screenShake = map(constrain(comboCount, 1, 10), 1, 10, 2, 12);
          
          let effectTxt = comboCount > 1 ? `POP! x${comboCount}` : "POP!";
          let effectSize = map(constrain(comboCount, 1, 15), 1, 15, 20, 45); 
          let effectColor = comboCount > 5 ? color(244, 91, 105) : color(94, 170, 227);
          
          feedbackEffects.push(new FeedbackFX(this.pos.x, this.pos.y, effectTxt, effectColor, effectSize));
          playMelodySound();
          return;
        }

        this.killed = true;
        comboCount++;
        lastKillTime = millis();
        if (comboCount > ecoStats.highestHarmony) ecoStats.highestHarmony = comboCount;
        
        ecoStats.purifiedCount++;
        ecoStats.totalKills++;
        ecoStats.speciesEmpathy[this.speciesType]++; 
        
        let pointGain = 10 * comboCount;
        ecoStats.totalHarmonyPoints += pointGain;
        saveLocalEcoData();
        
        screenShake = map(constrain(comboCount, 1, 10), 1, 10, 2, 12);
        
        let effectTxt = comboCount > 1 ? `POP! x${comboCount}` : "POP!";
        let effectSize = map(constrain(comboCount, 1, 15), 1, 15, 20, 45); 
        let effectColor = comboCount > 5 ? color(244, 91, 105) : color(94, 170, 227);
        
        feedbackEffects.push(new FeedbackFX(this.pos.x, this.pos.y, effectTxt, effectColor, effectSize));
        playMelodySound();
      }
      this.isPressedBefore = true;
    } else {
      if (!isTouching) this.isPressedBefore = false; 
      
      this.wobbleX = lerp(this.wobbleX, 1.0 + sin(frameCount * this.wobbleSpeed + this.wobblePhase) * 0.05, 0.12);
      this.wobbleY = lerp(this.wobbleY, 1.0 + cos(frameCount * this.wobbleSpeed + this.wobblePhase) * 0.05, 0.12);
    }

    if (isTouching && d < mouseKillRadius + 140) { 
      this.acc.add(p5.Vector.sub(this.pos, createVector(tx, ty)).setMag(2));
    }
  }

  checkCollision(others) {
    for (let other of others) {
      if (other !== this) {
        let d = this.pos.dist(other.pos);
        if (d < this.r + other.r) this.acc.add(p5.Vector.sub(this.pos, other.pos).setMag(0.5));
      }
    }
  }
  
  update() {
    if (this.spawnTimer > 0) this.spawnTimer--;
    this.vel.add(this.acc).limit(this.speciesType === 'Spoiler' ? 4 : 12); 
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.vel.mult(0.95);
    if (this.pos.x < this.r || this.pos.x > width - this.r) this.vel.x *= -0.8;
    if (this.pos.y < 85 + this.r || this.pos.y > height - this.r) this.vel.y *= -0.8; 
  }
  
  display(tx, ty) {
    push();
    translate(this.pos.x, this.pos.y);
    if (this.spawnTimer > 0) scale(1 - this.spawnTimer / 20);
    scale(this.wobbleX, this.wobbleY);

    if (this.speciesType === 'Spoiler') {
      // 1. 煤球身体：调整为单个圆形，保持暖灰色
      fill(100, 102, 105); 
      noStroke();
      circle(0, 0, this.r * 2); // 使用单个圆形代替原本的聚合形态

      // 2. 眼神：保持呆萌跟随感
      let eyeMoveX = cos(atan2(ty - this.pos.y, tx - this.pos.x)) * 3;
      let eyeMoveY = sin(atan2(ty - this.pos.y, tx - this.pos.x)) * 3;

      // 纯白眼底
      fill(255);
      circle(-this.r * 0.2 + eyeMoveX, -this.r * 0.1 + eyeMoveY, this.r * 0.7);
      circle(this.r * 0.35 + eyeMoveX, -this.r * 0.1 + eyeMoveY, this.r * 0.6);

      // 黑色瞳孔
      fill(46, 49, 51); 
      circle(-this.r * 0.15 + eyeMoveX, -this.r * 0.1 + eyeMoveY, this.r * 0.35);
      circle(this.r * 0.4 + eyeMoveX, -this.r * 0.1 + eyeMoveY, this.r * 0.3);
      
    } else {
      // --- 原有的常规生物绘制逻辑保持不变 ---
      rotate(this.vel.heading());
      fill(this.color); noStroke();
      ellipse(0, 0, this.r * 2, this.r * 2);
      
      let eyeMoveX = cos(atan2(ty - this.pos.y, tx - this.pos.x)) * 5;
      let eyeMoveY = sin(atan2(ty - this.pos.y, tx - this.pos.x)) * 5;
      fill(46, 49, 51);
      circle(-this.r * 0.35 + eyeMoveX, -5 + eyeMoveY, this.r * 0.25);
      circle(this.r * 0.35 + eyeMoveX, -5 + eyeMoveY, this.r * 0.25);
    }
    pop();
  }
  isDead() { return this.killed; }
}

class FeedbackFX {
  constructor(x, y, txt, col, size) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-1, 1), -3); 
    this.alpha = 255;
    this.txt = txt;
    this.col = col;
    this.baseSize = size;
    this.scaleProgress = 0; 
  }
  update() { 
    this.pos.add(this.vel); 
    this.alpha -= 6; 
    if (this.scaleProgress < 1) this.scaleProgress += 0.15; 
  }
  display() {
    push();
    translate(this.pos.x, this.pos.y);
    
    let currentScale = 1.0;
    if (this.scaleProgress < 1) {
      currentScale = sin(this.scaleProgress * HALF_PI) * 1.3; 
    }
    scale(currentScale);
    
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(this.baseSize);
    
    stroke(255, this.alpha);
    strokeWeight(4);
    fill(red(this.col), green(this.col), blue(this.col), this.alpha);
    text(this.txt, 0, 0);
    pop();
  }
  isDone() { return this.alpha < 0; }
}
function drawStartScreen() {
  background(248, 249, 246);
  textAlign(CENTER, CENTER);
  fill(60);
  textSize(32);
  text("果冻花园", width/2, height/2 - 50);
  
  // 提示：startButton 对象会自动绘制，这里主要画辅助文字
  fill(100);
  textSize(16);
  text("抚慰情绪小生物，寻找内心的和谐", width/2, height/2 - 10);
  
  // 确保按钮显示
  startButton.show();
}

function drawGameOverScreen() {
  fill(255, 230);
  rect(0, 0, width, height);
  textAlign(CENTER, CENTER);
  fill(60);
  textSize(30);
  text("共鸣结束", width/2, height/2 - 80);
  textSize(20);
  text("最终和谐度: " + ecoStats.totalHarmonyPoints, width/2, height/2 - 30);
  
  // “再次净化”按钮绘制 (UI 装饰)
  fill(94, 170, 227);
  rectMode(CENTER);
  rect(width/2, height/2 + 80, 140, 45, 10);
  fill(255);
  text("再次净化", width/2, height/2 + 80);
  rectMode(CORNER);
}
