import { getPendingSettlements, settleSplitEntry } from '../models/schema.js';
import { showToast } from '../utils.js';

export async function renderSettlements() {
    return `
        <div class="card view-card">
            <h2 style="margin-bottom: 8px; font-weight: 600; font-size: 22px;">Settlements</h2>
            <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 32px;">Track and settle shared expenses</p>
            <div id="settlements-list" class="flex-column gap-16">
                <!-- Injected via JS -->
            </div>
        </div>
    `;
}

export async function attachSettlementsEvents() {
    const listContainer = document.getElementById('settlements-list');

    async function loadList() {
        const settlements = await getPendingSettlements();

        if (settlements.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state" style="padding: 64px 24px;">
                    <i class="fa-regular fa-face-smile"></i>
                    <p style="margin-top: 16px;">All settled up! No pending settlements.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = settlements.map(s => {
            const amountToGet = (s.to_get / 100).toFixed(2);
            return `
                <div class="settlement-item">
                    <div class="settlement-info">
                        <div class="avatar" style="width: 48px; height: 48px; font-size: 16px;">${s.person.name.charAt(0)}</div>
                        <div>
                            <div class="expense-title" style="font-size: 15px;">${s.person.name}</div>
                            <div class="expense-date">for ${s.expense.description || s.expense.category}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div class="settlement-amount">${formatAmount(amountToGet)}</div>
                        <button class="btn btn-primary settle-btn" data-id="${s.id}" style="padding: 10px 20px; font-size: 13px;">
                            Mark as Paid
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach buttons
        document.querySelectorAll('.settle-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const originalText = e.currentTarget.innerText;
                e.currentTarget.innerText = "Processing...";
                e.currentTarget.disabled = true;

                await settleSplitEntry(id);
                showToast('Settlement marked as paid!');
                await loadList();
            });
        });
    }

    await loadList();
}

function formatAmount(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}
