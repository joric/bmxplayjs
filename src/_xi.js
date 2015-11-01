var BmxMachine = require('./BmxMachine');

_xi.prototype = Object.create(BmxMachine.prototype);
_xi.prototype.constructor=_xi;

function _xi() {
	this.type = 1;
	this.numGlobalParameters = 0;
	this.numTrackParameters = 1;
	this.numChannels = 1;

	var note;

	var datasize;
	var samplesize;
	var loopstart;
	var looplength;
	var volpts;
	var volflg;
	var sampletype;
	var compression;
	var relnote;
	var finetune;
	var volenv;
	var wave;
	var freq;
	var basefreq;
	var sn;
	var dsn;
	var a;
	var ta;
	var da;
	var tick;
	var last_tick;
	var env_index;
	var tps;
	var sndf;
	var play;

	this.Init = function(msd) {

		note = 0;
		samplesize = 0;
		play = false;
		sn = -1;
		basefreq = 261.7;
		volpts = 0;

		volenv = [];
		wave = null;

		if (msd && msd.length) {
			datasize = msd.readInt();
			samplesize = msd.readInt();
			loopstart = msd.readInt();
			looplength = msd.readInt();
			volpts = msd.readByte();

			for (var k = 0; k < 12; k++) {
				volenv.push( { x : msd.readShort(), y : msd.readShort() } );
			}

			volflg = msd.readByte();
			sampletype = msd.readByte();
			compression = msd.readByte();
			relnote = msd.readByte();
			finetune = msd.readByte();

			//skip pointers
			msd.readInt();
			msd.readInt();

			wave = new Int8Array(samplesize);

			if (compression == 1) { //4-bit
				for (var i = 0; i < samplesize/2; ++i) {

					if (msd.bytesAvailable == 0) {
						break;
					}

					var b = msd.readByte();
					var b1 = (b & 0x0f) << 4;
					var b2 = (b & 0xf0);
					wave[i * 2 + 0] = b1 > 127 ? b1 - 256 : b1;
					wave[i * 2 + 1] = b2 > 127 ? b2 - 256 : b2;
				}
			} else {
				for (var i = 0; i < samplesize; ++i) {
					wave[i] = msd.readByte();
				}
			}
		}
	}

	this.Tick = function() {
		note = this.tp(0, note);

		if (note != 0) {
			freq = this.getFreq(note);
			sn = 0;
			dsn = ~~(freq * 256.0 / basefreq);
			this.startenv();
			play = true;
		}
	}

	this.Work = function(psamples, numsamples, channels) {
		if (basefreq == 0 || sn == -1) {
			return false;
		}

		for (var i = 0; i < numsamples; ++i) {

			var index = ~~(sn / 256);

			if (index < samplesize-1 && play) {

				var a1 = wave[index];
				var a2 = wave[index + 1];

				a = (a1 * 256) + (a2 - a1) * (sn & 0x000000ff);

				psamples[i] = sampletype==0 ? a : a * nextenv();

				sndf = (sn + dsn) / 256;

				//forward loop
				if (sampletype == 1) {
					if (sndf >= loopstart + looplength) {
						sn = loopstart * 256;
					}
				}

				//pingpong loop
				if (sampletype == 2) {
					if (sndf >= loopstart + looplength-1) {
						dsn = -dsn;
					} else if (sndf <= loopstart && dsn < 0) {
						dsn = -dsn;
					}
				}

			} else {
				psamples[i] = 0;
			}

			sn += dsn;
		}
		return true;
	}

	this.startenv = function() {
		if (volpts == 0) {
			return 0;
		}

		da = 0;
		tick = 0;
		last_tick = -1;
	
		//6 - xi's proprietary magnifier
		tps = 6.0 / this.pMasterInfo.SamplesPerTick;

		ta = volenv[0].y / 64.0;
		env_index = 0;
	}
	
	function nextenv() {
		if (volpts == 0) {
			return 0;
		}

		var i = env_index;

		if (i == volpts) {
			play = false;
			return 0;
		}

		var k = volenv[i].x;

		tick += tps;

		if (tick >= k && last_tick < k) {
			k = volenv[i+1].x;
			var y = volenv[i+1].y / 64.0;
			da = (y - ta) * tps / (k - tick);
			env_index++;
		} else {
			ta += da;
		}

		last_tick = tick;

		return ta;
	}
}

module.exports = _xi;
