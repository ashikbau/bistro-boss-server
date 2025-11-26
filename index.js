const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const bodyParser = require('body-parser');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const formatPhone = require("./utils/formatPhone");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "http://localhost:5000"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  })
);

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Twilio setup
const twilioClient = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const twilioFrom = process.env.TWILIO_PHONE;

// MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jmgafd7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware to block Admin & staff from adding to cart
function blockNonUsers(req, res, next) {
  if (!req.decoded) {
    return res.status(401).send({ message: "Unauthorized access." });
  }

  const role = req.decoded.role;

  if (role === "admin" || role === "staff") {
    return res.status(403).send({
      message: `${role === "admin" ? "Admins" : "Staff members"} are not allowed to place orders.`,
    });
  }

  next();
}

const blockAdminsFromOrdering = (req, res, next) => {
  // Ensure token has already been verified
  if (req.decoded && req.decoded.role === 'admin') {
    return res.status(403).send({ message: "Admins are not allowed to place orders or bookings." });
  }
  next();
};

const blockStaffFromOrdering = (req, res, next) => {
  // Ensure token has already been verified
  if (req.decoded && req.decoded.role === 'staff') {
    return res.status(403).send({ message: "Staff are not allowed to place orders or bookings." });
  }
  next();
}


async function run() {
  try {
    await client.connect();
    const db = client.db("bistroDb");

    const userCollection = db.collection("users");
    const menuCollection = db.collection("menu");
    const reviewCollection = db.collection("reviews");
    const cartCollection = db.collection("carts");
    const orderCollection = db.collection("orders");
    const bookingCollections = db.collection("bookings");
    const messagesCollection = db.collection("messages");
    const StaffOrderCollections = db.collection("StaffOrder");
    const StaffBookingCollection = db.collection("staffbookings");





    console.log("Connected to MongoDB");



    // JWT route
    app.post('/jwt', async (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send({ message: "Email is required to generate token" });
      }
      const foundUser = await userCollection.findOne({ email });
      if (!foundUser) {
        return res.status(404).send({ message: "User not found" });
      }
      const role = foundUser.role || 'user';
      const payload = { email, role };
      const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.json({ token, role });
    });

    const verifyToken = (req, res, next) => {
      // Check if the authorization header is present
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "No authorization header" });
      }

      // Extract the token from the Authorization header
      const token = req.headers.authorization.split(' ')[1];

      if (!token) {
        return res.status(401).send({ message: "No token provided" });
      }

      // console.log('Token:', token);  // Log token to check if it's being passed correctly

      // Verify the token
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Invalid or expired token" });
        }

        // Log the decoded token to check its contents
        // console.log('Decoded Token:', decoded);

        // Attach the decoded token to req.decoded
        req.decoded = decoded;
        req.user = decoded;

        // Proceed to the next middleware or route handler
        next();
      });
    };




    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded.email;


        const user = await userCollection.findOne({ email });

        if (!user || user.role !== 'admin') {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      } catch (err) {
        console.error('verifyAdmin error:', err);
        res.status(500).send({ message: 'Server Error in verifyAdmin' });
      }
    };

    const verifyStaff = async (req, res, next) => {
      try {

        const email = req.decoded.email;
        const user = await userCollection.findOne({ email });
        if (!user || user.role !== 'staff') {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      } catch (err) {
        console.error('verifyStaff error:', err);
        res.status(500).send({ message: 'Server Error in verifyStaff' });
      }
    };

    // Users API: get all users
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const users = await userCollection.estimatedDocumentCount();
        const menuItems = await menuCollection.estimatedDocumentCount();
        res.send({ users, menuItems });
      } catch (error) {
        console.error("Error getting admin stats:", error);
        res.status(500).send({ message: "Failed to fetch admin stats" });
      }
    });

    app.get('/staff-stats', verifyToken, verifyStaff, async (req, res) => {
      try {
        const bookings = await bookingCollections.estimatedDocumentCount();
        const orders = await orderCollection.estimatedDocumentCount();

        res.send({ bookings, orders });
      } catch (error) {
        console.error("Error getting staff stats:", error);
        res.status(500).send({ error: "Failed to fetch staff stats" });
      }
    });

    app.get('/staffOnly-stats', verifyToken, verifyStaff, async (req, res) => {
      try {
        const staffEmail = req.user.email;

        const bookings = await StaffBookingCollection
          .find({ createdBy: staffEmail })
          .toArray();

        const orders = await StaffOrderCollections
          .find({ createdBy: staffEmail })
          .toArray();

        res.send({ bookings, orders });
      } catch (error) {
        console.error("Error getting staff stats:", error);
        res.status(500).send({ error: "Failed to fetch staff stats" });
      }
    });


    app.get('/user-stats', verifyToken, async (req, res) => {
      try {
        const email = req.decoded.email;  // Get email from decoded token

        // Fetch reviews by user email
        const reviews = await reviewCollection.find({ userEmail: email }).toArray();

        // Fetch cart items by user email
        const cart = await cartCollection.find({ email }).toArray();

        // Fetch bookings by user email
        const bookings = await bookingCollections.find({ email }).toArray();

        res.json({ reviews, cart, bookings });
      } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    });


    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Register user

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      // Set default role to user if not present
      if (!user.role) {
        user.role = "user";
      }
      // Optionally hash password if needed (if this is part of auth)
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Promote to admin
    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { role: "admin" } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Promote to staff
    app.patch("/users/staff/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { role: "staff" } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/users/demote/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: { role: "user" } };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (err) {
        console.error("Demote user error:", err);
        res.status(500).send({ message: "Server error while demoting user" });
      }
    });

    // Delete user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // Check if user is admin by email
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Unauthorised Access' });
      }
      const user = await userCollection.findOne({ email });
      let admin = false;
      if (user && user.role === "admin") {
        admin = true;
      }
      res.send({ admin });
    });

    // Get user role
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      if (user) {
        return res.send({ role: user.role });
      }
      res.status(404).send({ message: 'User not found' });
    });
    app.get('/users/staff/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Unauthorized Access' });
      }

      const user = await userCollection.findOne({ email });

      const role = user?.role || "user";
      const isStaff = role === "staff";

      // ✅ Return BOTH
      res.send({
        staff: isStaff,   // boolean
        role: role        // "admin" | "staff" | "user"
      });
    });


    // Menu APIs
    app.get('/menu/count', async (req, res) => {
      const count = await menuCollection.estimatedDocumentCount();
      res.json({ total: count });
    });

    app.get('/menu/:id', async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid ID" });

        const item = await menuCollection.findOne({ _id: new ObjectId(id) });
        if (!item) return res.status(404).json({ message: "Item not found" });

        res.json(item); //  Always return JSON
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
      }
    });

    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    app.get('/menu', async (req, res) => {
      try {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);
        const category = req.query.category;
        const isFeatured = req.query.featured;
        const query = {};
        if (category) query.category = category;
        if (isFeatured === 'true') query.featured = true;

        if (!isNaN(page) && !isNaN(limit)) {
          const skip = (page - 1) * limit;
          const total = await menuCollection.countDocuments(query);
          const items = await menuCollection.find(query).skip(skip).limit(limit).toArray();
          return res.json({ total, items });
        }

        const allItems = await menuCollection.find(query).toArray();
        res.json(allItems);
      } catch (error) {
        console.error("Error fetching menu:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
          featured: item.featured // include this
        }
      };
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.json(result);
    });



    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.patch('/menu/feature/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { featured } = req.body;
      try {
        const result = await menuCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { featured: featured } }
        );
        res.json(result);
      } catch (err) {
        console.error('Error updating featured status:', err);
        res.status(500).send({ error: 'Something went wrong' });
      }
    });

    // Review APIs

    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post("/addReview", verifyToken, async (req, res) => {
      const { name, rating, details } = req.body;
      const userEmail = req.decoded?.email;
      const userRole = req.decoded?.role;

      if (userRole !== 'user') {
        return res.status(403).json({ error: "Only regular users can post reviews" });
      }
      if (!name || !rating || !details || !userEmail) {
        return res.status(400).json({ error: "Missing fields" });
      }
      const newReview = {
        name,
        rating,
        details,
        userEmail,
        createdAt: new Date(),
      };
      const result = await reviewCollection.insertOne(newReview);
      res.status(201).json({ insertedId: result.insertedId });
    });

    app.get("/myReviews", verifyToken, async (req, res) => {
      const userRole = req.decoded?.role;
      console.log(userRole)
      if (userRole !== 'user') {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { email } = req.query;
      const reviews = await reviewCollection.find({ userEmail: email }).toArray();
      res.json(reviews);
    });

    app.put("/myReviews/:id", verifyToken, async (req, res) => {
      const userRole = req.decoded?.role;
      if (userRole !== 'user') {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { id } = req.params;
      const { rating, details } = req.body;
      const result = await reviewCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { rating, details } }
      );
      res.json(result);
    });

    app.delete("/myReviews/:id", verifyToken, async (req, res) => {
      const userRole = req.decoded?.role;
      if (userRole !== 'user') {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { id } = req.params;
      const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // Cart operations
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/carts', verifyToken, blockAdminsFromOrdering, blockStaffFromOrdering, async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.post("/staffCart", verifyToken, blockAdminsFromOrdering, async (req, res) => {
      const cartItem = req.body;
      const result = await StaffOrderCollections.insertOne(cartItem);
      res.send(result);
    });

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Orders
    app.get('/orders/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // order by staff
    // POST /api/staff-orders
    app.post("/api/staff-orders", verifyToken, verifyStaff, async (req, res) => {
      try {
        const { customerEmail, customerPhone, items } = req.body;
        console.log("🧾 Incoming order:", req.body);

        if (!customerEmail || !customerPhone || !items || items.length === 0) {
          return res.status(400).send({ message: "Missing required fields" });
        }

        //  Use req.decoded.email instead of req.user.email
        const createdBy = req.decoded?.email;
        if (!createdBy) {
          return res.status(401).send({ message: "Unauthorized: No staff email found in token" });
        }

        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const order = {
          customerEmail,
          customerPhone,
          items,
          createdBy,
          total,
          status: "pending",
          createdAt: new Date(),
        };

        const result = await StaffOrderCollections.insertOne(order);

        res.status(201).send({
          message: "Order created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error(" Error creating staff order:", error);
        res.status(500).send({ message: "Failed to create order" });
      }
    });

    // Get all orders
    app.get("/viewStaffOrder", async (req, res) => {
      try {
        const orders = await StaffOrderCollections
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.json(orders);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // Get order by ID
    app.get("/viewStaffOrder/:id", async (req, res) => {
      try {
        const order = await StaffOrderCollections.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }

        res.json(order);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
  


    // user payment intent

    app.post('/create-payment-intent', verifyToken, async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  });

  // Staff payment intent

  app.post("/api/staff-orders/create-payment", verifyToken, async (req, res) => {
    try {
      const { customerEmail, customerPhone, items } = req.body;
      const createdBy = req.decoded?.email; // staff email from token

      if (!items || items.length === 0) {
        return res.status(400).send({ message: "No items in order" });
      }

      // Calculate total amount
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Save the pending order in DB
      const newOrder = {
        createdBy,
        customerEmail,
        customerPhone,
        items,
        total,
        paymentStatus: "Pending",
        createdAt: new Date(),
      };

      const result = await StaffOrderCollections.insertOne(newOrder);

      // Stripe line items
      const lineItems = items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100), // Stripe expects cents
        },
        quantity: item.quantity,
      }));

      // Create Stripe Checkout session (only send small metadata)
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: lineItems,
        customer_email: customerEmail,
        success_url: "http://localhost:5173/payment-success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:5173/payment-cancel",
        metadata: {
          orderId: result.insertedId.toString(),
          createdBy,
        },
      });

      res.send({ url: session.url });
    } catch (error) {
      console.error(" Error creating Stripe payment link:", error);
      res.status(500).send({ message: "Failed to create payment session" });
    }
  });

  // Webhook for Stripe payment
  app.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error("Stripe signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        try {
          const { createdBy, customerEmail, customerPhone, items, total } =
            session.metadata;

          // Format the phone number
          const formattedPhone = formatPhone(customerPhone);

          if (!formattedPhone) {
            console.warn(
              "Invalid phone number from Stripe metadata:",
              customerPhone
            );
          }

          const parsedItems = JSON.parse(items);
          const orderTotal =
            Number(total) ||
            parsedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

          const order = {
            createdBy,
            customerEmail,
            customerPhone: formattedPhone, // safe formatted phone
            items: parsedItems,
            total: orderTotal,
            paymentIntent: session.payment_intent,
            status: "paid",
            createdAt: new Date(),
          };

          // Save order in MongoDB
          await StaffOrderCollections.insertOne(order);

          const name = customerEmail.split("@")[0];

          // Send Email
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: customerEmail, // Email goes to the customer email
            subject: "Your Bistro Boss Order is Confirmed",
            text: `Hi ${name},\n\nThank you for your order of $${orderTotal}.\n\nWe’ve received your payment and are preparing your order.\n\nBest regards,\nBistro Boss Team`,
          });

          // Send SMS only if phone is valid
          if (formattedPhone) {
            await twilioClient.messages.create({
              body: `Hi ${name}, your Bistro Boss order of $${orderTotal} has been successfully paid!`,
              from: process.env.TWILIO_PHONE,
              to: formattedPhone,
            });
          } else {
            console.warn("SMS skipped due to invalid phone number.");
          }

          console.log("Staff order saved and notifications sent:", order);
        } catch (error) {
          console.error(
            "Failed to save staff order or send notifications:",
            error
          );
        }
      }

      res.status(200).send({ received: true });
    }
  );
  //  Verify payment after redirect

  // ------------------------------
  app.post("/verify-payment", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ success: false, message: "Missing sessionId" });
      }

      // Retrieve the Stripe session
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return res.status(400).json({ success: false, message: "Payment not completed" });
      }

      const orderId = session.metadata?.orderId;
      const customerEmail = session.customer_details?.email;
      const customerName = session.customer_details?.name || "Customer";
      const rawPhone = session.metadata?.customerPhone || "";

      if (!orderId) {
        console.error("No orderId found in session metadata");
        return res.status(400).json({ success: false, message: "Order ID missing" });
      }

      // Format the phone number
      const formattedPhone = formatPhone(rawPhone);
      if (!formattedPhone && rawPhone) {
        console.warn("Invalid customer phone number:", rawPhone);
      }

      // Update the order in DB
      const updateResult = await StaffOrderCollections.updateOne(
        { _id: new ObjectId(orderId) },
        {
          $set: {
            paymentStatus: "Paid",
            stripeSessionId: session.id,
            updatedAt: new Date(),
          },
        }
      );

      // Fetch updated order for response
      const updatedOrder = await StaffOrderCollections.findOne({ _id: new ObjectId(orderId) });

      // Send confirmation email
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: customerEmail,
          subject: "Your Order is Confirmed - Bistro Boss",
          text: `Hi ${customerName},\n\nThank you for your order of $${updatedOrder.total}.\n\nWe’ve received it successfully and are preparing it.\n\nBest regards,\nBistro Boss Team`,
        });
        console.log("Email sent successfully");
      } catch (emailErr) {
        console.error("Email sending failed:", emailErr);
      }

      // Send SMS only if phone is valid
      if (formattedPhone) {
        try {
          await twilioClient.messages.create({
            body: `Hi ${customerName}, your order of $${updatedOrder.total} has been successfully paid. Thanks for choosing Bistro Boss!`,
            from: process.env.TWILIO_PHONE,
            to: formattedPhone,
          });
          console.log("SMS sent successfully");
        } catch (smsErr) {
          console.error("SMS sending failed:", smsErr);
        }
      } else if (rawPhone) {
        console.warn("SMS skipped due to invalid phone number.");
      }

      return res.json({ success: true, message: "Payment verified", order: updatedOrder });
    } catch (error) {
      console.error("Error verifying payment:", error);
      return res.status(500).json({ success: false, message: "Server error verifying payment" });
    }
  });


  app.post('/orders', verifyToken, blockNonUsers, async (req, res) => {
    const order = req.body;

    try {
      // Save order to database
      const orderResult = await orderCollection.insertOne(order);

      // Delete items from cart if needed
      if (order.cartIds && order.cartIds.length > 0) {
        const query = {
          _id: { $in: order.cartIds.map(id => new ObjectId(id)) }
        };
        await cartCollection.deleteMany(query);
      }

      const name = order.name || "Customer";
      const email = order.email;
      const phone = order.phone;
      const amount = order.price;

      // Format phone number for Twilio
      const formattedPhone = formatPhone(phone);

      if (!formattedPhone) {
        console.warn("Invalid phone number:", phone);
      }

      // Send Email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email, // Email goes to customer email
        subject: "Order Confirmation - Bistro Boss",
        text: `Hi ${name},\n\nThank you for your order of $${amount}.\n\nWe’ve received it successfully and are now preparing it.\n\nBest regards,\nBistro Boss Team`
      });

      // Send SMS only if phone is valid
      if (formattedPhone) {
        await twilioClient.messages.create({
          body: `Hi ${name}, your order of $${amount} was successful. Thanks for choosing Bistro Boss!`,
          from: process.env.TWILIO_PHONE,
          to: formattedPhone
        });
      } else {
        console.warn("SMS skipped due to invalid phone number.");
      }

      res.send({ orderResult, success: true });

    } catch (error) {
      console.error("Order processing error:", error);
      res.status(500).send({
        message: "Order saved but notification failed.",
        error: error.message
      });
    }
  });


  // Booking (slots & admin/managing booking)

  function generateSlots() {
    return ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
  }

  app.get('/managebooking', verifyToken, verifyAdmin, async (req, res) => {
    const bookings = await bookingCollections.find({}).toArray();
    res.send(bookings);
  });

  app.get('/api/slots', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });
    const maxPerSlot = 50;
    const times = generateSlots();

    const bookings = await bookingCollections.aggregate([
      { $match: { date } },
      { $group: { _id: '$time', count: { $sum: '$guests' } } }
    ]).toArray();

    const bookingsMap = {};
    bookings.forEach(b => bookingsMap[b._id] = b.count);

    const slots = times.map(time => {
      const booked = bookingsMap[time] || 0;
      return {
        time,
        available: booked < maxPerSlot,
        remaining: maxPerSlot - booked
      };
    });

    res.json(slots);
  });

  app.post('/api/book', async (req, res) => {
    try {
      const { date, time, name, phone, guests, email } = req.body;

      // Validate required fields
      if (!date || !time || !name || !guests || !email || !phone) {
        return res.status(400).json({ error: 'All fields required' });
      }

      // Validate guests count
      const guestsCount = parseInt(guests, 10);
      if (isNaN(guestsCount) || guestsCount <= 0) {
        return res.status(400).json({ error: 'Invalid guests number' });
      }

      const maxPerSlot = 50;

      // Check existing bookings for this slot
      const existing = await bookingCollections.aggregate([
        { $match: { date, time } },
        { $group: { _id: '$time', count: { $sum: '$guests' } } }
      ]).toArray();

      const currentCount = existing[0]?.count || 0;
      if (currentCount + guestsCount > maxPerSlot) {
        return res.status(409).json({ error: 'Slot full, not enough space' });
      }

      // Format phone number
      const formattedPhone = formatPhone(phone);
      if (!formattedPhone) {
        console.warn("Invalid phone number for booking:", phone);
      }

      const booking = { date, time, name, email, phone: formattedPhone, guests: guestsCount };

      // Insert booking
      const result = await bookingCollections.insertOne(booking);

      // Send email notification
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Booking Confirmation',
          text: `Hi ${name}, your booking is confirmed for ${date} at ${time}. Guests: ${guestsCount}`
        });
        console.log("Booking email sent successfully");
      } catch (emailErr) {
        console.error("Booking email failed:", emailErr);
      }

      // Send SMS only if phone is valid
      if (formattedPhone) {
        try {
          await twilioClient.messages.create({
            body: `Hi ${name}, your booking on ${date} at ${time} for ${guestsCount} guests is confirmed.`,
            from: process.env.TWILIO_PHONE,
            to: formattedPhone,
          });
          console.log("Booking SMS sent successfully");
        } catch (smsErr) {
          console.error("Booking SMS failed:", smsErr);
        }
      } else {
        console.warn("SMS skipped due to invalid phone number.");
      }

      res.send({ success: true, id: result.insertedId });
    } catch (error) {
      console.error("Error processing booking:", error);
      res.status(500).json({ error: "Server error processing booking" });
    }
  });
  // Staff Booking Endpoint
  app.post("/staff-bookings", verifyToken, async (req, res) => {
    try {
      const { customerEmail, customerPhone, date, time, name, createdBy } = req.body;

      // ✅ Validate required fields
      if (!customerEmail || !customerPhone || !date || !time || !name) {
        return res.status(400).json({ message: "All booking details are required." });
      }

      // ✅ Format phone number
      const formattedPhone = formatPhone(customerPhone);
      if (!formattedPhone) {
        console.warn("Invalid staff booking phone number:", customerPhone);
      }

      // ✅ Prepare booking data
      const booking = {
        createdBy, // staff email
        customerEmail,
        customerPhone: formattedPhone, // safe formatted phone
        name,
        date,
        time,
        status: "confirmed",
        createdAt: new Date(),
      };

      // Save booking to MongoDB
      const result = await StaffBookingCollection.insertOne(booking);

      // Send Email Notification
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: customerEmail,
          subject: "Booking Confirmed - Bistro Boss",
          text: `Hi ${name}, your booking is confirmed on ${date} at ${time}. Thank you for choosing Bistro Boss!`,
        });
        console.log("Staff booking email sent successfully");
      } catch (emailErr) {
        console.error("Staff booking email failed:", emailErr);
      }

      // Send SMS Notification (only if phone is valid)
      if (formattedPhone) {
        try {
          await twilioClient.messages.create({
            body: `Hi ${name}, your booking is confirmed on ${date} at ${time}. Bistro Boss thanks you!`,
            from: process.env.TWILIO_PHONE,
            to: formattedPhone,
          });
          console.log("Staff booking SMS sent successfully");
        } catch (smsErr) {
          console.error("Staff booking SMS failed:", smsErr);
        }
      } else {
        console.warn("SMS skipped due to invalid phone number.");
      }

      // ✅ Return response
      res.status(201).json({
        success: true,
        bookingId: result.insertedId,
        booking,
      });

    } catch (err) {
      console.error("Failed to create staff booking:", err);
      res.status(500).json({
        message: "Booking failed",
        error: err.message,
      });
    }
  });
  // Staff can edit booking date and time
  app.patch('/staff-bookings/:id', verifyToken, verifyStaff, async (req, res) => {
    try {
      const { id } = req.params;
      const staffEmail = req.user.email;
      const { date, time } = req.body;

      // 1️⃣ Find booking first (to get customer details)
      const booking = await StaffBookingCollection.findOne({
        _id: new ObjectId(id),
        createdBy: staffEmail
      });

      if (!booking) {
        return res.status(403).send({
          success: false,
          message: "Booking not found or not owned by this staff member"
        });
      }

      // 2️⃣ Update booking in DB
      await StaffBookingCollection.updateOne(
        { _id: new ObjectId(id), createdBy: staffEmail },
        {
          $set: {
            date,
            time,
            updatedAt: new Date()
          }
        }
      );

      // Format customer phone number
      const formattedPhone = formatPhone(booking.customerPhone);
      if (!formattedPhone) {
        console.warn("Invalid phone number for booking update:", booking.customerPhone);
      }

      // 3️⃣ Send Email Notification to Customer
      try {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: booking.customerEmail,
          subject: "Your Booking Has Been Updated",
          html: `
          <h3>Your Booking Has Been Updated</h3>
          <p>Hello ${booking.name},</p>
          <p>Your booking details have been updated.</p>
          <p><strong>New Schedule:</strong></p>
          <ul>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Time:</strong> ${time}</li>
          </ul>
          <p>If you did not request this change, please contact support.</p>
        `
        });
        console.log("Booking update email sent successfully");
      } catch (emailErr) {
        console.error("Booking update email failed:", emailErr);
      }

      // 4️⃣ Send SMS Notification to Customer if phone is valid
      if (formattedPhone) {
        try {
          await twilioClient.messages.create({
            from: process.env.TWILIO_PHONE,
            to: formattedPhone,
            body: `Hello ${booking.name}, your booking has been updated to ${date} at ${time}.`
          });
          console.log("Booking update SMS sent successfully");
        } catch (smsErr) {
          console.error("Booking update SMS failed:", smsErr);
        }
      } else {
        console.warn("SMS skipped due to invalid phone number.");
      }

      // 5️⃣ Final response
      res.send({
        success: true,
        message: "Booking updated & customer notified"
      });

    } catch (err) {
      console.error("Error updating booking:", err);
      res.status(500).send({ success: false, message: "Failed to update booking" });
    }
  });

  app.get('/staff-bookings', verifyToken, verifyStaff, async (req, res) => {
    const email = req.user.email; // Accessing the email from the decoded token

    try {
      const bookings = await StaffBookingCollection
        .find({ createdBy: email })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(bookings);
    } catch (err) {
      console.error("Failed to fetch staff bookings:", err);
      res.status(500).send({ message: "Failed to load bookings" });
    }
  });

  // delete staffbookings
  app.delete("/staff-bookings/:id", verifyToken, verifyStaff, async (req, res) => {
    const id = req.params.id;
    const staffEmail = req.user.email; // Staff identity from token

    try {
      // 1️⃣ Find booking first — so we can notify the customer
      const booking = await StaffBookingCollection.findOne({
        _id: new ObjectId(id),
        createdBy: staffEmail
      });

      if (!booking) {
        return res.status(403).send({
          success: false,
          message: "Booking not found or not owned by staff"
        });
      }

      // Format customer phone number
      const formattedPhone = formatPhone(booking.customerPhone);
      if (!formattedPhone && booking.customerPhone) {
        console.warn("Invalid phone number for booking cancellation:", booking.customerPhone);
      }

      // 2️⃣ Delete booking
      await StaffBookingCollection.deleteOne({
        _id: new ObjectId(id),
        createdBy: staffEmail
      });

      // --- NOTIFICATIONS (Best Effort) ---

      // 3️⃣ Send Email (Nodemailer)
      try {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: booking.customerEmail,
          subject: "Your Booking Has Been Cancelled",
          html: `
          <h3>Your Booking Was Cancelled</h3>
          <p>Hello ${booking.name},</p>
          <p>Your booking scheduled for:</p>
          <ul>
            <li><strong>Date:</strong> ${booking.date}</li>
            <li><strong>Time:</strong> ${booking.time}</li>
          </ul>
          <p>has been cancelled by our staff team.</p>
          <p>If this was a mistake, please contact support.</p>
        `
        });
        console.log("Booking cancellation email sent successfully");
      } catch (emailError) {
        console.error("Booking cancellation email failed:", emailError);
      }

      // 4️⃣ Send SMS (Twilio) only if phone is valid
      if (formattedPhone) {
        try {
          await twilioClient.messages.create({
            from: process.env.TWILIO_PHONE,
            to: formattedPhone,
            body: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} has been cancelled.`
          });
          console.log("Booking cancellation SMS sent successfully");
        } catch (smsError) {
          console.error("Booking cancellation SMS failed:", smsError);
        }
      } else if (booking.customerPhone) {
        console.warn("SMS skipped due to invalid phone number.");
      }

      // 5️⃣ Send response
      res.send({
        success: true,
        message: "Booking cancelled & customer notified"
      });

    } catch (error) {
      console.error("Delete failed:", error);
      res.status(500).send({
        success: false,
        message: "Server error"
      });
    }
  });

  app.delete('/managebooking/:id', verifyToken, verifyAdmin, async (req, res) => {
    const { id } = req.params;

    try {
      // 1️⃣ Find the booking first
      const booking = await bookingCollections.findOne({ _id: new ObjectId(id) });
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Format phone number
      const formattedPhone = formatPhone(booking.phone);
      if (!formattedPhone && booking.phone) {
        console.warn("Invalid phone number for admin cancellation:", booking.phone);
      }

      // 2️⃣ Delete booking
      const result = await bookingCollections.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount !== 1) {
        return res.status(500).json({ error: 'Failed to delete booking' });
      }

      // 3️⃣ Send Email Notification
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: booking.email,
          subject: 'Booking Canceled by Admin',
          text: `Hi ${booking.name},\n\nYour booking on ${booking.date} at ${booking.time} has been canceled by the administrator.`
        });
        console.log("Admin cancellation email sent successfully");
      } catch (emailErr) {
        console.error("Admin cancellation email failed:", emailErr);
      }

      // 4️⃣ Send SMS Notification if phone is valid
      if (formattedPhone) {
        try {
          await twilioClient.messages.create({
            body: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} was canceled by the admin.`,
            from: process.env.TWILIO_PHONE,
            to: formattedPhone
          });
          console.log("Admin cancellation SMS sent successfully");
        } catch (smsErr) {
          console.error("Admin cancellation SMS failed:", smsErr);
        }
      } else if (booking.phone) {
        console.warn("SMS skipped due to invalid phone number.");
      }

      // 5️⃣ Send response
      res.json({ success: true });

    } catch (err) {
      console.error("Error deleting booking:", err);
      res.status(500).json({ error: "Server error deleting booking" });
    }
  });

  app.put('/managebooking/:id', verifyToken, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, guests, date, time } = req.body;

    if (!name || !guests || !date || !time) {
      return res.status(400).json({ error: 'Fields missing for update' });
    }

    const guestsCount = parseInt(guests, 10);
    if (isNaN(guestsCount) || guestsCount <= 0) {
      return res.status(400).json({ error: 'Invalid guests' });
    }

    try {
      // 1️⃣ Find existing booking
      const existingBooking = await bookingCollections.findOne({ _id: new ObjectId(id) });
      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // 2️⃣ Check slot availability
      const existingSlot = await bookingCollections.aggregate([
        { $match: { date, time, _id: { $ne: new ObjectId(id) } } },
        { $group: { _id: '$time', count: { $sum: '$guests' } } }
      ]).toArray();
      const bookedCount = existingSlot[0]?.count || 0;
      const maxPerSlot = 50;

      if (bookedCount + guestsCount > maxPerSlot) {
        return res.status(409).json({ error: 'Slot full' });
      }

      // 3️⃣ Update booking
      const result = await bookingCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { name, guests: guestsCount, date, time } }
      );
      if (result.matchedCount !== 1) {
        return res.status(500).json({ error: 'Update failed' });
      }

      // 4️⃣ Format phone
      const formattedPhone = formatPhone(existingBooking.phone);
      if (!formattedPhone && existingBooking.phone) {
        console.warn("Invalid phone number for admin booking update:", existingBooking.phone);
      }

      // 5️⃣ Notifications (best effort)
      try {
        // Email
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: existingBooking.email,
          subject: 'Booking Updated by Admin',
          text: `Hi ${name}, your booking has been updated to ${date} at ${time} for ${guestsCount} guests.`
        });
        console.log("Admin booking update email sent");

        // SMS
        if (formattedPhone) {
          await twilioClient.messages.create({
            body: `Hi ${name}, your booking has been updated to ${date} at ${time} for ${guestsCount} guests.`,
            from: process.env.TWILIO_PHONE,
            to: formattedPhone
          });
          console.log("Admin booking update SMS sent");
        } else if (existingBooking.phone) {
          console.warn("SMS skipped due to invalid phone number.");
        }
      } catch (notifyError) {
        console.error('Notification error:', notifyError);
      }

      // 6️⃣ Response
      res.json({ success: true });

    } catch (err) {
      console.error("Error updating booking:", err);
      res.status(500).json({ error: "Server error updating booking" });
    }
  });

  app.get('/my-bookings', verifyToken, async (req, res) => {
    const email = req.query.email;
    if (req.decoded.email !== email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    const bookings = await bookingCollections.find({ email }).toArray();
    res.send(bookings);
  });
  app.delete("/my-bookings/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    const userEmail = req.decoded.email;

    try {
      // 1️⃣ Find the booking
      const query = { _id: new ObjectId(id), email: userEmail };
      const booking = await bookingCollections.findOne(query);
      if (!booking) {
        return res.status(404).send({ message: "Booking not found" });
      }

      // 2️⃣ Delete booking
      const result = await bookingCollections.deleteOne(query);
      if (result.deletedCount !== 1) {
        return res.status(500).send({ message: "Failed to delete booking" });
      }

      // 3️⃣ Format phone for SMS
      const formattedPhone = formatPhone(booking.phone);
      if (!formattedPhone && booking.phone) {
        console.warn("Invalid phone number for user booking deletion:", booking.phone);
      }

      // 4️⃣ Notifications (best effort)
      try {
        // Email
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: booking.email,
          subject: "Booking Canceled",
          text: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} has been canceled.`
        });
        console.log("Booking cancellation email sent");

        // SMS
        if (formattedPhone) {
          await twilioClient.messages.create({
            body: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} has been canceled.`,
            from: process.env.TWILIO_PHONE,
            to: formattedPhone
          });
          console.log("Booking cancellation SMS sent");
        } else if (booking.phone) {
          console.warn("SMS skipped due to invalid phone number.");
        }

      } catch (notifyErr) {
        console.error("Notification error:", notifyErr);
      }

      // 5️⃣ Response
      res.send({ success: true });

    } catch (err) {
      console.error("Error deleting booking:", err);
      res.status(500).send({ message: "Server error deleting booking" });
    }
  });
  app.put('/my-bookings/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const updatedData = req.body;


    try {
      // Merge with existing booking to prevent empty updates
      const existingBooking = await bookingCollections.findOne({ _id: new ObjectId(id), email: req.decoded.email });
      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found or not yours' });
      }

      const finalUpdate = {
        date: updatedData.date ?? existingBooking.date,
        time: updatedData.time ?? existingBooking.time,
        guests: updatedData.guests ?? existingBooking.guests
      };

      const result = await bookingCollections.findOneAndUpdate(
        { _id: new ObjectId(id), email: req.decoded.email },
        { $set: finalUpdate },
        { returnDocument: 'after' }
      );

      return res.status(200).json(result.value);
    } catch (err) {
      console.error("Booking update failed:", err.message);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Messages APIs
  app.post("/api/messages", async (req, res) => {
    const { name, email, phone, message, token } = req.body;
    if (!name || !email || !phone || !message || !token) {
      return res.status(400).json({ error: "All fields including captcha token required" });
    }
    const verify = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
      { method: "POST" }
    ).then(r => r.json());
    if (!verify.success) return res.status(400).json({ error: "Invalid captcha" });

    const doc = { name, email, phone, message, createdAt: new Date() };
    const result = await messagesCollection.insertOne(doc);
    res.json({ insertedId: result.insertedId });
  });

  app.get("/api/messages", verifyToken, verifyAdmin, async (req, res) => {
    const messages = await messagesCollection
      .find({ deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(messages);
  });

  app.post("/api/messages/reply", verifyToken, verifyAdmin, async (req, res) => {
    const { messageId, reply } = req.body;
    if (!messageId || !reply) return res.status(400).json({ error: "Message ID and reply are required" });

    const messageDoc = await messagesCollection.findOne({ _id: new ObjectId(messageId) });
    if (!messageDoc) return res.status(404).json({ error: "Message not found" });

    const updateResult = await messagesCollection.updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { reply, repliedAt: new Date() } }
    );
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: messageDoc.email,
      subject: "Reply from Bistro Boss",
      text: reply,
    });
    res.json({ success: true, updateResult });
  });

  app.delete("/api/messages/:id", verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const result = await messagesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deleted: true, deletedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json({ success: true, result });
  });

  // Root route
  app.get('/', (req, res) => {
    res.send("Bistro Boss is Running");
  });

  // Start server
  app.listen(port, () => {
    console.log(`Bistro Boss Server is Running on ${port}`);
  });

} finally {
  // not closing client here so Express keeps running
}
}
run().catch(console.dir);
