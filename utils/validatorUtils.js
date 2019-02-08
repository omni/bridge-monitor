const BRIDGE_VALIDATORS_ABI = require('../abis/BridgeValidators.abi')
const REWARDABLE_BRIDGE_VALIDATORS_ABI = require('../abis/RewardableValidators.abi')
const BRIDGE_VALIDATORS_V1_ABI = require('../abis/BridgeValidatorsV1.abi')
const logger = require('../logger')('validatorsUtils')

const processValidatorsEvents = events => {
  const validatorList = new Set()
  events.forEach(event => {
    if (event.event === 'ValidatorAdded') {
      validatorList.add(event.returnValues.validator)
    } else if (event.event === 'ValidatorRemoved') {
      validatorList.delete(event.returnValues.validator)
    }
  })
  return Array.from(validatorList)
}

const getValidatorEvents = async bridgeValidatorContract => {
  try {
    return await bridgeValidatorContract.getPastEvents('allEvents', { fromBlock: 0 })
  } catch (e) {
    return []
  }
}

const getValidatorList = async (address, eth) => {
  logger.debug('getting v1ValidatorsEvents')
  const v1Contract = new eth.Contract(BRIDGE_VALIDATORS_V1_ABI, address)
  const v1ValidatorsEvents = await getValidatorEvents(v1Contract)

  logger.debug('getting validatorsEvents')
  const contract = new eth.Contract(BRIDGE_VALIDATORS_ABI, address)
  const validatorsEvents = await getValidatorEvents(contract)

  logger.debug('getting rewardableValidatorsEvents')
  const rewardableContract = new eth.Contract(REWARDABLE_BRIDGE_VALIDATORS_ABI, address)
  const rewardableValidatorsEvents = await getValidatorEvents(rewardableContract)

  const eventList = [...v1ValidatorsEvents, ...validatorsEvents, ...rewardableValidatorsEvents]

  const sortedEvents = eventList.sort((a, b) => a.blockNumber - b.blockNumber)

  return processValidatorsEvents(sortedEvents)
}

module.exports = {
  getValidatorList
}
