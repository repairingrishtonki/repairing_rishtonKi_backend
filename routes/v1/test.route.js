const express = require("express");

const router = express.Router();


router.route('/test').get((req,res,next) => {
    res.send("Hello from v1 test route")
})



module.exports = router

