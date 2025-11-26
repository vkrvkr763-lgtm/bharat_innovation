from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from app import models

# Initialize Tables
models.create_tables()

app = FastAPI()

# Enable CORS (Allows your HTML file to talk to this Python backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all frontend origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB
def get_db():
    db = models.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Pydantic Schemas (Inputs) ---
class RewardRequest(BaseModel):
    resident_name: str
    amount: int
    description: str

class RedeemRequest(BaseModel):
    resident_name: str
    amount: int
    shop_name: str

# --- API Endpoints ---

@app.get("/")
def health_check():
    return {"status": "active", "message": "GreenReward API is running"}

# 1. Get User Profile (For Resident Dashboard)
@app.get("/users/{username}")
def get_user(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get recent transactions
    history = db.query(models.Transaction).filter(models.Transaction.user_id == user.id).limit(5).all()
    
    return {
        "username": user.username,
        "points": user.points,
        "history": history
    }

# 2. Reward Points (Collector scans waste)
@app.post("/reward")
def reward_points(request: RewardRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == request.resident_name).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Add Points
    user.points += request.amount
    
    # Log Transaction
    new_tx = models.Transaction(
        user_id=user.id,
        amount=request.amount,
        description=request.description
    )
    db.add(new_tx)
    db.commit()
    
    return {"message": "Points rewarded", "new_balance": user.points}

# 3. Redeem Points (Marketplace)
@app.post("/redeem")
def redeem_points(request: RedeemRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == request.resident_name).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.points < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient points")

    # Deduct Points
    user.points -= request.amount
    
    # Log Transaction
    new_tx = models.Transaction(
        user_id=user.id,
        amount=-request.amount,
        description=f"Redeemed at {request.shop_name}"
    )
    db.add(new_tx)
    db.commit()
    
    return {"message": "Redemption successful", "new_balance": user.points}