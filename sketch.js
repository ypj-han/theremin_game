// main variances
let volume = 0;
let pitch = 0;
let osc, playing, freq, amp;
let reverb;
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

  bg = loadImage("./assets/flappy_background.png");
  orb = loadSound("./assets/untitled.wav");
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
  osc.connect(reverb);
  reverb.connect();

  cal_scaleNotes();

  loadTable("./python/midi_time_output.csv", "csv", "header", function (table) {
    for (let r = 0; r < table.getRowCount(); r++) {
      const midi = table.getNum(r, "midi");
      const time = table.getNum(r, "time");
      let freq = midiToFreq(midi);
      let x = map(freq, freq_down, freq_up, 0, windowWidth, true);
      frequencies.push(freq);
      f_x.push(x);
      times.push(time/playspeed);
    }
    console.log("🎵 frequencies loaded:", frequencies.length);
  }); 

  bird = new Bird();
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
    fill(255);
    stroke(0);
    strokeWeight(3);
    textSize(24);
    textAlign(LEFT, TOP);
  
    let currentFreqText = "Current Pitch Frequency: " + pitch.toFixed(2) + " Hz";
    let targetFreqText = "Target Pipe Frequency: " + 
      (pipeIndex < frequencies.length ? frequencies[pipeIndex].toFixed(2) + " Hz" : "N/A");
  
    text(currentFreqText, 10, 10);
    text(targetFreqText, 10, 40);
  
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
        volume = constrain(openness / 200, 0, 2) / 2;
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
    pitch = lerp(pitch, targetPitch, 0.05);
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

// Bird 类
class Bird {
  constructor() {
    this.y = windowHeight - 100;
    this.x = windowWidth / 2;
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
    this.x = constrain(this.x, 0, windowWidth);
  }
}

class Pipe {
  constructor(xCenter) {
    // 中间空隙的中心位置由 xCenter 决定
    let gapWidth = 100;//random(80, 120); // 空隙宽度可以根据需要调节
    this.gapLeft = xCenter - gapWidth / 2;
    this.gapRight = xCenter + gapWidth / 2;

    this.y = 0;
    this.h = 50;
    this.speed = 3;
  }

  show() {
    fill(0, 100, 255);
    noStroke();
    // 左侧障碍物
    rect(0, this.y, this.gapLeft, this.h);
    // 右侧障碍物
    rect(this.gapRight, this.y, windowWidth - this.gapRight, this.h);
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
