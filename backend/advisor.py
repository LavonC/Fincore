"""
FINANCIAL ADVISOR BACKEND WITH GEMINI AI
========================================
Provides AI-powered financial advice with context-aware responses
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'DBMS')
}

# Configure Gemini AI
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    # Use gemini-flash-latest (fast, always points to latest Flash model)
    model = genai.GenerativeModel('models/gemini-flash-latest')
else:
    print("⚠️ WARNING: GEMINI_API_KEY not found in .env file")
    model = None

# System prompt for financial advisor - Fine-tuned for finance
FINANCIAL_ADVISOR_SYSTEM_PROMPT = """You are an expert financial advisor AI assistant specializing in personal finance management. Your role is to provide professional, accurate, and personalized financial advice.

**Your Capabilities:**
- Personal finance planning and budgeting
- Investment strategy and portfolio analysis
- Savings and retirement planning
- Debt management and credit optimization
- Tax planning strategies (general advice only)
- Expense tracking and spending insights
- Financial goal setting and achievement

**Your Guidelines:**
1. PRIVACY FIRST: Never reveal specific user details like account numbers, names, or exact transaction amounts in your responses
2. Be professional, friendly, and empathetic
3. Provide actionable, practical advice tailored to the user's situation
4. Use percentages and ratios rather than exact amounts when discussing finances
5. Explain financial concepts in simple, understandable terms
6. Always encourage responsible financial behavior
7. Recommend consulting with certified financial planners for complex situations
8. Focus on long-term financial health, not quick gains
9. Be cautious with investment advice - explain risks
10. Maintain conversation context across messages

**Response Style:**
- Clear and concise
- Educational when needed
- Encouraging and positive
- Data-driven when financial context is provided
- Ask clarifying questions when needed

**Restrictions:**
- Do NOT provide specific stock picks or trading advice
- Do NOT guarantee returns or outcomes
- Do NOT provide legal or tax filing advice (recommend professionals)
- Do NOT encourage risky financial behavior
- Do NOT reveal any PII (Personally Identifiable Information)

When financial data is provided in context, analyze it professionally and provide insights based on spending patterns, income trends, and account balances."""

def get_db_connection():
    """Create and return a database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"❌ Database connection error: {e}")
        return None

def init_advisor_tables():
    """Initialize advisor-specific database tables"""
    connection = get_db_connection()
    if not connection:
        print("❌ Cannot initialize advisor tables - no database connection")
        return False
    
    cursor = connection.cursor()
    
    try:
        # Create advisor_chats table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS advisor_chats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                chat_id VARCHAR(255) UNIQUE NOT NULL,
                title VARCHAR(255) DEFAULT 'New Chat',
                last_message TEXT,
                last_message_time DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_chat (user_id, is_active),
                INDEX idx_updated (updated_at)
            )
        ''')
        
        # Create advisor_messages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS advisor_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                chat_id VARCHAR(255) NOT NULL,
                message_id VARCHAR(255) UNIQUE NOT NULL,
                role ENUM('user', 'advisor') NOT NULL,
                content TEXT NOT NULL,
                context_used BOOLEAN DEFAULT FALSE,
                financial_data_included BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES advisor_chats(chat_id) ON DELETE CASCADE,
                INDEX idx_chat_time (chat_id, created_at)
            )
        ''')
        
        # Create user_financial_context_cache table (for performance)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_financial_context_cache (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNIQUE NOT NULL,
                context_summary JSON,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        connection.commit()
        print("✅ Advisor tables created successfully")
        return True
        
    except Error as e:
        print(f"❌ Error creating advisor tables: {e}")
        return False
    finally:
        cursor.close()
        connection.close()

def get_user_id_from_email(email):
    """Get user ID from email"""
    connection = get_db_connection()
    if not connection:
        return None
    
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        return user['id'] if user else None
    except Error as e:
        print(f"❌ Error fetching user ID: {e}")
        return None
    finally:
        cursor.close()
        connection.close()

