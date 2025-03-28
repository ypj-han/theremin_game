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
  bird.x = map(pitch, 220, 1200, 0, width, true);
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
      if (hand.handedness == "Left") {
        acc.y += kp.y;
      }
      if (hand.handedness == "Right") {
        acc.x += kp.x;
      }
      return acc;
    },
    { x: 0, y: 0 }
  );
  avg.x /= hand.keypoints.length;
  avg.y /= hand.keypoints.length;

  if (hand.handedness == "Left") {
    volume = (windowHeight - avg.y) / windowHeight;
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
  if (key == " " && !playing) {
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
    this.y = height - 100;
    this.x = width / 2;
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
    this.x += this.velocity;
    this.x = constrain(this.x, 0, width);
  }
}

// Pipe 类
class Pipe {
  constructor() {
    this.left = random(width / 6, width / 2);
    this.right = width - this.left - random(100, 200);
    this.y = 0;
    this.h = 50;
    this.speed = 3;
  }

  show() {
    fill(0, 100, 255);
    noStroke();
    rect(0, this.y, this.left, this.h);
    rect(width - this.right, this.y, this.right, this.h);
  }

  update() {
    this.y += this.speed;
  }

  offscreen() {
    return this.y > height;
  }

  hits(bird) {
    let withinY = bird.y + bird.r / 2 > this.y && bird.y - bird.r / 2 < this.y + this.h;
    let hitsLeft = bird.x - bird.r / 2 < this.left;
    let hitsRight = bird.x + bird.r / 2 > width - this.right;
    return withinY && (hitsLeft || hitsRight);
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
