interface IPlayerInfo {
  avatarImageUrl: string;
  displayName: string;
  playerId: string;
}
interface StringIndexer {
   [name: string]: string;
}
type Ref = firebase.database.Reference;

module main {
  export let $http: angular.IHttpService;
  export let $rootScope: angular.IScope;
  export let urlParams = createUrlParams();
  export let gameId = urlParams["gameId"];
  export let recentlyConnected: IPlayerInfo[] = [];

  function db() { return firebase.database(); }
  function getPath(path: string) { return gameId + '/' + path; }
  function dbRef(path: string) { return db().ref(getPath(path)); }

  function onValue(ref: Ref, callback: (val: any)=>void) {
    ref.on('value', getFirebaseCallback(ref, callback));
  }
  function onceValue(ref: Ref, callback: (val: any)=>void) {
    ref.once('value').then(getFirebaseCallback(ref, callback));
  }
  function getFirebaseCallback(ref: Ref, callback: (val: any)=>void) {
    return (snap: firebase.database.DataSnapshot)=>{
      let val = snap.val();
      console.info("Firebase value changed for path: ", getRefPath(ref), "val:", val);
      callback(val);
      $rootScope.$apply();
    };
  }

  function getRefPath<T>(ref: Ref) {
    // ref.toString() returns:
    // "https://platform-eb07a.firebaseio.com/users/12345"
    // ref.key only returns the last part of the path, i.e., "12345".
    let path = ref.toString();
    // remove "https://" (length 8) from path:
    path = path.substr(8);
    // remove domain from path
    path = path.substring(path.indexOf('/'));
    return path;
  }

  export function getAvatar(player: IPlayerInfo) {
    return replaceToHttps(player.avatarImageUrl);
  }
  export function replaceToHttps(url: string) {
    return replacePrefix(url, "http:", "https:");
  }
  function replacePrefix(url: string, from: string, to: string) {
    return !url ? url : url.indexOf(from) === 0 ? to + url.substr(from.length) : url;
  }

  function createUrlParams(): StringIndexer {
    let query = location.search.substr(1);
    let result:StringIndexer = {};
    query.split("&").forEach(function(part) {
      let item = part.split("=");
      result[item[0]] = decodeURIComponent(item[1]);
    });
    return result;
  }

  function handleRecentlyConnected(bucketToPlayerInfo: any) {
    recentlyConnected = [];
    let playerIdsToWatch: string[] = []
    for (let bucket in bucketToPlayerInfo) {
      let playerInfo: IPlayerInfo = bucketToPlayerInfo[bucket];
      recentlyConnected.push(playerInfo);
    }
  }

  function addFirebaseListeners() {
    console.log('addFirebaseListeners');
    onValue(dbRef('recentlyConnected'), handleRecentlyConnected);
  }

  function callAppEngine(msgs: any[], callback: (responseArr:any[])=>void): void {
    $http({
     method: 'POST',
     url: "https://multiplayer-gaming.appspot.com/msg/admin",
     headers: {
       'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
     },
     data: angular.toJson(msgs)
    }).then(
      function (response: any) {
        console.log("AppEngine returns: ", response);
        callback(response.data);
      },
      function (response) {
        console.error("AppEngine had an error: ", response);
      });
  }

  function signin(customToken: string) {
    // You must run on localhost for this to work, so run:
    // python -m SimpleHTTPServer 8888
    // and surf to:
    // http://localhost:8888/index.html?gameId=...&gameDeveloperPassword=...
    firebase.auth().signInWithCustomToken(customToken).then(function() {
      console.info("firebase.auth success!", arguments);
      addFirebaseListeners();
    }).catch(function(error) {
      console.error("firebase.auth Failed!", arguments);
    });
  }

  function createFirebaseAuthAdminCustomToken() {
    callAppEngine([{getFirebaseAdminAuthToken: {
      gameDeveloperPassword: urlParams["gameDeveloperPassword"],
      gameId: gameId,
    }}], (responseArr)=>signin(responseArr[0].firebaseAuthToken));
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
      function ($rootScope_: angular.IScope, $http_: angular.IHttpService) {
        $rootScope_['main'] = main;
        $http = $http_;
        $rootScope = $rootScope_;
        createFirebaseAuthAdminCustomToken();
      }]);
  }

  init();
}