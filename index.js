var express = require('express');
var app = express();

var fetch = require('node-fetch');

if (!String.prototype.format) {
    String.prototype.format = function() {
        var str = this.toString();
        if (!arguments.length)
            return str;
        var args = typeof arguments[0],
            args = (("string" == args || "number" == args) ? arguments : arguments[0]);
        for (arg in args)
            str = str.replace(RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
        return str;
    }
}

function toJson(xml) {
	return new Promise(function(resolve, rejecct) {
		var parseString = require('xml2js').parseString; 
		parseString(xml, function(err, result) {
			console.log(err);
			console.log(result);
			if (!err) {
				resolve(result);
			} else {
				rejecct(err);
			}
		});
	});
}

function toXml(json) {
	return new Promise(function(resolve, rejecct) {
		var xml2js = require('xml2js');
		var builder = new xml2js.Builder({renderOpts: {pretty : false}});
		var xml = builder.buildObject(json);
		resolve(xml);
	});	
}

var datapoint = ["https://integration.api4.origin.com"];

app.get('/atom/users/:userId/commonGames', function (req, res) {
	var userId = req.params.userId;
	var friendIds = req.query.friendIds.split(",");
	var authToken = req.get("authToken");

	//console.log(friendIds);

	fetch("{0}/atom/users/{1}/commonGames?friendIds={2}".format( 
		datapoint[0], 
		userId, 
		friendIds.join(",")), 
		{
			headers: {
				"authToken" : authToken
			}
		})
	.then(function(body) {
		return body.text();
	}).then( xml => toJson(xml)).then(json => toXml(json)).then(xml => res.send(xml));

  	//res.send('Hello World!' + userId + 'friendIds: ' + friendIds + "authToken: " + authToken );
});

app.listen(3000, function () {
  console.log('atom proxy app listening on port 3000!');
});

