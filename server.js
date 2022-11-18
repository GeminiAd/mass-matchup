const path = require("path");
const express = require("express");
const session = require("express-session");
const exphbs = require("express-handlebars");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const request = require('request');
require('dotenv').config();
const { updateAllOwnedGamesAndAllUsers } = require('./utils/utils');

const ONE_DAY = 5184000000;
const ONE_HOUR = 3600000;
const ONE_MINUTE = 60000;
const FIVE_MINUTES = 300000;

const routes = require("./controllers");
const sequelize = require("./config/connection");
const helpers = require("./utils/helpers");

const app = express();
const PORT = process.env.PORT || 3001;

const sess = {
  secret: "Super secret secret",
  cookie: {
    maxAge: 864000,
    httpOnly: true,
    secure: false,
    sameSite: "strict",
  },
  resave: false,
  saveUninitialized: true,
  store: new SequelizeStore({
    db: sequelize,
  }),
};

app.use(session(sess));

const hbs = exphbs.create({ helpers });

app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
process.env.APIkey

app.use(routes);

sequelize.sync({ force: false }).then(() => {
  setInterval(updateAllOwnedGamesAndAllUsers, ONE_HOUR);

  app.listen(PORT, () => console.log("Now listening"));
});

