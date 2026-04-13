import { getExpenses, getPendingSettlements, getAllSettlements } from '../models/schema.js';

export async function renderDashboard() {
    const expenses = await getExpenses();
    const pendingSettlements = await getPendingSettlements();
    const allSettlements = await getAllSettlements();

    // Calculate totals
    const totalSpentMinor = expenses.reduce((sum, e) => sum + e.amount_minor, 0);
    const totalSpent = (totalSpentMinor / 100).toFixed(2);

    // Total already settled (received from others)
    const totalSettledMinor = allSettlements.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
    const netExpense = ((totalSpentMinor - totalSettledMinor) / 100).toFixed(2);

    const totalToGetMinor = pendingSettlements.reduce((sum, s) => sum + s.to_get, 0);
    const totalToGet = (totalToGetMinor / 100).toFixed(2);

    // Get recent 5 expenses
    const recentExpensesHtml = expenses.slice(0, 5).map(e => `
        <div class="expense-item">
            <div class="expense-icon">
                <i class="fa-solid ${getCategoryIcon(e.category)}"></i>
            </div>
            <div class="expense-details">
                <div class="expense-title">${e.description || e.category}</div>
                <div class="expense-date">${formatDate(e.date_time)}</div>
            </div>
            <div class="expense-amount">${formatAmount(e.amount_minor, e.currency)}</div>
        </div>
    `).join('') || '<div class="empty-state"><p>No recent expenses.</p></div>';

    return `
        <div class="dashboard-grid">
            <!-- Metrics -->
            <div class="card metric-card">
                <div class="metric-label">Total Spent</div>
                <div class="metric-value">${formatCurrency(totalSpent)}</div>
            </div>
            <div class="card metric-card">
                <div class="metric-label">Net Expense</div>
                <div class="metric-value danger">${formatCurrency(netExpense)}</div>
            </div>
            <div class="card metric-card">
                <div class="metric-label">To Collect</div>
                <div class="metric-value success">${formatCurrency(totalToGet)}</div>
            </div>

            <!-- Chart Section -->
            <div class="card section-card chart-container-card">
                <h3>Spending Trend</h3>
                <div style="height: 300px; width: 100%;">
                    <canvas id="spendingChart"></canvas>
                </div>
            </div>

            <!-- Recent Expenses -->
            <div class="card section-card">
                <div class="flex-between" style="margin-bottom: 24px;">
                    <h3>Recent Activity</h3>
                </div>
                <div class="expense-list">
                    ${recentExpensesHtml}
                </div>
            </div>
        </div>
    `;
}

export function attachDashboardEvents(expenses) {
    const ctx = document.getElementById('spendingChart');
    if (!ctx) return;

    // Process data for Chart.js
    // Group by date and sum amounts
    const dailyData = {};
    expenses.forEach(e => {
        const date = new Date(e.date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyData[date] = (dailyData[date] || 0) + (e.amount_minor / 100);
    });

    // Sort dates
    const labels = Object.keys(dailyData).reverse().slice(-7); // Last 7 days with data
    const data = labels.map(label => dailyData[label]);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Spending',
                data: data,
                borderColor: '#000000',
                backgroundColor: 'rgba(0,0,0,0.05)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#000000',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        font: { family: 'DM Mono', size: 10 },
                        callback: (value) => '$' + value
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'DM Mono', size: 10 } }
                }
            }
        }
    });
}

// Utility for icon mapping
function getCategoryIcon(category) {
    const map = {
        'Food': 'fa-burger',
        'Transport': 'fa-car',
        'Utilities': 'fa-bolt',
        'Entertainment': 'fa-film',
        'Shopping': 'fa-bag-shopping',
        'Health': 'fa-heart-pulse',
        'Transfer': 'fa-arrow-right-arrow-left',
        'Other': 'fa-receipt'
    };
    return map[category] || 'fa-receipt';
}

function formatAmount(amountMinor, currency = 'USD') {
    const amount = amountMinor / 100;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}
