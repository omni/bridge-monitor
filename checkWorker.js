const fs = require('fs')
const Web3 = require('web3');
const logger = require('./logger')('checkWorker');
const getBalances = require('./getBalances')
const getShortEventStats = require('./getShortEventStats');
const validators = require('./validators');
const { existsErc677Token } = require('./utils')

const { HOME_BRIDGE_ADDRESS, HOME_RPC_URL } = process.env;
const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const HOME_ERC_ABI = require('./abis/HomeBridgeErcToErc.abi')

async function checkWorker() {
  try {
    const isErcToErcMode = await existsErc677Token(web3Home, HOME_ERC_ABI, HOME_BRIDGE_ADDRESS)
    logger.debug("isErcToErcMode", isErcToErcMode)
    logger.debug('calling getBalances()');
    const balances = await getBalances(isErcToErcMode);
    logger.debug('calling getShortEventStats()');
    const events = await getShortEventStats(isErcToErcMode);
    const home = Object.assign({}, balances.home, events.home)
    const foreign = Object.assign({}, balances.foreign, events.foreign)
    const status = Object.assign({}, balances, events, {home}, {foreign})
    if (!status) throw new Error('status is empty: ' + JSON.stringify(status));
    fs.writeFileSync(__dirname + '/responses/getBalances.json', JSON.stringify(status,null,4));

    logger.debug('calling validators()');
    const vBalances = await validators(isErcToErcMode);
    if (!vBalances) throw new Error('vBalances is empty: ' + JSON.stringify(vBalances));
    fs.writeFileSync(__dirname + '/responses/validators.json', JSON.stringify(vBalances,null,4));
    logger.debug("Done");
    return status;
  } catch(e) {
    logger.error(e);
    throw e;
  }
}
checkWorker();
