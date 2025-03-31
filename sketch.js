// main variances
let volume = 0;
let pitch = 0;
let osc, playing, freq, amp;
let reverb;
let delay;
let filter;

let scaleNotes = [];
let scaleFreqs = [];
let noteDiffs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // Major b3 #4
let basicNote = 0; // F

// the HandPose model
let model;
let predictions = [];
let video;

// flappy bird game
let bird;
let pipes = [];
let bg;



// midi
let playspeed = 0.5;
let bpm = 88 * playspeed;

// 
let orb;
let frequencies = [];
let f_x = [];
let times = [];

let pipeIndex = 0;
let startTime = 0;
let playPipes = false;

let freq_up = 1550;
let freq_down = 500;

let sensitivity = 3000;
let freq_low = 200;


function bpmToSpeed(bpm) {
  return bpm*60/60;
}

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

  bg = loadImage("./assets/castle.jpg");
  orb = loadSound("./assets/untitled.wav");
}

function cal_scaleNotes() {
  let note = basicNote;
  let i = 0;
  let j = 0;
  while (note < 119) {
    note = basicNote + noteDiffs[i] + j * 12;
    scaleNotes.push(note);
    // scaleFreqs.push(midiToFreq(note));
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
function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO, { flipped: true });
  video.size(windowWidth, windowHeight);
  video.hide();

  model.detectStart(video, (results) => {
    predictions = results;
  });

  osc = new p5.Oscillator();
  reverb = new p5.Reverb();
  delay = new p5.Delay(0.12, 0.7);
  filter = new p5.LowPass();
  filter.freq(1500);
  reverb.set(1);
  osc.setType("sine");

  osc.connect(delay);
  delay.connect(reverb);
  reverb.connect(filter);


  cal_scaleNotes();

  loadTable("./python/midi_time_output.csv", "csv", "header", function (table) {
    for (let r = 0; r < table.getRowCount(); r++) {
      const midi = table.getNum(r, "midi");
      const time = table.getNum(r, "time");
      let freq = midiToFreq(midi);
      scaleFreqs.push(freq);
      let x = map(freq, freq_down, freq_up, 0, windowWidth, true);
      frequencies.push(freq);
      f_x.push(x);
      times.push(time/playspeed);
    }
    console.log("🎵 frequencies loaded:", frequencies.length);
  }); 

  bird = new Bird();

  colorMode(HSL, 360, 100, 100, 255);
}

function draw() {
  // 背景绘制
  let canvasRatio = windowWidth / windowHeight;
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
  image(bg, windowWidth / 2, windowHeight / 2, drawWidth, drawHeight);

  predictions.forEach((hand, i) => {
    drawKeypoints(hand, i);
    drawSkeleton(hand, i);
    process(hand, i);
  });

  bird.x = map(pitch, freq_down, freq_up, 0, windowWidth, true);
  bird.r = map(volume, 0, 1, 0, 30);
  bird.show();
  bird.update();


  if (playPipes) {
    let currentTime = (millis() - startTime) / 1000;

    while (pipeIndex < times.length && currentTime >= times[pipeIndex]-1.1) {
      pipes.push(new Pipe(f_x[pipeIndex]));

      pipeIndex++;
    }
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].speed = 10;
    pipes[i].show();
    pipes[i].update();

    if (pipes[i].offscreen()) {
      pipes.splice(i, 1);
    }
  }

    // 频率显示
    // fill(255);
    // stroke(0);
    // strokeWeight(3);
    // textSize(24);
    // textAlign(LEFT, TOP);
  
    // let currentFreqText = "Current Pitch Frequency: " + pitch.toFixed(2) + " Hz";
    // let targetFreqText = "Target Pipe Frequency: " + 
    //   (pipeIndex < frequencies.length ? frequencies[pipeIndex].toFixed(2) + " Hz" : "N/A");
  
    // text(currentFreqText, 10, 10);
    // text(targetFreqText, 10, 40);
  
}



