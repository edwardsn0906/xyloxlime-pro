/**
 * XYLOCLIME PRO - UX ENHANCEMENTS
 * Modern notification system and improved user interactions
 */

// ============================================================================
// TOAST NOTIFICATION SYSTEM
// Replaces jarring alerts with smooth, modern notifications
// ============================================================================

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.init();
    }

    init() {
        // Get or create toast container
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = 5000, title = null) {
        const toast = this.createToast(message, type, title);
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => this.dismiss(toast), duration);
        }

        return toast;
    }

    createToast(message, type, title) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const titles = {
            success: title || 'Success',
            error: title || 'Error',
            warning: title || 'Warning',
            info: title || 'Info'
        };

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${titles[type]}</div>
                <div class="toast-message">${this.escapeHTML(message)}</div>
            </div>
            <button class="toast-close" aria-label="Close notification">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Close button handler
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.dismiss(toast);
        });

        return toast;
    }

    dismiss(toast) {
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Convenience methods
    success(message, title = null, duration = 4000) {
        return this.show(message, 'success', duration, title);
    }

    error(message, title = null, duration = 6000) {
        return this.show(message, 'error', duration, title);
    }

    warning(message, title = null, duration = 5000) {
        return this.show(message, 'warning', duration, title);
    }

    info(message, title = null, duration = 4000) {
        return this.show(message, 'info', duration, title);
    }

    clearAll() {
        this.toasts.forEach(toast => this.dismiss(toast));
    }
}

// Create global toast instance
window.toastManager = new ToastManager();

// ============================================================================
// FORM VALIDATION HELPERS
// Inline validation with visual feedback
// ============================================================================

class FormValidator {
    static validateField(fieldId, validationFn, errorMessage) {
        const field = document.getElementById(fieldId);
        if (!field) return false;

        const formGroup = field.closest('.form-group');
        if (!formGroup) return false;

        const value = field.value.trim();
        const isValid = validationFn(value);

        // Remove existing validation states
        formGroup.classList.remove('has-error', 'has-success');

        // Remove existing error message if present
        const existingError = formGroup.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        if (!isValid && value.length > 0) {
            formGroup.classList.add('has-error');

            // Add error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errorMessage}`;
            field.parentNode.appendChild(errorDiv);
        } else if (isValid && value.length > 0) {
            formGroup.classList.add('has-success');
        }

        return isValid;
    }

    static clearValidation(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        const formGroup = field.closest('.form-group');
        if (!formGroup) return;

        formGroup.classList.remove('has-error', 'has-success');

        const errorDiv = formGroup.querySelector('.field-error');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    static validateProjectName(name) {
        return name.length >= 3 && name.length <= 100;
    }

    static validateDateRange(startDate, endDate) {
        if (!startDate || !endDate) return false;

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return false;
        }

        if (end <= start) {
            return false;
        }

        // Check if date range is reasonable (not more than 10 years)
        const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
        if (daysDiff > 3650) {
            return false;
        }

        return true;
    }
}

// ============================================================================
// LOADING INDICATORS
// Better visual feedback during async operations
// ============================================================================

class LoadingManager {
    static showProgress() {
        let progress = document.querySelector('.loading-progress');
        if (!progress) {
            progress = document.createElement('div');
            progress.className = 'loading-progress';
            progress.innerHTML = '<div class="loading-progress-bar"></div>';
            document.body.appendChild(progress);
        }

        progress.classList.add('active');

        const bar = progress.querySelector('.loading-progress-bar');
        if (!bar) {
            console.error('[LoadingManager] Could not find .loading-progress-bar element');
            return null;
        }

        bar.style.width = '0%';

        // Simulate progress
        let width = 0;
        const interval = setInterval(() => {
            width += Math.random() * 15;
            if (width >= 90) {
                clearInterval(interval);
                width = 90;
            }
            if (bar) {
                bar.style.width = width + '%';
            }
        }, 200);

        return interval;
    }

    static hideProgress(interval) {
        if (interval) {
            clearInterval(interval);
        }

        const progress = document.querySelector('.loading-progress');
        if (progress) {
            const bar = progress.querySelector('.loading-progress-bar');
            if (bar) {
                bar.style.width = '100%';

                setTimeout(() => {
                    progress.classList.remove('active');
                    setTimeout(() => {
                        if (bar) {
                            bar.style.width = '0%';
                        }
                    }, 300);
                }, 200);
            }
        }
    }

    static setButtonLoading(buttonId, isLoading = true) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (isLoading) {
            button.classList.add('btn-loading');
            button.disabled = true;

            // Store original text if not already stored
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.innerHTML;
            }

            // Wrap existing content
            button.innerHTML = `<span class="btn-text">${button.dataset.originalText}</span>`;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;

            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
        }
    }
}

// ============================================================================
// EMPTY STATE HELPERS
// Guide users when no data exists
// ============================================================================

class EmptyStateManager {
    static show(containerId, config = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const defaults = {
            icon: 'fa-folder-open',
            title: 'No items yet',
            message: 'Get started by creating your first item',
            actionText: 'Create New',
            actionCallback: null
        };

        const settings = { ...defaults, ...config };

        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state fade-in';
        emptyState.innerHTML = `
            <div class="empty-state-icon">
                <i class="fas ${settings.icon}"></i>
            </div>
            <div class="empty-state-title">${settings.title}</div>
            <div class="empty-state-message">${settings.message}</div>
            ${settings.actionText && settings.actionCallback ? `
                <button class="empty-state-action">
                    <i class="fas fa-plus"></i>
                    ${settings.actionText}
                </button>
            ` : ''}
        `;

        if (settings.actionCallback) {
            const button = emptyState.querySelector('.empty-state-action');
            button.addEventListener('click', settings.actionCallback);
        }

        container.innerHTML = '';
        container.appendChild(emptyState);
    }

    static hide(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
    }
}

// ============================================================================
// KEYBOARD SHORTCUTS
// Improve power user experience
// ============================================================================

class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const key = this.getKeyCombo(e);
            const handler = this.shortcuts.get(key);

            if (handler) {
                e.preventDefault();
                handler(e);
            }
        });
    }

    getKeyCombo(e) {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');
        parts.push(e.key.toLowerCase());
        return parts.join('+');
    }

    register(keyCombo, handler, description = '') {
        this.shortcuts.set(keyCombo, handler);
        console.log(`[SHORTCUTS] Registered: ${keyCombo} - ${description}`);
    }

    unregister(keyCombo) {
        this.shortcuts.delete(keyCombo);
    }
}

// Create global keyboard shortcuts instance
window.keyboardShortcuts = new KeyboardShortcuts();

// ============================================================================
// UTILITY FUNCTIONS
// Helper functions for better UX
// ============================================================================

const UXUtils = {
    /**
     * Debounce function calls for better performance
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Copy text to clipboard with feedback
     */
    async copyToClipboard(text, successMessage = 'Copied to clipboard!') {
        try {
            await navigator.clipboard.writeText(text);
            window.toastManager.success(successMessage);
            return true;
        } catch (err) {
            window.toastManager.error('Failed to copy to clipboard');
            return false;
        }
    },

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Smooth scroll to element
     */
    scrollToElement(elementId, offset = 0) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const y = element.getBoundingClientRect().top + window.pageYOffset + offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
};

// Make utilities globally available
window.UXUtils = UXUtils;
window.FormValidator = FormValidator;
window.LoadingManager = LoadingManager;
window.EmptyStateManager = EmptyStateManager;

console.log('[UX] Enhanced UX features loaded successfully');
