// validatorContract
// ValidatorAdded
// ValidatorRemoved
require('dotenv').config();
const fs = require('fs')
const Web3 = require('web3');
const Web3Utils = require('web3-utils')
const fetch = require('node-fetch')
const HOME_RPC_URL = process.env.HOME_RPC_URL;
const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const HOME_BRIDGE_ADDRESS = process.env.HOME_BRIDGE_ADDRESS;
const FOREIGN_BRIDGE_ADDRESS = process.env.FOREIGN_BRIDGE_ADDRESS;
const POA20_ADDRESS = process.env.POA20_ADDRESS;
const GAS_PRICE_SPEED_TYPE = process.env.GAS_PRICE_SPEED_TYPE;
const GAS_LIMIT = process.env.GAS_LIMIT;

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const HOME_ABI = require('./abis/Home_bridge.abi');
const FOREIGN_ABI = require('./abis/Foreign.abi')
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
    return json[type]
  } catch(e) {
    console.error("Gas Price API is not available", e)
    return GAS_PRICE_FALLBACK;
  }
}

async function main(){
  try {

    const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS);
    const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS);
    const homeValidatorsAddress = await homeBridge.methods.validatorContract().call()
    const homeBridgeValidators = new web3Home.eth.Contract(BRIDGE_VALIDATORS_ABI, homeValidatorsAddress);
    
    const foreignValidatorsAddress = await foreignBridge.methods.validatorContract().call()
    const foreignBridgeValidators = new web3Foreign.eth.Contract(BRIDGE_VALIDATORS_ABI, foreignValidatorsAddress);
    
    let ValidatorAddedForeign = await foreignBridgeValidators.getPastEvents('ValidatorAdded', {fromBlock: 0});
    let ValidatorRemovedForeign = await foreignBridgeValidators.getPastEvents('ValidatorRemoved', {fromBlock: 0});
    let foreignValidators = ValidatorAddedForeign.map(val => {
      return val.returnValues.validator
    })
    const foreignRemovedValidators = ValidatorRemovedForeign.map(val => {
      return val.returnValues.validator
    })
    foreignValidators = foreignValidators.filter(val => !foreignRemovedValidators.includes(val));

    let ValidatorAdded = await homeBridgeValidators.getPastEvents('ValidatorAdded', {fromBlock: 0});
    let ValidatorRemoved = await homeBridgeValidators.getPastEvents('ValidatorRemoved', {fromBlock: 0});
    let homeValidators = ValidatorAdded.map(val => {
      return val.returnValues.validator
    })
    const homeRemovedValidators = ValidatorRemoved.map(val => {
      return val.returnValues.validator
    })
    homeValidators = homeValidators.filter(val => !homeRemovedValidators.includes(val));
    let homeBalances = {};
    await asyncForEach(homeValidators, async (v) => {
      homeBalances[v] = Web3Utils.fromWei(await web3Home.eth.getBalance(v)) 
    })
    let foreignVBalances = {};
    let homeVBalances = {};
    let gasPriceInGwei = await getGasPrices(GAS_PRICE_SPEED_TYPE)
    let gasPrice = new Web3Utils.BN(Web3Utils.toWei(gasPriceInGwei.toString(10), 'gwei'))
    const txCost = gasPrice.mul(new Web3Utils.BN(GAS_LIMIT))
    await asyncForEach(foreignValidators, async (v) => {
      const balance = await web3Foreign.eth.getBalance(v)
      const leftTx = new Web3Utils.BN(balance).div(txCost).toString(10)
      foreignVBalances[v] = {balance: Web3Utils.fromWei(balance), leftTx, gasPrice: gasPriceInGwei}
    })

    await asyncForEach(homeValidators, async (v) => {
      const gasPrice = new Web3Utils.BN(1);
      const txCost = gasPrice.mul(new Web3Utils.BN(GAS_LIMIT))
      const balance = await web3Home.eth.getBalance(v)
      const leftTx = new Web3Utils.BN(balance).div(txCost).toString(10)
      homeVBalances[v] = {balance: Web3Utils.fromWei(balance), leftTx, gasPrice: gasPrice.toString(10)}
    })

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
      }
    }
  } catch(e) {
    console.error(e);
  }

}
main()
module.exports = main;