import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { connectBroker, disconnectBroker, getAccountDetails, placeBrokerOrder, resetAccount } from '../services/brokerService.js';
import fs from 'fs';

describe('Broker Integration Service Tests', () => {
  beforeEach(() => {
    // Reset connection state and clear database before each test
    resetAccount();
  });

  test('should initially connect to Sandbox broker', () => {
    const details = connectBroker('Sandbox', 'key123', 'sec123', '1111');
    expect(details.connected).toBe(true);
    expect(details.broker).toBe('Sandbox');
    expect(details.apiKey).toBe('key123');
    expect(details.balance).toBeGreaterThan(0);
  });

  test('should throw error when placing order while disconnected', () => {
    disconnectBroker();
    expect(() => {
      placeBrokerOrder('RELIANCE.NS', 'BUY', 10, 2400.0);
    }).toThrow("No broker account connected");
  });

  test('should successfully execute long buy order and deduct balance', () => {
    connectBroker('Sandbox', 'key', 'sec', '1111');
    const initialDetails = getAccountDetails();
    const initialBalance = initialDetails.balance;

    const qty = 5;
    const price = 2000.0;
    const result = placeBrokerOrder('TCS.NS', 'BUY', qty, price);

    expect(result.success).toBe(true);
    expect(result.orderId).toContain('ORD-');
    
    const account = getAccountDetails();
    expect(account.balance).toBe(initialBalance - (qty * price));
    expect(account.positions.length).toBe(1);
    expect(account.positions[0].symbol).toBe('TCS.NS');
    expect(account.positions[0].quantity).toBe(qty);
    expect(account.positions[0].averagePrice).toBe(price);
  });

  test('should enforce margin limits on buy orders', () => {
    connectBroker('Sandbox', 'key', 'sec', '1111');
    const account = getAccountDetails();
    const maxAffordableQty = Math.floor(account.balance / 1000) + 10; // quantity that exceeds balance

    expect(() => {
      placeBrokerOrder('RELIANCE.NS', 'BUY', maxAffordableQty, 1000.0);
    }).toThrow("Insufficient funds");
  });

  test('should handle selling and exit positions fully', () => {
    connectBroker('Sandbox', 'key', 'sec', '1111');
    
    // First Buy
    placeBrokerOrder('ITC.NS', 'BUY', 10, 400.0);
    
    // Then Sell 10 (exits position)
    const result = placeBrokerOrder('ITC.NS', 'SELL', 10, 410.0);
    expect(result.success).toBe(true);

    const account = getAccountDetails();
    expect(account.positions.length).toBe(0); // Position is exited
  });
});