def extract_financial_context(user_id, keywords_in_query):
    """
    Extract anonymized financial context based on user query
    Only includes data if query seems to need it
    """
    # Keywords that suggest user wants financial data analysis
    financial_keywords = [
        # Direct financial terms
        'spending', 'spent', 'expense', 'expenses', 'transaction', 'transactions',
        'balance', 'account', 'money', 'budget', 'save', 'saving', 'savings',
        'income', 'earn', 'earning', 'salary', 'credit', 'debit',
        
        # Time-based queries
        'last month', 'this month', 'last week', 'this week', 'recent',
        
        # Personal finance references
        'my finances', 'my accounts', 'my data', 'my bank', 'my spending',
        'my transactions', 'my money', 'my balance', 'my savings', 'my income',
        
        # Analysis requests
        'analyze', 'analysis', 'insight', 'pattern', 'trend', 'review',
        'how much', 'where did', 'what did', 'show me', 'tell me about',
        
        # Financial health and status
        'financial health', 'financial condition', 'financial status',
        'financial situation', 'doing financially', 'am i doing',
        'how am i', 'how is my', 'is my', 'are my',
        
        # Evaluation terms
        'good', 'bad', 'healthy', 'unhealthy', 'okay', 'fine',
        'concern', 'worried', 'safe', 'secure', 'stable',
        
        # Advice seeking
        'should i', 'can i afford', 'recommend', 'suggestion', 'advice',
        'what to do', 'help me'
    ]
    
    # Check if query needs financial data
    query_lower = keywords_in_query.lower()
    needs_financial_data = any(keyword in query_lower for keyword in financial_keywords)
    
    if not needs_financial_data:
        print(f"⏭️ No financial keywords detected in: '{keywords_in_query[:50]}...'")
        return None, False
    
    print(f"📊 Financial context will be included for query: '{keywords_in_query[:50]}...'")
    
    connection = get_db_connection()
    if not connection:
        return None, False
    
    cursor = connection.cursor(dictionary=True)
    context = {}
    
    try:
        # Get total balance across all accounts (anonymized)
        cursor.execute('''
            SELECT 
                COUNT(DISTINCT id) as total_accounts,
                SUM(current_balance) as total_balance,
                AVG(current_balance) as avg_balance
            FROM bank_accounts 
            WHERE user_id = %s AND current_balance IS NOT NULL
        ''', (user_id,))
        balance_data = cursor.fetchone()
        
        if balance_data and balance_data['total_accounts'] > 0:
            context['accounts'] = {
                'total_accounts': balance_data['total_accounts'],
                'total_balance': float(balance_data['total_balance'] or 0),
                'average_balance_per_account': float(balance_data['avg_balance'] or 0)
            }
        
        # Get recent transaction summary (last 30 days, anonymized)
        cursor.execute('''
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN transaction_type = 'DEBIT' THEN amount ELSE 0 END) as total_expenses,
                COUNT(CASE WHEN transaction_type = 'CREDIT' THEN 1 END) as income_count,
                COUNT(CASE WHEN transaction_type = 'DEBIT' THEN 1 END) as expense_count
            FROM transactions t
            JOIN bank_accounts ba ON t.bank_account_id = ba.id
            WHERE ba.user_id = %s 
            AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ''', (user_id,))
        txn_summary = cursor.fetchone()
        
        if txn_summary and txn_summary['total_transactions'] > 0:
            context['monthly_summary'] = {
                'period': 'last_30_days',
                'total_transactions': txn_summary['total_transactions'],
                'total_income': float(txn_summary['total_income'] or 0),
                'total_expenses': float(txn_summary['total_expenses'] or 0),
                'net_savings': float((txn_summary['total_income'] or 0) - (txn_summary['total_expenses'] or 0)),
                'income_count': txn_summary['income_count'],
                'expense_count': txn_summary['expense_count']
            }
            
            # Calculate savings rate
            if txn_summary['total_income'] and txn_summary['total_income'] > 0:
                context['monthly_summary']['savings_rate'] = round(
                    (context['monthly_summary']['net_savings'] / float(txn_summary['total_income'])) * 100, 2
                )
        
        # Get spending by category (based on transaction mode)
        cursor.execute('''
            SELECT 
                t.mode,
                COUNT(*) as transaction_count,
                SUM(t.amount) as total_amount,
                AVG(t.amount) as avg_amount
            FROM transactions t
            JOIN bank_accounts ba ON t.bank_account_id = ba.id
            WHERE ba.user_id = %s 
            AND t.transaction_type = 'DEBIT'
            AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY t.mode
            ORDER BY total_amount DESC
            LIMIT 10
        ''', (user_id,))
        spending_categories = cursor.fetchall()
        
        if spending_categories:
            context['spending_breakdown'] = [
                {
                    'category': cat['mode'] or 'OTHER',
                    'count': cat['transaction_count'],
                    'total': float(cat['total_amount']),
                    'average': float(cat['avg_amount'])
                }
                for cat in spending_categories
            ]
        
        # Get recent large transactions (anonymized - no narration)
        cursor.execute('''
            SELECT 
                t.transaction_type,
                t.mode,
                t.amount,
                DATE(t.created_at) as transaction_date
            FROM transactions t
            JOIN bank_accounts ba ON t.bank_account_id = ba.id
            WHERE ba.user_id = %s 
            AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            AND t.amount > 1000
            ORDER BY t.amount DESC
            LIMIT 5
        ''', (user_id,))
        large_txns = cursor.fetchall()
        
        if large_txns:
            context['recent_large_transactions'] = [
                {
                    'type': txn['transaction_type'],
                    'category': txn['mode'] or 'OTHER',
                    'amount': float(txn['amount']),
                    'date': txn['transaction_date'].strftime('%Y-%m-%d') if txn['transaction_date'] else None
                }
                for txn in large_txns
            ]
        
        return context if context else None, True
        
    except Error as e:
        print(f"❌ Error extracting financial context: {e}")
        return None, False
    finally:
        cursor.close()
        connection.close()

