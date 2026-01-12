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

// Initialize
window.addEventListener('load', init);
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

function init() {
    updateConnectionStatus();
    const last = localStorage.getItem('lastAmount');
    if (last) document.getElementById('manualInput').value = last;
    
    // Enter key support for input
    document.getElementById('manualInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addManual();
    });
    
    // Input validation
    document.getElementById('manualInput').addEventListener('input', validateInput);
    
    // Setup notifications
    setupNotifications();
    
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
            
            summary[date] = (summary[date] || 0) + item.amount;
            weeklyData[weekKey] = (weeklyData[weekKey] || 0) + item.amount;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + item.amount;
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
                await _supabase.from('SuTakip').insert([{ amount: op.amount }]);
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
    } else if (percentage < 100) {
        goalReached = false;
    }
    
    // Color based on progress
    let colorCode = '--danger';
    if (total >= dailyGoal * 0.3) colorCode = '--warning';
    if (total >= dailyGoal * 0.8) colorCode = '--success';
    const activeColor = getComputedStyle(document.documentElement).getPropertyValue(colorCode).trim();
    
    // Update water level
    const waterLevel = document.getElementById('waterLevel');
    const waterBody = document.getElementById('waterBody');
    const paths = document.querySelectorAll('path');
    
    waterLevel.style.height = percentage + '%';
    waterBody.style.backgroundColor = activeColor;
    paths.forEach(w => w.style.fill = activeColor);
    
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
            recentContainer.innerHTML = allData.slice(0, 5).map(item => `
                <div class="log-row">
                    <span>${new Date(item.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
                    <b>${item.amount} ml</b>
                    <span style="cursor:pointer" onclick="deleteItem(${item.id})" title="Sil">🗑️</span>
                </div>
            `).join('');
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
function calculateStreak() {
    const lastSync = localStorage.getItem('lastSync');
    if (!lastSync) return 0;
    
    try {
        const data = JSON.parse(lastSync);
        if (!data.summary) return 0;
        
        const dates = Object.keys(data.summary).sort((a, b) => {
            return new Date(b.split('.').reverse().join('-')) - new Date(a.split('.').reverse().join('-'));
        });
        
        if (dates.length === 0) return 0;
        
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < dates.length; i++) {
            const dateStr = dates[i];
            const date = new Date(dateStr.split('.').reverse().join('-'));
            date.setHours(0, 0, 0, 0);
            
            const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
            
            if (diffDays === i && data.summary[dateStr] >= dailyGoal * 0.8) {
                streak++;
            } else if (i === 0 && diffDays === 0) {
                // Today - check if goal is reached
                if (data.summary[dateStr] >= dailyGoal * 0.8) {
                    streak = 1;
                }
                break;
            } else {
                break;
            }
        }
        
        return streak;
    } catch (e) {
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
        weekSummary[date] = (weekSummary[date] || 0) + item.amount;
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

// Add Water
async function handleWaterAdd(ml) {
    if (ml <= 0 || ml > 10000) {
        showToast('Geçerli bir miktar girin (1-10000 ml arası).', 'error');
        return;
    }
    
    if (isLoading) {
        showToast('Lütfen bekleyin...', 'warning');
        return;
    }
    
    // Optimistic update
    currentSessionTotal += ml;
    createBubbles();
    updateUI(currentSessionTotal, {}, null);
    
    // Update last drink time
    localStorage.setItem('lastDrinkTime', Date.now().toString());
    
    // Save to backend or queue
    if (isOnline) {
        try {
            setLoading(true);
            const { error } = await _supabase.from('SuTakip').insert([{ amount: ml }]);
            if (error) throw error;
            
            localStorage.setItem('lastAmount', ml);
            showToast(`${ml} ml su eklendi! 💧`, 'success');
            syncData(true);
        } catch (error) {
            console.error('Insert error:', error);
            // Rollback optimistic update
            currentSessionTotal -= ml;
            updateUI(currentSessionTotal, {}, null);
            
            // Queue for later
            pendingOperations.push({ type: 'insert', amount: ml });
            localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
            showToast('Çevrimdışı mod. Veri yerel olarak kaydedildi.', 'warning');
            syncData();
        } finally {
            setLoading(false);
        }
    } else {
        // Offline mode - queue operation
        pendingOperations.push({ type: 'insert', amount: ml });
        localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
        localStorage.setItem('lastAmount', ml);
        showToast(`${ml} ml su eklendi! (Çevrimdışı)`, 'success');
        
        // Save to local storage
        const lastSync = JSON.parse(localStorage.getItem('lastSync') || '{}');
        lastSync.total = (lastSync.total || 0) + ml;
        localStorage.setItem('lastSync', JSON.stringify(lastSync));
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
    
    await handleWaterAdd(val);
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
