from app.models import SessionLocal, User, Transaction, create_tables

# 1. Initialize Database
create_tables()
db = SessionLocal()

def seed_data():
    # Check if data exists to avoid duplicates
    if db.query(User).first():
        print("Data already exists!")
        return

    # 2. Create The Resident (Matches your UI Screenshot)
    ravi = User(
        username="Ravi", 
        role="resident", 
        points=12450  # Starting balance from your design
    )
    
    # 3. Create The Collector
    suresh = User(
        username="Suresh", 
        role="collector", 
        points=0
    )

    db.add(ravi)
    db.add(suresh)
    db.commit()

    # 4. Add Dummy Transactions (For "Recent Activity" list)
    t1 = Transaction(user_id=ravi.id, amount=40, description="Dry waste scan • Building A gate")
    t2 = Transaction(user_id=ravi.id, amount=-220, description="Annapurna Kirana • Indiranagar")
    t3 = Transaction(user_id=ravi.id, amount=120, description="Wet waste scan • Morning")

    db.add_all([t1, t2, t3])
    db.commit()
    
    print("✅ Database Seeded! Ravi has 12,450 points.")

if __name__ == "__main__":
    seed_data()