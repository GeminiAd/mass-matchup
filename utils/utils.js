var moment = require('moment'); // require
moment().format();

const { User } = require("../models");
const { fetchAndReturnSteamOwnedGameData, updateOwnedGamesByUserID, fetchAndReturnSteamUserData, updateUserDataByUserID } = require('./middleware');

/* Checks to see if any user and owned game information needs updating, and if so, returns a list of users that need updating. */
async function checkToUpdateUserInformation() {
    return new Promise(async (resolve, reject) => {
        console.log("checking if any user's owned games need updating");

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

async function updateAllOwnedGames(users) {
    for (const user of users) {
        console.log(`UPDATING OWNED GAMES FOR ${user.username}`);
        try {
            const steamGameData = await fetchAndReturnSteamOwnedGameData(user.steam_id)
            await updateOwnedGamesByUserID(user.id, steamGameData)
        } catch (error) {
            console.log(error);
        } 
    }
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

module.exports = { updateAllOwnedGamesAndAllUsers };