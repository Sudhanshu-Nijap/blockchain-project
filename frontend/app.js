/**
 * EventChain Dynamic On-Chain Web3 & State Logic
 * Multi-device Web3 ready with auto-network detection.
 */

// Global Default Deployed Contracts (Live on Ethereum Sepolia public blockchain)
const DEFAULT_CONFIG = {
  ticketContract: "0xA28adE8605F1E58FE455d6698d19a508C721D761",
  managerContract: "0x6D9109e282e4259952232998004DcA75a9c0CE5c",
  sepoliaChainId: "0xaa36a7", // 11155111
  polygonAmoyChainId: "0x13882" // 80002
};

// Dynamic Configuration from LocalStorage with fallback to defaults
function getConfig() {
  return {
    ticketContract: localStorage.getItem('ec_ticket_contract') || DEFAULT_CONFIG.ticketContract,
    managerContract: localStorage.getItem('ec_manager_contract') || DEFAULT_CONFIG.managerContract,
    sepoliaChainId: DEFAULT_CONFIG.sepoliaChainId,
    polygonAmoyChainId: DEFAULT_CONFIG.polygonAmoyChainId
  };
}

function setConfig(ticketAddr, managerAddr) {
  localStorage.setItem('ec_ticket_contract', ticketAddr);
  localStorage.setItem('ec_manager_contract', managerAddr);
}

// Dynamic Stored Data (Purely populated by user actions / on-chain queries)
function getStoredEvents() {
  const saved = localStorage.getItem('ec_events');
  return saved ? JSON.parse(saved) : [];
}

function saveEvents(events) {
  localStorage.setItem('ec_events', JSON.stringify(events));
}

function getStoredTickets() {
  const saved = localStorage.getItem('ec_tickets');
  return saved ? JSON.parse(saved) : [];
}

function saveTickets(tickets) {
  localStorage.setItem('ec_tickets', JSON.stringify(tickets));
}

function getStoredLogs() {
  const saved = localStorage.getItem('ec_logs');
  return saved ? JSON.parse(saved) : [];
}

function saveLogs(logs) {
  localStorage.setItem('ec_logs', JSON.stringify(logs.slice(0, 50)));
}

// Complete ABI Definitions
const EVENT_CHAIN_ABI = [
  "function safeMint(address to, string uri, string eventDetails, uint256 originalPrice, uint256 expirationDate) public",
  "function validateTicket(uint256 tokenId) public",
  "function getTicketHistory(uint256 tokenId) public view returns (address[])",
  "function getTicketStatus(uint256 tokenId) public view returns (bool isUsed, bool isValid)",
  "function updateTicketMetadata(uint256 tokenId, string newEventDetails, string newURI) public",
  "function setMaxResalePrice(uint256 tokenId, uint256 maxPrice) public",
  "function burnExpiredTickets(uint256 tokenId) public",
  "function transferWithHistoryUpdate(address from, address to, uint256 tokenId) public",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function tokenURI(uint256 tokenId) public view returns (string)",
  "function maxResalePrice(uint256 tokenId) public view returns (uint256)",
  "event TicketMinted(uint256 indexed tokenId, address indexed to, string eventDetails, uint256 originalPrice, uint256 expirationDate)",
  "event TicketValidated(uint256 indexed tokenId, address indexed validatedBy)",
  "event TicketTransferred(uint256 indexed tokenId, address indexed from, address indexed to)",
  "event TicketMaxResalePriceSet(uint256 indexed tokenId, uint256 maxPrice)",
  "event TicketExpired(uint256 indexed tokenId)"
];

const EVENT_MANAGER_ABI = [
  "function createEvent(string name, string location, string date, uint256 ticketPrice) public",
  "function getEventDetails(uint256 eventId) public view returns (tuple(string name, string location, string date, uint256 ticketPrice, address organizer))",
  "function mintTicket(uint256 eventId, address to, string uri) public",
  "function transferEvent(uint256 eventId, address to) external",
  "function setEventChainAddress(address eventChainContractAddress) external",
  "event EventCreated(uint256 indexed eventId, string name, string location, string date, uint256 ticketPrice, address indexed organizer)",
  "event EventTransferred(uint256 indexed eventId, address indexed previousOrganizer, address indexed newOrganizer)"
];

