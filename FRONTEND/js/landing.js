/**
 * ExpenseAI Landing Page Interactions
 * Scroll animations, parallax, and micro-interactions
 */

// --- Navbar Scroll Effect ---
const navbar = document.querySelector('.navbar');

const handleScroll = () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
};

window.addEventListener('scroll', handleScroll, { passive: true });

// --- Scroll Reveal Animations ---
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe all sections and cards
document.querySelectorAll('.section-header, .bento-card, .workflow-step, .demo-container').forEach(el => {
    el.classList.add('fade-in');
    revealObserver.observe(el);
});

// --- Parallax Effect for Hero Terminal ---
const heroTerminal = document.querySelector('.hero-terminal');

if (heroTerminal) {
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const maxScroll = window.innerHeight * 0.5;

        if (scrolled < maxScroll) {
            const translateY = scrolled * 0.3;
            const rotate = scrolled * 0.02;
            heroTerminal.style.transform = `translateY(${translateY}px) rotate(${rotate}deg)`;
        }
    }, { passive: true });
}

// --- Counter Animation for Stats ---
const animateCounter = (element, target, suffix = '') => {
    const duration = 2000;
    const start = 0;
    const startTime = performance.now();

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const updateCounter = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutQuart(progress);

        const current = start + (target - start) * easedProgress;

        if (target < 1) {
            element.textContent = current.toFixed(2) + suffix;
        } else {
            element.textContent = Math.floor(current) + suffix;
        }

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    };

    requestAnimationFrame(updateCounter);
};

// Trigger counter animation when stats are visible
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statValues = entry.target.querySelectorAll('.stat-value');

            statValues.forEach(stat => {
                const text = stat.textContent;
                const num = parseFloat(text);
                const suffix = text.replace(/[\d.]/g, '');

                if (!isNaN(num)) {
                    animateCounter(stat, num, suffix);
                }
            });

            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    statsObserver.observe(heroStats);
}

// --- Mobile Navigation Toggle ---
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
}

// --- Smooth Scroll for Anchor Links ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');

        if (href !== '#' && href.length > 1) {
            const target = document.querySelector(href);

            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

                // Close mobile menu if open
                navLinks?.classList.remove('active');
                navToggle?.classList.remove('active');
            }
        }
    });
});

// --- Hover Tilt Effect for Bento Cards ---
const bentoCards = document.querySelectorAll('.bento-card');

bentoCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
});

// --- Typing Effect for Terminal (Optional Enhancement) ---
const terminalBody = document.querySelector('.terminal-body pre');
const codeLines = [
    { text: 'parsing incoming SMS...', delay: 500 },
    { text: '✓ Amount: ₹2,450.00', delay: 800 },
    { text: '✓ Merchant: Uber India', delay: 600 },
    { text: '✓ Category: Transport', delay: 400 },
    { text: '✓ Date: 2026-04-12', delay: 400 },
    { text: 'expense saved to db.json', delay: 600 }
];

let typeComplete = false;

const typeInTerminal = async () => {
    if (typeComplete || !terminalBody) return;

    terminalBody.innerHTML = '';

    for (const line of codeLines) {
        await new Promise(resolve => setTimeout(resolve, line.delay));

        const span = document.createElement('span');
        span.className = 'code-line';

        if (line.text.startsWith('✓')) {
            span.innerHTML = `<span class="code-success">✓</span> ${line.text.substring(2)}`;
        } else if (line.text.includes('parsing') || line.text.includes('saved')) {
            span.innerHTML = `<span class="code-prompt">$</span> ${line.text}`;
        }

        terminalBody.appendChild(span);
    }

    // Add cursor
    const cursor = document.createElement('span');
    cursor.className = 'code-line code-cursor';
    cursor.textContent = '_';
    terminalBody.appendChild(cursor);

    typeComplete = true;
};

// Trigger typing when terminal is visible
const terminalObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !typeComplete) {
            setTimeout(typeInTerminal, 500);
            terminalObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

if (heroTerminal) {
    terminalObserver.observe(heroTerminal);
}

// --- Floating Cards Parallax in Demo Section ---
const floatingCards = document.querySelectorAll('.floating-card');
const demoSection = document.querySelector('.demo');

if (demoSection) {
    window.addEventListener('scroll', () => {
        const rect = demoSection.getBoundingClientRect();
        const scrollProgress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);

        if (scrollProgress > 0 && scrollProgress < 1) {
            floatingCards.forEach((card, index) => {
                const offset = Math.sin(scrollProgress * Math.PI + index) * 20;
                card.style.transform = `translateY(${offset}px)`;
            });
        }
    }, { passive: true });
}

// --- Console Easter Egg ---
console.log('%c ExpenseAI ', 'background: #00ff87; color: #0a0a0f; font-size: 20px; font-weight: bold; padding: 10px 20px;');
console.log('%c Built with vanilla HTML, CSS, JS — zero dependencies ', 'color: #a0a0b0; font-size: 12px;');
console.log('%c Ready to track expenses like a hacker? Launch the dashboard! ', 'color: #00ff87; font-size: 14px;');