def generate_context_prompt(financial_context):
    """Generate a prompt section with financial context"""
    if not financial_context:
        return ""
    
    prompt = "\n\n**USER'S FINANCIAL CONTEXT (Anonymized):**\n"
    
    if 'accounts' in financial_context:
        acc = financial_context['accounts']
        prompt += f"- Has {acc['total_accounts']} bank account(s)\n"
        prompt += f"- Total balance: ₹{acc['total_balance']:,.2f}\n"
    
    if 'monthly_summary' in financial_context:
        ms = financial_context['monthly_summary']
        prompt += f"\n**Last 30 Days Summary:**\n"
        prompt += f"- Total income: ₹{ms['total_income']:,.2f} ({ms['income_count']} transactions)\n"
        prompt += f"- Total expenses: ₹{ms['total_expenses']:,.2f} ({ms['expense_count']} transactions)\n"
        prompt += f"- Net savings: ₹{ms['net_savings']:,.2f}\n"
        if 'savings_rate' in ms:
            prompt += f"- Savings rate: {ms['savings_rate']}%\n"
    
    if 'spending_breakdown' in financial_context:
        prompt += f"\n**Top Spending Categories:**\n"
        for cat in financial_context['spending_breakdown'][:5]:
            prompt += f"- {cat['category']}: ₹{cat['total']:,.2f} ({cat['count']} transactions)\n"
    
    if 'recent_large_transactions' in financial_context:
        prompt += f"\n**Recent Large Transactions (Last 7 days):**\n"
        for txn in financial_context['recent_large_transactions'][:3]:
            prompt += f"- {txn['type']}: ₹{txn['amount']:,.2f} ({txn['category']})\n"
    
    prompt += "\nUse this data to provide personalized insights. DO NOT reveal account numbers or personal identifiers.\n"
    
    return prompt

def get_chat_history(chat_id, limit=10):
    """Get recent chat history for context"""
    connection = get_db_connection()
    if not connection:
        return []
    
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute('''
            SELECT role, content 
            FROM advisor_messages 
            WHERE chat_id = %s 
            ORDER BY created_at DESC 
            LIMIT %s
        ''', (chat_id, limit))
        messages = cursor.fetchall()
        # Reverse to get chronological order
        return list(reversed(messages))
    except Error as e:
        print(f"❌ Error fetching chat history: {e}")
        return []
    finally:
        cursor.close()
        connection.close()

