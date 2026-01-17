// Supabase Configuration
const supabaseUrl = 'https://tagcqwypuubrwprzifty.supabase.co';
const supabaseKey = 'sb_publishable_MtbepQrx6M5-ySSUm8MwQA_EqPb5d4P';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// State Management
let currentSessionTotal = 0;
let goalReached = false;
let dailyGoal = parseInt(localStorage.getItem('dailyGoal')) || 2500;
let isOnline = navigator.onLine;
let pendingOperations = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
let isLoading = false;
let selectedDrink = { type: 'water', coefficient: 1.0, name: 'Su' };
let selectedDate = null; // null means today

// Animation State
let scrollVelocity = 0;
let lastScrollY = 0;
let lastScrollTime = Date.now();
let scrollWaveAmplitude = 0;
let animationFrameId = null;
let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Initialize
window.addEventListener('load', init);
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

function init() {
    updateConnectionStatus();
    const last = localStorage.getItem('lastAmount');
    if (last) document.getElementById('manualInput').value = last;
    
    // Set max date to today
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('max', today);
    }
    
    // Enter key support for input
    document.getElementById('manualInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addManual();
    });
    
    // Input validation
    document.getElementById('manualInput').addEventListener('input', validateInput);
    
    // Setup notifications
    setupNotifications();
    
    // Initialize date selector (set today as default)
    selectDateSimple('today');
    
    // Setup scroll animations
    if (!prefersReducedMotion) {
        setupScrollAnimations();
    }
    
    // Setup reduced motion listener
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        prefersReducedMotion = e.matches;
        if (prefersReducedMotion) {
            cancelAnimationFrame(animationFrameId);
        } else {
            setupScrollAnimations();
        }
    });
    
    syncData();
    processPendingOperations();
}

// Setup Notifications
function setupNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Check if reminder is enabled
    const reminderEnabled = localStorage.getItem('reminderEnabled') === 'true';
    if (reminderEnabled) {
        startReminderInterval();
    }
}

// Start Reminder Interval
function startReminderInterval() {
    // Check every hour if user needs to drink water
    setInterval(() => {
        const lastDrink = localStorage.getItem('lastDrinkTime');
        const now = Date.now();
        const twoHours = 2 * 60 * 60 * 1000;
        
        if (!lastDrink || (now - parseInt(lastDrink)) > twoHours) {
            const percentage = (currentSessionTotal / dailyGoal) * 100;
            if (percentage < 100) {
                showNotification('💧 Su İçme Zamanı!', `Hedefinizin %${Math.floor(percentage)}'ine ulaştınız. Biraz daha su içmeyi unutmayın!`);
            }
        }
    }, 60 * 60 * 1000); // Check every hour
}

// Show Browser Notification
function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '💧',
            badge: '💧',
            tag: 'water-reminder'
        });
    }
}

// Toggle Reminder
function toggleReminder() {
    const enabled = localStorage.getItem('reminderEnabled') === 'true';
    localStorage.setItem('reminderEnabled', !enabled);
    
    if (!enabled) {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    startReminderInterval();
                    showToast('Hatırlatıcılar açıldı!', 'success');
                }
            });
        } else if (Notification.permission === 'granted') {
            startReminderInterval();
            showToast('Hatırlatıcılar açıldı!', 'success');
        } else {
            showToast('Bildirim izni gerekli. Lütfen tarayıcı ayarlarından izin verin.', 'warning');
        }
    } else {
        showToast('Hatırlatıcılar kapatıldı.', 'info');
    }
}

// Connection Status
function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
        statusEl.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
        statusEl.textContent = isOnline ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı';
    }
}

function handleOnline() {
    isOnline = true;
    updateConnectionStatus();
    showToast('Bağlantı yenilendi!', 'success');
    processPendingOperations();
    syncData();
}

function handleOffline() {
    isOnline = false;
    updateConnectionStatus();
    showToast('Çevrimdışı mod. Veriler yerel olarak kaydedilecek.', 'warning');
}

// Input Validation
function validateInput(e) {
    const input = e.target;
    const value = parseInt(input.value);
    const min = 1;
    const max = 10000;
    
    if (value < min && input.value !== '') {
        input.setCustomValidity(`Minimum ${min} ml girebilirsiniz`);
    } else if (value > max) {
        input.setCustomValidity(`Maksimum ${max} ml girebilirsiniz`);
    } else {
        input.setCustomValidity('');
    }
}

