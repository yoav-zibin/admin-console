module firebaseRules {
  interface Rule {
   [name: string]: Rule | string;
  }
  export function getRulesJson(): string {
    let rules = getRules();
    addValidateNoOther(rules);
    return angular.toJson({"rules": rules}, true);
  }

  function validateString(maxLength: number): Rule {
    return {
      ".validate": `newData.isString() && newData.val().length > 0 && newData.val().length < ${maxLength}`
    };
  }

  function validateNow(): Rule {
    return {
              // messages cannot be added in the past or the future
              // clients should use firebase.database.ServerValue.TIMESTAMP
              // to ensure accurate timestamps
              ".validate": "newData.isNumber() && newData.val() == now"
            };
  }

  function validateBoolean(): Rule {
    return {  ".validate": "newData.isBoolean()" };
  }

  function validateNumber(fromInclusive: number, toInclusive: number): Rule {
    return {  ".validate": `newData.isNumber() && newData.val() >= ${fromInclusive} && newData.val() <= ${toInclusive}`  };
  }

  function allowWrite(write: string, rule: Rule): Rule {
    if (rule[".write"]) throw new Error("Rule already has .write: " + angular.toJson(rule, true));
    rule[".write"] = write;
    return rule;
  }

  function validateHasAllChildren(rule: Rule): Rule {
    if (rule[".validate"]) throw new Error("Rule already has .validate: " + angular.toJson(rule, true));
    let keys = getNonSpecialKeys(rule);
    let quotedKeys = keys.map((val)=>`'${val}'`).join(", ");
    rule[".validate"] = `newData.hasChildren([${quotedKeys}])`;
    return rule;
  }

  function getPlayerInfo(playerIdValidate: string): Rule {
    return validateHasAllChildren({
      "avatarImageUrl": validateString(200),
      "displayName": validateString(200),
      "playerId": {
        ".validate": playerIdValidate,
      },
    });
  }

  function deleteElement(arr: string[], elem: string) {
    let index = arr.indexOf(elem);
    if (index != -1) {
      if (typeof arr[index] != "string") {
        throw new Error("key " + elem + " must have a string value, but it had the value of " + angular.toJson(arr[index], true));
      }
      arr.splice(index, 1);
    }
  }

  function getNonSpecialKeys(rule: Rule): string[] {
    let keys = Object.keys(rule);
    // remove the special keys: .read, .write, .validate, .indexOn
    deleteElement(keys, ".write");
    deleteElement(keys, ".read");
    deleteElement(keys, ".validate");
    deleteElement(keys, ".indexOn");
    for (let key of keys) {
      if (key.charAt(0) == '.') throw new Error("You can't start a property with '.', but you used key=" + key);
    }
    return keys;
  }

  function addValidateNoOther(rules: any): void {
    if (typeof rules == "string") return;
    if (typeof rules != "object") {
      throw new Error("rules can either be a string or object, but it was: rules=" + rules);
    }
    let keys = getNonSpecialKeys(rules);

    if (keys.length == 0) return;
    if (keys.length > 1 || keys[0].charAt(0) != '$') {
      rules["$other"] = { ".validate": false };
    }
    if (keys.length > 1) {
      for (let key of keys) {
        if (key.charAt(0) == '$') throw new Error("You can't use a $ property with other non-$ properties, but you have these keys=" + keys);
      }
    }
    // recurse
    for (let key of keys) {
      addValidateNoOther(rules[key]);
    }
  }

  const ANYONE = "auth != null";
  function getRecentlyConnected(): Object {
    return {
        ".read": ANYONE,
        "$bucket": 
          allowWrite(
            /* TODO: add in Feb: "$bucket === auth.recentlyConnectedBucket", */
            "$bucket === '0' || $bucket === '1' || $bucket === '2' || $bucket === '3' || $bucket === '4' || $bucket === '5' || $bucket === '6' || $bucket === '7' || $bucket === '8' || $bucket === '9' || $bucket === '10' || $bucket === '11' || $bucket === '12' || $bucket === '13' || $bucket === '14' || $bucket === '15' || $bucket === '16' || $bucket === '17' || $bucket === '18' || $bucket === '19'",
            getPlayerInfo("newData.val() ==  auth.uid")),
      };
  }

  function getInviter(): Object {
    return {
        "$inviter_id": {
          ".read": "$inviter_id === auth.uid",
          "$invitee_id": {
            ".write": "$invitee_id === auth.uid && $inviter_id === auth.inviterPlayerId",
            // TODO: focus only on marketers.
          }
        }
      };
  }

  function getSlowMatch(): Object {
    return {
        "$player_id": {
          ".read": "$player_id === auth.uid",
          ".write": ANYONE,
          // These are the matches the player should reload from AppEngine.
          // After reloading them, the player deletes them from here.
          "$match_id": validateNow()
        }
      };
  }

  function getSpeedMatch(): Object {
    // The two players can both read and write.
    let readWrite = "$player_id1 === auth.uid || root.child($game_id + '/users/'+$player_id1+'/speedGameWith/playerId').val() === auth.uid";
    return {
        "$player_id1": // The player that plays first
          validateHasAllChildren({ 
            ".read": readWrite,
            ".write": readWrite,
            "data": validateString(20000)
          })
      };
  }

  function getCommunityMatch(): Object {
    let turnIndex = "root.child($game_id + '/communityMatch/' + $community_id + '/data/turnIndex').val()";
    function country(i: number) {
      return `root.child($game_id + '/communityMatch/' + $community_id + '/country${i}').val()`;
    }
    let isCountry1 = `(${country(1)} == auth.country)`;
    let isCountry2 = `(${country(2)} == auth.country)`;
    let onlyMyCountry = `(${isCountry1} || ${isCountry2})`;
    let isMyTurn = `${onlyMyCountry} && ((${turnIndex} == 0 && ${isCountry1}) || (${turnIndex} == 1 && ${isCountry2}))`;
    return {
        "$community_id":
          validateHasAllChildren({ 
            ".read": onlyMyCountry,
            ".indexOn": <any>["country1", "country2"],
            "country1": validateString(2),
            "country2": validateString(2),
            "data": validateHasAllChildren({ 
              ".write": isMyTurn,
              "matchState": validateString(20000), // includes random seed, state, turnIndex, number of moves, etc.
              // The game is always on (when a proposal to end the game is selected, that player already starts the new match with a new random seed).
              "turnIndex": validateNumber(0, 1), // this helps make sure we don't get proposals from the wrong turn (if someone has a very slow network connection)
              "proposals": {
                "$player_id": validateHasAllChildren({ 
                  "proposalState": validateString(20000),
                })
              }
            })
          }),
      };
  }

  function getChats(): Object {
    return {
        "$player_id1": {
          ".read": "$player_id1 === auth.uid",
          "$player_id2": validateHasAllChildren({
            ".write": "$player_id1 === auth.uid || $player_id2 === auth.uid",
            "msgs": {
              "$createdOn": {
                "chat": validateString(140),
                "fromMe": validateBoolean()
              }
            },
            "player2Info": getPlayerInfo("newData.val() == $player_id2")
          }),
        }
      };
  }

  function getUsers(): Object {
    return {
        "$player_id": {
          // This is public user data for the presence system (if/when the user connected, and if it's playing speed game)
          ".read": ANYONE,
          // grants write access to the owner of this user account
          // whose uid must exactly match the key ($player_id)
          ".write": "$player_id === auth.uid",
          "online": validateBoolean(),
          "lastOnline": validateNow(),
          "speedGameWith": 
            allowWrite(ANYONE,
              getPlayerInfo(
                // You can only write your own playerId,
                // and only if your speedGameWith is empty or points to this user.
                "newData.val() == auth.uid && (!root.child($game_id + '/users/' + auth.uid + '/speedGameWith').exists() || root.child($game_id + '/users/' + auth.uid + '/speedGameWith/playerId').val() == $player_id)"))
        }
      };
  }

  /* 
  - permission cascades down: 
      once you've granted read or write permission on a certain level in the tree,
      you cannot take that permission away at a lower level. 
  - .validate rules are different:
      data is only considered valid when all validation rules are met.
      (http://stackoverflow.com/questions/39082513/catch-all-other-firebase-database-rule)
  */
  function getRules(): Object {
    return {
      ".read": "false",
      ".write": "false",
      "$game_id": {
        /* TODO: add in Feb: 
        ".validate": "auth.gameId == $game_id", */
        ".read": "auth.isAdmin == true && auth.gameId == $game_id",
        ".write": "auth.isAdmin == true ",
        // Track the last ~20 players that connected, for showing in "Choose opponent".
        "recentlyConnected": getRecentlyConnected(),
        // Track how successful the invite mechanism is, and who are good inviters.
        // TODO: implement.
        "inviter": getInviter(),
        // A mechanism to ping another player after you made a move in a slow match (or created a new match),
        // so that player will reload that match. It's like "push notifications" using firebase.
        "slowMatch": getSlowMatch(),
        // Speed matches data.
        "speedMatch": getSpeedMatch(),
        // Community matches data.
        "communityMatch": getCommunityMatch(),
        // Player-to-player chat data (not group chat).
        // A chat from player A to player B is saved twice: both under playerA/playerB and playerB/playerA.
        // (The reason we save twice is that one player can clear his chat history.)
        // For efficiency reasons, once you get to ~100-200 msgs with someone, we auto remove a batch of older msgs.
        "chats": getChats(),
        // Public player info used in the presence system (if/when the user connected, and if it's playing speed game).
        "users": getUsers(),  
      }
    };
  }

  angular.module('MyApp', [])
  .run(['$rootScope',
  function ($rootScope: angular.IScope) {
    $rootScope['firebaseRules'] = firebaseRules;
  }]);
}