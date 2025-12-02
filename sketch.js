// ========== 全域變數 ==========
let capturedImage;       // 存放螢幕截圖
let damageLayer;         // 靜態破壞層 (存儲裂痕、燒焦、豆腐痕跡)
let activeTofus = [];    // 活躍的豆腐物件列表
let activeWhipEffects = []; // 鞭子閃光特效列表
let currentTool = 'hammer'; // 當前工具
let isGameActive = false;   // 遊戲是否開始

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

    // 1. 繪製底圖 (截圖)
    if (capturedImage) {
        image(capturedImage, 0, 0, width, height);
    }

    // 2. 繪製靜態破壞層 (裂痕、燒焦等)
    image(damageLayer, 0, 0);

    // 3. 處理持續性工具 (火焰槍需要按住)
    if (mouseIsPressed && isGameActive) {
        if (currentTool === 'flame') useFlamethrower(mouseX, mouseY);
    }

    // 4. 更新並繪製豆腐 (包含在破壞層留痕跡)
    updateAndDrawTofus();

    // 5. 更新並繪製鞭子閃光
    updateAndDrawWhipEffects();

    // 6. 繪製自定義游標
    drawCustomCursor();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    // 注意：改變視窗大小會讓舊的 damageLayer 消失或變形，這邊暫不處理複雜的 resize 保留邏輯
    damageLayer = createGraphics(windowWidth, windowHeight);
}

// ========== 系統功能：截圖與工具切換 ==========

async function startCapture() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "never" },
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

            // 將 video 畫到 p5 image 上
            capturedImage.drawingContext.drawImage(video, x, y, w, h);
            
            // 停止串流
            stream.getTracks().forEach(track => track.stop());
            video.remove();

            // 啟動遊戲介面
            document.getElementById('start-overlay').style.display = 'none';
            document.getElementById('toolbar').style.display = 'flex';
            document.getElementById('status-bar').style.display = 'block';
            
            isGameActive = true;
            loop(); // 開始 draw 迴圈
        }, 800);

    } catch (err) {
        console.error(err);
        alert("需要螢幕權限才能開始遊戲！");
    }
}

function selectTool(tool) {
    currentTool = tool;
    
    // 更新 UI
    document.querySelectorAll('.tool').forEach(el => el.classList.remove('active'));
    // 這裡簡單透過去找對應 title 或 onclick 屬性來 hightlight，或直接點擊觸發
    // 為了簡單，我們假設使用者點擊時已經觸發了 this class change，
    // 但因為 selectTool 是全局呼叫，我們用最簡單的方式更新文字
    const toolNames = {
        'hammer': '鐵鎚 🔨', 'flame': '火焰槍 🔥', 
        'whip': '鞭子 🐍', 'tofu': '豆腐 ⬜'
    };
    document.getElementById('status-bar').innerText = `當前工具: ${toolNames[tool]}`;
    
    // 重新綁定 active class (這段需配合 HTML onclick 傳入 event，這裡簡化處理)
    // 實際運作主要靠 currentTool 變數
    let tools = document.getElementsByClassName('tool');
    for(let t of tools) {
        if(t.getAttribute('onclick').includes(tool)) t.classList.add('active');
    }
}

function resetDamage() {
    damageLayer.clear();
    activeTofus = [];
    activeWhipEffects = [];
}

// ========== 輸入事件處理 ==========

function mousePressed() {
    if (!isGameActive) return;
    // 避免點擊工具列觸發效果 (簡單判定 X 軸)
    if (mouseX < 80) return;

    if (currentTool === 'hammer') useHammer(mouseX, mouseY);
    if (currentTool === 'whip') useWhip(mouseX, mouseY);
    if (currentTool === 'tofu') useTofu(mouseX, mouseY);
}

// ========== 工具實作細節 (Procedural Drawing) ==========

// 1. 鐵鎚
function useHammer(x, y) {
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
        
        // 畫折線
        damageLayer.beginShape();
        damageLayer.vertex(0, 0);
        damageLayer.vertex(cos(angle) * len * 0.5 + random(-5,5), sin(angle) * len * 0.5 + random(-5,5));
        damageLayer.vertex(cos(angle) * len, sin(angle) * len);
        damageLayer.endShape();
    }
    damageLayer.pop();
}

// 2. 火焰槍
function useFlamethrower(x, y) {
    damageLayer.push();
    damageLayer.blendMode(MULTIPLY); // 越疊越黑
    damageLayer.noStroke();
    
    // 噴灑粒子
    for(let i=0; i<5; i++) {
        let r = random(10, 40);
        let ox = random(-20, 20);
        let oy = random(-20, 20);
        damageLayer.fill(50, 20, 10, 20); // 焦黑色
        damageLayer.circle(x + ox, y + oy, r);
    }
    damageLayer.pop();
}

// 3. 鞭子
function useWhip(x, y) {
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
    
    // 畫一條微彎的線
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

// 4. 豆腐
class Tofu {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vy = random(0.5, 2.5); // 滑落速度
        this.size = 50;
    }
    update() {
        this.y += this.vy;
        
        // 在背後留下痕跡 (畫在 damageLayer 上)
        damageLayer.noStroke();
        damageLayer.fill(255, 255, 255, 3); // 極淡
        damageLayer.rectMode(CENTER);
        // 痕跡寬度略小於豆腐
        damageLayer.rect(this.x, this.y - this.size/2, this.size * 0.8, this.vy + 5);
    }
    display() {
        // 畫豆腐本體 (畫在主 Canvas 上)
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
    activeTofus.push(new Tofu(x, y));
}

function updateAndDrawTofus() {
    for (let i = activeTofus.length - 1; i >= 0; i--) {
        let t = activeTofus[i];
        t.update();
        t.display();
        
        // 超出邊界移除
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
    
    if (currentTool === 'hammer') {
        // 圓圈準星
        ellipse(x, y, 20, 20);
        line(x-15, y, x+15, y);
        line(x, y-15, x, y+15);
    } else if (currentTool === 'flame') {
        stroke(255, 100, 0);
        ellipse(x, y, 30, 30);
        point(x, y);
    } else if (currentTool === 'tofu') {
        rectMode(CENTER);
        rect(x, y, 20, 20);
    } else {
        // 鞭子：X 型
        line(x-10, y-10, x+10, y+10);
        line(x+10, y-10, x-10, y+10);
    }
}