// Toast Notifications
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Loading State
function setLoading(state) {
    isLoading = state;
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (state) {
            btn.disabled = true;
            if (btn.classList.contains('btn-main')) {
                const loader = document.createElement('span');
                loader.className = 'loader';
                btn.appendChild(loader);
            }
        } else {
            btn.disabled = false;
            const loader = btn.querySelector('.loader');
            if (loader) loader.remove();
        }
    });
}

// Bubble Animation
function createBubbles() {
    const container = document.getElementById('sphereContainer');
    for (let i = 0; i < 8; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const size = Math.random() * 12 + 5 + 'px';
        bubble.style.width = size;
        bubble.style.height = size;
        bubble.style.left = Math.random() * 100 + '%';
        bubble.style.animationDuration = Math.random() * 2 + 2 + 's';
        container.appendChild(bubble);
        setTimeout(() => bubble.remove(), 3000);
    }
}

// Data Sync with Error Handling
async function syncData(isOptimistic = false) {
    if (!isOnline && !isOptimistic) {
        loadLocalData();
        return;
    }
    
    try {
        setLoading(true);
        const { data, error } = await _supabase
            .from('SuTakip')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const today = new Date().toLocaleDateString('tr-TR');
        const summary = {};
        const weeklyData = {};
        const monthlyData = {};
        
        data.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString('tr-TR');
            const weekKey = getWeekKey(item.created_at);
            const monthKey = getMonthKey(item.created_at);
            
            // Calculate effective amount based on drink type
            const drinkType = item.drink_type || 'water';
            const coefficient = drinkType === 'water' ? 1.0 : 
                              drinkType === 'coffee' ? 0.8 : 
                              drinkType === 'tea' ? 0.9 : 0.95;
            const effectiveAmount = Math.round(item.amount * coefficient);
            
            summary[date] = (summary[date] || 0) + effectiveAmount;
            weeklyData[weekKey] = (weeklyData[weekKey] || 0) + effectiveAmount;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + effectiveAmount;
        });
        
        const realTotal = summary[today] || 0;
        if (!isOptimistic || realTotal > currentSessionTotal) {
            currentSessionTotal = realTotal;
        }
        
        // Save to localStorage for offline access
        localStorage.setItem('lastSync', JSON.stringify({
            total: currentSessionTotal,
            summary,
            data,
            timestamp: Date.now()
        }));
        
        updateUI(currentSessionTotal, summary, data);
        updateStats(weeklyData, monthlyData, data);
        
    } catch (error) {
        console.error('Sync error:', error);
        showToast('Veri senkronizasyonu başarısız. Çevrimdışı moda geçiliyor.', 'error');
        loadLocalData();
    } finally {
        setLoading(false);
    }
}

// Load Local Data
function loadLocalData() {
    const lastSync = localStorage.getItem('lastSync');
    if (lastSync) {
        try {
            const parsed = JSON.parse(lastSync);
            updateUI(parsed.total || 0, parsed.summary || {}, parsed.data || []);
        } catch (e) {
            console.error('Local data parse error:', e);
        }
    }
}

// Process Pending Operations
async function processPendingOperations() {
    if (!isOnline || pendingOperations.length === 0) return;
    
    setLoading(true);
    const toProcess = [...pendingOperations];
    pendingOperations = [];
    localStorage.setItem('pendingOperations', JSON.stringify([]));
    
    for (const op of toProcess) {
        try {
            if (op.type === 'insert') {
                const insertData = {
                    amount: op.amount,
                    drink_type: op.drink_type || 'water',
                    created_at: op.created_at || new Date().toISOString()
                };
                await _supabase.from('SuTakip').insert([insertData]);
            } else if (op.type === 'delete') {
                await _supabase.from('SuTakip').delete().eq('id', op.id);
            }
        } catch (error) {
            console.error('Pending operation error:', error);
            pendingOperations.push(op);
        }
    }
    
    localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
    setLoading(false);
    syncData();
    
    if (toProcess.length > 0) {
        showToast(`${toProcess.length} bekleyen işlem senkronize edildi.`, 'success');
    }
}

