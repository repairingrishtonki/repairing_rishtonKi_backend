
const express = require("express")
const orderController = require('../../controller/order.controller')
const router = express.Router();


router.route('/create-order').post(orderController.createOrder)

router.post("/verify-payment", orderController.verifySignature);

module.exports = router
