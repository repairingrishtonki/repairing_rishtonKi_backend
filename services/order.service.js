const mongoose = require("mongoose");
const https = require("https");
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const Order = require('../models/order.modal');

const createOrder = async(payload, userId,date) => {
 const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
 
  const options = {
    hostname: "api.razorpay.com",
    path: "/v1/orders",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      Authorization: `Basic ${auth}`,
    },
  };
 
  
  try {
    const order = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (response.statusCode >= 200 && response.statusCode < 300) {
              resolve(parsed);
            } else {
              reject({ statusCode: response.statusCode, body: parsed });
            }
          } catch {
            reject({ statusCode: response.statusCode, body: data });
          }
        });
      });
 
      request.on("error", reject);
      request.write(payload);
      request.end();
    });
    const saved = await Order.createFromRazorpay(order, { userId,date });

return {
  order_id: saved.orderId,
  amount: saved.amount,
  currency: saved.currency,
};
 
    return {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  } catch (err) {
    console.error("Razorpay error:", err);
 
    if (err.statusCode) {
      return {
        error: "Razorpay API error",
        details: err.body,
      }
    }
 
    return { error: "Internal server error" };
  }
}

const verifySignature = async(razorpay_order_id,razorpay_payment_id,razorpay_signature) => {
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
 
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
 
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(razorpay_signature, "hex")
  );
 
  if (!isValid) {
  
    await Order.markFailed(razorpay_order_id).catch(() => {}); 
 
    return {
      success: false,
      message: "Invalid signature",
    };
  }
 

  try {
    const order = await Order.markPaid(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
 
    if (!order) {
      // Payment is genuine but we have no record — still return success,
      // but flag it so you can reconcile manually.
      console.warn(
        `Verified payment for unknown order: ${razorpay_order_id}`
      );
    }
 
    return res.status(200).json({
      success: true,
      message: "Payment verified",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
  } catch (err) {
    console.error("DB update failed after signature verification:", err);
 
   
    return res.status(200).json({
      success: true,
      message: "Payment verified (DB update pending)",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
  }
}



module.exports = {
    createOrder
}