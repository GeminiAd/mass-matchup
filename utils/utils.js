var moment = require('moment'); // require
moment().format();
const rp = require('request-promise');

const { User, Game, UserGame } = require("../models");
const { Op } = require("sequelize");

/* Checks to see if any user and owned game information needs updating, and if so, returns a list of users that need updating. */
async function checkToUpdateUserInformation() {
    return new Promise(async (resolve, reject) => {
        //console.log("checking if any user's owned games need updating");

        User.findAll()
        .then((rawUsers) => {
            const users = rawUsers.map(user => user.get({ plain: true }));

            const usersThatNeedUpdating = users.filter((user) => {
                const updatedAtMoment = moment(user.updated_at);
                const currentTime = moment();
                const differenceInMinutes = currentTime.diff(updatedAtMoment, 'minutes');
                console.log(differenceInMinutes);

                return differenceInMinutes > 1440;
            })

            resolve(usersThatNeedUpdating);
        })
        .catch((error) => {
            console.log(error);
            reject(error);
        });
    });
}

/* Fetches and returns owned game data from the Steam Web API. Also parses the data and filters the games based on whether or not they have stats. */
function fetchAndReturnSteamOwnedGameData(steamID) {
    return new Promise((resolve, reject) => {
        const fetchURL = 'http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=' + process.env.APIkey + '&steamid=' + steamID + '&format=json&include_appinfo=true';
        //console.log(fetchURL);
        rp(fetchURL)
        .then((response) => {
            const ownedGamesSteamData = JSON.parse(response).response.games;
    
            const filteredGameData = ownedGamesSteamData.filter(steamGame => steamGame.has_community_visible_stats);
    
            resolve(filteredGameData);
        })
        .catch((error) => {
            reject(error);
        });
    });
}

