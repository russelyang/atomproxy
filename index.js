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

function buildFetchPromise(datapoint, userId, friendIds, authToken) {
	return fetch("{0}/atom/users/{1}/commonGames?friendIds={2}".format( 
		datapoint, 
		userId, 
		friendIds.join(",")), 
		{
			headers: {
				"authToken" : authToken
			}
		}).then(function(body) {
		return body.text();
	}).then( xml => toJson(xml));
}

var datapoint = ["https://integration.api1.origin.com",
				 "https://integration.api2.origin.com",
				 "https://integration.api3.origin.com",
				 "https://integration.api4.origin.com"];

app.get('/atom/users/:userId/commonGames', function (req, res) {
	var userId = req.params.userId;
	var friendIds = req.query.friendIds.split(",");
	var authToken = req.get("authToken");

	var promises = [],
		batch = 0;
		fids = [];

	for(var i=0; i< friendIds.length; i++) {
		if (fids.length < 5) {
			fids.push(friendIds[i]);
		} 
		if (fids.length == 5) {
			var fp = buildFetchPromise(datapoint[batch], userId, fids, authToken);
			promises.push(fp);
			batch++;
			if (batch == 3) {
				batch = 0;
			}
			fids = [];
		}
	}

	//console.log(promises);

	Promise.all(promises).then(function(jsons) {
		console.log(jsons);
	});
	//console.log(friendIds);
	///Promise.all(promises).then(all => console.log(all));
	
	buildFetchPromise(datapoint[0], userId, friendIds, authToken)
		.then(json => toXml(json)).then(xml => res.send(xml));


  	//res.send('Hello World!' + userId + 'friendIds: ' + friendIds + "authToken: " + authToken );
});

app.listen(3000, function () {
  console.log('atom proxy app listening on port 3000!');
});

