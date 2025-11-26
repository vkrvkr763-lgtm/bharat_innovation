from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, create_engine
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from datetime import datetime

# 1. Setup SQLite Database (Simple file, no installation needed)
SQLALCHEMY_DATABASE_URL = "sqlite:///./greenreward.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 2. User Table (Stores Residents and Collectors)
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    role = Column(String)  # "resident" or "collector"
    points = Column(Integer, default=0)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="user")

# 3. Transaction Table (History for "Recent Activity" UI)
class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Integer)     # +10 or -100
    description = Column(String) # e.g., "Dry waste scan", "FreshBasket Redemption"
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="transactions")

# 4. Create Tables Function
def create_tables():
    Base.metadata.create_all(bind=engine)