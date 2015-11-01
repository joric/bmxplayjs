var BmxMachine = require('./BmxMachine');

_303.prototype = Object.create(BmxMachine.prototype);
_303.prototype.constructor=_303;

function _303() {
	this.type = 1;
	this.numGlobalParameters = 6;
	this.numTrackParameters = 3;
	this.numChannels = 1;

	var tune;
	var cutoff;
	var resonance;
	var envmod;
	var decay;
	var accent;

	var note;
	var slide;
	var endnote;

	var s;
	var f;
	var q;
	var mf;
	var mq;
	var freq;
	var freq1;
	var dfreq;
	var a;
	var da;
	var smax;
	var dsmax;
	var df;
	var amp;
	var damp;
	var pos;
	var fdecay;
	var f0;
	var buf0;
	var buf1;

	this.Init = function (msd) {
		tune = 0x40;
		cutoff = 0x40;
		resonance = 0x0;
		envmod = 0x0;
		decay = 0x40;
		accent = 0x0;

		note = 0;
		slide = 0;
		endnote = 0;
	}

	this.Tick = function () {

		tune = this.gp(0, tune);
		cutoff = this.gp(1, cutoff);
		resonance = this.gp(2, resonance);
		envmod = this.gp(3, envmod);
		decay = this.gp(4, decay);
		accent = this.gp(5, accent);

		note = this.tp(0, note);
		slide = this.tp(1, slide);
		endnote = this.tp(2, endnote);

		fdecay = decay / 128.0;

		if (note != 0) {
			freq = this.getFreq(note + tune - 0x40);

			if (freq != 0) {
				//init saw generator
				s = 0;
				a = -32767.0;

				smax = this.pMasterInfo.SamplesPerSec / freq;
				dsmax = 0.0;

				amp = 1;
				damp = - ( 1.0 / this.pMasterInfo.SamplesPerTick * fdecay);

				dfreq = 0;
				da = 65536.0 / smax;

				f = mf;
				q = mq;

				buf0 = 0;
				buf1 = 0;

				df = damp * f;
				f0 = f;
			}
		}

		if (endnote != 0) {
			freq1 = this.getFreq(endnote + tune - 0x40);

			if (freq != 0 && slide != 0) {
				var smax1 = this.pMasterInfo.SamplesPerSec / freq1;
				var ispt = 1.0 / this.pMasterInfo.SamplesPerTick / slide;
				dsmax = (smax1 - smax) * ispt;
				damp = -ispt;
				df = damp * f;
			}
		}

		mf = cutoff / 128.0 * 0.98 + 0.1;
		mq = resonance / 128.0 * 0.88;
	}

	this.Work = function(psamples, numsamples, channels) {
		if (freq==0) {
			return false;
		}

		for (var i = 0; i < numsamples; ++i) {
			if (amp > 0) {
				var pin = a * amp;

				//set feedback amount given f and q between 0 and 1
				var fb = q + q / (1.0 - f);

				//for each sample...
				buf0 = buf0 + f * (pin - buf0 + fb * (buf0 - buf1));
				buf1 = buf1 + f * (buf0 - buf1);

				f += df;
				psamples[i] = buf1;

				//calculating saw
				smax += dsmax; // period slide
				s++;

				if (s >= smax) {
					s = 0;
					a = -32767.0;
				}

				a += da;
				amp += damp;

			} else {
				psamples[i] = 0;
			}
		}
		return true;
	}
}

module.exports = _303;
