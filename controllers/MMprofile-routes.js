const router = require("express").Router();
const { User, Friend, FriendReq } = require("../models");
require('dotenv').config();
//const request = require('request');
var rp = require('request-promise');
const { parse } = require("handlebars");
//const controller = new AbortController();
const { 
    getFriendsAndFriendRequests, 
    authorizeUser, getFriendData, 
    desperateMeasures, 
    redirectIfSteamProfileIsPrivate, 
    getFriendOwnedGames,
    getRecentGames,
    updateFriendDataIfNecessary, 
    updateFriendOwnedGamesIfNecessary,
    updateRecentGamesNews,
    getAllRecentGameNews
} = require('../utils/middleware');

const { newsCleanUp } = require('../utils/helpers')

let ownedGamesData;

let temp1;
let temp2;
let temp3
let newsArray = [];
let newsPerGame = []
let start;
let games
router.get('/', authorizeUser, redirectIfSteamProfileIsPrivate, getFriendsAndFriendRequests, getRecentGames, updateRecentGamesNews, getAllRecentGameNews, async (req, res) => {
    res.render('dashboard', {
        friends: res.locals.friends,
        friendRequests: res.locals.friendRequests,
        newsPerGame: res.locals.newsPerGame,
        recentGames: res.locals.recentGames,
        user: {
            loggedIn: req.session.loggedIn,
            username: req.session.username,
            steam_username: req.session.steam_username,
            steam_avatar_full: req.session.steam_avatar_full,
            profile_url: req.session.profile_url
        }
    })
});

router.get('/search', authorizeUser, getFriendsAndFriendRequests, async (req, res) => {

    try {
        res.render('search',
            {

                friends: res.locals.friends,
                friendRequests: res.locals.friendRequests,
                search: true,
                user: {
                    loggedIn: req.session.loggedIn,
                    username: req.session.username,
                    steam_username: req.session.steam_username,
                    steam_avatar_full: req.session.steam_avatar_full,
                    profile_url: req.session.profile_url
                }
            })
    } catch (err) {
        console.log(err)
        res.status(500).json(err)
    }

})

/* Route to go to a friend's see stats page. */
router.get('/friends/:id/stats', authorizeUser, getFriendsAndFriendRequests, getFriendData, updateFriendDataIfNecessary, updateFriendOwnedGamesIfNecessary, getFriendOwnedGames, async (req, res) => {   

    res.render('friend-stats', {
        friends: res.locals.friends,
        friendRequests: res.locals.friendRequests,
        friendData: res.locals.friendData,
        ownedGames: res.locals.friendOwnedGames,
        user: {
            loggedIn: req.session.loggedIn,
            username: req.session.username,
            steam_username: req.session.steam_username,
            steam_avatar_full: req.session.steam_avatar_full,
            profile_url: req.session.profile_url
        }
    });
});

/* Route to see the stats on the friend's stats page after clicking on a button. */
router.get('/friends/:id/stats/:appid', authorizeUser, getFriendsAndFriendRequests, getFriendData, updateFriendDataIfNecessary, updateFriendOwnedGamesIfNecessary, getFriendOwnedGames, async (req, res) => {

    const gameStatsAPIURL = `http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=${req.params.appid}&key=${process.env.APIkey}&steamid=${res.locals.friendData.steam_id}`; 
    //console.log(gameStatsAPIURL);
    //http://localhost:3001/friends/2/stats/834910

    rp(gameStatsAPIURL)
    .then((rawGameStatsData) => {
        const gameStatsData = JSON.parse(rawGameStatsData);

        let achievementMap;
        let stats;

        if (gameStatsData.playerstats) {
            //console.log("RESPONSE");

            if (gameStatsData.playerstats.achievements) {
                achievementMap = gameStatsData.playerstats.achievements.map(achievement => {
                    const newAchievement = achievement;
                    newAchievement.score = achievement.achieved;

                    return newAchievement;
                });
            } else {
                achievementMap = [];
            }

            /* For when the response nugget doesn't contain an array called 'stats, only 'achievements'' */
            let rawGameStats;
            if (!gameStatsData.playerstats.stats) {
                rawGameStats = [];
            } else {
                rawGameStats = gameStatsData.playerstats.stats.map(stat => {
                    const newStat = {};
                    newStat.name = stat.name;
                    newStat.score = stat.value

                    return newStat;
                });
            }

            stats = [...rawGameStats, ...achievementMap];
        } else {
            console.log("NO RESPONSE");
        }

        res.render('friend-stats', {
            friends: res.locals.friends,
            friendRequests: res.locals.friendRequests,
            friendData: res.locals.friendData,
            ownedGames: res.locals.friendOwnedGames,
            statResultsPage: true,
            gameName: req.query.name,
            stats,
            user: {
                loggedIn: req.session.loggedIn,
                username: req.session.username,
                steam_username: req.session.steam_username,
                steam_avatar_full: req.session.steam_avatar_full,
                profile_url: req.session.profile_url
            }
        });
    })
    .catch((error) => {
        res.render('friend-stats', {
            friends: res.locals.friends,
            friendRequests: res.locals.friendRequests,
            friendData: res.locals.friendData,
            ownedGames: ownedGamesData,
            statResultsPage: true,
            gameName: req.query.name,
            stats: [],
            user: {
                loggedIn: req.session.loggedIn,
                username: req.session.username,
                steam_username: req.session.steam_username,
                steam_avatar_full: req.session.steam_avatar_full,
                profile_url: req.session.profile_url
            }
        });
    });
});

// router.get('/search/results', async (req, res) => {
//     if (!req.session.loggedIn) {
//         res.redirect("/login");
//     } else {
//         try {
//             res.render('search2',
//             {
//                 loggedIn: req.session.loggedIn
//             })
//         } catch (err) {
//             console.log(err)
//             res.status(500).json(err)
//         }
//     }

// })

module.exports = router;