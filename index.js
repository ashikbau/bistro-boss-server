
// const express = require('express');
// const jwt = require('jsonwebtoken');
// const app = express();
// const cors = require('cors');
// const helmet = require('helmet');

// const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const nodemailer = require('nodemailer');
// const twilio = require('twilio');
// require('dotenv').config();
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const port = process.env.PORT || 5000;

// /* middleware*/
// app.use(cors());
// app.use(express.json());
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       connectSrc: ["'self'", "http://localhost:5000"],
//       scriptSrc: ["'self'", "'unsafe-inline'"],
//       styleSrc: ["'self'", "'unsafe-inline'"],
//       imgSrc: ["'self'", "data:"],
//     },
//   },
// }));

// // Nodemailer setup
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// // Twilio setup
// const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
// const twilioFrom = process.env.TWILIO_PHONE;



// /* Mongodb*/



// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jmgafd7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";`

// // Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   }
// });

// async function run() {
//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();
//     const userCollection = client.db("bistroDb").collection("users");
//     const menuCollection = client.db("bistroDb").collection("menu");
//     const reviewCollection = client.db("bistroDb").collection("reviews");
//     const cartCollection = client.db("bistroDb").collection("carts");

//     const orderCollection = client.db("bistroDb").collection("orders");

//     const bookingCollections = client.db("bistroDb").collection("bookings");
//     const messagesCollection = client.db("bistroDb").collection("messages");



//     app.post('/jwt', async (req, res) => {
//       const { email } = req.body;

//       if (!email) {
//         return res.status(400).send({ message: "Email is required to generate token" });
//       }

//       try {
//         // Find user from database
//         const foundUser = await userCollection.findOne({ email });

//         if (!foundUser) {
//           return res.status(404).send({ message: "User not found" });
//         }

//         // Use the user's role if exists, else default to 'user'
//         const role = foundUser.role || 'user';

//         const payload = { email, role };
//         // console.log('payload er viror role',payload)

//         const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SCRET, { expiresIn: '1h' });
//         // console.log("tokener nam",token)

//         res.send({ token });
//       } catch (error) {
//         console.error("JWT generation error:", error);
//         res.status(500).send({ message: "Internal Server Error" });
//       }
//     });



//     // midleware api
//     const verifyToken = (req, res, next) => {

//       if (!req.headers.authorization) {
//         return res.status(401).send({ message: "Forbidden Access" })
//       }
//       const token = req.headers.authorization.split(' ')[1];
//       jwt.verify(token, process.env.ACCESS_TOKEN_SCRET, (err, decoded) => {
//         if (err) {
//           return res.status(401).send({ message: "Forbidden Access" })

//         }
//         req.decoded = decoded;
//         next();

//       })


//     }
//     // use verify admin after verifyToken
//     const verifyAdmin = async (req, res, next) => {
//       const email = req.decoded.email;
//       const query = { email: email };
//       const user = await userCollection.findOne(query);
//       const isAdmin = user?.role === 'admin';
//       if (!isAdmin) {
//         return res.status(403).send({ message: 'forbidden access' });
//       }
//       next();
//     }

//     function blockAdminsFromOrdering(req, res, next) {
//       if (req.user && req.user.role === 'admin') {
//         return res.status(403).json({ error: "Admins are not allowed to place orders." });
//       }
//       next();
//     }



//     // users related api
//     // AdminHome
//     app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
//       const users = await userCollection.estimatedDocumentCount();
//       const menuItems = await menuCollection.estimatedDocumentCount();

//       res.send({
//         users,
//         menuItems,
//       });
//     });

//     // User Home Stats
//     app.get('/user-stats', verifyToken, async (req, res) => {
//       const userEmail = req.decoded?.email;

//       if (!userEmail) {
//         return res.status(400).send({ error: "User email not found." });
//       }

//       try {
//         const bookings = await bookingCollections.countDocuments({ email: userEmail });

