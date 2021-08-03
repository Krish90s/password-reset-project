const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/environment-variable");
const _ = require("lodash");
const { User, validate } = require("../models/user");
const express = require("express");
const router = express.Router();
require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const auth = require("../middleware/auth");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.send(user);
});

router.post("/", async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);
  let user = await User.findOne({ email: req.body.email });
  if (user) return res.status(400).send("User Already Registered");

  user = new User(_.pick(req.body, ["name", "email", "password"]));
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  user.active = false;
  const token = jwt.sign(
    {
      iss: "password-reset-workflow",
      sub: user.email,
      iat: new Date().getTime(),
      exp: new Date().setDate(new Date().getDate() + 1),
    },
    JWT_SECRET
  );
  user.secretToken = token;

  const msg = {
    to: user.email,
    from: "krishnanvenkat4@gmail.com", // Use the email address or domain you verified above
    subject: "Sending with Twilio SendGrid is Fun",
    text: `Hello, thanks for registering on our site.
    Please copy and paste the address below to verify your account.
    http://${req.headers.host}/api/users/verify-email?token=${user.secretToken}`,
    html: `<h1>Hello,</h1>
    <p>thanks for refistering on our site.</p>
    <p>Please click the link below to verify your account.</p>
    <a href="http://${req.headers.host}/api/users/verify-email?token=${user.secretToken}">Verify Your Account</a>`,
  };

  (async () => {
    try {
      await sgMail.send(msg);
    } catch (error) {
      console.error(error);

      if (error.response) {
        console.error(error.response.body);
      }
    }
  })();

  await user.save();

  res.send("Verify the account by clicking the link sent to your email");
});

router.get("/verify-email", async (req, res) => {
  let user = await User.findOne({ secretToken: req.query.token });
  if (!user) return res.status(400).send("Token is Invalid");

  const token = jwt.sign(
    {
      iss: "password-reset-workflow",
      sub: user.email,
      iat: new Date().getTime(),
      exp: new Date().setDate(new Date().getDate() + 1),
    },
    JWT_SECRET
  );
  user.secretToken = null;
  user.active = true;
  await user.save();
  res.header("x-auth-token", token).send("Your Account is Verified");
});

module.exports = router;
