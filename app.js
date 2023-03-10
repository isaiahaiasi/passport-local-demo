const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const mongoose = require("mongoose");
const morgan = require("morgan");
const bcrypt = require("bcryptjs");
require('dotenv').config();

const Schema = mongoose.Schema;

const mongoConnectionUrl = process.env.MONGODB_URI;
mongoose.connect(mongoConnectionUrl, {
  useNewUrlParser: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Mongo connection error"));
db.on("open", console.log.bind(console, "Mongo connection opened"));

const User = mongoose.model(
  "User",
  new Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
  })
);

const localStrategyCallback = (username, password, done) => {
  User.findOne({ username }, (err, user) => {
    if (err) {
      return done(err);
    }


    if (!user) {
      return done(null, false, { message: "Incorrect username" });
    }

    bcrypt.compare(password, user.password, (err, res) => {
      if (err) {
        return done(err);
      }

      if (res) {
        return done(null, user);
      }

      return done(null, false, { message: "Incorrect password" });
    });
  });
}

passport.use(new LocalStrategy(localStrategyCallback));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

// ! This takes the session error message Passport added to req.session
// ! And adds it to res.locals so we can access it in our views
app.use((req, res, next) => {
  if (req.session.messages) {
    res.locals.errorMessage = req.session.messages.at(-1);

    // To see why we're accessing the last index in the `messages` array, try:
    // console.log(req.session.messages)
  }
  next();
});

app.get("/", (req, res) => {
  res.render("index")
});

app.get("/sign-up", (req, res) => {
  res.render("sign-up-form")
});

app.get("/log-out", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.post("/sign-up", (req, res, next) => {
  bcrypt.hash(req.body.password, 10, (err, hashedPassword) => {
    if (err) {
      next(err);
    }

    new User({
      username: req.body.username,
      password: hashedPassword,
    }).save((err) => {
      if (err) {
        return next(err);
      }

      res.redirect("/");
    });
  })
});

app.post("/log-in", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/",

  // It seems like this flag (or `failureFlash`) must be enabled
  // in order to actually do anything with the error info you pass
  // as the third argument to `done()` in `localStrategyCallback`
  failureMessage: true,
}));

const port = process.env.PORT ?? 3000;

app.listen(port, () => console.log(`app listening on port ${port}!`));