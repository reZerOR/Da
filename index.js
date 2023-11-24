// all requirments 
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

// ready made middleware
app.use(cors());
app.use(express.json())




// root api
app.get('/', (req, res)=>{
    res.send('survey server is running')
})

// where the server port is
app.listen(port, ()=>{
    console.log(`survey is running on port: ${port}`)
})