// Runtime State
const state = {
  provider: null,
  signer: null,
  userAddress: null,
  chainId: null,
  contracts: {
    eventChain: null,
    eventManager: null
  },
  eventsList: getStoredEvents(),
  myTickets: getStoredTickets(),
  logs: getStoredLogs()
};

// UI: Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const styles = {
    info: 'bg-white border-slate-200 text-slate-800 shadow-md',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm',
    error: 'bg-rose-50 border-rose-200 text-rose-900 shadow-sm',
    warning: 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm'
  };

  const icons = {
    info: 'fa-circle-info text-blue-600',
    success: 'fa-circle-check text-emerald-600',
    error: 'fa-triangle-exclamation text-rose-600',
    warning: 'fa-circle-exclamation text-amber-600'
  };

  toast.className = `flex items-center gap-2.5 p-3 rounded-lg border text-xs font-medium ${styles[type] || styles.info} transition-all`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-sm shrink-0"></i>
    <div class="flex-1">${message}</div>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-xs"></i></button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Activity Logging
function addActivityLog(action, details, txHash = null) {
  const timestamp = new Date().toLocaleTimeString();
  const logItem = { action, details, timestamp, txHash };
  state.logs.unshift(logItem);
  saveLogs(state.logs);
  renderActivityFeed();
}

function renderActivityFeed() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;

  if (state.logs.length === 0) {
    feed.innerHTML = `<div class="text-slate-400 text-center py-4 text-xs font-mono">No transactions recorded yet</div>`;
    return;
  }

  feed.innerHTML = state.logs.slice(0, 8).map(log => `
    <div class="p-2 bg-slate-50 rounded border border-slate-200 text-xs">
      <div class="flex justify-between items-center mb-0.5">
        <span class="font-semibold text-slate-800">${log.action}</span>
        <span class="text-[10px] text-slate-400 font-mono">${log.timestamp}</span>
      </div>
      <p class="text-slate-500 truncate text-[11px]">${log.details}</p>
      ${log.txHash ? `<a href="https://sepolia.etherscan.io/tx/${log.txHash}" target="_blank" class="text-[10px] text-blue-600 hover:underline font-mono">Tx: ${log.txHash.slice(0, 10)}... →</a>` : ''}
    </div>
  `).join('');
}

// Helper function to resolve Web3 provider (handles multi-wallet extensions & standard window.ethereum)
function getEthereumProvider() {
  if (typeof window !== 'undefined' && window.ethereum) {
    if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 0) {
      return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum.providers[0];
    }
    return window.ethereum;
  }
  return null;
}

// Initialize Web3
async function initWeb3() {
  const config = getConfig();
  const ethereum = getEthereumProvider();

  if (ethereum) {
    try {
      state.provider = new ethers.BrowserProvider(ethereum);
      const accounts = await state.provider.send("eth_accounts", []);
      
      if (accounts.length > 0) {
        state.signer = await state.provider.getSigner();
        state.userAddress = accounts[0];
        const network = await state.provider.getNetwork();
        state.chainId = network.chainId;
        if (config.ticketContract && config.managerContract) {
          initContracts(config.ticketContract, config.managerContract);
        }
        updateWalletUI();
      }
    } catch (err) {
      console.warn("Auto-connect skipped:", err);
    }
  }

  renderActivityFeed();
}

