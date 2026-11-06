
const https = require("https");
const crypto = require("crypto");

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const Order = require("../models/order.modal");
const SlotReservation = require("../models/slotReservation.model");

const BOOKING_TIMEZONE = "Asia/Kolkata";
const RESERVATION_MINUTES = 10;

// All available slots: 10 AM - 8 PM, every 30 minutes.
const TIME_SLOTS = Array.from({ length: 21 }, (_, index) => {
  const totalMinutes = 10 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

// Convert ISO date into Indian date/time.
const getIndianDateTime = (dateInput) => {
  const date = new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid booking date.");
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BOOKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    timestamp: date,
  };
};

// Validate the booking time.
const validateBookingDate = (dateInput) => {
  const selected = getIndianDateTime(dateInput);

  if (!TIME_SLOTS.includes(selected.time)) {
    throw new Error(
      "Please select a time between 10 AM and 8 PM in 30-minute intervals."
    );
  }

  if (selected.timestamp.getTime() <= Date.now()) {
    throw new Error("Please select a future booking time.");
  }

  return selected;
};

// Get booked and temporarily reserved slots.
const getBookedSlots = async (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  const now = new Date();

  const reservations = await SlotReservation.find({
    date,
    $or: [
      { status: "paid" },
      {
        status: "pending",
        expiresAt: { $gt: now },
      },
    ],
  }).select("time status -_id");

  return {
    date,
    bookedSlots: reservations.map((item) => item.time),
  };
};

// Atomically reserve a slot.
// A unique index prevents simultaneous bookings.
const reserveSlot = async (date, time, userId) => {
  const now = new Date();

  const expiresAt = new Date(
    now.getTime() + RESERVATION_MINUTES * 60 * 1000
  );

  try {
    const reservation = await SlotReservation.findOneAndUpdate(
      {
        date,
        time,
        $or: [
          { status: "released" },
          {
            status: "pending",
            expiresAt: { $lte: now },
          },
        ],
      },
      {
        $set: {
          userId,
          status: "pending",
          expiresAt,
          razorpayOrderId: null,
        },
        $setOnInsert: {
          date,
          time,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    return reservation;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("This time slot is already booked. Please select another slot.");
    }

    throw error;
  }
};

// Release a reservation.
const releaseReservation = async (reservationId) => {
  await SlotReservation.findByIdAndUpdate(reservationId, {
    $set: {
      status: "released",
      razorpayOrderId: null,
    },
  });
};

// Create Razorpay order and reserve the selected slot.
const createOrder = async (payload, userId, date) => {
  let reservation = null;

  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials are not configured.");
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID.");
    }

    const selected = validateBookingDate(date);

    // Reserve BEFORE contacting Razorpay.
    reservation = await reserveSlot(
      selected.date,
      selected.time,
      userId
    );

    const auth = Buffer.from(
      `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
    ).toString("base64");

    const requestBody =
      typeof payload === "string"
        ? payload
        : JSON.stringify(payload);

    const order = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.razorpay.com",
        path: "/v1/orders",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
          Authorization: `Basic ${auth}`,
        },
      };

      const request = https.request(options, (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          try {
            const parsed = JSON.parse(data);

            if (
              response.statusCode >= 200 &&
              response.statusCode < 300
            ) {
              resolve(parsed);
            } else {
              reject({
                statusCode: response.statusCode,
                body: parsed,
              });
            }
          } catch {
            reject({
              statusCode: response.statusCode,
              body: data,
            });
          }
        });
      });

      request.on("error", reject);
      request.write(requestBody);
      request.end();
    });

    // Save Razorpay order in your existing Order model.
    const saved = await Order.createFromRazorpay(order, {
      userId,
      date: selected.timestamp.toISOString(),
    });

    // Link the Razorpay order with its slot reservation.
    await SlotReservation.findByIdAndUpdate(
      reservation._id,
      {
        $set: {
          razorpayOrderId: order.id,
        },
      }
    );

    return {
      order_id: saved.orderId,
      amount: saved.amount,
      currency: saved.currency,
    };
  } catch (error) {
    console.error("Create order error:", error);

    // Release the slot if order creation failed.
    if (reservation) {
      await releaseReservation(reservation._id).catch(
        console.error
      );
    }

    if (error.statusCode) {
      return {
        error: "Razorpay API error",
        details: error.body,
      };
    }

    return {
      error: error.message || "Internal server error",
    };
  }
};

// Verify Razorpay payment signature.
const verifySignature = async (
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
) => {
  try {
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (
      typeof razorpay_signature !== "string" ||
      !/^[a-f0-9]{64}$/i.test(razorpay_signature)
    ) {
      return {
        success: false,
        message: "Invalid signature",
      };
    }

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(razorpay_signature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return {
        success: false,
        message: "Invalid signature",
      };
    }

    // Mark the payment as paid in your existing Order model.
    const order = await Order.markPaid(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!order) {
      console.warn(
        `Verified payment for unknown order: ${razorpay_order_id}`
      );

      return {
        success: true,
        message: "Payment verified, but order requires reconciliation.",
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      };
    }

    // Permanently occupy the slot.
    const reservation = await SlotReservation.findOneAndUpdate(
      {
        razorpayOrderId: razorpay_order_id,
        status: "pending",
      },
      {
        $set: {
          status: "paid",
          expiresAt: new Date("9999-12-31T23:59:59.999Z"),
        },
      },
      { new: true }
    );

    if (!reservation) {
      console.error(
        `Payment verified but slot reservation missing: ${razorpay_order_id}`
      );
    }

    return {
      success: true,
      message: "Payment verified",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      slotConfirmed: !!reservation,
    };
  } catch (error) {
    console.error("Payment verification error:", error);

    return {
      success: true,
      message: "Payment verified. Database update requires reconciliation.",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      reconciliationRequired: true,
    };
  }
};

// Release a slot when a payment failure/cancellation is confirmed
// by a trusted payment event or your verified server-side workflow.
const releaseFailedOrder = async (razorpay_order_id) => {
  const reservation = await SlotReservation.findOneAndUpdate(
    {
      razorpayOrderId: razorpay_order_id,
      status: "pending",
    },
    {
      $set: {
        status: "released",
        razorpayOrderId: null,
      },
    },
    { new: true }
  );

  return !!reservation;
};

module.exports = {
  createOrder,
  getBookedSlots,
  verifySignature,
  releaseFailedOrder,
  TIME_SLOTS,
};
