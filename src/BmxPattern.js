var ByteArray = require('./ByteArray');

function BmxPattern() {
	return {
		numRows: 0,
		numTracks: 0,
		gdata: new ByteArray(),
		tdata: new ByteArray(),
		sdata: new ByteArray()
	}
}

module.exports = BmxPattern;
