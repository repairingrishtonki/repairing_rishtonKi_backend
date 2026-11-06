
const mongoose = require("mongoose");

const slotReservationSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    status: {
      type: String,
      enum: ["pending", "paid", "released"],
      default: "pending",
      required: true,
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Only one reservation can exist for a particular date/time.
slotReservationSchema.index(
  { date: 1, time: 1 },
  { unique: true }
);

slotReservationSchema.index({ razorpayOrderId: 1 });

module.exports = mongoose.model(
  "SlotReservation",
  slotReservationSchema
);