function process(hand, i) {
  const avg = hand.keypoints.reduce(
    (acc, kp) => {
      if (hand.handedness == "Left") {
        // Calculate hand openness by averaging distances from wrist to fingertips
        const wrist = hand.keypoints[0];
        const fingertipIndices = [4, 8, 12, 16, 20]; // Thumb tip, index tip, middle tip, ring tip, pinky tip
        let totalDist = 0;

        fingertipIndices.forEach(index => {
          const tip = hand.keypoints[index];
          const dx = tip.x - wrist.x;
          const dy = tip.y - wrist.y;
          totalDist += Math.sqrt(dx * dx + dy * dy);
        });

        const openness = totalDist / fingertipIndices.length;
        // Normalize openness (adjust the divisor for sensitivity)
        volume = constrain(openness / 200-0.7, 0, 2) / 2;
        console.log("Volume:", volume);
      }
      if (hand.handedness == "Right") {
        acc.x += kp.x;
      }
      return acc;
    },
    { x: 0, y: 0 }
  );
  avg.x /= hand.keypoints.length;
  // avg.y /= hand.keypoints.length; // Removed

  if (hand.handedness == "Right") {
    let targetPitch = (avg.x - windowWidth/2) * sensitivity / (windowWidth/2) + freq_low;
    // targetPitch = quantizeToScale(targetPitch, scaleFreqs);
    targetPitch = quantizeToScale(targetPitch, frequencies);
    pitch = lerp(pitch, targetPitch, 0.08);
  }

  if (playing) {
    osc.amp(volume);
    osc.freq(pitch);
  }
}

function keyPressed() {
  userStartAudio();

  if (key == " " && !playing) {
    osc.amp(0.5);
    osc.freq(440);
    osc.start();
    playing = true;
  }

  if (key == "p") {
    startTime = millis();
    playPipes = true;
    // orb.rate(playspeed);
    orb.play();
  }
}

class Bird {
  constructor() {
    this.x = windowWidth / 2;
    this.y = windowHeight - 100;
    this.particles = [];
  }

  show() {
    for (let p of this.particles) {
      fill(p.color);
      noStroke();
      ellipse(p.x, p.y, p.r);
    }
  }

  update() {
    this.y = windowHeight - 100; // 保持 y 恒定或你可以让它随 pitch/volume 动态变化
    let numParticles = int(map(volume, 0, 1, 1, 3));

    for (let i = 0; i < numParticles; i++) {
      let angle = random(TWO_PI);
      let radius = random(10, 35);
      let px = this.x + cos(angle) * radius;
      let py = this.y + sin(angle) * radius;
      let hue = (frameCount * 5 + i * 10) % 360;
      let col = color(`hsl(${hue}, 100%, 50%)`);
      this.particles.push({
        x: px,
        y: py,
        r: random(10, 20),
        color: col,
        lifespan: 100
      });
    }

    for (let p of this.particles) {
      p.lifespan -= 2;
      p.r *= 0.98;
      p.color.setAlpha(map(p.lifespan, 0, 100, 0, 255));
    }

    this.particles = this.particles.filter(p => p.lifespan > 0);
  }
}

class Pipe {
  constructor(xCenter) {
    // 中间空隙的中心位置由 xCenter 决定
    let gapWidth = 200;//random(80, 120); // 空隙宽度可以根据需要调节
    this.gapLeft = xCenter - gapWidth / 2;
    this.gapRight = xCenter + gapWidth / 2;

    this.y = 0;
    this.h = 50;
    this.speed = 3;
  }

  show() {
    noStroke();
    fill(10, 100, 255); // 使用 HSL 模式，透明度为 100/255，颜色偏蓝
  
    let cornerRadius = 20;
  
    // 左侧障碍物（圆角矩形）
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.roundRect(0, this.y, this.gapLeft, this.h, cornerRadius);
    drawingContext.fill();
    drawingContext.restore();
  
    // 右侧障碍物（圆角矩形）
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.roundRect(this.gapRight, this.y, windowWidth - this.gapRight, this.h, cornerRadius);
    drawingContext.fill();
    drawingContext.restore();
  }
  update() {
    this.y += this.speed;
  }

  offscreen() {
    return this.y > windowHeight;
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
