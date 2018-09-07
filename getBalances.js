require('dotenv').config();
const logger = require('./logger')('getBalances');
const Web3 = require('web3');
const Web3Utils = require('web3-utils')
const BN = require('bignumber.js')

const HOME_RPC_URL = process.env.HOME_RPC_URL;
const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const HOME_BRIDGE_ADDRESS = process.env.HOME_BRIDGE_ADDRESS;
const FOREIGN_BRIDGE_ADDRESS = process.env.FOREIGN_BRIDGE_ADDRESS;
const POA20_ADDRESS = process.env.POA20_ADDRESS;

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const ERC20_ABI = require('./abis/ERC20.abi');
const ERC677_ABI = require('./abis/ERC677.abi');
const HOME_ERC_ABI = require('./abis/HomeBridgeErcToErc.abi')

async function main(isErcToErcMode){
  try {
    if (isErcToErcMode) {
      const erc20Contract = new web3Foreign.eth.Contract(ERC20_ABI, POA20_ADDRESS)
      logger.debug('calling erc20Contract.methods.balanceOf');
      const foreignErc20Balance = await erc20Contract.methods.balanceOf(FOREIGN_BRIDGE_ADDRESS).call()
      const homeBridge = new web3Home.eth.Contract(HOME_ERC_ABI, HOME_BRIDGE_ADDRESS);
      logger.debug('calling homeBridge.methods.erc677token');
      const tokenAddress = await homeBridge.methods.erc677token().call()
      const tokenContract = new web3Home.eth.Contract(ERC677_ABI, tokenAddress);
      logger.debug('calling tokenContract.methods.totalSupply()');
      const totalSupply = await tokenContract.methods.totalSupply().call()
      const foreignBalanceBN = new BN(foreignErc20Balance)
      const foreignTotalSupplyBN = new BN(totalSupply)
      const diff = foreignBalanceBN.minus(foreignTotalSupplyBN).toString(10)
      logger.debug("Done");
      return {
        home: {
          totalSupply: Web3Utils.fromWei(totalSupply),
        },
        foreign: {
          erc20Balance: Web3Utils.fromWei(foreignErc20Balance)
        },
        balanceDiff: Number(Web3Utils.fromWei(diff)),
        lastChecked: Math.floor(Date.now() / 1000)
      }
    } else {
      logger.debug('calling web3Home.eth.getBalance');
      const homeBalance = await web3Home.eth.getBalance(HOME_BRIDGE_ADDRESS)
      const tokenContract = new web3Foreign.eth.Contract(ERC20_ABI, POA20_ADDRESS);
      logger.debug('calling tokenContract.methods.totalSupply()');
      const totalSupply = await tokenContract.methods.totalSupply().call()
      const homeBalanceBN = new BN(homeBalance)
      const foreignTotalSupplyBN = new BN(totalSupply)
      const diff = homeBalanceBN.minus(foreignTotalSupplyBN).toString(10)
      logger.debug("Done");
      return {
        home: {
          balance: Web3Utils.fromWei(homeBalance)
        },
        foreign: {
          totalSupply: Web3Utils.fromWei(totalSupply),
        },
        balanceDiff: Number(Web3Utils.fromWei(diff)),
        lastChecked: Math.floor(Date.now() / 1000)
      }
    }
  } catch(e) {
    logger.error(e);
    throw e;
  }

}

module.exports = main;