def generate_ai_response(user_message, chat_history, financial_context=None):
    """Generate AI response using Gemini with context"""
    if not model:
        return "I apologize, but the AI service is currently unavailable. Please ensure the GEMINI_API_KEY is configured."
    
    try:
        # Build conversation context
        conversation = [FINANCIAL_ADVISOR_SYSTEM_PROMPT]
        
        # Add financial context if available
        if financial_context:
            context_prompt = generate_context_prompt(financial_context)
            conversation.append(context_prompt)
        
        # Add chat history
        for msg in chat_history:
            role_prefix = "User" if msg['role'] == 'user' else "Financial Advisor"
            conversation.append(f"{role_prefix}: {msg['content']}")
        
        # Add current message
        conversation.append(f"User: {user_message}")
        conversation.append("Financial Advisor:")
        
        # Generate response
        full_prompt = "\n\n".join(conversation)
        
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                top_p=0.8,
                top_k=40,
                max_output_tokens=2048,  # Increased from 1024 to 2048 for longer responses
            )
        )
        
        return response.text
        
    except Exception as e:
        print(f"❌ AI generation error: {e}")
        return "I apologize, but I encountered an error processing your request. Please try again or rephrase your question."

def generate_chat_title(first_message):
    """Generate a short, descriptive title from the first message"""
    if not model:
        return first_message[:50] + "..." if len(first_message) > 50 else first_message
    
    try:
        # Create a prompt to generate a concise title
        prompt = f"""Generate a very short, descriptive title (3-6 words maximum) for a conversation that starts with this question:

"{first_message}"

Respond with ONLY the title, no quotes or extra text. Make it relevant to the financial topic discussed."""
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.5,
                max_output_tokens=20,
            )
        )
        
        title = response.text.strip().replace('"', '').replace("'", "")
        
        # Fallback if title is too long or empty
        if len(title) > 60 or len(title) < 3:
            return first_message[:50] + "..." if len(first_message) > 50 else first_message
        
        return title
        
    except Exception as e:
        print(f"❌ Title generation error: {e}")
        # Fallback: Use first 50 chars of message
        return first_message[:50] + "..." if len(first_message) > 50 else first_message

def format_ai_response(text):
    """Format AI response text for better readability in mobile app"""
    if not text:
        return text
    
    # Convert markdown-style formatting to mobile-friendly text
    formatted = text
    
    # Replace bold markers (**text** or __text__) with emphasis
    import re
    formatted = re.sub(r'\*\*([^*]+)\*\*', r'• \1', formatted)  # **text** → • text
    formatted = re.sub(r'__([^_]+)__', r'• \1', formatted)      # __text__ → • text
    
    # Replace bullet points (*, -, +) with proper bullets
    formatted = re.sub(r'^\s*[\*\-\+]\s+', '• ', formatted, flags=re.MULTILINE)
    
    # Replace numbered lists (1. 2. 3.) with emoji numbers or bullets
    formatted = re.sub(r'^\s*(\d+)\.\s+', r'[\1] ', formatted, flags=re.MULTILINE)
    
    # Add proper spacing between sections (double newline → single newline for mobile)
    formatted = re.sub(r'\n{3,}', '\n\n', formatted)
    
    # Clean up extra whitespace
    formatted = formatted.strip()
    
    return formatted

# ==========================================
# API ENDPOINTS
# ==========================================