//         // ✅ Fixed field name here
//         const reviews = await reviewCollection.countDocuments({ userEmail: userEmail });

//         res.send({
//           bookings,
//           reviews
//         });
//       } catch (error) {
//         console.error("Failed to get user stats:", error);
//         res.status(500).send({ error: "Something went wrong." });
//       }
//     });


//     app.get("/users", verifyToken, async (req, res) => {

//       const result = await userCollection.find().toArray();
//       res.send(result)
//     })
//     app.post("/users", async (req, res) => {
//       const user = req.body;
//       const query = { email: user.email }
//       const exsistingUser = await userCollection.findOne(query);
//       if (exsistingUser) {
//         return res.send({ message: "User already exists", insertedId: null })
//       }
//       const result = await userCollection.insertOne(user);
//       res.send(result)
//     })


// app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
//       const id = req.params.id;
//       const filter = { _id: new ObjectId(id) };
//       const updatedDoc = {
//         $set: {
//           role: "admin"
//         }

//       }
//       const result = await userCollection.updateOne(filter, updatedDoc);
//       res.send(result)

//     })

//     app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
//       const id = req.params.id;
//       const query = { _id: new ObjectId(id) }
//       const result = await userCollection.deleteOne(query);
//       res.send(result)
//     })


//     app.get('/users/admin/:email', verifyToken, async (req, res) => {
//       const email = req.params.email;

//       if (email !== req.decoded.email) {
//         return res.status(403).send({ message: 'Unauthorised Access' })
//       }

//       const query = { email: email }
//       const user = await userCollection.findOne(query)
//       let admin = false;
//       if (user) {
//         admin = user?.role === "admin"
//       }
//       res.send({ admin })
//     });
//     // GET /users/:email
//     app.get('/users/:email', async (req, res) => {
//       const email = req.params.email;
//       const user = await userCollection.findOne({ email });
//       if (user) {
//         res.send({ role: user.role }); // Will be undefined for regular users
//       } else {
//         res.status(404).send({ message: 'User not found' });
//       }
//     });

//     // menu related api
//     app.get('/menu/count', async (req, res) => {
//       const count = await menuCollection.estimatedDocumentCount();
//       res.json({ total: count });
//     });

//     app.get('/menu/:id', async (req, res) => {
//       const id = req.params.id;
//       const query = { _id: new ObjectId(id) }
//       const result = await menuCollection.findOne(query);
//       res.send(result);
//     })


//     app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
//       const item = req.body;
//       const result = await menuCollection.insertOne(item);
//       res.send(result);
//     });

//     app.get('/menu', async (req, res) => {
//       try {
//         const page = parseInt(req.query.page);
//         const limit = parseInt(req.query.limit);
//         const category = req.query.category;
//         const isFeatured = req.query.featured;

//         const query = {};

//         if (category) {
//           query.category = category;
//         }

//         if (isFeatured === 'true') {
//           query.featured = true; // Make sure it's stored as a boolean in MongoDB
//         }

//         // If pagination is requested
//         if (!isNaN(page) && !isNaN(limit)) {
//           const skip = (page - 1) * limit;

//           const total = await menuCollection.countDocuments(query);
//           const items = await menuCollection.find(query).skip(skip).limit(limit).toArray();

//           return res.json({
//             total,
//             items,
//           });
//         }

//         // Otherwise return all matching items
//         const allItems = await menuCollection.find(query).toArray();
//         res.json(allItems);

//       } catch (error) {
//         console.error("Error fetching menu:", error);
//         res.status(500).json({ error: 'Internal server error' });
//       }
//     });



//     app.patch('/menu/:id', async (req, res) => {
//       const item = req.body;
//       const id = req.params.id;
//       const filter = { _id: new ObjectId(id) }
//       const updatedDoc = {
//         $set: {
//           name: item.name,
//           category: item.category,
//           price: item.price,
//           recipe: item.recipe,
//           image: item.image
//         }
//       }

