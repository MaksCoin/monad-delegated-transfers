import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Ваши развернутые адреса контрактов
const CONTRACT_ADDRESSES = {
  ENTRY_POINT: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  DELEGATION_MANAGER: '0xFA90aEBb2fF807110bCC87Df7409d8620b31Db4D',
  TIMESTAMP_ENFORCER: '0xeDb50A2eBAE418A4e7Cc44f5d5b233CB2eb318bF',
  NATIVE_TOKEN_TRANSFER_AMOUNT_ENFORCER:
    '0x94Cc25F0d8C20EB22820a1a8b5EDEb104c6DB5Ff',
};

// Информация о сети Monad Testnet
const MONAD_TESTNET_CHAIN_ID = 10143;
const MONAD_TESTNET_RPC_URL = 'https://rpc.ankr.com/monad_testnet';
const MONAD_TESTNET_CHAIN_NAME = 'Monad Testnet';
const MONAD_TESTNET_CURRENCY = {
  name: 'Monad',
  symbol: 'MON',
  decimals: 18,
};

// --- ABI для DelegationManager (упрощенный, только для функции execute) ---
const DELEGATION_MANAGER_ABI = [
  'function execute(bytes memory delegation, bytes memory signature) external',
];

// --- Упрощенные типы для EIP-712 подписи (для демонстрации) ---
// В реальном MetaMask Delegation Toolkit это будет гораздо сложнее и специфичнее
const DELEGATION_TYPES = {
  Delegation: [
    { name: 'smartAccount', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'executableAfter', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }, // Для предотвращения повторного использования
  ],
};

const DOMAIN_DATA = {
  name: 'MonadDelegatedTransfers',
  version: '1',
  chainId: MONAD_TESTNET_CHAIN_ID,
  verifyingContract: CONTRACT_ADDRESSES.DELEGATION_MANAGER, // Подписываем для DelegationManager
};

// Функция для загрузки ордеров из localStorage
const loadOrdersFromLocalStorage = (eoaAddress) => {
  try {
    const storedOrders = localStorage.getItem(`delegatedOrders_${eoaAddress}`);
    return storedOrders ? JSON.parse(storedOrders) : [];
  } catch (error) {
    console.error('Ошибка загрузки ордеров из localStorage:', error);
    return [];
  }
};

