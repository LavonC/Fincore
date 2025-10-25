"""
Financial Insights Backend with AI Analysis
Generates personalized financial insights using Gemini AI
- Analyzes bank accounts and transaction patterns
- Stores insights in database with data snapshots
- Only regenerates when new data is available
- References past insights for contextual analysis
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from datetime import datetime, timedelta
import json
import os
from dotenv import load_dotenv
import google.generativeai as genai
import hashlib
from decimal import Decimal

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'dbms')
}

# Configure Gemini AI
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    # Use the newer model naming that's actually available
    # According to the API, these are the current models (as of 2025)
    model = genai.GenerativeModel('models/gemini-2.5-flash')
    print("✅ Gemini API Key configured with gemini-2.5-flash model")
else:
    model = None
    print("⚠️  WARNING: GEMINI_API_KEY not found in environment!")

# Helper: Get database connection
def get_db_connection():
    """Create and return a database connection"""
    return mysql.connector.connect(**DB_CONFIG)

# Helper: Decimal to float for JSON serialization
def decimal_to_float(obj):
    """Convert Decimal objects to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)

# Helper: Check if tables exist
def check_tables():
    """Verify insights tables exist in database"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SHOW TABLES LIKE 'insights'")
        insights_exists = cursor.fetchone() is not None
        
        cursor.execute("SHOW TABLES LIKE 'insights_metadata'")
        metadata_exists = cursor.fetchone() is not None
        
        cursor.close()
        connection.close()
        
        return insights_exists and metadata_exists
    except Exception as e:
        print(f"❌ Error checking tables: {e}")
        return False

# Helper: Get account info
def get_account_info(account_id):
    """Get account information including user details"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT ba.*, u.email
            FROM bank_accounts ba
            JOIN users u ON ba.user_id = u.id
            WHERE ba.id = %s
        """, (account_id,))
        
        account = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return account
    except Exception as e:
        print(f"❌ Error getting account info: {e}")
        return None

# Helper: Get financial data for specific account
def get_account_financial_data(account_id):
    """
    Retrieve comprehensive financial data for a specific bank account:
    - Account details
    - Transaction summary (last 90 days)
    - Category-wise spending
    - Monthly trends
    """
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Get account details
        cursor.execute("""
            SELECT 
                id,
                masked_account_number,
                account_type,
                fip_id,
                current_balance,
                created_at
            FROM bank_accounts
            WHERE id = %s
        """, (account_id,))
        account = cursor.fetchone()
        
        if not account:
            cursor.close()
            connection.close()
            return None
        
        # Get transaction summary (last 90 days) for this account only
        ninety_days_ago = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN t.transaction_type = 'CREDIT' THEN t.amount ELSE 0 END) as total_income,
                SUM(CASE WHEN t.transaction_type = 'DEBIT' THEN t.amount ELSE 0 END) as total_expenses,
                AVG(CASE WHEN t.transaction_type = 'DEBIT' THEN t.amount END) as avg_debit,
                MAX(CASE WHEN t.transaction_type = 'DEBIT' THEN t.amount END) as max_debit,
                MIN(CASE WHEN t.transaction_type = 'DEBIT' THEN t.amount END) as min_debit
            FROM transactions t
            WHERE t.bank_account_id = %s 
            AND t.transaction_timestamp >= %s
        """, (account_id, ninety_days_ago))
        transaction_summary = cursor.fetchone()
        
        # Get category-wise spending for this account
        cursor.execute("""
            SELECT 
                t.mode,
                COUNT(*) as transaction_count,
                SUM(t.amount) as total_amount,
                AVG(t.amount) as avg_amount
            FROM transactions t
            WHERE t.bank_account_id = %s 
            AND t.transaction_type = 'DEBIT'
            AND t.transaction_timestamp >= %s
            GROUP BY t.mode
            ORDER BY total_amount DESC
            LIMIT 10
        """, (account_id, ninety_days_ago))
        spending_by_mode = cursor.fetchall()
        
        # Get monthly trend (last 6 months) for this account
        six_months_ago = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
        
        cursor.execute("""
            SELECT 
                DATE_FORMAT(t.transaction_timestamp, '%%Y-%%m') as month,
                SUM(CASE WHEN t.transaction_type = 'CREDIT' THEN t.amount ELSE 0 END) as income,
                SUM(CASE WHEN t.transaction_type = 'DEBIT' THEN t.amount ELSE 0 END) as expenses
            FROM transactions t
            WHERE t.bank_account_id = %s 
            AND t.transaction_timestamp >= %s
            GROUP BY DATE_FORMAT(t.transaction_timestamp, '%%Y-%%m')
            ORDER BY month DESC
            LIMIT 6
        """, (account_id, six_months_ago))
        monthly_trend = cursor.fetchall()
        
        # Get balance progression - DAILY aggregated data for smoother graph
        cursor.execute("""
            SELECT 
                DATE(t.transaction_timestamp) as date,
                MAX(t.current_balance) as balance
            FROM transactions t
            WHERE t.bank_account_id = %s 
            AND t.transaction_timestamp >= %s
            GROUP BY DATE(t.transaction_timestamp)
            ORDER BY date ASC
        """, (account_id, ninety_days_ago))
        all_daily_balances = cursor.fetchall()
        
        # Use daily data for graph - shows actual daily progression
        balance_history = []
        if all_daily_balances:
            # For 90 days, we can show daily data (typically 30-90 points)
            balance_history = all_daily_balances
        
        # Get recent large transactions for this account
        cursor.execute("""
            SELECT 
                t.amount,
                t.transaction_type,
                t.mode,
                t.transaction_timestamp
            FROM transactions t
            WHERE t.bank_account_id = %s 
            AND t.transaction_timestamp >= %s
            AND t.transaction_type = 'DEBIT'
            ORDER BY t.amount DESC
            LIMIT 5
        """, (account_id, ninety_days_ago))
        large_transactions = cursor.fetchall()
        
        # Get recent transactions for AI analysis (last 15 with full details)
        cursor.execute("""
            SELECT 
                DATE_FORMAT(t.transaction_timestamp, '%%Y-%%m-%%d') as date,
                t.transaction_type as type,
                t.amount,
                t.narration as description,
                t.mode as category,
                t.reference
            FROM transactions t
            WHERE t.bank_account_id = %s 
            AND t.transaction_timestamp >= %s
            ORDER BY t.transaction_timestamp DESC
            LIMIT 15
        """, (account_id, ninety_days_ago))
        recent_transactions = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Get account balance
        account_balance = float(account['current_balance'])
        
        # Calculate savings rate
        total_income = float(transaction_summary['total_income'] or 0)
        total_expenses = float(transaction_summary['total_expenses'] or 0)
        net_savings = total_income - total_expenses
        savings_rate = (net_savings / total_income * 100) if total_income > 0 else 0
        
        return {
            'account': account,
            'account_balance': account_balance,
            'transaction_summary': transaction_summary,
            'spending_by_mode': spending_by_mode,
            'monthly_trend': monthly_trend,
            'balance_history': balance_history,
            'large_transactions': large_transactions,
            'recent_transactions': recent_transactions,
            'savings_rate': savings_rate,
            'net_savings': net_savings
        }
        
    except Exception as e:
        print(f"❌ Error getting financial data: {e}")
        import traceback
        traceback.print_exc()
        return None

