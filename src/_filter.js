var BmxMachine = require('./BmxMachine');

_filter.prototype = Object.create(BmxMachine.prototype);
_filter.prototype.constructor=_filter;

function _filter() {
  this.type = 1;
  this.numGlobalParameters = 3;
  this.numTrackParameters = 0;
  this.numChannels = 1;

  var param1;
  var param2;
  var param3;

  var f;
  var q;
  var d;
  var buf0;
  var buf1;
  var k;

  this.Init = function(msd) {
    param1 = 0x80;
    param2 = 0;
    param3 = 0;
    buf0 = 0;
    buf1 = 0;
    k = 44100.0 / this.pMasterInfo.SamplesPerSec;
  }

  this.Tick = function() {
    param1 = this.gp(0, param1);
    param2 = this.gp(1, param2);
    param3 = this.gp(2, param3);

    f = param1 / 128.0 * 0.99 * k;
    q = param2 / 128.0 * 0.98 * k;
    d = param3 / 128.0 * k;
  }

  this.Work = function(psamples, numsamples, channels) {
    for (var i = 0; i < numsamples; ++i) {
      var pin = psamples[i];

      //set feedback amount given f and q between 0 and 1
      var fb = q + q / (1.0 - f);

      //for each sample...
      buf0 = buf0 + f * (pin - buf0 + fb * (buf0 - buf1));
      buf1 = buf1 + f * (buf0 - buf1);

      psamples[i] = buf1;

      // distortion
      if (d != 0) {
        var amp = 1.0 / (1.0 - d);
        var a = psamples[i];
        a *= amp;

        if (a > 32767) {
          a = 32767;
        } else if (a < -32767) {
          a = -32767;
        }

        psamples[i] = a;
      }
    }
    return true;
  }
}

module.exports = _filter;
