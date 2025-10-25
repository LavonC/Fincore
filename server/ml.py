from flask import Flask, jsonify, request, send_file
from SmartApi import SmartConnect
from SmartApi.smartWebSocketV2 import SmartWebSocketV2
import pyotp
from logzero import logger
from flask_cors import CORS
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from flask_socketio import SocketIO
import threading
import pytz
import sqlite3
from contextlib import contextmanager

smartApi = None
totp = None
data = None
active_sws = {} 

load_dotenv()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

api_key = os.getenv("API_KEY")
username = "AAAV325665"
pwd = os.getenv("PASSWORD")
token_secret = os.getenv("TOKEN_SECRET")

# Database setup
DATABASE = 'trading.db'

@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    """Initialize database with required tables"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT,
                demo_pin TEXT DEFAULT '1234',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Balances table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS balances (
                user_id TEXT PRIMARY KEY,
                balance REAL DEFAULT 0.0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')
        
        # Holdings table (current positions)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS holdings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                symbol_token TEXT NOT NULL,
                company_name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                avg_buy_price REAL NOT NULL,
                current_price REAL DEFAULT 0.0,
                invested_amount REAL NOT NULL,
                current_value REAL DEFAULT 0.0,
                pnl REAL DEFAULT 0.0,
                pnl_percent REAL DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                UNIQUE(user_id, symbol_token)
            )
        ''')
        
        # Transactions table (buy history)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                symbol_token TEXT NOT NULL,
                company_name TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                total_amount REAL NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')
        
        # Sell history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sell_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                symbol_token TEXT NOT NULL,
                company_name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                buy_price REAL NOT NULL,
                sell_price REAL NOT NULL,
                profit_loss REAL NOT NULL,
                profit_loss_percent REAL NOT NULL,
                total_amount REAL NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')
        
        # Balance history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS balance_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                amount REAL NOT NULL,
                transaction_type TEXT NOT NULL,
                description TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')
        
        logger.info("✅ Database initialized successfully")

# Initialize database on startup
init_db()


def is_market_open():
    """Check if Indian stock market is currently open"""
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    
    if now.weekday() > 4:
        return False
    
    market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
    
    return market_open <= now <= market_close


def login_smart_api():
    global smartApi
    if smartApi:
        return smartApi

    try:
        totp = pyotp.TOTP(token_secret).now()
        smartApi_instance = SmartConnect(api_key)
        data = smartApi_instance.generateSession(username, pwd, totp)

        if not data['status']:
            raise Exception(f"Login failed: {data}")

        smartApi = smartApi_instance
        logger.info("✅ Successfully logged in to Angel One SmartAPI.")
        return smartApi
    except Exception as e:
        logger.error(f"Login failed with error: {e}")
        raise


# ==================== BALANCE ENDPOINTS ====================

@app.route('/add_balance', methods=['POST'])
def add_balance():
    """Add money to user's account"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        print(user_id)
        amount = data.get('amount')
        demo_pin = data.get('demo_pin')
        
        # FIXED: Check if user_id is provided
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
            
        if not amount:
            return jsonify({"error": "amount is required"}), 400
        
        if amount <= 0:
            return jsonify({"error": "Amount must be greater than 0"}), 400
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if user exists, if not create user and balance entry
            cursor.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
            user = cursor.fetchone()
            
            if not user:
                # Create new user
                cursor.execute('''
                    INSERT INTO users (user_id, username, email)
                    VALUES (?, ?, ?)
                ''', (user_id, f'User_{user_id}', f'{user_id}@app.com'))
                
                # Create balance entry
                cursor.execute('''
                    INSERT INTO balances (user_id, balance)
                    VALUES (?, 0.0)
                ''', (user_id,))
            
            # Update balance
            cursor.execute('''
                UPDATE balances 
                SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            ''', (amount, user_id))
            
            # If no rows were updated, insert new balance
            if cursor.rowcount == 0:
                cursor.execute('''
                    INSERT INTO balances (user_id, balance)
                    VALUES (?, ?)
                ''', (user_id, amount))
            
            # Record in balance history
            cursor.execute('''
                INSERT INTO balance_history (user_id, amount, transaction_type, description)
                VALUES (?, ?, ?, ?)
            ''', (user_id, amount, 'CREDIT', f'Added ₹{amount} to account'))
            
            # Get new balance
            cursor.execute('SELECT balance FROM balances WHERE user_id = ?', (user_id,))
            result = cursor.fetchone()
            new_balance = result['balance'] if result else amount
            
            return jsonify({
                "success": True,
                "message": f"₹{amount} added successfully",
                "new_balance": new_balance
            })
            
    except Exception as e:
        logger.error(f"Error in add_balance: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/get_balance', methods=['GET'])
def get_balance():
    """Get user's current balance"""
    try:
        user_id = request.args.get('user_id')
        print(user_id)
        
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if balance exists
            cursor.execute('SELECT balance FROM balances WHERE user_id = ?', (user_id,))
            result = cursor.fetchone()
            
            if not result:
                # Create user and balance if doesn't exist
                cursor.execute('''
                    INSERT OR IGNORE INTO users (user_id, username, email)
                    VALUES (?, ?, ?)
                ''', (user_id, f'User_{user_id}', f'{user_id}@app.com'))
                
                cursor.execute('''
                    INSERT INTO balances (user_id, balance)
                    VALUES (?, 0.0)
                ''', (user_id,))
                
                return jsonify({
                    "success": True,
                    "user_id": user_id,
                    "balance": 0.0
                })
            
            return jsonify({
                "success": True,
                "user_id": user_id,
                "balance": result['balance']
            })
            
    except Exception as e:
        logger.error(f"Error in get_balance: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/balance_history', methods=['GET'])
def balance_history():
    """Get balance transaction history"""
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM balance_history 
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT 50
            ''', (user_id,))
            
            history = [dict(row) for row in cursor.fetchall()]
            
            return jsonify({
                "success": True,
                "history": history
            })
            
    except Exception as e:
        logger.error(f"Error in balance_history: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== TRADING ENDPOINTS ====================

@app.route('/buy_stock', methods=['POST'])
def buy_stock():
    """Buy shares - deduct from balance and add to holdings"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        symbol = data.get('symbol')
        symbol_token = data.get('symbol_token')
        company_name = data.get('company_name')
        quantity = data.get('quantity')
        price = data.get('price')
        
        # FIXED: Validate user_id
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        
        if not all([symbol, symbol_token, company_name, quantity, price]):
            return jsonify({"error": "Missing required fields"}), 400
        
        if quantity <= 0:
            return jsonify({"error": "Quantity must be greater than 0"}), 400
        
        total_amount = quantity * price
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check balance
            cursor.execute('SELECT balance FROM balances WHERE user_id = ?', (user_id,))
            balance_row = cursor.fetchone()
            
            if not balance_row:
                return jsonify({"error": "User balance not found. Please add money first."}), 404
            
            current_balance = balance_row['balance']
            
            if current_balance < total_amount:
                return jsonify({
                    "error": "Insufficient balance",
                    "required": total_amount,
                    "available": current_balance
                }), 400
            
            # Deduct from balance
            cursor.execute('''
                UPDATE balances 
                SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            ''', (total_amount, user_id))
            
            # Add to holdings or update existing
            cursor.execute('''
                SELECT * FROM holdings 
                WHERE user_id = ? AND symbol_token = ?
            ''', (user_id, symbol_token))
            
            existing_holding = cursor.fetchone()
            
            if existing_holding:
                # Update existing holding
                new_quantity = existing_holding['quantity'] + quantity
                new_invested = existing_holding['invested_amount'] + total_amount
                new_avg_price = new_invested / new_quantity
                
                cursor.execute('''
                    UPDATE holdings 
                    SET quantity = ?, 
                        avg_buy_price = ?,
                        invested_amount = ?,
                        current_price = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND symbol_token = ?
                ''', (new_quantity, new_avg_price, new_invested, price, user_id, symbol_token))
            else:
                # Create new holding
                cursor.execute('''
                    INSERT INTO holdings 
                    (user_id, symbol, symbol_token, company_name, quantity, 
                     avg_buy_price, current_price, invested_amount)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, symbol, symbol_token, company_name, quantity, 
                      price, price, total_amount))
            
            # Record transaction
            cursor.execute('''
                INSERT INTO transactions 
                (user_id, symbol, symbol_token, company_name, transaction_type, 
                 quantity, price, total_amount)
                VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?)
            ''', (user_id, symbol, symbol_token, company_name, quantity, price, total_amount))
            
            # Record balance history
            cursor.execute('''
                INSERT INTO balance_history (user_id, amount, transaction_type, description)
                VALUES (?, ?, ?, ?)
            ''', (user_id, -total_amount, 'DEBIT', 
                  f'Bought {quantity} shares of {symbol} @ ₹{price}'))
            
            # Get new balance
            cursor.execute('SELECT balance FROM balances WHERE user_id = ?', (user_id,))
            new_balance = cursor.fetchone()['balance']
            
            return jsonify({
                "success": True,
                "message": f"Successfully bought {quantity} shares of {symbol}",
                "total_amount": total_amount,
                "new_balance": new_balance
            })
            
    except Exception as e:
        logger.error(f"Error in buy_stock: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/sell_stock', methods=['POST'])
def sell_stock():
    """Sell shares - add to balance and update holdings"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        symbol_token = data.get('symbol_token')
        quantity = data.get('quantity')
        current_price = data.get('price')
        
        # FIXED: Validate user_id
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        
        if not all([symbol_token, quantity, current_price]):
            return jsonify({"error": "Missing required fields"}), 400
        
        if quantity <= 0:
            return jsonify({"error": "Quantity must be greater than 0"}), 400
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if user has the stock
            cursor.execute('''
                SELECT * FROM holdings 
                WHERE user_id = ? AND symbol_token = ?
            ''', (user_id, symbol_token))
            
            holding = cursor.fetchone()
            
            if not holding:
                return jsonify({"error": "Stock not found in holdings"}), 404
            
            if holding['quantity'] < quantity:
                return jsonify({
                    "error": "Insufficient shares",
                    "available": holding['quantity'],
                    "requested": quantity
                }), 400
            
            # Calculate profit/loss
            buy_price = holding['avg_buy_price']
            sell_amount = quantity * current_price
            invested_for_qty = quantity * buy_price
            profit_loss = sell_amount - invested_for_qty
            profit_loss_percent = (profit_loss / invested_for_qty) * 100
            
            # Add to balance
            cursor.execute('''
                UPDATE balances 
                SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            ''', (sell_amount, user_id))
            
            # Update or remove holding
            new_quantity = holding['quantity'] - quantity
            
            if new_quantity == 0:
                # Remove holding completely
                cursor.execute('''
                    DELETE FROM holdings 
                    WHERE user_id = ? AND symbol_token = ?
                ''', (user_id, symbol_token))
            else:
                # Update holding
                new_invested = holding['invested_amount'] - invested_for_qty
                cursor.execute('''
                    UPDATE holdings 
                    SET quantity = ?,
                        invested_amount = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND symbol_token = ?
                ''', (new_quantity, new_invested, user_id, symbol_token))
            
            # Record sell transaction
            cursor.execute('''
                INSERT INTO transactions 
                (user_id, symbol, symbol_token, company_name, transaction_type, 
                 quantity, price, total_amount)
                VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?)
            ''', (user_id, holding['symbol'], symbol_token, holding['company_name'], 
                  quantity, current_price, sell_amount))
            
            # Record in sell history
            cursor.execute('''
                INSERT INTO sell_history 
                (user_id, symbol, symbol_token, company_name, quantity, 
                 buy_price, sell_price, profit_loss, profit_loss_percent, total_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, holding['symbol'], symbol_token, holding['company_name'],
                  quantity, buy_price, current_price, profit_loss, 
                  profit_loss_percent, sell_amount))
            
            # Record balance history
            cursor.execute('''
                INSERT INTO balance_history (user_id, amount, transaction_type, description)
                VALUES (?, ?, ?, ?)
            ''', (user_id, sell_amount, 'CREDIT', 
                  f'Sold {quantity} shares of {holding["symbol"]} @ ₹{current_price}'))
            
            # Get new balance
            cursor.execute('SELECT balance FROM balances WHERE user_id = ?', (user_id,))
            new_balance = cursor.fetchone()['balance']
            
            return jsonify({
                "success": True,
                "message": f"Successfully sold {quantity} shares of {holding['symbol']}",
                "total_amount": sell_amount,
                "profit_loss": profit_loss,
                "profit_loss_percent": profit_loss_percent,
                "new_balance": new_balance
            })
            
    except Exception as e:
        logger.error(f"Error in sell_stock: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/get_holdings', methods=['GET'])
def get_holdings():
    """Get user's current holdings with live P&L calculation"""
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM holdings 
                WHERE user_id = ?
                ORDER BY created_at DESC
            ''', (user_id,))
            
            holdings = [dict(row) for row in cursor.fetchall()]
            
            # Calculate current values and P&L for each holding
            for holding in holdings:
                current_value = holding['quantity'] * holding['current_price']
                pnl = current_value - holding['invested_amount']
                pnl_percent = (pnl / holding['invested_amount']) * 100 if holding['invested_amount'] > 0 else 0
                
                holding['current_value'] = current_value
                holding['pnl'] = pnl
                holding['pnl_percent'] = pnl_percent
            
            # Calculate totals
            total_invested = sum(h['invested_amount'] for h in holdings)
            total_current = sum(h['current_value'] for h in holdings)
            total_pnl = total_current - total_invested
            total_pnl_percent = (total_pnl / total_invested * 100) if total_invested > 0 else 0
            
            return jsonify({
                "success": True,
                "holdings": holdings,
                "summary": {
                    "total_invested": total_invested,
                    "total_current_value": total_current,
                    "total_pnl": total_pnl,
                    "total_pnl_percent": total_pnl_percent
                }
            })
            
    except Exception as e:
        logger.error(f"Error in get_holdings: {e}")
        return jsonify({"error": str(e)}), 500


# NEW ENDPOINT: Update holding price for live P&L
@app.route('/update_holding_price', methods=['POST'])
def update_holding_price():
    """Update current price of a holding for live P&L calculation"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        symbol_token = data.get('symbol_token')
        current_price = data.get('current_price')
        
        if not all([user_id, symbol_token, current_price]):
            return jsonify({"error": "Missing required fields"}), 400
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Update current price
            cursor.execute('''
                UPDATE holdings 
                SET current_price = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND symbol_token = ?
            ''', (current_price, user_id, symbol_token))
            
            if cursor.rowcount == 0:
                return jsonify({"error": "Holding not found"}), 404
            
            # Get updated holding with P&L
            cursor.execute('''
                SELECT * FROM holdings 
                WHERE user_id = ? AND symbol_token = ?
            ''', (user_id, symbol_token))
            
            holding = dict(cursor.fetchone())
            current_value = holding['quantity'] * current_price
            pnl = current_value - holding['invested_amount']
            pnl_percent = (pnl / holding['invested_amount']) * 100 if holding['invested_amount'] > 0 else 0
            
            return jsonify({
                "success": True,
                "holding": {
                    **holding,
                    "current_value": current_value,
                    "pnl": pnl,
                    "pnl_percent": pnl_percent
                }
            })
            
    except Exception as e:
        logger.error(f"Error in update_holding_price: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/get_transactions', methods=['GET'])
def get_transactions():
    """Get user's transaction history"""
    try:
        user_id = request.args.get('user_id')
        transaction_type = request.args.get('type')
        
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            if transaction_type:
                cursor.execute('''
                    SELECT * FROM transactions 
                    WHERE user_id = ? AND transaction_type = ?
                    ORDER BY timestamp DESC
                    LIMIT 100
                ''', (user_id, transaction_type.upper()))
            else:
                cursor.execute('''
                    SELECT * FROM transactions 
                    WHERE user_id = ?
                    ORDER BY timestamp DESC
                    LIMIT 100
                ''', (user_id,))
            
            transactions = [dict(row) for row in cursor.fetchall()]
            
            return jsonify({
                "success": True,
                "transactions": transactions
            })
            
    except Exception as e:
        logger.error(f"Error in get_transactions: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/get_sell_history', methods=['GET'])
def get_sell_history():
    """Get user's sell history with P&L"""
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM sell_history 
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT 100
            ''', (user_id,))
            
            sell_history = [dict(row) for row in cursor.fetchall()]
            
            # Calculate totals
            total_profit = sum(s['profit_loss'] for s in sell_history if s['profit_loss'] > 0)
            total_loss = sum(s['profit_loss'] for s in sell_history if s['profit_loss'] < 0)
            net_pnl = sum(s['profit_loss'] for s in sell_history)
            
            return jsonify({
                "success": True,
                "sell_history": sell_history,
                "summary": {
                    "total_profit": total_profit,
                    "total_loss": abs(total_loss),
                    "net_pnl": net_pnl,
                    "total_trades": len(sell_history)
                }
            })
            
    except Exception as e:
        logger.error(f"Error in get_sell_history: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/portfolio_summary', methods=['GET'])
def portfolio_summary():
    """Get complete portfolio summary"""
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get balance
            cursor.execute('SELECT balance FROM balances WHERE user_id = ?', (user_id,))
            balance_row = cursor.fetchone()
            balance = balance_row['balance'] if balance_row else 0.0
            
            # Get holdings
            cursor.execute('''
                SELECT * FROM holdings 
                WHERE user_id = ?
            ''', (user_id,))
            holdings = [dict(row) for row in cursor.fetchall()]
            
            # Calculate portfolio value
            total_invested = sum(h['invested_amount'] for h in holdings)
            total_current = sum(h['quantity'] * h['current_price'] for h in holdings)
            total_pnl = total_current - total_invested
            
            # Get sell history summary
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_trades,
                    SUM(profit_loss) as net_pnl
                FROM sell_history 
                WHERE user_id = ?
            ''', (user_id,))
            sell_summary = dict(cursor.fetchone())
            
            total_portfolio_value = balance + total_current
            
            return jsonify({
                "success": True,
                "user_id": user_id,
                "balance": balance,
                "holdings_value": total_current,
                "total_portfolio_value": total_portfolio_value,
                "invested_amount": total_invested,
                "current_pnl": total_pnl,
                "realized_pnl": sell_summary['net_pnl'] or 0,
                "total_realized_trades": sell_summary['total_trades'] or 0,
                "holdings_count": len(holdings)
            })
            
    except Exception as e:
        logger.error(f"Error in portfolio_summary: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== EXISTING ENDPOINTS ====================

@app.route('/market_status', methods=['GET'])
def get_market_status():
    """Returns current market status"""
    is_open = is_market_open()
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    
    return jsonify({
        "is_open": is_open,
        "current_time": now.strftime("%Y-%m-%d %H:%M:%S"),
        "message": "Market is open" if is_open else "Market is closed"
    })


@app.route('/companies', methods=['GET'])
def get_companies():
    """Returns a list of popular companies with their symbol tokens"""
    companies = [
        {"name": "Reliance Industries", "symbol": "RELIANCE", "symboltoken": "2885"},
        {"name": "TCS", "symbol": "TCS", "symboltoken": "11536"},
        {"name": "Infosys", "symbol": "INFY", "symboltoken": "1594"},
        {"name": "HDFC Bank", "symbol": "HDFCBANK", "symboltoken": "1333"},
        {"name": "ICICI Bank", "symbol": "ICICIBANK", "symboltoken": "4963"},
        {"name": "Bharti Airtel", "symbol": "BHARTIARTL", "symboltoken": "10604"},
        {"name": "State Bank of India", "symbol": "SBIN", "symboltoken": "3045"},
        {"name": "ITC", "symbol": "ITC", "symboltoken": "1660"},
        {"name": "Hindustan Unilever", "symbol": "HINDUNILVR", "symboltoken": "1394"},
        {"name": "Axis Bank", "symbol": "AXISBANK", "symboltoken": "5900"},
        {"name": "Larsen & Toubro", "symbol": "LT", "symboltoken": "11483"},
        {"name": "Asian Paints", "symbol": "ASIANPAINT", "symboltoken": "3499"},
        {"name": "Maruti Suzuki", "symbol": "MARUTI", "symboltoken": "10999"},
        {"name": "Wipro", "symbol": "WIPRO", "symboltoken": "3787"},
        {"name": "Bajaj Finance", "symbol": "BAJFINANCE", "symboltoken": "317"},
    ]
    return jsonify(companies)


@app.route('/historical_data', methods=['GET'])
def get_historical_data():
    """Fetch historical candle data for a given symbol token"""
    try:
        symboltoken = request.args.get("symboltoken")
        interval = request.args.get("interval", None)
        date_range = request.args.get("date_range", "1D")

        if not symboltoken:
            return jsonify({"error": "symboltoken is required"}), 400

        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.now(ist)
        
        if date_range == "1D":
            fromdate = now.replace(hour=9, minute=15, second=0, microsecond=0)
            if now.hour < 9 or (now.hour == 9 and now.minute < 15):
                fromdate = fromdate - timedelta(days=1)
            fromdate = fromdate.strftime("%Y-%m-%d %H:%M")
            interval = interval or "ONE_MINUTE"
        elif date_range == "1W":
            fromdate = (now - timedelta(weeks=1)).strftime("%Y-%m-%d %H:%M")
            interval = interval or "FIFTEEN_MINUTE"
        elif date_range == "1M":
            fromdate = (now - timedelta(days=30)).strftime("%Y-%m-%d %H:%M")
            interval = interval or "ONE_HOUR"
        elif date_range == "3M":
            fromdate = (now - timedelta(days=90)).strftime("%Y-%m-%d %H:%M")
            interval = interval or "ONE_DAY"
        elif date_range == "1Y":
            fromdate = (now - timedelta(days=365)).strftime("%Y-%m-%d %H:%M")
            interval = interval or "ONE_DAY"
        elif date_range == "All":
            fromdate = (now - timedelta(days=1825)).strftime("%Y-%m-%d %H:%M")
            interval = interval or "ONE_WEEK"
        else:
            fromdate = (now - timedelta(weeks=1)).strftime("%Y-%m-%d %H:%M")
            interval = interval or "FIFTEEN_MINUTE"

        todate = now.strftime("%Y-%m-%d %H:%M")

        smartApi = login_smart_api()
        params = {
            "exchange": "NSE",
            "symboltoken": symboltoken,
            "interval": interval,
            "fromdate": fromdate,
            "todate": todate
        }

        logger.info(f"📊 Fetching historical data: {params}")
        candle_data = smartApi.getCandleData(params)

        if candle_data.get("data"):
            formatted_data = []
            for candle in candle_data["data"]:
                formatted_data.append({
                    "timestamp": candle[0],
                    "open": candle[1],
                    "high": candle[2],
                    "low": candle[3],
                    "close": candle[4],
                    "volume": candle[5] if len(candle) > 5 else 0
                })
            
            return jsonify({
                "success": True,
                "data": formatted_data,
                "interval": interval,
                "date_range": date_range,
                "market_open": is_market_open()
            })
        
        return jsonify({"error": "No historical data found"}), 404

    except Exception as e:
        logger.error(f"Error in get_historical_data: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/latest_price', methods=['GET'])
def get_latest_price():
    """Get the latest price for a symbol (useful when market is closed)"""
    try:
        symboltoken = request.args.get("symboltoken")
        if not symboltoken:
            return jsonify({"error": "symboltoken is required"}), 400

        smartApi = login_smart_api()
        
        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.now(ist)
        fromdate = (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M")
        todate = now.strftime("%Y-%m-%d %H:%M")
        
        params = {
            "exchange": "NSE",
            "symboltoken": symboltoken,
            "interval": "ONE_MINUTE",
            "fromdate": fromdate,
            "todate": todate
        }

        candle_data = smartApi.getCandleData(params)
        
        if candle_data.get("data") and len(candle_data["data"]) > 0:
            latest_candle = candle_data["data"][-1]
            prev_candle = candle_data["data"][-2] if len(candle_data["data"]) > 1 else latest_candle
            
            latest_price = latest_candle[4]
            prev_close = prev_candle[4]
            change = latest_price - prev_close
            change_percent = (change / prev_close * 100) if prev_close != 0 else 0
            
            return jsonify({
                "success": True,
                "price": latest_price,
                "open": latest_candle[1],
                "high": latest_candle[2],
                "low": latest_candle[3],
                "volume": latest_candle[5] if len(latest_candle) > 5 else 0,
                "prev_close": prev_close,
                "change": change,
                "change_percent": change_percent,
                "timestamp": latest_candle[0],
                "market_open": is_market_open()
            })
        
        return jsonify({"error": "No price data found"}), 404

    except Exception as e:
        logger.error(f"Error in get_latest_price: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== WEBSOCKET HANDLERS ====================

def start_sws(symboltoken, sid):
    """Start WebSocket connection for a specific symbol token"""
    print(f"🔌 Starting SmartWebSocket for token: {symboltoken}, session: {sid}")
    
    if not is_market_open():
        print(f"⏰ Market is closed. Not starting WebSocket for {symboltoken}")
        socketio.emit("status", {
            "message": "Market is closed. Live streaming not available.",
            "market_open": False
        }, room=sid)
        return
 
    smartApi_local = SmartConnect(api_key)
    totp = pyotp.TOTP(token_secret).now()
    data = smartApi_local.generateSession(username, pwd, totp)
    
    auth_token = data['data']['jwtToken']
    feed_token = data['data']['feedToken']
    client_code = data['data']['clientcode']

    sws = SmartWebSocketV2(auth_token, api_key, client_code, feed_token)

    def on_data(wsapp, message):
        if not is_market_open():
            print(f"⏰ Market closed during session. Stopping WebSocket for {symboltoken}")
            socketio.emit("status", {
                "message": "Market has closed. Stopping live stream.",
                "market_open": False
            }, room=sid)
            sws.close_connection()
            return
            
        print(f"📊 Live Tick Data for {symboltoken}:", message)
        socketio.emit("live_tick", message, room=sid)

    def on_open(wsapp):
        print(f"🔌 WebSocket Connected. Subscribing to token: {symboltoken}")
        sws.subscribe(correlation_id="abcde", mode=1, token_list=[
            {"exchangeType": 1, "tokens": [symboltoken]}
        ])
        socketio.emit("status", {
            "message": f"Live stream started for {symboltoken}",
            "market_open": True
        }, room=sid)

    def on_error(wsapp, error):
        print(f"❌ WebSocket Error for {symboltoken}:", error)
        socketio.emit("status", {
            "message": f"WebSocket error: {str(error)}",
            "market_open": is_market_open()
        }, room=sid)

    def on_close(wsapp):
        print(f"🔌 WebSocket Closed for {symboltoken}")
        if sid in active_sws:
            del active_sws[sid]
        socketio.emit("status", {
            "message": "Stream stopped",
            "market_open": is_market_open()
        }, room=sid)

    sws.on_open = on_open
    sws.on_data = on_data
    sws.on_error = on_error
    sws.on_close = on_close

    active_sws[sid] = sws
    sws.connect()


@socketio.on("start_stream")
def start_stream(data):
    """Handle start_stream event from frontend"""
    symboltoken = data.get("symboltoken")
    sid = request.sid
    
    print(f"🔌 Starting WebSocket Stream for token: {symboltoken}, session: {sid}")
    
    if not is_market_open():
        print(f"⏰ Market is closed. Rejecting stream request for {symboltoken}")
        socketio.emit("status", {
            "message": "Market is closed. Live streaming not available.",
            "market_open": False
        }, room=sid)
        return

    if sid in active_sws:
        try:
            active_sws[sid].close_connection()
            del active_sws[sid]
        except:
            pass

    threading.Thread(
        target=start_sws,
        args=(symboltoken, sid),
        daemon=True
    ).start()


@socketio.on("stop_stream")
def stop_stream():
    """Handle stop_stream event from frontend"""
    sid = request.sid
    print(f"🛑 Stopping WebSocket Stream for session: {sid}")
    
    if sid in active_sws:
        try:
            active_sws[sid].close_connection()
            del active_sws[sid]
            socketio.emit("status", {
                "message": "Stream stopped",
                "market_open": is_market_open()
            }, room=sid)
        except Exception as e:
            print(f"Error stopping stream: {e}")


@socketio.on("disconnect")
def handle_disconnect():
    """Clean up when client disconnects"""
    sid = request.sid
    print(f"🔌 Client disconnected: {sid}")
    
    if sid in active_sws:
        try:
            active_sws[sid].close_connection()
            del active_sws[sid]
        except:
            pass


def check_market_close():
    """Periodically check if market has closed and disconnect all WebSockets"""
    while True:
        import time
        time.sleep(60)
        
        if not is_market_open() and active_sws:
            print("⏰ Market has closed. Disconnecting all active WebSockets...")
            sids_to_close = list(active_sws.keys())
            for sid in sids_to_close:
                try:
                    active_sws[sid].close_connection()
                    del active_sws[sid]
                    socketio.emit("status", {
                        "message": "Market has closed. Stream stopped.",
                        "market_open": False
                    }, room=sid)
                except Exception as e:
                    print(f"Error closing WebSocket for {sid}: {e}")


if __name__ == '__main__':
    try:
        login_smart_api()
        
        market_monitor = threading.Thread(target=check_market_close, daemon=True)
        market_monitor.start()
        
        print("=" * 60)
        print("🚀 Flask Trading Backend Started")
        print("=" * 60)
        print("📊 Database initialized")
        print("💰 Users can now manage their own portfolios")
        print("=" * 60)
        
    except Exception as e:
        logger.error("Application failed to start due to login error.")
        exit(1)

    socketio.run(app, debug=True, host="0.0.0.0", port=6000)