//       const result = await menuCollection.updateOne(filter, updatedDoc)
//       res.send(result);
//     })
//     app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
//       const id = req.params.id;
//       const query = { _id: new ObjectId(id) }
//       const result = await menuCollection.deleteOne(query);
//       res.send(result);
//     })


//     app.patch('/menu/feature/:id', verifyToken, verifyAdmin, async (req, res) => {
//       // Admin-only route to update featured status
//       const id = req.params.id;
//       const { featured } = req.body;
//       try {
//         const result = await menuCollection.updateOne(
//           { _id: id },
//           { $set: { featured: featured } }
//         );
//         res.send(result);
//       } catch (err) {
//         console.error('Error updating featured status:', err);
//         res.status(500).send({ error: 'Something went wrong' });
//       }
//     });



//     // review related API start


//     app.get('/reviews', async (req, res) => {
//       const result = await reviewCollection.find().toArray();
//       res.send(result);
//     })


//     // Add a review
//     app.post("/addReview", verifyToken, async (req, res) => {
//       const { name, rating, details } = req.body;
//       const userEmail = req.decoded?.email;

//       if (!name || !rating || !details || !userEmail) {
//         return res.status(400).json({ error: "Missing fields" });
//       }

//       const newReview = {
//         name,
//         rating,
//         details,
//         userEmail, // email from token, not body
//         createdAt: new Date(),
//       };

//       const result = await reviewCollection.insertOne(newReview);
//       res.status(201).json({ insertedId: result.insertedId });
//     });


//     app.get("/myReviews", verifyToken, async (req, res) => {
//       const { email } = req.query;          // frontend passes ?email=user@example.com
//       const reviews = await reviewCollection.find({ userEmail: email }).toArray();
//       res.json(reviews);
//     });

//     app.put("/myReviews/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       const { rating, details } = req.body;

//       const result = await reviewCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: { rating, details } }
//       );
//       res.json(result);
//     });

//     app.delete("/myReviews/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
//       res.json(result);
//     });






//     // review related API end

//     app.get('/carts', async (req, res) => {
//       const email = req.query.email;
//       const query = { email: email }
//       const result = await cartCollection.find(query).toArray();
//       res.send(result);
//     })

//     app.post('/carts', async (req, res) => {
//       const cartItem = req.body;
//       const result = await cartCollection.insertOne(cartItem);
//       res.send(result)
//     })
//     app.delete('/carts/:id', async (req, res) => {
//       const id = req.params.id;
//       const query = { _id: new ObjectId(id) };
//       const result = await cartCollection.deleteOne(query);
//       res.send(result)
//     })




//     app.get('/orders/:email', verifyToken, async (req, res) => {
//       const query = { email: req.params.email }
//       if (req.params.email !== req.decoded.email) {
//         return res.status(403).send({ message: 'forbidden access' });
//       }
//       const result = await orderCollection.find(query).toArray();
//       res.send(result);
//     });




//     app.post('/create-payment-intent', verifyToken, async (req, res) => {
//       const { price } = req.body;
//       const amount = parseInt(price * 100);
//       // console.log(amount, 'amount inside the intent')

//       const paymentIntent = await stripe.paymentIntents.create({
//         amount: amount,
//         currency: 'usd',
//         payment_method_types: ['card']
//       });

//       res.send({
//         clientSecret: paymentIntent.client_secret
//       })
//     });

//     // delete all cart items and send notification

//     app.post('/orders', verifyToken, blockAdminsFromOrdering, async (req, res) => {
//       const order = req.body;

//       try {
//         // 1. Save order to database
//         const orderResult = await orderCollection.insertOne(order);

//         // 2. Delete purchased items from cart
//         const query = {
//           _id: {
//             $in: order.cartIds.map(id => new ObjectId(id))
//           }
//         };
//         const deleteResult = await cartCollection.deleteMany(query);

