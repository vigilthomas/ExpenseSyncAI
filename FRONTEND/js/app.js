import { renderDashboard, attachDashboardEvents } from './views/Dashboard.js';
import { renderAddExpense, attachAddExpenseEvents } from './views/AddExpense.js';
import { renderSettlements, attachSettlementsEvents } from './views/Settlements.js';
import { showModal } from './utils.js';
import { getExpenses } from './models/schema.js';

const viewContainer = document.getElementById('view-container');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('sidebar-overlay');
const mobileToggle = document.getElementById('mobile-menu-toggle');
const notificationBtn = document.querySelector('.icon-btn[title="Notifications"]');

function toggleMobileSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

if (mobileToggle) {
    mobileToggle.addEventListener('click', toggleMobileSidebar);
}

if (overlay) {
    overlay.addEventListener('click', toggleMobileSidebar);
}

if (notificationBtn) {
    notificationBtn.addEventListener('click', () => {
        showModal(`
            <div class="modal-header">
                <h3 class="modal-title">Help & Info</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px;">Welcome to <strong>ExpenSync AI</strong>. Here's how to use the app:</p>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin-bottom: 12px; display: flex; gap: 12px;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent-primary);"></i>
                        <span>Paste a bank SMS in <strong>Add Expense</strong> to auto-fill details.</span>
                    </li>
                    <li style="margin-bottom: 12px; display: flex; gap: 12px;">
                        <i class="fa-solid fa-users" style="color: var(--accent-primary);"></i>
                        <span>Use <strong>Split Expense</strong> to divide bills with friends.</span>
                    </li>
                    <li style="margin-bottom: 12px; display: flex; gap: 12px;">
                        <i class="fa-solid fa-handshake" style="color: var(--accent-primary);"></i>
                        <span>Track pending repayments in the <strong>Settlements</strong> view.</span>
                    </li>
                </ul>
                <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-light); text-align: center;">
                    <p style="font-size: 12px; color: var(--text-tertiary);">Version 1.0.0 • Local-First</p>
                </div>
            </div>
        `);
    });
}

async function navigateTo(viewName) {
    // Update active nav
    navItems.forEach(nav => {
        nav.classList.remove('active');
        if (nav.getAttribute('data-view') === viewName) {
            nav.classList.add('active');
        }
    });

    // Close sidebar on mobile after navigation
    if (sidebar.classList.contains('active')) {
        toggleMobileSidebar();
    }

    // Render View
    if (viewName === 'dashboard') {
        pageTitle.innerText = 'Dashboard';
        viewContainer.innerHTML = await renderDashboard();
        const expenses = await getExpenses();
        attachDashboardEvents(expenses);
    } 
    else if (viewName === 'add-expense') {
        pageTitle.innerText = 'Add Expense';
        viewContainer.innerHTML = await renderAddExpense();
        await attachAddExpenseEvents(navigateTo);
    }
    else if (viewName === 'settlements') {
        pageTitle.innerText = 'Settlements';
        viewContainer.innerHTML = await renderSettlements();
        await attachSettlementsEvents();
    }

    // Trigger re-animation
    viewContainer.style.animation = 'none';
    viewContainer.offsetHeight; /* trigger reflow */
    viewContainer.style.animation = null; 
}

// Attach nav handlers
navItems.forEach(nav => {
    nav.addEventListener('click', async (e) => {
        e.preventDefault();
        const view = e.currentTarget.getAttribute('data-view');
        await navigateTo(view);
    });
});

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    navigateTo('dashboard');
});
