var ByteArray = require('./ByteArray');

function BmxMachine() {
	this.type = 0;
	this.numGlobalParameters = 5;
	this.numTrackParameters = 2;
	this.numChannels = 2;

	this.pMasterInfo = null;
	this.xPos = 0;
	this.yPos = 0;
	
	this.buf = null;
	this.sources = 0;
	this.scount = 0;

	this.patterns = [];
	this.events = [];

	this.GlobalVals = new ByteArray();
	this.TrackVals = new ByteArray();
}

BmxMachine.prototype.Init = function(msd) {
}

BmxMachine.prototype.Tick = function() {
}

BmxMachine.prototype.Work = function(psamples, numsamples, channels) {
}

BmxMachine.prototype.getFreq = function(note) {
	if (note != 0xFF && note > 0) {
		var l_Note = ((note >> 4) * 12) + (note & 0x0f) - 70;
		return 440.0 * Math.pow(2.0, l_Note / 12.0);
	} else {
		return 0;
	}
}

BmxMachine.prototype.getByte = function(src, ofs, def) {

	if (src==null || ofs >= src.length) {
		return def;
	}
	var value = src.bytes.charCodeAt(ofs) & 0xff;
	return value==255 ? def : value;
}

BmxMachine.prototype.gp = function(ofs, def) {
	return BmxMachine.prototype.getByte(this.GlobalVals, ofs, def);
}

BmxMachine.prototype.tp = function(ofs, def) {
	return BmxMachine.prototype.getByte(this.TrackVals, ofs, def);
}

BmxMachine.prototype.loadValues = function(pattern, row) {
	if (this.patterns == null || this.patterns.length <= pattern) {
		return;
	}
	var p = this.patterns[pattern];
	p.gdata.position = row * this.numGlobalParameters;
	p.gdata.readBytes(this.GlobalVals, 0, this.numGlobalParameters);
	p.tdata.position = row * this.numTrackParameters;
	p.tdata.readBytes(this.TrackVals, 0, this.numTrackParameters * p.numTracks);
}

module.exports = BmxMachine;
