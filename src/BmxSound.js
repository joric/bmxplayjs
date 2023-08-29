// Sound class, as in flash.media.Sound

var WorkerTimer = require('worker-timer');

function BmxSound() {

  var playing = false;
  var callback = null;
  var oscType = 1;

  var audioCtx = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 44100});
  var analyser = audioCtx.createAnalyser();

  var BUFSIZE = audioCtx.sampleRate/4;
  var frameCount = BUFSIZE * 2.0;

  var buffers = 3;
  var channels = 2;

  var buf = [];
  var nodes = [];

  var prerender = true;

  for (var i=0; i<buffers; i++) {
    buf[i] = audioCtx.createBuffer(channels, frameCount, audioCtx.sampleRate);
    nodes[i] = audioCtx.createBufferSource();
  }

  var i = 0;

  nodes[i] = audioCtx.createBufferSource();
  nodes[i].buffer = buf[i];

  var tickPeriod = BUFSIZE/audioCtx.sampleRate;
  var nextTime = audioCtx.currentTime;

  function update() {

    var time = audioCtx.currentTime;

    if (time>=nextTime) {
      nextTime = nextTime + tickPeriod;

      nodes[i].connect(audioCtx.destination);
      nodes[i].connect(analyser);
      nodes[i].start(nextTime);

      i = (i+1) % buffers;

      nodes[i] = audioCtx.createBufferSource();
      callback( { data: buf[i] } );
      nodes[i].buffer = buf[i];
    }
  }

  this.addEventListener = function(event, fn) {
    callback = fn;
  }

  var timer;

  this.play = function() {

    if (!playing) {
      playing = true;
      nextTime = audioCtx.currentTime;
      timer = WorkerTimer.setInterval(update, 125);
    }

    return {
      stop: function() {
        playing = false;
        WorkerTimer.clearInterval(timer);
      }
    }
  }

  this.GetSampleRate = function() {
    return audioCtx.sampleRate;
  }

  this.GetBufferSize = function() {
    return BUFSIZE;
  }

  this.GetOscData = function(dataArray, oscType, size, smooth) {
    size = Math.pow(2, Math.round(Math.log(size) / Math.log(2)));
    analyser.fftSize = size;
    if (smooth) {
      analyser.smoothingTimeConstant = smooth; // 0.8 by default
    }
    oscType==1 ? analyser.getByteFrequencyData(dataArray) : analyser.getByteTimeDomainData(dataArray);
  }
}

module.exports = BmxSound;
