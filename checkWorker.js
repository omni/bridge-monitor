const fs = require('fs')
const getBalances = require('./getBalances')
getBalances().then((res) => {
  console.log(res)
  fs.writeFileSync(__dirname + '/results.json', JSON.stringify(res,null,4));
})