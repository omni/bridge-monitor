const express = require('express')
const app = express()

app.all('/', function (req, res) {
    setTimeout(function () { res.status(504); res.end() }, 2000);
});

let PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('Listening on port ' + PORT));
