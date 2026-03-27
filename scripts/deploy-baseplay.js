const hre = require('hardhat')

async function main() {
  const BaseQuestMerkle = await hre.ethers.getContractFactory('BaseQuestMerkle')
  const contract = await BaseQuestMerkle.deploy()

  await contract.waitForDeployment()

  const address = await contract.getAddress()
  console.log('BaseQuestMerkle deployed to:', address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
