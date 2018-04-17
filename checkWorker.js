require('dotenv').config();
const fs = require('fs')
const Web3 = require('web3');
const Web3Utils = require('web3-utils')
const HOME_RPC_URL = process.env.HOME_RPC_URL;
const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const HOME_BRIDGE_ADDRESS = process.env.HOME_BRIDGE_ADDRESS;
const FOREIGN_BRIDGE_ADDRESS = process.env.FOREIGN_BRIDGE_ADDRESS;
const POA20_ADDRESS = process.env.POA20_ADDRESS;

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const ERC677_ABI = require('./ERC677.abi');

async function main(){
  try {
    const homeBalance = await web3Home.eth.getBalance(HOME_BRIDGE_ADDRESS)
    const tokenContract = new web3Foreign.eth.Contract(ERC677_ABI, POA20_ADDRESS);
    const totalSupply = await tokenContract.methods.totalSupply().call()
    const homeBalanceBN = new Web3Utils.BN(homeBalance)
    const foreignTotalSupplyBN = new Web3Utils.BN(totalSupply)
    const diff = homeBalanceBN.sub(foreignTotalSupplyBN).toString(10)
    return {
      homeBalance: Web3Utils.fromWei(homeBalance),
      foreignTotalSupply: Web3Utils.fromWei(totalSupply),
      diff
    }
  } catch(e) {
    console.error(e);
  }

}
main().then((res) => {
  console.log(res)
  fs.writeFileSync('./results.json', JSON.stringify(res,null,4));
})
