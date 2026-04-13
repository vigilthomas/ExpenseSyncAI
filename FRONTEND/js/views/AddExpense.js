import { addExpense, getPeople, parseSms } from '../models/schema.js';
import { showToast } from '../utils.js';

export async function renderAddExpense() {
    return `
        <div class="card view-card" style="max-width: 640px;">
            <h2 style="margin-bottom: 8px; font-weight: 600; font-size: 22px;">New Expense</h2>
            <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 32px;">Add manually or parse from SMS</p>

            <!-- SMS Parse Section -->
            <div class="sms-parse-box">
                <label style="color: var(--text-primary); font-size: 13px; font-weight: 600; margin-bottom: 10px; display: block;">
                    <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent-primary); margin-right: 6px;"></i>
                    Parse from SMS
                </label>
                <div class="sms-input-group">
                    <input type="text" id="sms-input" class="form-control" placeholder="Paste bank SMS here..." style="flex: 1;">
                    <button type="button" id="btn-parse-sms" class="btn btn-primary">Parse</button>
                </div>
                <small id="parse-status" style="display: block; margin-top: 10px; color: var(--text-tertiary); font-size: 12px; font-family: var(--font-body);"></small>
            </div>

            <form id="add-expense-form">
                <div class="form-row">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label>Amount</label>
                        <input type="number" id="exp-amount" class="form-control" step="0.01" min="0.01" placeholder="0.00" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label>Date</label>
                        <input type="date" id="exp-date" class="form-control" required>
                    </div>
                </div>

                <div class="form-group">
                    <label>Description</label>
                    <input type="text" id="exp-desc" class="form-control" placeholder="e.g., Dinner at Mario's" required>
                </div>

                <div class="form-group">
                    <label>Category</label>
                    <select id="exp-category" class="form-control" required>
                        <option value="Food">Food & Dining</option>
                        <option value="Transport">Transportation</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Health">Health</option>
                        <option value="Transfer">Transfer</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div class="split-card">
                    <div class="flex-between" style="margin-bottom: 16px;">
                        <div>
                            <label style="margin: 0; color: var(--text-primary); font-size: 14px;">Split Expense</label>
                            <p style="color: var(--text-tertiary); font-size: 12px; margin: 4px 0 0 0;">Divide equally with others</p>
                        </div>
                        <label class="switch">
                            <input type="checkbox" id="split-toggle">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div id="split-section" style="display: none; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-light);">
                        <label style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; display: block;">Select Participants</label>
                        <div id="participants-list" class="flex-column gap-16"></div>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px;">
                    <i class="fa-solid fa-check"></i> Save Expense
                </button>
            </form>
        </div>
    `;
}

export async function attachAddExpenseEvents(navigateCallback) {
    document.getElementById('exp-date').valueAsDate = new Date();

    const splitToggle = document.getElementById('split-toggle');
    const splitSection = document.getElementById('split-section');
    const participantsList = document.getElementById('participants-list');
    const parseBtn = document.getElementById('btn-parse-sms');
    const smsInput = document.getElementById('sms-input');
    const parseStatus = document.getElementById('parse-status');

    // Load people checkboxes
    const people = await getPeople();
    let peopleHtml = people
        .filter(p => p.normalized_name !== 'vigil')
        .map(p => `
        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--border-light); transition: var(--transition-fast);">
            <input type="checkbox" name="participants" value="${p.id}" style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
            <div class="avatar" style="width: 32px; height: 32px; font-size: 12px;">${p.name.charAt(0)}</div>
            <span style="font-size: 14px; font-weight: 500;">${p.name}</span>
        </label>
    `).join('');
    participantsList.innerHTML = peopleHtml || '<p style="color: var(--text-tertiary); font-size: 14px;">No other people in database.</p>';

    splitToggle.addEventListener('change', (e) => {
        splitSection.style.display = e.target.checked ? 'block' : 'none';
        splitSection.style.animation = 'fadeIn 0.2s ease';
    });

    parseBtn.addEventListener('click', async () => {
        const text = smsInput.value.trim();
        if (!text) return;

        parseBtn.disabled = true;
        parseBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Parsing...';
        parseStatus.innerText = "Analyzing SMS with AI...";
        parseStatus.style.color = "var(--text-tertiary)";

        try {
            const data = await parseSms(text);
            if (data.error) {
                parseStatus.innerText = "Error: " + data.error;
                parseStatus.style.color = "var(--accent-red)";
            } else {
                parseStatus.innerText = "Successfully parsed!";
                parseStatus.style.color = "var(--accent-primary)";

                if (data.amount_minor) {
                    document.getElementById('exp-amount').value = (data.amount_minor / 100).toFixed(2);
                }
                if (data.merchant) {
                    document.getElementById('exp-desc').value = data.merchant;
                }
                if (data.category && data.category !== 'Other') {
                    document.getElementById('exp-category').value = data.category;
                }
                if (data.date_time) {
                    const dt = new Date(data.date_time);
                    if (!isNaN(dt)) {
                        document.getElementById('exp-date').valueAsDate = dt;
                    }
                }
            }
        } catch (e) {
            parseStatus.innerText = "Failed to connect to backend.";
            parseStatus.style.color = "var(--accent-red)";
        }

        parseBtn.disabled = false;
        parseBtn.innerHTML = '<i class="fa-solid fa-check"></i> Parse';
    });

    document.getElementById('add-expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const isSplit = splitToggle.checked;
        const participantIds = Array.from(document.querySelectorAll('input[name="participants"]:checked')).map(cb => cb.value);

        if (isSplit && participantIds.length === 0) {
            alert('Please select at least one participant for the split.');
            return;
        }

        const data = {
            amount: document.getElementById('exp-amount').value,
            description: document.getElementById('exp-desc').value,
            category: document.getElementById('exp-category').value,
            date: document.getElementById('exp-date').value
        };

        const submitBtn = document.querySelector('#add-expense-form button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        await addExpense(data, isSplit, participantIds);
        showToast('Expense saved successfully!');
        navigateCallback('dashboard');
    });
}
