/**
 * Interactive Quick-Start Tutorial System
 * Guides new users through first-time setup with step-by-step overlays
 */

class InteractiveTutorial {
    constructor() {
        this.currentStep = 0;
        this.steps = [];
        this.isActive = false;
        this.overlay = null;
        this.tooltipElement = null;
        this.storageKey = 'xyloclime_tutorial_completed';

        this.initializeTutorialSteps();
    }

    initializeTutorialSteps() {
        this.steps = [
            {
                title: 'Welcome to Xyloclime Pro! 🎯',
                message: 'Let\'s take a quick 60-second tour to help you create your first weather analysis project. You can skip this anytime by clicking "Skip Tutorial".',
                target: null, // Full-screen welcome
                position: 'center',
                action: null,
                highlight: false
            },
            {
                title: 'Step 1: Choose a Project Template',
                message: 'Select a pre-configured template that matches your construction type. Each template has industry-specific weather criteria already optimized for you.',
                target: '#templateSelector',
                position: 'bottom',
                action: () => {
                    // Scroll template selector into view
                    document.getElementById('templateSelector')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                },
                highlight: true,
                highlightPulse: true
            },
            {
                title: 'Step 2: Name Your Project',
                message: 'Give your project a descriptive name like "Downtown Office Complex - Phase 1" or "Highway 101 Resurfacing".',
                target: '#projectName',
                position: 'bottom',
                action: () => {
                    document.getElementById('projectName')?.focus();
                },
                highlight: true
            },
            {
                title: 'Step 3: Select Project Location',
                message: 'Search for your project location by city, state, or ZIP code. You can also click directly on the map to set the location.',
                target: '#locationSearch',
                position: 'bottom',
                action: () => {
                    document.getElementById('locationSearch')?.focus();
                },
                highlight: true,
                highlightPulse: true
            },
            {
                title: 'Step 4: Set Project Dates',
                message: 'Choose your project start and end dates. Xyloclime will analyze historical weather patterns for this period to predict conditions.',
                target: '#startDate',
                position: 'bottom',
                action: () => {
                    document.getElementById('startDate')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                },
                highlight: true
            },
            {
                title: 'Step 5: Analyze Weather Data',
                message: 'Click "Analyze Weather" to generate your comprehensive weather analysis with workable days, risk scores, and smart recommendations.',
                target: '#analyzeBtn',
                position: 'top',
                action: null,
                highlight: true,
                highlightPulse: true
            },
            {
                title: 'Understanding Your Results 📊',
                message: 'Once analysis completes, you\'ll see workable vs non-workable days, risk scores (Low/Medium/High), weather charts, and AI-powered recommendations for your specific project type.',
                target: null,
                position: 'center',
                action: null,
                highlight: false
            },
            {
                title: 'Pro Tips 💡',
                message: 'Export to Excel or PDF for bid packages • Save projects for later comparison • Use templates to save time • Check smart recommendations for actionable insights',
                target: null,
                position: 'center',
                action: null,
                highlight: false
            },
            {
                title: 'You\'re All Set! ✅',
                message: 'You\'re ready to create your first weather analysis. If you need help later, click the "Help" button in the top navigation. Happy analyzing!',
                target: null,
                position: 'center',
                action: null,
                highlight: false
            }
        ];
    }

    shouldShowTutorial() {
        // Check if user has completed tutorial before
        const completed = localStorage.getItem(this.storageKey);
        return !completed;
    }

    start() {
        if (this.isActive) return;

        this.isActive = true;
        this.currentStep = 0;
        this.createOverlay();
        this.showStep(0);
    }

    createOverlay() {
        // Create dark overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'tutorial-overlay';
        this.overlay.innerHTML = `
            <div class="tutorial-spotlight"></div>
        `;
        document.body.appendChild(this.overlay);

        // Create tooltip container
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'tutorial-tooltip';
        document.body.appendChild(this.tooltipElement);
    }

    showStep(stepIndex) {
        if (stepIndex >= this.steps.length) {
            this.complete();
            return;
        }

        const step = this.steps[stepIndex];
        this.currentStep = stepIndex;

        // Execute step action if any
        if (step.action) {
            setTimeout(() => step.action(), 100);
        }

        // Update tooltip content
        this.tooltipElement.innerHTML = `
            <div class="tutorial-tooltip-header">
                <span class="tutorial-progress">${stepIndex + 1}/${this.steps.length}</span>
                <button class="tutorial-close" id="tutorialClose">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="tutorial-tooltip-content">
                <h3>${step.title}</h3>
                <p>${step.message}</p>
            </div>
            <div class="tutorial-tooltip-footer">
                <button class="tutorial-btn tutorial-btn-secondary" id="tutorialSkip">
                    Skip Tutorial
                </button>
                <div class="tutorial-nav-buttons">
                    ${stepIndex > 0 ? '<button class="tutorial-btn tutorial-btn-ghost" id="tutorialPrev"><i class="fas fa-chevron-left"></i> Back</button>' : ''}
                    <button class="tutorial-btn tutorial-btn-primary" id="tutorialNext">
                        ${stepIndex === this.steps.length - 1 ? 'Finish' : 'Next'}
                        ${stepIndex === this.steps.length - 1 ? '<i class="fas fa-check"></i>' : '<i class="fas fa-chevron-right"></i>'}
                    </button>
                </div>
            </div>
        `;

        // Position tooltip and highlight
        this.positionTooltip(step);
        this.highlightElement(step);

        // Attach event listeners
        this.attachStepEventListeners();
    }

