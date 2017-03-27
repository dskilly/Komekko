var Discord = require("discord.js");
var pg = require("pg");
var bot = new Discord.Client;
var client = new pg.Client({
	user: 'user', //user
	password: ****, //password for postgres user
	database: 'dbName', //database name
	port: #### //port for the pg
});
client.connect();
var minute = 60000; //tracking time in miliseconds
var counter = [-1, -1];
var nextMin = -1;
var server = "server id here"; //replace the string content with the server id being tracked

bot.on("message", function(message) {
	tracker(message.timestamp, 0);
});

bot.on("serverNewMember", function(server, user) {
	tracker(server.detailsOfUser(user.id).joinedAt, 1);
});

bot.on("disconnected", function() {
	bot.loginWithToken("token");
});

//For RESTful API *IN PROGRESS*
var handleREST = function(data) {
	stats = fs.statSync('data.json');
	if(stats.isFile()) {
		var str = ',{"date":' + data.date + ',"msgs":' + data.msgs + ',"mems":' + data.mems + '}]',
		ws = fs.createWriteStream('data.json', { flags: 'r+', start: stats.size - 1 });
		ws.write(str);
	} else {
		var str = '[{"date":' + data.date + ',"msgs":' + data.msgs + ',"mems":' + data.mems + '}]',
		ws = fs.createWriteStream('data.json');
		ws.write(str);
	}
};

var rollback = function(client) {
	client.query('ROLLBACK', function() {
		client.end();
	});
};

//tracking function for events per minute
var tracker = function(eventTime, event) {
	//format to ISO 8601 date & time standard
	var date = new Date(eventTime);
	//determine string for event
	var msgStr = "messages"
	if(event == 1) msgStr = "new members";
	//check for first instance
	if(counter[event] < 0) {
		counter[event] = 1;
		counter[event % 1]++;
		nextMin = eventTime - (eventTime % minute) + minute; //set next minute tracker
		console.log("\#Tracking for " + msgStr + " has started...");
	} else {
		//if its been over a minute
		if(eventTime > nextMin) {
			var dMin = (eventTime - nextMin) / minute; //get how many minutes has spanned since last msg
			//if its been over 2 minutes
			if(dMin > 2) {
				var ndate = new Date(nextMin);
				insertQuery(utcFormat(ndate), counter[0], counter[1]);
				//enter counter into db and enter dead minutes into db
				for(var i = 1; i < dMin; i++) {
					nextMin += i * minute;
					//format to ISO 8601 date & time standard
					ndate = new Date(nextMin);
					//enter counter into db
					insertQuery(utcFormat(ndate), 0, 0);
				}
				nextMin += minute; //updatre nextMin tracker
				console.log("\#Tracker for " + msgStr + "\nLast active minute counter: " + counter[event] + "\nDead minutes spanned: " + dMin);
				counter[event] = 1;
				counter[event % 1] = 0;
			} else { //just over a minute
				//format to ISO 8601 date & time standard
				var ndate = new Date(nextMin);
				//enter counter into db
				insertQuery(utcFormat(ndate), counter[0], counter[1]);
				nextMin += minute; //update nextMin tracker
				console.log("\#Tracker for " + msgStr + "\nLast minute counter: " + counter[event]);
				counter[event] = 1; //reset counter
				counter[event % 1] = 0;
			}
		} else { //not a minute has passed
			counter[event]++; //increase counter
		}
	}
}

var utcFormat = function(date) {
	return date.getUTCFullYear() + '-' + checkLeadZero(date.getUTCMonth()) + '-' + checkLeadZero(date.getUTCDate()) + 'T' + checkLeadZero(date.getUTCHours()) + ':'+ checkLeadZero(date.getUTCMinutes()) + '-04:00';
};

var insertQuery = function(dateT, msgs, mems) {
	client.query('BEGIN', function(err) {
		if(err) return rollback(client);
		client.query('INSERT INTO rawdatagathering VALUES ($1, $2, $3)', [dateT, msgs, mems], function(err) {
			if(err) return rollback(client);
			client.query('COMMIT', function(err) {
				if(err) return rollback(client);
			});
		});
	});
};

var checkLeadZero = function(num) {
	if(num / 10 < 1) {
		return "0" + num;
	} else {
		return num + "";
	}
}

bot.loginWithToken("token"); //insert token for bot
