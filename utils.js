async function existsErc677Token(web3, abi, address) {
  const bridgeContract = new web3.eth.Contract(abi, address)
  try {
    await bridgeContract.methods.erc677token().call()
    return true
  } catch (e) {
    return false
  }
}

module.exports = {
  existsErc677Token
}
