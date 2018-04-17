const fs = require('fs')
const getBalances = require('./getBalances')
const eventStats = require('./eventsStats')
getBalances().then(async (res) => {
  console.log('res', res)
  const events = await eventStats()
  console.log(events)
  const status = Object.assign(events, res);
  fs.writeFileSync(__dirname + '/results.json', JSON.stringify(status,null,4));
})