// Update UI
function updateUI(total, summary, allData) {
    const percentage = Math.min((total / dailyGoal) * 100, 100);
    const previousPercentage = parseFloat(document.getElementById('waterLevel').style.height) || 0;
    
    // Confetti on goal completion
    if (percentage >= 100 && !goalReached) {
        confetti({
            particleCount: 200,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#3b82f6', '#00e676', '#ffffff', '#8b5cf6']
        });
        goalReached = true;
        showToast('🎉 Harika! Günlük hedefinize ulaştınız!', 'success', 5000);
        
        // Pulse animation for 100%
        const sphere = document.getElementById('sphereContainer');
        if (sphere) {
            sphere.classList.add('goal-pulse');
            setTimeout(() => sphere.classList.remove('goal-pulse'), 2000);
        }
    } else if (percentage < 100) {
        goalReached = false;
    }
    
    // Color based on progress
    let colorCode = '--danger';
    if (total >= dailyGoal * 0.3) colorCode = '--warning';
    if (total >= dailyGoal * 0.8) colorCode = '--success';
    const activeColor = getComputedStyle(document.documentElement).getPropertyValue(colorCode).trim();
    
    // Update water level with spring easing
    const waterLevel = document.getElementById('waterLevel');
    const waterBody = document.getElementById('waterBody');
    const paths = document.querySelectorAll('path');
    const sphere = document.getElementById('sphereContainer');
    
    // Spring animation for height change
    if (Math.abs(percentage - previousPercentage) > 0.5) {
        waterLevel.style.transition = 'height 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
    waterLevel.style.height = percentage + '%';
    waterBody.style.backgroundColor = activeColor;
    paths.forEach(w => w.style.fill = activeColor);
    
    // Update wave speed based on percentage (0-100% → 4s to 2s)
    const waveSpeed = prefersReducedMotion ? 4 : Math.max(2, 4 - (percentage / 100) * 2);
    const wave1 = document.querySelector('.wave-1');
    const wave2 = document.querySelector('.wave-2');
    if (wave1) wave1.style.animationDuration = `${waveSpeed}s`;
    if (wave2) wave2.style.animationDuration = `${waveSpeed * 1.75}s`;
    
    // Update glow intensity based on percentage
    const glowIntensity = Math.min(percentage / 100, 1);
    if (sphere) {
        sphere.style.setProperty('--glow-intensity', glowIntensity);
        sphere.style.boxShadow = `
            inset 0 0 60px rgba(0, 0, 0, 0.3),
            0 10px 40px rgba(0, 0, 0, 0.2),
            0 0 ${20 + glowIntensity * 30}px rgba(59, 130, 246, ${0.2 * glowIntensity})
        `;
    }
    
    // Update text
    document.getElementById('percentText').innerText = Math.floor(percentage) + '%';
    document.getElementById('totalDisplay').innerText = `${total} / ${dailyGoal} ml`;
    document.getElementById('totalDisplay').style.color = activeColor;
    
    // Success badge
    const badge = document.getElementById('success-badge');
    badge.style.display = percentage >= 100 ? 'inline-block' : 'none';
    
    // Update recent activities
    if (allData) {
        const recentContainer = document.getElementById('recentContainer');
        if (allData.length === 0) {
            recentContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💧</div>
                    <div class="empty-state-text">Henüz su eklenmedi</div>
                </div>
            `;
        } else {
            recentContainer.innerHTML = allData.slice(0, 5).map(item => {
                const drinkType = item.drink_type || 'water';
                const drinkIcon = drinkType === 'water' ? '💧' : 
                                drinkType === 'coffee' ? '☕' : 
                                drinkType === 'tea' ? '🍵' : '🥤';
                return `
                <div class="log-row">
                    <span>${new Date(item.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
                    <b>${drinkIcon} ${item.amount} ml</b>
                    <span style="cursor:pointer" onclick="deleteItem(${item.id})" title="Sil">🗑️</span>
                </div>
            `;
            }).join('');
        }
        
        // Update history
        const historyContainer = document.getElementById('historyContainer');
        const dates = Object.keys(summary).sort((a, b) => new Date(b.split('.').reverse().join('-')) - new Date(a.split('.').reverse().join('-')));
        
        if (dates.length === 0) {
            historyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <div class="empty-state-text">Henüz geçmiş veri yok</div>
                </div>
            `;
        } else {
            historyContainer.innerHTML = dates.map(date => `
                <div class="log-row">
                    <span>${date}</span>
                    <b>${summary[date]} ml</b>
                </div>
            `).join('');
        }
    }
}

// Update Statistics
function updateStats(weeklyData, monthlyData, allData = null) {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;
    
    const thisWeek = getWeekKey(new Date());
    const thisMonth = getMonthKey(new Date());
    
    const weekTotal = weeklyData[thisWeek] || 0;
    const monthTotal = monthlyData[thisMonth] || 0;
    const daysInMonth = new Date().getDate();
    const avgDaily = daysInMonth > 0 ? monthTotal / daysInMonth : 0;
    
    // Calculate streak
    const streak = calculateStreak();
    
    // Get motivation message
    const motivation = getMotivationMessage(currentSessionTotal, dailyGoal);
    
    statsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Bu Hafta</div>
                <div class="stat-value">${weekTotal.toLocaleString('tr-TR')}</div>
                <div class="stat-label">ml</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Bu Ay</div>
                <div class="stat-value">${monthTotal.toLocaleString('tr-TR')}</div>
                <div class="stat-label">ml</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Günlük Ort.</div>
                <div class="stat-value">${Math.round(avgDaily).toLocaleString('tr-TR')}</div>
                <div class="stat-label">ml</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Seri</div>
                <div class="stat-value">${streak}</div>
                <div class="stat-label">gün 🔥</div>
            </div>
        </div>
        ${motivation ? `<div style="margin-top: 16px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 12px; text-align: center; font-weight: 600; font-size: 0.9rem;">${motivation}</div>` : ''}
    `;
    
    // Update weekly chart
    if (allData) {
        updateWeeklyChart(allData);
    }
}

// Calculate Streak
// app.js içindeki mevcut calculateStreak fonksiyonu ile değiştirin
function calculateStreak() {
    const lastSync = localStorage.getItem('lastSync');
    if (!lastSync) return 0;
    
    try {
        const data = JSON.parse(lastSync);
        if (!data.summary) return 0;
        
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let dayOffset = 0;
        while (true) {
            const d = new Date(today);
            d.setDate(d.getDate() - dayOffset);
            const dStr = d.toLocaleDateString('tr-TR');
            const amount = data.summary[dStr] || 0;

            // Günlük hedefin en az %80'ine ulaşıldı mı?
            if (amount >= dailyGoal * 0.8) {
                streak++;
            } else {
                // DEĞİŞİKLİK BURADA: 
                // Eğer kontrol edilen gün 'bugün' ise (dayOffset 0) 
                // ve hedef henüz tamamlanmadıysa seriyi bozma, dünden itibaren saymaya devam et.
                if (dayOffset > 0) {
                    break;
                }
            }
            
            dayOffset++;
            // Güvenlik sınırı (365 günden fazla geriye gitme)
            if (dayOffset > 365) break;
        }
        
        return streak;
    } catch (e) {
        console.error('Seri hesaplama hatası:', e);
        return 0;
    }
}

// Get Motivation Message
function getMotivationMessage(current, goal) {
    const percentage = (current / goal) * 100;
    
    if (percentage >= 100) {
        return '🎉 Harika! Hedefinize ulaştınız!';
    } else if (percentage >= 80) {
        return '💪 Neredeyse tamamlandı! Biraz daha!';
    } else if (percentage >= 50) {
        return '👍 İyi gidiyorsunuz! Devam edin!';
    } else if (percentage >= 30) {
        return '💧 Başlangıç iyi! Daha fazla su içmeyi unutmayın.';
    } else if (percentage > 0) {
        return '🌱 Başlamak önemli! Her gün biraz daha fazla!';
    } else {
        return '💧 Bugün henüz su içmediniz. Hadi başlayalım!';
    }
}

// Update Weekly Chart
function updateWeeklyChart(allData) {
    const chartContainer = document.getElementById('weeklyChartContainer');
    if (!chartContainer) return;
    
    const today = new Date();
    const weekSummary = {};
    
    // Group data by date
    allData.forEach(item => {
        const date = new Date(item.created_at).toLocaleDateString('tr-TR');
        // Calculate effective amount based on drink type
        const drinkType = item.drink_type || 'water';
        const coefficient = drinkType === 'water' ? 1.0 : 
                          drinkType === 'coffee' ? 0.8 : 
                          drinkType === 'tea' ? 0.9 : 0.95;
        const effectiveAmount = Math.round(item.amount * coefficient);
        weekSummary[date] = (weekSummary[date] || 0) + effectiveAmount;
    });
    
    const weekDays = [];
    const weekValues = [];
    
    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('tr-TR');
        weekDays.push(dateStr);
        weekValues.push(weekSummary[dateStr] || 0);
    }
    
    const maxValue = Math.max(...weekValues, dailyGoal, 1);
    
    chartContainer.innerHTML = `
        <div class="chart-container">
            <div style="font-weight: 800; margin-bottom: 12px; font-size: 0.95rem;">📈 Son 7 Gün</div>
            ${weekDays.map((day, index) => {
                const value = weekValues[index];
                const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const dayName = new Date(day.split('.').reverse().join('-')).toLocaleDateString('tr-TR', { weekday: 'short' });
                const isToday = index === 6;
                
                return `
                    <div class="chart-bar">
                        <div class="chart-label" style="font-size: 0.75rem; ${isToday ? 'font-weight: 800; color: #3b82f6;' : ''}">
                            ${dayName}
                        </div>
                        <div class="chart-bar-fill">
                            <div class="chart-bar-progress" style="width: ${percentage}%; ${isToday ? 'background: var(--blue-grad);' : ''}"></div>
                        </div>
                        <div class="chart-value" style="${isToday ? 'font-weight: 800; color: #3b82f6;' : ''}">
                            ${value} ml
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Helper Functions
function getWeekKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const week = getWeekNumber(d);
    return `${year}-W${week}`;
}

function getMonthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Change Goal
function changeGoal() {
    const newGoal = prompt("Günlük su hedefinizi girin (ml):", dailyGoal);
    if (newGoal && !isNaN(newGoal) && newGoal > 0 && newGoal <= 20000) {
        dailyGoal = parseInt(newGoal);
        localStorage.setItem('dailyGoal', dailyGoal);
        showToast(`Hedef ${dailyGoal} ml olarak güncellendi.`, 'success');
        syncData();
    } else if (newGoal) {
        showToast('Geçerli bir değer girin (1-20000 ml arası).', 'error');
    }
}

// Select Drink Type
function selectDrink(type, coefficient) {
    selectedDrink = {
        type: type,
        coefficient: coefficient,
        name: type === 'water' ? 'Su' : type === 'coffee' ? 'Kahve' : type === 'tea' ? 'Çay' : 'Meyve Suyu'
    };
    
    // Update UI
    document.querySelectorAll('.drink-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    document.querySelector(`[data-drink="${type}"]`).classList.add('active');
}

// Select Date Simple (3 buttons: Today, Yesterday, Day Before)
function selectDateSimple(mode) {
    const todayBtn = document.getElementById('dateTodayBtn');
    const yesterdayBtn = document.getElementById('dateYesterdayBtn');
    const dayBeforeBtn = document.getElementById('dateDayBeforeBtn');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Remove active class from all buttons
    todayBtn.classList.remove('active');
    yesterdayBtn.classList.remove('active');
    dayBeforeBtn.classList.remove('active');
    
    // Set selected date based on mode
    if (mode === 'today') {
        todayBtn.classList.add('active');
        selectedDate = null; // null means today
    } else if (mode === 'yesterday') {
        yesterdayBtn.classList.add('active');
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        selectedDate = yesterday.toISOString().split('T')[0];
    } else if (mode === 'dayBefore') {
        dayBeforeBtn.classList.add('active');
        const dayBefore = new Date(today);
        dayBefore.setDate(dayBefore.getDate() - 2);
        selectedDate = dayBefore.toISOString().split('T')[0];
    }
    
    // Refresh data - this will update UI, stats, and list
    syncData();
}

// Add Water
async function handleWaterAdd(ml, drinkType = 'water', coefficient = 1.0, customDate = null) {
    if (ml <= 0 || ml > 10000) {
        showToast('Geçerli bir miktar girin (1-10000 ml arası).', 'error');
        return;
    }
    
    if (isLoading) {
        showToast('Lütfen bekleyin...', 'warning');
        return;
    }
    
    // Calculate effective amount (with coefficient)
    const effectiveAmount = Math.round(ml * coefficient);
    const drinkName = drinkType === 'water' ? 'Su' : drinkType === 'coffee' ? 'Kahve' : drinkType === 'tea' ? 'Çay' : 'Meyve Suyu';
    
    // Determine the date to use
    let targetDate = customDate || selectedDate;
    let createdAt = new Date();
    
    if (targetDate) {
        // Parse the date and set to end of day
        createdAt = new Date(targetDate);
        createdAt.setHours(23, 59, 59, 999);
        
        // Check if it's a future date
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (createdAt > today) {
            showToast('Geleceğe veri girişi yapılamaz!', 'error');
            return;
        }
    }
    
    // Optimistic update (only for today)
    const today = new Date().toLocaleDateString('tr-TR');
    const targetDateStr = createdAt.toLocaleDateString('tr-TR');
    
    if (targetDateStr === today) {
        currentSessionTotal += effectiveAmount;
        createBubbles();
        createAdditionBubble(ml); // Mikro animasyon: baloncuk
        updateUI(currentSessionTotal, {}, null);
    }
    
    // Update last drink time (only for today)
    if (targetDateStr === today) {
        localStorage.setItem('lastDrinkTime', Date.now().toString());
    }
    
    // Prepare data for Supabase
    const insertData = {
        amount: ml, // Original amount
        drink_type: drinkType,
        created_at: createdAt.toISOString()
    };
    
    // Save to backend or queue
    if (isOnline) {
        try {
            setLoading(true);
            const { error } = await _supabase.from('SuTakip').insert([insertData]);
            if (error) throw error;
            
            localStorage.setItem('lastAmount', ml);
            
            // Show toast with drink info
            if (coefficient < 1.0) {
                showToast(`${ml}ml ${drinkName} eklendi (Net: ${effectiveAmount}ml)`, 'success');
            } else {
                showToast(`${ml}ml ${drinkName} eklendi! 💧`, 'success');
            }
            
            syncData(true);
        } catch (error) {
            console.error('Insert error:', error);
            // Rollback optimistic update
            if (targetDateStr === today) {
                currentSessionTotal -= effectiveAmount;
                updateUI(currentSessionTotal, {}, null);
            }
            
            // Queue for later
            pendingOperations.push({ 
                type: 'insert', 
                amount: ml, 
                drink_type: drinkType,
                created_at: createdAt.toISOString()
            });
            localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
            showToast('Çevrimdışı mod. Veri yerel olarak kaydedildi.', 'warning');
            syncData();
        } finally {
            setLoading(false);
        }
    } else {
        // Offline mode - queue operation
        pendingOperations.push({ 
            type: 'insert', 
            amount: ml, 
            drink_type: drinkType,
            created_at: createdAt.toISOString()
        });
        localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
        localStorage.setItem('lastAmount', ml);
        
        if (coefficient < 1.0) {
            showToast(`${ml}ml ${drinkName} eklendi (Net: ${effectiveAmount}ml) (Çevrimdışı)`, 'success');
        } else {
            showToast(`${ml}ml ${drinkName} eklendi! (Çevrimdışı)`, 'success');
        }
        
        // Save to local storage
        const lastSync = JSON.parse(localStorage.getItem('lastSync') || '{}');
        if (targetDateStr === today) {
            lastSync.total = (lastSync.total || 0) + effectiveAmount;
        }
        localStorage.setItem('lastSync', JSON.stringify(lastSync));
    }
    
    // Reset date selection after adding
    if (selectedDate) {
        selectedDate = null;
        document.getElementById('dateInput').value = '';
        document.getElementById('dateDisplay').textContent = 'Bugün';
    }
}

// Add Manual
async function addManual() {
    const inp = document.getElementById('manualInput');
    const val = parseInt(inp.value);
    
    if (!val || val <= 0) {
        showToast('Lütfen geçerli bir miktar girin.', 'error');
        inp.focus();
        return;
    }
    
    if (val > 10000) {
        showToast('Maksimum 10000 ml girebilirsiniz.', 'error');
        inp.focus();
        return;
    }
    
    await handleWaterAdd(val, selectedDrink.type, selectedDrink.coefficient, selectedDate);
    inp.value = '';
}

// Delete Item
async function deleteItem(id) {
    if (!confirm("Bu kaydı silmek istediğinizden emin misiniz?")) return;
    
    if (isLoading) {
        showToast('Lütfen bekleyin...', 'warning');
        return;
    }
    
    if (isOnline) {
        try {
            setLoading(true);
            const { error } = await _supabase.from('SuTakip').delete().eq('id', id);
            if (error) throw error;
            
            showToast('Kayıt silindi.', 'success');
            syncData();
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Silme işlemi başarısız oldu.', 'error');
        } finally {
            setLoading(false);
        }
    } else {
        pendingOperations.push({ type: 'delete', id });
        localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
        showToast('Silme işlemi çevrimiçi olduğunuzda gerçekleştirilecek.', 'warning');
    }
}

// Clear All
async function clearAll() {
    if (!confirm("Tüm geçmiş veriler kalıcı olarak silinecek! Devam etmek istiyor musunuz?")) return;
    
    if (!confirm("Bu işlem geri alınamaz! Emin misiniz?")) return;
    
    if (isLoading) {
        showToast('Lütfen bekleyin...', 'warning');
        return;
    }
    
    if (isOnline) {
        try {
            setLoading(true);
            const { error } = await _supabase.from('SuTakip').delete().neq('id', 0);
            if (error) throw error;
            
            currentSessionTotal = 0;
            showToast('Tüm veriler silindi.', 'success');
            syncData();
        } catch (error) {
            console.error('Clear error:', error);
            showToast('Silme işlemi başarısız oldu.', 'error');
        } finally {
            setLoading(false);
        }
    } else {
        showToast('Bu işlem için internet bağlantısı gereklidir.', 'error');
    }
}

// Toggle Theme
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    syncData();
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.remove('dark-mode');
} else {
    document.body.classList.add('dark-mode');
}

// =====================================================
// SCROLL ANIMATIONS
// =====================================================

function setupScrollAnimations() {
    if (prefersReducedMotion) return;
    
    let ticking = false;
    
    function updateScrollEffects() {
        if (prefersReducedMotion) return;
        
        const currentScrollY = window.scrollY || window.pageYOffset;
        const currentTime = Date.now();
        const timeDelta = currentTime - lastScrollTime;
        
        if (timeDelta > 0) {
            scrollVelocity = Math.abs(currentScrollY - lastScrollY) / timeDelta;
            scrollVelocity = Math.min(scrollVelocity * 1000, 5); // Clamp to 0-5
        }
        
        // Decay scroll velocity
        scrollVelocity *= 0.92;
        if (scrollVelocity < 0.01) scrollVelocity = 0;
        
        // Map velocity to wave amplitude (0-15px)
        scrollWaveAmplitude = Math.min(scrollVelocity * 3, 15);
        
        // Apply parallax to sphere wrapper
        const sphereWrapper = document.querySelector('.sphere-wrapper');
        if (sphereWrapper) {
            const parallaxOffset = currentScrollY * 0.1;
            sphereWrapper.style.transform = `translateY(${parallaxOffset}px)`;
        }
        
        // Update wave amplitude via CSS variable
        const waterLayer = document.querySelector('.water-layer');
        if (waterLayer) {
            waterLayer.style.setProperty('--scroll-amplitude', `${scrollWaveAmplitude}px`);
        }
        
        // Background gradient shift
        document.documentElement.style.setProperty('--scroll-offset', `${currentScrollY * 0.02}px`);
        
        lastScrollY = currentScrollY;
        lastScrollTime = currentTime;
        ticking = false;
    }
    
    function onScroll() {
        if (!ticking && !prefersReducedMotion) {
            animationFrameId = requestAnimationFrame(updateScrollEffects);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', onScroll, { passive: true });
    updateScrollEffects(); // Initial call
}

// =====================================================
// SPRING EASING FOR WATER LEVEL
// =====================================================

function springEasing(t) {
    // Spring physics: overshoot and settle
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// =====================================================
// CREATE ADDITION BUBBLE (Mikro animasyon)
// =====================================================

function createAdditionBubble(amount) {
    // Find sphere wrapper (not the sphere itself - sphere has overflow:hidden)
    const sphereWrapper = document.querySelector('.sphere-wrapper');
    if (!sphereWrapper) return;
    
    const bubble = document.createElement('div');
    bubble.className = 'addition-bubble';
    bubble.textContent = `+${amount} ml`;
    sphereWrapper.appendChild(bubble);
    
    // Trigger animation
    setTimeout(() => bubble.classList.add('show'), 10);
    
    // Remove after animation
    setTimeout(() => {
        bubble.classList.remove('show');
        setTimeout(() => bubble.remove(), 300);
    }, 2000);
}
