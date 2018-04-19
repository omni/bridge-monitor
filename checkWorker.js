const fs = require('fs')
const getBalances = require('./getBalances')
const getShortEventStats = require('./getShortEventStats');
const validators = require('./validators');

async function checkWorker() {
  try {
    const balances = await getBalances();
    const events = await getShortEventStats();
    const home = Object.assign({}, balances.home, events.home)
    const foreign = Object.assign({}, balances.foreign, events.foreign)
    const status = Object.assign({}, balances, events, {home}, {foreign})
    fs.writeFileSync(__dirname + '/responses/getBalances.json', JSON.stringify(status,null,4));
    const vBalances = await validators();
    fs.writeFileSync(__dirname + '/responses/validators.json', JSON.stringify(vBalances,null,4));
    return status;
  } catch(e) {
    console.error(e)
  }
}
checkWorker();
module.exports = checkWorker;