# Helper: Create data snapshot hash
def create_data_hash(financial_data):
    """
    Create a hash of the financial data to detect changes
    Uses: transaction count, account balance, income, expenses
    """
    try:
        snapshot = {
            'transaction_count': financial_data['transaction_summary']['total_transactions'],
            'account_balance': financial_data['account_balance'],
            'total_income': float(financial_data['transaction_summary']['total_income'] or 0),
            'total_expenses': float(financial_data['transaction_summary']['total_expenses'] or 0)
        }
        
        # Create hash
        snapshot_str = json.dumps(snapshot, sort_keys=True)
        return hashlib.md5(snapshot_str.encode()).hexdigest()
    except Exception as e:
        print(f"❌ Error creating data hash: {e}")
        return None

# Helper: Check if new insight needed
def needs_new_insight(account_id, current_hash):
    """
    Check if a new insight needs to be generated for this account
    Returns True if:
    - No previous insights exist for this account
    - Data has changed since last insight
    """
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Get latest insight metadata for this account
        cursor.execute("""
            SELECT data_hash, created_at
            FROM insights_metadata
            WHERE account_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (account_id,))
        
        latest_metadata = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        if not latest_metadata:
            print("📊 No previous insights - generating new one")
            return True
        
        if latest_metadata['data_hash'] != current_hash:
            print("📊 Data has changed - generating new insight")
            return True
        
        print("⏭️ No data changes - returning cached insight")
        return False
        
    except Exception as e:
        print(f"❌ Error checking insight status: {e}")
        return True  # Generate new insight on error

# Helper: Get past insights for context
def get_past_insights(account_id, limit=3):
    """
    Retrieve past insights for this account to provide context for new analysis
    Returns list of previous insights (titles and summaries)
    """
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                title,
                summary,
                created_at
            FROM insights
            WHERE account_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        """, (account_id, limit))
        
        past_insights = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return past_insights
        
    except Exception as e:
        print(f"❌ Error getting past insights: {e}")
        return []

