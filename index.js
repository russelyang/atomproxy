
var cluster = require('cluster');
var numCPUs = require('os').cpus().length / 2;

/**
force to single process to enable share the same copy of cache
**/
if (cluster.isMaster) {
	for(var i=0; i<1; i++) {
		cluster.fork();
	}
} else {
	var express = require('express');
	var app = express();
	var fetch = require('node-fetch');
	var https = require('https');
	var fs = require('fs');
	var privateKey  = fs.readFileSync('sslcert/localapp.key', 'utf8');
	var certificate = fs.readFileSync('sslcert/localapp.crt', 'utf8');
	var credentials = {key: privateKey, cert: certificate};

	var friendCommonGamesCache = {};

	var compression = require('compression');
	var _ = require('underscore');

	var allowCrossDomain = function(req, res, next) {
	    res.header('access-control-allow-origin', '*');
	    res.header('access-control-allow-credentials', 'true');
	    res.header('access-control-allow-methods', 'GET,OPTIONS,DELETE');
	    res.header('access-control-allow-headers', 'accept,authToken,X-Forwarded-For,X-Origin-Platform,locale,MultiplayerId,Origin-ClientIp,Content-Type,Origin,Authorization');
	    // intercept OPTIONS method, can enable browser cache
	    if ('OPTIONS' == req.method) {
	      res.sendStatus(200);
	    }
	    else {
	      next();
	    }
	};

	app.use(allowCrossDomain);
	app.use(compression());

	/**
	* provide C like sprintf to javascript script
	**/
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

	/**
	* convert xml to a json object
	* return a promise which can resolve as a json object
	**/
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

	/**
	* convert json object to xml string
	* return a promise can resolve as a xml string
	**/
	function toXml(json) {
		return new Promise(function(resolve, rejecct) {
			var xml2js = require('xml2js');
			var builder = new xml2js.Builder({renderOpts: {pretty : false}});
			var xml = builder.buildObject(json);
			resolve(xml);
		});	
	}

	/**
	* fetch the http request and return a promise can be resolved as a json object.
	**/
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
		}).then( function(xml) {
			return toJson(xml);
		});
	}

	var datapoint = ["https://integration.api1.origin.com",
					 "https://integration.api2.origin.com",
					 "https://integration.api3.origin.com",
					 "https://integration.api4.origin.com"];

	app.get('/atom/users/:userId/commonGames', function (req, res) {
		var userId = req.params.userId;
		var friendIds = req.query.friendIds.split(",");
		var authToken = req.get("authToken");

		if(friendCommonGamesCache[userId] == undefined) {
			friendCommonGamesCache[userId] = {};	
		}

		var cachedFriendIds = Object.keys(friendCommonGamesCache[userId]);
		
		var requestFriendIds = _.difference(friendIds,cachedFriendIds);
		var requestFromCacheFriendIds = _.intersection(friendIds, cachedFriendIds);

		res.set("content-type", "text/xml; charset=UTF-8");

		var promises = [],
			batchSize = 5,
			batch = 0,
			requestFriendIdsSet = [];
			fids = [];

		console.log("load from server = " + requestFriendIds.length);
		while(requestFriendIds.length > 0) 
		{
			requestFriendIdsSet.push(requestFriendIds.splice(0, batchSize));
		}
		requestFriendIdsSet.forEach(function (ids) {
            promises.push(buildFetchPromise(datapoint[batch++], userId, ids, authToken));
            if (batch == 4) {
                batch = 0;
            }
        });

		console.log("load from cache = " + requestFromCacheFriendIds.length);
		requestFromCacheFriendIds.forEach(function (friendId) {
            promises.push(new Promise(function (resolve) {
                var output = {
                    users: {
                        user: []
                    }
                };
                output.users.user.push(friendCommonGamesCache[userId][friendId]);
                resolve(output);
            }));
        });

		Promise.all(promises).then(function(jsons) {
			var output = {
				users: {
					user : []
				}
			};
			var error = null;
			jsons.forEach(function (json) {
                if (json && json.users && json.users.user) {
                    json.users.user.forEach(function (ele) {
                        return output.users.user.push(ele);
                    });
                } else {
                    error = json
                }
            });
			if (!error) {
				output.users.user.forEach(function (user) {
                    friendCommonGamesCache[userId][user.userId[0]] = user;
                });
				//res.set("cache-control", "max-age=86400");
			}
			return error !== null ? toXml(error) : toXml(output);
		}).then(function (xml) {
            res.send(xml);
        });
	});

	app.get("/atom/users/:userId/commonGame" , function(request, response) {
		var userId = request.params.userId,
			masterTitleId = request.query.masterTitleId,
			multiPlayerId = request.query.multiPlayerId,
			authToken = request.get("authToken");	

		var cache = friendCommonGamesCache[userId], 
			friendIds = Object.keys(cache);

		var commonGameFriends  = friendIds.filter(function(friendId) {
			var games = cache[friendId].games;
			if (_.isObject(games[0])) {
				var game = games[0].game;	
				return game && game.filter(function (g) {
                        return g.masterTitleId.indexOf(masterTitleId) > -1 &&
                            g.multiPlayerId.indexOf(multiPlayerId) > -1;
                    }).length > 0;
			}
		});

		var output = {
			"userId" : userId,
			"masterTitleId" : masterTitleId,
			"multiPlayerId" : multiPlayerId,
			"commonGameFriends" : commonGameFriends
		}


		response.set("content-type", "application/json; charset=UTF-8");
		response.send(output);
	})

	app.post('/flush', function(request, response) {
		fs.writeFileSync("friendCommonGamesCache.json", JSON.stringify(friendCommonGamesCache));
		response.send("OK");
	});


	app.post('/load', function(request, response) {
		if(fs.existsSync('friendCommonGamesCache.json')) {
			friendCommonGamesCache = JSON.parse(fs.readFileSync("friendCommonGamesCache.json"));
		}
		response.send("OK");
	});

	app.get("/v1/recommendations/:userId/friends",
		function(request, response) {
            response.set("content-type", "application/json; charset=UTF-8");
			var recResponse = require("./recFriends.response.int");
			response.send(recResponse);
		}
	);

	app.delete('/v1/recommendations/:userId/friends/:disableUserId', function(request, response) {
        response.send("OK");
    });

	var httpsServer = https.createServer(credentials, app);

	httpsServer.listen(3000, function () {
	  console.log('atom proxy app listening on port 3000!');
	});	
}
