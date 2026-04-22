// ─── CONFIG — update these after deploying on Remix ───────────────────────────
const CONTRACT_ADDRESS = "0xd93fb33057209652F27B60CAC039Ec568701cd34";

// Paste your ABI array here after compiling in Remix
// (Remix → Solidity Compiler → ABI button → copy and paste below)
const CONTRACT_ABI = [
  "function registerContent(string calldata _title, string calldata _descriptionHash) external returns (uint256)",
  "function supportContent(uint256 _contentId) external payable",
  "function markViral(uint256 _contentId) external",
  "function getSupporterCount(uint256 _contentId) external view returns (uint256)",
  "function getPoolSize(uint256 _contentId) external view returns (uint256)",
  "function getSupporters(uint256 _contentId) external view returns (address[])",
  "function getContentDetails(uint256 _contentId) external view returns (string, address, uint256, uint256, bool)",
  "function contentCount() external view returns (uint256)",
  "event ContentRegistered(uint256 indexed contentId, address indexed creator, string title)",
  "event ContentSupported(uint256 indexed contentId, address indexed supporter, uint256 supporterIndex)",
  "event ContentWentViral(uint256 indexed contentId, uint256 rewardPerSupporter)"
];
// ──────────────────────────────────────────────────────────────────────────────

// ─── Global State ─────────────────────────────────────────────────────────────
let provider = null;
let signer   = null;
let contract = null;

// ─── Connect Wallet ───────────────────────────────────────────────────────────
async function connectWallet() {
  if (!window.ethereum) {
    alert("Metamask not found! Please install Metamask and connect it to Ganache.");
    return;
  }

  try {
    // Request account access
    await window.ethereum.request({ method: "eth_requestAccounts" });

    provider = new ethers.BrowserProvider(window.ethereum);
    signer   = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Show shortened address in header
    const address = await signer.getAddress();
    document.getElementById("wallet-address").textContent =
      address.slice(0, 6) + "..." + address.slice(-4);

    document.getElementById("connect-btn").textContent = "Connected";
    document.getElementById("connect-btn").disabled = true;

    console.log("Connected:", address);
  } catch (err) {
    console.error("Wallet connection failed:", err);
    alert("Connection failed: " + err.message);
  }
}

