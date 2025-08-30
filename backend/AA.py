CLIENT_ID = "351a73a0-153c-4dc0-9de2-fa01ce842a41"
CLIENT_SECRET = "nA4LJrbWBnDoZS3jYtRUP2pkxkafQjP1"
PRODUCT_INSTANCE_ID = "9345cc4b-3ca5-4051-af5c-e2b618dcfcfe"
# ngrok http 5000 --url=helpful-vastly-shark.ngrok-free.app 
import requests
from flask import Flask, request, abort, jsonify



app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
	if request.method == 'POST':
		data = request.json
		print("Webhook received:", data)
		return 'success', 200
	else:
		return (400)

@app.route('/createConsent', methods=['POST'])
def createConsent():
	if request.method == 'POST':
		phone_number = request.json['PhoneNumber']
		access_token = get_token()
		consent_id, consent_url = create_consent(access_token, phone_number)
		return jsonify({"consentId": consent_id , "consentUrl" : consent_url }), 200
	else:
		return (400)

@app.route('/consentCheck', methods=['POST'])
def consentCheck():
	if request.method == 'POST':
		phone_number = request.json['consent_id']
		access_token = get_token()
		sessionId = get_consent_status(access_token, phone_number)
		return jsonify({"sessionId": sessionId }), 200
	else:
		return (400)

@app.route('/sessionCheck', methods=['POST'])
def sessionCheck():
	if request.method == 'POST':
		session_id = request.json['session_id']
		access_token = get_token()
		response = get_session_data(access_token, session_id)
		try:
			if response['status'] == 'ACTIVE':
				return jsonify({"status": "ACTIVE"}), 200
		except Exception as e:
			return jsonify({"status": "PENDING"}), 200
	else:
		return (400)

@app.route('/getTransactions', methods=['POST'])
def getTransactions():
	if request.method == 'POST':
		session_id = request.json['session_id']
		access_token = get_token()
		response = get_session_data(access_token, session_id)
		return jsonify({response['fip']['accounts'][0]['data']['account']['transactions']['transaction']}), 200
		
	else:
		return (400)
	
def get_token():
	url = "https://orgservice-prod.setu.co/v1/users/login"

	payload = {
		"clientID": CLIENT_ID,
		"grant_type": "client_credentials",
		"secret": CLIENT_SECRET
	}
	headers = {
		"client": "bridge",
		"Content-Type": "application/json"
	}

	response = requests.request("POST", url, json=payload, headers=headers).json()
	access_token = response['access_token']
	return access_token

def create_consent(access_token, phone_number):
	url = "https://fiu-sandbox.setu.co/v2/consents"

	payload = {
		"consentDuration": {
			"unit": "MONTH",
			"value": "24"
		},
		"vua": phone_number + "@onemoney",
		"dataRange": {
			"from": "2023-01-01T00:00:00Z",
			"to": "2025-01-24T00:00:00Z"
		},
		"consentTypes": ["PROFILE", "SUMMARY", "TRANSACTIONS"],
		"context": []
	}
	headers = {
		"Authorization": "Bearer " + access_token,
		"x-product-instance-id": PRODUCT_INSTANCE_ID,
		"Content-Type": "application/json"
	}

	response = requests.request("POST", url, json=payload, headers=headers).json()
	req_id = response['id']
	consent_handle = response['url']
	return req_id, consent_handle

def get_consent_status(access_token, req_id):
	url = "https://fiu-sandbox.setu.co/v2/consents/" + req_id

	querystring = {"expanded":"true"}

	headers = {
		"Authorization": "Bearer " + access_token,
		"x-product-instance-id": PRODUCT_INSTANCE_ID
	}
	response = requests.request("GET", url, headers=headers, params=querystring)
	return response.json()['status']

def create_session(access_token, req_id):
	url = "https://fiu-sandbox.setu.co/v2/sessions"

	payload = {
		"dataRange": {
			"from": "2023-01-01T00:00:00Z",
			"to": "2025-01-24T00:00:00Z"
		},
		"consentId": req_id,
		"format": "json"
	}
	headers = {
		"Authorization": "Bearer " + access_token,
		"x-product-instance-id": PRODUCT_INSTANCE_ID,
		"Content-Type": "application/json"
	}

	response = requests.request("POST", url, json=payload, headers=headers)
	session_id = response.json()['id']

def get_session_data(access_token, session_id):
	url = "https://fiu-sandbox.setu.co/v2/sessions/" + session_id

	headers = {
		"Authorization": "Bearer " + access_token,
		"x-product-instance-id": PRODUCT_INSTANCE_ID
	}

	response = requests.request("GET", url, headers=headers)
	return response.json()


if __name__ == '__main__':
	app.run(port=5000)