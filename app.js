import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import session from "express-session";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";
import GoogleSignin from "passport-google-oauth20";
import findOrCreate from "mongoose-findorcreate";

dotenv.config();
const GoogleStrategy = GoogleSignin.Strategy;

const app = express();

app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDB", {});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: {
    type: String,
    require: true,
    index: true,
    unique: true,
    sparse: true,
  },
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    (_accessToken, _refreshToken, profile, cb) => {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", (req, res) => {
  res.render("home");
});

app
  .route("/auth/google")
  .get(passport.authenticate("google", { scope: ["profile"] }));

app
  .route("/auth/google/secrets")
  .get(
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
      res.redirect("/secrets");
    }
  );

app
  .route("/register")
  .get((_req, res) => {
    res.render("register");
  })
  .post((req, res) => {
    User.register({ username: req.body.username }, req.body.password, err => {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/secrets");
        });
      }
    });
  });

app
  .route("/login")
  .get((_req, res) => {
    res.render("login");
  })
  .post((req, res) => {
    User.findOne({ username: req.body.username }, function (err, foundUser) {
      if (foundUser) {
        passport.authenticate("local", function (err, user) {
          if (err) {
            console.log(err);
          } else {
            if (user) {
              req.login(user, function (err) {
                res.redirect("/secrets");
              });
            } else {
              res.redirect("/login");
            }
          }
        })(req, res);
      } else {
        res.redirect("/login");
      }
    });
  });

app.route("/secrets").get((req, res) => {
  if (req.isAuthenticated()) {
    res.render("secrets");
  } else {
    res.redirect("/login");
  }
});

app.route("/logout").get((req, res) => {
  req.logout(err => {
    if (err) {
      console.log(err);
    }
  });
  res.redirect("/");
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
