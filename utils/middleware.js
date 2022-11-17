const router = require("express").Router();
const { User, Friend, FriendReq } = require("../models");
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

async function getFriendData(req, res, next) {
    const rawFriendData = await User.findByPk(req.params.id);

    const friendData = rawFriendData.get({ plain: true });

    res.locals.friendData = friendData;

    next();
}

async function redirectIfSteamProfileIsPrivate(req, res, next) {
    if (req.session.privateProfile == 3) {
        next();
    } else {
        res.redirect('/403');
    }
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

function saveSessionData(req, res, next) {
    req.session.save(() => {
        req.session.loggedIn = true;
        req.session.privateProfile = res.locals.playerData.communityvisibilitystate;
        req.session.username = res.locals.dbUserData;
        req.session.steam_username = res.locals.playerData.personaname;
        req.session.steam_avatar_full = res.locals.playerData.avatarfull;
        req.session.profile_url = res.locals.playerData.profileurl
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
    saveSessionData
};