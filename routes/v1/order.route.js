
const express = require("express")
const orderController = require('../../controller/order.controller')
const router = express.Router();
const {getBookedSlots} = require('../../services/order.service')

router.route('/create-order').post(orderController.createOrder)

router.post("/verify-payment", orderController.verifySignature);

router.get("/bookings/slots", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Booking date is required.",
      });
    }

    const result = await getBookedSlots(date);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get booked slots error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router
