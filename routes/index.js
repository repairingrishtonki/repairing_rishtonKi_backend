
const express = require("express");
const router = express.Router();

const testRoute = require('./v1/test.route')
const userRoute = require('./v1/user.route')
const orderRoute = require('./v1/order.route')



const routes = [
    {
        route: '/test',
        file: testRoute
    },
    {
        route: '/user',
        file: userRoute
    },
    {
        route: '/order',
        file: orderRoute
    }
]


for(var i=0; i<routes.length; i++){
    router.use(routes[i].route, routes[i].file);
}

module.exports = router;