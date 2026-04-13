/**
 * Utility functions for Toasts and Modals
 */

// Toast Utility
export function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, duration);
}

// Modal Utility
export function showModal(contentHtml) {
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    
    if (!modalContainer || !modalContent) return;

    modalContent.innerHTML = contentHtml;
    modalContainer.classList.add('active');

    // Close logic
    const closeBtn = modalContent.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideModal);
    }

    // Close on backdrop click
    const backdrop = modalContainer.querySelector('.modal-backdrop');
    backdrop.onclick = hideModal;
}

export function hideModal() {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.classList.remove('active');
    }
}
