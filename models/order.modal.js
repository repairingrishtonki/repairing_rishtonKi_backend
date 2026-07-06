const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {

    orderId: {
      type: String,
      required: true,
      unique: true,        
      index: true,
    },
    paymentId: {
      type: String,
      default: null,       
    },
    signature: {
      type: String,
      default: null,      
    },

 
    amount: {
      type: Number,
      required: true,     
      min: 100,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
      uppercase: true,
      trim: true,
    },
    receipt: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["created", "attempted", "paid", "failed"],
      default: "created",
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    date: {
      type: Date,
      required: true,
      default: Date.now()
    },

    notes: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,     
  }
);

orderSchema.virtual("amountInRupees").get(function () {
  return this.amount / 100;
});

orderSchema.statics.createFromRazorpay = async function (
  razorpayOrder,
  { userId = null, notes = {} } = {}
) {
  return this.create({
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    receipt: razorpayOrder.receipt,
    status: razorpayOrder.status,  
    userId,
    notes,
  });
};

orderSchema.statics.markPaid = async function (orderId, paymentId, signature) {
  return this.findOneAndUpdate(
    { orderId },
    { status: "paid", paymentId, signature },
    { new: true }
  );
};

orderSchema.statics.markFailed = async function (orderId) {
  return this.findOneAndUpdate(
    { orderId },
    { status: "failed" },
    { new: true }
  );
};

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;