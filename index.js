
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
const helmet = require('helmet');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

/* middleware*/
app.use(cors());
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:5000"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Twilio setup
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const twilioFrom = process.env.TWILIO_PHONE;



/* Mongodb*/



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jmgafd7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("bistroDb").collection("users");
    const menuCollection = client.db("bistroDb").collection("menu");
    const reviewCollection = client.db("bistroDb").collection("reviews");
    const cartCollection = client.db("bistroDb").collection("carts");
    const paymentCollection = client.db("bistroDb").collection("payments");
    const bookingCollections = client.db("bistroDb").collection("bookings");
    const messagesCollection = client.db("bistroDb").collection("messages");


    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SCRET, { expiresIn: '1h' });
      res.send({ token })
    });

    // midleware api
    const verifyToken = (req, res, next) => {

      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Forbidden Access" })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SCRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbidden Access" })

        }
        req.decoded = decoded;
        next();

      })


    }
    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }



    // users related api
    // AdminHome
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();

      res.send({
        users,
        menuItems,
      });
    });

    // User Home Stats
    app.get('/user-stats', verifyToken, async (req, res) => {
      const userEmail = req.decoded?.email;

      if (!userEmail) {
        return res.status(400).send({ error: "User email not found." });
      }

      try {
        const bookings = await bookingCollections.countDocuments({ email: userEmail });
        const reviews = await reviewCollection.countDocuments({ email: userEmail });

        res.send({
          bookings,
          reviews
        });
      } catch (error) {
        console.error("Failed to get user stats:", error);
        res.status(500).send({ error: "Something went wrong." });
      }
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {

      const result = await userCollection.find().toArray();
      res.send(result)
    })
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const exsistingUser = await userCollection.findOne(query);
      if (exsistingUser) {
        return res.send({ message: "User already exists", insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

   

    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin"
        }

      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result)

    })

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result)
    })


    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Unauthorised Access' })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query)
      let admin = false;
      if (user) {
        admin = user?.role === "admin"
      }
      res.send({ admin })
    });



    // menu related api
    app.get('/menu/count', async (req, res) => {
      const count = await menuCollection.estimatedDocumentCount();
      res.json({ total: count });
    });

    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query);
      res.send(result);
    })


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

        if (category) {
          query.category = category;
        }

        if (isFeatured === 'true') {
          query.featured = true; // Make sure it's stored as a boolean in MongoDB
        }

        // If pagination is requested
        if (!isNaN(page) && !isNaN(limit)) {
          const skip = (page - 1) * limit;

          const total = await menuCollection.countDocuments(query);
          const items = await menuCollection.find(query).skip(skip).limit(limit).toArray();

          return res.json({
            total,
            items,
          });
        }

        // Otherwise return all matching items
        const allItems = await menuCollection.find(query).toArray();
        res.json(allItems);

      } catch (error) {
        console.error("Error fetching menu:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });



    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await menuCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })
    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })


    app.patch('/menu/feature/:id', verifyToken, verifyAdmin, async (req, res) => {
      // Admin-only route to update featured status
      const id = req.params.id;
      const { featured } = req.body;
      try {
        const result = await menuCollection.updateOne(
          { _id: id },
          { $set: { featured: featured } }
        );
        res.send(result);
      } catch (err) {
        console.error('Error updating featured status:', err);
        res.status(500).send({ error: 'Something went wrong' });
      }
    });



    // review related API start


    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })


    // Add a review
    app.post("/addReview", verifyToken, async (req, res) => {
      const { name, rating, details } = req.body;
      const userEmail = req.decoded?.email;

      if (!name || !rating || !details || !userEmail) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const newReview = {
        name,
        rating,
        details,
        userEmail, // email from token, not body
        createdAt: new Date(),
      };

      const result = await reviewCollection.insertOne(newReview);
      res.status(201).json({ insertedId: result.insertedId });
    });


    app.get("/myReviews", verifyToken, async (req, res) => {
      const { email } = req.query;          // frontend passes ?email=user@example.com
      const reviews = await reviewCollection.find({ userEmail: email }).toArray();
      res.json(reviews);
    });

    app.put("/myReviews/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { rating, details } = req.body;

      const result = await reviewCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { rating, details } }
      );
      res.json(result);
    });

    app.delete("/myReviews/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });






    // review related API end

    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result)
    })
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result)
    })




    // payment intent
    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })


    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    // delete all cart items and send notification
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      // Delete purchased items from cart
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };
      const deleteResult = await cartCollection.deleteMany(query);

      //  Send notifications
      try {
        const name = payment.name || "Customer";
        const email = payment.email;
        const phone = payment.phone;
        const amount = payment.price;

        //  Email Notification
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Payment Confirmation - Bistro Boss",
          text: `Hi ${name},\n\nThank you for your payment of $${amount}.\n\nWe’ve received it successfully. Your order is now being processed.\n\nBest regards,\nBistro Boss Team`
        });

        // SMS Notification
        await twilioClient.messages.create({
          body: `Hi ${name}, your payment of $${amount} was successful. Thanks for choosing Bistro Boss!`,
          from: process.env.TWILIO_PHONE,
          to: phone
        });

        res.send({ paymentResult, deleteResult, success: true });

      } catch (error) {
        console.error("Notification error after payment:", error);
        res.status(500).send({
          message: "Payment processed but notification failed.",
          paymentResult,
          deleteResult
        });
      }
    });




    // Bookings Related APi
    function generateSlots() {
      return ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
    }

    app.get('/managebooking', verifyToken, verifyAdmin, async (req, res) => {
      const bookings = await bookingCollections.find({}).toArray();
      res.send(bookings);
    });

    // Get available slots
    app.get('/api/slots', async (req, res) => {
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: 'Date required' });

      const maxPerSlot = 50; // max people per slot
      const times = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

      // Count existing bookings per slot
      const bookings = await bookingCollections
        .aggregate([
          { $match: { date } },
          { $group: { _id: '$time', count: { $sum: '$guests' } } }
        ])
        .toArray();

      const bookingsMap = {};
      bookings.forEach(b => {
        bookingsMap[b._id] = b.count;
      });

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

    // Book a table send email and sms notification

    app.post('/api/book', async (req, res) => {
      const { date, time, name, phone, guests, email } = req.body;

      if (!date || !time || !name || !guests || !email || !phone) {
        return res.status(400).json({ error: 'All fields required' });
      }

      const guestsCount = parseInt(guests);
      const maxPerSlot = 50;

      try {
        // Check current guest count for the slot
        const existing = await bookingCollections.aggregate([
          { $match: { date, time } },
          { $group: { _id: '$time', count: { $sum: '$guests' } } }
        ]).toArray();

        const currentCount = existing[0]?.count || 0;

        if (currentCount + guestsCount > maxPerSlot) {
          return res.status(409).json({ error: 'Slot full, not enough space' });
        }

        // Save booking
        const booking = { date, time, name, email, phone, guests: guestsCount };
        const result = await bookingCollections.insertOne(booking);

        // Send email
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Booking Confirmation',
          text: `Hi ${name}, your booking is confirmed for ${date} at ${time}. Guests: ${guestsCount}`
        });

        // Send SMS
        await twilioClient.messages.create({
          body: `Hi ${name}, your booking is confirmed for ${date} at ${time}. Guests: ${guestsCount}`,
          from: process.env.TWILIO_PHONE,
          to: phone
        });

        res.send({ success: true, id: result.insertedId });
      } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ error: 'Booking saved, but notification failed.' });
      }
    });


    app.delete('/managebooking/:id', verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;

      try {
        // 1. Find the booking first
        const booking = await bookingCollections.findOne({ _id: new ObjectId(id) });

        if (!booking) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        // 2. Delete the booking
        const result = await bookingCollections.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount !== 1) {
          return res.status(500).json({ error: 'Failed to delete booking' });
        }

        // 3. Send notifications (Email + SMS)
        try {
          // ✅ Email notification
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: booking.email,
            subject: 'Booking Canceled by Admin',
            text: `Hi ${booking.name},\n\nYour booking on ${booking.date} at ${booking.time} has been canceled by the administrator.\n\nIf you have any questions, please contact support.`,
          });

          // ✅ SMS notification
          await twilioClient.messages.create({
            body: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} was canceled by the admin.`,
            from: process.env.TWILIO_PHONE,
            to: booking.phone,
          });

          // Respond success
          res.send({ success: true });

        } catch (notifyErr) {
          console.error('Notification error:', notifyErr);
          res.send({ success: true, note: 'Booking deleted but notifications failed.' });
        }

      } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });



    // PUT /api/bookings/:id
    app.put('/managebooking/:id', verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const { name, guests, date, time } = req.body;

      try {
        // 1. Find existing booking
        const existingBooking = await bookingCollections.findOne({ _id: new ObjectId(id) });

        if (!existingBooking) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        // 2. Update booking
        const result = await bookingCollections.updateOne(
          { _id: new ObjectId(id) },
          { $set: { name, guests, date, time } }
        );

        if (result.matchedCount !== 1) {
          return res.status(500).json({ error: 'Failed to update booking' });
        }

        // 3. Send notifications (email + SMS)
        try {
          // ✅ Email notification
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: existingBooking.email,
            subject: 'Booking Updated by Admin',
            text: `Hi ${name},\n\nYour booking has been updated to:\nDate: ${date}\nTime: ${time}\nGuests: ${guests}\n\nIf this wasn't you, please contact support.`,
          });

          // ✅ SMS notification
          await twilioClient.messages.create({
            body: `Hi ${name}, your booking has been updated to ${date} at ${time} for ${guests} guests.`,
            from: process.env.TWILIO_PHONE,
            to: existingBooking.phone,
          });

          res.send({ success: true });

        } catch (notifyError) {
          console.error('Notification error:', notifyError);
          res.send({ success: true, note: 'Booking updated but notifications failed.' });
        }

      } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });


    // MyBooking related api


    app.get('/my-bookings', verifyToken, async (req, res) => {
      const email = req.query.email;
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const bookings = await bookingCollections.find({ email }).toArray();
      res.send(bookings);
    });

    // app.delete('/my-bookings/:id', verifyToken, async (req, res) => {
    //   const id = req.params.id;
    //   const email = req.decoded.email; // ✅ use decoded from token

    //   const result = await bookingCollections.deleteOne({
    //     _id: new ObjectId(id),
    //     email: email, // only owner can delete
    //   });

    //   if (result.deletedCount) {
    //     return res.send({ success: true });
    //   } else {
    //     return res.status(404).json({ error: 'Booking not found' });
    //   }
    // });

    app.delete("/my-bookings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id), email: req.decoded.email };

      const booking = await bookingCollections.findOne(query);
      if (!booking) return res.status(404).send("Booking not found");

      const result = await bookingCollections.deleteOne(query);

      if (result.deletedCount > 0) {
        try {
          // ✅ Email
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: booking.email,
            subject: "Booking Canceled",
            text: `Hi ${booking.name},\n\nYour booking on ${booking.date} at ${booking.time} has been successfully canceled.`,
          });

          // ✅ SMS
          await twilioClient.messages.create({
            body: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} has been canceled.`,
            from: process.env.TWILIO_PHONE,
            to: booking.phone,
          });

          res.send({ success: true });
        } catch (err) {
          console.error("Notification error:", err);
          res.send({ success: true, note: "Booking deleted but notification failed." });
        }
      } else {
        res.status(500).send("Failed to delete booking");
      }
    });

    // Update booking and send notifications
    app.put('/my-bookings/:id', async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      try {
        const result = await bookingCollections.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updatedData },
          { returnDocument: 'after' }
        );

        if (!result.value) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        const booking = result.value;

        // Send notifications
        await sendEmail(
          booking.email,
          'Booking Updated',
          `Your booking on ${booking.date} has been updated successfully.`
        );
        await sendSMS(
          booking.phone,
          `Your booking on ${booking.date} has been updated successfully.`
        );

        res.json(booking);
      } catch (err) {
        console.error('Error updating booking:', err);
        res.status(500).json({ error: 'Failed to update booking' });
      }
    });




    // Message related api
    app.post("/api/messages", async (req, res) => {
      const { name, email, phone, message, token } = req.body;

      // Verify reCAPTCHA
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


    app.post("/api/messages/reply", async (req, res) => {
      const { messageId, reply } = req.body;

      if (!messageId || !reply) return res.status(400).json({ error: "Message ID and reply are required" });

      // 1. Save reply in MongoDB
      const result = await messagesCollection.updateOne(
        { _id: new ObjectId(messageId) },
        { $set: { reply, repliedAt: new Date() } }
      );

      // 2. Optional: Send email using nodemailer
      const originalMessage = await messagesCollection.findOne({ _id: new ObjectId(messageId) });
      if (!originalMessage) return res.status(404).json({ error: "Message not found" });

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: originalMessage.email,
          subject: "Reply from Bistro Boss",
          text: reply,
        });

        res.json({ success: true }, result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to send email" });
      }
    });

    // DELETE /api/messages/:id
    app.delete("/api/messages/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const result = await messagesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { deleted: true, deletedAt: new Date() } }
      );

      if (result.matchedCount) {
        res.json({ success: true }, result);
      } else {
        res.status(404).json({ error: "Message not found" });
      }
    });











    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);












app.get('/', (req, res) => {
  res.send("Bistro Boss is Running")
})


app.listen(port, () => {
  console.log(`Bistro Boss Server is Running on ${port}`)
})