//         // 3. Send notifications
//         const name = order.name || "Customer";
//         const email = order.email;
//         const phone = order.phone;
//         const amount = order.price;

//         // Send email confirmation
//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: email,
//           subject: "Order Confirmation - Bistro Boss",
//           text: `Hi ${name},\n\nThank you for your order of $${amount}.\n\nWe’ve received it successfully and are now preparing it.\n\nBest regards,\nBistro Boss Team`
//         });

//         // Send SMS confirmation
//         await twilioClient.messages.create({
//           body: `Hi ${name}, your order of $${amount} was successful. Thanks for choosing Bistro Boss!`,
//           from: process.env.TWILIO_PHONE,
//           to: phone
//         });

//         res.send({ orderResult, deleteResult, success: true });

//       } catch (error) {
//         console.error("Order processing error:", error);
//         res.status(500).send({
//           message: "Order saved but notification failed.",
//           error: error.message
//         });
//       }
//     });





//     // Bookings Related APi
//     function generateSlots() {
//       return ['11:00', ',12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
//     }

//     app.get('/managebooking', verifyToken, verifyAdmin, async (req, res) => {
//       const bookings = await bookingCollections.find({}).toArray();
//       res.send(bookings);
//     });

//     // Get available slots
//     app.get('/api/slots', async (req, res) => {
//       const { date } = req.query;
//       if (!date) return res.status(400).json({ error: 'Date required' });

//       const maxPerSlot = 50; // max people per slot
//       const times = generateSlots();

//       // Count existing bookings per slot
//       const bookings = await bookingCollections
//         .aggregate([
//           { $match: { date } },
//           { $group: { _id: '$time', count: { $sum: '$guests' } } }
//         ])
//         .toArray();

//       const bookingsMap = {};
//       bookings.forEach(b => {
//         bookingsMap[b._id] = b.count;
//       });

//       const slots = times.map(time => {
//         const booked = bookingsMap[time] || 0;
//         return {
//           time,
//           available: booked < maxPerSlot,
//           remaining: maxPerSlot - booked
//         };
//       });

//       res.json(slots);
//     });

//     // Book a table send email and sms notification

//     app.post('/api/book', async (req, res) => {
//       const { date, time, name, phone, guests, email } = req.body;

//       if (!date || !time || !name || !guests || !email || !phone) {
//         return res.status(400).json({ error: 'All fields required' });
//       }

//       const guestsCount = parseInt(guests);
//       const maxPerSlot = 50;

//       try {
//         // Check current guest count for the slot
//         const existing = await bookingCollections.aggregate([
//           { $match: { date, time } },
//           { $group: { _id: '$time', count: { $sum: '$guests' } } }
//         ]).toArray();

//         const currentCount = existing[0]?.count || 0;

//         if (currentCount + guestsCount > maxPerSlot) {
//           return res.status(409).json({ error: 'Slot full, not enough space' });
//         }

//         // Save booking
//         const booking = { date, time, name, email, phone, guests: guestsCount };
//         const result = await bookingCollections.insertOne(booking);

//         // Send email
//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: email,
//           subject: 'Booking Confirmation',
//           text: `Hi ${name}, your booking is confirmed for ${date} at ${time}. Guests: ${guestsCount}`
//         });

//         // Send SMS
//         await twilioClient.messages.create({
//           body: `Hi ${name}, your booking is confirmed for ${date} at ${time}. Guests: ${guestsCount}`,
//           from: process.env.TWILIO_PHONE,
//           to: phone
//         });

//         res.send({ success: true, id: result.insertedId });
//       } catch (error) {
//         console.error('Booking error:', error);
//         res.status(500).json({ error: 'Booking saved, but notification failed.' });
//       }
//     });


//     app.delete('/managebooking/:id', verifyToken, verifyAdmin, async (req, res) => {
//       const { id } = req.params;

//       try {
//         // 1. Find the booking first
//         const booking = await bookingCollections.findOne({ _id: new ObjectId(id) });

