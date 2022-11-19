const router = require("express").Router();
const { User, Friend, FriendReq, Game, UserGame } = require("../models");

var moment = require('moment'); // require
moment().format();

require('dotenv').config();

const { 
    fetchAndReturnSteamOwnedGameData, 
    updateOwnedGamesByUserID, 
    fetchAndReturnSteamUserData, 
    updateUserDataByUserID, 
    getAndSortAllOwnedGamesByUserID, 
    fetchAndUpdateOwnedGames
} = require('./utils');

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
async function getAllOwnedGamesForUser(req, res, next) {
    getAndSortAllOwnedGamesByUserID(req.session.user)
    .then((games) => {
        res.locals.ownedGames = games;

        next();
    })
    .catch((error) => {
        console.log(error);
    })
}

async function getFriendData(req, res, next) {
    //console.log(req.params.id);
    const rawFriendData = await User.findByPk(req.params.id);

    const friendData = rawFriendData.get({ plain: true });

    res.locals.friendData = friendData;

    next();
}

async function getFriendOwnedGames(req, res, next) {
    getAndSortAllOwnedGamesByUserID(req.params.id)
    .then((ownedGames) => {
        res.locals.friendOwnedGames = ownedGames;
        
        next();
    })
    .catch((error) => {
        console.log(error);
    })
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
function getOwnedSteamGamesForUser(req, res, next) {
    fetchAndReturnSteamOwnedGameData(res.locals.dbUserData.steam_id)
    .then((games) => {

        res.locals.ownedGamesSteamData = games;

        next();
    })
    .catch((error) => {
        res.status(500).json(error);
    });
}

/* Fetches information about the user with the Steam ID of the user and stores it in res.locals.playerData. */
async function getSteamUserData(req, res, next) {
    fetchAndReturnSteamUserData(res.locals.dbUserData.steam_id)
    .then((userData) => {
        res.locals.playerData = userData;

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

/* Updates the data of the friend whose stats you are viewing if the information is older than a certain amount. */
async function updateFriendDataIfNecessary(req, res, next) {
    const updatedAtMoment = moment(res.locals.friendData.updated_at);
    const currentTime = moment();
    const differenceInMinutes = currentTime.diff(updatedAtMoment, 'minutes');
    // console.log("UPDATING FRIEND DATA IF NECESSARY");
    // console.log(differenceInMinutes);

    if (differenceInMinutes > 10) {
        const friendSteamData = await fetchAndReturnSteamUserData(res.locals.friendData.steam_id);
        await updateUserDataByUserID(res.locals.friendData.id, friendSteamData);

        next();
    } else {
        next();
    }
}

function updateFriendOwnedGamesIfNecessary(req, res, next) {
    const updatedAtMoment = moment(res.locals.friendData.owned_games_updated_at);
    const currentTime = moment();
    const differenceInMinutes = currentTime.diff(updatedAtMoment, 'minutes');
    console.log(`UPDATING ${res.locals.friendData.username}'s OWNED GAMES IF NECESSARY`);
    console.log(`${differenceInMinutes} minutes since last update`);

    if (differenceInMinutes > 30) {
        fetchAndUpdateOwnedGames(res.locals.friendData)
        .then((rowsUpdated) => {
            next();
        })
        .catch((error) => {
            console.log(error);
        })
    } else {
        next();
    }
}

async function updateOwnedSteamGamesForUser(req, res, next) {
    updateOwnedGamesByUserID(res.locals.dbUserData.id, res.locals.ownedGamesSteamData)
    .then((numRowsUpdated) => {
        next();
    })
    .catch((error) => {
        console.log(error);
    });
}

async function updateUserData(req, res, next) {
    updateUserDataByUserID(res.locals.dbUserData.id, res.locals.playerData)
    .then((numRowsUpdated) => {
        next();
    })
    .catch((error) => {
        console.log(error);
        next();
    });
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
    getOwnedSteamGamesForUser,
    updateOwnedSteamGamesForUser,
    getAllOwnedGamesForUser,
    fetchAndReturnSteamOwnedGameData,
    updateOwnedGamesByUserID,
    fetchAndReturnSteamUserData,
    updateUserDataByUserID,
    getFriendOwnedGames,
    updateFriendDataIfNecessary,
    updateFriendOwnedGamesIfNecessary
};