@app.route('/advisor/chats/list', methods=['POST'])
def list_chats():
    """Get all chats for a user"""
    try:
        data = request.json
        email = data.get('email')
        
        if not email:
            return jsonify({'success': False, 'error': 'Email is required'}), 400
        
        user_id = get_user_id_from_email(email)
        if not user_id:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute('''
            SELECT 
                chat_id as id,
                title,
                last_message as preview,
                created_at,
                updated_at
            FROM advisor_chats 
            WHERE user_id = %s AND is_active = TRUE
            ORDER BY updated_at DESC
        ''', (user_id,))
        
        chats = cursor.fetchall()
        
        # Format dates
        for chat in chats:
            if chat['created_at']:
                chat['created_at'] = chat['created_at'].isoformat()
            if chat['updated_at']:
                chat['updated_at'] = chat['updated_at'].isoformat()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'chats': chats,
            'count': len(chats)
        })
        
    except Exception as e:
        print(f"❌ Error listing chats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/advisor/chats/create', methods=['POST'])
def create_chat():
    """Create a new chat"""
    try:
        data = request.json
        email = data.get('email')
        title = data.get('title', 'New Chat')
        
        if not email:
            return jsonify({'success': False, 'error': 'Email is required'}), 400
        
        user_id = get_user_id_from_email(email)
        if not user_id:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Generate unique chat ID
        chat_id = f"chat_{user_id}_{int(datetime.now().timestamp() * 1000)}"
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        cursor.execute('''
            INSERT INTO advisor_chats (user_id, chat_id, title, last_message, last_message_time)
            VALUES (%s, %s, %s, %s, NOW())
        ''', (user_id, chat_id, title, 'Start a new conversation...'))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'chat': {
                'id': chat_id,
                'title': title,
                'preview': 'Start a new conversation...',
                'created_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        print(f"❌ Error creating chat: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/advisor/chats/delete', methods=['POST'])
def delete_chat():
    """Delete a chat (soft delete)"""
    try:
        data = request.json
        email = data.get('email')
        chat_id = data.get('chatId')
        
        if not email or not chat_id:
            return jsonify({'success': False, 'error': 'Email and chatId are required'}), 400
        
        user_id = get_user_id_from_email(email)
        if not user_id:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        cursor.execute('''
            UPDATE advisor_chats 
            SET is_active = FALSE 
            WHERE chat_id = %s AND user_id = %s
        ''', (chat_id, user_id))
        
        connection.commit()
        affected_rows = cursor.rowcount
        cursor.close()
        connection.close()
        
        if affected_rows == 0:
            return jsonify({'success': False, 'error': 'Chat not found or unauthorized'}), 404
        
        return jsonify({'success': True, 'message': 'Chat deleted successfully'})
        
    except Exception as e:
        print(f"❌ Error deleting chat: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/advisor/messages/list', methods=['POST'])
def list_messages():
    """Get all messages for a chat"""
    try:
        data = request.json
        chat_id = data.get('chatId')
        
        if not chat_id:
            return jsonify({'success': False, 'error': 'chatId is required'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute('''
            SELECT 
                message_id as id,
                role as type,
                content as text,
                created_at
            FROM advisor_messages 
            WHERE chat_id = %s 
            ORDER BY created_at ASC
        ''', (chat_id,))
        
        messages = cursor.fetchall()
        
        # Format dates and adjust role names
        for msg in messages:
            if msg['created_at']:
                msg['created_at'] = msg['created_at'].isoformat()
            # Frontend expects 'advisor' not 'assistant'
            if msg['type'] == 'assistant':
                msg['type'] = 'advisor'
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'messages': messages,
            'count': len(messages)
        })
        
    except Exception as e:
        print(f"❌ Error listing messages: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/advisor/messages/send', methods=['POST'])
def send_message():
    """Send a message and get AI response"""
    try:
        data = request.json
        email = data.get('email')
        chat_id = data.get('chatId')
        message = data.get('message')
        
        if not email or not chat_id or not message:
            return jsonify({'success': False, 'error': 'email, chatId, and message are required'}), 400
        
        user_id = get_user_id_from_email(email)
        if not user_id:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Verify chat belongs to user
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute('''
            SELECT id FROM advisor_chats 
            WHERE chat_id = %s AND user_id = %s AND is_active = TRUE
        ''', (chat_id, user_id))
        
        chat = cursor.fetchone()
        if not chat:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'error': 'Chat not found or unauthorized'}), 404
        
        # Save user message
        user_message_id = f"msg_{int(datetime.now().timestamp() * 1000)}_user"
        cursor.execute('''
            INSERT INTO advisor_messages (chat_id, message_id, role, content)
            VALUES (%s, %s, 'user', %s)
        ''', (chat_id, user_message_id, message))
        connection.commit()
        
        # Get chat history
        chat_history = get_chat_history(chat_id, limit=10)
        
        # Extract financial context if needed
        financial_context, context_used = extract_financial_context(user_id, message)
        
        # Generate AI response
        ai_response = generate_ai_response(message, chat_history, financial_context)
        
        # Format the response for better readability
        ai_response_formatted = format_ai_response(ai_response)
        
        # Save AI response
        ai_message_id = f"msg_{int(datetime.now().timestamp() * 1000)}_advisor"
        cursor.execute('''
            INSERT INTO advisor_messages (chat_id, message_id, role, content, context_used, financial_data_included)
            VALUES (%s, %s, 'advisor', %s, %s, %s)
        ''', (chat_id, ai_message_id, ai_response_formatted, context_used, bool(financial_context)))
        
        # Check if this is the first message in the chat (to auto-generate title)
        cursor.execute('SELECT COUNT(*) as count FROM advisor_messages WHERE chat_id = %s', (chat_id,))
        message_count = cursor.fetchone()['count']
        
        # If this is the first user message (count = 2 because we just added user + AI), generate title
        if message_count == 2:
            print(f"🎯 Generating title for first message: {message[:50]}...")
            chat_title = generate_chat_title(message)
            print(f"✅ Generated title: {chat_title}")
            cursor.execute('''
                UPDATE advisor_chats 
                SET title = %s, last_message = %s, last_message_time = NOW(), updated_at = NOW()
                WHERE chat_id = %s
            ''', (chat_title, message[:200], chat_id))
        else:
            # Just update last message for existing chats
            cursor.execute('''
                UPDATE advisor_chats 
                SET last_message = %s, last_message_time = NOW(), updated_at = NOW()
                WHERE chat_id = %s
            ''', (message[:200], chat_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'userMessage': {
                'id': user_message_id,
                'type': 'user',
                'text': message,
                'created_at': datetime.now().isoformat()
            },
            'aiMessage': {
                'id': ai_message_id,
                'type': 'advisor',
                'text': ai_response_formatted,
                'created_at': datetime.now().isoformat()
            },
            'contextUsed': context_used
        })
        
    except Exception as e:
        print(f"❌ Error sending message: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/advisor/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'service': 'Financial Advisor Backend',
        'status': 'running',
        'gemini_configured': bool(GEMINI_API_KEY),
        'timestamp': datetime.now().isoformat()
    })

# ==========================================
# MAIN
# ==========================================

if __name__ == '__main__':
    print("=" * 50)
    print("FINANCIAL ADVISOR BACKEND")
    print("=" * 50)
    
    # Check Gemini API Key
    if not GEMINI_API_KEY:
        print("⚠️  WARNING: GEMINI_API_KEY not found!")
        print("   Please add GEMINI_API_KEY to your .env file")
        print("   Get your key from: https://makersuite.google.com/app/apikey")
    else:
        print(f"✅ Gemini API Key configured")
    
    # Initialize database tables
    print("\n📊 Initializing database tables...")
    if init_advisor_tables():
        print("✅ Database tables ready")
    else:
        print("⚠️  Database initialization failed")
    
    print("\n🚀 Starting Flask server on port 7000...")
    print("   Local: http://localhost:7000")
    print("   Network: http://192.168.1.3:7000")
    print("\n💡 Endpoints:")
    print("   POST /advisor/chats/list")
    print("   POST /advisor/chats/create")
    print("   POST /advisor/chats/delete")
    print("   POST /advisor/messages/list")
    print("   POST /advisor/messages/send")
    print("   GET  /advisor/health")
    print("\n" + "=" * 50)
    
    app.run(host='0.0.0.0', port=7000, debug=True)
