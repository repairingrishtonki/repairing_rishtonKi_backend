const express = require("express");
const env = require("dotenv");
const path = require("node:path");
const app = express();
const mongoose = require("mongoose");
const dns = require("node:dns");
const cors = require("cors")

dns.setServers(['1.1.1.1', '8.8.8.8'])




env.config({
    path: path.resolve(__dirname, './credentials.env')
})

const routes = require('./routes');



app.use('/test', (req,res,next) => {
    res.send("Hello from test route");
})

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [
    "http://localhost:3001",
    "http://localhost:3000",  
    "https://yourdomain.com", 
    "https://repairing-rishton-ki-web.onrender.com/"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));



app.use('/v1', routes)

const server = () => {
    return app.listen(3002,() => {
    console.log("Listening to port 3002");
})
}


if(process.env.MONGODB_URI){
    mongoose.connect(process.env.MONGODB_URI).then(() => {
        console.log("Connected to MongoDb. Starting server now...")
    server();
}).catch((err) => {
    console.log("Could not start the server. Failed mongoDB connection " + err)
    console.error(err);
    console.error("name:", err.name);
    console.error("message:", err.message);
    console.error("cause:", err.cause);
    console.error("stack:", err.stack);
})
}
else{
    console.log("Mongodb connection uri missing.")
}


