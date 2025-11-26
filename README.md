# bharat_innovation
waste to reward
🌱 GreenReward

A simple waste-to-rewards system where residents earn points for giving segregated waste, and collectors verify and reward them.

⭐ What This Project Does
Residents earn eco-points for giving dry/wet waste.
Collectors scan the waste and approve rewards.
Residents can redeem points at local shops.
Backend stores user points and transaction history.
Clean and simple UI for both Resident and Collector.

🧑‍🔧 Features
Collector Portal
Upload/scan waste photo
AI verification simulation
Reward points
Collector must press OK before next scan
Resident Dashboard
Live points balance
Recent activity
Redeem points

“How it Works” popup
Logout option

🛠️ Tech Used
Frontend: HTML, Tailwind CSS, JavaScript
Backend: FastAPI (Python)
Database: SQLite
Icons: FontAwesome

▶️ How to Run
1. Install requirements
pip install fastapi uvicorn sqlalchemy

2. Seed the database
python seed.py

3. Start the server
uvicorn main:app --reload

4. Open files in browser
collector.html
resident.html

📁 Project Files
collector.html – Collector interface
resident.html – Resident dashboard
script.js – All frontend logic
main.py – FastAPI backend
models.py – Database models
seed.py – Initial data

