const mongoose = require("mongoose");


const userSchema = mongoose.Schema({
    name: String,
    phone: String,
    email : String
})


const user = mongoose.model('User', userSchema);

module.exports = user