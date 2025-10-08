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
import mysql.connector
from mysql.connector import Error
import bcrypt
import secrets

smartApi = None
totp = None
data = None
active_sws = {}  # Track active WebSocket connections

# Load .env file
load_dotenv()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ---- Angel Smart API Credentials ----
api_key = os.getenv("API_KEY")
username = "AAAV325665"
pwd = os.getenv("PASSWORD")
token_secret = os.getenv("TOKEN_SECRET")

print("Using username:", username)
print("Using API Key:", api_key)
print("Using Token Secret:", token_secret)

# ---- MySQL Database Configuration ----
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',  # Default XAMPP password is empty
    'database': 'stock_trading_app'
}


# ---- Database Helper Functions ----
def get_db_connection():
    """Create and return a database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        logger.error(f"Database connection error: {e}")
        return None


def init_database():
    """Initialize database and create tables if they don't exist"""
    try:
        # First connect without specifying database to create it
        connection = mysql.connector.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password']
        )
        cursor = connection.cursor()
        
        # Create database if not exists
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
        cursor.execute(f"USE {DB_CONFIG['database']}")
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                angel_username VARCHAR(100) NOT NULL,
                angel_api_key TEXT NOT NULL,
                angel_password_hash TEXT NOT NULL,
                angel_token_secret TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                INDEX idx_email (email),
                INDEX idx_username (angel_username)
            )
        """)
        
        # Create user sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                session_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL DEFAULT '2026-12-31 23:59:59',
                is_active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_token (session_token)
            )
        """)
        
        connection.commit()
        logger.info("✅ Database and tables initialized successfully")
        cursor.close()
        connection.close()
        return True
    except Error as e:
        logger.error(f"❌ Database initialization error: {e}")
        return False


