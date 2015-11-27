var fs = require('fs');
var BmxPlay = require('./src/BmxPlay.js');
var p = new BmxPlay();
var songName = 'default.bmx';

p.SetCallback(function(e) {
	process.stderr.write( 'Rendering: ' + ~~((e.pos+1)*100/e.size) + '%\r');
});

p.Load(fs.readFileSync('./songs/'+songName).toString('binary'));

p.Render(function(data) {
	fs.writeFileSync(songName.replace(".bmx",".wav"), new Buffer(data.buffer));
});