// Функция для сохранения ордеров в localStorage
const saveOrdersToLocalStorage = (eoaAddress, orders) => {
  try {
    localStorage.setItem(`delegatedOrders_${eoaAddress}`, JSON.stringify(orders));
  } catch (error) {
    console.error('Ошибка сохранения ордеров в localStorage:', error);
  }
};

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null); // EOA пользователя
  const [smartAccountAddress, setSmartAccountAddress] = useState(null);
  const [network, setNetwork] = useState(null);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [pendingOrders, setPendingOrders] = useState([]); // Состояние для хранения отложенных ордеров

  // Состояние для пополнения Smart Account
  const [depositAmount, setDepositAmount] = useState('');
  const [smartAccountBalance, setSmartAccountBalance] = useState('0');

  // Состояние для отложенного ордера
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [delayTime, setDelayTime] = useState(''); // Время в секундах от текущего момента
  const [currentNonce, setCurrentNonce] = useState(0); // Простой nonce для EIP-712

  // Эффект для инициализации Web3 и загрузки ордеров
  useEffect(() => {
    if (window.ethereum) {
      const initWeb3 = async () => {
        try {
          const newProvider = new ethers.BrowserProvider(window.ethereum);
          setProvider(newProvider);

          const network = await newProvider.getNetwork();
          setNetwork(network);

          const accounts = await window.ethereum.request({
            method: 'eth_accounts',
          });
          if (accounts.length > 0) {
            const eoa = accounts[0];
            setAccount(eoa);
            const newSigner = await newProvider.getSigner(eoa); // Указываем конкретный EOA
            setSigner(newSigner);
            // Загрузить ордера для этого EOA
            setPendingOrders(loadOrdersFromLocalStorage(eoa));
          }

          window.ethereum.on('accountsChanged', async (newAccounts) => {
            const eoa = newAccounts[0] || null;
            setAccount(eoa);
            setSigner(eoa ? await newProvider.getSigner(eoa) : null);
            setSmartAccountAddress(null); // Сбросить Smart Account при смене EOA
            setStatus({ message: '', type: '' });
            setPendingOrders(eoa ? loadOrdersFromLocalStorage(eoa) : []); // Загрузить ордера для нового EOA
          });

          window.ethereum.on('chainChanged', (chainId) => {
            window.location.reload(); // Рекомендуется перезагрузить приложение
          });
        } catch (error) {
          console.error('Ошибка инициализации Web3:', error);
          setStatus({
            message: 'Ошибка при инициализации Web3. Убедитесь, что MetaMask установлен.',
            type: 'error',
          });
        }
      };
      initWeb3();
    } else {
      setStatus({
        message: 'MetaMask не обнаружен. Пожалуйста, установите MetaMask.',
        type: 'error',
      });
    }
  }, []);

  // Эффект для получения баланса Smart Account
  useEffect(() => {
    const getBalance = async () => {
      if (provider && smartAccountAddress) {
        try {
          const balance = await provider.getBalance(smartAccountAddress);
          setSmartAccountBalance(ethers.formatEther(balance));
        } catch (error) {
          console.error('Ошибка получения баланса Smart Account:', error);
          setSmartAccountBalance('Error');
        }
      } else {
        setSmartAccountBalance('0');
      }
    };
    getBalance();
    // Обновляем баланс каждые 10 секунд
    const interval = setInterval(getBalance, 10000);
    return () => clearInterval(interval);
  }, [provider, smartAccountAddress, account]);


  // Эффект для обновления статусов ордеров (Ready/Pending)
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingOrders((prevOrders) =>
        prevOrders.map((order) => {
          if (order.status === 'pending' || order.status === 'ready') {
            const currentTime = Math.floor(Date.now() / 1000);
            const isReady = currentTime >= order.message.executableAfter;
            return { ...order, status: isReady ? 'ready' : 'pending' };
          }
          return order;
        })
      );
    }, 1000); // Обновляем каждую секунду
    return () => clearInterval(interval);
  }, []);

  const connectWallet = async () => {
    try {
      if (!provider) {
        setStatus({ message: 'Web3 провайдер не инициализирован.', type: 'error' });
        return;
      }
      await provider.send('eth_requestAccounts', []);
      const newSigner = await provider.getSigner();
      const eoa = await newSigner.getAddress();
      setSigner(newSigner);
      setAccount(eoa);
      setPendingOrders(loadOrdersFromLocalStorage(eoa)); // Загрузить ордера при подключении
      setStatus({ message: 'Кошелек подключен.', type: 'success' });
    } catch (error) {
      console.error('Ошибка подключения кошелька:', error);
      setStatus({
        message: `Ошибка подключения кошелька: ${error.message || error}`,
        type: 'error',
      });
    }
  };

  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${MONAD_TESTNET_CHAIN_ID.toString(16)}`,
            chainName: MONAD_TESTNET_CHAIN_NAME,
            rpcUrls: [MONAD_TESTNET_RPC_URL],
            nativeCurrency: MONAD_TESTNET_CURRENCY,
          },
        ],
      });
      setStatus({ message: `Переключено на ${MONAD_TESTNET_CHAIN_NAME}.`, type: 'success' });
    } catch (error) {
      console.error('Ошибка переключения сети:', error);
      setStatus({
        message: `Ошибка переключения сети: ${error.message || error}`,
        type: 'error',
      });
    }
  };

  const createSmartAccount = async () => {
    setStatus({ message: 'Создание Smart Account (имитация)...', type: 'info' });
    try {
      if (!signer || !account) {
        setStatus({ message: 'Подключите кошелек.', type: 'error' });
        return;
      }

      // В реальном проекте здесь будет вызов SDK для развертывания или получения адреса Smart Account.
      // Для демонстрации мы используем EntryPoint как наш "Smart Account"
      // Так как EntryPoint является валидным контрактом, мы можем отправлять на него MON.
      const simulatedSmartAccountAddress = CONTRACT_ADDRESSES.ENTRY_POINT;
      setSmartAccountAddress(simulatedSmartAccountAddress);
      setStatus({ message: `Smart Account (EntryPoint) установлен: ${simulatedSmartAccountAddress}`, type: 'success' });

      // Обновляем nonce для нового Smart Account
      // В реальном Smart Account nonce будет храниться внутри контракта.
      // Здесь мы просто имитируем его.
      setCurrentNonce(0);

    } catch (error) {
      console.error('Ошибка создания Smart Account:', error);
      setStatus({
        message: `Ошибка создания Smart Account: ${error.message || error}`,
        type: 'error',
      });
    }
  };

  const depositToSmartAccount = async () => {
    setStatus({ message: 'Пополнение Smart Account...', type: 'info' });
    try {
      if (!signer || !smartAccountAddress || !depositAmount) {
        setStatus({ message: 'Заполните все поля и создайте Smart Account.', type: 'error' });
        return;
      }
      const amount = ethers.parseEther(depositAmount);

      const tx = await signer.sendTransaction({
        to: smartAccountAddress,
        value: amount,
      });
      await tx.wait();
      setStatus({ message: `Успешно пополнено ${depositAmount} MON на Smart Account.`, type: 'success' });
      setDepositAmount('');
    } catch (error) {
      console.error('Ошибка пополнения Smart Account:', error);
      setStatus({
        message: `Ошибка пополнения Smart Account: ${error.message || error}`,
        type: 'error',
      });
    }
  };

  const createDelegatedOrder = async () => {
    setStatus({ message: 'Создание отложенного ордера (подписание off-chain)...', type: 'info' });
    try {
      if (
        !signer ||
        !smartAccountAddress ||
        !recipientAddress ||
        !transferAmount ||
        !delayTime
      ) {
        setStatus({ message: 'Заполните все поля для отложенного ордера.', type: 'error' });
        return;
      }

      if (!ethers.isAddress(recipientAddress)) {
        setStatus({ message: 'Неверный адрес получателя.', type: 'error' });
        return;
      }

      const amountWei = ethers.parseEther(transferAmount);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const executableAfterTimestamp = currentTimestamp + parseInt(delayTime);
      const nonce = currentNonce + 1; // Имитация увеличения nonce

      // --- EIP-712 Structured Data Hashing and Signing (Упрощенно!) ---
      // В реальном проекте структура будет гораздо сложнее с использованием Enforcers.
      // Здесь мы подписываем простое сообщение о переводе.

      const message = {
        smartAccount: smartAccountAddress,
        recipient: recipientAddress,
        amount: amountWei.toString(), // EIP-712 требует string для BigInt
        executableAfter: executableAfterTimestamp,
        nonce: nonce,
      };

      const signature = await signer.signTypedData(
        DOMAIN_DATA,
        DELEGATION_TYPES,
        message
      );

      const newOrder = {
        id: Date.now(), // Уникальный ID для ордера
        message: message,
        signature: signature,
        status: 'pending', // 'pending', 'ready', 'executed', 'failed'
        eoaCreator: account, // Кто создал ордер
      };

      const updatedOrders = [...pendingOrders, newOrder];
      setPendingOrders(updatedOrders);
      saveOrdersToLocalStorage(account, updatedOrders); // Сохраняем в localStorage
      setCurrentNonce(nonce); // Обновляем nonce

      setStatus({
        message: `Отложенный ордер успешно подписан и сохранен! Он появится в списке ниже.`,
        type: 'success',
      });

      // Сброс полей
      setRecipientAddress('');
      setTransferAmount('');
      setDelayTime('');
    } catch (error) {
      console.error('Ошибка создания отложенного ордера:', error);
      setStatus({
        message: `Ошибка создания отложенного ордера: ${error.message || error}`,
        type: 'error',
      });
    }
  };

  const executeDelegatedOrder = async (orderId) => {
    setStatus({ message: 'Исполнение отложенного ордера...', type: 'info' });
    try {
      if (!signer || !provider || !smartAccountAddress) {
        setStatus({ message: 'Подключите кошелек и создайте Smart Account.', type: 'error' });
        return;
      }

      const orderToExecute = pendingOrders.find((order) => order.id === orderId);
      if (!orderToExecute) {
        setStatus({ message: 'Ордер не найден.', type: 'error' });
        return;
      }

      if (orderToExecute.status !== 'ready') {
        setStatus({ message: 'Ордер еще не готов к исполнению.', type: 'error' });
        return;
      }

      // --- Формирование `delegation` bytes для execute() ---
      // В реальном Toolkit это будет сложная структура.
      // Здесь мы просто кодируем основные параметры
      const delegationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'uint256', 'uint256'],
        [
          orderToExecute.message.smartAccount,
          orderToExecute.message.recipient,
          orderToExecute.message.amount,
          orderToExecute.message.executableAfter,
          orderToExecute.message.nonce,
        ]
      );
      // Примечание: В реальной жизни, `delegation` должен включать в себя `calldata` и список `enforcers` с их `enforcerArgs`.
      // Для этого примера мы делаем простой перевод нативного токена, имитируя, что Enforcers проверяют его.

      const delegationManager = new ethers.Contract(
        CONTRACT_ADDRESSES.DELEGATION_MANAGER,
        DELEGATION_MANAGER_ABI,
        signer
      );

      // Вызываем execute() на DelegationManager
      const tx = await delegationManager.execute(delegationData, orderToExecute.signature);
      setStatus({ message: `Транзакция исполнения отправлена: ${tx.hash}`, type: 'info' });
      await tx.wait();

      // Обновляем статус ордера
      const updatedOrders = pendingOrders.map((order) =>
        order.id === orderId ? { ...order, status: 'executed', executedTxHash: tx.hash } : order
      );
      setPendingOrders(updatedOrders);
      saveOrdersToLocalStorage(account, updatedOrders);
      setStatus({ message: `Ордер успешно исполнен! Hash: ${tx.hash}`, type: 'success' });
    } catch (error) {
      console.error('Ошибка исполнения ордера:', error);
      const updatedOrders = pendingOrders.map((order) =>
        order.id === orderId ? { ...order, status: 'failed', error: error.message } : order
      );
      setPendingOrders(updatedOrders);
      saveOrdersToLocalStorage(account, updatedOrders);
      setStatus({
        message: `Ошибка исполнения ордера: ${error.message || error}`,
        type: 'error',
      });
    }
  };

  const isMonadTestnet = network && network.chainId === BigInt(MONAD_TESTNET_CHAIN_ID);

  return (
    <div className="App">
      <h1>Monad Delegated Transfers Hackathon Project</h1>

      <div className="section connect-section">
        <h2>1. Подключение кошелька</h2>
        {!account ? (
          <button onClick={connectWallet}>Подключить MetaMask</button>
        ) : (
          <p className="status-message info">Подключен EOA: {account}</p>
        )}
        {network && (
          <p className="status-message info">
            Текущая сеть: {network.name} (Chain ID: {network.chainId.toString()})
          </p>
        )}
        {!isMonadTestnet && account && (
          <button onClick={switchNetwork}>Переключиться на Monad Testnet</button>
        )}
      </div>

      {account && isMonadTestnet && (
        <div className="grid-container">
          <div className="section smart-account-section">
            <h2>2. Smart Account</h2>
            {!smartAccountAddress ? (
              <button onClick={createSmartAccount}>Создать/Получить Smart Account</button>
            ) : (
              <div>
                <p>Ваш Smart Account (EntryPoint):</p>
                <div className="address-display">{smartAccountAddress}</div>
                <p>Баланс Smart Account: {smartAccountBalance} MON</p>
              </div>
            )}

            {smartAccountAddress && (
              <div style={{ marginTop: '20px' }}>
                <h3>Пополнить Smart Account</h3>
                <label htmlFor="depositAmount">Сумма (MON):</label>
                <input
                  id="depositAmount"
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Например, 1.5"
                />
                <button onClick={depositToSmartAccount} disabled={!depositAmount}>
                  Пополнить Smart Account
                </button>
              </div>
            )}
          </div>

          <div className="section delegated-order-section">
            <h2>3. Создать Отложенный Ордер</h2>
            <p className="status-message info">
              Этот ордер будет подписан off-chain и сможет быть исполнен кем угодно после заданного времени.
              (В этом примере Smart Account - это EntryPoint).
            </p>
            <label htmlFor="recipientAddress">Адрес получателя:</label>
            <input
              id="recipientAddress"
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
            />

            <label htmlFor="transferAmount">Количество MON:</label>
            <input
              id="transferAmount"
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="Например, 0.5"
            />

            <label htmlFor="delayTime">Задержка исполнения (секунды):</label>
            <input
              id="delayTime"
              type="number"
              value={delayTime}
              onChange={(e) => setDelayTime(e.target.value)}
              placeholder="Например, 3600 (1 час)"
            />

            <button
              onClick={createDelegatedOrder}
              disabled={!smartAccountAddress || !recipientAddress || !transferAmount || !delayTime}
            >
              Создать Отложенный Ордер
            </button>
          </div>
        </div>
      )}

      {account && isMonadTestnet && pendingOrders.length > 0 && (
        <div className="section pending-orders-section">
          <h2>4. Ожидающие/Исполненные Ордера</h2>
          <div className="order-list">
            {pendingOrders.filter(order => order.eoaCreator === account).map((order) => ( // Фильтруем по создателю
              <div key={order.id} className="order-item">
                <p>
                  ID: {order.id} <span className={`status-badge ${order.status}`}>{order.status}</span>
                </p>
                <p>От Smart Account: {order.message.smartAccount.substring(0, 6)}...{order.message.smartAccount.substring(38)}</p>
                <p>Получатель: {order.message.recipient.substring(0, 6)}...{order.message.recipient.substring(38)}</p>
                <p>Сумма: {ethers.formatEther(order.message.amount)} MON</p>
                <p>
                  Исполнимо после:{' '}
                  {new Date(order.message.executableAfter * 1000).toLocaleString()}
                </p>
                {order.status === 'ready' && (
                  <button onClick={() => executeDelegatedOrder(order.id)}>
                    Исполнить Ордер
                  </button>
                )}
                {order.status === 'executed' && order.executedTxHash && (
                    <p className="status-message success">Исполнено! Tx: {order.executedTxHash.substring(0, 10)}...</p>
                )}
                 {order.status === 'failed' && order.error && (
                    <p className="status-message error">Ошибка исполнения: {order.error.substring(0, 100)}...</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


      {status.message && (
        <div className={`status-message ${status.type}`}>{status.message}</div>
      )}
    </div>
  );
}

export default App;