//         if (!booking) {
//           return res.status(404).json({ error: 'Booking not found' });
//         }

//         // 2. Delete the booking
//         const result = await bookingCollections.deleteOne({ _id: new ObjectId(id) });

//         if (result.deletedCount !== 1) {
//           return res.status(500).json({ error: 'Failed to delete booking' });
//         }

//         // 3. Send notifications (Email + SMS)
//         try {
//           // ✅ Email notification
//           await transporter.sendMail({
//             from: process.env.EMAIL_USER,
//             to: booking.email,
//             subject: 'Booking Canceled by Admin',
//             text: `Hi ${booking.name},\n\nYour booking on ${booking.date} at ${booking.time} has been canceled by the administrator.\n\nIf you have any questions, please contact support.`,
//           });

//           // ✅ SMS notification
//           await twilioClient.messages.create({
//             body: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} was canceled by the admin.`,
//             from: process.env.TWILIO_PHONE,
//             to: booking.phone,
//           });

//           // Respond success
//           res.send({ success: true });

//         } catch (notifyErr) {
//           console.error('Notification error:', notifyErr);
//           res.send({ success: true, note: 'Booking deleted but notifications failed.' });
//         }

//       } catch (err) {
//         console.error('Delete error:', err);
//         res.status(500).json({ error: 'Server error' });
//       }
//     });



//     // PUT /api/bookings/:id
//     app.put('/managebooking/:id', verifyToken, verifyAdmin, async (req, res) => {
//       const { id } = req.params;
//       const { name, guests, date, time } = req.body;

//       try {
//         // 1. Find existing booking
//         const existingBooking = await bookingCollections.findOne({ _id: new ObjectId(id) });

//         if (!existingBooking) {
//           return res.status(404).json({ error: 'Booking not found' });
//         }

//         // 2. Update booking
//         const result = await bookingCollections.updateOne(
//           { _id: new ObjectId(id) },
//           { $set: { name, guests, date, time } }
//         );

//         if (result.matchedCount !== 1) {
//           return res.status(500).json({ error: 'Failed to update booking' });
//         }

//         // 3. Send notifications (email + SMS)
//         try {
//           // ✅ Email notification
//           await transporter.sendMail({
//             from: process.env.EMAIL_USER,
//             to: existingBooking.email,
//             subject: 'Booking Updated by Admin',
//             text: `Hi ${name},\n\nYour booking has been updated to:\nDate: ${date}\nTime: ${time}\nGuests: ${guests}\n\nIf this wasn't you, please contact support.`,
//           });

//           // ✅ SMS notification
//           await twilioClient.messages.create({
//             body: `Hi ${name}, your booking has been updated to ${date} at ${time} for ${guests} guests.`,
//             from: process.env.TWILIO_PHONE,
//             to: existingBooking.phone,
//           });

//           res.send({ success: true });

//         } catch (notifyError) {
//           console.error('Notification error:', notifyError);
//           res.send({ success: true, note: 'Booking updated but notifications failed.' });
//         }

//       } catch (err) {
//         console.error('Update error:', err);
//         res.status(500).json({ error: 'Server error' });
//       }
//     });


//     // MyBooking related api


//     app.get('/my-bookings', verifyToken, async (req, res) => {
//       const email = req.query.email;
//       if (req.decoded.email !== email) {
//         return res.status(403).send({ message: 'forbidden access' });
//       }
//       const bookings = await bookingCollections.find({ email }).toArray();
//       res.send(bookings);
//     });



//     app.delete("/my-bookings/:id", verifyToken, async (req, res) => {
//       const id = req.params.id;
//       const query = { _id: new ObjectId(id), email: req.decoded.email };

//       const booking = await bookingCollections.findOne(query);
//       if (!booking) return res.status(404).send("Booking not found");

//       const result = await bookingCollections.deleteOne(query);

