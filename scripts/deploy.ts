import { ethers } from 'hardhat'
;(async () => {
  const factory = await ethers.getContractFactory('BonkCoin')

  // If we had constructor arguments, they would be passed into deploy()
  let contract = await factory.deploy()

  // The address the Contract WILL have once mined
  console.log({
    address: contract.address,
    deployHash: contract.deployTransaction.hash,
  })

  // The contract is NOT deployed yet; we must wait until it is mined
  await contract.deployed()
})()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
