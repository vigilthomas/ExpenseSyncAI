/**
 * Data Access Layer interacting with FastAPI backend
 */

const API_BASE = 'http://localhost:8000/api';

export async function getExpenses() {
    const res = await fetch(`${API_BASE}/expenses`);
    return await res.json();
}

export async function getPeople() {
    const res = await fetch(`${API_BASE}/people`);
    return await res.json();
}

export async function searchPeople(query) {
    const people = await getPeople();
    const q = query.toLowerCase();
    return people.filter(p => p.normalized_name.includes(q));
}

export async function getPendingSettlements() {
    const res = await fetch(`${API_BASE}/settlements`);
    return await res.json();
}

export async function getAllSettlements() {
    const res = await fetch(`${API_BASE}/settlements/all`);
    return await res.json();
}

export async function addExpense(expenseData, isSplit, participantIds) {
    const res = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: expenseData.amount.toString(),
            description: expenseData.description,
            category: expenseData.category,
            date: expenseData.date,
            is_split: isSplit,
            participant_ids: participantIds
        })
    });
    return await res.json();
}

export async function settleSplitEntry(entryId) {
    const res = await fetch(`${API_BASE}/settlements/${entryId}/settle`, {
        method: 'POST'
    });
    return await res.json();
}

export async function parseSms(text) {
    const res = await fetch(`${API_BASE}/parse-sms`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    });
    return await res.json();
}