function initContracts(ticketAddr, managerAddr) {
  try {
    if (ethers.isAddress(ticketAddr) && ethers.isAddress(managerAddr)) {
      if (state.signer) {
        state.contracts.eventChain = new ethers.Contract(ticketAddr, EVENT_CHAIN_ABI, state.signer);
        state.contracts.eventManager = new ethers.Contract(managerAddr, EVENT_MANAGER_ABI, state.signer);
      } else if (state.provider) {
        state.contracts.eventChain = new ethers.Contract(ticketAddr, EVENT_CHAIN_ABI, state.provider);
        state.contracts.eventManager = new ethers.Contract(managerAddr, EVENT_MANAGER_ABI, state.provider);
      }
    }
  } catch (err) {
    console.error("Contract initialization error:", err);
  }
}

// Connect Wallet Action
async function connectWallet() {
  const ethereum = getEthereumProvider();

  if (!ethereum) {
    showToast("MetaMask not detected. Please make sure the extension has permission for this page and refresh.", "warning");
    return;
  }

  try {
    state.provider = new ethers.BrowserProvider(ethereum);
    await state.provider.send("eth_requestAccounts", []);
    state.signer = await state.provider.getSigner();
    state.userAddress = await state.signer.getAddress();
    const network = await state.provider.getNetwork();
    state.chainId = network.chainId;

    const config = getConfig();
    if (config.ticketContract && config.managerContract) {
      initContracts(config.ticketContract, config.managerContract);
    }

    updateWalletUI();
    showToast(`Connected: ${state.userAddress.slice(0, 6)}...${state.userAddress.slice(-4)}`, "success");
    addActivityLog("Wallet Connected", `Address: ${state.userAddress}`);
  } catch (err) {
    console.error("Connection failed:", err);
    showToast(err.message || "Failed to connect wallet", "error");
  }
}

async function switchNetwork() {
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    showToast("MetaMask is required to switch network", "warning");
    return;
  }
  const config = getConfig();
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.sepoliaChainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: config.sepoliaChainId,
            chainName: 'Ethereum Sepolia Testnet',
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
            blockExplorerUrls: ['https://sepolia.etherscan.io/']
          }],
        });
      } catch (addError) {
        showToast("Failed to add Sepolia network", "error");
      }
    }
  }
}

async function ensureSepoliaNetwork() {
  const ethereum = getEthereumProvider();
  if (!ethereum || !state.provider) return true;
  try {
    const network = await state.provider.getNetwork();
    if (network.chainId !== 11155111n && network.chainId !== 11155111) {
      showToast("Switching network to Sepolia Testnet...", "info");
      await switchNetwork();
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Network verification check:", err);
    return true;
  }
}

function setupEthereumListeners() {
  const ethereum = getEthereumProvider();
  if (ethereum && ethereum.on) {
    ethereum.on('chainChanged', () => window.location.reload());
    ethereum.on('accountsChanged', () => window.location.reload());
  }
}

function updateWalletUI() {
  const btn = document.getElementById('btn-connect-wallet');
  const userAddrDisplay = document.getElementById('user-address-pill');
  const networkBadge = document.getElementById('network-badge');

  if (state.userAddress) {
    if (btn) btn.classList.add('hidden');
    if (userAddrDisplay) {
      userAddrDisplay.classList.remove('hidden');
      userAddrDisplay.querySelector('.address-text').textContent = `${state.userAddress.slice(0, 6)}...${state.userAddress.slice(-4)}`;
    }
    if (networkBadge) {
      if (state.chainId === 11155111n || state.chainId === 11155111) {
        networkBadge.textContent = "Sepolia Testnet";
      } else if (state.chainId === 80002n || state.chainId === 80002) {
        networkBadge.textContent = "Polygon Amoy";
      } else {
        networkBadge.textContent = `Chain: ${state.chainId || 'Connected'}`;
      }
    }
  } else {
    if (btn) btn.classList.remove('hidden');
    if (userAddrDisplay) userAddrDisplay.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initWeb3();
  setupEthereumListeners();
  document.getElementById('btn-connect-wallet')?.addEventListener('click', connectWallet);
  document.getElementById('btn-switch-network')?.addEventListener('click', switchNetwork);
});

