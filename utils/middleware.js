const router = require("express").Router();
const { User, Friend, FriendReq, Game, UserGame } = require("../models");
const { Op } = require("sequelize");
require('dotenv').config();
const rp = require('request-promise');

function authorizeUser(req, res, next) {
    if (!req.session.loggedIn) {
        res.redirect("/login");
    } else {
        next();
    }
}

async function checkPassword(req, res, next) {
    try {
        const dbUserData = await User.findOne({
          where: {
            username: req.body.username,
          },
        });
        req.session.user = dbUserData.id;
        if (!dbUserData) {
          res
            .status(400)
            .json({ message: "Incorrect Username . Please try again!" });
          return;
        } else {
        const validPassword = await dbUserData.checkPassword(req.body.password);
    
        if (!validPassword) {
            res
                .status(400)
                .json({ message: "Incorrect password. Please try again!" });
            return;
        } else {
                res.locals.dbUserData = dbUserData;
                next();
        }
        }
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
}

async function desperateMeasures(){  
    
        router.get('/', function(req, res){
            res.redirect('/')
        })       
    
}

/*
 *  Get all games that the user owns from the database and puts it in a session variable.
 */
async function getAllOwnedGames(req, res, next) {
    const user = await User.findByPk(req.session.user, {
        include: [
            {
                model: Game,
                through: {
                    where: {
                        playtime_forever: {
                            [Op.gt]: 0
                        }
                    }
                }
            }
        ]
    });

    const ownedGames = user.games.map(game => game.get({ plain: true }));

    req.session.ownedGames = ownedGames;

    next();
}

async function getFriendData(req, res, next) {
    const rawFriendData = await User.findByPk(req.params.id);

    const friendData = rawFriendData.get({ plain: true });

    res.locals.friendData = friendData;

    next();
}

async function getFriendsAndFriendRequests(req, res, next) {
    //console.log("TEST");

    const userData = await User.findByPk(req.session.user, {
        where: {
            id: req.params.id
        },
        include: [
            {
                model: User,
                as: "link_id"
            },
            {
                model: User,
                as: "friend_id"
            },
            {
                model: User,
                as: "link_id_req"
            },
            {
                model: User,
                as: "friend_id_req"
            },
        ]
    })

    const rawFriends = [...userData.link_id, ...userData.friend_id];

    const friends = rawFriends.map(rawFriend => rawFriend.get({ plain: true }));

    res.locals.friends = friends;

    const rawFriendRequests = [...userData.link_id_req];

    const friendRequests = rawFriendRequests.map(rawFriendRequest => rawFriendRequest.get({ plain: true }));

    res.locals.friendRequests = friendRequests;

    const friendRequestsSent = userData.friend_id_req.map(friendReq => friendReq.get({ plain: true }));

    res.locals.friendRequestsSent = friendRequestsSent;

    next();
}

/* Makes a request to the Steam Web API for the user's owned game information and stores it in a local variable for use later. */
/* Filters out games that don't have community stats visible so I don't have to do it later. */
function getOwnedSteamGames(req, res, next) {
    const fetchURL = 'http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=' + process.env.APIkey + '&steamid=' + req.session.steam_id + '&format=json&include_appinfo=true';
    //console.log(fetchURL);
    rp(fetchURL)
    .then((response) => {
        const ownedGamesSteamData = JSON.parse(response).response.games;

        res.locals.ownedGamesSteamData = ownedGamesSteamData.filter(steamGame => steamGame.has_community_visible_stats);

        next();
    })
    .catch((error) => {
        res.status(500).json(error);
    });
}

/* Fetches information about the user with the Steam ID of the user and stores it in res.locals.playerData. */
async function getSteamUserData(req, res, next) {
    const fetchURL = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.APIkey}&steamids=${res.locals.dbUserData.steam_id}`;

    rp(fetchURL)
    .then(async (body) => {
      const playerData = JSON.parse(body).response.players[0];

      res.locals.playerData = playerData;

      next();
    })
    .catch((error) => {
        console.log(error);
        res.status(500).json(error);
    });
}

async function redirectIfSteamProfileIsPrivate(req, res, next) {
    if (req.session.privateProfile == 3) {
        next();
    } else {
        res.redirect('/403');
    }
}

function saveSessionData(req, res, next) {
    req.session.save(() => {
        req.session.loggedIn = true;
        req.session.userId = res.locals.dbUserData.id;
        req.session.privateProfile = res.locals.playerData.communityvisibilitystate;
        req.session.username = res.locals.dbUserData.username;
        req.session.steam_username = res.locals.playerData.personaname;
        req.session.steam_avatar_full = res.locals.playerData.avatarfull;
        req.session.profile_url = res.locals.playerData.profileurl;
        req.session.steam_id = res.locals.dbUserData.steam_id;

        next();
    });
}

/* 
 *  Updates the owned steam games information in the database using the raw response from the Steam Web API.
 *  In order to update the database with a user's steam games we must:
 *      1. Get all of the user's owned games from the database.
 *      2. Get a list of all steam games that need to be added to the database.
 *      3. Add all steam games that need to be added to the database.
 *      4. Get a list of UserGame relationships that need to be removed.
 *      5. Remove the UserGame relationships.
 *      6. Get a list of UserGame relationships that need to be added to the database.
 *      7. Add the UserGame relationships to the database.
 *      8. Get a list of UserGame relationships to update.
 *      9. Update all UserGame relationships in the database.
 */
async function updateOwnedSteamGames(req, res, next) {
    /* 1. Get all of the user's owned games from the database. */
    const rawUser = await User.findByPk(req.session.userId, {
        include: [
            {
                model: Game,
            }
        ]
    });
    const ownedDBGames = rawUser.games.map(rawOwnedGame => rawOwnedGame.get({ plain: true }));

    /* 2. Get a list of all steam games that need to be added to the database. */
    const rawGames = await Game.findAll();
    const games = rawGames.map(rawGame => rawGame.get({ plain: true }));
    const gameAppIDS = games.map(game => game.app_id);

    const steamGamesToAdd = res.locals.ownedGamesSteamData.filter(steamGame => !gameAppIDS.includes(steamGame.appid));

    /* 3. Add all steam games that need to be added to the database. */
    const steamGameObjectsToAdd = steamGamesToAdd.map(steamGame => {
        let steamGameObj = {};
        steamGameObj.app_id = steamGame.appid;
        steamGameObj.name = steamGame.name;
        steamGameObj.img_icon_url = steamGame.img_icon_url;

        return steamGameObj;
    })
    await Game.bulkCreate(steamGameObjectsToAdd);

    /* 4. Get a list of UserGame relationships that need to be removed. */
    const ownedDBGameAppIDs = ownedDBGames.map(ownedDBGame => ownedDBGame.app_id);
    const steamOwnedGameAppIDs = res.locals.ownedGamesSteamData.map(ownedSteamGame => ownedSteamGame.appid);
    const ownedDBGamesToRemove = ownedDBGames.filter((ownedDBGame) => !steamOwnedGameAppIDs.includes(ownedDBGame.app_id));

    /* 5. Remove the UserGame relationships. */
    const ownedDBGameIDsToRemove = ownedDBGamesToRemove.map(game => game.user_game.id);
    UserGame.destroy({
        where: {
            id: ownedDBGameIDsToRemove
        }
    });

    /* 6. Get a list of UserGame relationships that need to be added to the database. */
    const ownedDBGamesToAdd = res.locals.ownedGamesSteamData.filter((ownedSteamGame) => !ownedDBGameAppIDs.includes(ownedSteamGame.appid));

    //console.log(ownedDBGamesToAdd);

    /* 7. Add the UserGame relationships to the database. */
    const userGameObjsToAdd = await Promise.all(ownedDBGamesToAdd.map(async (game) => {
        let newUserGameObj = {};
        const gameData = await Game.findOne({
            where: {
                app_id: game.appid
            }
        });

        newUserGameObj.user_id = req.session.userId;
        newUserGameObj.game_id = gameData.id;
        newUserGameObj.playtime_forever = game.playtime_forever;
        newUserGameObj.playtime_windows_forever = game.playtime_windows_forever;
        newUserGameObj.playtime_mac_forever = game.playtime_mac_forever;
        newUserGameObj.playtime_linux_forever = game.playtime_linux_forever;
        newUserGameObj.rtime_last_played = game.rtime_last_played;

        return newUserGameObj;
    }));
    await UserGame.bulkCreate(userGameObjsToAdd);

    /* 8. Get a list of UserGame relationships to update. */
    const ownedDBGamesToUpdate = res.locals.ownedGamesSteamData.filter((steamGame) => ownedDBGameAppIDs.includes(steamGame.appid));
    
    /* 9. Update all UserGame relationships in the database. */
    for (const game of ownedDBGamesToUpdate) {
        const dbGameData = await Game.findOne({
            where: {
                app_id: game.appid
            }
        });

        await UserGame.update(
            {
                playtime_forever: game.playtime_forever,
                playtime_windows_forever: game.playtime_windows_forever,
                playtime_mac_forever: game.playtime_mac_forever,
                playtime_linux_forever: game.playtime_linux_forever,
                rtime_last_played: game.rtime_last_played
            },
            {
                where: {
                    game_id: dbGameData.id,
                    user_id: req.session.userId
                }
            }
        );
    }

    next();
}

async function updateUserData(req, res, next) {
    await User.update({
        steam_avatar_full: res.locals.playerData.avatarfull,
        steam_username: res.locals.playerData.personaname,
        profile_url: res.locals.playerData.profileurl
      }, {
        where: {
          id: res.locals.dbUserData.id
        }
      });

    next();
}

module.exports = { 
    getFriendsAndFriendRequests, 
    authorizeUser, 
    getFriendData, 
    desperateMeasures, 
    redirectIfSteamProfileIsPrivate, 
    checkPassword, 
    getSteamUserData, 
    updateUserData,
    saveSessionData,
    getOwnedSteamGames,
    updateOwnedSteamGames,
    getAllOwnedGames
};