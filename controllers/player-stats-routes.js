const router = require("express").Router();
const { User, Friend, FriendReq } = require("../models");
require('dotenv').config();
const request = require('request');
var rp = require('request-promise');
const { parse } = require("handlebars");
const { getFriendsAndFriendRequests, authorizeUser, getAllOwnedGamesForUser, getUserStatsForGame } = require('../utils/middleware');
const { json } = require("express");
let goodData = true;
let Data;


router.get('/', authorizeUser, getFriendsAndFriendRequests, getAllOwnedGamesForUser, async (req, res) => {

    res.render('user-stats',
    {
        friends: res.locals.friends,
        friendRequests: res.locals.friendRequests,
        ownedGames: res.locals.ownedGames,
        statsPage: true,
        user: {
            loggedIn: req.session.loggedIn,
            username: req.session.username,
            steam_username: req.session.steam_username,
            steam_avatar_full: req.session.steam_avatar_full,
            profile_url: req.session.profile_url
        }
    })
});

/////////////////////////////////////////////////////////////////////////
router.post('/ownedGameStats', async (req, res) => {
    if (!req.session.loggedIn) {
        res.redirect("/login");
    } else {
        try {
            //console.log(req.body.appId);
            req.session.appid = req.body.appId
            //console.log(req.session.appid);
            //console.log(req.session.appid, "when i lost session")
            //console.log(req.body.appId, "when i lost body")
            res.send('yes')
            // const userData = await User.findByPk(req.session.user, {
            //     where: {
            //         id: req.params.id
            //     }

            // })

            // const user = userData.get({ plain: true });
            // const steam = user.steam_id
            // var url = 'http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=' + req.body.appId + '&key=' + process.env.APIkey + '&steamid=' + steam + ''
            // rp(url, async function (err, res, body) {
            //     if (!err && res.statusCode < 400) {
            //         console.log(body)
            //         let elparso = JSON.parse(body)
            //         let temp1 = Object.keys(elparso)
            //         let no = "elparso." + temp1[0]
            //         let temp2 = eval(no)
            //         let temp3 = Object.keys(temp2)
            //         let no2 = 'temp2.' + temp3[2]
            //         let temp4 = eval(no2)
            //         let iAmAwesome = []
            //         for (i = 0; i < temp4.length; i++) {
            //             let noYeah = Object.values(temp4[i])
            //             let temp69 = {
            //                 [noYeah[0]]: Math.trunc(noYeah[1])
            //             }
            //             iAmAwesome.push(temp69)

            //         }

            //         console.log(iAmAwesome, "IM TEMP 4")
            //     }
            // })
            // res.render('user-stats',
            //     {
            //         Data,
            //         loggedIn: req.session.loggedIn
            //     })

        } catch (err) {
            console.log(err)
            res.status(500).json(err)
        }
    }
});

router.get('/ownedGameStats/:appid', authorizeUser, getFriendsAndFriendRequests, getAllOwnedGamesForUser, getUserStatsForGame, async (req, res) => {
    const userData = await User.findByPk(req.session.user)
    // req.session.appid = req.body.appId
    // console.log(req.session.appid)
    const user = await userData.get({ plain: true });
    const steam = user.steam_id

    // console.log(steam, "steam key")
    //console.log(req.session.appid, "why are you bug?")
    var url = 'http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=' + req.params.appid + '&key=' + process.env.APIkey + '&steamid=' + steam
    //console.log(url);
    rp(url).then(async function (data1) {
                
        let elparso = JSON.parse(data1)
        let stats = [];

        if (elparso.playerstats) {
            if (elparso.playerstats.achievements) {
                let rawAchievements = elparso.playerstats.achievements;
                let achievements = rawAchievements.map((achievement) => {
                    const newAchievement = { };
                    newAchievement.name = achievement.name;
                    newAchievement.score = achievement.achieved;

                    return newAchievement;
                });

                stats = [...achievements];
            }

            if (elparso.playerstats.stats) {
                let rawStats = elparso.playerstats.stats;
                const newStats = rawStats.map((rawStat) => {
                    const newStat = {};
                    newStat.name = rawStat.name;
                    newStat.score = rawStat.value;

                    return newStat;
                });

            stats = [...stats, ...newStats];
            }
        }   

        let temp1 = Object.keys(elparso)
        let no = "elparso." + temp1[0]
        let temp2 = eval(no)
        let temp3 = Object.keys(temp2)
        let no2 = 'temp2.' + temp3[2]
        let temp4 = eval(no2)
        let iAmAwesome = []

        if (stats) {
            goodData = true;
            iAmAwesome = stats;
        } else {
            goodData = false;
        }

        res.render('user-stats',
            {
                goodData,
                stats: iAmAwesome,
                friends: res.locals.friends,
                friendRequests: res.locals.friendRequests,
                ownedGames: res.locals.ownedGames,
                gameName: req.query.name,
                statsPage: true,
                statResultsPage: true,
                user: {
                    loggedIn: req.session.loggedIn,
                    username: req.session.username,
                    steam_username: req.session.steam_username,
                    steam_avatar_full: req.session.steam_avatar_full,
                    profile_url: req.session.profile_url
                }
            }
        )
    })
    .catch((error) => {
        console.log(error);
        res.render('user-stats',
        {
            goodData: true,
            stats: [],
            friends: res.locals.friends,
            friendRequests: res.locals.friendRequests,
            ownedGames: res.locals.ownedGames,
            gameName: req.query.name,
            statsPage: true,
            statResultsPage: true,
            user: {
                loggedIn: req.session.loggedIn,
                username: req.session.username,
                steam_username: req.session.steam_username,
                steam_avatar_full: req.session.steam_avatar_full,
                profile_url: req.session.profile_url
            }
        }
    )
    });
});


module.exports = router;