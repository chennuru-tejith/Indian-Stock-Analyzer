import fs from 'fs';
import path from 'path';

// Local database path for paper trading / sandbox broker states
const BROKER_DB_PATH = path.join(process.cwd(), 'scratch', 'broker_account_db.json');

// Default initial sandbox account stats
const DEFAULT_ACCOUNT = {
  connected: false,
  broker: 'Sandbox',
  apiKey: '',
  balance: 500000.0, // ₹5,00,000 capital
  marginAvailable: 500000.0,
  positions: [],
  orders: []
};

function readBrokerDB() {
  try {
    if (fs.existsSync(BROKER_DB_PATH)) {
      const data = fs.readFileSync(BROKER_DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to read broker database, using default:", err.message);
  }
  return { ...DEFAULT_ACCOUNT };
}

function writeBrokerDB(data) {
  try {
    const parentDir = path.dirname(BROKER_DB_PATH);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(BROKER_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write broker database:", err.message);
  }
}

/**
 * Resets account values to default starting values.
 */
export function resetAccount() {
  const db = {
    connected: false,
    broker: 'Sandbox',
    apiKey: '',
    balance: 500000.0,
    marginAvailable: 500000.0,
    positions: [],
    orders: []
  };
  writeBrokerDB(db);
  return db;
}

/**
 * Connects to a stock market account (broker).
 */
export function connectBroker(brokerName, apiKey, apiSecret, pin) {
  const db = readBrokerDB();
  db.connected = true;
  db.broker = brokerName;
  db.apiKey = apiKey;
  
  // Set default initial capital based on connection type
  if (brokerName !== 'Sandbox') {
    db.balance = 250000.0; // Assume live broker account balance
  }
  db.marginAvailable = db.balance;
  writeBrokerDB(db);
  return db;
}

/**
 * Disconnects the active broker account.
 */
export function disconnectBroker() {
  const db = readBrokerDB();
  db.connected = false;
  db.apiKey = '';
  writeBrokerDB(db);
  return db;
}

/**
 * Returns account statistics, margins, and active holdings.
 */
export function getAccountDetails() {
  return readBrokerDB();
}

/**
 * Places a trade order with the active broker.
 */
export function placeBrokerOrder(symbol, side, quantity, price, orderType = 'LIMIT', stopLoss = 0, target = 0) {
  const db = readBrokerDB();
  if (!db.connected) {
    throw new Error("No broker account connected. Please connect a broker before executing trades.");
  }

  const qty = Number(quantity);
  const prc = Number(price);
  if (isNaN(qty) || qty <= 0) throw new Error("Invalid order quantity.");
  if (isNaN(prc) || prc <= 0) throw new Error("Invalid order price.");

  const orderValue = qty * prc;

  // Margin Check (For Long orders)
  if (side === 'BUY' && orderValue > db.marginAvailable) {
    throw new Error(`Insufficient funds: Order requires ₹${orderValue.toFixed(2)} but only ₹${db.marginAvailable.toFixed(2)} margin is available.`);
  }

  // Create new order record
  const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
  const newOrder = {
    orderId,
    symbol,
    side,
    quantity: qty,
    price: prc,
    orderType,
    status: 'COMPLETED', // Execute instantly in sandbox/paper mode
    timestamp: new Date().toISOString()
  };

  db.orders.push(newOrder);

  // Update Positions & Margins
  if (side === 'BUY') {
    db.balance -= orderValue;
    db.marginAvailable = db.balance;

    // Check if position already exists
    const posIndex = db.positions.findIndex(p => p.symbol === symbol);
    if (posIndex >= 0) {
      const existing = db.positions[posIndex];
      const newQty = existing.quantity + qty;
      const newAvgPrice = ((existing.quantity * existing.averagePrice) + orderValue) / newQty;
      db.positions[posIndex] = {
        ...existing,
        quantity: newQty,
        averagePrice: Number(newAvgPrice.toFixed(2)),
        currentPrice: prc,
        value: newQty * prc
      };
    } else {
      db.positions.push({
        symbol,
        quantity: qty,
        averagePrice: prc,
        currentPrice: prc,
        value: orderValue,
        stopLoss,
        target
      });
    }
  } else {
    // SELL / short or exit position
    const posIndex = db.positions.findIndex(p => p.symbol === symbol);
    if (posIndex >= 0) {
      const existing = db.positions[posIndex];
      if (qty > existing.quantity) {
        throw new Error(`Cannot sell ${qty} shares: You only own ${existing.quantity} shares of ${symbol}.`);
      }
      
      const proceeds = qty * prc;
      db.balance += proceeds;
      db.marginAvailable = db.balance;

      if (qty === existing.quantity) {
        // Exit position fully
        db.positions.splice(posIndex, 1);
      } else {
        // Reduce position
        const remainingQty = existing.quantity - qty;
        db.positions[posIndex] = {
          ...existing,
          quantity: remainingQty,
          value: remainingQty * prc
        };
      }
    } else {
      // Short selling (allowed in sandbox/paper margin mode)
      db.balance += orderValue;
      db.marginAvailable = db.balance;
      db.positions.push({
        symbol,
        quantity: -qty, // negative indicates short
        averagePrice: prc,
        currentPrice: prc,
        value: -orderValue,
        stopLoss,
        target
      });
    }
  }

  writeBrokerDB(db);
  return {
    success: true,
    orderId,
    message: `Order ${orderId} executed successfully: ${side} ${qty} shares of ${symbol} at ₹${prc}`,
    account: db
  };
}
