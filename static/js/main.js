// CourseGem - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initializeSearch();
    initializeEnhancedSearch();
    initializeFilters();
    initializePagination();
    initializeTooltips();
    initializeAdminFunctions();
    initializeImageLazyLoading();
    
    // Auto-dismiss alerts after 5 seconds
    setTimeout(function() {
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(function(alert) {
            alert.style.transition = 'opacity 0.5s ease';
            alert.style.opacity = '0';
            setTimeout(function() {
                alert.remove();
            }, 500);
        });
    }, 5000);
});

// Search functionality
function initializeSearch() {
    const searchForm = document.querySelector('.search-form');
    const searchInput = document.querySelector('.search-input');
    
    if (searchForm && searchInput) {
        // Add search suggestions
        let searchTimeout;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            
            if (query.length >= 2) {
                searchTimeout = setTimeout(function() {
                    fetchSearchSuggestions(query);
                }, 300);
            } else {
                hideSearchSuggestions();
            }
        });
        
        // Handle form submission
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            performSearch();
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchForm.contains(e.target)) {
                hideSearchSuggestions();
            }
        });
    }
}

function fetchSearchSuggestions(query) {
    fetch(`/api/courses/search?q=${encodeURIComponent(query)}&limit=5`)
        .then(response => response.json())
        .then(data => {
            showSearchSuggestions(data);
        })
        .catch(error => {
            console.error('Error fetching search suggestions:', error);
        });
}

function showSearchSuggestions(courses) {
    const searchForm = document.querySelector('.search-form');
    let suggestionsContainer = document.querySelector('.search-suggestions');
    
    // Remove existing suggestions
    if (suggestionsContainer) {
        suggestionsContainer.remove();
    }
    
    if (courses.length > 0) {
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'search-suggestions';
        suggestionsContainer.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid var(--gray-200);
            border-radius: 8px;
            box-shadow: 0 4px 15px var(--shadow);
            z-index: 1000;
            max-height: 300px;
            overflow-y: auto;
        `;
        
        courses.forEach(course => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.style.cssText = `
                padding: 1rem;
                border-bottom: 1px solid var(--gray-100);
                cursor: pointer;
                transition: background-color 0.2s ease;
            `;
            
            suggestionItem.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <img src="${course.image_url || '/static/images/default-course.svg'}" 
                         alt="${course.title}" 
                         style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                    <div>
                        <div style="font-weight: 500; color: var(--gray-800);">${course.title}</div>
                        <div style="font-size: 0.8rem; color: var(--gray-600);">${course.instructor || 'CourseGem'}</div>
                    </div>
                </div>
            `;
            
            suggestionItem.addEventListener('mouseenter', function() {
                this.style.backgroundColor = 'var(--gray-50)';
            });
            
            suggestionItem.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'transparent';
            });
            
            suggestionItem.addEventListener('click', function() {
                window.location.href = `/course/${course._id}`;
            });
            
            suggestionsContainer.appendChild(suggestionItem);
        });
        
        searchForm.style.position = 'relative';
        searchForm.appendChild(suggestionsContainer);
    }
}

function hideSearchSuggestions() {
    const suggestionsContainer = document.querySelector('.search-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.remove();
    }
}

// Enhanced Search with Filters Toggle
function initializeEnhancedSearch() {
    // Initialize filter toggle functionality for both pages
    const filterToggles = document.querySelectorAll('#filterToggle, #filterToggleFree');
    const filtersPanels = document.querySelectorAll('#filtersPanel, #filtersPanelFree');
    
    filterToggles.forEach((toggle, index) => {
        if (toggle && filtersPanels[index]) {
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const panel = filtersPanels[index];
                const isVisible = panel.classList.contains('show');
                
                if (isVisible) {
                    // Hide panel
                    panel.classList.remove('show');
                    toggle.classList.remove('active');
                } else {
                    // Show panel
                    panel.classList.add('show');
                    toggle.classList.add('active');
                }
            });
        }
    });
    
    // Auto-submit search forms on input change
    const searchForms = document.querySelectorAll('#searchForm, #searchFormFree');
    const searchInputs = document.querySelectorAll('#searchInput, #searchInputFree');
    
    searchInputs.forEach((input, index) => {
        if (input && searchForms[index]) {
            let searchTimeout;
            
            input.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                const query = this.value.trim();
                
                // Auto-submit after 500ms of no typing
                if (query.length >= 2) {
                    searchTimeout = setTimeout(() => {
                        searchForms[index].submit();
                    }, 500);
                } else if (query.length === 0) {
                    // Clear search immediately when input is empty
                    searchTimeout = setTimeout(() => {
                        searchForms[index].submit();
                    }, 100);
                }
            });
        }
    });
    
    // Auto-submit on filter changes
    const filterSelects = document.querySelectorAll('.filter-select');
    filterSelects.forEach(select => {
        select.addEventListener('change', function() {
            const form = this.closest('form');
            if (form) {
                form.submit();
            }
        });
    });
    
    // Close filters panel when clicking outside
    document.addEventListener('click', function(e) {
        filtersPanels.forEach((panel, index) => {
            if (panel && filterToggles[index]) {
                const toggle = filterToggles[index];
                const searchContainer = panel.closest('.search-container');
                
                if (searchContainer && !searchContainer.contains(e.target)) {
                    panel.classList.remove('show');
                    toggle.classList.remove('active');
                }
            }
        });
    });

    // Close filters panel when scrolling
    window.addEventListener('scroll', function() {
        filtersPanels.forEach((panel, index) => {
            if (panel && filterToggles[index] && panel.classList.contains('show')) {
                const toggle = filterToggles[index];
                panel.classList.remove('show');
                toggle.classList.remove('active');
            }
        });
    });
}

