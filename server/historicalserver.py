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
smartApi = None
totp=None
data=None

# Load .env file
load_dotenv()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ---- Angel Smart API Credentials ----
api_key = os.getenv("API_KEY")
username =  "AAAV325665"  # fallback if not in .env
pwd = os.getenv("PASSWORD")
token_secret = os.getenv("TOKEN_SECRET")
print("Using username:", username)
print("Using API Key:", api_key)
print("Using Token Secret:", token_secret)
# Global SmartAPI session to avoid repeated logins



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


# ---------- Candle Data API ----------
@app.route('/get_candles', methods=['GET'])
def get_candle_data():
    try:
        symboltoken = request.args.get("company")
        if not symboltoken:
            return jsonify({"error": "symboltoken is required"}), 400

        date_option = request.args.get("date_option", "5_weeks")
        interval = request.args.get("interval", "ONE_MINUTE")

        now = datetime.now()
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

        target_tokens = ["3045", "11536", "3046"]  # Example tokens
        previous_closes = {}

        for token in target_tokens:
            try:
                now = datetime.now()
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


# ---------- SmartWebSocket Live Stream ----------
def start_sws(symboltoken, auth_token, api_key, username):
    print("🔵 Starting SmartWebSocket...")
 
    smartApi = SmartConnect(api_key)
    totp = pyotp.TOTP("F4REUXURTZW7VFMTRHHKWNVTQY").now()
    data = smartApi.generateSession(username, pwd, totp)
    
    auth_token = data['data']['jwtToken']
    feed_token = data['data']['feedToken']
    client_code = data['data']['clientcode']

    sws = SmartWebSocketV2(auth_token, api_key, client_code, feed_token)

    def on_data(wsapp, message):
        print("📈 Live Tick Data:", message)
        socketio.emit("live_tick", message)
        print("send")

    def on_open(wsapp):
        print("🔌 WebSocket Connected. Subscribing to token...")
        sws.subscribe(correlation_id="abcde", mode=1, token_list=[
            {"exchangeType": 1, "tokens": [symboltoken]}
        ])

    sws.on_open = on_open
    sws.on_data = on_data
    sws.on_error = lambda ws, err: print("❌ Error:", err)
    sws.on_close = lambda ws: print("🔴 Connection Closed")

    sws.connect()  # runs indefinitely


@socketio.on("start_stream")
def start_stream(data):
    symboltoken = data.get("symboltoken")
    print("🔵 Starting WebSocket Stream...")
    print("Symbol Token:", symboltoken)

    auth_token = "F4REUXURTZW7VFMTRHHKWNVTQY"
    api_key_local = "5umHYhQD"
    username_local = "AAAV325665"

    threading.Thread(
        target=start_sws,
        args=(symboltoken, auth_token, api_key_local, username_local),
        daemon=True
    ).start()

    socketio.emit("status", {"message": "Stream started"})


if __name__ == '__main__':
    try:
        login_smart_api()
    except Exception as e:
        logger.error("Application failed to start due to login error.")
        exit(1)

    # Run Flask + SocketIO together
    socketio.run(app, debug=True, host="0.0.0.0", port=5000)