/* Fetches and returns information from Steam about the user with the given steam ID. */
function fetchAndReturnSteamUserData(steamID) {
    return new Promise((resolve, reject) => {
        const fetchURL = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.APIkey}&steamids=${steamID}`;

        rp(fetchURL)
        .then(async (body) => {
          const playerData = JSON.parse(body).response.players[0];
    
          resolve(playerData);
        })
        .catch((error) => {
            console.log(error);
            reject(error);
        });
    });
}

function getAndSortAllOwnedGamesByUserID(userID) {
    return new Promise((resolve, reject) => {
        User.findByPk(userID, {
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
        })
        .then((user) => {
            const ownedGames = user.games.map(game => game.get({ plain: true }));

            const sortedGames = ownedGames.sort(function (a, b) {
                return parseFloat(b.user_game.playtime_forever) - parseFloat(a.user_game.playtime_forever);
            });

            resolve(sortedGames);
        })
        .catch((error) => {
            reject(error);
        }); 
    });
}

async function fetchAndUpdateOwnedGames(user) {
    return new Promise(async (resolve, reject) => {
        console.log(`UPDATING OWNED GAMES FOR ${user.username}`);
        try {
            const steamGameData = await fetchAndReturnSteamOwnedGameData(user.steam_id)
            const rowsUpdated = await updateOwnedGamesByUserID(user.id, steamGameData)
            resolve(rowsUpdated);
        } catch (error) {
            console.log(error);
            reject(error);
        } 
    });
}

async function updateAllUserData(users) {
    for (const user of users) {
        console.log(`UPDATING USER DATA FOR ${user.username}`);
        try {
            const steamUserData = await fetchAndReturnSteamUserData(user.steam_id);
            updateUserDataByUserID(user.id, steamUserData);
        } catch (error) {
            console.log(error);
        }
    }
}

async function updateAllOwnedGamesAndAllUsers() {
    checkToUpdateUserInformation()
    .then((users) => {
        updateAllOwnedGames(users);
        updateAllUserData(users);
    })
    .catch((error) => {
        console.log(error);
    })
}

/* 
 *  Updates the owned steam games information in the database for the user with the input ID using the raw response from the Steam Web API.
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
function updateOwnedGamesByUserID(userID, userOwnedGamesSteamData) {
    return new Promise(async (resolve, reject) => {
        /* 1. Get all of the user's owned games from the database. */
        User.findByPk(userID, {
            include: [
                {
                    model: Game,
                }
            ]
        })
        .then(async (rawUser) => {
            const ownedDBGames = rawUser.games.map(rawOwnedGame => rawOwnedGame.get({ plain: true }));

            /* 2. Get a list of all steam games that need to be added to the database. */
            const rawGames = await Game.findAll();
            const games = rawGames.map(rawGame => rawGame.get({ plain: true }));
            const gameAppIDS = games.map(game => game.app_id);

            const steamGamesToAdd = userOwnedGamesSteamData.filter(steamGame => !gameAppIDS.includes(steamGame.appid));

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
            const steamOwnedGameAppIDs = userOwnedGamesSteamData.map(ownedSteamGame => ownedSteamGame.appid);
            const ownedDBGamesToRemove = ownedDBGames.filter((ownedDBGame) => !steamOwnedGameAppIDs.includes(ownedDBGame.app_id));

            /* 5. Remove the UserGame relationships. */
            const ownedDBGameIDsToRemove = ownedDBGamesToRemove.map(game => game.user_game.id);
            UserGame.destroy({
                where: {
                    id: ownedDBGameIDsToRemove
                }
            });

            /* 6. Get a list of UserGame relationships that need to be added to the database. */
            const ownedDBGamesToAdd = userOwnedGamesSteamData.filter((ownedSteamGame) => !ownedDBGameAppIDs.includes(ownedSteamGame.appid));

            //console.log(ownedDBGamesToAdd);

            /* 7. Add the UserGame relationships to the database. */
            const userGameObjsToAdd = await Promise.all(ownedDBGamesToAdd.map(async (game) => {
                let newUserGameObj = {};
                const gameData = await Game.findOne({
                    where: {
                        app_id: game.appid
                    }
                });

                newUserGameObj.user_id = userID;
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
            const ownedDBGamesToUpdate = userOwnedGamesSteamData.filter((steamGame) => ownedDBGameAppIDs.includes(steamGame.appid));
            
            /* 9. Update all UserGame relationships in the database. */
            let numRowsUpdated = 0;
            for (const game of ownedDBGamesToUpdate) {
                const dbGameData = await Game.findOne({
                    where: {
                        app_id: game.appid
                    }
                });

                const [rows, poop] = await UserGame.update(
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
                            user_id: userID
                        }
                    }
                );

                numRowsUpdated += rows;
            }

            await updateOwnedGamesUpdatedAt(userID)

            resolve(numRowsUpdated);
        })
        .catch((error) => {
            console.log(error);
            reject(error);
        });
    });
}

/* Updates the user information in the database given a User ID and the raw steam information. */
async function updateUserDataByUserID(userID, userData) {
    return User.update(
        {
            steam_avatar_full: userData.avatarfull,
            steam_username: userData.personaname,
            profile_url: userData.profileurl,
            communityvisibilitystate: userData.communityvisibilitystate
        }, 
        {
            where: {
                id: userID
            }
        }
    );
}

async function updateOwnedGamesUpdatedAt(userID) {
    return new Promise((resolve, reject) => {
        User.update({
            owned_games_updated_at: new Date()
        },
        {
            where: {
                id: userID
            }
        })
        .then((numRowsUpdated) => {
            resolve(numRowsUpdated);
        })
        .catch((error) => {
            console.log(error);
            reject(error);
        });
    });
}


module.exports = { 
    updateAllOwnedGamesAndAllUsers, 
    fetchAndReturnSteamOwnedGameData, 
    updateOwnedGamesByUserID, 
    fetchAndReturnSteamUserData, 
    updateUserDataByUserID,
    getAndSortAllOwnedGamesByUserID,
    fetchAndUpdateOwnedGames,
    updateOwnedGamesUpdatedAt
};