//       if (result.deletedCount > 0) {
//         try {
//           // ✅ Email
//           await transporter.sendMail({
//             from: process.env.EMAIL_USER,
//             to: booking.email,
//             subject: "Booking Canceled",
//             text: `Hi ${booking.name},\n\nYour booking on ${booking.date} at ${booking.time} has been successfully canceled.`,
//           });

//           // ✅ SMS
//           await twilioClient.messages.create({
//             body: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} has been canceled.`,
//             from: process.env.TWILIO_PHONE,
//             to: booking.phone,
//           });

//           res.send({ success: true });
//         } catch (err) {
//           console.error("Notification error:", err);
//           res.send({ success: true, note: "Booking deleted but notification failed." });
//         }
//       } else {
//         res.status(500).send("Failed to delete booking");
//       }
//     });

//     // Update booking and send notifications
//     app.put('/my-bookings/:id', async (req, res) => {
//       const id = req.params.id;
//       const updatedData = req.body;

//       try {
//         const result = await bookingCollections.findOneAndUpdate(
//           { _id: new ObjectId(id) },
//           { $set: updatedData },
//           { returnDocument: 'after' }
//         );

//         if (!result.value) {
//           return res.status(404).json({ error: 'Booking not found' });
//         }

//         const booking = result.value;

//         // Send notifications
//         await sendEmail(
//           booking.email,
//           'Booking Updated',
//           `Your booking on ${booking.date} has been updated successfully.`
//         );
//         await sendSMS(
//           booking.phone,
//           `Your booking on ${booking.date} has been updated successfully.`
//         );

//         res.json(booking);
//       } catch (err) {
//         console.error('Error updating booking:', err);
//         res.status(500).json({ error: 'Failed to update booking' });
//       }
//     });




//     // Message related api
//     app.post("/api/messages", async (req, res) => {
//       const { name, email, phone, message, token } = req.body;

//       // Verify reCAPTCHA
//       const verify = await fetch(
//         `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
//         { method: "POST" }
//       ).then(r => r.json());

//       if (!verify.success) return res.status(400).json({ error: "Invalid captcha" });

//       const doc = { name, email, phone, message, createdAt: new Date() };
//       const result = await messagesCollection.insertOne(doc);
//       res.json({ insertedId: result.insertedId });
//     });



//     app.get("/api/messages", verifyToken, verifyAdmin, async (req, res) => {
//       const messages = await messagesCollection
//         .find({ deleted: { $ne: true } })
//         .sort({ createdAt: -1 })
//         .toArray();
//       res.json(messages);
//     });


//     app.post("/api/messages/reply", async (req, res) => {
//       const { messageId, reply } = req.body;

//       if (!messageId || !reply) return res.status(400).json({ error: "Message ID and reply are required" });

//       // 1. Save reply in MongoDB
//       const result = await messagesCollection.updateOne(
//         { _id: new ObjectId(messageId) },
//         { $set: { reply, repliedAt: new Date() } }
//       );

//       // 2. Optional: Send email using nodemailer
//       const originalMessage = await messagesCollection.findOne({ _id: new ObjectId(messageId) });
//       if (!originalMessage) return res.status(404).json({ error: "Message not found" });

//       try {
//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: originalMessage.email,
//           subject: "Reply from Bistro Boss",
//           text: reply,
//         });

//         res.json({ success: true }, result);
//       } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: "Failed to send email" });
//       }
//     });

//     // DELETE /api/messages/:id
//     app.delete("/api/messages/:id", verifyToken, verifyAdmin, async (req, res) => {
//       const id = req.params.id;

//       const result = await messagesCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: { deleted: true, deletedAt: new Date() } }
//       );

//       if (result.matchedCount) {
//         res.json({ success: true }, result);
//       } else {
//         res.status(404).json({ error: "Message not found" });
//       }
//     });

