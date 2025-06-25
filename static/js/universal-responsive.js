/**
 * Simple Responsive JavaScript - Basic functionality only
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeSearchSystem();
    initializePaginationSystem();
    initializeResponsiveHelpers();
});

/**
 * Enhanced Search System
 */
function initializeSearchSystem() {
    const filterToggle = document.getElementById('filterToggle');
    const filtersPanel = document.getElementById('filtersPanel');

    // Filter Toggle
    if (filterToggle && filtersPanel) {
        filterToggle.addEventListener('click', function() {
            const isVisible = filtersPanel.style.display === 'block';
            
            if (isVisible) {
                hideFilters();
            } else {
                showFilters();
            }
        });
    }

    function showFilters() {
        if (filtersPanel) {
            filtersPanel.style.display = 'block';
            setTimeout(() => {
                filtersPanel.classList.add('show');
            }, 10);
            
            if (filterToggle) {
                filterToggle.classList.add('active');
            }
        }
    }

    function hideFilters() {
        if (filtersPanel) {
            filtersPanel.classList.remove('show');
            setTimeout(() => {
                filtersPanel.style.display = 'none';
            }, 300);
            
            if (filterToggle) {
                filterToggle.classList.remove('active');
            }
        }
    }
}

/**
 * Enhanced Pagination System
 */
function initializePaginationSystem() {
    const paginationLinks = document.querySelectorAll('.pagination .page-link');
    
    paginationLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Smooth scroll to top on page change
            if (this.getAttribute('href') && this.getAttribute('href').includes('page=')) {
                setTimeout(() => {
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }, 100);
            }
        });
    });
}

/**
 * Responsive Helper Functions
 */
function initializeResponsiveHelpers() {
    updateViewportClasses();
    window.addEventListener('resize', updateViewportClasses);
    window.addEventListener('orientationchange', handleResponsiveChanges);
}

function updateViewportClasses() {
    const body = document.body;
    const width = window.innerWidth;
    
    // Remove existing viewport classes
    body.classList.remove('viewport-mobile', 'viewport-tablet', 'viewport-desktop');
    
    // Add appropriate viewport class
    if (width < 768) {
        body.classList.add('viewport-mobile');
    } else if (width < 1024) {
        body.classList.add('viewport-tablet');
    } else {
        body.classList.add('viewport-desktop');
    }
}

function handleResponsiveChanges() {
    setTimeout(updateViewportClasses, 100);
    
    // Force layout recalculation
    const courses = document.querySelectorAll('.course-card');
    courses.forEach(card => {
        card.style.display = 'none';
        card.offsetHeight; // Trigger reflow
        card.style.display = '';
    });
}

/**
 * Utility Functions
 */
function isMobile() {
    return window.innerWidth < 768;
}

function isTablet() {
    return window.innerWidth >= 768 && window.innerWidth < 1024;
}

function isDesktop() {
    return window.innerWidth >= 1024;
}