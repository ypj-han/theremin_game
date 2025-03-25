// parameters
let p = {
  keyPoints: true,
  skeleton: true,
  info: false,
};

// main variances
let volume = 0;
let pitch = 0;
let osc, playing, freq, amp;
let reverb;
let scaleNotes = [];
let scaleFreqs = [];
let noteDiffs = [2,3,4,5,6,7,9,11,12]; // Major b3 #4
let basicNote = 5; // F
// the HandPose model
// using https://docs.ml5js.org/#/reference/handpose
let model;
// latest model predictions
let predictions = [];
// video capture
let video;

let img;
function preload() {
  // initialize the model
  model = ml5.handPose(
    // model options
    {
      flipped: true, // mirror the predictions to match video
      maxHands: 2,
      modelType: "full",
    },
    // callback when loaded
    () => {
      console.log("🚀 model loaded");
    }
  );

  img = loadImage("theremin.png");
}

function cal_scaleNotes(){
  let note = basicNote;
  let i=0;
  let j=0;
  while(note < 119){
    note = basicNote+noteDiffs[i]+j*12;
    scaleNotes.push(note);
    scaleFreqs.push(midiToFreq(note));
    i++;
    if (i == noteDiffs.length) {
      i = 0;
      j++;
    }
    //console.log(note);  
  }
  //console.log(scaleNotes);
  console.log(scaleFreqs);
}

function quantizeToScale(freq,scale){
  let minDiff = Infinity;
  let quantizedFreq = freq;

  for (let noteFrq of scale) {
    let diff = Math.abs(freq-noteFrq);
    if (diff < minDiff) {
      minDiff = diff;
      quantizedFreq = noteFrq;
    }
  }

  return quantizedFreq;

}

function setup() {
  createCanvas(800, 600);

  // create an HTML video capture object
  // (flipped means the video is mirrored)
  video = createCapture(VIDEO, { flipped: true });
  video.size(width, height);
  // Hide the video element, and just show the canvas
  video.hide();

  // add params to Settings GUI
  createSettingsGui(p, { callback: paramChanged, load: false });

  // set the detection callback
  model.detectStart(video, (results) => {
    // console.log(`✋ ${results.length} hands detected`);
    predictions = results;
  });

  // setup sound
  osc = new p5.Oscillator();
  reverb = new p5.Reverb();
  osc.connect(reverb);
  cal_scaleNotes();

  //imageMode(CENTER);

}

function draw() {
  background("blue");
  image(video, 0, 0, width, height);

  // draw different parts of the prediction
  predictions.forEach((hand, i) => {
    if (p.keyPoints) drawKeypoints(hand, i);
    if (p.skeleton) drawSkeleton(hand, i);
    if (p.info) drawInfo(hand, i);
  });

  // debug info
  // drawFps();

  
  // process
  predictions.forEach((hand, i) => {
    process(hand, i);
  });


  image(img, 0, 0, 700, 700);
}

function process(hand, i){
  // get average position of all keypoints
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
  
  // get the main landmarks
  if (hand.handedness == "Left") {
    volume = (height-avg.y)/height;
  }
  if (hand.handedness == "Right") {
    let targetPitch = (avg.x - 300) * 1500 / 600 + 65;
    targetPitch = quantizeToScale(targetPitch, scaleFreqs);
    let targetNode = freqToMidi(targetPitch);
    fill(255);
    stroke(0);
    textSize(32);
    text("Notes: " + targetNode, width/2-100, 50);
    // 使用 lerp 让 pitch 平滑过渡到目标音高
    pitch = lerp(pitch, targetPitch, 0.1); // 0.1 控制变化速度，值越小越平滑
  }
  
  // console.log("Volume: ", volume);
  // console.log("Pitch: ", pitch);
  if (playing) {
    osc.amp(volume);
    osc.freq(pitch);
  }
}



const colours = [
  "Red",
  "OrangeRed",
  "Gold",
  "Lime",
  "Turquoise",
  "DodgerBlue",
  "Blue",
  "DarkMagenta",
];

// Draw dots for all detected landmarks
function drawKeypoints(hand, i) {
  const c = color(colours[i % colours.length]);
  fill(c);
  noStroke();

  hand.keypoints.forEach((kp) => {
    circle(kp.x, kp.y, 10);
  });

}

// Draw lines between certain main keypoints
function drawSkeleton(hand, i) {
  const c = color(colours[i % colours.length]);
  stroke(c);
  strokeWeight(2);
  noFill();

  // get lookup table for connections
  const connections = model.getConnections();

  connections.forEach((c) => {
    const [i, j] = c;
    const a = hand.keypoints[i];
    const b = hand.keypoints[j];
    line(a.x, a.y, b.x, b.y);
  });
}

function drawInfo(hand, i) {
  // get average position of all keypoints
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

  const c = color(colours[i % colours.length]);
  stroke("white");
  strokeWeight(4);
  fill(c);

  // draw information
  textAlign(CENTER, CENTER);
  textSize(32);
  text(hand.handedness, avg.x, avg.y);
  text(hand.confidence.toFixed(2), avg.x, avg.y + 36);

}



function drawFps() {
  // calculate FPS
  let fps = frameRate();
  fill(255);
  stroke(0);
  text("FPS: " + fps.toFixed(2), 10, height - 10);
}

function keyPressed() {
  // dump the predictions to the console
  if (key == " ") {
    console.log(predictions);
    osc.amp(0.5);
    osc.freq(440);
    osc.start();
    playing = true;
  }
}

// global callback from the settings GUI
function paramChanged(name) {}
