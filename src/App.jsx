import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

const WalletIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V8H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h12v-4" /><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
  </svg>
);
const SmartAccountIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const CreateOrderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const HistoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" />
  </svg>
);
const StatusIcon = ({ status }) => {
    const colors = { pending: '#F59E0B', ready: '#22C55E', executed: '#8B5CF6', failed: '#EF4444' };
    const Svg = {
        pending: <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>,
        ready: <path d="M20 6 9 17l-5-5"/>,
        executed: (
            <>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </>
        ),
        failed: <path d="M18 6 6 18M6 6l12 12"/>
    };
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors[status]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {Svg[status]}
        </svg>
    );
};


// --- КОД ПРИЛОЖЕНИЯ (без изменений в логике) ---

const CONTRACT_ADDRESSES = {
  ENTRY_POINT: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  DELEGATION_MANAGER: '0xFA90aEBb2fF807110bCC87Df7409d8620b31Db4D',
  TIMESTAMP_ENFORCER: '0xeDb50A2eBAE418A4e7Cc44f5d5b233CB2eb318bF',
  NATIVE_TOKEN_TRANSFER_AMOUNT_ENFORCER:
    '0x94Cc25F0d8C20EB22820a1a8b5EDEb104c6DB5Ff',
};
const MONAD_TESTNET_CHAIN_ID = 10143;
const MONAD_TESTNET_RPC_URL = 'https://rpc.ankr.com/monad_testnet';
const MONAD_TESTNET_CHAIN_NAME = 'Monad Testnet';
const MONAD_TESTNET_CURRENCY = { name: 'Monad', symbol: 'MON', decimals: 18 };
const DELEGATION_MANAGER_ABI = ['function execute(bytes memory delegation, bytes memory signature) external'];
const DELEGATION_TYPES = { Delegation: [{ name: 'smartAccount', type: 'address' },{ name: 'recipient', type: 'address' },{ name: 'amount', type: 'uint256' },{ name: 'executableAfter', type: 'uint256' },{ name: 'nonce', type: 'uint256' }]};
const DOMAIN_DATA = { name: 'MonadDelegatedTransfers', version: '1', chainId: MONAD_TESTNET_CHAIN_ID, verifyingContract: CONTRACT_ADDRESSES.DELEGATION_MANAGER };
const loadOrdersFromLocalStorage = (eoaAddress) => { try { const storedOrders = localStorage.getItem(`delegatedOrders_${eoaAddress}`); return storedOrders ? JSON.parse(storedOrders) : []; } catch (error) { console.error('Error loading orders from localStorage:', error); return []; }};
const saveOrdersToLocalStorage = (eoaAddress, orders) => { try { localStorage.setItem(`delegatedOrders_${eoaAddress}`, JSON.stringify(orders)); } catch (error) { console.error('Error saving orders to localStorage:', error); }};

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState(null);
  const [network, setNetwork] = useState(null);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [pendingOrders, setPendingOrders] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [smartAccountBalance, setSmartAccountBalance] = useState('0');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [delayTime, setDelayTime] = useState('');
  const [currentNonce, setCurrentNonce] = useState(0);

  useEffect(() => {
    if (window.ethereum) {
      const initWeb3 = async () => {
        try {
          const newProvider = new ethers.BrowserProvider(window.ethereum);
          setProvider(newProvider);
          const network = await newProvider.getNetwork();
          setNetwork(network);
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const eoa = accounts[0];
            setAccount(eoa);
            const newSigner = await newProvider.getSigner(eoa);
            setSigner(newSigner);
            setPendingOrders(loadOrdersFromLocalStorage(eoa));
          }
          window.ethereum.on('accountsChanged', async (newAccounts) => {
            const eoa = newAccounts[0] || null;
            setAccount(eoa);
            setSigner(eoa ? await newProvider.getSigner(eoa) : null);
            setSmartAccountAddress(null);
            setStatus({ message: '', type: '' });
            setPendingOrders(eoa ? loadOrdersFromLocalStorage(eoa) : []);
          });
          window.ethereum.on('chainChanged', () => { window.location.reload(); });
        } catch (error) { console.error('Error initializing Web3:', error); setStatus({ message: 'Error initializing Web3. Please ensure MetaMask is installed.', type: 'error' }); }
      };
      initWeb3();
    } else { setStatus({ message: 'MetaMask not detected. Please install MetaMask.', type: 'error' }); }
  }, []);

  useEffect(() => {
    const getBalance = async () => {
      if (provider && smartAccountAddress) {
        try { const balance = await provider.getBalance(smartAccountAddress); setSmartAccountBalance(ethers.formatEther(balance)); } catch (error) { console.error('Error fetching Smart Account balance:', error); setSmartAccountBalance('Error'); }
      } else { setSmartAccountBalance('0'); }
    };
    getBalance(); const interval = setInterval(getBalance, 10000); return () => clearInterval(interval);
  }, [provider, smartAccountAddress, account]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingOrders((prevOrders) => prevOrders.map((order) => {
        if (order.status === 'pending' || order.status === 'ready') {
          const currentTime = Math.floor(Date.now() / 1000);
          const isReady = currentTime >= order.message.executableAfter;
          return { ...order, status: isReady ? 'ready' : 'pending' };
        }
        return order;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const connectWallet = async () => {
    try {
      if (!provider) { setStatus({ message: 'Web3 provider not initialized.', type: 'error' }); return; }
      await provider.send('eth_requestAccounts', []);
      const newSigner = await provider.getSigner();
      const eoa = await newSigner.getAddress();
      setSigner(newSigner);
      setAccount(eoa);
      setPendingOrders(loadOrdersFromLocalStorage(eoa));
      setStatus({ message: 'Wallet connected successfully.', type: 'success' });
    } catch (error) { console.error('Error connecting wallet:', error); setStatus({ message: `Error connecting wallet: ${error.message || error}`, type: 'error' }); }
  };

  const switchNetwork = async () => {
    try {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: `0x${MONAD_TESTNET_CHAIN_ID.toString(16)}`, chainName: MONAD_TESTNET_CHAIN_NAME, rpcUrls: [MONAD_TESTNET_RPC_URL], nativeCurrency: MONAD_TESTNET_CURRENCY }] });
      setStatus({ message: `Switched to ${MONAD_TESTNET_CHAIN_NAME}.`, type: 'success' });
    } catch (error) { console.error('Error switching network:', error); setStatus({ message: `Error switching network: ${error.message || error}`, type: 'error' }); }
  };

  const createSmartAccount = async () => {
    setStatus({ message: 'Creating Smart Account (simulation)...', type: 'info' });
    try {
      if (!signer || !account) { setStatus({ message: 'Please connect your wallet first.', type: 'error' }); return; }
      const simulatedSmartAccountAddress = CONTRACT_ADDRESSES.ENTRY_POINT;
      setSmartAccountAddress(simulatedSmartAccountAddress);
      setStatus({ message: `Smart Account (EntryPoint) has been set: ${simulatedSmartAccountAddress}`, type: 'success' });
      setCurrentNonce(0);
    } catch (error) { console.error('Error creating Smart Account:', error); setStatus({ message: `Error creating Smart Account: ${error.message || error}`, type: 'error' }); }
  };

  const depositToSmartAccount = async () => {
    setStatus({ message: 'Funding Smart Account...', type: 'info' });
    try {
      if (!signer || !smartAccountAddress || !depositAmount) { setStatus({ message: 'Please fill all fields and set a Smart Account.', type: 'error' }); return; }
      const amount = ethers.parseEther(depositAmount);
      const tx = await signer.sendTransaction({ to: smartAccountAddress, value: amount });
      await tx.wait();
      setStatus({ message: `Successfully funded ${depositAmount} MON to the Smart Account.`, type: 'success' });
      setDepositAmount('');
    } catch (error) { console.error('Error funding Smart Account:', error); setStatus({ message: `Error funding Smart Account: ${error.message || error}`, type: 'error' }); }
  };

  const createDelegatedOrder = async () => {
    setStatus({ message: 'Creating delegated order (off-chain signing)...', type: 'info' });
    try {
      if (!signer || !smartAccountAddress || !recipientAddress || !transferAmount || !delayTime) { setStatus({ message: 'Please fill all fields for the delegated order.', type: 'error' }); return; }
      if (!ethers.isAddress(recipientAddress)) { setStatus({ message: 'Invalid recipient address.', type: 'error' }); return; }
      const amountWei = ethers.parseEther(transferAmount);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const executableAfterTimestamp = currentTimestamp + parseInt(delayTime);
      const nonce = currentNonce + 1;
      const message = { smartAccount: smartAccountAddress, recipient: recipientAddress, amount: amountWei.toString(), executableAfter: executableAfterTimestamp, nonce: nonce };
      const signature = await signer.signTypedData(DOMAIN_DATA, DELEGATION_TYPES, message);
      const newOrder = { id: Date.now(), message: message, signature: signature, status: 'pending', eoaCreator: account };
      const updatedOrders = [...pendingOrders, newOrder];
      setPendingOrders(updatedOrders);
      saveOrdersToLocalStorage(account, updatedOrders);
      setCurrentNonce(nonce);
      setStatus({ message: `Delegated order signed and saved successfully!`, type: 'success' });
      setRecipientAddress('');
      setTransferAmount('');
      setDelayTime('');
    } catch (error) { console.error('Error creating delegated order:', error); setStatus({ message: `Error creating delegated order: ${error.message || error}`, type: 'error' }); }
  };

  const executeDelegatedOrder = async (orderId) => {
    setStatus({ message: 'Executing delegated order...', type: 'info' });
    try {
      if (!signer || !provider || !smartAccountAddress) { setStatus({ message: 'Please connect your wallet and set a Smart Account.', type: 'error' }); return; }
      const orderToExecute = pendingOrders.find((order) => order.id === orderId);
      if (!orderToExecute) { setStatus({ message: 'Order not found.', type: 'error' }); return; }
      if (orderToExecute.status !== 'ready') { setStatus({ message: 'Order is not yet ready for execution.', type: 'error' }); return; }
      const delegationData = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address', 'uint256', 'uint256', 'uint256'], [orderToExecute.message.smartAccount, orderToExecute.message.recipient, orderToExecute.message.amount, orderToExecute.message.executableAfter, orderToExecute.message.nonce]);
      const delegationManager = new ethers.Contract(CONTRACT_ADDRESSES.DELEGATION_MANAGER, DELEGATION_MANAGER_ABI, signer);
      const tx = await delegationManager.execute(delegationData, orderToExecute.signature);
      setStatus({ message: `Execution transaction sent: ${tx.hash}`, type: 'info' });
      await tx.wait();
      const updatedOrders = pendingOrders.map((order) => order.id === orderId ? { ...order, status: 'executed', executedTxHash: tx.hash } : order);
      setPendingOrders(updatedOrders);
      saveOrdersToLocalStorage(account, updatedOrders);
      setStatus({ message: `Order executed successfully! Hash: ${tx.hash}`, type: 'success' });
    } catch (error) {
      console.error('Error executing order:', error);
      const updatedOrders = pendingOrders.map((order) => order.id === orderId ? { ...order, status: 'failed', error: error.message } : order);
      setPendingOrders(updatedOrders);
      saveOrdersToLocalStorage(account, updatedOrders);
      setStatus({ message: `Error executing order: ${error.reason || error.message || "Unknown error"}`, type: 'error' });
    }
  };

  const isMonadTestnet = network && network.chainId === BigInt(MONAD_TESTNET_CHAIN_ID);

  return (
    <div className="App">
      <div className="app-header">
        <h1>Monad Delegated Transfers</h1>
        <p>Schedule future payments gaslessly using MetaMask Smart Accounts.</p>
      </div>

      <div className="section">
        <div className="card">
            <h2><WalletIcon /> Connection</h2>
            {!account ? (
              <button onClick={connectWallet}><WalletIcon />Connect MetaMask</button>
            ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                    <p className="status-message info">Connected EOA: {account}</p>
                    <p className="status-message info">
                        Current Network: {network ? `${network.name} (ID: ${network.chainId.toString()})` : 'Loading...'}
                    </p>
                </div>
            )}
            {!isMonadTestnet && account && (
              <button onClick={switchNetwork} style={{marginTop: '12px', width: '100%'}}>Switch to Monad Testnet</button>
            )}
        </div>
      </div>

      {account && isMonadTestnet && (
        <>
            <div className="grid-container">
                <div className="card">
                    <h2><SmartAccountIcon/>Smart Account</h2>
                    {!smartAccountAddress ? (
                    <button onClick={createSmartAccount}>Get Smart Account</button>
                    ) : (
                    <div>
                        <p style={{color: 'var(--text-secondary)', fontSize: '14px'}}>Your Smart Account (EntryPoint):</p>
                        <div className="address-display">{smartAccountAddress}</div>
                        <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginTop: '16px'}}>Balance: <span style={{color: 'var(--text-primary)', fontWeight: '600'}}>{parseFloat(smartAccountBalance).toFixed(4)} MON</span></p>
                    </div>
                    )}

                    {smartAccountAddress && (
                    <div style={{ marginTop: '20px' }}>
                        <div className="form-group">
                        <label htmlFor="depositAmount">Amount to Fund (MON):</label>
                        <input id="depositAmount" type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="e.g., 1.5"/>
                        </div>
                        <button onClick={depositToSmartAccount} disabled={!depositAmount}>Fund Smart Account</button>
                    </div>
                    )}
                </div>

                <div className="card">
                    <h2><CreateOrderIcon/>Create Delegated Order</h2>
                    <div className="form-group">
                        <label htmlFor="recipientAddress">Recipient Address:</label>
                        <input id="recipientAddress" type="text" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} placeholder="0x..."/>
                    </div>
                    <div className="form-group">
                        <label htmlFor="transferAmount">Amount (MON):</label>
                        <input id="transferAmount" type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="e.g., 0.5"/>
                    </div>
                    <div className="form-group">
                        <label htmlFor="delayTime">Execution Delay (seconds):</label>
                        <input id="delayTime" type="number" value={delayTime} onChange={(e) => setDelayTime(e.target.value)} placeholder="e.g., 60"/>
                    </div>
                    <button onClick={createDelegatedOrder} disabled={!smartAccountAddress || !recipientAddress || !transferAmount || !delayTime}>
                        Sign & Create Order
                    </button>
                </div>
            </div>

            {status.message && (
                <div className={`status-message ${status.type}`}>{status.message}</div>
            )}

            {pendingOrders.length > 0 && (
            <div className="card">
                <h2><HistoryIcon/>Order History</h2>
                <div className="order-list">
                {pendingOrders.filter(order => order.eoaCreator === account).map((order) => (
                    <div key={order.id} className="order-item">
                        <div className="order-header">
                            <p>ID: {order.id}</p>
                            <div className={`status-badge ${order.status}`}>
                                <StatusIcon status={order.status}/>
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </div>
                        </div>
                        <div className="order-details">
                            <p>To: <span>{order.message.recipient.substring(0, 6)}...{order.message.recipient.substring(38)}</span></p>
                            <p>Amount: <span>{ethers.formatEther(order.message.amount)} MON</span></p>
                            <p>Executable After: <span>{new Date(order.message.executableAfter * 1000).toLocaleString()}</span></p>
                        </div>
                        {order.status === 'ready' && (
                            <button onClick={() => executeDelegatedOrder(order.id)}>Execute Order</button>
                        )}
                        {order.executedTxHash && (
                            <p className="status-message success" style={{marginTop: '12px'}}>Executed! Tx: {order.executedTxHash.substring(0, 10)}...</p>
                        )}
                         {order.error && (
                            <p className="status-message error" style={{marginTop: '12px'}}>Failed: {order.error.substring(0, 100)}...</p>
                        )}
                    </div>
                ))}
                </div>
            </div>
            )}
        </>
      )}
    </div>
  );
}

export default App;