function performSearch() {
    const searchInput = document.querySelector('.search-input');
    const query = searchInput.value.trim();
    
    if (query) {
        const url = new URL(window.location);
        url.searchParams.set('search', query);
        url.searchParams.delete('page'); // Reset to first page
        window.location.href = url.toString();
    }
}

// Filter functionality
function initializeFilters() {
    const filterForm = document.querySelector('.filter-form');
    const filterSelects = document.querySelectorAll('.filter-select');
    const clearButton = document.querySelector('.btn-clear');
    
    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            applyFilters();
        });
    }
    
    // Auto-apply filters on change
    filterSelects.forEach(select => {
        select.addEventListener('change', function() {
            applyFilters();
        });
    });
    
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            clearFilters();
        });
    }
}

function applyFilters() {
    const url = new URL(window.location);
    const formData = new FormData(document.querySelector('.filter-form'));
    
    // Clear existing filter parameters
    url.searchParams.delete('category');
    url.searchParams.delete('language');
    url.searchParams.delete('rating');
    url.searchParams.delete('page');
    
    // Add new filter parameters
    for (let [key, value] of formData.entries()) {
        if (value) {
            url.searchParams.set(key, value);
        }
    }
    
    window.location.href = url.toString();
}

function clearFilters() {
    const url = new URL(window.location);
    url.searchParams.delete('category');
    url.searchParams.delete('language');
    url.searchParams.delete('rating');
    url.searchParams.delete('page');
    
    window.location.href = url.toString();
}

// Pagination functionality
function initializePagination() {
    const paginationLinks = document.querySelectorAll('.page-link:not(.disabled)');
    
    paginationLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            
            if (page) {
                const url = new URL(window.location);
                url.searchParams.set('page', page);
                window.location.href = url.toString();
            }
        });
    });
}

// Tooltip functionality
function initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            showTooltip(this, this.dataset.tooltip);
        });
        
        element.addEventListener('mouseleave', function() {
            hideTooltip();
        });
    });
}

function showTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
        position: absolute;
        background: var(--gray-800);
        color: white;
        padding: 0.5rem 0.75rem;
        border-radius: 4px;
        font-size: 0.8rem;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
}

function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Admin functionality
function initializeAdminFunctions() {
    // Confirm delete actions
    const deleteButtons = document.querySelectorAll('[data-confirm]');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const message = this.dataset.confirm || 'Are you sure?';
            if (!confirm(message)) {
                e.preventDefault();
            }
        });
    });
    
    // Auto-refresh admin dashboard
    if (window.location.pathname.includes('/admin/dashboard')) {
        setInterval(function() {
            updateDashboardStats();
        }, 30000); // Update every 30 seconds
    }
    
    // Handle scraper controls
    const scraperButton = document.querySelector('#run-scraper');
    if (scraperButton) {
        scraperButton.addEventListener('click', function() {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
            
            // Re-enable after 10 seconds
            setTimeout(() => {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-play"></i> Run Scraper';
            }, 10000);
        });
    }
}

function updateDashboardStats() {
    // This would fetch updated stats from the server
    // Implementation depends on having an API endpoint for stats
    console.log('Updating dashboard stats...');
}

// Image lazy loading
function initializeImageLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        images.forEach(img => {
            imageObserver.observe(img);
        });
    } else {
        // Fallback for browsers without IntersectionObserver
        images.forEach(img => {
            img.src = img.dataset.src;
        });
    }
}

// Course card interactions
function initializeCourseCards() {
    const courseCards = document.querySelectorAll('.course-card');
    
    courseCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // Don't trigger if clicking on buttons or links
            if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
                return;
            }
            
            const courseLink = card.querySelector('.course-title a') || card.querySelector('a');
            if (courseLink) {
                window.location.href = courseLink.href;
            }
        });
    });
}

// Smooth scrolling for anchor links
function initializeSmoothScrolling() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Form validation
function initializeFormValidation() {
    const forms = document.querySelectorAll('form[data-validate]');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
            }
        });
    });
}

function validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            showFieldError(field, 'This field is required');
            isValid = false;
        } else {
            clearFieldError(field);
        }
    });
    
    return isValid;
}

function showFieldError(field, message) {
    clearFieldError(field);
    
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.style.cssText = `
        color: var(--error);
        font-size: 0.8rem;
        margin-top: 0.25rem;
    `;
    
    field.parentNode.appendChild(errorElement);
    field.style.borderColor = 'var(--error)';
}

function clearFieldError(field) {
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
    field.style.borderColor = '';
}

// Loading states
function showLoading(element) {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading';
    loadingContainer.appendChild(spinner);
    
    element.innerHTML = '';
    element.appendChild(loadingContainer);
}

function hideLoading(element) {
    const loading = element.querySelector('.loading');
    if (loading) {
        loading.remove();
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Export functions for use in other scripts
window.CourseGem = {
    showLoading,
    hideLoading,
    showTooltip,
    hideTooltip,
    debounce,
    throttle
};