// ─── Guard: check wallet is connected before any tx ──────────────────────────
function requireWallet() {
  if (!contract) {
    alert("Please connect your wallet first!");
    return false;
  }
  return true;
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function setStatus(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "tx-status " + (type || "");
}

// ─── 1. registerContent ───────────────────────────────────────────────────────
async function registerContent() {
  if (!requireWallet()) return;

  const title = document.getElementById("reg-title").value.trim();
  const hash  = document.getElementById("reg-hash").value.trim();

  if (!title || !hash) {
    setStatus("reg-status", "Please fill in both fields.", "error");
    return;
  }

  try {
    setStatus("reg-status", "Sending transaction...", "loading");

    const tx = await contract.registerContent(title, hash);
    setStatus("reg-status", "Waiting for confirmation... tx: " + tx.hash, "loading");

    const receipt = await tx.wait();

    // Parse the ContentRegistered event to get the new content ID
    const event = receipt.logs
      .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
      .find(e => e && e.name === "ContentRegistered");

    const contentId = event ? event.args.contentId.toString() : "?";
    setStatus("reg-status", `Success! Content ID: ${contentId} — share this with your audience.`, "success");

    document.getElementById("reg-title").value = "";
    document.getElementById("reg-hash").value  = "";

  } catch (err) {
    console.error(err);
    setStatus("reg-status", "Error: " + (err.reason || err.message), "error");
  }
}

// ─── 2. supportContent ────────────────────────────────────────────────────────
async function supportContent() {
  if (!requireWallet()) return;

  const contentId = document.getElementById("sup-id").value.trim();
  if (!contentId || contentId <= 0) {
    setStatus("sup-status", "Please enter a valid content ID.", "error");
    return;
  }

  try {
    setStatus("sup-status", "Sending 0.01 ETH...", "loading");

    const tx = await contract.supportContent(contentId, {
      value: ethers.parseEther("0.01")   // exact amount the contract requires
    });
    setStatus("sup-status", "Waiting for confirmation...", "loading");
    await tx.wait();

    setStatus("sup-status", `You're in! Wallet recorded as supporter for content #${contentId}.`, "success");
    document.getElementById("sup-id").value = "";

  } catch (err) {
    console.error(err);
    // Surface the contract's revert reason clearly
    const reason = err.reason || err.data?.message || err.message;
    setStatus("sup-status", "Error: " + reason, "error");
  }
}

// ─── 3. markViral ─────────────────────────────────────────────────────────────
async function markViral() {
  if (!requireWallet()) return;

  const contentId = document.getElementById("viral-id").value.trim();
  if (!contentId || contentId <= 0) {
    setStatus("viral-status", "Please enter a valid content ID.", "error");
    return;
  }

  const confirmed = confirm(
    `Mark content #${contentId} as viral?\n\n` +
    `This will immediately distribute the entire ETH pool to all supporters. This cannot be undone.`
  );
  if (!confirmed) return;

  try {
    setStatus("viral-status", "Triggering viral payout...", "loading");

    const tx = await contract.markViral(contentId);
    setStatus("viral-status", "Waiting for confirmation...", "loading");
    await tx.wait();

    setStatus("viral-status", `Content #${contentId} is viral! ETH distributed to all supporters.`, "success");
    document.getElementById("viral-id").value = "";

  } catch (err) {
    console.error(err);
    const reason = err.reason || err.data?.message || err.message;
    setStatus("viral-status", "Error: " + reason, "error");
  }
}

// ─── 4. getSupporterCount (read-only) ────────────────────────────────────────
async function fetchSupporterCount() {
  if (!requireWallet()) return;

  const contentId = document.getElementById("count-id").value.trim();
  if (!contentId || contentId <= 0) {
    setStatus("count-status", "Please enter a valid content ID.", "error");
    return;
  }

  try {
    setStatus("count-status", "Fetching...", "loading");
    const count = await contract.getSupporterCount(contentId);
    document.getElementById("count-result").textContent = count.toString() + " / 3";
    renderSlots(Number(count));
    setStatus("count-status", "Fetched successfully.", "success");
  } catch (err) {
    console.error(err);
    setStatus("count-status", "Error: " + (err.reason || err.message), "error");
  }
}

// ─── 5. getPoolSize (read-only) ───────────────────────────────────────────────
async function fetchPoolSize() {
  if (!requireWallet()) return;

  const contentId = document.getElementById("pool-id").value.trim();
  if (!contentId || contentId <= 0) {
    setStatus("pool-status", "Please enter a valid content ID.", "error");
    return;
  }

  try {
    setStatus("pool-status", "Fetching...", "loading");
    const pool = await contract.getPoolSize(contentId);
    document.getElementById("pool-result").textContent = ethers.formatEther(pool) + " ETH";
    setStatus("pool-status", "Fetched successfully.", "success");
  } catch (err) {
    console.error(err);
    setStatus("pool-status", "Error: " + (err.reason || err.message), "error");
  }
}

// ─── 6. getSupporters (read-only) ────────────────────────────────────────────
async function fetchSupporters() {
  if (!requireWallet()) return;

  const contentId = document.getElementById("supporters-id").value.trim();
  if (!contentId || contentId <= 0) {
    setStatus("supporters-status", "Please enter a valid content ID.", "error");
    return;
  }

  try {
    setStatus("supporters-status", "Fetching...", "loading");
    const supporters = await contract.getSupporters(contentId);
    renderWalletList(supporters);
    setStatus("supporters-status", `Found ${supporters.length} supporter(s).`, "success");
  } catch (err) {
    console.error(err);
    setStatus("supporters-status", "Error: " + (err.reason || err.message), "error");
  }
}

// ─── Render 3 slot squares ────────────────────────────────────────────────────
function renderSlots(filledCount) {
  const container = document.getElementById("slots-visual");
  container.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const div = document.createElement("div");
    div.className = "slot" + (i < filledCount ? " filled" : "");
    div.title = i < filledCount ? `Supporter #${i + 1}` : `Slot ${i + 1} — open`;
    container.appendChild(div);
  }
}

// ─── Render wallet list ───────────────────────────────────────────────────────
function renderWalletList(supporters) {
  const label     = document.getElementById("wallet-list-label");
  const container = document.getElementById("wallet-list");
  container.innerHTML = "";

  if (!supporters || supporters.length === 0) {
    label.style.display = "none";
    return;
  }

  label.style.display = "block";

  supporters.forEach((addr, i) => {
    const entry = document.createElement("div");
    entry.className = "wallet-entry";
    entry.innerHTML = `
      <span class="w-num">#${i + 1}</span>
      <span class="w-addr">${addr}</span>
    `;
    container.appendChild(entry);
  });
}

// ─── Auto-init: if already connected (page refresh), re-attach ────────────────
window.addEventListener("load", async () => {
  if (window.ethereum) {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      await connectWallet();
    }
  }

  // Pre-render empty slots
  renderSlots(0);
});

// ─── Handle wallet account changes ────────────────────────────────────────────
if (window.ethereum) {
  window.ethereum.on("accountsChanged", async (accounts) => {
    if (accounts.length > 0) {
      await connectWallet();
    } else {
      document.getElementById("wallet-address").textContent = "Not connected";
      document.getElementById("connect-btn").textContent = "Connect Wallet";
      document.getElementById("connect-btn").disabled = false;
      signer = null; contract = null;
    }
  });
}
