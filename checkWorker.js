const fs = require('fs')
const logger = require('./logger')('checkWorker');
const getBalances = require('./getBalances')
const getShortEventStats = require('./getShortEventStats');
const validators = require('./validators');

async function checkWorker() {
  try {
    logger.debug('calling getBalances()');
    const balances = await getBalances();
    logger.debug('calling getShortEventStats()');
    const events = await getShortEventStats();
    const home = Object.assign({}, balances.home, events.home)
    const foreign = Object.assign({}, balances.foreign, events.foreign)
    const status = Object.assign({}, balances, events, {home}, {foreign})
    if (!status) throw new Error('status is empty: ' + JSON.stringify(status));
    fs.writeFileSync(__dirname + '/responses/getBalances.json', JSON.stringify(status,null,4));

    logger.debug('calling validators()');
    const vBalances = await validators();
    if (!vBalances) throw new Error('vBalances is empty: ' + JSON.stringify(vBalances));
    fs.writeFileSync(__dirname + '/responses/validators.json', JSON.stringify(vBalances,null,4));
    logger.debug("Done");
  } catch(e) {
    logger.error(e);
  }
}
checkWorker();
