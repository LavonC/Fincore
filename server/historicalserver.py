from flask import Flask, jsonify, request
from SmartApi import SmartConnect
import pyotp
from logzero import logger
from flask_cors import CORS
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app) 

# ---- Angel Smart API Credentials ----
api_key = "5umHYhQD"
username = "AAAV325665"
pwd = "1546"
token_secret = "F4REUXURTZW7VFMTRHHKWNVTQY" 

COMPANY_TOKENS = {
    "RELIANCE": "2885",
    "TCS": "11536",
    "INFY": "1594"
}

def get_date_range(option):
    """Convert frontend option to fromdate and todate strings."""
    now = datetime.now()
    if option == "5_weeks":
        start = now - timedelta(weeks=5)
    elif option == "1_year":
        start = now - timedelta(days=365)
    else:
       
        start = now
    return start.strftime("%Y-%m-%d %H:%M"), now.strftime("%Y-%m-%d %H:%M")

@app.route('/get_candles', methods=['GET'])
def get_candle_data():
    try:
       
        symboltoken = request.args.get("company") 
        if not symboltoken:
            return jsonify({"error": "symboltoken is required"}), 400
        date_option = request.args.get("date_option", "5_weeks")
        interval = request.args.get("interval", "ONE_MINUTE")

      
    

        
        fromdate, todate = get_date_range(date_option)

     
        totp = pyotp.TOTP(token_secret).now()

        smartApi = SmartConnect(api_key)
        data = smartApi.generateSession(username, pwd, totp)

        if not data['status']:
            return jsonify({"error": "Login failed", "details": data}), 400

        
        historic_params = {
            "exchange": "NSE",
            "symboltoken": symboltoken,
            "interval": interval,
            "fromdate": fromdate,
            "todate": todate
        }

        # Fetch candle data
        candle_data = smartApi.getCandleData(historic_params)
       
        if candle_data.get("data"):
            return jsonify(candle_data["data"])
        else:
            return jsonify({"error": "No candle data found"}), 404

    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)
