/**
 * WebSmash - 網頁粉碎機
 * Core Logic Script (p5.js)
 * * Update Logs:
 * - Fixed: 火焰特效改用 Alpha Blending，解決透明圖層無法顯色問題。
 * - Added: 加入 Screen Shake (畫面震動) 系統，增加打擊感。
 */

// ========== 全域變數 ==========
let capturedImage;       // 存放螢幕截圖
let damageLayer;         // 靜態破壞層 (存儲裂痕、燒焦、豆腐痕跡)
let activeTofus = [];    // 活躍的豆腐物件列表
let activeWhipEffects = []; // 鞭子閃光特效列表
let currentTool = 'hammer'; // 當前工具
let isGameActive = false;   // 遊戲是否開始
let shakeAmount = 0;        // 畫面震動強度

// ========== p5.js 生命週期 ==========

function setup() {
    // 建立全螢幕畫布
    let cnv = createCanvas(windowWidth, windowHeight);
    cnv.style('display', 'block');
    
    // 初始化靜態破壞層 (Off-screen Graphics)
    damageLayer = createGraphics(windowWidth, windowHeight);
    
    // 預設停止迴圈，等待截圖後啟動
    noLoop();
}

function draw() {
    if (!isGameActive) return;

    background(0);

    // --- 儲存座標狀態 (開始繪製遊戲世界) ---
    push(); 

    // ⚡ 處理畫面震動特效
    if (shakeAmount > 0) {
        let shakeX = random(-shakeAmount, shakeAmount);
        let shakeY = random(-shakeAmount, shakeAmount);
        translate(shakeX, shakeY);
        
        // 震動衰減 (Damping)
        shakeAmount *= 0.9; 
        if (shakeAmount < 0.5) shakeAmount = 0;
    }

    // 1. 繪製底圖 (截圖)
    if (capturedImage) {
        image(capturedImage, 0, 0, width, height);
    }

    // 2. 繪製靜態破壞層 (裂痕、燒焦等)
    image(damageLayer, 0, 0);

    // 3. 處理持續性工具 (火焰槍、機關槍需要按住)
    if (mouseIsPressed && isGameActive) {
        // 只有滑鼠不在工具列區域時才觸發 (簡單防呆: x > 80)
        if (mouseX > 80) {
            if (currentTool === 'flame') {
                useFlamethrower(mouseX, mouseY);
            } else if (currentTool === 'machinegun') {
                useMachineGun(mouseX, mouseY);
            }
        }
    }

    // 4. 更新並繪製豆腐 (包含在破壞層留痕跡)
    updateAndDrawTofus();

    // 5. 更新並繪製鞭子閃光
    updateAndDrawWhipEffects();

    // --- 還原座標狀態 (結束繪製遊戲世界) ---
    pop(); 

    // 新增：繪製遊戲邊框 (UI 指示)
    push();
    noFill();
    stroke(255, 0, 0); // 紅色邊框
    strokeWeight(5);   // 細小的寬度
    rect(0, 0, width, height);
    pop();

    // 6. 繪製自定義游標 (不受震動影響，保持穩定)
    drawCustomCursor();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    // 注意：改變視窗大小會讓舊的 damageLayer 消失，
    // 實務上這裡通常會需要重新建立並繪製，或是暫時清空。
    damageLayer = createGraphics(windowWidth, windowHeight);
}

// ========== 系統功能：截圖與工具切換 ==========

async function startCapture() {
    try {
        // 請求螢幕分享權限
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "never" }, // 不錄製系統游標，改用我們畫的
            audio: false
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        // 稍微等待畫面穩定
        setTimeout(() => {
            capturedImage = createImage(windowWidth, windowHeight);
            
            // 計算比例以填滿畫面 (Cover mode)
            let scale = Math.max(windowWidth / video.videoWidth, windowHeight / video.videoHeight);
            let w = video.videoWidth * scale;
            let h = video.videoHeight * scale;
            let x = (windowWidth - w) / 2;
            let y = (windowHeight - h) / 2;

            // 將 video 畫面畫到 p5 image 上
            capturedImage.drawingContext.drawImage(video, x, y, w, h);
            
            // 停止串流 (釋放資源，定格畫面)
            stream.getTracks().forEach(track => track.stop());
            video.remove();

            // 切換 UI 狀態
            document.getElementById('start-overlay').style.display = 'none';
            document.getElementById('toolbar').style.display = 'flex';
            document.getElementById('status-bar').style.display = 'block';
            
            isGameActive = true;
            loop(); // 開始 draw 迴圈
        }, 800);

    } catch (err) {
        console.error(err);
        alert("需要螢幕權限才能開始遊戲！請重新整理並允許權限。");
    }
}

