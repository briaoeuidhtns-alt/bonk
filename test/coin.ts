import { ethers } from 'hardhat'
import { BonkCoin, BonkCoin__factory } from '../typechain'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

describe('BonkCoin', async () => {
  let token: BonkCoin
  let owner: SignerWithAddress, sig1: SignerWithAddress

  beforeEach(async () => {
    ;[owner, sig1] = await ethers.getSigners()
    const bonkCoinFactory = (await ethers.getContractFactory(
      'BonkCoin',
      owner
    )) as BonkCoin__factory
    token = await bonkCoinFactory.deploy()
    await token.deployed()

    expect(token.address).to.be.a.properAddress
  })

  it('Should be able to mint tokens to an address', async () => {
    token.mint(sig1.address, 1000)
    expect(await token.balanceOf(sig1.address)).to.equal(1000)
  })
})
