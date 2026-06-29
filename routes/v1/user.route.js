const express = require("express");
const userController = require("../../controller/user.controller")
const router = express.Router();


router.route('/').get(userController.getAllUsers).post(userController.createUser)

module.exports = router