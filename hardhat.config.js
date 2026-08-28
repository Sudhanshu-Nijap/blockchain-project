require("@nomicfoundation/hardhat-toolbox");

try {
  require("dotenv").config();
} catch (e) {}

const ALCHEMY_PROJECT_ID = process.env.ALCHEMY_PROJECT_ID || "";
let rawPrivateKey = process.env.PRIVATE_KEY || "";
if (rawPrivateKey && !rawPrivateKey.startsWith("0x")) {
  rawPrivateKey = `0x${rawPrivateKey}`;
}
// Validate that the private key looks like a 32-byte hex string before passing to Hardhat
const accounts = (rawPrivateKey && rawPrivateKey.length === 66) ? [rawPrivateKey] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ganache: {
      url: process.env.GANACHE_URL || "http://127.0.0.1:7545",
      allowUnlimitedContractSize: true,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || (ALCHEMY_PROJECT_ID ? `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_PROJECT_ID}` : "https://polygon-amoy-bor-rpc.publicnode.com"),
      accounts: accounts,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || (ALCHEMY_PROJECT_ID ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_PROJECT_ID}` : "https://ethereum-sepolia-rpc.publicnode.com"),
      accounts: accounts,
    },
  },
};

