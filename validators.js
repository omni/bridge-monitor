require('dotenv').config();
const logger = require('./logger')('validators');
const Web3 = require('web3');
const Web3Utils = require('web3-utils')
const fetch = require('node-fetch')
const { BRIDGE_MODES } = require('./utils/bridgeMode')
const HOME_RPC_URL = process.env.HOME_RPC_URL;
const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const HOME_BRIDGE_ADDRESS = process.env.HOME_BRIDGE_ADDRESS;
const FOREIGN_BRIDGE_ADDRESS = process.env.FOREIGN_BRIDGE_ADDRESS;
const HOME_DEPLOYMENT_BLOCK = Number(process.env.HOME_DEPLOYMENT_BLOCK) || 0;
const FOREIGN_DEPLOYMENT_BLOCK = Number(process.env.FOREIGN_DEPLOYMENT_BLOCK) || 0;
const GAS_PRICE_SPEED_TYPE = process.env.GAS_PRICE_SPEED_TYPE;
const GAS_LIMIT = process.env.GAS_LIMIT;

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const HOME_NATIVE_ABI = require('./abis/HomeBridgeNativeToErc.abi')
const FOREIGN_NATIVE_ABI = require('./abis/ForeignBridgeNativeToErc.abi')
const HOME_ERC_ABI = require('./abis/HomeBridgeErcToErc.abi')
const FOREIGN_ERC_ABI = require('./abis/ForeignBridgeErcToErc.abi')
const BRIDGE_VALIDATORS_ABI = require('./abis/BridgeValidators.abi');

const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

async function getGasPrices(type){
  try {
    const response = await fetch('https://gasprice.poa.network/');
    const json = await response.json()
    logger.log('Fetched gasprice: ' + json[type]);
    return json[type]
  } catch(e) {
    logger.error("Gas Price API is not available", e)
    return GAS_PRICE_FALLBACK;
  }
}

async function main(bridgeMode){
  try {
    let HOME_ABI = null
    let FOREIGN_ABI = null
    if (bridgeMode === BRIDGE_MODES.NATIVE_TO_ERC) {
      HOME_ABI = HOME_NATIVE_ABI
      FOREIGN_ABI = FOREIGN_NATIVE_ABI
    } else if (bridgeMode === BRIDGE_MODES.ERC_TO_ERC) {
      HOME_ABI = HOME_ERC_ABI
      FOREIGN_ABI = FOREIGN_ERC_ABI
    } else if (bridgeMode === BRIDGE_MODES.ERC_TO_NATIVE) {
      HOME_ABI = HOME_ERC_TO_NATIVE_ABI
      FOREIGN_ABI = FOREIGN_ERC_TO_NATIVE_ABI
    } else {
      throw new Error(`Unrecognized bridge mode: ${bridgeMode}`)
    }
    const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS);
    const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS);
    const homeValidatorsAddress = await homeBridge.methods.validatorContract().call()
    const homeBridgeValidators = new web3Home.eth.Contract(BRIDGE_VALIDATORS_ABI, homeValidatorsAddress);
    
    logger.debug('calling foreignBridge.methods.validatorContract().call()');
    const foreignValidatorsAddress = await foreignBridge.methods.validatorContract().call()
    const foreignBridgeValidators = new web3Foreign.eth.Contract(BRIDGE_VALIDATORS_ABI, foreignValidatorsAddress);
    logger.debug("calling foreignBridgeValidators.getPastEvents('ValidatorAdded')");
    let ValidatorAddedForeign = await foreignBridgeValidators.getPastEvents('ValidatorAdded', {fromBlock: FOREIGN_DEPLOYMENT_BLOCK});
    logger.debug("calling foreignBridgeValidators.getPastEvents('ValidatorRemoved')");
    let ValidatorRemovedForeign = await foreignBridgeValidators.getPastEvents('ValidatorRemoved', {fromBlock: FOREIGN_DEPLOYMENT_BLOCK});
    let foreignValidators = ValidatorAddedForeign.map(val => {
      return val.returnValues.validator
    })
    const foreignRemovedValidators = ValidatorRemovedForeign.map(val => {
      return val.returnValues.validator
    })
    foreignValidators = foreignValidators.filter(val => !foreignRemovedValidators.includes(val));
    logger.debug("calling homeBridgeValidators.getPastEvents('ValidatorAdded')");
    let ValidatorAdded = await homeBridgeValidators.getPastEvents('ValidatorAdded', {fromBlock: HOME_DEPLOYMENT_BLOCK});
    logger.debug("calling homeBridgeValidators.getPastEvents('ValidatorRemoved')");
    let ValidatorRemoved = await homeBridgeValidators.getPastEvents('ValidatorRemoved', {fromBlock: HOME_DEPLOYMENT_BLOCK});
    let homeValidators = ValidatorAdded.map(val => {
      return val.returnValues.validator
    })
    const homeRemovedValidators = ValidatorRemoved.map(val => {
      return val.returnValues.validator
    })
    homeValidators = homeValidators.filter(val => !homeRemovedValidators.includes(val));
    let homeBalances = {};
    logger.debug("calling asyncForEach homeValidators homeBalances");
    await asyncForEach(homeValidators, async (v) => {
      homeBalances[v] = Web3Utils.fromWei(await web3Home.eth.getBalance(v)) 
    })
    let foreignVBalances = {};
    let homeVBalances = {};
    logger.debug("calling getGasPrices");
    let gasPriceInGwei = await getGasPrices(GAS_PRICE_SPEED_TYPE)
    let gasPrice = new Web3Utils.BN(Web3Utils.toWei(gasPriceInGwei.toString(10), 'gwei'))
    const txCost = gasPrice.mul(new Web3Utils.BN(GAS_LIMIT))
    logger.debug("calling asyncForEach foreignValidators foreignVBalances");
    await asyncForEach(foreignValidators, async (v) => {
      const balance = await web3Foreign.eth.getBalance(v)
      const leftTx = new Web3Utils.BN(balance).div(txCost).toString(10)
      foreignVBalances[v] = {balance: Web3Utils.fromWei(balance), leftTx: Number(leftTx), gasPrice: gasPriceInGwei}
    })
    logger.debug("calling asyncForEach homeValidators homeVBalances");
    await asyncForEach(homeValidators, async (v) => {
      const gasPrice = new Web3Utils.BN(1);
      const txCost = gasPrice.mul(new Web3Utils.BN(GAS_LIMIT))
      const balance = await web3Home.eth.getBalance(v)
      const leftTx = new Web3Utils.BN(balance).div(txCost).toString(10)
      homeVBalances[v] = {balance: Web3Utils.fromWei(balance), leftTx: Number(leftTx), gasPrice: Number(gasPrice.toString(10))}
    })
    logger.debug("Done");
    return {
      home: {
        validators: {
          ...homeVBalances
        }
      },
      foreign: {
        validators: {
          ...foreignVBalances
        }
      },
      lastChecked: Math.floor(Date.now() / 1000)
    }
  } catch(e) {
    logger.error(e);
    throw e;
  }

}

module.exports = main;
