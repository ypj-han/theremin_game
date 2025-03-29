// main variances
let volume = 0;
let pitch = 0;
let osc, playing, freq, amp;
let reverb;
let scaleNotes = [];
let scaleFreqs = [];
let noteDiffs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // Major b3 #4
let basicNote = 1; // F

// the HandPose model
let model;
let predictions = [];
let video;

// flappy bird game
let bird;
let pipes = [];
let bg;

// midi
let bpm = 80;

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
  
  // sound
  osc = new p5.Oscillator();
  reverb = new p5.Reverb();
  osc.connect(reverb);
  cal_scaleNotes();

  // game
  bird = new Bird();
  pipes.push(new Pipe());

}

function draw() {

  // brackground
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

  // draw hands
  predictions.forEach((hand, i) => {
    drawKeypoints(hand, i);
    drawSkeleton(hand, i);
  });

  predictions.forEach((hand, i) => {
    process(hand, i);
  });

  // 控制鸟的高度和大小
  bird.x = map(pitch, 220, 1200, 0, windowWidth, true);
  bird.r = map(volume, 0, 1, 0, 30);

  bird.show();
  bird.update();

  // 管道逻辑
  if (frameCount % 60 === 0) {
    pipes.push(new Pipe());
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].speed = 10;
    pipes[i].show();
    pipes[i].update();

    if (pipes[i].offscreen()) {
      pipes.splice(i, 1);
    }
  }
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
        volume = constrain(openness / 200, 0, 2);
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

// Pipe 类
class Pipe {
  constructor() {
    this.left = random(windowWidth / 6, windowWidth / 2);
    this.right = windowWidth - this.left - random(100, 200);
    this.y = 0;
    this.h = 50;
    this.speed = 3;
  }

  show() {
    fill(0, 100, 255);
    noStroke();
    rect(0, this.y, this.left, this.h);
    rect(windowWidth - this.right, this.y, this.right, this.h);
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
