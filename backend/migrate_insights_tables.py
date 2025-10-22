"""
Database Migration: Create Insights Tables
Creates tables for storing AI-generated financial insights
"""
import os
import mysql.connector
from datetime import datetime

# Database configuration
DB_CONFIG = {
    'host': 'bknsjtealwda26vlfp4k-mysql.services.clever-cloud.com',
    'user': 'ukcl0jlhepkfb03y',
    'password': 'oj1dcCNJNgh1Q7ztjjz3',
    'database': 'bknsjtealwda26vlfp4k'
}

def migrate():
    """Create insights tables"""
    try:
        print("\n" + "="*60)
        print("🔄 Starting Insights Tables Migration")
        print("="*60 + "\n")
        
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        # Drop existing tables if they exist
        print("📋 Step 1: Dropping existing tables (if any)...")
        cursor.execute("DROP TABLE IF EXISTS insights_metadata")
        cursor.execute("DROP TABLE IF EXISTS insights")
        print("✅ Old tables dropped\n")
        
        # Create insights table
        print("📋 Step 2: Creating insights table...")
        cursor.execute("""
            CREATE TABLE insights (
                id INT AUTO_INCREMENT PRIMARY KEY,
                account_id INT NOT NULL,
                insight_id VARCHAR(50) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                summary TEXT,
                ai_analysis TEXT,
                recommendations TEXT,
                data_snapshot JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_account_id (account_id),
                INDEX idx_insight_id (insight_id),
                INDEX idx_created_at (created_at),
                FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("✅ insights table created")
        print("   - Stores AI-generated financial insights PER BANK ACCOUNT")
        print("   - Includes title, summary, analysis, and recommendations")
        print("   - Stores complete financial data snapshot\n")
        
        # Create insights_metadata table
        print("📋 Step 3: Creating insights_metadata table...")
        cursor.execute("""
            CREATE TABLE insights_metadata (
                id INT AUTO_INCREMENT PRIMARY KEY,
                account_id INT NOT NULL,
                insight_id VARCHAR(50) NOT NULL,
                data_hash VARCHAR(32) NOT NULL,
                transaction_count INT DEFAULT 0,
                account_balance DECIMAL(15, 2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_account_id (account_id),
                INDEX idx_data_hash (data_hash),
                INDEX idx_created_at (created_at),
                FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
                FOREIGN KEY (insight_id) REFERENCES insights(insight_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("✅ insights_metadata table created")
        print("   - Tracks data changes PER ACCOUNT to determine when new insights needed")
        print("   - Stores data hash for change detection")
        print("   - Stores transaction count and balance for quick reference\n")
        
        connection.commit()
        
        # Verify tables were created
        print("📋 Step 4: Verifying table structure...\n")
        
        cursor.execute("DESCRIBE insights")
        insights_columns = cursor.fetchall()
        print("✅ insights table structure:")
        for col in insights_columns:
            print(f"   - {col[0]}: {col[1]}")
        
        print()
        
        cursor.execute("DESCRIBE insights_metadata")
        metadata_columns = cursor.fetchall()
        print("✅ insights_metadata table structure:")
        for col in metadata_columns:
            print(f"   - {col[0]}: {col[1]}")
        
        cursor.close()
        connection.close()
        
        print("\n" + "="*60)
        print("✅ Migration completed successfully!")
        print("="*60)
        print("\n📊 Next steps:")
        print("   1. Start the insights backend: python insights.py")
        print("   2. Test with: curl http://localhost:8000/insights/health")
        print("   3. Generate insights from the app")
        print("="*60 + "\n")
        
    except mysql.connector.Error as e:
        print(f"\n❌ Database Error: {e}")
        print("="*60 + "\n")
        raise
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        print("="*60 + "\n")
        raise

if __name__ == '__main__':
    migrate()
