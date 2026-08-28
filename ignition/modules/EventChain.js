const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("EventChain", (m) => {
  const deployer = m.getAccount(0);

  const eventChainContract = m.contract("EventChainContract", [deployer]);
  const eventChainEventManagerContract = m.contract("EventChainEventManagerContract", [
    deployer,
    eventChainContract,
  ]);

  return { eventChainContract, eventChainEventManagerContract };
});