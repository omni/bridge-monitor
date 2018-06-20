require('dotenv').config();
const logger = require('./logger')('getShortEventStats.js');
const fs = require('fs')
const Web3 = require('web3');
const Web3Utils = require('web3-utils')
const HOME_RPC_URL = process.env.HOME_RPC_URL;
const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const HOME_BRIDGE_ADDRESS = process.env.HOME_BRIDGE_ADDRESS;
const FOREIGN_BRIDGE_ADDRESS = process.env.FOREIGN_BRIDGE_ADDRESS;
const POA20_ADDRESS = process.env.POA20_ADDRESS;
const HOME_DEPLOYMENT_BLOCK = Number(process.env.HOME_DEPLOYMENT_BLOCK) || 0;
const FOREIGN_DEPLOYMENT_BLOCK = Number(process.env.FOREIGN_DEPLOYMENT_BLOCK) || 0;

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const HOME_ABI = require('./abis/Home_bridge.abi');
const FOREIGN_ABI = require('./abis/Foreign.abi')

const BRIDGE_VALIDATORS_ABI = require('./abis/BridgeValidators.abi');

async function main(){
  try {
    const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS);
    const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS);
    logger.debug("calling homeBridge.methods.validatorContract().call()");
    const validatorHomeAddress = await homeBridge.methods.validatorContract().call()
    logger.debug("calling foreignBridge.methods.validatorContract().call()");
    const validatorForeignAddress = await foreignBridge.methods.validatorContract().call()
    const homeValidators = new web3Home.eth.Contract(BRIDGE_VALIDATORS_ABI, validatorHomeAddress);
    const foreignValidators = new web3Foreign.eth.Contract(BRIDGE_VALIDATORS_ABI, validatorForeignAddress);
    logger.debug("calling homeValidators.methods.requiredSignatures().call()");
    const reqSigHome = await homeValidators.methods.requiredSignatures().call()
    logger.debug("calling foreignValidators.methods.requiredSignatures().call()");
    const reqSigForeign = await foreignValidators.methods.requiredSignatures().call()
    logger.debug("calling homeBridge.getPastEvents('Deposit')");
    let homeDeposits = await homeBridge.getPastEvents('Deposit', {fromBlock: HOME_DEPLOYMENT_BLOCK});
    logger.debug("calling foreignBridge.getPastEvents('Deposit')");
    let foreignDeposits = await foreignBridge.getPastEvents('Deposit', {fromBlock: FOREIGN_DEPLOYMENT_BLOCK});
    logger.debug("calling homeBridge.getPastEvents('Withdraw')");
    let homeWithdrawals = await homeBridge.getPastEvents('Withdraw', {fromBlock: HOME_DEPLOYMENT_BLOCK});
    logger.debug("calling foreignBridge.getPastEvents('Withdraw')");
    let foreignWithdrawals = await foreignBridge.getPastEvents('Withdraw', {fromBlock: FOREIGN_DEPLOYMENT_BLOCK});
    logger.debug("Done");
    return {
      depositsDiff: homeDeposits.length - foreignDeposits.length,
      withdrawalDiff: homeWithdrawals.length - foreignWithdrawals.length,
      home: {
        deposits: homeDeposits.length,
        withdrawals: homeWithdrawals.length,
        requiredSignatures: Number(reqSigHome)
      },
      foreign: {
        deposits: foreignDeposits.length,
        withdrawals: foreignWithdrawals.length,
        requiredSignatures: Number(reqSigForeign)
      },
      requiredSignaturesMatch: reqSigHome === reqSigForeign
    }
  } catch(e) {
    logger.error(e);
    throw e;
  }

}
module.exports = main;