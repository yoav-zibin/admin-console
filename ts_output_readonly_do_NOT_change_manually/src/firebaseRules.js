var firebaseRules;
(function (firebaseRules) {
    function getRulesJson() {
        var rules = getRules();
        addValidateNoOther(rules);
        return angular.toJson(rules, true);
    }
    firebaseRules.getRulesJson = getRulesJson;
    function validateString(maxLength) {
        return {
            ".validate": "newData.exists() && newData.isString() && newData.val().length > 0 && newData.val().length < " + maxLength
        };
    }
    function allowWrite(write, rule) {
        rule[".write"] = write;
        return rule;
    }
    function getPlayerInfo(playerIdValidate) {
        return {
            "avatarImageUrl": validateString(200),
            "displayName": validateString(200),
            "playerId": playerIdValidate,
        };
    }
    function deleteElement(arr, elem) {
        var index = arr.indexOf(elem);
        if (index != -1) {
            if (typeof arr[index] != "string") {
                throw new Error("key " + elem + " must have a string value, but it had the value of " + angular.toJson(arr[index], true));
            }
            arr.splice(index, 1);
        }
    }
    function addValidateNoOther(rules) {
        if (typeof rules == "string")
            return;
        if (typeof rules != "object") {
            throw new Error("rules can either be a string or object, but it was: rules=" + rules);
        }
        var keys = Object.keys(rules);
        // remove the special keys: .read, .write, .validate
        deleteElement(keys, ".write");
        deleteElement(keys, ".read");
        deleteElement(keys, ".validate");
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var key = keys_1[_i];
            if (key.charAt(0) == '.')
                throw new Error("You can't start a property with '.', but you used key=" + key);
        }
        if (keys.length == 0)
            return;
        if (keys.length > 1 || keys[0].charAt(0) != '$') {
            rules["$other"] = { ".validate": false };
        }
        if (keys.length > 1) {
            for (var _a = 0, keys_2 = keys; _a < keys_2.length; _a++) {
                var key = keys_2[_a];
                if (key.charAt(0) == '$')
                    throw new Error("You can't use a $ property with other non-$ properties, but you have these keys=" + keys);
            }
        }
        // recurse
        for (var _b = 0, keys_3 = keys; _b < keys_3.length; _b++) {
            var key = keys_3[_b];
            addValidateNoOther(rules[key]);
        }
    }
    function getRecentlyConnected() {
        return {
            ".read": "auth != null",
            "$bucket": allowWrite(
            /* TODO: add in Feb: "$bucket === auth.recentlyConnectedBucket", */
            "$bucket === '0' || $bucket === '1' || $bucket === '2' || $bucket === '3' || $bucket === '4' || $bucket === '5' || $bucket === '6' || $bucket === '7' || $bucket === '8' || $bucket === '9' || $bucket === '10' || $bucket === '11' || $bucket === '12' || $bucket === '13' || $bucket === '14' || $bucket === '15' || $bucket === '16' || $bucket === '17' || $bucket === '18' || $bucket === '19'", getPlayerInfo("newData.val() ==  auth.uid")),
        };
    }
    function getInviter() {
        return {
            "$inviter_id": {
                ".read": "$inviter_id === auth.uid",
                "$invitee_id": {
                    ".write": "$invitee_id === auth.uid && $inviter_id === auth.inviterPlayerId",
                    "money": {
                        ".validate": "newData.isNumber() && newData.val() == now"
                    }
                }
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
    function getRules() {
        return {
            "rules": {
                ".read": "false",
                ".write": "false",
                "$game_id": {
                    /* TODO: add in Feb:
                    ".validate": "auth.gameId == $game_id", */
                    ".read": "auth.isAdmin == true && auth.gameId == $game_id",
                    ".write": "auth.isAdmin == true ",
                    "recentlyConnected": getRecentlyConnected(),
                    "inviter": getInviter(),
                    "slowMatch": {
                        "$user_id": {
                            ".read": "$user_id === auth.uid",
                            ".write": "auth != null",
                            "$match_id": {
                                ".validate": "newData.isNumber() && newData.val() == now"
                            }
                        }
                    },
                    "speedMatch": {
                        "$user_id1": {
                            // The two players can both read and write.
                            ".read": "$user_id1 === auth.uid || root.child('users/'+$user_id1+'/speedGameWith/playerId').val() === auth.uid",
                            ".write": "$user_id1 === auth.uid || root.child('users/'+$user_id1+'/speedGameWith/playerId').val() === auth.uid",
                            "data": {
                                ".validate": "newData.exists() && newData.isString() && newData.val().length > 0 && newData.val().length < 20000"
                            }
                        }
                    },
                    "chats": {
                        "$user_id1": {
                            ".read": "$user_id1 === auth.uid",
                            "$user_id2": {
                                ".write": "$user_id1 === auth.uid || $user_id2 === auth.uid",
                                "msgs": {
                                    "$createdOn": {
                                        "chat": {
                                            ".validate": "newData.exists() && newData.isString() && newData.val().length > 0 && newData.val().length <= 140"
                                        },
                                        "fromMe": {
                                            ".validate": "newData.exists() && newData.isBoolean()"
                                        }
                                    }
                                },
                                "player2Info": getPlayerInfo("newData.val() == $user_id2")
                            }
                        }
                    },
                    "users": {
                        "$user_id": {
                            // This is public user data for the presence system (if/when the user connected, and if it's playing speed game)
                            ".read": "auth != null",
                            // grants write access to the owner of this user account
                            // whose uid must exactly match the key ($user_id)
                            ".write": "$user_id === auth.uid",
                            "online": {
                                ".validate": "!newData.exists() || newData.isBoolean()"
                            },
                            "lastOnline": {
                                // messages cannot be added in the past or the future
                                // clients should use firebase.database.ServerValue.TIMESTAMP
                                // to ensure accurate timestamps
                                ".validate": "newData.isNumber() && newData.val() == now"
                            },
                            "speedGameWith": allowWrite("auth != null", getPlayerInfo(
                            // You can only write your own playerId,
                            // and only if your speedGameWith is empty or points to this user.
                            "newData.val() == auth.uid && (!root.child('users/' + auth.uid + '/speedGameWith').exists() || root.child('users/' + auth.uid + '/speedGameWith/playerId').val() == $user_id)"))
                        }
                    }
                }
            }
        };
    }
    angular.module('MyApp', [])
        .run(['$rootScope',
        function ($rootScope) {
            $rootScope['firebaseRules'] = firebaseRules;
        }]);
})(firebaseRules || (firebaseRules = {}));
//# sourceMappingURL=firebaseRules.js.map