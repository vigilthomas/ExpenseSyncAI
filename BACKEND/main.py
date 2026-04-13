import json
import os
import time
import uuid
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sms_parser import parse_sms

app = FastAPI()

# Allow CORS so the frontend can use fetch() from another origin or local file
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "db.json"

def init_db():
    if not os.path.exists(DB_FILE):
        now = int(time.time() * 1000)
        initial_data = {
            "expenses": [],
            "people": [
                {"id": "1", "name": "Vigil", "normalized_name": "vigil", "created_at": now, "last_used_at": now},
                {"id": "2", "name": "Alice", "normalized_name": "alice", "created_at": now, "last_used_at": now},
                {"id": "3", "name": "Bob", "normalized_name": "bob", "created_at": now, "last_used_at": now}
            ],
            "splits": [],
            "splitEntries": []
        }
        save_db(initial_data)

def get_db():
    init_db()
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=2)

def gen_uuid():
    return str(uuid.uuid4())

# -- Pydantic Models for Inputs --

class ExpenseInput(BaseModel):
    amount: str
    description: str
    category: str
    date: str
    is_split: bool
    participant_ids: List[str] = []

class SmsInput(BaseModel):
    text: str

# -- API Routes --

@app.get("/api/expenses")
def get_expenses():
    db = get_db()
    expenses = sorted(db.get("expenses", []), key=lambda x: x.get("created_at", 0), reverse=True)
    return expenses

@app.get("/api/people")
def get_people():
    db = get_db()
    people = sorted(db.get("people", []), key=lambda x: x.get("last_used_at", 0), reverse=True)
    return people

@app.get("/api/settlements")
def get_pending_settlements():
    db = get_db()
    pending = []
    for entry in db.get("splitEntries", []):
        if entry.get("status") == "pending":
            split = next((s for s in db["splits"] if s["id"] == entry["split_id"]), None)
            if not split: continue
            expense = next((e for e in db["expenses"] if e["id"] == split["expense_id"]), None)
            person = next((p for p in db["people"] if p["id"] == entry["person_id"]), None)
            
            pending.append({
                **entry,
                "to_get": entry["amount"] - entry.get("paid_amount", 0),
                "expense": expense,
                "person": person
            })
    return pending

@app.get("/api/settlements/all")
def get_all_settlements():
    db = get_db()
    return db.get("splitEntries", [])

@app.post("/api/expenses")
def add_expense(data: ExpenseInput):
    db = get_db()
    now = int(time.time() * 1000)
    
    amount_minor = round(float(data.amount) * 100)
    split_id = gen_uuid() if data.is_split else None
    
    expense = {
        "id": gen_uuid(),
        "user_id": "1",
        "amount_minor": amount_minor,
        "currency": "USD",
        "category": data.category,
        "description": data.description,
        "date_time": data.date,
        "source": "manual",
        "raw_input": "",
        "is_split": data.is_split,
        "split_id": split_id,
        "created_at": now,
        "updated_at": now
    }
    db["expenses"].append(expense)

    if data.is_split and data.participant_ids:
        participants_count = len(data.participant_ids) + 1
        split_amount = amount_minor // participants_count
        remainder = amount_minor - (split_amount * participants_count)
        
        split = {
            "id": split_id,
            "expense_id": expense["id"],
            "total_amount": amount_minor,
            "split_type": "equal"
        }
        db["splits"].append(split)
        
        # update last used
        for person in db["people"]:
            if person["id"] in data.participant_ids:
                person["last_used_at"] = now
                
        # create split entries
        for i, pid in enumerate(data.participant_ids):
            person_amount = split_amount + remainder if i == 0 else split_amount
            db["splitEntries"].append({
                "id": gen_uuid(),
                "split_id": split_id,
                "person_id": pid,
                "amount": person_amount,
                "paid_amount": 0,
                "status": "pending"
            })
            
    save_db(db)
    return expense

@app.post("/api/settlements/{entry_id}/settle")
def settle_entry(entry_id: str):
    db = get_db()
    for entry in db.get("splitEntries", []):
        if entry["id"] == entry_id:
            entry["paid_amount"] = entry["amount"]
            entry["status"] = "settled"
            save_db(db)
            return {"status": "success"}
    raise HTTPException(status_code=404, detail="Entry not found")

@app.post("/api/parse-sms")
def parse_sms_api(req: SmsInput):
    # Call the actual parser logic non-interactively
    try:
        parsed_result = parse_sms(req.text, interactive=False)
        return parsed_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