# Helper: Generate AI insight
def generate_ai_insight(financial_data, past_insights):
    """
    Use Gemini AI to generate personalized financial insights
    """
    if not model:
        return {
            'title': 'Financial Overview',
            'summary': 'AI analysis unavailable - API key not configured',
            'ai_analysis': 'Please configure GEMINI_API_KEY to enable AI insights.',
            'recommendations': []
        }
    
    try:
        # Prepare context for AI
        account_info = financial_data['account']
        
        # Calculate additional insights
        avg_monthly_income = float(financial_data['transaction_summary']['total_income'] or 0) / 3  # 90 days ≈ 3 months
        avg_monthly_expenses = float(financial_data['transaction_summary']['total_expenses'] or 0) / 3
        
        # Calculate deeper financial metrics
        income = float(financial_data['transaction_summary']['total_income'] or 0)
        expenses = float(financial_data['transaction_summary']['total_expenses'] or 0)
        total_txns = financial_data['transaction_summary']['total_transactions']
        
        # Calculate spending patterns
        spending_by_mode = financial_data['spending_by_mode'][:10]
        total_spending = sum(float(m['total_amount']) for m in spending_by_mode)
        
        # Calculate velocity metrics
        daily_avg_spending = expenses / 90 if expenses > 0 else 0
        txn_avg_amount = expenses / total_txns if total_txns > 0 else 0
        
        # Financial health indicators
        balance_to_monthly_expense_ratio = financial_data['account_balance'] / (avg_monthly_expenses or 1)
        income_volatility = "stable" if len(financial_data['monthly_trend']) < 2 else "variable"
        
        context = f"""
You are a senior financial analyst with expertise in personal finance, behavioral economics, and wealth management. 
Analyze this account data and provide DEEP, PSYCHOLOGICALLY-INFORMED, ACTIONABLE insights.

🏦 ACCOUNT PROFILE (ANONYMIZED):
- Bank: {account_info['fip_id']}
- Account Type: {account_info['account_type']}
- Current Balance: ₹{financial_data['account_balance']:,.2f}
- Emergency Fund Coverage: {balance_to_monthly_expense_ratio:.1f} months of expenses
- Financial Buffer Status: {"✅ STRONG (3+ months)" if balance_to_monthly_expense_ratio >= 3 else "⚠️ WEAK (< 3 months)" if balance_to_monthly_expense_ratio >= 1 else "� CRITICAL (< 1 month)"}

💰 90-DAY FINANCIAL PERFORMANCE METRICS:
- Total Income: ₹{income:,.2f}
- Total Expenses: ₹{expenses:,.2f}
- Net Savings: ₹{financial_data['net_savings']:,.2f}
- Savings Rate: {financial_data['savings_rate']:.1f}% (Target: 20-30%, Ideal: 30-50%)
- Transaction Count: {total_txns} transactions
- Avg Monthly Income: ₹{avg_monthly_income:,.2f}
- Avg Monthly Expenses: ₹{avg_monthly_expenses:,.2f}
- Daily Burn Rate: ₹{daily_avg_spending:,.2f}/day
- Average Transaction Size: ₹{txn_avg_amount:,.2f}
- Income Volatility: {income_volatility}

💳 SPENDING BEHAVIOR ANALYSIS (Top 10 Categories):
"""
        for i, mode in enumerate(spending_by_mode, 1):
            amount = float(mode['total_amount'])
            percentage = (amount / total_spending * 100) if total_spending > 0 else 0
            txn_count = mode['transaction_count']
            avg_per_txn = amount / txn_count if txn_count > 0 else 0
            context += f"\n{i}. {mode['mode']}: ₹{amount:,.2f} ({percentage:.1f}% of total) - {txn_count} transactions (₹{avg_per_txn:,.0f}/txn avg)"
        
        context += "\n\n📈 MONTHLY CASH FLOW TREND (Last 6 Months):\n"
        monthly_data = []
        for month in financial_data['monthly_trend']:
            m_income = float(month['income'])
            m_expenses = float(month['expenses'])
            net = m_income - m_expenses
            savings_rate = (net / m_income * 100) if m_income > 0 else 0
            monthly_data.append({'month': month['month'], 'net': net, 'rate': savings_rate, 'income': m_income, 'expenses': m_expenses})
            context += f"\n- {month['month']}: Income ₹{m_income:,.0f}, Expenses ₹{m_expenses:,.0f}, Net ₹{net:,.0f} ({savings_rate:.1f}% saved)"
        
        # Deep trend analysis
        if len(monthly_data) >= 2:
            recent_trend = monthly_data[0]['net'] - monthly_data[1]['net']
            trend_direction = "improving" if recent_trend > 0 else "declining"
            
            # Calculate trend velocity
            avg_change = sum(monthly_data[i]['net'] - monthly_data[i+1]['net'] for i in range(len(monthly_data)-1)) / (len(monthly_data)-1) if len(monthly_data) > 1 else 0
            
            # Volatility
            savings_rates = [m['rate'] for m in monthly_data]
            avg_savings_rate = sum(savings_rates) / len(savings_rates)
            volatility = max(savings_rates) - min(savings_rates)
            
            context += f"\n\n💡 TREND INSIGHTS:"
            context += f"\n- Savings trajectory: {trend_direction.upper()} (₹{abs(recent_trend):,.0f} change from last month)"
            context += f"\n- Average monthly momentum: ₹{avg_change:,.0f}/month"
            context += f"\n- Savings rate range: {min(savings_rates):.1f}% to {max(savings_rates):.1f}% (Volatility: {volatility:.1f}%)"
            context += f"\n- Consistency score: {"HIGH" if volatility < 10 else "MODERATE" if volatility < 20 else "VOLATILE"}"
            
            # Pattern detection
            if monthly_data[0]['expenses'] > monthly_data[1]['expenses'] * 1.2:
                context += f"\n- ⚠️ ALERT: Spending spiked by {((monthly_data[0]['expenses'] / monthly_data[1]['expenses'] - 1) * 100):.0f}% this month!"
            elif monthly_data[0]['rate'] > monthly_data[1]['rate'] + 5:
                context += f"\n- ✅ POSITIVE: Savings rate improved by {(monthly_data[0]['rate'] - monthly_data[1]['rate']):.1f}%!"
        
        context += "\n\n💰 LARGE TRANSACTION ANALYSIS (Top 10):\n"
        large_txns = financial_data['large_transactions'][:10]
        total_large_txn_amount = sum(float(txn['amount']) for txn in large_txns)
        large_txn_percentage = (total_large_txn_amount / expenses * 100) if expenses > 0 else 0
        
        context += f"(These {len(large_txns)} transactions represent ₹{total_large_txn_amount:,.0f} or {large_txn_percentage:.1f}% of total spending)\n"
        for i, txn in enumerate(large_txns, 1):
            context += f"\n{i}. ₹{float(txn['amount']):,.2f} via {txn['mode']} ({txn['transaction_type']}) on {str(txn['transaction_timestamp'])[:10]}"
        
        # Behavioral patterns
        context += "\n\n🧠 BEHAVIORAL SPENDING PATTERNS:"
        
        # Category concentration
        if spending_by_mode:
            top_category_pct = (float(spending_by_mode[0]['total_amount']) / total_spending * 100) if total_spending > 0 else 0
            if top_category_pct > 40:
                context += f"\n- ⚠️ HIGH CONCENTRATION: {spending_by_mode[0]['mode']} represents {top_category_pct:.1f}% of spending"
            
            # Frequency analysis
            high_freq_categories = [m for m in spending_by_mode if m['transaction_count'] > 15]
            if high_freq_categories:
                context += f"\n- 🔄 HIGH FREQUENCY: {len(high_freq_categories)} categories with 15+ transactions (habitual spending)"
        
        # Large transaction dependency
        if large_txn_percentage > 50:
            context += f"\n- 💸 LUMPY SPENDING: Top 10 transactions account for {large_txn_percentage:.0f}% of expenses (consider planning for large expenses)"
        
        # Add past insights for learning
        if past_insights:
            context += "\n\n📝 PAST RECOMMENDATIONS CONTEXT:\n"
            for i, insight in enumerate(past_insights[:2], 1):
                context += f"\n{i}. {insight['title']} - {insight['summary'][:150]}"
            context += "\n(Consider: Did they act on previous advice? What improved/worsened?)"
        
        context += """

📋 YOUR TASK - Generate DEEP, PSYCHOLOGICALLY-INFORMED Financial Intelligence:

🎯 ANALYSIS REQUIREMENTS (Go Beyond Surface-Level):

1. **Identify Root Causes**: Don't just state "high spending" - explain WHY (lifestyle inflation? habit loops? emotional spending?)
2. **Behavioral Economics**: Apply concepts like loss aversion, mental accounting, anchoring
3. **Pattern Recognition**: Find temporal patterns, category correlations, threshold behaviors
4. **Risk Assessment**: Evaluate financial vulnerability, liquidity risks, income dependency
5. **Opportunity Cost**: Quantify what money spent on X could achieve if invested or saved
6. **Comparative Benchmarking**: Compare to healthy financial ratios and typical spending patterns
7. **Psychological Triggers**: Identify spending triggers and habit loops

🎯 OUTPUT STRUCTURE:

1. **Title**: A COMPELLING, SPECIFIC headline that captures THE most critical insight
   ✅ Good: "Your Top 3 Categories Consume 68% of Income - Here's The Fix"
   ❌ Bad: "Financial Analysis for This Month"
   Must use actual data, percentages, and create curiosity/urgency
   Example: "You're Spending 3X More on Weekends - Here's the ₹X Impact"

2. **Summary** (3-5 sentences minimum):
   - Lead with the most surprising/important finding
   - Use specific numbers and comparisons
   - Explain the context and what changed
   - Highlight the trend or pattern discovered
   - End with the implication (risk or opportunity)
   Example: "Your savings rate dropped from 23% to 12% this month due to a 45% spike in UPI spending. 
   The top 5 transactions alone consumed ₹X, equivalent to Y% of your monthly income. This represents 
   a shift from your 3-month average where dining was only 15% of expenses. Without course correction, 
   you're on track to deplete your emergency fund in Z months. The good news: 60% of this increase 
   was discretionary and can be optimized."

3. **Analysis** (12-15 bullet points with SUBSTANTIAL DEPTH):
   Each bullet should be 2-4 sentences explaining the insight, its significance, and implications.
   You MUST cover ALL of these dimensions:
   
   📊 Financial Health Assessment:
   • Emergency fund adequacy (X months coverage vs 3-6 month ideal)
   • Savings rate trajectory and what it means for long-term wealth
   • Income-to-expense ratio and financial flexibility
   
   💸 Spending Behavior Deep Dive:
   • Which categories dominate (with %) and why that matters
   • Spending velocity (are expenses accelerating or decelerating?)
   • Transaction frequency patterns (death by a thousand small cuts vs few large expenses)
   • Category-specific insights (e.g., "Your UPI spending averages ₹X per transaction - impulse buys?")
   
   📈 Trend Intelligence:
   • Month-over-month changes with %-age deltas
   • 3-month and 6-month trajectory
   • Volatility assessment (predictable vs erratic)
   • Leading indicators (early warning signs of trouble or improvement)
   
   🎯 Hidden Patterns:
   • Concentration risk (one category dominating?)
   • Behavioral triggers (specific days, times, methods correlated with high spending?)
   • Opportunity costs (quantify what current spending could become if redirected)
   
   ⚠️ Risk Factors:
   • Liquidity concerns, lifestyle inflation, lack of diversification
   • Future obligations they may not be prepared for

4. **Recommendations** (7-10 ACTIONABLE strategies with PSYCHOLOGY):
   Each recommendation MUST include:
   ✅ Specific target amount/percentage
   ✅ WHY it works (psychological principle or financial logic)
   ✅ HOW to implement (concrete step)
   ✅ Expected impact (quantified outcome)
   
   Examples of DEEP recommendations:
   ❌ Bad: "Try to save more money"
   ✅ Good: "Set up auto-transfer of ₹X (20% of income) to savings on salary day - before you see it. 
   This uses 'out of sight, out of mind' and removes willpower from the equation. Impact: ₹Y more 
   saved annually, compound to ₹Z in 5 years at 8% returns."
   
   ✅ Good: "Your UPI spending (₹X, 45% of expenses) is fragmented across Y transactions. Implement 
   the 24-hour rule for purchases over ₹500 - reduces impulse buying by 40% per behavioral research. 
   Could save ₹Z/month."
   
   ✅ Good: "Your {top_category} spending spiked A% this month. Set a 'pain point' alert at ₹B (80% 
   of target) - loss aversion will kick in, reducing overspend. Frees up ₹C for emergency fund."

   Cover these categories in recommendations:
   - Emergency fund building (if weak)
   - High-impact spending cuts (specific categories with targets)
   - Behavioral interventions (automation, friction, visibility)
   - Income optimization (if applicable)
   - Habit redesign (replace expensive habits with cheaper alternatives)
   - Financial buffer strategies
   - Long-term wealth building moves

📝 FORMAT (Follow EXACTLY - write comprehensive, detailed content for each section):

TITLE:
[Attention-grabbing title with specific data]

SUMMARY:
[Write 4-6 detailed sentences, minimum 150 words. Include: main finding, specific numbers, context, trend analysis, implications, and next steps. Make it comprehensive and insightful.]

ANALYSIS:
• [Bullet 1: Write 3-4 full sentences explaining the insight, why it matters, the trend, and implications - minimum 50 words]
• [Bullet 2: Write 3-4 full sentences explaining the insight, why it matters, the trend, and implications - minimum 50 words]
• [Bullet 3: Continue same pattern...]
• [Include 12-15 comprehensive bullet points total]
• [Each point should be substantive - explain the "what", "so what", and "now what"]

RECOMMENDATIONS:
[1] [Write a full paragraph, 5-7 sentences, minimum 80 words. Include: specific action, exact targets, psychological principle, implementation steps, expected timeline, and quantified impact with projections]
[2] [Full paragraph on emergency fund strategy - why it matters, how to build it, timeline, peace-of-mind value]
[3] [Full paragraph on spending optimization - which category, why overspending, how to cut, behavioral technique, monthly and annual savings]
[4] [Full paragraph on automation - what to automate, how to set it up, psychological benefit, impact on willpower and results]
[5] [Full paragraph on habit substitution - replace what with what, cost comparison, lifestyle impact, long-term savings]
[6] [Full paragraph on alert/monitoring system - what to track, trigger points, preventive actions, savings potential]
[7] [Full paragraph on wealth building - allocation strategy, time horizon, compound effect, future value projection]
[8] [Additional paragraph if relevant - personalized to their specific situation]

TOTAL LENGTH TARGET: 2000-3000 words minimum for truly deep, actionable insights.

TITLE: [Compelling, data-driven headline with specific metrics]

SUMMARY: [2-3 sentences leading with the key finding, backed by numbers, ending with the implication]

ANALYSIS:
• [Financial Health: Emergency fund, savings rate, flexibility]
• [Spending Dominance: Top categories with % of income and why it matters]
• [Behavioral Pattern: Transaction frequency, size, method insights]
• [Trend Analysis: MoM changes with % deltas, trajectory assessment]
• [Velocity Metrics: Daily burn rate, acceleration/deceleration]
• [Concentration Risk: Category over-dependence or diversification]
• [Hidden Patterns: Temporal, methodological, or psychological correlations]
• [Opportunity Cost: What current spending could achieve if redirected]
• [Risk Assessment: Liquidity, volatility, vulnerability factors]
• [Comparative: How they stack up against healthy benchmarks]
• [Early Warnings or Green Flags: Leading indicators to watch]
• [Additional insight with quantification]

RECOMMENDATIONS:
[1] [Specific action + amount/% target + psychological principle + implementation method + quantified impact]
[2] [Emergency fund strategy with exact targets + why + how + impact]
[3] [High-impact spending cut in specific category + target reduction + behavioral technique + savings]
[4] [Automation/friction strategy + exact setup + psychological basis + expected outcome]
[5] [Habit replacement + from X to Y + cost difference + annual impact]
[6] [Alert/threshold strategy + specific trigger + action + prevention value]
[7] [Long-term wealth building + specific allocation + time horizon + projected value]
[8] [Additional strategic recommendation with full detail]
[9] [Additional tactical recommendation with quantification]
[10] [Bonus insight-driven recommendation]

🚨 ABSOLUTE REQUIREMENTS - YOU MUST FOLLOW THESE:
1. MINIMUM LENGTH: 3000 words total output (approximately 15-20 pages)
2. SUMMARY: Must be 200-300 words (12-15 sentences minimum)
3. ANALYSIS: Must have 15-20 bullet points, EACH being 60-100 words (5-6 sentences)
4. RECOMMENDATIONS: Must have 10-12 items, EACH being 120-180 words (8-10 sentences)
5. Use ACTUAL data from above - no generic advice
6. QUANTIFY everything - numbers, percentages, amounts, projections
7. EXPLAIN the psychology/logic behind every insight and recommendation
8. Make it DEEPLY PERSONAL - reference their specific patterns and numbers
9. Be EXTREMELY ACTIONABLE - clear implementation steps for tomorrow
10. Show COMPOUND IMPACT - what changes if they follow advice over 1/3/5 years
11. Think like a CFP (Certified Financial Planner) writing a detailed financial plan
12. DO NOT BE BRIEF. DO NOT SUMMARIZE. WRITE COMPREHENSIVELY.

⚠️ WRITING STYLE REQUIREMENTS:
- Write like you're explaining to a friend over coffee - conversational but informative
- Every statement must be backed by their actual data
- Use "you" and "your" throughout to make it personal
- Explain concepts as you introduce them (don't assume financial literacy)
- Paint scenarios: "If you continue X, in Y months you'll have Z"
- Use analogies: "That's like burning through a ₹X bill every day"
- Create urgency with data: "At this rate, your emergency fund depletes in X weeks"
- Balance concern with opportunity: acknowledge problems but focus on solutions

📊 DETAILED FORMAT REQUIREMENTS:

TITLE:
[Craft a compelling headline that uses their specific data point - must grab attention]
Example: "Your UPI Spending Jumped 67% - Here's the ₹1.8L Annual Impact and Recovery Plan"

SUMMARY: (MANDATORY 200-300 WORDS - 12-15 FULL SENTENCES)
Write a comprehensive executive summary that covers:
- Opening statement: The single most important finding from the data
- Context: How this month compares to recent history (specific percentages)
- Root cause: What drove this change (breakdown by category with amounts)
- Magnitude: The absolute numbers and what they represent
- Trend assessment: Is this improving, declining, or stable?
- Risk evaluation: What's at stake if this continues?
- Opportunity framing: What's possible if course-corrected?
- Bright spots: What are they doing well?
- Key insight: The underlying behavioral pattern discovered
- Projection: Where they'll be in 3/6/12 months at current trajectory
- Teaser: Preview of recommendations
- Call to action: What they should focus on first

ANALYSIS: (MANDATORY 15-20 BULLETS, EACH 60-100 WORDS, 5-6 SENTENCES)

For EACH bullet point, use this exact structure:
• **[Topic Name]**: [Sentence 1: Present the specific data/metric with exact numbers]. [Sentence 2: Explain what this means in plain English]. [Sentence 3: Compare to ideal benchmarks or previous periods with percentages]. [Sentence 4: Analyze why this matters for their financial future]. [Sentence 5: State the implication - what happens if unchanged]. [Sentence 6: Hint at the opportunity or next step].

You MUST write detailed bullets covering ALL of these (5-6 sentences each):
1. Emergency Fund Status and Adequacy Analysis
2. Savings Rate Trajectory and Wealth-Building Velocity
3. Income Composition, Stability, and Growth Assessment
4. Total Expense Load and Sustainability Check
5. Category-by-Category Spending Breakdown with Dominance Analysis
6. Month-over-Month Trend Analysis with Directional Assessment
7. Spending Velocity and Daily Burn Rate Calculation
8. Transaction Behavior Patterns (frequency, size, method, timing)
9. Payment Method Psychology and Control Implications
10. Temporal Spending Patterns (day-of-week, time-of-month analysis)
11. Category Concentration Risk and Diversification Health
12. Behavioral Spending Triggers and Patterns Recognition
13. Opportunity Cost Assessment (what else money could achieve)
14. Liquidity Position and Cash Flow Timing Analysis
15. Risk Factors and Financial Vulnerabilities Identification
16. Positive Behaviors and Strengths to Leverage
17. Comparative Benchmarking Against Healthy Financial Norms
18. Future Trajectory Projections (3/6/12 month scenarios)
19. Early Warning Indicators and Trigger Points
20. Hidden Insights and Non-Obvious Correlations

RECOMMENDATIONS: (MANDATORY 10-12 PARAGRAPHS, EACH 120-180 WORDS, 8-10 SENTENCES)

For EACH recommendation, write a full paragraph following this structure:
[#] **[Recommendation Title - Make it Specific and Actionable]**
[Sentence 1: State exactly what to do with specific amounts/targets]. [Sentence 2: Explain the behavioral science or financial principle behind why this works]. [Sentence 3: Describe how to implement - exact steps, apps, settings]. [Sentence 4: Explain why this specifically helps THEIR situation based on THEIR data]. [Sentence 5: Calculate and state the immediate monthly impact in rupees]. [Sentence 6: Project the annual impact and cumulative savings]. [Sentence 7: Explain the psychological/lifestyle benefit beyond money]. [Sentence 8: Provide a 3-5 year compound projection if applicable]. [Sentence 9: Give a concrete example of what they can do tomorrow]. [Sentence 10: End with a motivational insight about the long-term transformation].

You MUST write comprehensive paragraphs for ALL of these (120-180 words each):
[1] Emergency Fund Acceleration Strategy
[2] Automated "Pay Yourself First" Savings Architecture
[3] High-Impact Category Spending Reduction Plan
[4] Behavioral Friction Engineering for Problem Spending
[5] Strategic Habit Substitution (Replace Expensive with Cheaper)
[6] Real-Time Spending Alert and Monitoring System
[7] Category Budget Caps with Psychological Enforcement
[8] Transaction Cooling-Off Period for Impulse Control
[9] Income Optimization and Side Income Exploration
[10] Long-Term Investment Allocation and Wealth Compounding
[11] Cash Reserve Positioning and Buffer Optimization
[12] Monthly Financial Review and Course Correction Ritual

Now generate the comprehensive financial insight (MINIMUM 3000 WORDS):
"""
        
        # Build transaction history for AI context
        recent_transactions = financial_data.get('recent_transactions', [])
        transaction_summary = ""
        if recent_transactions:
            transaction_summary = "\n\nRECENT TRANSACTIONS (Last 15):\n"
            for i, txn in enumerate(recent_transactions[:15], 1):
                transaction_summary += f"{i}. {txn.get('date', 'N/A')}: {txn.get('type', 'N/A')} ₹{txn.get('amount', 0):,.2f} - {txn.get('description', 'N/A')[:50]} ({txn.get('category', 'N/A')})\n"
        
        # Monthly trend data
        monthly_trend = ""
        if financial_data.get('monthly_trend'):
            monthly_trend = "\n\nMONTHLY TREND (Last 6 months):\n"
            for month in financial_data['monthly_trend']:
                m_income = float(month.get('income', 0))
                m_expenses = float(month.get('expenses', 0))
                net = m_income - m_expenses
                rate = (net / m_income * 100) if m_income > 0 else 0
                monthly_trend += f"- {month.get('month', 'N/A')}: Income ₹{m_income:,.0f}, Expenses ₹{m_expenses:,.0f}, Saved ₹{net:,.0f} ({rate:.1f}%)\n"
        
        # Faster, focused prompt that generates quality content quickly
        simple_prompt = f"""You are a financial advisor. Analyze this data and provide insights.

FINANCIAL DATA:
Balance: ₹{financial_data['account_balance']:,.2f}
90-Day Income: ₹{income:,.2f}
90-Day Expenses: ₹{expenses:,.2f}
Savings Rate: {financial_data['savings_rate']:.1f}%
Emergency Fund: {(financial_data['account_balance'] / avg_monthly_expenses):.1f} months

TOP SPENDING:
{chr(10).join([f"- {mode['mode']}: ₹{float(mode['total_amount']):,.2f}" for mode in spending_by_mode[:5]])}
{transaction_summary if len(recent_transactions) > 0 else ""}
{monthly_trend if financial_data.get('monthly_trend') else ""}

Provide a detailed financial report with these sections:

TITLE: [Engaging title about their key financial issue]

SUMMARY:
[8-10 sentences covering: main finding, what it means, trend, risk, opportunity, assessment]

ANALYSIS:
[8-10 paragraphs of 4-5 sentences each analyzing:
- Emergency fund status
- Savings rate vs 20-30% benchmark
- Income and expense trends
- Top spending categories
- Transaction patterns
- Cash flow health
- Behavioral insights
- Improvement opportunities]

RECOMMENDATIONS:
[6-8 actionable paragraphs of 5-6 sentences each:
- Emergency fund plan
- Savings automation
- Expense reduction
- Budget creation
- Behavioral changes
- Income growth
Each with specific steps and expected impact]

Be conversational and use specific numbers from the data.

MOST IMPORTANT: MAKE IT AN ANALYSIS REPORT NOT A CHATBOT RESPONSE GIVE THE ENTIRE RESPONSE AS JUST PARAGRAPHS AND AT MAX IT SHOULD BE 1000-1500 WORDS LONG
"""

        # Generate with Gemini - faster settings
        print("🤖 Generating AI financial insight (20-30 seconds)...")
        print(f"📊 Data: Balance=₹{financial_data['account_balance']:,.2f}, Income=₹{income:,.2f}, Expenses=₹{expenses:,.2f}, Rate={financial_data['savings_rate']:.1f}%")
        print(f"📝 Transactions: {len(recent_transactions)} recent, Top category: {spending_by_mode[0]['mode'] if spending_by_mode else 'N/A'}")
        
        response = model.generate_content(
            simple_prompt,
            generation_config={
                'temperature': 0.7,
                'max_output_tokens': 4096,  # Reduced to 4k for faster generation (~3000 words)
                'candidate_count': 1,
            }
        )
        
        ai_text = response.text.strip()
        print(f"✅ AI response generated ({len(ai_text)} characters)")
        print(f"📝 First 200 chars: {ai_text[:200]}...")
        
        # Parse sections more reliably
        title = "Financial Health Analysis"
        summary = ""
        analysis_text = ""
        recommendations_list = []
        
        # Split by sections
        if "TITLE:" in ai_text:
            title_split = ai_text.split("TITLE:", 1)[1]
            title = title_split.split("\n", 1)[0].strip()
            ai_text = title_split.split("\n", 1)[1] if "\n" in title_split else title_split
        
        if "SUMMARY:" in ai_text and "ANALYSIS:" in ai_text:
            summary = ai_text.split("SUMMARY:")[1].split("ANALYSIS:")[0].strip()
            analysis_part = ai_text.split("ANALYSIS:")[1]
            
            if "RECOMMENDATIONS:" in analysis_part:
                analysis_text = analysis_part.split("RECOMMENDATIONS:")[0].strip()
                recommendations_text = analysis_part.split("RECOMMENDATIONS:")[1].strip()
                
                # Split recommendations into list (each paragraph is an item)
                rec_paragraphs = [p.strip() for p in recommendations_text.split('\n\n') if p.strip()]
                recommendations_list = [f"[{i+1}] {p}" for i, p in enumerate(rec_paragraphs)]
            else:
                analysis_text = analysis_part.strip()
        else:
            # Fallback: use entire response
            summary = ""
            analysis_text = ai_text
            
        
        print(f"📋 Parsed - Title: {len(title)} chars, Summary: {len(summary)} chars, Analysis: {len(analysis_text)} chars, Recs: {len(recommendations_list)} items")
        title = ""
        return {
            'title': title,
            'summary': summary,
            'ai_analysis': analysis_text,
            'recommendations': recommendations_list,
            'raw_response': ai_text
        }
        
    except Exception as e:
        print(f"❌ ERROR in generate_ai_insight: {str(e)}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        
        # Return fallback insight - BUT CLEARLY MARK IT
        account_info = financial_data['account']
        print("⚠️ RETURNING FALLBACK INSIGHT DUE TO ERROR")
        return {
            'title': '⚠️ Financial Overview (Fallback)',
            'summary': f"[FALLBACK MODE] Account balance: ₹{financial_data['account_balance']:,.2f}. Savings rate: {financial_data['savings_rate']:.1f}%. Note: AI generation failed, showing basic summary only.",
            'ai_analysis': f"[FALLBACK] Your {account_info['fip_id']} {account_info['account_type']} account has a balance of ₹{financial_data['account_balance']:,.2f}. Your savings rate over the last 90 days is {financial_data['savings_rate']:.1f}%. This is a fallback response due to AI generation error.",
            'recommendations': [
                '[1] Review your spending patterns regularly (FALLBACK)',
                '[2] Set monthly savings goals (FALLBACK)',
                '[3] Track expenses by category (FALLBACK)',
                '[4] Note: This is fallback content. Check server logs for AI generation error.'
            ]
        }

# Helper: Save insight to database
def save_insight(account_id, insight_data, financial_data, data_hash):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        insight_id = f"INS_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Save insight
        cursor.execute("""
            INSERT INTO insights 
            (account_id, insight_id, title, summary, ai_analysis, recommendations, data_snapshot, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            account_id,
            insight_id,
            insight_data['title'],
            insight_data['summary'],
            insight_data['ai_analysis'],
            json.dumps(insight_data['recommendations']),
            json.dumps(financial_data, default=decimal_to_float)
        ))
        
        # Save metadata
        cursor.execute("""
            INSERT INTO insights_metadata
            (account_id, insight_id, data_hash, transaction_count, account_balance, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (
            account_id,
            insight_id,
            data_hash,
            financial_data['transaction_summary']['total_transactions'],
            financial_data['account_balance']
        ))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        print(f"✅ Insight saved: {insight_id}")
        return insight_id
        
    except Exception as e:
        print(f"❌ Error saving insight: {e}")
        import traceback
        traceback.print_exc()
        return None

# API: Health check
@app.route('/insights/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    tables_exist = check_tables()
    
    return jsonify({
        'status': 'healthy' if tables_exist else 'tables_missing',
        'message': 'Insights service is running',
        'gemini_configured': model is not None,
        'tables_exist': tables_exist
    })

# API: Generate insight
@app.route('/insights/generate', methods=['POST'])
def generate_insight():
    """
    Generate a new financial insight for a specific bank account
    Only generates if data has changed since last insight
    """
    try:
        data = request.get_json()
        account_id = data.get('account_id')
        
        if not account_id:
            return jsonify({'success': False, 'error': 'Account ID is required'}), 400
        
        # Get account info
        account_info = get_account_info(account_id)
        if not account_info:
            return jsonify({'success': False, 'error': 'Account not found'}), 404
        
        print(f"\n{'='*60}")
        print(f"📊 Generating insight for account: {account_info['masked_account_number']} ({account_info['fip_id']})")
        print(f"{'='*60}")
        
        # Get financial data for this account
        financial_data = get_account_financial_data(account_id)
        if not financial_data:
            return jsonify({'success': False, 'error': 'No financial data available for this account'}), 404
        
        # Create data hash
        data_hash = create_data_hash(financial_data)
        
        # Check if new insight needed for this account
        if not needs_new_insight(account_id, data_hash):
            # Return cached insight
            connection = get_db_connection()
            cursor = connection.cursor(dictionary=True)
            
            cursor.execute("""
                SELECT 
                    insight_id,
                    title,
                    summary,
                    ai_analysis,
                    recommendations,
                    data_snapshot,
                    created_at
                FROM insights
                WHERE account_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (account_id,))
            
            cached_insight = cursor.fetchone()
            cursor.close()
            connection.close()
            
            if cached_insight:
                # Parse recommendations
                try:
                    recommendations = json.loads(cached_insight['recommendations'])
                except:
                    recommendations = []
                
                return jsonify({
                    'success': True,
                    'cached': True,
                    'insight': {
                        'insight_id': cached_insight['insight_id'],
                        'title': cached_insight['title'],
                        'summary': cached_insight['summary'],
                        'ai_analysis': cached_insight['ai_analysis'],
                        'recommendations': recommendations,
                        'created_at': cached_insight['created_at'].isoformat() if cached_insight['created_at'] else None
                    }
                })
        
        # Get past insights for context
        past_insights = get_past_insights(account_id, limit=3)
        
        # Generate new AI insight
        print("🤖 Generating new AI insight...")
        insight_data = generate_ai_insight(financial_data, past_insights)
        
        # Save to database
        insight_id = save_insight(account_id, insight_data, financial_data, data_hash)
        
        if not insight_id:
            return jsonify({'success': False, 'error': 'Failed to save insight'}), 500
        
        # Return generated insight
        return jsonify({
            'success': True,
            'cached': False,
            'insight': {
                'insight_id': insight_id,
                'title': insight_data['title'],
                'summary': insight_data['summary'],
                'ai_analysis': insight_data['ai_analysis'],
                'recommendations': insight_data['recommendations'],
                'created_at': datetime.now().isoformat()
            },
            'financial_summary': {
                'account_balance': financial_data['account_balance'],
                'total_income': float(financial_data['transaction_summary']['total_income'] or 0),
                'total_expenses': float(financial_data['transaction_summary']['total_expenses'] or 0),
                'savings_rate': financial_data['savings_rate'],
                'transaction_count': financial_data['transaction_summary']['total_transactions']
            },
            'account_info': {
                'account_number': account_info['masked_account_number'],
                'account_type': account_info['account_type'],
                'fip_name': account_info['fip_id']
            }
        })
        
    except Exception as e:
        print(f"❌ Error in generate_insight: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# API: Get all insights for an account
@app.route('/insights/list', methods=['POST'])
def list_insights():
    """Get all insights for a specific bank account"""
    try:
        data = request.get_json()
        account_id = data.get('account_id')
        
        if not account_id:
            return jsonify({'success': False, 'error': 'Account ID is required'}), 400
        
        # Verify account exists
        account_info = get_account_info(account_id)
        if not account_info:
            return jsonify({'success': False, 'error': 'Account not found'}), 404
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                insight_id,
                title,
                summary,
                ai_analysis,
                recommendations,
                created_at
            FROM insights
            WHERE account_id = %s
            ORDER BY created_at DESC
        """, (account_id,))
        
        insights = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Parse recommendations for each insight
        for insight in insights:
            try:
                insight['recommendations'] = json.loads(insight['recommendations'])
            except:
                insight['recommendations'] = []
            
            if insight['created_at']:
                insight['created_at'] = insight['created_at'].isoformat()
        
        return jsonify({
            'success': True,
            'insights': insights,
            'count': len(insights)
        })
        
    except Exception as e:
        print(f"❌ Error in list_insights: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# API: Get latest insight
@app.route('/insights/latest', methods=['POST'])
def get_latest_insight():
    """Get the most recent insight for a specific bank account"""
    try:
        data = request.get_json()
        account_id = data.get('account_id')
        
        if not account_id:
            return jsonify({'success': False, 'error': 'Account ID is required'}), 400
        
        # Verify account exists
        account_info = get_account_info(account_id)
        if not account_info:
            return jsonify({'success': False, 'error': 'Account not found'}), 404
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                insight_id,
                title,
                summary,
                ai_analysis,
                recommendations,
                created_at
            FROM insights
            WHERE account_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (account_id,))
        
        insight = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        if not insight:
            return jsonify({'success': False, 'error': 'No insights found'}), 404
        
        # Parse recommendations
        try:
            insight['recommendations'] = json.loads(insight['recommendations'])
        except:
            insight['recommendations'] = []
        
        if insight['created_at']:
            insight['created_at'] = insight['created_at'].isoformat()
        
        return jsonify({
            'success': True,
            'insight': insight
        })
        
    except Exception as e:
        print(f"❌ Error in get_latest_insight: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# API: Get financial summary (for the insights screen data)
@app.route('/insights/financial-summary', methods=['POST'])
def get_financial_summary():
    """Get financial summary for insights screen visualization for a specific account"""
    try:
        data = request.get_json()
        account_id = data.get('account_id')
        
        if not account_id:
            return jsonify({'success': False, 'error': 'Account ID is required'}), 400
        
        # Get account info
        account_info = get_account_info(account_id)
        if not account_info:
            return jsonify({'success': False, 'error': 'Account not found'}), 404
        
        # Get financial data for this account
        financial_data = get_account_financial_data(account_id)
        if not financial_data:
            return jsonify({'success': False, 'error': 'No financial data available for this account'}), 404
        
        # Format spending by mode for frontend
        categories = []
        total_spending = float(financial_data['transaction_summary']['total_expenses'] or 0)
        
        for mode in financial_data['spending_by_mode']:
            amount = float(mode['total_amount'])
            percentage = (amount / total_spending * 100) if total_spending > 0 else 0
            categories.append({
                'name': mode['mode'],
                'value': amount,
                'percentage': round(percentage, 1),
                'transaction_count': mode['transaction_count']
            })
        
        # Format monthly trend
        monthly_data = []
        for month in reversed(financial_data['monthly_trend']):  # Reverse to show oldest first
            monthly_data.append({
                'month': month['month'],
                'income': float(month['income']),
                'expenses': float(month['expenses']),
                'net': float(month['income']) - float(month['expenses'])
            })
        
        # Format balance history for graph
        balance_data = []
        for item in financial_data['balance_history']:
            balance_data.append({
                'date': str(item['date']) if 'date' in item else item.get('month', ''),
                'balance': float(item['balance'])
            })
        
        # Calculate statistics
        avg_debit = float(financial_data['transaction_summary']['avg_debit'] or 0)
        max_debit = float(financial_data['transaction_summary']['max_debit'] or 0)
        
        return jsonify({
            'success': True,
            'summary': {
                'account_balance': financial_data['account_balance'],
                'total_income': float(financial_data['transaction_summary']['total_income'] or 0),
                'total_expenses': total_spending,
                'net_savings': financial_data['net_savings'],
                'savings_rate': financial_data['savings_rate'],
                'categories': categories,
                'monthly_data': monthly_data,
                'balance_history': balance_data,
                'statistics': {
                    'average_monthly_spending': total_spending / 3 if total_spending > 0 else 0,  # 90 days = ~3 months
                    'largest_transaction': max_debit,
                    'average_transaction': avg_debit,
                    'transaction_count': financial_data['transaction_summary']['total_transactions']
                }
            },
            'account_info': {
                'account_number': account_info['masked_account_number'],
                'account_type': account_info['account_type'],
                'fip_name': account_info['fip_id']
            }
        })
        
    except Exception as e:
        print(f"❌ Error in get_financial_summary: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🔍 Financial Insights Backend Starting...")
    print("="*60)
    
    # Check if tables exist
    if not check_tables():
        print("\n⚠️  WARNING: Insights tables not found!")
        print("Please run: python migrate_insights_tables.py")
        print("="*60 + "\n")
    else:
        print("✅ Database tables ready")
    
    if not GEMINI_API_KEY:
        print("\n⚠️  WARNING: GEMINI_API_KEY not configured!")
        print("Set it in .env file or environment variables")
        print("="*60 + "\n")
    
    print("\n🚀 Server running on http://localhost:8001")
    print("📊 Endpoints:")
    print("  - POST /insights/generate")
    print("  - POST /insights/list")
    print("  - POST /insights/latest")
    print("  - POST /insights/financial-summary")
    print("  - GET  /insights/health")
    print("="*60 + "\n")
    
    app.run(debug=True, port=8001, host='0.0.0.0')
