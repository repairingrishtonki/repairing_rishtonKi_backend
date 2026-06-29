const orderService = require("../services/order.service")


const createOrder = async(req, res) => {
    const {amount, currency = "INR", receipt, userId, date} = req.body;
    if(userId === null || userId === undefined ){
        return res.status(400).send({message: "UserId can not be null when placing order"});
    }
     if (amount === undefined || amount === null) {
    return res.status(400).json({ error: "amount is required" });
  }
 
  const parsedAmount = parseInt(amount, 10);
 
  if (isNaN(parsedAmount) || parsedAmount < 100) {
    return res
      .status(400)
      .json({ error: "amount must be an integer >= 100 paise" });
  }
  const payload = JSON.stringify({
    amount: parsedAmount,
    currency,
    receipt: receipt || `receipt_${Date.now()}`,
  });

  const order = await orderService.createOrder(payload,userId, date);
  res.send(order)
}

const verifySignature = async(req,res) => {
     async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;
 
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message:
        "razorpay_order_id, razorpay_payment_id and razorpay_signature are all required",
    });
  }

  const verify = await orderService.verifySignature(razorpay_order_id,razorpay_payment_id,razorpay_signature);
  return res.json(verify)
  
}
}

module.exports = {
    createOrder,
    verifySignature
}