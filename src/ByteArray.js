// ByteArray class, as in flash.utils.ByteArray

function ByteArray(bytes) {
	this.bytes = bytes || "";
	this.length = this.bytes.length;
	this.position = 0;
}

ByteArray.prototype.bytesAvailable = function() {
	return this.length-this.position;
}

ByteArray.prototype.readByte = function() {
	var b = this.bytes.charCodeAt(this.position++) & 0xff;
	return b > 127 ? b - 256 : b; // signed byte
}

ByteArray.prototype.readBytes = function(count) {
	var res = "";
	for (var i = 0; i<count; i++) {
		res += String.fromCharCode(this.readByte());
	}
	return res;
}

ByteArray.prototype.readBytes = function(dest, ofs, count) {
	dest.bytes = "";
	for (var i = 0; i<count; i++) {
		dest.bytes += String.fromCharCode(this.readByte());
	}
	return dest;
}

ByteArray.prototype.readInt = function() {
	return (this.readByte() & 0xFF)
		| ((this.readByte() & 0xFF) << 8 )
		| ((this.readByte() & 0xFF) << 16 )
		| ((this.readByte() & 0xFF) << 24);
}

ByteArray.prototype.readShort = function() {
	return ((this.readByte() & 0xFF))
		| ((this.readByte() & 0xFF) << 8);
}

ByteArray.prototype.readFloat = function() {
	var x = this.readInt();
	var sign = (x & 0x80000000) ? -1 : 1;
	var exponent = ((x >> 23) & 0xFF) - 127;
	var base = (x & ~(-1 << 23));
	if (exponent == 128) {
		return sign * ((base) ? Number.NaN : Number.POSITIVE_INFINITY);
	}
	if (exponent == -127) {
		if (base == 0) return sign * 0.0;
		exponent = -126;
		base /= (1 << 22);
	} else {
		base = (base | (1 << 23)) / (1 << 23);
	}
	return sign * base * Math.pow(2, exponent);
}

module.exports = ByteArray;
