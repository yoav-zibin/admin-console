var main;
(function (main) {
    main.urlParams = createUrlParams();
    main.gameId = main.urlParams["gameId"];
    main.recentlyConnected = [];
    function db() { return firebase.database(); }
    function getPath(path) { return main.gameId + '/' + path; }
    function dbRef(path) { return db().ref(getPath(path)); }
    function onValue(ref, callback) {
        ref.on('value', getFirebaseCallback(ref, callback));
    }
    function onceValue(ref, callback) {
        ref.once('value').then(getFirebaseCallback(ref, callback));
    }
    function getFirebaseCallback(ref, callback) {
        return function (snap) {
            var val = snap.val();
            console.info("Firebase value changed for path: ", getRefPath(ref), "val:", val);
            callback(val);
            main.$rootScope.$apply();
        };
    }
    function getRefPath(ref) {
        // ref.toString() returns:
        // "https://platform-eb07a.firebaseio.com/users/12345"
        // ref.key only returns the last part of the path, i.e., "12345".
        var path = ref.toString();
        // remove "https://" (length 8) from path:
        path = path.substr(8);
        // remove domain from path
        path = path.substring(path.indexOf('/'));
        return path;
    }
    function getAvatar(player) {
        return replaceToHttps(player.avatarImageUrl);
    }
    main.getAvatar = getAvatar;
    function replaceToHttps(url) {
        return replacePrefix(url, "http:", "https:");
    }
    main.replaceToHttps = replaceToHttps;
    function replacePrefix(url, from, to) {
        return !url ? url : url.indexOf(from) === 0 ? to + url.substr(from.length) : url;
    }
    function createUrlParams() {
        var query = location.search.substr(1);
        var result = {};
        query.split("&").forEach(function (part) {
            var item = part.split("=");
            result[item[0]] = decodeURIComponent(item[1]);
        });
        return result;
    }
    function handleRecentlyConnected(bucketToPlayerInfo) {
        main.recentlyConnected = [];
        var playerIdsToWatch = [];
        for (var bucket in bucketToPlayerInfo) {
            var playerInfo = bucketToPlayerInfo[bucket];
            main.recentlyConnected.push(playerInfo);
        }
    }
    function addFirebaseListeners() {
        console.log('addFirebaseListeners');
        onValue(dbRef('recentlyConnected'), handleRecentlyConnected);
    }
    function callAppEngine(msgs, callback) {
        main.$http({
            method: 'POST',
            url: "https://multiplayer-gaming.appspot.com/msg/admin",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
            },
            data: angular.toJson(msgs)
        }).then(function (response) {
            console.log("AppEngine returns: ", response);
            callback(response.data);
        }, function (response) {
            console.error("AppEngine had an error: ", response);
        });
    }
    function signin(customToken) {
        // You must run on localhost for this to work, so run:
        // sudo npm install http-server -g
        // http-server -a 127.0.0.1 -p 8888
        // and surf to:
        // http://localhost:8888/index.html?gameId=...&gameDeveloperPassword=...
        firebase.auth().signInWithCustomToken(customToken).then(function () {
            console.info("firebase.auth success!", arguments);
            addFirebaseListeners();
        }).catch(function (error) {
            console.error("firebase.auth Failed!", arguments);
        });
    }
    function createFirebaseAuthAdminCustomToken() {
        callAppEngine([{ getFirebaseAdminAuthToken: {
                    gameDeveloperPassword: main.urlParams["gameDeveloperPassword"],
                    gameId: main.gameId,
                } }], function (responseArr) { return signin(responseArr[0].firebaseAuthToken); });
    }
    function init() {
        // Initialize Firebase
        var config = {
            apiKey: "AIzaSyBpF9wm6N34DevJUS2vAcDQ-3IM6f7PPac",
            authDomain: "platform-eb07a.firebaseapp.com",
            databaseURL: "https://platform-eb07a.firebaseio.com",
            storageBucket: "platform-eb07a.appspot.com",
            messagingSenderId: "935770919115"
        };
        firebase.initializeApp(config);
        angular.module('MyApp', ['ngMaterial', 'ngRoute'])
            .run(['$rootScope', '$http',
            function ($rootScope_, $http_) {
                $rootScope_['main'] = main;
                main.$http = $http_;
                main.$rootScope = $rootScope_;
                createFirebaseAuthAdminCustomToken();
            }]);
    }
    init();
})(main || (main = {}));
//# sourceMappingURL=index.js.map