# ---- Authentication APIs ----
@app.route('/api/auth/register', methods=['POST'])
def register_user():
    """Register a new user with their Angel One credentials"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['full_name', 'email', 'phone', 'angel_username', 
                          'angel_api_key', 'angel_password', 'angel_token_secret']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"{field} is required"}), 400
        
        # Hash the Angel One password
        password_hash = bcrypt.hashpw(data['angel_password'].encode('utf-8'), bcrypt.gensalt())
        
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = connection.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT user_id FROM users WHERE email = %s", (data['email'],))
        if cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({"error": "User with this email already exists"}), 409
        
        # Insert new user
        insert_query = """
            INSERT INTO users 
            (full_name, email, phone, angel_username, angel_api_key, 
             angel_password_hash, angel_token_secret)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(insert_query, (
            data['full_name'],
            data['email'],
            data['phone'],
            data['angel_username'],
            data['angel_api_key'],
            password_hash.decode('utf-8'),
            data['angel_token_secret']
        ))
        
        connection.commit()
        user_id = cursor.lastrowid
        
        # Create session token
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(days=30)
        
        cursor.execute("""
            INSERT INTO user_sessions (user_id, session_token, expires_at)
            VALUES (%s, %s, %s)
        """, (user_id, session_token, expires_at))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        logger.info(f"✅ User registered successfully: {data['email']}")
        
        return jsonify({
            "success": True,
            "message": "Registration successful",
            "user_id": user_id,
            "session_token": session_token,
            "full_name": data['full_name']
        }), 201
        
    except Error as e:
        logger.error(f"❌ Registration error: {e}")
        return jsonify({"error": "Registration failed", "details": str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login_user():
    """Login user with email and verify credentials"""
    try:
        data = request.json
        email = data.get('email')
        angel_password = data.get('angel_password')
        
        if not email or not angel_password:
            return jsonify({"error": "Email and password are required"}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Get user data
        cursor.execute("""
            SELECT user_id, full_name, email, angel_username, angel_api_key, 
                   angel_password_hash, angel_token_secret, is_active
            FROM users WHERE email = %s
        """, (email,))
        
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            connection.close()
            return jsonify({"error": "Invalid email or password"}), 401
        
        if not user['is_active']:
            cursor.close()
            connection.close()
            return jsonify({"error": "Account is deactivated"}), 403
        
        # Verify password
        if not bcrypt.checkpw(angel_password.encode('utf-8'), 
                             user['angel_password_hash'].encode('utf-8')):
            cursor.close()
            connection.close()
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Update last login
        cursor.execute("""
            UPDATE users SET last_login = CURRENT_TIMESTAMP 
            WHERE user_id = %s
        """, (user['user_id'],))
        
        # Create new session
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(days=30)
        
        cursor.execute("""
            INSERT INTO user_sessions (user_id, session_token, expires_at)
            VALUES (%s, %s, %s)
        """, (user['user_id'], session_token, expires_at))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        logger.info(f"✅ User logged in successfully: {email}")
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "user_id": user['user_id'],
            "full_name": user['full_name'],
            "email": user['email'],
            "session_token": session_token
        }), 200
        
    except Error as e:
        logger.error(f"❌ Login error: {e}")
        return jsonify({"error": "Login failed", "details": str(e)}), 500


@app.route('/api/auth/verify', methods=['POST'])
def verify_session():
    """Verify if session token is valid"""
    try:
        data = request.json
        session_token = data.get('session_token')
        
        if not session_token:
            return jsonify({"error": "Session token required"}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT s.user_id, s.expires_at, u.full_name, u.email, u.is_active
            FROM user_sessions s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.session_token = %s AND s.is_active = TRUE
        """, (session_token,))
        
        session = cursor.fetchone()
        cursor.close()
        connection.close()
        
        if not session:
            return jsonify({"valid": False, "error": "Invalid session"}), 401
        
        if not session['is_active']:
            return jsonify({"valid": False, "error": "Account deactivated"}), 403
        
        if datetime.now() > session['expires_at']:
            return jsonify({"valid": False, "error": "Session expired"}), 401
        
        return jsonify({
            "valid": True,
            "user_id": session['user_id'],
            "full_name": session['full_name'],
            "email": session['email']
        }), 200
        
    except Error as e:
        logger.error(f"❌ Session verification error: {e}")
        return jsonify({"error": "Verification failed"}), 500


@app.route('/api/auth/logout', methods=['POST'])
def logout_user():
    """Logout user by invalidating session"""
    try:
        data = request.json
        session_token = data.get('session_token')
        
        if not session_token:
            return jsonify({"error": "Session token required"}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = connection.cursor()
        cursor.execute("""
            UPDATE user_sessions SET is_active = FALSE 
            WHERE session_token = %s
        """, (session_token,))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({"success": True, "message": "Logged out successfully"}), 200
        
    except Error as e:
        logger.error(f"❌ Logout error: {e}")
        return jsonify({"error": "Logout failed"}), 500


# ---------- Market Hours Check ----------
def is_market_open():
    """Check if Indian stock market is currently open"""
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    
    # Check if it's a weekday (Monday=0, Sunday=6)
    if now.weekday() > 4:  # Saturday or Sunday
        return False
    
    # Market hours: 9:15 AM to 3:30 PM IST
    market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
    
    return market_open <= now <= market_close


# ---------- Helper function for login ----------
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


# ---------- Market Status API ----------
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


# ---------- Company List API ----------
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


# ---------- Historical Data API (Enhanced) ----------
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
        
        # Calculate date range and appropriate interval
        if date_range == "1D":
            # For intraday, get data from market open today (9:15 AM)
            fromdate = now.replace(hour=9, minute=15, second=0, microsecond=0)
            # If before market open, get previous trading day
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
            fromdate = (now - timedelta(days=1825)).strftime("%Y-%m-%d %H:%M")  # 5 years
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
            # Format: [timestamp, open, high, low, close, volume]
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


# ---------- Latest Price API ----------
@app.route('/latest_price', methods=['GET'])
def get_latest_price():
    """Get the latest price for a symbol (useful when market is closed)"""
    try:
        symboltoken = request.args.get("symboltoken")
        if not symboltoken:
            return jsonify({"error": "symboltoken is required"}), 400

        smartApi = login_smart_api()
        
        # Get last 2 days of data to ensure we have the latest
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
            
            latest_price = latest_candle[4]  # close price
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


# ---------- Candle Data API (Existing) ----------
@app.route('/get_candles', methods=['GET'])
def get_candle_data():
    try:
        symboltoken = request.args.get("company")
        if not symboltoken:
            return jsonify({"error": "symboltoken is required"}), 400

        date_option = request.args.get("date_option", "5_weeks")
        interval = request.args.get("interval", "ONE_MINUTE")

        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.now(ist)
        
        if date_option == "5_weeks":
            fromdate = (now - timedelta(weeks=5)).strftime("%Y-%m-%d %H:%M")
        elif date_option == "1_year":
            fromdate = (now - timedelta(days=365)).strftime("%Y-%m-%d %H:%M")
        else:
            fromdate = now.strftime("%Y-%m-%d %H:%M")
        todate = now.strftime("%Y-%m-%d %H:%M")

        smartApi = login_smart_api()
        params = {
            "exchange": "NSE",
            "symboltoken": symboltoken,
            "interval": interval,
            "fromdate": fromdate,
            "todate": todate
        }
        candle_data = smartApi.getCandleData(params)

        if candle_data.get("data"):
            return jsonify(candle_data["data"])
        return jsonify({"error": "No candle data found"}), 404

    except Exception as e:
        logger.error(f"Error in get_candle_data: {e}")
        return jsonify({"error": str(e)}), 500


# ---------- Funds API ----------
@app.route("/funds", methods=["GET"])
def get_funds():
    try:
        smartApi = login_smart_api()
        funds = smartApi.rmsLimit()
        return jsonify(funds)
    except Exception as e:
        logger.error(f"Error in get_funds: {e}")
        return jsonify({"error": str(e)}), 500


# ---------- Previous Day Closing Prices ----------
@app.route("/previous_close", methods=["GET"])
def get_previous_close():
    try:
        smartApi = login_smart_api()
        instruments_data = smartApi.get_master_contract("NSE")

        target_tokens = ["3045", "11536", "3046"]
        previous_closes = {}

        for token in target_tokens:
            try:
                ist = pytz.timezone('Asia/Kolkata')
                now = datetime.now(ist)
                fromdate = (now - timedelta(days=5)).strftime("%Y-%m-%d %H:%M")
                todate = now.strftime("%Y-%m-%d %H:%M")
                params = {
                    "exchange": "NSE",
                    "symboltoken": token,
                    "interval": "ONE_DAY",
                    "fromdate": fromdate,
                    "todate": todate
                }

                candles = smartApi.getCandleData(params)
                if candles.get("data") and len(candles["data"]) >= 2:
                    prev_close = candles["data"][-2][4]
                    symbol = "UNKNOWN"
                    for key, details in instruments_data['data'].items():
                        if details['symboltoken'] == token:
                            symbol = details['symbol']
                            break
                    previous_closes[symbol] = prev_close
            except Exception as e:
                logger.error(f"Error fetching data for token {token}: {e}")

        return jsonify(previous_closes)
    except Exception as e:
        logger.error(f"Error in get_previous_close: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/get_csv")
def get_csv():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    file_path = os.path.join(base_dir, "fincore", "assets", "EQUITY_L.csv")
    return send_file(file_path, mimetype="text/csv", as_attachment=True, download_name="EQUITY_L.csv")


# ---------- SmartWebSocket Live Stream (Enhanced) ----------
def start_sws(symboltoken, sid):
    """Start WebSocket connection for a specific symbol token"""
    print(f"🔵 Starting SmartWebSocket for token: {symboltoken}, session: {sid}")
    
    # Check if market is open before starting
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
        # Check if market is still open
        if not is_market_open():
            print(f"⏰ Market closed during session. Stopping WebSocket for {symboltoken}")
            socketio.emit("status", {
                "message": "Market has closed. Stopping live stream.",
                "market_open": False
            }, room=sid)
            sws.close_connection()
            return
            
        print(f"📈 Live Tick Data for {symboltoken}:", message)
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
        print(f"🔴 WebSocket Closed for {symboltoken}")
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

    # Store active connection
    active_sws[sid] = sws

    sws.connect()  # runs indefinitely


@socketio.on("start_stream")
def start_stream(data):
    """Handle start_stream event from frontend"""
    symboltoken = data.get("symboltoken")
    sid = request.sid
    
    print(f"🔵 Starting WebSocket Stream for token: {symboltoken}, session: {sid}")
    
    # Check market status
    if not is_market_open():
        print(f"⏰ Market is closed. Rejecting stream request for {symboltoken}")
        socketio.emit("status", {
            "message": "Market is closed. Live streaming not available.",
            "market_open": False
        }, room=sid)
        return

    # Stop existing connection for this session
    if sid in active_sws:
        try:
            active_sws[sid].close_connection()
            del active_sws[sid]
        except:
            pass

    # Start new connection
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
    print(f"👋 Client disconnected: {sid}")
    
    if sid in active_sws:
        try:
            active_sws[sid].close_connection()
            del active_sws[sid]
        except:
            pass


# ---------- Background Task: Auto-close WebSockets when market closes ----------
def check_market_close():
    """Periodically check if market has closed and disconnect all WebSockets"""
    while True:
        import time
        time.sleep(60)  # Check every minute
        
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
        # Initialize database
        if not init_database():
            logger.error("Failed to initialize database. Exiting...")
            exit(1)
        
        # Login to SmartAPI
        login_smart_api()
        
        # Start background task to monitor market hours
        market_monitor = threading.Thread(target=check_market_close, daemon=True)
        market_monitor.start()
        
        logger.info("🚀 Server started successfully with authentication support!")
        
    except Exception as e:
        logger.error("Application failed to start due to login error.")
        exit(1)

    # Run Flask + SocketIO together
    socketio.run(app, debug=True, host="0.0.0.0", port=4000)
