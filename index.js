// all requirments 
const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_TOKEN)

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// ready made middleware
app.use(cors());
app.use(express.json())

// database


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o4gj9vp.mongodb.net/?retryWrites=true&w=majority`;

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
    // COLLECTIONS
    const userCollection = client.db("dataDumpDB").collection("users");
    const paymentCollection = client.db("dataDumpDB").collection("payments");

    // jwt api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // MIDDLEWARE
    const verifyToken = (req, res, next)=>{
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'})
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
          return res.status(401).send({message: 'unauthoraized access'})
        }
        req.decoded = decoded
        next()
      })
    }

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

    const verifySurveyor = async(req, res, next) =>{
      const email = req.decoded.email
      const query = {email: email}
      const user = await userCollection.findOne(query)
      const isSurveyor = user?.role === 'surveyor'
      if(!isSurveyor){
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // USER APIS
    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists: 
     
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
    //   checking is email exits or not
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result); 
    });

    app.put('/users/:email', verifyToken, async(req, res)=>{
      const email= req.params.email
      const filter = {email: email}
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "pro-user"
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    })

    app.get('/users', verifyToken, verifyAdmin, async(req, res)=>{
      const filter = req.query.filter
      console.log(filter)
      let query = {}
      if(filter){
        query = {role: filter}
      }
      const result = await userCollection.find(query).toArray()
      res.send(result)
    })

    app.put('/users/admin/:id', verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const options = {upsert: true}
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(query, updatedDoc, options)
      res.send(result)
    })

    app.put('/users/surveyor/:id', verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const options = {upsert: true}
      const updatedDoc = {
        $set: {
          role: 'surveyor'
        }
      }
      const result = await userCollection.updateOne(query, updatedDoc, options)
      res.send(result)
    })

    // pro user check
    app.get('/users/pro-and-admin-surveyor/:email', verifyToken, async(req,res)=>{
      const email = req.params.email

      if(email !== req.decoded.email) {
        return res.status(403).send({message: 'forbidden access'})
      }

      const query = {email: email}
      const user = await userCollection.findOne(query)
      let pro_user = false
      let admin = false
      let surveyor = false
      let isUser = false
      if(user){
        pro_user = user?.role === 'pro-user'
      }
      if(user){
        admin = user?.role === 'admin'
      }
      if(user){
        surveyor = user?.role === 'surveyor'
      }
      if(user){
        isUser = user?.role === 'user'
      }
      res.send({pro_user, admin, surveyor, isUser})
    })



    // payment intent
    app.post('/create-payment-intent', async(req, res)=>{
      const {price} = req.body
      const amount  = parseInt(price*100)
      console.log(amount)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: 2500,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      }) 
    })

    // payment api 
    app.post('/payments', async(req, res)=>{
      const paymentInfo = req.body
      const result = await paymentCollection.insertOne(paymentInfo)
      res.send(result)
    })

    app.get('/payments', verifyToken, verifyAdmin, async(req, res)=>{
      const result = await paymentCollection.find().toArray()
      res.send(result)
    })


    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



// root api
app.get('/', (req, res)=>{
    res.send('survey server is running')
})

// where the server port is
app.listen(port, ()=>{
    console.log(`survey is running on port: ${port}`)
})