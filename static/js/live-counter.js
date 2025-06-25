/**
 * Live Counter System - نظام العداد المباشر
 * يعرض إحصائيات الدورات في الوقت الفعلي
 */

class LiveCounter {
    constructor() {
        this.updateInterval = 30000; // تحديث كل 30 ثانية
        this.intervalId = null;
        this.isVisible = true;
        this.animationDuration = 1000; // مدة الأنيميشن
        
        this.init();
    }
    
    init() {
        this.createCounterDisplay();
        this.startLiveUpdates();
        this.setupVisibilityHandler();
    }
    
    createCounterDisplay() {
        // إنشاء عنصر العداد المباشر
        const counterHTML = `
            <div id="live-counter" class="live-counter-container">
                <div class="live-counter-header">
                    <span class="live-indicator">🔴 LIVE</span>
                    <span class="counter-title">Course Statistics</span>
                </div>
                <div class="counter-stats">
                    <div class="stat-item">
                        <span class="stat-label">Total Courses</span>
                        <span class="stat-value" id="total-courses">--</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Categories</span>
                        <span class="stat-value" id="total-categories">--</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Languages</span>
                        <span class="stat-value" id="total-languages">--</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Last Added</span>
                        <span class="stat-value" id="last-added">--</span>
                    </div>
                </div>
                <div class="counter-sources">
                    <div class="source-item">
                        <span class="source-label">UdemyFreebies</span>
                        <span class="source-value" id="udemy-count">--</span>
                    </div>
                    <div class="source-item">
                        <span class="source-label">StudyBullet</span>
                        <span class="source-value" id="studybullet-count">--</span>
                    </div>
                </div>
            </div>
        `;
        
        // إضافة العداد للصفحة
        document.addEventListener('DOMContentLoaded', () => {
            const existingCounter = document.getElementById('live-counter');
            if (!existingCounter) {
                document.body.insertAdjacentHTML('beforeend', counterHTML);
                this.addCounterStyles();
            }
        });
    }
    
    addCounterStyles() {
        const styles = `
            <style>
                .live-counter-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px;
                    border-radius: 10px;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                    z-index: 9999;
                    min-width: 250px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.1);
                    transition: all 0.3s ease;
                }
                
                .live-counter-container:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 35px rgba(0,0,0,0.2);
                }
                
                .live-counter-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.2);
                }
                
                .live-indicator {
                    font-size: 12px;
                    font-weight: bold;
                    animation: pulse 2s infinite;
                }
                
                .counter-title {
                    font-size: 14px;
                    font-weight: 600;
                }
                
                .counter-stats {
                    margin-bottom: 15px;
                }
                
                .stat-item, .source-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    padding: 4px 0;
                }
                
                .stat-label, .source-label {
                    font-size: 12px;
                    opacity: 0.9;
                }
                
                .stat-value, .source-value {
                    font-size: 14px;
                    font-weight: bold;
                    transition: all 0.5s ease;
                }
                
                .counter-sources {
                    border-top: 1px solid rgba(255,255,255,0.2);
                    padding-top: 10px;
                }
                
                .source-item {
                    margin-bottom: 4px;
                }
                
                .value-updated {
                    animation: highlightUpdate 1s ease;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                @keyframes highlightUpdate {
                    0% { background-color: rgba(255,255,255,0.3); transform: scale(1.05); }
                    100% { background-color: transparent; transform: scale(1); }
                }
                
                @media (max-width: 768px) {
                    .live-counter-container {
                        top: 10px;
                        right: 10px;
                        left: 10px;
                        min-width: auto;
                        font-size: 12px;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    async fetchLiveStats() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch('/api/live-stats', {
                signal: controller.signal,
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('Live stats request timed out');
            } else {
                console.error('Error fetching live stats:', error);
            }
            return null;
        }
    }
    
    updateCounterDisplay(stats) {
        if (!stats) return;
        
        const elements = {
            'total-courses': stats.total_courses,
            'total-categories': stats.total_categories,
            'total-languages': stats.total_languages,
            'last-added': stats.last_added,
            'udemy-count': stats.udemy_count,
            'studybullet-count': stats.studybullet_count
        };
        
        Object.entries(elements).forEach(([id, newValue]) => {
            const element = document.getElementById(id);
            if (element && element.textContent !== newValue.toString()) {
                this.animateValueChange(element, newValue);
            }
        });
    }
    
    animateValueChange(element, newValue) {
        // إضافة تأثير التحديث
        element.classList.add('value-updated');
        
        // تحديث القيمة تدريجياً للأرقام
        const oldValue = parseInt(element.textContent) || 0;
        const numericValue = parseInt(newValue) || 0;
        
        if (!isNaN(oldValue) && !isNaN(numericValue) && oldValue !== numericValue) {
            this.animateNumber(element, oldValue, numericValue);
        } else {
            element.textContent = newValue;
        }
        
        // إزالة تأثير التحديث
        setTimeout(() => {
            element.classList.remove('value-updated');
        }, this.animationDuration);
    }
    
    animateNumber(element, startValue, endValue) {
        const duration = 800;
        const steps = 20;
        const increment = (endValue - startValue) / steps;
        let currentStep = 0;
        
        const timer = setInterval(() => {
            currentStep++;
            const currentValue = Math.round(startValue + (increment * currentStep));
            element.textContent = currentValue;
            
            if (currentStep >= steps) {
                clearInterval(timer);
                element.textContent = endValue;
            }
        }, duration / steps);
    }
    
    async startLiveUpdates() {
        // تحديث فوري
        await this.updateStats();
        
        // تحديث دوري
        this.intervalId = setInterval(() => {
            if (this.isVisible) {
                this.updateStats();
            }
        }, this.updateInterval);
    }
    
    async updateStats() {
        const stats = await this.fetchLiveStats();
        if (stats) {
            this.updateCounterDisplay(stats);
        }
    }
    
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
            
            if (this.isVisible) {
                // تحديث فوري عند العودة للصفحة
                this.updateStats();
            }
        });
    }
    
    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        const counter = document.getElementById('live-counter');
        if (counter) {
            counter.remove();
        }
    }
}

// تهيئة العداد المباشر
let liveCounter;
document.addEventListener('DOMContentLoaded', () => {
    liveCounter = new LiveCounter();
});

// تصدير للاستخدام العام
window.LiveCounter = LiveCounter;