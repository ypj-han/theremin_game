// main variances
let volume = 0;
let pitch = 0;
let osc, playing, freq, amp;
let reverb;
let scaleNotes = [];
let scaleFreqs = [];
let noteDiffs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // Major b3 #4
let basicNote = 1; // F

// parameters 


// the HandPose model
let model;
let predictions = [];
let video;
// let img;

// flappy bird game
let bird;
let pipes = [];
// let gameOver = false;
let bg;

function preload() {
  model = ml5.handPose(
    {
      flipped: true,
      maxHands: 2,
      modelType: "full",
    },
    () => {
      console.log("🚀 model loaded");
    }
  );
  // img = loadImage("theremin.png");
  bg = loadImage("./assets/flappy_background.png");
}

function cal_scaleNotes() {
  let note = basicNote;
  let i = 0;
  let j = 0;
  while (note < 119) {
    note = basicNote + noteDiffs[i] + j * 12;
    scaleNotes.push(note);
    scaleFreqs.push(midiToFreq(note));
    i++;
    if (i == noteDiffs.length) {
      i = 0;
      j++;
    }
  }
}

function quantizeToScale(freq, scale) {
  let minDiff = Infinity;
  let quantizedFreq = freq;
  for (let noteFrq of scale) {
    let diff = Math.abs(freq - noteFrq);
    if (diff < minDiff) {
      minDiff = diff;
      quantizedFreq = noteFrq;
    }
  }
  return quantizedFreq;
}

let w, h;
function setup() {
  w = windowWidth;
  h = windowHeight;
  createCanvas(w, h);

  video = createCapture(VIDEO, { flipped: true });
  video.size(w, h);
  video.hide();

  model.detectStart(video, (results) => {
    predictions = results;
  });

  // 
  

  osc = new p5.Oscillator();
  reverb = new p5.Reverb();
  osc.connect(reverb);
  cal_scaleNotes();

  bird = new Bird();
  pipes.push(new Pipe());
}

function draw() {
  let canvasRatio = width / height;
  let imgRatio = bg.width / bg.height;
  let drawWidth, drawHeight;
  
  if (imgRatio > canvasRatio) {
    drawHeight = height;
    drawWidth = bg.width * (height / bg.height);
  } else {
    drawWidth = width;
    drawHeight = bg.height * (width / bg.width);
  }
  
  imageMode(CENTER);
  image(bg, width / 2, height / 2, drawWidth, drawHeight);

  predictions.forEach((hand, i) => {
    drawKeypoints(hand, i);
    drawSkeleton(hand, i);
  });

  predictions.forEach((hand, i) => {
    process(hand, i);
  });

  // 控制鸟的高度和大小
  bird.y = map(pitch, 220, 1200, height, 0, true);
  bird.r = map(volume, 0, 1, 10, 40);

  bird.show();
  bird.update();

  // 管道逻辑
  if (frameCount % 100 === 0) {
    pipes.push(new Pipe());
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].show();
    pipes[i].update();

    // 仍然可以保留碰撞检测逻辑作为 debug 使用
    if (pipes[i].hits(bird)) {
      // console.log("💥 hit!");
    }

    if (pipes[i].offscreen()) {
      pipes.splice(i, 1);
    }
  }

  // 绘制参考图
  // let imgSize = width * 0.15;
  // image(img, width - imgSize - 10, height - imgSize - 10, imgSize, imgSize);
}

function process(hand, i) {
  const avg = hand.keypoints.reduce(
    (acc, kp) => {
      acc.x += kp.x;
      acc.y += kp.y;
      return acc;
    },
    { x: 0, y: 0 }
  );
  avg.x /= hand.keypoints.length;
  avg.y /= hand.keypoints.length;

  if (hand.handedness == "Left") {
    volume = (h - avg.y) / height;
  }
  if (hand.handedness == "Right") {
    let targetPitch = (avg.x - windowWidth/2) * 1500 / (windowWidth/2) + 65;
    targetPitch = quantizeToScale(targetPitch, scaleFreqs);
    pitch = lerp(pitch, targetPitch, 0.1);
  }

  if (playing) {
    osc.amp(volume);
    osc.freq(pitch);
  }
}

function keyPressed() {
  if (key == " ") {
    osc.amp(0.5);
    osc.freq(440);
    osc.start();
    playing = true;
    // 不再重置 bird 和管道
  }
}


function windowResized() {
  let w = windowWidth;
  let h = w * 3 / 4;
  resizeCanvas(w, h);
  video.size(w, h);
}

// Bird 类
class Bird {
  constructor() {
    this.y = height / 2;
    this.x = 100;
    this.r = 20;
    this.gravity = 0.7;
    this.velocity = 0;
  }

  show() {
    fill(255, 100, 0);
    noStroke();
    ellipse(this.x, this.y, this.r, this.r);
  }

  update() {
    this.velocity += this.gravity;
    this.y += this.velocity;
    this.y = constrain(this.y, 0, height);
  }
}

// Pipe 类
class Pipe {
  constructor() {
    this.top = random(height / 6, height / 2);
    this.bottom = height - this.top - random(100, 200);
    this.x = width;
    this.w = 50;
    this.speed = 3;
  }

  show() {
    fill(0, 100, 255);
    noStroke();
    rect(this.x, 0, this.w, this.top);
    rect(this.x, height - this.bottom, this.w, this.bottom);
  }

  update() {
    this.x -= this.speed;
  }

  offscreen() {
    return this.x < -this.w;
  }

  hits(bird) {
    let withinX = bird.x + bird.r / 2 > this.x && bird.x - bird.r / 2 < this.x + this.w;
    let hitsTop = bird.y - bird.r / 2 < this.top;
    let hitsBottom = bird.y + bird.r / 2 > height - this.bottom;
    return withinX && (hitsTop || hitsBottom);
  }
}

const colours = [
  "Red", "OrangeRed", "Gold", "Lime", "Turquoise", "DodgerBlue", "Blue", "DarkMagenta"
];

function drawKeypoints(hand, i) {
  const c = color(colours[i % colours.length]);
  fill(c);
  noStroke();
  hand.keypoints.forEach((kp) => {
    circle(kp.x, kp.y, 10);
  });
}

function drawSkeleton(hand, i) {
  const c = color(colours[i % colours.length]);
  stroke(c);
  strokeWeight(2);
  noFill();
  const connections = model.getConnections();
  connections.forEach((c) => {
    const [i, j] = c;
    const a = hand.keypoints[i];
    const b = hand.keypoints[j];
    line(a.x, a.y, b.x, b.y);
  });
}
