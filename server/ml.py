from SmartApi import SmartConnect
import pyotp
import os

api_key = "5umHYhQD"
username = "AAAV325665"
pwd = "1546"
token_secret = "F4REUXURTZW7VFMTRHHKWNVTQY"

totp = pyotp.TOTP(token_secret).now()
print("Generated OTP:", totp)

smartApi = SmartConnect(api_key)
data = smartApi.generateSession(username, pwd, totp)
print("Login Response:", data)
