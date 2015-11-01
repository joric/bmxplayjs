var fs = require('fs');
var BmxPlay = require('./src/BmxPlay.js');

var p = new BmxPlay();

var songName = 'default.bmx';

p.Load(fs.readFileSync('./songs/'+songName).toString('binary'));

p.SetCallback(function(e) {
	process.stderr.write( 'Rendering: ' + ~~((e.pos+1)*100/e.size) + '%\r');
});

p.Render(function(data) {
	var filename = songName.replace(".bmx",".wav");
	fs.writeFileSync(filename, new Buffer(data.buffer));
});

