# ngrok http 5000 --url=helpful-vastly-shark.ngrok-free.app 

import requests
from flask import Flask, request, abort, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# SETU API Credentials (use environment variables for production)
CLIENT_ID = os.getenv('SETU_CLIENT_ID', "351a73a0-153c-4dc0-9de2-fa01ce842a41")
CLIENT_SECRET = os.getenv('SETU_CLIENT_SECRET', "nA4LJrbWBnDoZS3jYtRUP2pkxkafQjP1")
PRODUCT_INSTANCE_ID = os.getenv('SETU_PRODUCT_INSTANCE_ID', "9345cc4b-3ca5-4051-af5c-e2b618dcfcfe")

app = Flask(__name__)
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'DBMS')
}

def get_db_connection():
    """Create and return a database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def init_db():
    """Initialize database tables"""
    connection = get_db_connection()
    if not connection:
        return
    
    cursor = connection.cursor()
    
    try:
        # Create consents table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS consents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                consent_id VARCHAR(255) UNIQUE NOT NULL,
                consent_handle TEXT,
                status VARCHAR(50) DEFAULT 'PENDING',
                vua VARCHAR(100),
                consent_start DATETIME,
                consent_expiry DATETIME,
                data_range_from DATETIME,
                data_range_to DATETIME,
                fi_types TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # Create bank_accounts table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bank_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                consent_id VARCHAR(255),
                fip_id VARCHAR(100),
                account_type VARCHAR(50),
                masked_account_number VARCHAR(50),
                link_ref_number VARCHAR(255) UNIQUE,
                fi_status VARCHAR(50) DEFAULT 'PENDING',
                account_holder_name VARCHAR(255),
                current_balance DECIMAL(15, 2),
                account_category VARCHAR(50),
                ifsc_code VARCHAR(20),
                micr_code VARCHAR(20),
                branch VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (consent_id) REFERENCES consents(consent_id) ON DELETE SET NULL
            )
        ''')
        
        # Create transactions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bank_account_id INT NOT NULL,
                transaction_id VARCHAR(255),
                transaction_type VARCHAR(50),
                mode VARCHAR(50),
                amount DECIMAL(15, 2),
                currency_code VARCHAR(10),
                current_balance DECIMAL(15, 2),
                transaction_timestamp DATETIME,
                value_date DATE,
                narration TEXT,
                reference VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
            )
        ''')
        
        # Create data_sessions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS data_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                consent_id VARCHAR(255) NOT NULL,
                session_id VARCHAR(255) UNIQUE NOT NULL,
                status VARCHAR(50) DEFAULT 'PENDING',
                data_range_from DATETIME,
                data_range_to DATETIME,
                format VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (consent_id) REFERENCES consents(consent_id) ON DELETE CASCADE
            )
        ''')
        
        connection.commit()
        print("✓ Database tables created successfully")
    except Error as e:
        print(f"Error creating tables: {e}")
    finally:
        cursor.close()
        connection.close()

@app.route('/webhook', methods=['POST'])
def webhook():
	"""Handle Setu AA webhooks for consent and session status updates"""
	if request.method == 'POST':
		data = request.json
		print("Webhook received:", data)
		
		notification_type = data.get('type')
		
		if notification_type == 'CONSENT_STATUS_UPDATE':
			handle_consent_notification(data)
		elif notification_type == 'SESSION_STATUS_UPDATE':
			handle_session_notification(data)
		
		return jsonify({'success': True}), 200
	else:
		return jsonify({'error': 'Method not allowed'}), 400

def handle_consent_notification(data):
	"""Handle consent status update notifications"""
	try:
		consent_id = data.get('consentId')
		status = data.get('data', {}).get('status')
		accounts = data.get('data', {}).get('detail', {}).get('accounts', [])
		
		connection = get_db_connection()
		if not connection:
			return
		
		cursor = connection.cursor()
		
		# Update consent status
		cursor.execute(
			'UPDATE consents SET status = %s WHERE consent_id = %s',
			(status, consent_id)
		)
		
		# If consent is ACTIVE, store account details
		if status == 'ACTIVE' and accounts:
			# Get user_id from consent
			cursor.execute('SELECT user_id FROM consents WHERE consent_id = %s', (consent_id,))
			result = cursor.fetchone()
			
			if result:
				user_id = result[0]
				
				for account in accounts:
					cursor.execute('''
						INSERT INTO bank_accounts 
						(user_id, consent_id, fip_id, account_type, masked_account_number, link_ref_number, fi_status)
						VALUES (%s, %s, %s, %s, %s, %s, %s)
						ON DUPLICATE KEY UPDATE
						fi_status = VALUES(fi_status),
						updated_at = CURRENT_TIMESTAMP
					''', (
						user_id,
						consent_id,
						account.get('fipId'),
						account.get('accType'),
						account.get('maskedAccNumber'),
						account.get('linkRefNumber'),
						'LINKED'
					))
		
		connection.commit()
		cursor.close()
		connection.close()
		
		print(f"✓ Consent {consent_id} status updated to {status}")
	except Exception as e:
		print(f"Error handling consent notification: {e}")

def handle_session_notification(data):
	"""Handle data session status update notifications"""
	try:
		session_id = data.get('dataSessionId')
		status = data.get('data', {}).get('status')
		consent_id = data.get('consentId')
		fips = data.get('data', {}).get('fips', [])
		
		connection = get_db_connection()
		if not connection:
			return
		
		cursor = connection.cursor()
		
		# Update session status
		cursor.execute(
			'UPDATE data_sessions SET status = %s WHERE session_id = %s',
			(status, session_id)
		)
		
		# Update individual account FI status
		for fip in fips:
			for account in fip.get('accounts', []):
				link_ref = account.get('linkRefNumber')
				fi_status = account.get('FIStatus')
				
				cursor.execute('''
					UPDATE bank_accounts 
					SET fi_status = %s 
					WHERE link_ref_number = %s
				''', (fi_status, link_ref))
		
		connection.commit()
		cursor.close()
		connection.close()
		
		print(f"✓ Session {session_id} status updated to {status}")
		
		# Auto-fetch data if status is COMPLETED or PARTIAL
		if status in ['COMPLETED', 'PARTIAL']:
			print(f"🔄 Auto-fetching data for session {session_id}...")
			try:
				access_token = get_token()
				fetch_and_store_data(access_token, session_id)
				print(f"✓ Auto-fetch completed for session {session_id}")
			except Exception as e:
				print(f"❌ Error auto-fetching data: {e}")
				import traceback
				traceback.print_exc()
				
	except Exception as e:
		print(f"Error handling session notification: {e}")

@app.route('/createConsent', methods=['POST'])
def createConsent():
	"""Create a new consent for a user"""
	if request.method == 'POST':
		try:
			user_email = request.json.get('email')
			consent_days = request.json.get('consentDays', 365)  # Default 365 days
			data_range_from = request.json.get('dataRangeFrom')  # ISO format from frontend
			data_range_to = request.json.get('dataRangeTo')  # ISO format from frontend
			
			if not user_email:
				return jsonify({'error': 'Email is required'}), 400
			
			print(f"📝 Creating consent for: {user_email}")
			print(f"   Consent days: {consent_days}")
			print(f"   Date range: {data_range_from} to {data_range_to}")
			
			# Convert ISO format to MySQL DATETIME format
			def iso_to_mysql_datetime(iso_string):
				"""Convert ISO 8601 format to MySQL DATETIME format"""
				if not iso_string:
					return None
				try:
					# Parse ISO format: 2023-01-01T00:00:00Z or 2023-01-01T00:00:00.000Z
					dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
					# Return MySQL format: YYYY-MM-DD HH:MM:SS
					return dt.strftime('%Y-%m-%d %H:%M:%S')
				except Exception as e:
					print(f"⚠️  Error converting datetime: {iso_string} - {e}")
					return None
			
			# Convert dates for MySQL storage
			mysql_date_from = iso_to_mysql_datetime(data_range_from) or '2023-01-01 00:00:00'
			mysql_date_to = iso_to_mysql_datetime(data_range_to) or '2025-12-31 23:59:59'
			
			print(f"   MySQL dates: {mysql_date_from} to {mysql_date_to}")
			
			# Get user details from database
			connection = get_db_connection()
			if not connection:
				print("❌ Database connection failed")
				return jsonify({'error': 'Database connection failed'}), 500
			
			cursor = connection.cursor(dictionary=True)
			cursor.execute('SELECT id, phone FROM users WHERE email = %s', (user_email,))
			user = cursor.fetchone()
			
			if not user:
				print(f"❌ User not found: {user_email}")
				cursor.close()
				connection.close()
				return jsonify({'error': 'User not found'}), 404
			
			user_id = user['id']
			phone_number = user['phone']
			
			print(f"✓ User found - ID: {user_id}, Phone: {phone_number}")
			
			# Get access token
			print("🔑 Getting SETU access token...")
			access_token = get_token()
			
			# Create consent with date parameters (SETU API expects ISO format)
			print("📤 Creating consent with SETU...")
			consent_id, consent_url = create_consent(
				access_token, 
				phone_number, 
				consent_days,
				data_range_from or '2023-01-01T00:00:00Z',  # Pass ISO format to SETU API
				data_range_to or '2025-12-31T23:59:59Z'
			)
			
			print(f"✓ Consent created - ID: {consent_id}")
			print(f"💾 Storing consent in database...")
			
			# Store consent in database (MySQL DATETIME format)
			cursor.execute('''
				INSERT INTO consents 
				(user_id, consent_id, consent_handle, status, vua, data_range_from, data_range_to, fi_types)
				VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
			''', (
				user_id,
				consent_id,
				consent_url,
				'PENDING',
				phone_number + '@onemoney',
				mysql_date_from,  # MySQL DATETIME format
				mysql_date_to,    # MySQL DATETIME format
				'DEPOSIT,PROFILE,SUMMARY,TRANSACTIONS'
			))
			
			connection.commit()
			cursor.close()
			connection.close()
			
			print(f"✓ Consent stored successfully")
			
			return jsonify({
				'success': True,
				'consentId': consent_id, 
				'consentUrl': consent_url
			}), 200
			
		except Exception as e:
			error_msg = str(e)
			print(f"❌ Error creating consent: {error_msg}")
			
			# Return more specific error message
			if "Database" in error_msg or "MySQL" in error_msg:
				return jsonify({'error': 'Database error: ' + error_msg}), 500
			elif "SETU" in error_msg or "API" in error_msg:
				return jsonify({'error': 'API error: ' + error_msg}), 500
			else:
				return jsonify({'error': error_msg}), 500
	else:
		return jsonify({'error': 'Method not allowed'}), 400

@app.route('/checkUserConsent', methods=['POST'])
def checkUserConsent():
	"""Check if user has an active consent"""
	if request.method == 'POST':
		try:
			user_email = request.json.get('email')
			
			if not user_email:
				return jsonify({'error': 'Email is required'}), 400
			
			connection = get_db_connection()
			if not connection:
				return jsonify({'error': 'Database connection failed'}), 500
			
			cursor = connection.cursor(dictionary=True)
			
			# Get user's active consent
			cursor.execute('''
				SELECT c.consent_id, c.status, c.consent_handle, c.created_at
				FROM consents c
				JOIN users u ON c.user_id = u.id
				WHERE u.email = %s AND c.status = 'ACTIVE'
				ORDER BY c.created_at DESC
				LIMIT 1
			''', (user_email,))
			
			consent = cursor.fetchone()
			cursor.close()
			connection.close()
			
			if consent:
				return jsonify({
					'hasConsent': True,
					'consentId': consent['consent_id'],
					'status': consent['status']
				}), 200
			else:
				return jsonify({
					'hasConsent': False
				}), 200
				
		except Exception as e:
			print(f"Error checking user consent: {e}")
			return jsonify({'error': str(e)}), 500
	else:
		return jsonify({'error': 'Method not allowed'}), 400

@app.route('/consentCheck', methods=['POST'])
def consentCheck():
	"""Check consent status by consent ID"""
	if request.method == 'POST':
		try:
			consent_id = request.json.get('consentId')
			
			if not consent_id:
				return jsonify({'error': 'Consent ID is required'}), 400
			
			access_token = get_token()
			response = get_consent_status(access_token, consent_id)
			
			# Update database with latest status
			if 'status' in response:
				connection = get_db_connection()
				if connection:
					cursor = connection.cursor()
					cursor.execute(
						'UPDATE consents SET status = %s WHERE consent_id = %s',
						(response['status'], consent_id)
					)
					connection.commit()
					cursor.close()
					connection.close()
			
			return jsonify({'status': response.get('status', 'UNKNOWN')}), 200
			
		except Exception as e:
			print(f"Error checking consent: {e}")
			return jsonify({'error': str(e)}), 500
	else:
		return jsonify({'error': 'Method not allowed'}), 400

@app.route('/sessionCheck', methods=['POST'])
def sessionCheck():
	"""Create or check data session status"""
	print("🚀 SessionCheck called - VERSION 2.1 WITH DEBUGGING")
	if request.method == 'POST':
		try:
			consent_id = request.json.get('consentId')
			
			if not consent_id:
				return jsonify({'error': 'Consent ID is required'}), 400
			
			# Get consent date range from database
			connection = get_db_connection()
			if not connection:
				return jsonify({'error': 'Database connection failed'}), 500
			
			cursor = connection.cursor(dictionary=True)
			cursor.execute('''
				SELECT data_range_from, data_range_to 
				FROM consents 
				WHERE consent_id = %s
			''', (consent_id,))
			
			consent_data = cursor.fetchone()
			
			if not consent_data:
				cursor.close()
				connection.close()
				return jsonify({'error': 'Consent not found'}), 404
			
			data_range_from = consent_data['data_range_from']
			data_range_to = consent_data['data_range_to']
			
			# Convert MySQL DATETIME to ISO format for Setu API
			def mysql_datetime_to_iso(dt_value):
				"""Convert MySQL DATETIME to ISO 8601 format for SETU API"""
				if isinstance(dt_value, datetime):
					# It's already a datetime object
					return dt_value.strftime('%Y-%m-%dT%H:%M:%SZ')
				elif isinstance(dt_value, str):
					# It's a string, could be MySQL format (YYYY-MM-DD HH:MM:SS) or ISO format
					if 'T' in dt_value:
						# Already ISO format, ensure proper Z ending
						return dt_value.rstrip('Z') + 'Z'
					else:
						# MySQL format, convert to ISO
						try:
							dt = datetime.strptime(dt_value, '%Y-%m-%d %H:%M:%S')
							return dt.strftime('%Y-%m-%dT%H:%M:%SZ')
						except:
							return dt_value
				else:
					return "2023-01-01T00:00:00Z"
			
			data_from_iso = mysql_datetime_to_iso(data_range_from)
			data_to_iso = mysql_datetime_to_iso(data_range_to)
			
			print(f"Creating session with date range: {data_from_iso} to {data_to_iso}")
			
			access_token = get_token()
			response = create_session(access_token, consent_id, data_from_iso, data_to_iso)
			
			print(f"Session creation response status: {response.status_code}")
			print(f"Session creation response: {response.text}")
			
			# Check if session creation was successful (accept both 200 and 201)
			if response.status_code not in [200, 201]:
				print(f"❌ Session creation failed with status {response.status_code}")
				error_data = response.json()
				print(f"❌ Error details: {error_data}")
				cursor.close()
				connection.close()
				return jsonify({
					'success': False,
					'error': error_data.get('errorMsg', 'Failed to create session')
				}), 500
			
			print(f"✓ Session creation successful with status {response.status_code}")
			
			response_data = response.json()
			session_id = response_data.get('id')
			status = response_data.get('status', 'PENDING')
			
			if not session_id:
				print(f"❌ No session ID in response: {response_data}")
				cursor.close()
				connection.close()
				return jsonify({
					'success': False,
					'error': 'Session creation failed'
				}), 500
			
			print(f"✓ Session created successfully: {session_id} with status: {status}")
			
			# Store session in database
			cursor.execute('''
				INSERT INTO data_sessions 
				(consent_id, session_id, status, data_range_from, data_range_to, format)
				VALUES (%s, %s, %s, %s, %s, %s)
				ON DUPLICATE KEY UPDATE
				status = VALUES(status),
				updated_at = CURRENT_TIMESTAMP
			''', (
				consent_id,
				session_id,
				status,
				data_range_from,
				data_range_to,
				'json'
			))
			connection.commit()
			cursor.close()
			connection.close()
			
			if status == 'ACTIVE' or status == 'COMPLETED':
				return jsonify({
					'success': True,
					'status': status, 
					'sessionId': session_id
				}), 200
			else:
				return jsonify({
					'success': True,
					'status': status,
					'sessionId': session_id
				}), 200
				
		except Exception as e:
			print(f"❌ ERROR in session check: {e}")
			import traceback
			traceback.print_exc()
			return jsonify({'error': str(e)}), 500
	else:
		return jsonify({'error': 'Method not allowed'}), 400

@app.route('/getTransactions', methods=['POST'])
def getTransactions():
	"""Get transactions for a session"""
	if request.method == 'POST':
		try:
			session_id = request.json.get('sessionId')
			
			if not session_id:
				return jsonify({'error': 'Session ID is required'}), 400
			
			access_token = get_token()
			
			# Fetch data from Setu
			fetch_and_store_data(access_token, session_id)
			
			# Return success
			return jsonify({
				'success': True,
				'message': 'Data fetched and stored successfully'
			}), 200
			
		except Exception as e:
			print(f"Error getting transactions: {e}")
			return jsonify({'error': str(e)}), 500
	else:
		return jsonify({'error': 'Method not allowed'}), 400

@app.route('/getUserAccounts', methods=['POST'])
def getUserAccounts():
	"""Get all bank accounts for a user"""
	if request.method == 'POST':
		try:
			user_email = request.json.get('email')
			
			if not user_email:
				return jsonify({'error': 'Email is required'}), 400
			
			connection = get_db_connection()
			if not connection:
				return jsonify({'error': 'Database connection failed'}), 500
			
			cursor = connection.cursor(dictionary=True)
			
			# Get user's bank accounts
			cursor.execute('''
				SELECT ba.* 
				FROM bank_accounts ba
				JOIN users u ON ba.user_id = u.id
				WHERE u.email = %s
				ORDER BY ba.created_at DESC
			''', (user_email,))
			
			accounts = cursor.fetchall()
			cursor.close()
			connection.close()
			
			print(f"📊 getUserAccounts: Found {len(accounts)} accounts for {user_email}")
			
			# Convert Decimal and datetime to JSON-serializable types
			for account in accounts:
				if account.get('current_balance'):
					account['current_balance'] = float(account['current_balance'])
				# Convert datetime objects to ISO string
				for key in ['created_at', 'updated_at']:
					if account.get(key) and hasattr(account[key], 'isoformat'):
						account[key] = account[key].isoformat()
			
			return jsonify({
				'success': True,
				'accounts': accounts
			}), 200
			
		except Exception as e:
			print(f"❌ ERROR getting user accounts: {e}")
			import traceback
			traceback.print_exc()
			return jsonify({'error': str(e)}), 500
	else:
		return jsonify({'error': 'Method not allowed'}), 400

@app.route('/getAccountTransactions', methods=['POST'])
def getAccountTransactions():
	"""Get transactions for a specific account"""
	if request.method == 'POST':
		try:
			account_id = request.json.get('accountId')
			
			if not account_id:
				return jsonify({'error': 'Account ID is required'}), 400
			
			connection = get_db_connection()
			if not connection:
				return jsonify({'error': 'Database connection failed'}), 500
			
			cursor = connection.cursor(dictionary=True)
			
			# Get ALL transactions (removed LIMIT 100)
			cursor.execute('''
				SELECT * FROM transactions
				WHERE bank_account_id = %s
				ORDER BY transaction_timestamp DESC
			''', (account_id,))
			
			transactions = cursor.fetchall()
			cursor.close()
			connection.close()
			
			print(f"📊 getAccountTransactions: Found {len(transactions)} transactions for account {account_id}")
			
			# Convert Decimal and datetime to JSON-serializable types
			for txn in transactions:
				if txn.get('amount'):
					txn['amount'] = float(txn['amount'])
				if txn.get('current_balance'):
					txn['current_balance'] = float(txn['current_balance'])
				# Convert datetime objects to ISO string
				for key in ['transaction_timestamp', 'value_date', 'created_at']:
					if txn.get(key) and hasattr(txn[key], 'isoformat'):
						txn[key] = txn[key].isoformat()
			
			return jsonify({
				'success': True,
				'transactions': transactions
			}), 200
			
		except Exception as e:
			print(f"Error getting account transactions: {e}")
			return jsonify({'error': str(e)}), 500
	else:
		return jsonify({'error': 'Method not allowed'}), 400
	
def get_token():
	"""Get access token from Setu"""
	try:
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

		response = requests.post(url, json=payload, headers=headers, timeout=10)
		response.raise_for_status()  # Raise exception for bad status codes
		
		data = response.json()
		
		if 'access_token' not in data:
			print(f"❌ SETU Auth Error: No access_token in response: {data}")
			raise Exception("Failed to get access token from SETU API")
		
		access_token = data['access_token']
		print(f"✓ SETU access token obtained")
		return access_token
		
	except requests.exceptions.Timeout:
		print("❌ SETU API timeout during authentication")
		raise Exception("SETU API timeout - please try again")
	except requests.exceptions.RequestException as e:
		print(f"❌ SETU API request error: {e}")
		raise Exception(f"SETU API connection error: {str(e)}")
	except Exception as e:
		print(f"❌ Error getting SETU token: {e}")
		raise

def create_consent(access_token, phone_number, consent_days=365, data_range_from=None, data_range_to=None):
	"""Create a consent request"""
	try:
		url = "https://fiu-sandbox.setu.co/v2/consents"

		# Calculate consent duration in months (minimum 1 month)
		consent_months = max(1, consent_days // 30)
		
		# Use provided dates or defaults
		if not data_range_from:
			data_range_from = "2023-01-01T00:00:00Z"
		if not data_range_to:
			data_range_to = "2025-12-31T00:00:00Z"

		payload = {
			"consentDuration": {
				"unit": "MONTH",
				"value": str(consent_months)
			},
			"vua": phone_number + "@onemoney",
			"dataRange": {
				"from": data_range_from,
				"to": data_range_to
			},
			"consentTypes": ["PROFILE", "SUMMARY", "TRANSACTIONS"],
			"context": []
		}
		headers = {
			"Authorization": "Bearer " + access_token,
			"x-product-instance-id": PRODUCT_INSTANCE_ID,
			"Content-Type": "application/json"
		}

		print(f"📤 Creating consent with SETU API...")
		print(f"   VUA: {phone_number}@onemoney")
		print(f"   Date range: {data_range_from} to {data_range_to}")
		
		response = requests.post(url, json=payload, headers=headers, timeout=15)
		
		# Log response for debugging
		print(f"   Response status: {response.status_code}")
		
		if response.status_code != 200:
			error_msg = response.text
			print(f"❌ SETU API error ({response.status_code}): {error_msg}")
			raise Exception(f"SETU API error: {error_msg}")
		
		data = response.json()
		
		if 'id' not in data or 'url' not in data:
			print(f"❌ Invalid SETU response: {data}")
			raise Exception("Invalid response from SETU API - missing id or url")
		
		req_id = data['id']
		consent_handle = data['url']
		
		print(f"✓ Consent created: {req_id}")
		return req_id, consent_handle
		
	except requests.exceptions.Timeout:
		print("❌ SETU API timeout during consent creation")
		raise Exception("SETU API timeout - please try again")
	except requests.exceptions.RequestException as e:
		print(f"❌ SETU API request error: {e}")
		raise Exception(f"SETU API connection error: {str(e)}")
	except Exception as e:
		print(f"❌ Error creating consent: {e}")
		raise

def get_consent_status(access_token, req_id):
	"""Get consent status"""
	url = "https://fiu-sandbox.setu.co/v2/consents/" + req_id

	querystring = {"expanded":"true"}

	headers = {
		"Authorization": "Bearer " + access_token,
		"x-product-instance-id": PRODUCT_INSTANCE_ID
	}
	response = requests.request("GET", url, headers=headers, params=querystring)
	return response.json()

def create_session(access_token, req_id, data_range_from=None, data_range_to=None):
	"""Create a data session"""
	url = "https://fiu-sandbox.setu.co/v2/sessions"

	# Use provided dates or defaults
	if not data_range_from:
		data_range_from = "2023-01-01T00:00:00Z"
	if not data_range_to:
		data_range_to = "2025-01-24T00:00:00Z"

	payload = {
		"dataRange": {
			"from": data_range_from,
			"to": data_range_to
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
	print("Session creation response:", response.text)
	return response

def get_session_data(access_token, session_id):
	"""Get data from a session"""
	url = "https://fiu-sandbox.setu.co/v2/sessions/" + session_id

	headers = {
		"Authorization": "Bearer " + access_token,
		"x-product-instance-id": PRODUCT_INSTANCE_ID
	}

	response = requests.request("GET", url, headers=headers)
	return response.json()

def fetch_and_store_data(access_token, session_id):
	"""Fetch financial data from session and store in database"""
	try:
		print(f"📥 Fetching session data for {session_id}...")
		# Get session data from Setu
		data = get_session_data(access_token, session_id)
		
		print(f"📊 Received data: {len(data.get('fips', []))} FIPs found")
		
		if not data or 'fips' not in data:
			print("❌ No FIP data received")
			return
		
		connection = get_db_connection()
		if not connection:
			return
		
		cursor = connection.cursor()
		
		# Get consent_id and user_id from session
		cursor.execute('''
			SELECT ds.consent_id, c.user_id 
			FROM data_sessions ds
			JOIN consents c ON ds.consent_id = c.consent_id
			WHERE ds.session_id = %s
		''', (session_id,))
		
		result = cursor.fetchone()
		if not result:
			cursor.close()
			connection.close()
			return
		
		consent_id, user_id = result
		
		# Process each FIP
		for fip in data.get('fips', []):
			fip_id = fip.get('fipID')
			
			for account_data in fip.get('accounts', []):
				link_ref = account_data.get('linkRefNumber')
				masked_acc = account_data.get('maskedAccNumber')
				fi_status = account_data.get('status')
				
				# Get account details
				account_info = account_data.get('data', {}).get('account', {})
				
				# Extract profile information
				profile = account_info.get('profile', {})
				holders = profile.get('holders', {})
				holder_info = holders.get('holder', {}) if isinstance(holders.get('holder'), dict) else {}
				holder_name = holder_info.get('name', '')
				
				# Extract summary information
				summary = account_info.get('summary', {})
				current_balance = 0
				if isinstance(summary, dict):
					current_balance = summary.get('currentBalance', 0)
					if isinstance(current_balance, str):
						try:
							current_balance = float(current_balance)
						except:
							current_balance = 0
				
				account_type = account_info.get('type', 'DEPOSIT')
				
				# Update or insert bank account
				cursor.execute('''
					INSERT INTO bank_accounts 
					(user_id, consent_id, fip_id, account_type, masked_account_number, 
					 link_ref_number, fi_status, account_holder_name, current_balance)
					VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
					ON DUPLICATE KEY UPDATE
					fi_status = VALUES(fi_status),
					account_holder_name = VALUES(account_holder_name),
					current_balance = VALUES(current_balance),
					updated_at = CURRENT_TIMESTAMP
				''', (
					user_id, consent_id, fip_id, account_type, masked_acc,
					link_ref, fi_status, holder_name, current_balance
				))
				
				# Get the bank account ID
				cursor.execute(
					'SELECT id FROM bank_accounts WHERE link_ref_number = %s',
					(link_ref,)
				)
				account_result = cursor.fetchone()
				if not account_result:
					continue
				
				bank_account_id = account_result[0]
				
				# Process transactions
				transactions = account_info.get('transactions', {})
				if isinstance(transactions, dict):
					transaction_list = transactions.get('transaction', [])
					if not isinstance(transaction_list, list):
						transaction_list = [transaction_list]
					
					print(f"💳 Processing {len(transaction_list)} transactions for account {masked_acc}")
					
					for txn in transaction_list:
						if not isinstance(txn, dict):
							continue
						
						txn_id = txn.get('txnId', '')
						txn_type = txn.get('type', '')
						mode = txn.get('mode', '')
						amount = txn.get('amount', 0)
						
						if isinstance(amount, str):
							try:
								amount = float(amount)
							except:
								amount = 0
						
						currency = txn.get('currentBalance', {}).get('code', 'INR') if isinstance(txn.get('currentBalance'), dict) else 'INR'
						balance = txn.get('currentBalance', 0)
						
						if isinstance(balance, str):
							try:
								balance = float(balance)
							except:
								balance = 0
						elif isinstance(balance, dict):
							balance = balance.get('amount', 0)
						
						txn_timestamp = txn.get('transactionTimestamp', txn.get('valueDate', ''))
						value_date = txn.get('valueDate', '')
						narration = txn.get('narration', '')
						reference = txn.get('reference', '')
						
						# Insert transaction
						cursor.execute('''
							INSERT INTO transactions 
							(bank_account_id, transaction_id, transaction_type, mode, amount,
							 currency_code, current_balance, transaction_timestamp, value_date,
							 narration, reference)
							VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
							ON DUPLICATE KEY UPDATE
							amount = VALUES(amount),
							current_balance = VALUES(current_balance)
						''', (
							bank_account_id, txn_id, txn_type, mode, amount,
							currency, balance, txn_timestamp, value_date,
							narration, reference
						))
		
		connection.commit()
		cursor.close()
		connection.close()
		
		print(f"✓ Data fetched and stored for session {session_id}")
		
	except Exception as e:
		print(f"Error fetching and storing data: {e}")
		import traceback
		traceback.print_exc()


if __name__ == '__main__':
	print("Initializing database...")
	init_db()
	print("Starting Flask server on port 5000...")
	print("Server accessible at:")
	print("  - Local: http://localhost:5000")
	print("  - Network: http://192.168.1.5:5000")
	print("Make sure ngrok is running: ngrok http 5000 --url=helpful-vastly-shark.ngrok-free.app")
	app.run(host='0.0.0.0', port=5000, debug=True)