//  // Send a ping to confirm a successful connection
//     await client.db("admin").command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   } finally {
//     // Ensures that the client will close when you finish/error
//     // await client.close();
//   }
// }
// run().catch(console.dir);
// app.get('/', (req, res) => {
//   res.send("Bistro Boss is Running")
// })
// app.listen(port, () => {
//   console.log(`Bistro Boss Server is Running on ${port}`)
// })
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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





const blockAdminsFromOrdering = (req, res, next) => {
  // ensure token verified already
  if (req.decoded && req.decoded.role === 'admin') {
    return res.status(403).send({ message: "Admins are not allowed to place orders or bookings." });
  }
  next();
};

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

    // Middlewares (to be used globally, before routes)
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Forbidden Access" });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
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
      res.send({ role: user?.role || 'staff' });
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

        res.json(item); // ✅ Always return JSON
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

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
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
    app.post("/api/staff-orders", verifyToken, async (req, res) => {
      try {
        const { customerEmail, customerPhone, items } = req.body;
        console.log("🧾 Incoming order:", req.body);

        if (!customerEmail || !customerPhone || !items || items.length === 0) {
          return res.status(400).send({ message: "Missing required fields" });
        }

        // ✅ Use req.decoded.email instead of req.user.email
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

    app.post('/orders', verifyToken, blockAdminsFromOrdering, async (req, res) => {
      const order = req.body;
      try {
        const orderResult = await orderCollection.insertOne(order);
        const query = {
          _id: {
            $in: order.cartIds.map(id => new ObjectId(id))
          }
        };
        const deleteResult = await cartCollection.deleteMany(query);

        const name = order.name || "Customer";
        const email = order.email;
        const phone = order.phone;
        const amount = order.price;

        // Email
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Order Confirmation - Bistro Boss",
          text: `Hi ${name},\n\nThank you for your order of $${amount}.\n\nWe’ve received it successfully and are now preparing it.\n\nBest regards,\nBistro Boss Team`
        });

        // SMS
        await twilioClient.messages.create({
          body: `Hi ${name}, your order of $${amount} was successful. Thanks for choosing Bistro Boss!`,
          from: process.env.TWILIO_PHONE,
          to: phone
        });

        res.send({ orderResult, deleteResult, success: true });
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
      const { date, time, name, phone, guests, email } = req.body;
      if (!date || !time || !name || !guests || !email || !phone) {
        return res.status(400).json({ error: 'All fields required' });
      }

      const guestsCount = parseInt(guests, 10);
      if (isNaN(guestsCount) || guestsCount <= 0) {
        return res.status(400).json({ error: 'Invalid guests number' });
      }

      const maxPerSlot = 50;
      const existing = await bookingCollections.aggregate([
        { $match: { date, time } },
        { $group: { _id: '$time', count: { $sum: '$guests' } } }
      ]).toArray();
      const currentCount = existing[0]?.count || 0;
      if (currentCount + guestsCount > maxPerSlot) {
        return res.status(409).json({ error: 'Slot full, not enough space' });
      }

      const booking = { date, time, name, email, phone, guests: guestsCount };
      const result = await bookingCollections.insertOne(booking);

      // Notifications
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Booking Confirmation',
        text: `Hi ${name}, your booking is confirmed for ${date} at ${time}. Guests: ${guestsCount}`
      });
      if (booking.phone) {
        await twilioClient.messages.create({
          body: `Your booking on ${booking.date} has been updated.`,
          from: process.env.TWILIO_PHONE,
          to: booking.phone,
        });
      } else {
        console.log("No phone number found for booking, skipping SMS");
      }

      res.send({ success: true, id: result.insertedId });
    });

    app.delete('/managebooking/:id', verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const booking = await bookingCollections.findOne({ _id: new ObjectId(id) });
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      const result = await bookingCollections.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount !== 1) {
        return res.status(500).json({ error: 'Failed to delete booking' });
      }

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: booking.email,
          subject: 'Booking Canceled by Admin',
          text: `Hi ${booking.name},\n\nYour booking on ${booking.date} at ${booking.time} has been canceled by the administrator.`
        });
        await twilioClient.messages.create({
          body: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} was canceled by the admin.`,
          from: process.env.TWILIO_PHONE,
          to: booking.phone
        });
        res.json({ success: true });
      } catch (notifyErr) {
        console.error('Notification error:', notifyErr);
        res.json({ success: true, note: 'Booking deleted but notifications failed.' });
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

      const existingBooking = await bookingCollections.findOne({ _id: new ObjectId(id) });
      if (!existingBooking) return res.status(404).json({ error: 'Booking not found' });

      const existingSlot = await bookingCollections.aggregate([
        { $match: { date, time, _id: { $ne: new ObjectId(id) } } },
        { $group: { _id: '$time', count: { $sum: '$guests' } } }
      ]).toArray();
      const bookedCount = existingSlot[0]?.count || 0;
      const maxPerSlot = 50;
      if (bookedCount + guestsCount > maxPerSlot) {
        return res.status(409).json({ error: 'Slot full' });
      }

      const result = await bookingCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { name, guests: guestsCount, date, time } }
      );
      if (result.matchedCount !== 1) {
        return res.status(500).json({ error: 'Update failed' });
      }

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: existingBooking.email,
          subject: 'Booking Updated by Admin',
          text: `Hi ${name}, your booking has been updated to ${date} at ${time} for ${guestsCount} guests.`
        });
        await twilioClient.messages.create({
          body: `Hi ${name}, your booking has been updated to ${date} at ${time} for ${guestsCount} guests.`,
          from: process.env.TWILIO_PHONE,
          to: existingBooking.phone
        });
        res.json({ success: true });
      } catch (notifyError) {
        console.error('Notification error:', notifyError);
        res.json({ success: true, note: 'Booking updated but notifications failed.' });
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
      const query = { _id: new ObjectId(id), email: req.decoded.email };
      const booking = await bookingCollections.findOne(query);
      if (!booking) return res.status(404).send({ message: "Booking not found" });

      const result = await bookingCollections.deleteOne(query);
      if (result.deletedCount > 0) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: booking.email,
            subject: "Booking Canceled",
            text: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} has been canceled.`,
          });
          await twilioClient.messages.create({
            body: `Hi ${booking.name}, your booking on ${booking.date} at ${booking.time} has been canceled.`,
            from: process.env.TWILIO_PHONE,
            to: booking.phone,
          });
          res.send({ success: true });
        } catch (notifyErr) {
          console.error("Notification error:", notifyErr);
          res.send({ success: true, note: "Booking deleted but notification failed." });
        }
      } else {
        res.status(500).send({ message: "Failed to delete booking" });
      }
    });

    // app.put('/my-bookings/:id', verifyToken, async (req, res) => {
    //   const id = req.params.id;
    //   const updatedData = req.body;
    //   const result = await bookingCollections.findOneAndUpdate(
    //     { _id: new ObjectId(id), email: req.decoded.email },
    //     { $set: updatedData },
    //     { returnDocument: 'after' }
    //   );
    //   if (!result.value) {
    //     return res.status(404).json({ error: 'Booking not found' });
    //   }
    //   const booking = result.value;
    //   await transporter.sendMail({
    //     from: process.env.EMAIL_USER,
    //     to: booking.email,
    //     subject: "Booking Updated",
    //     text: `Your booking on ${booking.date} has been updated.`,
    //   });
    //   await twilioClient.messages.create({
    //     body: `Your booking on ${booking.date} has been updated.`,
    //     from: process.env.TWILIO_PHONE,
    //     to: booking.phone,
    //   });
    //   res.json(booking);
    // });

    app.put('/my-bookings/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      console.log("Decoded email:", req.decoded.email);
      console.log("Booking id:", id);
      console.log("Data to update:", updatedData);

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
