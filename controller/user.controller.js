const User = require("../models/user.model");

const getAllUsers = async (req, res, next) => {
  const users = User.find({});
  res.json(users);
};

const createUser = async (req, res, next) => {
    const {email,phone} = req.body;

  if (email || phone ) {
    const createUser = await User.create(req.body);
    return res.json(createUser)
  } else {
    res.send({ result: "One thing required either email or phone." });
  }
};

module.exports = {
  getAllUsers,
  createUser
};
