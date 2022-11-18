const router = require("express").Router();
const { User } = require("../../models");
require('dotenv').config();
const rp = require('request-promise');
const { checkPassword, getSteamUserData, updateUserData, saveSessionData, redirectIfSteamProfileIsPrivate, getOwnedSteamGamesForUser, updateOwnedSteamGamesForUser, getAllOwnedGamesForUser } = require('../../utils/middleware');

router.post("/login", checkPassword, getSteamUserData, updateUserData, saveSessionData, redirectIfSteamProfileIsPrivate, getOwnedSteamGamesForUser, updateOwnedSteamGamesForUser, async (req, res) => {
        res
          .status(200)
          .json({ user: res.locals.dbUserData, message: "You are now logged in!" });
});

router.post("/signup", async (req, res) => {
  try {
      const fetchURL = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.APIkey}&steamids=${req.body.steam_id}`;
      //console.log(fetchURL);
      rp(fetchURL)
      .then(async (body) => {
        const response = JSON.parse(body).response;

        const dbUserData = await User.create({
          username: req.body.username,
          password: req.body.password,
          steam_id: req.body.steam_id,
          steam_avatar_full: response.players[0].avatarfull,
          steam_username: response.players[0].personaname,
          profile_url: response.players[0].profileurl
        });

        req.session.user = dbUserData.id;
        req.session.save(() => {
          req.session.loggedIn = true;
          req.session.privateProfile = response.players[0].communityvisibilitystate;
          //console.log(req.session.privateProfile, "HERE2")
          req.session.username = dbUserData.username;
          req.session.steam_username = dbUserData.steam_username;
          req.session.steam_avatar_full = dbUserData.steam_avatar_full;
          req.session.profile_url = dbUserData.profile_url;
          req.session.steam_id = dbUserData.steam_id;
          
          res.status(200).json(dbUserData);
      });
      })

  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

module.exports = router;