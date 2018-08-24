require('dotenv').config();
const logger = require('./logger')('eventsStats');
const Web3 = require('web3');
const HOME_RPC_URL = process.env.HOME_RPC_URL;
const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const HOME_BRIDGE_ADDRESS = process.env.HOME_BRIDGE_ADDRESS;
const FOREIGN_BRIDGE_ADDRESS = process.env.FOREIGN_BRIDGE_ADDRESS;
const HOME_DEPLOYMENT_BLOCK = Number(process.env.HOME_DEPLOYMENT_BLOCK) || 0;
const FOREIGN_DEPLOYMENT_BLOCK = Number(process.env.FOREIGN_DEPLOYMENT_BLOCK) || 0;

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const HOME_ABI = require('./abis/Home_bridge.abi');
const FOREIGN_ABI = require('./abis/Foreign.abi')

function compareDepositsHome(foreign){
  return function(homeDeposit){
    return foreign.filter(function(foreignDeposit){
      return foreignDeposit.returnValues.transactionHash === homeDeposit.transactionHash
           && foreignDeposit.returnValues.recipient === homeDeposit.returnValues.recipient && 
           foreignDeposit.returnValues.value === homeDeposit.returnValues.value
    }).length == 0;
  }
}
function compareDepositsForeign(home){
  return function(foreignDeposit){
    return home.filter(function(homeDeposit){
      return homeDeposit.transactionHash === foreignDeposit.returnValues.transactionHash
           && homeDeposit.returnValues.recipient === foreignDeposit.returnValues.recipient && 
           homeDeposit.returnValues.value === foreignDeposit.returnValues.value
    }).length == 0;
  }
}

async function main(){
  try {
    const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS);
    const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS);
    logger.debug("calling homeBridge.getPastEvents('UserRequestForSignature')");
    let homeDeposits = await homeBridge.getPastEvents('UserRequestForSignature', {fromBlock: HOME_DEPLOYMENT_BLOCK});
    logger.debug("calling foreignBridge.getPastEvents('RelayedMessage')");
    let foreignDeposits = await foreignBridge.getPastEvents('RelayedMessage', {fromBlock: FOREIGN_DEPLOYMENT_BLOCK});
    logger.debug("calling homeBridge.getPastEvents('AffirmationCompleted')");
    let homeWithdrawals = await homeBridge.getPastEvents('AffirmationCompleted', {fromBlock: HOME_DEPLOYMENT_BLOCK});
    logger.debug("calling foreignBridge.getPastEvents('UserRequestForAffirmation')");
    let foreignWithdrawals = await foreignBridge.getPastEvents('UserRequestForAffirmation', {fromBlock: FOREIGN_DEPLOYMENT_BLOCK}); // Transfer in case of erc20-erc20

    /*
      eventContractAddress: process.env.ERC20_TOKEN_ADDRESS,
      eventAbi: erc20Abi,
      eventFilter: { to: process.env.FOREIGN_BRIDGE_ADDRESS },
    * */

    const onlyInHomeDeposits = homeDeposits.filter(compareDepositsHome(foreignDeposits))
    const onlyInForeignDeposits = foreignDeposits.concat([]).filter(compareDepositsForeign(homeDeposits))

    const onlyInHomeWithdrawals = homeWithdrawals.filter(compareDepositsForeign(foreignWithdrawals))
    const onlyInForeignWithdrawals = foreignWithdrawals.filter(compareDepositsHome(homeWithdrawals))
    
    logger.debug("Done");
    return {
      onlyInHomeDeposits,
      onlyInForeignDeposits,
      onlyInHomeWithdrawals,
      onlyInForeignWithdrawals,
      lastChecked: Math.floor(Date.now() / 1000),
    }
  } catch(e) {
    logger.error(e);
    throw e;
  }

}

module.exports = main;