function selectTool(tool) {
    currentTool = tool;
    
    // 更新狀態列文字
    const toolNames = {
        'hammer': '鐵鎚 🔨', 'flame': '火焰槍 🔥', 
        'whip': '鞭子 🐍', 'tofu': '豆腐 ⬜',
        'machinegun': '機關槍 🔫'
    };
    let statusBar = document.getElementById('status-bar');
    if(statusBar) statusBar.innerText = `當前工具: ${toolNames[tool]}`;
    
    // 更新按鈕樣式 (依賴 HTML onclick 事件觸發這裡)
    document.querySelectorAll('.tool').forEach(el => el.classList.remove('active'));
    
    // 透過 event.currentTarget 抓取被點擊的按鈕元素
    if(event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

function resetDamage() {
    damageLayer.clear();
    activeTofus = [];
    activeWhipEffects = [];
    shakeAmount = 0;
}

// ========== 輸入事件處理 ==========

function mousePressed() {
    if (!isGameActive) return;
    // 避免點擊工具列觸發效果 (防呆區域)
    if (mouseX < 80) return;

    if (currentTool === 'hammer') useHammer(mouseX, mouseY);
    if (currentTool === 'whip') useWhip(mouseX, mouseY);
    if (currentTool === 'tofu') useTofu(mouseX, mouseY);
}

// ========== 工具實作細節 (Procedural Drawing) ==========

// 1. 鐵鎚 🔨
function useHammer(x, y) {
    shakeAmount = 10; // 強烈震動 (已調降)

    damageLayer.push();
    damageLayer.translate(x, y);
    
    // 撞擊點
    damageLayer.noStroke();
    damageLayer.fill(255, 255, 255, 100);
    damageLayer.ellipse(0, 0, 15, 15);

    // 裂痕
    damageLayer.stroke(220);
    damageLayer.strokeWeight(2);
    damageLayer.noFill();
    
    let cracks = floor(random(6, 12));
    for (let i = 0; i < cracks; i++) {
        let angle = random(TWO_PI);
        let len = random(30, 100);
        
        // 畫折線模擬隨機裂痕
        damageLayer.beginShape();
        damageLayer.vertex(0, 0);
        damageLayer.vertex(cos(angle) * len * 0.5 + random(-5,5), sin(angle) * len * 0.5 + random(-5,5));
        damageLayer.vertex(cos(angle) * len, sin(angle) * len);
        damageLayer.endShape();
    }
    damageLayer.pop();
}

// 2. 火焰槍 🔥
function useFlamethrower(x, y) {
    // 註：持續性震動通常會太暈，這裡不加震動，或加很小的震動
    // shakeAmount = 2; 

    damageLayer.push();
    // ✅ 修正點：移除 MULTIPLY，使用預設 BLEND 模式搭配透明度疊加
    damageLayer.blendMode(BLEND); 
    damageLayer.noStroke();
    
    // 噴灑粒子 (火力加強：增加粒子數量)
    for(let i=0; i<12; i++) {
        let r = random(15, 55);
        let ox = random(-30, 30);
        let oy = random(-30, 30);
        
        // 顏色：焦黑帶紅，透明度 (Alpha) 設為 20 讓它慢慢疊加變深
        damageLayer.fill(30, 20, 10, 20); 
        damageLayer.circle(x + ox, y + oy, r);
    }
    damageLayer.pop();
}

// 3. 鞭子 🐍
function useWhip(x, y) {
    shakeAmount = 4; // 輕微震動 (已調降)

    // 3.1 增加動態閃光 (Visual Flash)
    activeWhipEffects.push({
        x: x, y: y, life: 10, maxLife: 10, 
        angle: random(PI/4, 3*PI/4) // 隨機斜向角度
    });

    // 3.2 增加永久刮痕 (Damage)
    damageLayer.push();
    damageLayer.stroke(139, 0, 0, 180); // 深紅
    damageLayer.strokeWeight(3);
    damageLayer.noFill();
    
    // 畫一條微彎的線 (貝茲曲線)
    let len = 120;
    let angle = random(TWO_PI);
    let x2 = x + cos(angle) * len;
    let y2 = y + sin(angle) * len;
    
    damageLayer.bezier(
        x - 20, y - 20, 
        x + random(-30, 30), y + random(-30, 30),
        x2 + random(-30, 30), y2 + random(-30, 30),
        x2, y2
    );
    damageLayer.pop();
}

// 4. 豆腐 ⬜
class Tofu {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vy = random(0.5, 2.5); // 滑落速度
        this.size = 50;
    }
    update() {
        this.y += this.vy;
        
        // 在背後留下痕跡 (畫在 damageLayer 上，所以是永久的)
        damageLayer.noStroke();
        damageLayer.fill(255, 255, 255, 3); // 極淡的白色黏液
        damageLayer.rectMode(CENTER);
        // 痕跡寬度略小於豆腐
        damageLayer.rect(this.x, this.y - this.size/2, this.size * 0.8, this.vy + 5);
    }
    display() {
        // 畫豆腐本體 (畫在主 Canvas 上，動態更新)
        push();
        translate(this.x, this.y);
        rectMode(CENTER);
        
        // 陰影
        fill(0, 0, 0, 50);
        rect(5, 5, this.size, this.size, 8);
        
        // 豆腐白
        fill(245, 245, 240);
        rect(0, 0, this.size, this.size, 8);
        pop();
    }
}

function useTofu(x, y) {
    shakeAmount = 1; // 豆腐給予最小的震動效果
    activeTofus.push(new Tofu(x, y));
}

// 5. 機關槍 🔫
function useMachineGun(x, y) {
    // 限制射速：每 4 幀發射一次
    if (frameCount % 4 !== 0) return;

    shakeAmount = 3; // 中等震動

    damageLayer.push();
    damageLayer.translate(x, y);

    // 彈孔 (隨機散佈)
    let spread = 15;
    let dx = random(-spread, spread);
    let dy = random(-spread, spread);

    damageLayer.translate(dx, dy);
    damageLayer.noStroke();

    // 彈孔中心
    damageLayer.fill(10, 10, 10, 200);
    damageLayer.circle(0, 0, random(6, 10));

    // 彈孔燒焦邊緣
    damageLayer.noFill();
    damageLayer.stroke(50, 50, 50, 150);
    damageLayer.strokeWeight(1);
    damageLayer.circle(0, 0, random(10, 14));

    // 小裂痕
    damageLayer.stroke(200, 200, 200, 150);
    damageLayer.strokeWeight(1);
    for(let i=0; i<3; i++) {
        let a = random(TWO_PI);
        let l = random(5, 12);
        damageLayer.line(0, 0, cos(a)*l, sin(a)*l);
    }

    damageLayer.pop();

    // 槍口閃光 (Muzzle Flash) - 畫在主畫布上，只出現一瞬間
    push();
    translate(x + dx, y + dy); // 跟隨彈孔位置
    noStroke();
    fill(255, 200, 50, 200); // 亮黃色

    // 畫一個不規則的星形或爆炸形
    beginShape();
    for (let i = 0; i < 8; i++) {
        let angle = map(i, 0, 8, 0, TWO_PI);
        let r = (i % 2 === 0) ? random(15, 25) : random(5, 10);
        vertex(cos(angle) * r, sin(angle) * r);
    }
    endShape(CLOSE);
    pop();
}

function updateAndDrawTofus() {
    for (let i = activeTofus.length - 1; i >= 0; i--) {
        let t = activeTofus[i];
        t.update();
        t.display();
        
        // 超出邊界一定距離後移除，節省記憶體
        if (t.y > height + 100) {
            activeTofus.splice(i, 1);
        }
    }
}

// 鞭子特效更新
function updateAndDrawWhipEffects() {
    for (let i = activeWhipEffects.length - 1; i >= 0; i--) {
        let e = activeWhipEffects[i];
        let progress = e.life / e.maxLife;
        
        push();
        translate(e.x, e.y);
        rotate(e.angle);
        // 隨著壽命減少，透明度與粗細也減少
        stroke(255, 255, 200, progress * 255);
        strokeWeight(progress * 8);
        line(-60, 0, 60, 0); // 閃光線條
        pop();
        
        e.life--;
        if (e.life <= 0) activeWhipEffects.splice(i, 1);
    }
}

// 自定義游標
function drawCustomCursor() {
    noCursor();
    stroke(255);
    strokeWeight(2);
    noFill();
    
    let x = mouseX;
    let y = mouseY;
    
    // 根據不同工具繪製不同游標
    if (currentTool === 'hammer') {
        // 圓圈準星
        ellipse(x, y, 20, 20);
        line(x-15, y, x+15, y);
        line(x, y-15, x, y+15);
    } else if (currentTool === 'flame') {
        stroke(255, 100, 0); // 橘色
        ellipse(x, y, 30, 30);
        strokeWeight(4);
        point(x, y);
    } else if (currentTool === 'tofu') {
        rectMode(CENTER);
        rect(x, y, 24, 24);
    } else if (currentTool === 'machinegun') {
        // 機關槍：準心
        stroke(0, 255, 0); // 綠色準心
        noFill();
        ellipse(x, y, 25, 25);
        line(x - 20, y, x - 5, y);
        line(x + 5, y, x + 20, y);
        line(x, y - 20, x, y - 5);
        line(x, y + 5, x, y + 20);
        strokeWeight(4);
        point(x, y);
    } else {
        // 鞭子：X 型
        line(x-10, y-10, x+10, y+10);
        line(x+10, y-10, x-10, y+10);
    }
}
