import WebSocket from 'ws';

export interface IBOrder {
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MKT' | 'LMT' | 'STP' | 'STP LMT';
  price?: number;
  stopPrice?: number;
  timeInForce: 'DAY' | 'GTC';
}

export interface IBContract {
  symbol: string;
  secType: 'STK';
  exchange: 'ASX';
  currency: 'AUD';
}

export interface IBOrderStatus {
  orderId: number;
  status: 'PendingSubmit' | 'PendingCancel' | 'PreSubmitted' | 'Submitted' | 'ApiPending' | 'ApiCancelled' | 'Cancelled' | 'Filled' | 'Inactive';
  filled: number;
  remaining: number;
  avgFillPrice: number;
  permId: number;
  parentId: number;
  lastFillPrice: number;
  clientId: number;
  whyHeld: string;
}

export class IBClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private requestId = 0;
  private host: string;
  private port: number;
  private clientId: number;

  constructor() {
    this.host = process.env.IB_HOST || 'localhost';
    this.port = parseInt(process.env.IB_PORT || '7497');
    this.clientId = parseInt(process.env.IB_CLIENT_ID || '1');
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`ws://${this.host}:${this.port}/v1/api/ws`);
        
        this.ws.on('open', () => {
          console.log('Connected to Interactive Brokers TWS');
          this.isConnected = true;
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('Disconnected from Interactive Brokers TWS');
          this.isConnected = false;
        });

        // Set timeout for connection
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error('Error connecting to IB:', error);
        reject(error);
      }
    });
  }

  private handleMessage(message: string): void {
    try {
      const data = JSON.parse(message);
      console.log('IB Message:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'orderStatus':
          this.handleOrderStatus(data);
          break;
        case 'error':
          console.error('IB Error:', data);
          break;
        default:
          console.log('Unhandled message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing IB message:', error);
    }
  }

  private handleOrderStatus(data: any): void {
    console.log(`Order ${data.orderId} status: ${data.status}`);
    // Update database with order status
    this.updateOrderStatus(data);
  }

  private async updateOrderStatus(orderStatus: IBOrderStatus): Promise<void> {
    try {
      const { query } = await import('../db/postgres');
      
      await query(`
        UPDATE trades 
        SET status = $1, 
            executed_at = CASE WHEN $1 = 'FILLED' THEN CURRENT_TIMESTAMP ELSE executed_at END,
            closed_at = CASE WHEN $1 = 'FILLED' AND action = 'SELL' THEN CURRENT_TIMESTAMP ELSE closed_at END
        WHERE order_id = $2
      `, [orderStatus.status, orderStatus.orderId.toString()]);

      console.log(`Updated order ${orderStatus.orderId} status to ${orderStatus.status}`);
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  }

  async placeOrder(contract: IBContract, order: IBOrder): Promise<number> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Interactive Brokers');
    }

    const orderId = ++this.requestId;
    
    const orderRequest = {
      type: 'placeOrder',
      orderId,
      contract: {
        symbol: contract.symbol,
        secType: contract.secType,
        exchange: contract.exchange,
        currency: contract.currency
      },
      order: {
        action: order.action,
        totalQuantity: order.quantity,
        orderType: order.orderType,
        ...(order.price && { lmtPrice: order.price }),
        ...(order.stopPrice && { auxPrice: order.stopPrice }),
        tif: order.timeInForce
      }
    };

    this.ws.send(JSON.stringify(orderRequest));
    
    console.log(`Placed order ${orderId} for ${contract.symbol}: ${order.action} ${order.quantity} @ ${order.orderType}`);
    
    return orderId;
  }

  async placeBuyOrder(symbol: string, quantity: number, price?: number): Promise<number> {
    const contract: IBContract = {
      symbol: symbol.replace('.ASX', '').replace('.AX', ''), // Remove .ASX or .AX suffix for IB
      secType: 'STK',
      exchange: 'ASX',
      currency: 'AUD'
    };

    const order: IBOrder = {
      action: 'BUY',
      quantity,
      orderType: price ? 'LMT' : 'MKT',
      price,
      timeInForce: 'DAY'
    };

    return this.placeOrder(contract, order);
  }

  async placeSellOrder(symbol: string, quantity: number, price?: number): Promise<number> {
    const contract: IBContract = {
      symbol: symbol.replace('.ASX', '').replace('.AX', ''), // Remove .ASX or .AX suffix for IB
      secType: 'STK',
      exchange: 'ASX',
      currency: 'AUD'
    };

    const order: IBOrder = {
      action: 'SELL',
      quantity,
      orderType: price ? 'LMT' : 'MKT',
      price,
      timeInForce: 'DAY'
    };

    return this.placeOrder(contract, order);
  }

  async placeStopLossOrder(symbol: string, quantity: number, stopPrice: number): Promise<number> {
    const contract: IBContract = {
      symbol: symbol.replace('.AX', ''),
      secType: 'STK',
      exchange: 'ASX',
      currency: 'AUD'
    };

    const order: IBOrder = {
      action: 'SELL',
      quantity,
      orderType: 'STP',
      stopPrice,
      timeInForce: 'GTC'
    };

    return this.placeOrder(contract, order);
  }

  async placeTakeProfitOrder(symbol: string, quantity: number, limitPrice: number): Promise<number> {
    const contract: IBContract = {
      symbol: symbol.replace('.AX', ''),
      secType: 'STK',
      exchange: 'ASX',
      currency: 'AUD'
    };

    const order: IBOrder = {
      action: 'SELL',
      quantity,
      orderType: 'LMT',
      price: limitPrice,
      timeInForce: 'GTC'
    };

    return this.placeOrder(contract, order);
  }

  async cancelOrder(orderId: number): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Interactive Brokers');
    }

    const cancelRequest = {
      type: 'cancelOrder',
      orderId
    };

    this.ws.send(JSON.stringify(cancelRequest));
    console.log(`Cancelled order ${orderId}`);
  }

  async getAccountSummary(): Promise<any> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Interactive Brokers');
    }

    const requestId = ++this.requestId;
    const request = {
      type: 'reqAccountSummary',
      reqId: requestId,
      group: 'All',
      tags: 'TotalCashValue,NetLiquidation,GrossPositionValue'
    };

    this.ws.send(JSON.stringify(request));
    console.log(`Requested account summary (request ID: ${requestId})`);
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      console.log('Disconnected from Interactive Brokers');
    }
  }

  isConnectedToIB(): boolean {
    return this.isConnected;
  }
}
