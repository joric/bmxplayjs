var BmxMachine = require('./BmxMachine');
var BmxConnection = require('./BmxConnection');
var BmxPattern = require('./BmxPattern');
var BmxSound = require('./BmxSound');
var ByteArray = require('./ByteArray');

var dlls = [];

dlls["_xi"] = require('./_xi');
dlls["_filter"] = require('./_filter');
dlls["_delay"] = require('./_delay');
dlls["_303"] = require('./_303');

var BmxPlay = function() {

	var SamplesPerSec = 44100; // usually 44100, but machines should support any rate from 11050 to 96000

	var PosInTick = 0; // [0..SamplesPerTick-1]
	var CurrentTick = 0;
	var TicksPerPattern = 0;

	var BeatsPerMin = 120;
	var TicksPerBeat = 4; // [1..32]
	var SamplesPerTick = ~~((60 * SamplesPerSec) / (BeatsPerMin * TicksPerBeat));
	var TicksPerSec = SamplesPerSec / SamplesPerTick; // (float)SPS / (float)SPT

	var machines = [];
	var connections = [];
	var mdata = [];

	var songsize = 0;
	var startloop = 0;
	var endloop = 0;

	var MT_MASTER = 0;
	var MT_GENERATOR = 1;
	var MT_EFFECT = 2;

	var snd = null;
	var soundChannel = null;

	var playing = false;
	var volume = 1.0;
	var songData = null;

	var BUFSIZE = SamplesPerSec;
	var buf = new Float32Array(BUFSIZE*2);
	var dataArray = new Uint8Array(BUFSIZE);

	var callback = null;

	function chr(c) {
		return String.fromCharCode(c);
	}

	function FCC(i) {
		return chr(i & 0xff) + chr((i >> 8) & 0xff) + chr((i >> 16) & 0xff) + chr((i >> 24) & 0xff);
	}

	function readArray(src, len) {
		var dest = new ByteArray();
		dest.length = len;
		if (dest.length > 0) {
			src.readBytes(dest, 0, dest.length);
		}
		return dest;
	}

	function readString(buf) {
		var res="";
		while (buf.position < buf.length) {
			var c = buf.readByte();
			if (c == 0) {
				break;
			}
			res += String.fromCharCode(c);
		}
		return res;
	}

	this.Load = function(bytes) {

		songData = bytes;

		machines = [];
		connections = [];
		mdata = [];

		var wasPlaying = playing;
		this.Stop();

		var data = new ByteArray(bytes);

		if (FCC(data.readInt()) != "Buzz") {
			return -1;
		}

		var numSections = data.readInt();

		for (var h = 0; h < numSections; ++h)
		{
			var fourcc = data.readInt();
			var offset = data.readInt();
			var size = data.readInt();
			var lastpos = data.position;
			var section = FCC(fourcc);

			data.position = offset;

			switch (section) {

				case "MACH":
					var numMachines = data.readShort();

					for (var i = 0; i < numMachines; ++i) {
						var name = readString(data);
						var type = data.readByte();
						var m = null;

						if (type == MT_MASTER) {
							m = new BmxMachine();
						} else {
							var dllname = readString(data);
							try {
								m = new dlls[dllname]();
							} catch(e) {
								console.log("Could not find class: " + dllname);
								break;
							}
						}

						m.xPos = data.readFloat();
						m.yPos = data.readFloat();

						var datalen = data.readInt();

						if (datalen>data.length) {
							console.log('machine data is too big, ' + datalen + ' bytes');
							return -1;
						}

						var msd = readArray(data, datalen);

						var numAttrs = data.readShort();

						for (var k = 0; k < numAttrs; ++k) {
							var attrName = readString(data);
							var attrValue = data.readInt();
						}

						m.GlobalVals = readArray(data, m.numGlobalParameters);
						var numTracks = data.readShort();
						m.TrackVals = readArray(data, m.numTrackParameters * numTracks);
						m.sources = 0;
						m.buf = null;
						m.patterns = [];
						m.events = [];
						machines.push(m);
						mdata.push(msd);
					}

				break;

				case "CONN":
					var numConnections = data.readShort();
					for (i = 0; i < numConnections; i++) {
						var c = BmxConnection();

						c.src = data.readShort();
						c.dst = data.readShort();
						c.amp = data.readShort();
						c.pan = data.readShort();

						connections.push(c);

						for (j = 0; j < machines.length; ++j) {
							if (c.dst == j)
								machines[j].sources++;
						}
					}
					break;

				case "PATT":
					var n = 0;
					for (i = 0; i < machines.length; i++) {
						var m = machines[i];

						var numPatterns = data.readShort();
						var tracks = data.readShort();

						for (var j = 0; j < numPatterns; j++) {
							var p = BmxPattern();

							p.numTracks = tracks;
							p.name = readString(data);
							p.numRows = data.readShort();

							for (k = 0; k < m.sources; ++k) {
								data.readShort();
								readArray(data, p.numRows * 2 * 2);
							}

							p.gdata = readArray(data, m.numGlobalParameters * p.numRows);
							p.tdata = readArray(data, m.numTrackParameters * p.numRows * p.numTracks);

							m.patterns.push(p);
						}
					}
					break;

				case "SEQU": 
					songsize = data.readInt();
					startloop = data.readInt();
					endloop = data.readInt();

					var numSequences = data.readShort();

					for (i = 0; i < numSequences; i++) {
						var iMachine = data.readShort();

						var m = machines[iMachine];

						var numEvents = data.readInt();
						var posSize = data.readByte();
						var evtSize = data.readByte();

						for (j = 0; j < numEvents; j++) {
							var pos = (posSize == 1) ? data.readByte() & 0xff : data.readShort();
							var event = (evtSize == 1) ? data.readByte() & 0xff : data.readShort();
							var rec = [pos, event];
							m.events.push(rec);
						}
					}
					break;

			}
			data.position = lastpos;
		}

		BeatsPerMin = machines[0].gp(2);
		TicksPerBeat = machines[0].gp(4);

		SamplesPerTick = ~~((60 * SamplesPerSec) / (BeatsPerMin * TicksPerBeat));

		PosInTick = 0;
		CurrentTick = 0;

		TicksPerSec = ~~(SamplesPerSec / SamplesPerTick);
		TicksPerPattern = 16;

		if (snd) {
			initMachines();
			BmxWorkBuffer(buf, BUFSIZE);
		}

		if (wasPlaying) {
			this.Play();
		}

		if (callback) {
			callback ( { pos:0, size:songsize } );
		}

		return 0;
	}

	function Tick(m, tick) {

		for (var i=0; i<m.events.length; ++i) {
			var evt = m.events[i];
			var pos = evt[0];
			var event = evt[1];

			if (pos == tick) {
				if (event >= 0x10) {
					m.currentPattern = event - 0x10;
					m.currentRow = 0;
					m.patternRows = m.patterns[m.currentPattern].numRows;
				}
			}
		}

		// fill pMasterInfo
		this.SamplesPerTick = SamplesPerTick;
		this.SamplesPerSec = SamplesPerSec;

		if (m.currentRow < m.patternRows) {
			m.loadValues(m.currentPattern, m.currentRow);
			m.Tick();
		}

		m.currentRow++;
	}

	function BmxSmartMix(out, ofs, size) {

		if (machines.length==0) {
			return;
		}
		
		var src;
		var dest;

		for (var j = 0; j<machines.length; ++j) {
			var m = machines[j];
			m.scount = m.sources;
			for (var i=0; i<m.buf.length; ++i) {
				m.buf[i] = 0;
			}
		}

		var machine = 0;

		while (machines[0].scount != 0) {

			if (machines[machine].scount != 0 || machines[machine].scount < 0) {

				//next, if cannot evaluate yet, or machine has been processed
				machine++;

			} else {

				var m = machines[machine];

				m.Work(m.buf, size, m.numChannels);

				for (var k = 0; k<connections.length; ++k) {

					var c = connections[k];
					var m1;

					if (c.src == machine) {

						m1 = machines[c.dst];

						//copy source to destination with corresponding amplitude and panning
						var amp = c.amp / 0x4000;
						var rpan = c.pan / 0x8000;
						var lpan = 1.0 - rpan;

						var lamp = amp * lpan;
						var ramp = amp * rpan;

						src = m.buf;
						dest = m1.buf;
						var i = size;

						var j;
						var n;

						if (m.numChannels == 1 && m1.numChannels == 1) {

							while (i--) {
								dest[i] += src[i] * amp;
							}

						} else if (m.numChannels == 1 && m1.numChannels == 2) {

							for (var i = 0, j = 0; i < size; i++) {
								dest[j++] += src[i] * lamp;
								dest[j++] += src[i] * ramp;
							}

						} else if (m.numChannels == 2 && m1.numChannels == 2) {

							for (var i = 0, j = 0; i < size*2; ) {
								dest[j++] += src[i++] * lamp;
								dest[j++] += src[i++] * ramp;
							}
						}
						
						m1.scount--;
					}
				}
				m.scount--;
				machine = 0;
			}
		}

		src = machines[0].buf;
		dest = out;

		for (var i = 0, j = ofs*2; i < size * 2;) {
			dest[j++] = NORM(src[i++]);
		}
	}

	function NORM(n) { 
		return (n<-32767) ? -32767 : ((n>32767) ? 32767 : n)
	};

	function BmxWorkBuffer(psamples, numsamples) {

		var portion = 0;
		var count = numsamples;
		var maxsize = 0;
		var ofs = 0;

		while (count != 0) {
			if (PosInTick == 0) {

				if (callback) {
					callback ( { pos:CurrentTick, size:songsize } );
				}

				for (var i=0; i<machines.length; ++i) {
					var m = machines[i];
					Tick(m, CurrentTick);
				}

				CurrentTick++;

				if (CurrentTick >= songsize) {
					CurrentTick = startloop;
				}
			}

			maxsize = SamplesPerTick - PosInTick;
			portion = count;

			if (portion > BUFSIZE) {
				portion = BUFSIZE;
			}

			if (portion > maxsize) {
				portion = maxsize;
			}

			PosInTick += portion;

			if (PosInTick == SamplesPerTick) {
				PosInTick = 0;
			}

			BmxSmartMix(psamples, ofs, portion);

			ofs += portion;
			count -= portion;
		}
	}

	this.SetCallback = function (fn) {
		callback = fn;
	}

	function sampleData(e) {
		var mastervolume = volume / 32767.0;
		for (var i = 0,j=0; i < BUFSIZE; i++) {
			e.data.getChannelData(0)[i] = buf[j++] * mastervolume;
			e.data.getChannelData(1)[i] = buf[j++] * mastervolume;
		}
		BmxWorkBuffer(buf, BUFSIZE);
	}

	function initSoundSystem() {
		snd = new BmxSound();
		SamplesPerSec = snd.GetSampleRate();
		BUFSIZE = snd.GetBufferSize();
		buf = new Float32Array(BUFSIZE*2);
		snd.addEventListener('sampleData', sampleData);
	}
	
	function initMachines() {
		for (var i=0; i<machines.length; ++i) {
			var m = machines[i];
			m.pMasterInfo = { SamplesPerSec:SamplesPerSec,  SamplesPerTick:SamplesPerTick };
			m.buf = new Float32Array(BUFSIZE*2);
			m.Init(mdata[i]);
			m.Tick();
		}
	}

	this.IsPlaying = function() {
		return playing;
	}

	this.Play = function() {
		if (!playing) {
			if (!snd) {
				try {
					initSoundSystem();
				} catch(e) {
					alert ("Web Audio is not supported");
					return;
				}
				initMachines();
				BmxWorkBuffer(buf, BUFSIZE);
			}
			playing = true;
			soundChannel = snd.play();
		}
		return playing;
	}

	this.Stop = function() {
		if (playing) {
			playing = false;
			soundChannel.stop();
		}
		return playing;
	}

	this.SetPos = function(pos) {
		if (snd) {
			CurrentTick = pos;
			PosInTick = 0;
			BmxWorkBuffer(buf, BUFSIZE);
		}
	}

	this.SetMasterVolume = function(vol) {
		volume = vol;
	}

	this.GetOscData = function(type, size, smooth) {

		if (dataArray.byteLength!=size) {
			dataArray = new Uint8Array(size);
		}
	
		if (snd) {
			snd.GetOscData(dataArray, type, size, smooth);
		}

		return dataArray;
	}

	this.Reload = function() {
		PosInTick = 0;
		CurrentTick = 0;
		this.Load(songData);

		if (!snd) {
			initMachines();
			BmxWorkBuffer(buf, BUFSIZE);
		}
	}

	var renderOffset = 0;
	var renderBuffer = null;
	var renderCallback = null;

	function renderThread() {
		for (var i=0; i < BUFSIZE*2 && renderOffset < renderBuffer.length; i++) {
			renderBuffer[renderOffset++] = buf[i];
		}

		var tail = (renderBuffer.length - renderOffset)/2;

		if (tail>0) {
			BmxWorkBuffer(buf, tail>=BUFSIZE ? BUFSIZE : tail);
			setTimeout (renderThread, 0);
		} else {
			renderCallback(renderBuffer);
		}
	}

	this.Render = function(fn, repeats) {
		renderCallback = fn;
		this.Stop();
		this.Reload();

		var channels = 2;
		var dataLen = SamplesPerTick * songsize * channels * (repeats ? repeats : 1);
		var headerLen = 23;
		renderBuffer = new Uint16Array(headerLen + dataLen);

		renderBuffer[0] = 0x4952; // "RI"
		renderBuffer[1] = 0x4646; // "FF"
		renderBuffer[2] = (2*dataLen + 15) & 0x0000ffff; // RIFF size
		renderBuffer[3] = ((2*dataLen + 15) & 0xffff0000) >> 16; // RIFF size
		renderBuffer[4] = 0x4157; // "WA"
		renderBuffer[5] = 0x4556; // "VE"
		renderBuffer[6] = 0x6d66; // "fm"
		renderBuffer[7] = 0x2074; // "t "
		renderBuffer[8] = 0x0012; // fmt chunksize: 18
		renderBuffer[9] = 0x0000; //
		renderBuffer[10] = 0x0001; // format tag : 1 
		renderBuffer[11] = channels; // channels: 2
		renderBuffer[12] = SamplesPerSec & 0x0000ffff; // sample per sec
		renderBuffer[13] = (SamplesPerSec & 0xffff0000) >> 16; // sample per sec
		renderBuffer[14] = (2*channels*SamplesPerSec) & 0x0000ffff; // byte per sec
		renderBuffer[15] = ((2*channels*SamplesPerSec) & 0xffff0000) >> 16; // byte per sec
		renderBuffer[16] = 0x0004; // block align
		renderBuffer[17] = 0x0010; // bit per sample
		renderBuffer[18] = 0x0000; // cb size
		renderBuffer[19] = 0x6164; // "da"
		renderBuffer[20] = 0x6174; // "ta"
		renderBuffer[21] = (2*dataLen) & 0x0000ffff; // data size[byte]
		renderBuffer[22] = ((2*dataLen) & 0xffff0000) >> 16; // data size[byte]

		renderOffset = headerLen;
		renderThread();
	}
};

module.exports = BmxPlay;