    positionTooltip(step) {
        if (!step.target) {
            // Center position for full-screen messages
            this.tooltipElement.classList.remove('position-top', 'position-bottom', 'position-left', 'position-right');
            this.tooltipElement.classList.add('position-center');
            this.tooltipElement.style.top = '50%';
            this.tooltipElement.style.left = '50%';
            this.tooltipElement.style.transform = 'translate(-50%, -50%)';
            return;
        }

        const targetElement = document.querySelector(step.target);
        if (!targetElement) {
            console.warn(`Tutorial target not found: ${step.target}`);
            return;
        }

        const targetRect = targetElement.getBoundingClientRect();
        const tooltipRect = this.tooltipElement.getBoundingClientRect();

        this.tooltipElement.classList.remove('position-center', 'position-top', 'position-bottom', 'position-left', 'position-right');

        switch (step.position) {
            case 'top':
                this.tooltipElement.classList.add('position-top');
                this.tooltipElement.style.top = `${targetRect.top - tooltipRect.height - 20}px`;
                this.tooltipElement.style.left = `${targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2)}px`;
                this.tooltipElement.style.transform = 'none';
                break;
            case 'bottom':
                this.tooltipElement.classList.add('position-bottom');
                this.tooltipElement.style.top = `${targetRect.bottom + 20}px`;
                this.tooltipElement.style.left = `${targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2)}px`;
                this.tooltipElement.style.transform = 'none';
                break;
            case 'left':
                this.tooltipElement.classList.add('position-left');
                this.tooltipElement.style.top = `${targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2)}px`;
                this.tooltipElement.style.left = `${targetRect.left - tooltipRect.width - 20}px`;
                this.tooltipElement.style.transform = 'none';
                break;
            case 'right':
                this.tooltipElement.classList.add('position-right');
                this.tooltipElement.style.top = `${targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2)}px`;
                this.tooltipElement.style.left = `${targetRect.right + 20}px`;
                this.tooltipElement.style.transform = 'none';
                break;
        }

        // Ensure tooltip stays within viewport
        this.constrainToViewport();
    }

    constrainToViewport() {
        const rect = this.tooltipElement.getBoundingClientRect();
        const padding = 20;

        if (rect.right > window.innerWidth - padding) {
            this.tooltipElement.style.left = `${window.innerWidth - rect.width - padding}px`;
        }
        if (rect.left < padding) {
            this.tooltipElement.style.left = `${padding}px`;
        }
        if (rect.bottom > window.innerHeight - padding) {
            this.tooltipElement.style.top = `${window.innerHeight - rect.height - padding}px`;
        }
        if (rect.top < padding) {
            this.tooltipElement.style.top = `${padding}px`;
        }
    }

    highlightElement(step) {
        // Remove previous highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight', 'tutorial-highlight-pulse');
        });

        if (!step.highlight || !step.target) {
            this.overlay.classList.remove('has-spotlight');
            return;
        }

        const targetElement = document.querySelector(step.target);
        if (!targetElement) return;

        targetElement.classList.add('tutorial-highlight');
        if (step.highlightPulse) {
            targetElement.classList.add('tutorial-highlight-pulse');
        }

        // Update spotlight position
        const targetRect = targetElement.getBoundingClientRect();
        const spotlight = this.overlay.querySelector('.tutorial-spotlight');

        this.overlay.classList.add('has-spotlight');
        spotlight.style.top = `${targetRect.top - 10}px`;
        spotlight.style.left = `${targetRect.left - 10}px`;
        spotlight.style.width = `${targetRect.width + 20}px`;
        spotlight.style.height = `${targetRect.height + 20}px`;
    }

    attachStepEventListeners() {
        // Next button
        const nextBtn = document.getElementById('tutorialNext');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.next());
        }

        // Previous button
        const prevBtn = document.getElementById('tutorialPrev');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previous());
        }

        // Skip button
        const skipBtn = document.getElementById('tutorialSkip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skip());
        }

        // Close button
        const closeBtn = document.getElementById('tutorialClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.skip());
        }

        // Keyboard navigation
        this.keyboardHandler = (e) => {
            if (e.key === 'Escape') {
                this.skip();
            } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                this.next();
            } else if (e.key === 'ArrowLeft') {
                this.previous();
            }
        };
        document.addEventListener('keydown', this.keyboardHandler);
    }

    next() {
        this.showStep(this.currentStep + 1);
    }

    previous() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    skip() {
        if (confirm('Are you sure you want to skip the tutorial? You can restart it anytime from the Help menu.')) {
            this.cleanup();
        }
    }

    complete() {
        // Mark tutorial as completed
        localStorage.setItem(this.storageKey, 'true');

        // Show completion message
        if (window.toastManager) {
            window.toastManager.success('Tutorial completed! You\'re ready to start analyzing weather data.', 'Welcome Aboard!', 5000);
        }

        this.cleanup();
    }

    cleanup() {
        // Remove highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight', 'tutorial-highlight-pulse');
        });

        // Remove overlay and tooltip
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.tooltipElement) {
            this.tooltipElement.remove();
            this.tooltipElement = null;
        }

        // Remove keyboard listener
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }

        this.isActive = false;
        this.currentStep = 0;
    }

    restart() {
        this.cleanup();
        localStorage.removeItem(this.storageKey);
        this.start();
    }
}

// Initialize tutorial manager globally
window.tutorialManager = new InteractiveTutorial();

// Auto-start tutorial for new users after page load
document.addEventListener('DOMContentLoaded', () => {
    // Wait 1 second after page load to start tutorial
    setTimeout(() => {
        if (window.tutorialManager.shouldShowTutorial()) {
            window.tutorialManager.start();
        }
    }, 1000);
});
