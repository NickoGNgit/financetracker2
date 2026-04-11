// --- Global State ---
let appData = { boards: [], currentCurrency: '₱', payables: [], receivables: [], savings: [], settings: { decimalSep: '.', thousandSep: ',', dateFormat: 'MM-DD-YYYY', dateSep: '-' } };
let activeYearFilter = 'All'; 
let activeMonthFilter = 'All';
let activePayoutId = null; 
let currentView = 'budgets'; 
window.hasAutoScrolled = false; 

let viewCompletedPayables = false;
let viewCompletedReceivables = false;

// --- CUSTOM POP-UP ENGINE ---
window.customAlert = function(message, title = "Notice", icon = "info", iconColor = "var(--md-sys-color-primary)") {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-alert');
        document.getElementById('custom-alert-title').textContent = title;
        document.getElementById('custom-alert-message').textContent = message;
        
        const iconEl = document.getElementById('custom-alert-icon');
        iconEl.textContent = icon;
        iconEl.style.color = iconColor;
        
        const btnOk = document.getElementById('btn-custom-alert-ok');
        
        const handleOk = () => {
            btnOk.removeEventListener('click', handleOk);
            modal.close();
            resolve();
        };
        
        btnOk.addEventListener('click', handleOk);
        modal.showModal();
    });
};

window.customConfirm = function(message, title = "Confirm Action") {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-confirm');
        document.getElementById('custom-confirm-title').textContent = title;
        document.getElementById('custom-confirm-message').textContent = message;
        
        const btnOk = document.getElementById('btn-custom-confirm-ok');
        const btnCancel = document.getElementById('btn-custom-confirm-cancel');
        
        const cleanup = () => {
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
            modal.close();
        };
        
        const handleOk = () => { cleanup(); resolve(true); };
        const handleCancel = () => { cleanup(); resolve(false); };
        
        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
        
        modal.showModal();
    });
};

// --- NATIVE SWIPE-TO-ACTION ENGINE ---
let activeSwipeElement = null;
let startX = 0;
let currentX = 0;
const SWIPE_THRESHOLD = 50; 
const MAX_SWIPE = 140; 

document.addEventListener('touchstart', (e) => {
    if (window.innerWidth > 900) return; 
    
    if (e.target.closest('.swipe-action-btn')) return;

    const targetSwipeContent = e.target.closest('.swipe-content');
    
    if (activeSwipeElement && activeSwipeElement !== targetSwipeContent) {
        activeSwipeElement.style.transform = `translateX(0px)`;
        activeSwipeElement.classList.remove('is-swiped');
        activeSwipeElement = null;
    }

    if (!targetSwipeContent) return;

    startX = e.touches[0].clientX;
    currentX = startX;
    activeSwipeElement = targetSwipeContent;
    activeSwipeElement.style.transition = 'none'; 
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!activeSwipeElement) return;
    currentX = e.touches[0].clientX;
    const diffX = currentX - startX;
    
    if (diffX < 0) {
        let translateX = diffX;
        if (translateX < -MAX_SWIPE - 20) translateX = -MAX_SWIPE - 20; 
        activeSwipeElement.style.transform = `translateX(${translateX}px)`;
        
        // Dynamically snap the right border flat when pulled
        if (translateX < -5) {
            activeSwipeElement.classList.add('is-swiped');
        } else {
            activeSwipeElement.classList.remove('is-swiped');
        }
    } else {
        activeSwipeElement.style.transform = `translateX(0px)`;
        activeSwipeElement.classList.remove('is-swiped');
    }
}, { passive: true });

document.addEventListener('touchend', (e) => {
    if (!activeSwipeElement) return;
    
    activeSwipeElement.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    const diffX = currentX - startX;
    
    if (diffX < -SWIPE_THRESHOLD) {
        activeSwipeElement.style.transform = `translateX(-${MAX_SWIPE}px)`;
        activeSwipeElement.classList.add('is-swiped');
    } else {
        activeSwipeElement.style.transform = `translateX(0px)`;
        activeSwipeElement.classList.remove('is-swiped');
        activeSwipeElement = null;
    }
});

document.addEventListener('click', (e) => {
    if (e.target.closest('.swipe-action-btn')) {
        if (activeSwipeElement) {
            activeSwipeElement.style.transform = `translateX(0px)`;
            activeSwipeElement.classList.remove('is-swiped');
            activeSwipeElement = null;
        }
    }
});

// --- Formatters ---
function formatCurrency(amount) {
    const decSep = appData.settings?.decimalSep || '.';
    const thouSep = appData.settings?.thousandSep || ',';
    let val = Number(amount) || 0;
    let isNeg = val < 0;
    let absVal = Math.abs(val);
    
    let [intPart, decPart] = absVal.toFixed(2).split('.');
    
    if (thouSep !== 'none') {
        let sep = thouSep === 'space' ? ' ' : thouSep;
        intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    }
    
    let valStr = intPart;
    if (decSep !== 'none') {
        valStr += decSep + decPart;
    }
    
    return (isNeg ? '-' : '') + (appData.currentCurrency || '₱') + valStr;
}

function formatDate(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return "Invalid Date";
    const format = appData.settings?.dateFormat || 'MM-DD-YYYY';
    const sep = appData.settings?.dateSep || '-';
    
    if (format === 'long') {
        return dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();

    if (format === 'MM-DD-YYYY') return `${mm}${sep}${dd}${sep}${yyyy}`;
    if (format === 'DD-MM-YYYY') return `${dd}${sep}${mm}${sep}${yyyy}`;
    if (format === 'YYYY-MM-DD') return `${yyyy}${sep}${mm}${sep}${dd}`;
    
    return `${mm}${sep}${dd}${sep}${yyyy}`;
}

function formatNumberLive(val) {
    if (val === undefined || val === null) return '';
    let rawVal = val.toString().replace(/,/g, '');
    rawVal = rawVal.replace(/[^0-9.-]/g, '');
    let isNegative = rawVal.startsWith('-');
    if (isNegative) rawVal = rawVal.substring(1);
    if (rawVal.split('.').length > 2) rawVal = rawVal.replace(/\.+$/, '');
    let parts = rawVal.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let finalVal = parts.join('.');
    return isNegative ? '-' + finalVal : finalVal;
}

function parseFormattedNumber(val) {
    if (!val) return 0;
    return parseFloat(val.toString().replace(/,/g, '')) || 0;
}

window.toggleLogs = function(btn) {
    const list = btn.previousElementSibling;
    list.classList.toggle('expanded');
    if(list.classList.contains('expanded')) {
        btn.innerText = "Show less";
    } else {
        const total = list.querySelectorAll('.payment-history-item').length;
        btn.innerText = `Show all ${total} logs`;
    }
}

// --- Sidebar Toggle & Persistence Logic ---
const sidebar = document.getElementById('app-sidebar');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const sidebarIcon = document.getElementById('sidebar-icon');

const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
if (isCollapsed) { sidebar.classList.add('collapsed'); sidebarIcon.textContent = 'left_panel_open'; }

btnToggleSidebar.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  const collapsed = sidebar.classList.contains('collapsed');
  localStorage.setItem('sidebarCollapsed', collapsed);
  sidebarIcon.textContent = collapsed ? 'left_panel_open' : 'left_panel_close';
});

// --- Theme Toggle Logic ---
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const themeText = document.getElementById('theme-text');
const mobileDarkToggle = document.getElementById('setting-dark-mode-toggle');

const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  document.body.setAttribute('data-theme', 'dark');
  themeIcon.textContent = 'light_mode';
  themeText.textContent = 'Light Mode';
  if(mobileDarkToggle) {
      mobileDarkToggle.checked = true;
      document.getElementById('mobile-theme-icon').textContent = 'light_mode';
      document.getElementById('mobile-theme-text').textContent = 'Light Mode';
  }
}

btnThemeToggle.addEventListener('click', () => {
  const currentTheme = document.body.getAttribute('data-theme');
  if (currentTheme === 'dark') {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeIcon.textContent = 'dark_mode';
    themeText.textContent = 'Dark Mode';
    if(mobileDarkToggle) {
        mobileDarkToggle.checked = false;
        document.getElementById('mobile-theme-icon').textContent = 'dark_mode';
        document.getElementById('mobile-theme-text').textContent = 'Dark Mode';
    }
  } else {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeIcon.textContent = 'light_mode';
    themeText.textContent = 'Light Mode';
    if(mobileDarkToggle) {
        mobileDarkToggle.checked = true;
        document.getElementById('mobile-theme-icon').textContent = 'light_mode';
        document.getElementById('mobile-theme-text').textContent = 'Light Mode';
    }
  }
});

if(mobileDarkToggle) {
    mobileDarkToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeIcon.textContent = 'light_mode';
            themeText.textContent = 'Light Mode';
            document.getElementById('mobile-theme-icon').textContent = 'light_mode';
            document.getElementById('mobile-theme-text').textContent = 'Light Mode';
        } else {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeIcon.textContent = 'dark_mode';
            themeText.textContent = 'Dark Mode';
            document.getElementById('mobile-theme-icon').textContent = 'dark_mode';
            document.getElementById('mobile-theme-text').textContent = 'Dark Mode';
        }
    });
}

// --- DATA RECOVERY & INTEGRATION ENGINE ---
function loadDataLocally() {
  try {
    const dataStr = localStorage.getItem('salaryTrackerV2');
    if (dataStr) {
      const parsed = JSON.parse(dataStr);
      if (parsed && typeof parsed === 'object') {
        appData = { ...appData, ...parsed }; 
      }
      
      if (!Array.isArray(appData.boards)) appData.boards = [];
      if (!Array.isArray(appData.payables)) appData.payables = [];
      if (!Array.isArray(appData.receivables)) appData.receivables = [];
      if (!Array.isArray(appData.savings)) appData.savings = [];
      if (!appData.settings) appData.settings = { decimalSep: '.', thousandSep: ',', dateFormat: 'MM-DD-YYYY', dateSep: '-' };
      
      appData.boards.forEach(b => {
        if(!b.expenseCategories) b.expenseCategories = [];
        if(!b.trackingData) b.trackingData = [];
        b.expenseCategories.forEach(c => { if (c.hasGoal === undefined) { c.hasGoal = true; c.note = ""; } });
        b.trackingData.forEach(t => {
          if(!t.expenses) t.expenses = {};
          Object.keys(t.expenses).forEach(catId => {
            let val = t.expenses[catId];
            if (typeof val === 'number' || typeof val === 'string') { 
              t.expenses[catId] = { amount: parseFloat(val) || 0, status: 'pending', comment: "" }; 
            } else if (typeof val === 'object') {
              if (val.comment === undefined) val.comment = "";
            }
          });
        });
      });
    } else {
      const legacyStr = localStorage.getItem('salaryTrackerData');
      if (legacyStr) {
        const parsed = JSON.parse(legacyStr);
        const importedBoard = { 
          id: 'board_' + Date.now(), 
          name: 'My Tracker', 
          trackingData: parsed.trackingData || [], 
          expenseCategories: parsed.expenseCategories || [] 
        };
        importedBoard.expenseCategories.forEach(c => { c.hasGoal = true; c.note = ""; });
        importedBoard.trackingData.forEach(t => {
          if(!t.expenses) t.expenses = {};
          Object.keys(t.expenses).forEach(catId => { 
            t.expenses[catId] = { amount: parseFloat(t.expenses[catId]) || 0, status: 'pending', comment: "" }; 
          });
        });
        appData.boards.push(importedBoard); 
        appData.currentCurrency = parsed.currentCurrency || '₱'; 
        saveDataLocally();
      }
    }
  } catch (e) {
    console.error("Data Recovery Error:", e);
  }
}

function saveDataLocally() { localStorage.setItem('salaryTrackerV2', JSON.stringify(appData)); }

function getActiveBoard() { 
    if (appData.boards.length === 0) {
        appData.boards.push({ id: 'board_' + Date.now(), name: 'My Tracker', trackingData: [], expenseCategories: [] });
        saveDataLocally();
    }
    return appData.boards[0]; 
}

function getSafeExpenseObj(item, catId) {
  if (!item.expenses) item.expenses = {};
  if (!item.expenses[catId]) {
    item.expenses[catId] = { amount: 0, status: 'pending', comment: "" };
  }
  return item.expenses[catId];
}

// --- DOM Elements ---
const dashboard = document.getElementById('dashboard-container');
const monthFilterContainer = document.getElementById('month-filter-container');
const currentViewTitle = document.getElementById('current-view-title');
const topBarActions = document.getElementById('top-bar-actions');
const bottomNavBtns = document.querySelectorAll('.bottom-nav .nav-item[data-target]');

const views = {
  budgets: document.getElementById('view-budgets'),
  payables: document.getElementById('view-payables'),
  receivables: document.getElementById('view-receivables'),
  savings: document.getElementById('view-savings'),
  settings: document.getElementById('view-settings') 
};

const navBtns = {
  budgets: document.getElementById('nav-budgets'),
  payables: document.getElementById('nav-payables'),
  receivables: document.getElementById('nav-receivables'),
  savings: document.getElementById('nav-savings'),
  settings: document.getElementById('btn-settings')
};

const modals = {
  addPayout: document.getElementById('modal-add-payout'), 
  category: document.getElementById('modal-category'), 
  editCategory: document.getElementById('modal-edit-category'), 
  editPayout: document.getElementById('modal-edit-payout'),
  comment: document.getElementById('modal-comment'),
  addPayable: document.getElementById('modal-add-payable'),
  editPayable: document.getElementById('modal-edit-payable'),
  logPayment: document.getElementById('modal-log-payment'),
  editPayment: document.getElementById('modal-edit-payment'),
  addRecAccount: document.getElementById('modal-add-rec-account'),
  addDebt: document.getElementById('modal-add-debt'),
  editDebt: document.getElementById('modal-edit-debt'),
  logRecPayment: document.getElementById('modal-log-rec-payment'),
  editRecPayment: document.getElementById('modal-edit-rec-payment'),
  addSavAccount: document.getElementById('modal-add-savings-account'),
  logSavTxn: document.getElementById('modal-log-savings-txn'),
  filterPayouts: document.getElementById('modal-filter-payouts'),
  settings: document.getElementById('modal-settings')
};

// --- Custom Select Wrapper Engine ---
window.closeAllCustomSelects = function() {
    document.querySelectorAll('.custom-select-wrapper.open').forEach(wrapper => {
        wrapper.classList.remove('open');
    });
    
    // Return ALL options back to their original wrappers (whether they were in body or dialog)
    document.querySelectorAll('.custom-select-options').forEach(opts => {
        if (opts.wrapperRef && opts.parentNode !== opts.wrapperRef) {
            opts.style.setProperty('display', 'none', 'important');
            opts.style.position = '';
            opts.style.top = '';
            opts.style.bottom = '';
            opts.style.left = '';
            opts.style.width = '';
            opts.style.zIndex = '';
            opts.wrapperRef.appendChild(opts);
        }
    });
};

document.addEventListener('click', window.closeAllCustomSelects);
document.addEventListener('scroll', window.closeAllCustomSelects, true);

function convertSelectsToCustom(container) {
    const selects = (container || document).querySelectorAll('select:not(.custom-select-hidden)');
    selects.forEach(select => {
        select.classList.add('custom-select-hidden');

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        
        // CRITICAL FIX: Prevent copying the trigger class to the wrapper to stop the double-box glitch!
        select.classList.forEach(cls => {
            if(cls !== 'custom-select-hidden' && cls !== 'custom-select-trigger') {
                wrapper.classList.add(cls);
            }
        });
        
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        
        const selectedOption = select.options[select.selectedIndex];
        const displaySpan = document.createElement('span');
        displaySpan.className = 'custom-select-display';
        displaySpan.textContent = selectedOption ? selectedOption.text : '';
        
        const arrow = document.createElement('span');
        arrow.className = 'material-symbols-outlined dropdown-arrow';
        arrow.textContent = 'chevron_right';

        trigger.appendChild(displaySpan);
        trigger.appendChild(arrow);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'custom-select-options';
        optionsDiv.wrapperRef = wrapper; // Save reference for clean up

        Array.from(select.options).forEach(option => {
            const optDiv = document.createElement('div');
            optDiv.className = 'custom-select-option';
            if (option.selected) optDiv.classList.add('selected');
            optDiv.textContent = option.text;
            optDiv.dataset.value = option.value;
            
            optDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                select.value = option.value;
                displaySpan.textContent = option.text;
                
                optionsDiv.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
                optDiv.classList.add('selected');
                
                window.closeAllCustomSelects(); // Properly resets the layout
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            optionsDiv.appendChild(optDiv);
        });

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.contains('open');
            window.closeAllCustomSelects(); 
            
            if (!isOpen) {
                wrapper.classList.add('open');
                
                // Append to dialog if inside one to beat z-index traps
                const parentDialog = trigger.closest('dialog');
                const appendTarget = parentDialog ? parentDialog : document.body;
                appendTarget.appendChild(optionsDiv); 
                
                const rect = trigger.getBoundingClientRect();
                
                // Exactly match the input width so it never spills over modal borders
                const dropdownWidth = rect.width; 
                
                optionsDiv.style.position = 'fixed';
                optionsDiv.style.width = dropdownWidth + 'px';
                optionsDiv.style.left = rect.left + 'px';
                optionsDiv.style.zIndex = '999999';
                
                // Forces visibility to beat the CSS !important rule
                optionsDiv.style.setProperty('display', 'flex', 'important'); 
                
                const optsHeight = optionsDiv.scrollHeight || 200;
                
                // Smart direction drop: Check if there's enough space at the bottom
                if (rect.bottom + optsHeight + 20 > window.innerHeight) {
                    optionsDiv.style.top = 'auto';
                    optionsDiv.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
                } else {
                    optionsDiv.style.top = (rect.bottom + 4) + 'px';
                    optionsDiv.style.bottom = 'auto';
                }
            }
        });

        wrapper.appendChild(trigger);
        wrapper.appendChild(optionsDiv);
        select.parentNode.insertBefore(wrapper, select.nextSibling);
    });
}

function updateCustomSelectOptions(selectElement) {
    if(!selectElement) return;
    const wrapper = selectElement.nextElementSibling;
    if (wrapper && wrapper.classList.contains('custom-select-wrapper')) {
        const optionsDiv = wrapper.optionsDivRef || wrapper.querySelector('.custom-select-options');
        if(!optionsDiv) return;
        
        optionsDiv.innerHTML = ''; 
        
        Array.from(selectElement.options).forEach(option => {
            const optDiv = document.createElement('div');
            optDiv.className = 'custom-select-option';
            if (option.selected) optDiv.classList.add('selected');
            optDiv.textContent = option.text;
            optDiv.dataset.value = option.value;
            
            optDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                selectElement.value = option.value;
                wrapper.querySelector('.custom-select-display').textContent = option.text;
                optionsDiv.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
                optDiv.classList.add('selected');
                
                window.closeAllCustomSelects(); // Properly resets the layout
                selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            });
            optionsDiv.appendChild(optDiv);
        });
        
        const selectedOpt = selectElement.options[selectElement.selectedIndex];
        if (selectedOpt) {
            wrapper.querySelector('.custom-select-display').textContent = selectedOpt.text;
        } else {
            wrapper.querySelector('.custom-select-display').textContent = '';
        }
    }
}

function syncCustomSelect(selectElement) {
    if(!selectElement) return;
    const wrapper = selectElement.nextElementSibling;
    if (wrapper && wrapper.classList.contains('custom-select-wrapper')) {
        const display = wrapper.querySelector('.custom-select-display');
        const selectedOpt = selectElement.options[selectElement.selectedIndex];
        if (display && selectedOpt) display.textContent = selectedOpt.text;
        
        wrapper.querySelectorAll('.custom-select-option').forEach(opt => {
            if (opt.dataset.value === selectElement.value) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    }
}

// --- Upcoming Date Helper ---
function getUpcomingItem(boardData) {
  const now = new Date(); 
  now.setHours(0,0,0,0); 
  const nowTime = now.getTime();
  return [...boardData].sort((a,b) => a.timestamp - b.timestamp).find(t => t.timestamp >= nowTime);
}

function setDefaultFilters(board) {
  if (board && board.trackingData && board.trackingData.length > 0) {
    const upcomingItem = getUpcomingItem(board.trackingData);
    if (upcomingItem) {
      const d = new Date(upcomingItem.timestamp);
      activeYearFilter = d.getFullYear().toString();
      activeMonthFilter = upcomingItem.type === 'SPECIAL PAYOUT' ? 'SPECIAL' : d.toLocaleDateString('en-US', { month: 'long' });
      activePayoutId = upcomingItem.id;
    } else {
      const sortedData = [...board.trackingData].sort((a,b) => b.timestamp - a.timestamp);
      const d = new Date(sortedData[0].timestamp);
      activeYearFilter = d.getFullYear().toString();
      activeMonthFilter = sortedData[0].type === 'SPECIAL PAYOUT' ? 'SPECIAL' : d.toLocaleDateString('en-US', { month: 'long' });
      activePayoutId = sortedData[0].id;
    }
  } else {
    activeYearFilter = 'All';
    activeMonthFilter = 'All';
    activePayoutId = null;
  }
}

// --- Initialization ---
loadDataLocally();
setDefaultFilters(getActiveBoard());

// --- Main Navigation & Settings Engine ---
window.openSettingsModal = function() {
    document.getElementById('select-currency').value = appData.currentCurrency;
    syncCustomSelect(document.getElementById('select-currency'));
    
    if (!appData.settings) appData.settings = { decimalSep: '.', thousandSep: ',', dateFormat: 'MM-DD-YYYY', dateSep: '-' };
    document.getElementById('select-decimal-sep').value = appData.settings.decimalSep;
    document.getElementById('select-thousand-sep').value = appData.settings.thousandSep || ',';
    document.getElementById('select-date-format').value = appData.settings.dateFormat;
    document.getElementById('select-date-sep').value = appData.settings.dateSep;
    
    syncCustomSelect(document.getElementById('select-decimal-sep'));
    syncCustomSelect(document.getElementById('select-thousand-sep'));
    syncCustomSelect(document.getElementById('select-date-format'));
    syncCustomSelect(document.getElementById('select-date-sep'));

    const form = document.getElementById('form-settings');
    const modal = document.getElementById('modal-settings');
    const view = document.getElementById('view-settings');

    if (window.innerWidth > 900) {
        modal.appendChild(form); 
        document.getElementById('settings-dialog-actions').style.display = 'flex';
        document.getElementById('desktop-settings-title').style.display = 'block';
        modals.settings.showModal();
    } else {
        view.appendChild(form); 
        document.getElementById('settings-dialog-actions').style.display = 'none';
        document.getElementById('desktop-settings-title').style.display = 'none';

        currentViewTitle.textContent = "Settings";
        topBarActions.innerHTML = `<button type="submit" form="form-settings" class="btn btn-filled">Save Preferences</button>`;
        
        currentView = 'settings';
        Object.keys(navBtns).forEach(key => { if (navBtns[key]) navBtns[key].classList.remove('active'); });
        if (navBtns['settings']) navBtns['settings'].classList.add('active');
        
        bottomNavBtns.forEach(btn => {
            if (btn.getAttribute('data-target') === 'settings') btn.classList.add('active');
            else btn.classList.remove('active');
        });

        Object.keys(views).forEach(key => {
            if (views[key]) {
                if (key === 'settings') views[key].classList.add('active');
                else views[key].classList.remove('active');
            }
        });
    }
};

// Toggle Contextual Items for FAB Menu
function updateFabMenu(viewName) {
    document.querySelectorAll('.fab-item-budget').forEach(el => el.style.display = viewName === 'budgets' ? 'flex' : 'none');
    document.querySelectorAll('.fab-item-payable').forEach(el => el.style.display = viewName === 'payables' ? 'flex' : 'none');
    document.querySelectorAll('.fab-item-receivable').forEach(el => el.style.display = viewName === 'receivables' ? 'flex' : 'none');
    document.querySelectorAll('.fab-item-saving').forEach(el => el.style.display = viewName === 'savings' ? 'flex' : 'none');
}

function switchView(viewName) {
  if (viewName === 'settings') {
      openSettingsModal();
      return; 
  }

  currentView = viewName;
  
  // Close FAB menu on mobile view switch
  if(window.innerWidth <= 900) {
      closeFabMenu();
      updateFabMenu(viewName);
  }
  
  Object.keys(navBtns).forEach(key => {
    if (navBtns[key]) {
      if (key === viewName) navBtns[key].classList.add('active');
      else navBtns[key].classList.remove('active');
    }
  });
  
  bottomNavBtns.forEach(btn => {
    if (btn.getAttribute('data-target') === viewName) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  Object.keys(views).forEach(key => {
    if (views[key]) {
      if (key === viewName) views[key].classList.add('active');
      else views[key].classList.remove('active');
    }
  });

  if (viewName === 'budgets') {
    currentViewTitle.textContent = getActiveBoard().name;
    topBarActions.innerHTML = `<button class="btn btn-filled desktop-only" id="btn-add-payout"><span class="material-symbols-outlined">add</span> Add Payout</button>`;
    document.getElementById('btn-add-payout').addEventListener('click', () => modals.addPayout.showModal());
    renderDashboard();
  } else if (viewName === 'payables') {
    currentViewTitle.textContent = viewCompletedPayables ? "Completed Payables" : "Payables";
    topBarActions.innerHTML = `
      <button class="btn btn-tonal" id="btn-toggle-payables-history">
          <span class="material-symbols-outlined">${viewCompletedPayables ? 'arrow_back' : 'history'}</span> 
          ${viewCompletedPayables ? 'Active' : 'History'}
      </button>
      <button class="btn btn-filled desktop-only" id="btn-add-payable"><span class="material-symbols-outlined">add</span> Add Payable</button>
    `;
    document.getElementById('btn-add-payable').addEventListener('click', () => modals.addPayable.showModal());
    document.getElementById('btn-toggle-payables-history').addEventListener('click', () => {
        viewCompletedPayables = !viewCompletedPayables;
        switchView('payables');
    });
    renderPayables();
  } else if (viewName === 'receivables') {
    currentViewTitle.textContent = viewCompletedReceivables ? "Completed Receivables" : "Receivables";
    topBarActions.innerHTML = `
      <button class="btn btn-tonal" id="btn-toggle-receivables-history">
          <span class="material-symbols-outlined">${viewCompletedReceivables ? 'arrow_back' : 'history'}</span> 
          ${viewCompletedReceivables ? 'Active' : 'History'}
      </button>
      <button class="btn btn-filled desktop-only" id="btn-add-rec-account"><span class="material-symbols-outlined">add</span> Add Receivable</button>
    `;
    document.getElementById('btn-add-rec-account').addEventListener('click', () => modals.addRecAccount.showModal());
    document.getElementById('btn-toggle-receivables-history').addEventListener('click', () => {
        viewCompletedReceivables = !viewCompletedReceivables;
        switchView('receivables');
    });
    renderReceivables();
  } else if (viewName === 'savings') {
    currentViewTitle.textContent = "Savings";
    topBarActions.innerHTML = `<button class="btn btn-filled desktop-only" id="btn-add-savings-account"><span class="material-symbols-outlined">add</span> Add Account</button>`;
    document.getElementById('btn-add-savings-account').addEventListener('click', () => modals.addSavAccount.showModal());
    renderSavings();
  } 
}

// Bind Sidebar buttons
Object.keys(navBtns).forEach(key => {
  if (navBtns[key]) navBtns[key].addEventListener('click', () => switchView(key));
});

// Bind Bottom Nav buttons
bottomNavBtns.forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.getAttribute('data-target')));
});

// --- NEW MOBILE ACTIONS (FAB AND HEADER) ---
const btnMobileSettings = document.getElementById('btn-mobile-settings');
if (btnMobileSettings) {
    btnMobileSettings.addEventListener('click', () => openSettingsModal());
}

const mainNavFab = document.getElementById('main-nav-fab');
const fabMenu = document.getElementById('fab-menu');
const fabBackdrop = document.getElementById('fab-backdrop');

function closeFabMenu() {
    if(mainNavFab) mainNavFab.classList.remove('active');
    if(fabMenu) fabMenu.classList.remove('active');
    if(fabBackdrop) fabBackdrop.classList.remove('active');
}

if (mainNavFab && fabMenu) {
    mainNavFab.addEventListener('click', (e) => {
        e.stopPropagation();
        mainNavFab.classList.toggle('active');
        fabMenu.classList.toggle('active');
        if(fabBackdrop) fabBackdrop.classList.toggle('active');
    });

    document.getElementById('fab-wrapper-payout')?.addEventListener('click', (e) => {
        e.stopPropagation();
        modals.addPayout.showModal();
        closeFabMenu();
    });

    document.getElementById('fab-wrapper-category')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openCategoryModal();
        closeFabMenu();
    });
    
    document.getElementById('fab-wrapper-payable')?.addEventListener('click', (e) => {
        e.stopPropagation();
        modals.addPayable.showModal();
        closeFabMenu();
    });

    document.getElementById('fab-wrapper-receivable')?.addEventListener('click', (e) => {
        e.stopPropagation();
        modals.addRecAccount.showModal();
        closeFabMenu();
    });

    document.getElementById('fab-wrapper-saving')?.addEventListener('click', (e) => {
        e.stopPropagation();
        modals.addSavAccount.showModal();
        closeFabMenu();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-fab-wrapper')) {
            closeFabMenu();
        }
    });
}


// --- GLOBAL DELETE FUNCTIONS EXTRACTED FOR SWIPE ACTIONS ---
window.deletePayout = async function(id) {
    if (!(await customConfirm("Are you sure you want to delete this payout?", "Delete Payout?"))) return;
    const board = getActiveBoard(); 
    board.trackingData = board.trackingData.filter(t => t.id !== id);
    saveDataLocally(); 
    setDefaultFilters(board);
    renderDashboard();
};

window.openEditRecAccount = async function(id) {
    const acc = appData.receivables.find(x => x.id === id);
    if(acc) {
        const newTitle = prompt("Edit Title:", acc.title); 
        if(newTitle && newTitle.trim() !== '') { 
            acc.title = newTitle.trim(); 
            saveDataLocally(); 
            renderReceivables(); 
        }
    }
}

window.openEditSavAccount = async function(id) {
    const acc = appData.savings.find(x => x.id === id);
    if(acc) {
        const newTitle = prompt("Edit Account Name:", acc.accountName);
        if(newTitle && newTitle.trim() !== '') { 
            acc.accountName = newTitle.trim(); 
            saveDataLocally(); 
            renderSavings(); 
        }
    }
}

window.promptDeleteCategory = async function(id) {
    if(!(await customConfirm("Delete this category and all its entries across payouts?", "Delete Category?"))) return;
    const board = getActiveBoard();
    board.expenseCategories = board.expenseCategories.filter(c => c.id !== id); 
    board.trackingData.forEach(item => delete item.expenses[id]);
    saveDataLocally(); 
    renderDashboard();
};


// --- PAYABLES ENGINE ---
document.getElementById('payable-total').addEventListener('input', calculateAmortizationPreview);
document.getElementById('payable-period').addEventListener('input', calculateAmortizationPreview);

function calculateAmortizationPreview() {
  const total = parseFloat(document.getElementById('payable-total').value) || 0;
  const period = parseInt(document.getElementById('payable-period').value) || 0;
  const amortInput = document.getElementById('payable-amortization');
  
  if (period > 0 && total > 0) {
    amortInput.value = formatCurrency(total / period);
  } else {
    amortInput.value = '';
  }
}

document.getElementById('form-add-payable').addEventListener('submit', (e) => {
  const title = document.getElementById('payable-title').value.trim();
  const total = parseFloat(document.getElementById('payable-total').value) || 0;
  const period = parseInt(document.getElementById('payable-period').value) || null;
  
  let amort = null;
  if (period && period > 0) {
    amort = parseFloat((total / period).toFixed(2));
  }

  const newPayable = {
    id: 'pay_' + Date.now(),
    title: title,
    totalAmount: total,
    installmentPeriod: period,
    amortization: amort,
    payments: []
  };

  if(!appData.payables) appData.payables = [];
  appData.payables.push(newPayable);
  
  document.getElementById('payable-title').value = '';
  document.getElementById('payable-total').value = '';
  document.getElementById('payable-period').value = '';
  document.getElementById('payable-amortization').value = '';
  
  saveDataLocally();
  renderPayables();
});

// Edit Payable Logic
document.getElementById('edit-payable-total').addEventListener('input', calculateEditAmortizationPreview);
document.getElementById('edit-payable-period').addEventListener('input', calculateEditAmortizationPreview);

function calculateEditAmortizationPreview() {
  const total = parseFloat(document.getElementById('edit-payable-total').value) || 0;
  const period = parseInt(document.getElementById('edit-payable-period').value) || 0;
  const amortInput = document.getElementById('edit-payable-amortization');
  if (period > 0 && total > 0) { amortInput.value = formatCurrency(total / period); } 
  else { amortInput.value = ''; }
}

window.openEditPayable = function(id) {
    const p = appData.payables.find(x => x.id === id);
    if(!p) return;
    document.getElementById('edit-payable-id').value = p.id;
    document.getElementById('edit-payable-title').value = p.title;
    document.getElementById('edit-payable-total').value = p.totalAmount;
    document.getElementById('edit-payable-period').value = p.installmentPeriod || '';
    calculateEditAmortizationPreview();
    modals.editPayable.showModal();
}

document.getElementById('form-edit-payable').addEventListener('submit', (e) => {
    const id = document.getElementById('edit-payable-id').value;
    const title = document.getElementById('edit-payable-title').value.trim();
    const total = parseFloat(document.getElementById('edit-payable-total').value) || 0;
    const period = parseInt(document.getElementById('edit-payable-period').value) || null;
    let amort = null;
    if (period && period > 0) { amort = parseFloat((total / period).toFixed(2)); }

    const p = appData.payables.find(x => x.id === id);
    if(p) {
        p.title = title;
        p.totalAmount = total;
        p.installmentPeriod = period;
        p.amortization = amort;
        saveDataLocally();
        renderPayables();
    }
});

window.deletePayable = async function(id) {
    if(!(await customConfirm("Are you sure you want to delete this payable and all its payment history?", "Delete Payable?"))) return;
    appData.payables = appData.payables.filter(x => x.id !== id);
    saveDataLocally();
    renderPayables();
}


// Add/Log Payment Logic
window.openLogPayment = function(payableId) {
  document.getElementById('log-payment-id').value = payableId;
  
  const p = appData.payables.find(x => x.id === payableId);
  let preFill = p.amortization || 0;
  if (!preFill) {
     const totalPaid = p.payments.reduce((s, pay) => s + pay.amount, 0);
     preFill = p.totalAmount - totalPaid;
  }
  
  document.getElementById('log-payment-amount').value = preFill > 0 ? preFill : '';
  document.getElementById('log-payment-date').value = new Date().toISOString().split('T')[0];
  
  modals.logPayment.showModal();
}

document.getElementById('form-log-payment').addEventListener('submit', (e) => {
  const pId = document.getElementById('log-payment-id').value;
  const amount = parseFloat(document.getElementById('log-payment-amount').value) || 0;
  const dateStr = document.getElementById('log-payment-date').value;
  
  const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(y, m - 1, d);
  
  const p = appData.payables.find(x => x.id === pId);
  if (p) {
    p.payments.push({
      id: 'pmt_' + Date.now(),
      amount: amount,
      date: dateStr,
      timestamp: dateObj.getTime()
    });
    saveDataLocally();
    renderPayables();
  }
});

// Edit/Delete Payment Logic
window.openEditPayment = function(payId, pmtId) {
    const p = appData.payables.find(x => x.id === payId);
    if(!p) return;
    const pmt = p.payments.find(x => x.id === pmtId);
    if(!pmt) return;
    
    document.getElementById('edit-payment-payable-id').value = payId;
    document.getElementById('edit-payment-id').value = pmtId;
    document.getElementById('edit-payment-amount').value = pmt.amount;
    document.getElementById('edit-payment-date').value = pmt.date;
    
    modals.editPayment.showModal();
}

document.getElementById('form-edit-payment').addEventListener('submit', (e) => {
    const payId = document.getElementById('edit-payment-payable-id').value;
    const pmtId = document.getElementById('edit-payment-id').value;
    const amount = parseFloat(document.getElementById('edit-payment-amount').value) || 0;
    const dateStr = document.getElementById('edit-payment-date').value;
    
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(y, m - 1, d);
    
    const p = appData.payables.find(x => x.id === payId);
    if (p) {
        const pmt = p.payments.find(x => x.id === pmtId);
        if(pmt) {
            pmt.amount = amount;
            pmt.date = dateStr;
            pmt.timestamp = dateObj.getTime();
            saveDataLocally();
            renderPayables();
        }
    }
});

window.deletePayment = async function(payId, pmtId) {
    if(!(await customConfirm("Delete this payment record?", "Delete Payment?"))) return;
    const p = appData.payables.find(x => x.id === payId);
    if(p) {
        p.payments = p.payments.filter(x => x.id !== pmtId);
        saveDataLocally();
        renderPayables();
    }
}


function renderPayables() {
  const container = document.getElementById('payables-container');
  if (!appData.payables) appData.payables = [];

  const filteredPayables = appData.payables.filter(p => {
      const totalPaid = p.payments.reduce((s, pay) => s + pay.amount, 0);
      const remaining = Math.max(0, p.totalAmount - totalPaid);
      const isCompleted = remaining <= 0;
      return viewCompletedPayables ? isCompleted : !isCompleted;
  });

  if (filteredPayables.length === 0) {
    if (viewCompletedPayables) {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; margin-top: 5vh;"><h2>No Completed History</h2><p>You have no fully paid payables yet.</p></div>`;
    } else {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; margin-top: 5vh;"><h2>No Active Payables</h2><p>Click "Add Payable" to start tracking debts or installments.</p></div>`;
    }
    return;
  }

  let html = '';
  filteredPayables.forEach(p => {
    try {
        const totalPaid = p.payments.reduce((s, pay) => s + pay.amount, 0);
        const remaining = Math.max(0, p.totalAmount - totalPaid);
        
        let amortText = '';
        let progressText = '';
        
        if (p.installmentPeriod) {
          amortText = `<div class="payable-detail">Amortization: ${formatCurrency(p.amortization)} / mo for ${p.installmentPeriod} mos</div>`;
          progressText = `<div class="payable-detail" style="color: var(--md-sys-color-primary); font-weight: 600;">Paid ${p.payments.length} out of ${p.installmentPeriod}</div>`;
        } else {
          progressText = `<div class="payable-detail" style="color: var(--md-sys-color-primary); font-weight: 600;">${p.payments.length} payment(s) made</div>`;
        }
        
        const sortedPayments = [...p.payments].sort((a,b) => {
          if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
          return b.id > a.id ? 1 : -1;
        });

        let historyHTML = '';
        if (sortedPayments.length > 0) {
          let expandBtnHTML = sortedPayments.length > 3 ? `<button class="btn btn-text btn-expand-logs" onclick="toggleLogs(this)">Show all ${sortedPayments.length} logs</button>` : '';

          historyHTML = `<div class="payment-history-list">` + sortedPayments.map(pmt => `
            <div class="payment-history-item">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div style="font-size: 11px; font-weight: 700; color: var(--md-sys-color-on-surface-variant); text-transform: uppercase; letter-spacing: 0.5px; padding-top: 4px;">Payment Logged</div>
                  <div style="display: flex; gap: 2px;">
                      <button class="btn-icon-small" style="width: 28px; height: 28px; min-width: 28px;" onclick="openEditPayment('${p.id}', '${pmt.id}')" title="Edit"><span class="material-symbols-outlined" style="font-size:15px;">edit</span></button>
                      <button class="btn-icon-small btn-delete-row" style="width: 28px; height: 28px; min-width: 28px;" onclick="deletePayment('${p.id}', '${pmt.id}')" title="Delete"><span class="material-symbols-outlined" style="font-size:15px; color: var(--md-sys-color-error);">delete</span></button>
                  </div>
              </div>
              <div class="ledger-payment" style="font-size: 20px; font-weight: 800; margin: 0 0 4px 0;">${formatCurrency(pmt.amount)}</div>
              <div style="font-size: 12px; font-weight: 600; color: var(--md-sys-color-outline);">${formatDate(new Date(pmt.timestamp))}</div>
            </div>
          `).join('') + `</div>` + expandBtnHTML;
        }

        const isCompleted = remaining <= 0;
        const completedClass = isCompleted ? 'completed-card' : '';
        const watermark = isCompleted ? `<span class="completed-watermark">COMPLETED</span>` : '';

        html += `
          <div class="payable-card ${completedClass}" style="margin-bottom: 24px;">
            <div class="card-inner-content">
                <div class="payable-header" style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-start;">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <h3 style="margin: 0;">${p.title}</h3>
                    ${watermark}
                  </div>
                  <div style="display: flex; gap: 4px; flex-shrink: 0;">
                     <button class="btn-icon-small" onclick="openEditPayable('${p.id}')" title="Edit Payable"><span class="material-symbols-outlined" style="font-size:18px;">edit</span></button>
                     <button class="btn-icon-small btn-delete-row" onclick="deletePayable('${p.id}')" title="Delete Payable"><span class="material-symbols-outlined" style="font-size:18px; color: var(--md-sys-color-error);">delete</span></button>
                  </div>
                </div>
                
                <div class="payable-balance" style="margin-top: 0; padding-top: 0; border-top: none; margin-bottom: 16px;">
                  <h4>Remaining Balance</h4>
                  <div class="amount">${formatCurrency(remaining)}</div>
                  <div class="total">out of ${formatCurrency(p.totalAmount)} total</div>
                </div>
                
                <div style="padding-top: 16px; border-top: 1px dashed var(--md-sys-color-outline); margin-bottom: 16px;">
                  ${amortText}
                  ${progressText}
                </div>
                
                <button class="btn btn-tonal" style="width: 100%; margin-bottom: 8px;" onclick="openLogPayment('${p.id}')" ${isCompleted ? 'disabled' : ''}>
                    <span class="material-symbols-outlined" style="font-size: 18px;">payments</span> Log a Payment
                </button>
                ${historyHTML}
            </div>
          </div>
        `;
    } catch(err) {
        console.error("Error rendering payable:", p, err);
    }
  });
  
  container.innerHTML = html;
}

// --- RECEIVABLES ENGINE ---

document.getElementById('form-add-rec-account').addEventListener('submit', (e) => {
  const title = document.getElementById('rec-account-title').value.trim();
  const newAccount = {
    id: 'rec_' + Date.now(),
    title: title,
    debts: [],
    payments: []
  };
  appData.receivables.push(newAccount);
  document.getElementById('rec-account-title').value = '';
  saveDataLocally();
  renderReceivables();
});

// Receivable Debts Actions
window.openAddDebt = function(accountId) {
  document.getElementById('add-debt-account-id').value = accountId;
  document.getElementById('add-debt-date').value = new Date().toISOString().split('T')[0];
  modals.addDebt.showModal();
}

document.getElementById('form-add-debt').addEventListener('submit', (e) => {
  const accountId = document.getElementById('add-debt-account-id').value;
  const desc = document.getElementById('add-debt-desc').value.trim();
  const amount = parseFloat(document.getElementById('add-debt-amount').value) || 0;
  const dateStr = document.getElementById('add-debt-date').value;
  
  const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(y, m - 1, d);
  
  const account = appData.receivables.find(x => x.id === accountId);
  if (account) {
    if (!Array.isArray(account.debts)) account.debts = [];
    account.debts.push({ id: 'debt_' + Date.now(), desc, amount, date: dateStr, timestamp: dateObj.getTime() });
    document.getElementById('add-debt-desc').value = '';
    document.getElementById('add-debt-amount').value = '';
    saveDataLocally();
    renderReceivables();
  }
});

window.openEditDebt = function(accId, debtId) {
    const acc = appData.receivables.find(x => x.id === accId);
    if (!acc) return;
    const debt = acc.debts.find(x => x.id === debtId);
    if (!debt) return;
    
    document.getElementById('edit-debt-account-id').value = accId;
    document.getElementById('edit-debt-id').value = debtId;
    document.getElementById('edit-debt-desc').value = debt.desc;
    document.getElementById('edit-debt-amount').value = debt.amount;
    document.getElementById('edit-debt-date').value = debt.date;
    modals.editDebt.showModal();
}

document.getElementById('form-edit-debt').addEventListener('submit', (e) => {
    const accId = document.getElementById('edit-debt-account-id').value;
    const debtId = document.getElementById('edit-debt-id').value;
    const desc = document.getElementById('edit-debt-desc').value.trim();
    const amount = parseFloat(document.getElementById('edit-debt-amount').value) || 0;
    const dateStr = document.getElementById('edit-debt-date').value;
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(y, m - 1, d);
    
    const acc = appData.receivables.find(x => x.id === accId);
    if (acc) {
        const debt = acc.debts.find(x => x.id === debtId);
        if (debt) {
            debt.desc = desc;
            debt.amount = amount;
            debt.date = dateStr;
            debt.timestamp = dateObj.getTime();
            saveDataLocally();
            renderReceivables();
        }
    }
});

window.deleteDebt = async function(accId, debtId) {
    if(!(await customConfirm("Delete this receivable item?", "Delete Item?"))) return;
    const acc = appData.receivables.find(x => x.id === accId);
    if(acc) {
        acc.debts = acc.debts.filter(x => x.id !== debtId);
        saveDataLocally();
        renderReceivables();
    }
}

// Receivable Payments Actions
window.openLogRecPayment = function(accountId) {
  document.getElementById('log-rec-payment-account-id').value = accountId;
  document.getElementById('log-rec-payment-date').value = new Date().toISOString().split('T')[0];
  
  // Try to autofill remaining
  const account = appData.receivables.find(x => x.id === accountId);
  const totalDebt = account.debts.reduce((s, debt) => s + debt.amount, 0);
  const totalPaid = account.payments.reduce((s, pay) => s + pay.amount, 0);
  const remaining = totalDebt - totalPaid;
  document.getElementById('log-rec-payment-amount').value = remaining > 0 ? remaining : '';

  modals.logRecPayment.showModal();
}

document.getElementById('form-log-rec-payment').addEventListener('submit', (e) => {
  const accountId = document.getElementById('log-rec-payment-account-id').value;
  const amount = parseFloat(document.getElementById('log-rec-payment-amount').value) || 0;
  const dateStr = document.getElementById('log-rec-payment-date').value;
  const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(y, m - 1, d);
  
  const account = appData.receivables.find(x => x.id === accountId);
  if (account) {
    if (!Array.isArray(account.payments)) account.payments = [];
    account.payments.push({ id: 'rpmt_' + Date.now(), amount, date: dateStr, timestamp: dateObj.getTime() });
    document.getElementById('log-rec-payment-amount').value = '';
    saveDataLocally();
    renderReceivables();
  }
});

window.openEditRecPayment = function(accId, pmtId) {
    const acc = appData.receivables.find(x => x.id === accId);
    if (!acc) return;
    const pmt = acc.payments.find(x => x.id === pmtId);
    if (!pmt) return;
    
    document.getElementById('edit-rec-payment-account-id').value = accId;
    document.getElementById('edit-rec-payment-id').value = pmtId;
    document.getElementById('edit-rec-payment-amount').value = pmt.amount;
    document.getElementById('edit-rec-payment-date').value = pmt.date;
    modals.editRecPayment.showModal();
}

document.getElementById('form-edit-rec-payment').addEventListener('submit', (e) => {
    const accId = document.getElementById('edit-rec-payment-account-id').value;
    const pmtId = document.getElementById('edit-rec-payment-id').value;
    const amount = parseFloat(document.getElementById('edit-rec-payment-amount').value) || 0;
    const dateStr = document.getElementById('edit-rec-payment-date').value;
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(y, m - 1, d);
    
    const acc = appData.receivables.find(x => x.id === accId);
    if (acc) {
        const pmt = acc.payments.find(x => x.id === pmtId);
        if (pmt) {
            pmt.amount = amount;
            pmt.date = dateStr;
            pmt.timestamp = dateObj.getTime();
            saveDataLocally();
            renderReceivables();
        }
    }
});

window.deleteRecPayment = async function(accId, pmtId) {
    if(!(await customConfirm("Delete this payment record?", "Delete Payment?"))) return;
    const acc = appData.receivables.find(x => x.id === accId);
    if(acc) {
        acc.payments = acc.payments.filter(x => x.id !== pmtId);
        saveDataLocally();
        renderReceivables();
    }
}

window.deleteRecAccount = async function(id) {
    if(!(await customConfirm("Delete this entire Receivable account and all its history?", "Delete Account?"))) return;
    appData.receivables = appData.receivables.filter(x => x.id !== id);
    saveDataLocally();
    renderReceivables();
}

function renderReceivables() {
  const container = document.getElementById('receivables-container');
  if (!appData.receivables) appData.receivables = [];

  const filteredReceivables = appData.receivables.filter(r => {
      const totalDebt = r.debts.reduce((s, debt) => s + debt.amount, 0);
      const totalPaid = r.payments.reduce((s, pay) => s + pay.amount, 0);
      const remaining = Math.max(0, totalDebt - totalPaid);
      const isCompleted = remaining <= 0 && totalDebt > 0;
      return viewCompletedReceivables ? isCompleted : !isCompleted;
  });

  if (filteredReceivables.length === 0) {
    if (viewCompletedReceivables) {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; margin-top: 5vh;"><h2>No Completed History</h2><p>You have no fully collected receivables yet.</p></div>`;
    } else {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; margin-top: 5vh;"><h2>No Active Receivables</h2><p>Click "Add Receivable" to start tracking money owed to you.</p></div>`;
    }
    return;
  }

  let html = '';
  filteredReceivables.forEach(r => {
    try {
        const totalDebt = r.debts.reduce((s, debt) => s + debt.amount, 0);
        const totalPaid = r.payments.reduce((s, pay) => s + pay.amount, 0);
        const remaining = Math.max(0, totalDebt - totalPaid);
        
        let ledgerItems = [
            ...r.debts.map(d => ({ ...d, logType: 'debt' })),
            ...r.payments.map(p => ({ ...p, logType: 'payment' }))
        ];
        
        ledgerItems.sort((a,b) => {
            if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
            const timeA = parseInt(a.id.split('_')[1]);
            const timeB = parseInt(b.id.split('_')[1]);
            return timeB - timeA;
        });

        let historyHTML = '';
        if (ledgerItems.length > 0) {
          let expandBtnHTML = ledgerItems.length > 3 ? `<button class="btn btn-text btn-expand-logs" onclick="toggleLogs(this)">Show all ${ledgerItems.length} logs</button>` : '';

          historyHTML = `<div class="payment-history-list">` + ledgerItems.map(item => {
            const isPayment = item.logType === 'payment';
            const displayDesc = isPayment ? "Payment Logged" : item.desc;
            const displayAmount = isPayment ? `- ${formatCurrency(item.amount)}` : `+ ${formatCurrency(item.amount)}`;
            const colorClass = isPayment ? 'ledger-payment' : '';
            const editFunc = isPayment ? `openEditRecPayment('${r.id}', '${item.id}')` : `openEditDebt('${r.id}', '${item.id}')`;
            const delFunc = isPayment ? `deleteRecPayment('${r.id}', '${item.id}')` : `deleteDebt('${r.id}', '${item.id}')`;
            
            return `
            <div class="payment-history-item">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div style="font-size: 11px; font-weight: 700; color: var(--md-sys-color-on-surface-variant); text-transform: uppercase; letter-spacing: 0.5px; padding-top: 4px;">${displayDesc}</div>
                  <div style="display: flex; gap: 2px;">
                      <button class="btn-icon-small" style="width: 28px; height: 28px; min-width: 28px;" onclick="${editFunc}" title="Edit"><span class="material-symbols-outlined" style="font-size:15px;">edit</span></button>
                      <button class="btn-icon-small btn-delete-row" style="width: 28px; height: 28px; min-width: 28px;" onclick="${delFunc}" title="Delete"><span class="material-symbols-outlined" style="font-size:15px; color: var(--md-sys-color-error);">delete</span></button>
                  </div>
              </div>
              <div class="${colorClass}" style="font-size: 20px; font-weight: 800; margin: 0 0 4px 0;">${displayAmount}</div>
              <div style="font-size: 12px; font-weight: 600; color: var(--md-sys-color-outline);">${formatDate(new Date(item.timestamp))}</div>
            </div>
          `}).join('') + `</div>` + expandBtnHTML;
        } else {
            historyHTML = `<div class="payable-detail" style="margin-top: 16px; text-align:center;">No history yet.</div>`;
        }

        const disablePaymentBtn = remaining <= 0 ? 'disabled' : '';
        const isCompleted = remaining <= 0 && totalDebt > 0;
        const completedClass = isCompleted ? 'completed-card' : '';
        const watermark = isCompleted ? `<span class="completed-watermark">COMPLETED</span>` : '';

        html += `
          <div class="payable-card ${completedClass}" style="margin-bottom: 24px;">
            <div class="card-inner-content">
                <div class="payable-header" style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-start;">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <h3 style="margin: 0;">${r.title}</h3>
                      ${watermark}
                  </div>
                  <div style="display: flex; gap: 4px; flex-shrink: 0;">
                     <button class="btn-icon-small" onclick="openEditRecAccount('${r.id}')" title="Edit Title"><span class="material-symbols-outlined" style="font-size:18px;">edit</span></button>
                     <button class="btn-icon-small btn-delete-row" onclick="deleteRecAccount('${r.id}')" title="Delete Account"><span class="material-symbols-outlined" style="font-size:18px; color: var(--md-sys-color-error);">delete</span></button>
                  </div>
                </div>
                
                <div class="payable-balance" style="margin-top: 0; padding-top: 0; border-top: none; margin-bottom: 16px;">
                  <h4>Remaining to collect</h4>
                  <div class="amount">${formatCurrency(remaining)}</div>
                  <div class="total">Total Debt: ${formatCurrency(totalDebt)}</div>
                </div>
                
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; border-bottom: 1px dashed var(--md-sys-color-outline); padding-bottom: 16px;">
                    <button class="btn btn-tonal" style="flex: 1 1 120px; padding: 8px; justify-content:center;" onclick="openAddDebt('${r.id}')" ${isCompleted ? 'disabled' : ''}>
                        <span class="material-symbols-outlined" style="font-size: 18px; flex-shrink: 0;">post_add</span> Add Item
                    </button>
                    <button class="btn btn-tonal" style="flex: 1 1 120px; padding: 8px; justify-content:center;" onclick="openLogRecPayment('${r.id}')" ${disablePaymentBtn} title="${disablePaymentBtn ? 'No debt remaining' : ''}">
                        <span class="material-symbols-outlined" style="font-size: 18px; flex-shrink: 0;">payments</span> Log Pay
                    </button>
                </div>
                
                ${historyHTML}
            </div>
          </div>
        `;
    } catch(err) {
        console.error("Error rendering receivable:", r, err);
    }
  });
  
  container.innerHTML = html;
}

// --- SAVINGS ENGINE ---

// 1. Setup Custom Autocomplete for Person Field (Replaces ugly native datalist)
const savPersonInput = document.getElementById('sav-txn-person');
let customPersonListDiv = null;

if (savPersonInput) {
    savPersonInput.removeAttribute('list'); // Disable the ugly native browser dropdown
    
    // Wrap input to safely position the dropdown menu
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    savPersonInput.parentNode.insertBefore(wrapper, savPersonInput);
    wrapper.appendChild(savPersonInput);

    customPersonListDiv = document.createElement('div');
    customPersonListDiv.className = 'custom-select-options';
    customPersonListDiv.style.position = 'absolute';
    customPersonListDiv.style.top = 'calc(100% + 4px)';
    customPersonListDiv.style.left = '0';
    customPersonListDiv.style.width = '100%';
    customPersonListDiv.style.zIndex = '999999';
    wrapper.appendChild(customPersonListDiv);

    // Show on focus
    savPersonInput.addEventListener('focus', () => {
        if (customPersonListDiv.children.length > 0) {
            customPersonListDiv.style.setProperty('display', 'flex', 'important');
        }
    });

    // Filter list as user types
    savPersonInput.addEventListener('input', () => {
        const filter = savPersonInput.value.toLowerCase();
        let hasVisible = false;
        Array.from(customPersonListDiv.children).forEach(child => {
            if (child.textContent.toLowerCase().includes(filter)) {
                child.style.display = 'block';
                hasVisible = true;
            } else {
                child.style.display = 'none';
            }
        });
        if (hasVisible) {
            customPersonListDiv.style.setProperty('display', 'flex', 'important');
        } else {
            customPersonListDiv.style.setProperty('display', 'none', 'important');
        }
    });

    // Hide when clicking away
    document.addEventListener('click', (e) => {
        if (e.target !== savPersonInput) {
            customPersonListDiv.style.setProperty('display', 'none', 'important');
        }
    });
}

document.getElementById('form-add-savings-account').addEventListener('submit', (e) => {
  const name = document.getElementById('sav-acc-name').value.trim();
  const owner = document.getElementById('sav-acc-owner').value.trim();
  appData.savings.push({
    id: 'sav_' + Date.now(),
    accountName: name,
    ownerName: owner,
    transactions: []
  });
  document.getElementById('sav-acc-name').value = '';
  document.getElementById('sav-acc-owner').value = '';
  saveDataLocally();
  renderSavings();
});

window.openLogSavTxn = function(accId) {
    document.getElementById('log-sav-acc-id').value = accId;
    document.getElementById('sav-txn-date').value = new Date().toISOString().split('T')[0];
    
    const acc = appData.savings.find(x => x.id === accId);
    if (acc) {
        // Find unique names from past history
        const uniqueNames = new Set();
        if (acc.ownerName) uniqueNames.add(acc.ownerName); 
        
        acc.transactions.forEach(t => {
            if (t.person && t.person.trim() !== '') {
                uniqueNames.add(t.person.trim());
            }
        });
        
        // Populate the new custom dropdown instead of the native one
        if (customPersonListDiv) {
            customPersonListDiv.innerHTML = '';
            uniqueNames.forEach(name => {
                const opt = document.createElement('div');
                opt.className = 'custom-select-option';
                opt.textContent = name;
                
                // Clicking an option fills the input and closes the menu
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    savPersonInput.value = name;
                    customPersonListDiv.style.setProperty('display', 'none', 'important');
                });
                customPersonListDiv.appendChild(opt);
            });
        }
    }
    
    modals.logSavTxn.showModal();
}

document.getElementById('form-log-savings-txn').addEventListener('submit', (e) => {
    const accId = document.getElementById('log-sav-acc-id').value;
    const type = document.getElementById('sav-txn-type').value;
    const amount = parseFloat(document.getElementById('sav-txn-amount').value) || 0;
    const person = document.getElementById('sav-txn-person').value.trim();
    const desc = document.getElementById('sav-txn-desc').value.trim();
    const dateStr = document.getElementById('sav-txn-date').value;
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(y, m - 1, d);

    const acc = appData.savings.find(x => x.id === accId);
    if(acc) {
        acc.transactions.push({
            id: 'stxn_' + Date.now(),
            type, amount, person, desc, dateStr, timestamp: dateObj.getTime()
        });
        document.getElementById('sav-txn-amount').value = '';
        document.getElementById('sav-txn-person').value = '';
        document.getElementById('sav-txn-desc').value = '';
        saveDataLocally();
        renderSavings();
    }
});

window.deleteSavAccount = async function(id) {
    if(!(await customConfirm("Are you sure you want to delete this savings account and all its logs?", "Delete Account?"))) return;
    appData.savings = appData.savings.filter(x => x.id !== id);
    saveDataLocally();
    renderSavings();
}

window.deleteSavTxn = async function(accId, txnId) {
    if(!(await customConfirm("Delete this transaction?", "Delete Transaction?"))) return;
    const acc = appData.savings.find(x => x.id === accId);
    if(acc) {
        acc.transactions = acc.transactions.filter(x => x.id !== txnId);
        saveDataLocally();
        renderSavings();
    }
}

function renderSavings() {
  const container = document.getElementById('savings-container');
  if (!container) return; 
  if (appData.savings.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; margin-top: 5vh;"><h2>No Savings Accounts Yet</h2><p>Click "Add Account" to start tracking your savings.</p></div>`;
    return;
  }

  let html = '';
  appData.savings.forEach(acc => {
     try {
         let actualBalance = 0;
         let debts = {};

         acc.transactions.forEach(t => {
             // Cash on Hand tracking
             if (t.type === 'incoming') actualBalance += t.amount;
             else if (t.type === 'outgoing') actualBalance -= t.amount;

             // Debt tracking
             let p = t.person.trim();
             if (p !== '' && p.toLowerCase() !== acc.ownerName.toLowerCase()) {
                 if (!debts[p]) debts[p] = 0;
                 if (t.type === 'outgoing') debts[p] += t.amount; // Loan given out
                 else if (t.type === 'incoming') debts[p] -= t.amount; // Loan repaid
             }
         });

         let totalDebts = 0;
         let debtsHTML = '';
         Object.keys(debts).forEach(p => {
             if (debts[p] > 0) {
                 totalDebts += debts[p];
                 debtsHTML += `<div class="payable-detail" style="display:flex; justify-content:space-between;"><span>Owed by ${p}:</span> <span style="font-weight: 700; color: var(--md-sys-color-primary);">${formatCurrency(debts[p])}</span></div>`;
             }
         });

         if (totalDebts === 0) {
             debtsHTML = `<div class="payable-detail" style="opacity:0.6;">No active debts</div>`;
         }

         let totalSavings = actualBalance + totalDebts;

         // Sort transactions newest to oldest
         let sortedTxns = [...acc.transactions].sort((a,b) => {
             if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
             return parseInt(b.id.split('_')[1]) - parseInt(a.id.split('_')[1]);
         });

         let historyHTML = '';
         if (sortedTxns.length > 0) {
             let expandBtnHTML = sortedTxns.length > 3 ? `<button class="btn btn-text btn-expand-logs" onclick="toggleLogs(this)">Show all ${sortedTxns.length} logs</button>` : '';

             historyHTML = `<div class="payment-history-list">` + sortedTxns.map(t => {
                 const isIncoming = t.type === 'incoming';
                 const amountStr = isIncoming ? `+ ${formatCurrency(t.amount)}` : `- ${formatCurrency(t.amount)}`;
                 const colorClass = isIncoming ? 'ledger-payment' : ''; 
                 const personStr = t.person ? `<div style="font-size: 14px; font-weight: 700; color: var(--md-sys-color-on-surface); margin-top: 4px;">${t.person}</div>` : '';

                 return `
                 <div class="payment-history-item">
                   <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                       <div style="font-size: 11px; font-weight: 700; color: var(--md-sys-color-on-surface-variant); text-transform: uppercase; letter-spacing: 0.5px; padding-top: 4px;">${t.desc || 'Transaction'}</div>
                       <div style="display: flex; gap: 2px;">
                           <button class="btn-icon-small btn-delete-row" style="width: 28px; height: 28px; min-width: 28px;" onclick="deleteSavTxn('${acc.id}', '${t.id}')" title="Delete"><span class="material-symbols-outlined" style="font-size:15px; color: var(--md-sys-color-error);">delete</span></button>
                       </div>
                   </div>
                   <div class="${colorClass}" style="font-size: 20px; font-weight: 800; margin: 0 0 4px 0;">${amountStr}</div>
                   ${personStr}
                   <div style="font-size: 12px; font-weight: 600; color: var(--md-sys-color-outline);">${formatDate(new Date(t.timestamp))}</div>
                 </div>`;
             }).join('') + `</div>` + expandBtnHTML;
         } else {
             historyHTML = `<div class="payable-detail" style="margin-top: 16px; text-align:center;">No transactions logged yet.</div>`;
         }

         html += `
           <div class="payable-card" style="margin-bottom: 24px;">
             <div class="payable-header" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
               <div style="flex: 1;">
                   <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                       <h3 style="margin: 0;">${acc.accountName}</h3>
                   </div>
                   <div class="payable-detail" style="margin-top: 4px;">Owner: <b>${acc.ownerName}</b></div>
               </div>
               <div style="display: flex; gap: 4px; flex-shrink: 0;">
                   <button class="btn-icon-small" onclick="openEditSavAccount('${acc.id}')" title="Edit Account"><span class="material-symbols-outlined" style="font-size:18px;">edit</span></button>
                   <button class="btn-icon-small btn-delete-row" onclick="deleteSavAccount('${acc.id}')" title="Delete Account"><span class="material-symbols-outlined" style="font-size:18px; color: var(--md-sys-color-error);">delete</span></button>
               </div>
             </div>

             <div class="payable-balance" style="margin-top: 0; padding-top: 0; border-top: none; margin-bottom: 16px;">
               <h4 style="color: var(--md-sys-color-primary);">Total Savings</h4>
               <div class="amount savings-total">${formatCurrency(totalSavings)}</div>
             </div>

             <div style="background: var(--md-sys-color-surface-variant); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                 <h4 style="font-size: 11px; text-transform:uppercase; color: var(--md-sys-color-on-surface-variant); margin-bottom: 8px;">Active Debts</h4>
                 ${debtsHTML}
             </div>

             <div class="payable-balance" style="margin-top: 0; padding-top: 16px; margin-bottom: 16px;">
               <h4>Actual Balance (Cash on Hand)</h4>
               <div class="amount" style="font-size: 16px;">${formatCurrency(actualBalance)}</div>
             </div>

             <button class="btn btn-tonal" style="width: 100%; margin-bottom: 16px;" onclick="openLogSavTxn('${acc.id}')">
                <span class="material-symbols-outlined" style="font-size: 18px;">receipt_long</span> Log Transaction
             </button>
             ${historyHTML}
           </div>
         `;
     } catch(err) {
         console.error("Error rendering savings account:", acc, err);
     }
  });
  
  container.innerHTML = html;
}


// --- BUDGETS / PAYOUTS ENGINE ---
document.getElementById('payout-type-select').addEventListener('change', (e) => {
    const val = e.target.value;
    document.getElementById('fields-regular').style.display = val === 'regular' ? 'block' : 'none';
    document.getElementById('fields-manual').style.display = val === 'manual' ? 'block' : 'none';
    document.getElementById('fields-special').style.display = val === 'special' ? 'block' : 'none';
    
    document.getElementById('reg-frequency').required = val === 'regular';
    document.getElementById('reg-start-date').required = val === 'regular';
    document.getElementById('manual-name').required = val === 'manual';
    document.getElementById('manual-date').required = val === 'manual';
    document.getElementById('spec-name').required = val === 'special';
    document.getElementById('spec-date').required = val === 'special';
});

function createInitialExpenses(board) {
  let exp = {};
  board.expenseCategories.forEach(c => exp[c.id] = { amount: 0, status: 'pending', comment: "" });
  return exp;
}

document.getElementById('form-add-payout').addEventListener('submit', (e) => {
  const type = document.getElementById('payout-type-select').value;
  const board = getActiveBoard();
  
  if (type === 'regular') {
      const frequency = document.getElementById('reg-frequency').value;
      const [year, month, day] = document.getElementById('reg-start-date').value.split('-');
      const startObj = new Date(year, month - 1, day);
      
      let periods = frequency === 'semi-monthly' ? 24 : frequency === 'bi-weekly' ? 26 : frequency === 'weekly' ? 52 : 12;
      let generatedDates = []; const startDay = startObj.getDate();

      for (let i = 0; i < periods; i++) {
        let nextDate = new Date(startObj.getTime());
        if (frequency === 'semi-monthly') {
          const targetMonth = startObj.getMonth() + Math.floor(i / 2); nextDate = new Date(startObj.getFullYear(), targetMonth, 1);
          if (i % 2 === 0) { nextDate.setDate(startDay); } 
          else { 
            if (startDay === 1) { nextDate.setDate(15); } 
            else if (startDay === 15) { nextDate.setDate(new Date(startObj.getFullYear(), targetMonth + 1, 0).getDate()); } 
            else { nextDate.setDate(startDay + 15); }
          }
        } 
        else if (frequency === 'bi-weekly') { nextDate.setDate(startObj.getDate() + (14 * i)); } 
        else if (frequency === 'weekly') { nextDate.setDate(startObj.getDate() + (7 * i)); } 
        else if (frequency === 'monthly') { nextDate.setMonth(startObj.getMonth() + i); }
        
        generatedDates.push({ id: Date.now() + i, timestamp: nextDate.getTime(), dateStr: formatDate(nextDate), type: frequency.replace('-', ' ').toUpperCase(), salary: 0, expenses: createInitialExpenses(board) });
      }

      board.trackingData = [...board.trackingData, ...generatedDates];
      
  } else if (type === 'manual') {
      const name = document.getElementById('manual-name').value.trim();
      const [year, month, day] = document.getElementById('manual-date').value.split('-');
      const dateObj = new Date(year, month - 1, day);
      board.trackingData.push({ id: Date.now(), timestamp: dateObj.getTime(), dateStr: formatDate(dateObj), type: name.toUpperCase(), payoutName: name, salary: 0, expenses: createInitialExpenses(board) });
      document.getElementById('manual-name').value = ''; 
  } else if (type === 'special') {
      const name = document.getElementById('spec-name').value.trim();
      const [year, month, day] = document.getElementById('spec-date').value.split('-');
      const dateObj = new Date(year, month - 1, day);
      board.trackingData.push({ id: Date.now(), timestamp: dateObj.getTime(), dateStr: formatDate(dateObj), type: 'SPECIAL PAYOUT', payoutName: name, salary: 0, expenses: createInitialExpenses(board) });
      document.getElementById('spec-name').value = ''; 
  }
  
  setDefaultFilters(board); 
  saveDataLocally(); renderDashboard(); 
});

window.openEditPayout = function(id) {
    const item = getActiveBoard().trackingData.find(t => t.id === id);
    if (!item) return;
    document.getElementById('edit-payout-id').value = id;
    document.getElementById('edit-payout-name').value = item.payoutName || item.type;
    const d = new Date(item.timestamp);
    document.getElementById('edit-payout-date').value = d.toISOString().split('T')[0];
    
    const salaryInput = document.getElementById('edit-payout-salary');
    if(salaryInput) salaryInput.value = formatNumberLive(item.salary || 0);
    
    modals.editPayout.showModal();
}

const editSalaryInput = document.getElementById('edit-payout-salary');
if (editSalaryInput) {
    editSalaryInput.addEventListener('input', (e) => {
        e.target.value = formatNumberLive(e.target.value);
    });
}

document.getElementById('form-edit-payout').addEventListener('submit', (e) => {
    const id = parseInt(document.getElementById('edit-payout-id').value);
    const newName = document.getElementById('edit-payout-name').value.trim();
    const newDateStr = document.getElementById('edit-payout-date').value;
    const newSalary = parseFormattedNumber(document.getElementById('edit-payout-salary').value);
    
    const board = getActiveBoard();
    const item = board.trackingData.find(t => t.id === id);
    if (item) {
        const [y, m, d] = newDateStr.split('-');
        const dateObj = new Date(y, m - 1, d);
        item.timestamp = dateObj.getTime();
        item.dateStr = formatDate(dateObj);
        item.payoutName = newName;
        item.salary = newSalary;
        if (item.type !== 'SPECIAL PAYOUT') item.type = newName.toUpperCase();
        saveDataLocally(); 
        setDefaultFilters(board);
        renderDashboard();
    }
});

// --- Drag and Drop Logic ---
let draggedCatId = null;
window.handleDragStart = function(e) { draggedCatId = e.currentTarget.dataset.catId; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
window.handleDragOver = function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const target = e.currentTarget; if (target.dataset.catId !== draggedCatId) target.classList.add('drag-over'); }
window.handleDragLeave = function(e) { e.currentTarget.classList.remove('drag-over'); }
window.handleDrop = function(e) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over');
  const targetCatId = e.currentTarget.dataset.catId;
  if (draggedCatId && targetCatId && draggedCatId !== targetCatId) {
    const cats = getActiveBoard().expenseCategories;
    const fromIndex = cats.findIndex(c => c.id === draggedCatId); const toIndex = cats.findIndex(c => c.id === targetCatId);
    const [movedCat] = cats.splice(fromIndex, 1); cats.splice(toIndex, 0, movedCat);
    saveDataLocally(); renderDashboard();
  }
}
window.handleDragEnd = function(e) { e.currentTarget.classList.remove('dragging'); document.querySelectorAll('.header-cell').forEach(el => el.classList.remove('drag-over')); draggedCatId = null; }

// --- Settings Modal Configuration ---
let tempYearFilter = 'All';
let tempMonthFilter = 'All';

window.openFilterModal = function() {
    const board = getActiveBoard();
    if (!board || board.trackingData.length === 0) return;
    
    tempYearFilter = activeYearFilter;
    tempMonthFilter = activeMonthFilter;
    
    updateModalFilters('init');
    modals.filterPayouts.showModal();
}

window.updateModalFilters = function(source) {
    const boardData = getActiveBoard().trackingData;
    const yearSel = document.getElementById('modal-filter-year');
    const monthSel = document.getElementById('modal-filter-month');
    const payoutSel = document.getElementById('modal-filter-payout');
    
    if (source === 'year') { tempYearFilter = yearSel.value; tempMonthFilter = 'All'; }
    if (source === 'month') { tempMonthFilter = monthSel.value; }
    
    const years = new Set();
    const monthsByYear = {};
    let hasSpecial = false;
    
    boardData.forEach(item => {
        if (item.type === 'SPECIAL PAYOUT') { hasSpecial = true; return; }
        const d = new Date(item.timestamp); 
        const y = d.getFullYear().toString(); 
        const m = d.toLocaleDateString('en-US', { month: 'long' });
        years.add(y); 
        if (!monthsByYear[y]) monthsByYear[y] = new Set(); 
        monthsByYear[y].add(m);
    });
    
    const uniqueYears = Array.from(years).sort();
    
    if (source === 'init' || source === 'all') {
        let yHTML = `<option value="All">All Years</option>`;
        uniqueYears.forEach(y => yHTML += `<option value="${y}" ${y === tempYearFilter ? 'selected' : ''}>${y}</option>`);
        yearSel.innerHTML = yHTML;
        updateCustomSelectOptions(yearSel);
    }
    
    let mHTML = `<option value="All">All Months</option>`;
    if (tempYearFilter !== 'All' && monthsByYear[tempYearFilter]) {
        const months = Array.from(monthsByYear[tempYearFilter]).sort((a, b) => new Date(a + " 1, 2000") - new Date(b + " 1, 2000"));
        months.forEach(m => mHTML += `<option value="${m}" ${m === tempMonthFilter ? 'selected' : ''}>${m}</option>`);
        if (hasSpecial) mHTML += `<option value="SPECIAL" ${tempMonthFilter === 'SPECIAL' ? 'selected' : ''}>Special Payouts</option>`;
    }
    monthSel.innerHTML = mHTML;
    monthSel.disabled = (tempYearFilter === 'All');
    updateCustomSelectOptions(monthSel);
    
    let pHTML = `<option value="All">All Payouts in Range</option>`;
    let availablePayouts = [];
    if (tempMonthFilter === 'SPECIAL') {
        availablePayouts = boardData.filter(i => i.type === 'SPECIAL PAYOUT');
    } else if (tempYearFilter !== 'All' && tempMonthFilter !== 'All') {
        availablePayouts = boardData.filter(i => i.type !== 'SPECIAL PAYOUT' && new Date(i.timestamp).getFullYear().toString() === tempYearFilter && new Date(i.timestamp).toLocaleDateString('en-US', { month: 'long' }) === tempMonthFilter);
    } else if (tempYearFilter !== 'All' && tempMonthFilter === 'All') {
        availablePayouts = boardData.filter(i => i.type !== 'SPECIAL PAYOUT' && new Date(i.timestamp).getFullYear().toString() === tempYearFilter);
    }
    
    availablePayouts.sort((a,b) => a.timestamp - b.timestamp);
    availablePayouts.forEach(p => {
        pHTML += `<option value="${p.id}" ${p.id == activePayoutId ? 'selected' : ''}>${formatDate(new Date(p.timestamp))} - ${p.payoutName || p.type}</option>`;
    });
    
    payoutSel.innerHTML = pHTML;
    payoutSel.disabled = availablePayouts.length === 0;
    updateCustomSelectOptions(payoutSel);
}

window.applyFilters = function() {
    activeYearFilter = document.getElementById('modal-filter-year').value;
    activeMonthFilter = document.getElementById('modal-filter-month').value;
    const selectedPayout = document.getElementById('modal-filter-payout').value;
    
    if (selectedPayout === 'All') {
        activePayoutId = 'All';
    } else {
        activePayoutId = parseInt(selectedPayout);
    }
    
    modals.filterPayouts.close();
    renderDashboard();
}

// --- Settings Form Submission logic ---
document.getElementById('form-settings').addEventListener('submit', async (e) => {
  e.preventDefault(); 
  appData.currentCurrency = document.getElementById('select-currency').value; 
  
  if (!appData.settings) appData.settings = {};
  appData.settings.decimalSep = document.getElementById('select-decimal-sep').value;
  appData.settings.thousandSep = document.getElementById('select-thousand-sep').value;
  appData.settings.dateFormat = document.getElementById('select-date-format').value;
  appData.settings.dateSep = document.getElementById('select-date-sep').value;
  
  saveDataLocally(); 
  window.hasAutoScrolled = false; 
  renderDashboard();
  
  await customAlert("Preferences successfully saved!", "Settings Saved", "check_circle", "#10B981");
  if (window.innerWidth > 900) {
      modals.settings.close();
  }
});


document.getElementById('btn-export-data').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = "SalaryTracker_Full_Backup.json"; a.click(); URL.revokeObjectURL(url);
});

// JSON Import Recovery Fix
document.getElementById('input-import-data').addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(event) {
    try {
      const parsed = JSON.parse(event.target.result); 
      if (parsed.boards) { 
        appData = { ...appData, ...parsed }; // Merges instead of erasing
        activeBoardId = appData.boards[0]?.id; 
        setDefaultFilters(appData.boards[0]);
        window.hasAutoScrolled = false;
        if (!Array.isArray(appData.payables)) appData.payables = [];
        if (!Array.isArray(appData.receivables)) appData.receivables = [];
        if (!Array.isArray(appData.savings)) appData.savings = [];
        if (!appData.settings) appData.settings = { decimalSep: '.', thousandSep: ',', dateFormat: 'MM-DD-YYYY', dateSep: '-' };
      }
      document.getElementById('select-currency').value = appData.currentCurrency; 
      
      saveDataLocally(); 
      
      // Re-render based on active view
      if (currentView === 'budgets') renderDashboard(); 
      else if (currentView === 'payables') renderPayables();
      else if (currentView === 'receivables') renderReceivables();
      else if (currentView === 'savings') renderSavings();
      else if (currentView === 'settings') switchView('settings'); // Refresh settings UI
      
      await customAlert("Data successfully imported!", "Import Complete", "check_circle", "#10B981");
    } catch (err) { 
        await customAlert("Invalid JSON file format.", "Error", "error", "var(--md-sys-color-error)"); 
    }
  }; 
  reader.readAsText(file); 
  e.target.value = '';
});

// --- Expense Categories ---
window.openCategoryModal = () => {
  document.getElementById('cat-has-goal').checked = true; 
  document.getElementById('new-goal-fields').style.display = 'block'; 
  document.getElementById('cat-goal').required = true;
  document.getElementById('cat-type').value = 'monthly';
  syncCustomSelect(document.getElementById('cat-type'));
  modals.category.showModal();
}
document.getElementById('cat-has-goal').addEventListener('change', (e) => {
  document.getElementById('new-goal-fields').style.display = e.target.checked ? 'block' : 'none'; document.getElementById('cat-goal').required = e.target.checked;
});
document.getElementById('edit-cat-has-goal').addEventListener('change', (e) => {
  document.getElementById('edit-goal-fields').style.display = e.target.checked ? 'block' : 'none'; document.getElementById('edit-cat-goal').required = e.target.checked;
});

document.getElementById('form-category').addEventListener('submit', (e) => {
  const name = document.getElementById('cat-name').value.trim(); const note = document.getElementById('cat-note').value.trim();
  const hasGoal = document.getElementById('cat-has-goal').checked; const goal = hasGoal ? (parseFloat(document.getElementById('cat-goal').value) || 0) : 0; const type = hasGoal ? document.getElementById('cat-type').value : null;
  const board = getActiveBoard();
  if (name) {
    const newCat = { id: 'cat_' + Date.now(), name, note, hasGoal, goal, type }; board.expenseCategories.push(newCat); 
    board.trackingData.forEach(item => item.expenses[newCat.id] = { amount: 0, status: 'pending', comment: "" });
  }
  document.getElementById('cat-name').value = ''; document.getElementById('cat-note').value = ''; document.getElementById('cat-goal').value = '';
  saveDataLocally(); renderDashboard();
});

window.openEditCategory = function(catId) {
  const cat = getActiveBoard().expenseCategories.find(c => c.id === catId); if (!cat) return;
  document.getElementById('edit-cat-id').value = cat.id; document.getElementById('edit-cat-name').value = cat.name; document.getElementById('edit-cat-note').value = cat.note || "";
  const hasGoalCheckbox = document.getElementById('edit-cat-has-goal'); hasGoalCheckbox.checked = cat.hasGoal;
  document.getElementById('edit-goal-fields').style.display = cat.hasGoal ? 'block' : 'none'; document.getElementById('edit-cat-goal').required = cat.hasGoal;
  if(cat.hasGoal) { 
      document.getElementById('edit-cat-goal').value = cat.goal; 
      document.getElementById('edit-cat-type').value = cat.type; 
      syncCustomSelect(document.getElementById('edit-cat-type'));
  } else { 
      document.getElementById('edit-cat-goal').value = ''; 
  }
  modals.editCategory.showModal();
}

document.getElementById('form-edit-category').addEventListener('submit', (e) => {
  const cat = getActiveBoard().expenseCategories.find(c => c.id === document.getElementById('edit-cat-id').value);
  if (cat) {
    cat.name = document.getElementById('edit-cat-name').value.trim(); cat.note = document.getElementById('edit-cat-note').value.trim(); cat.hasGoal = document.getElementById('edit-cat-has-goal').checked;
    if (cat.hasGoal) { cat.goal = parseFloat(document.getElementById('edit-cat-goal').value) || 0; cat.type = document.getElementById('edit-cat-type').value; } else { cat.goal = 0; cat.type = null; }
  }
  saveDataLocally(); renderDashboard();
});

// --- Comment Handlers ---
window.openCommentModal = function(rowId, catId) {
    const item = getActiveBoard().trackingData.find(t => t.id === rowId);
    const expObj = getSafeExpenseObj(item, catId);
    document.getElementById('comment-row-id').value = rowId;
    document.getElementById('comment-cat-id').value = catId;
    document.getElementById('comment-text').value = expObj.comment || '';
    modals.comment.showModal();
}

document.getElementById('form-comment').addEventListener('submit', (e) => {
    const rowId = parseInt(document.getElementById('comment-row-id').value);
    const catId = document.getElementById('comment-cat-id').value;
    const text = document.getElementById('comment-text').value.trim();
    
    const item = getActiveBoard().trackingData.find(t => t.id === rowId);
    const expObj = getSafeExpenseObj(item, catId);
    expObj.comment = text;
    saveDataLocally();
    
    const wrapper = dashboard.querySelector('.table-wrapper');
    const st = wrapper ? wrapper.scrollTop : 0; const sl = wrapper ? wrapper.scrollLeft : 0;
    renderDashboard();
    const newWrapper = dashboard.querySelector('.table-wrapper');
    if (newWrapper) { newWrapper.scrollTop = st; newWrapper.scrollLeft = sl; }
});

document.getElementById('btn-delete-comment').addEventListener('click', () => {
    const rowId = parseInt(document.getElementById('comment-row-id').value);
    const catId = document.getElementById('comment-cat-id').value;
    const item = getActiveBoard().trackingData.find(t => t.id === rowId);
    const expObj = getSafeExpenseObj(item, catId);
    
    expObj.comment = '';
    saveDataLocally();
    
    const wrapper = dashboard.querySelector('.table-wrapper');
    const st = wrapper ? wrapper.scrollTop : 0; const sl = wrapper ? wrapper.scrollLeft : 0;
    modals.comment.close();
    renderDashboard();
    const newWrapper = dashboard.querySelector('.table-wrapper');
    if (newWrapper) { newWrapper.scrollTop = st; newWrapper.scrollLeft = sl; }
});

// --- SMART UPDATER ---
function updateLiveUI(rowId) {
  const board = getActiveBoard();
  const item = board.trackingData.find(t => t.id === rowId);
  let totalExpenses = 0;
  board.expenseCategories.forEach(cat => { 
    let expObj = getSafeExpenseObj(item, cat.id);
    if (expObj.status === 'paid') { totalExpenses += (parseFloat(expObj.amount) || 0); } 
  });
  
  const balanceStr = formatCurrency(item.salary - totalExpenses);
  
  const balanceEl = document.getElementById(`balance-${rowId}`);
  if (balanceEl) balanceEl.textContent = balanceStr;
  
  recalculateGoalsAndRenderTexts(); 
}

// --- Core Event Delegation ---
dashboard.addEventListener('change', (e) => {
  if (e.target.classList.contains('status-select')) {
    const board = getActiveBoard(); const id = parseInt(e.target.dataset.id); const catId = e.target.dataset.category; const newStatus = e.target.value;
    const item = board.trackingData.find(t => t.id === id);
    const expObj = getSafeExpenseObj(item, catId);
    expObj.status = newStatus;
    if (newStatus === 'not_required' || newStatus === 'carry_over') { expObj.amount = 0; }
    
    const wrapper = dashboard.querySelector('.table-wrapper');
    const st = wrapper ? wrapper.scrollTop : 0; const sl = wrapper ? wrapper.scrollLeft : 0;
    
    saveDataLocally(); renderDashboard(); 
    
    const newWrapper = dashboard.querySelector('.table-wrapper');
    if (newWrapper) { newWrapper.scrollTop = st; newWrapper.scrollLeft = sl; }
  }
});

dashboard.addEventListener('input', (e) => {
  const board = getActiveBoard();
  if (e.target.classList.contains('salary-input')) {
    const id = parseInt(e.target.dataset.id); 
    board.trackingData.find(t => t.id === id).salary = parseFloat(e.target.value) || 0; 
    saveDataLocally(); updateLiveUI(id);
  }
  if (e.target.classList.contains('expense-input')) {
    let val = formatNumberLive(e.target.value);
    e.target.value = val;

    const id = parseInt(e.target.dataset.id); const catId = e.target.dataset.category; 
    const item = board.trackingData.find(t => t.id === id);
    const expObj = getSafeExpenseObj(item, catId);
    expObj.amount = parseFormattedNumber(val);
    
    saveDataLocally(); updateLiveUI(id);
  }
});

// --- Smart Budget Engine ---
function recalculateGoalsAndRenderTexts() {
  const board = getActiveBoard(); 
  const sortedData = [...board.trackingData].sort((a, b) => a.timestamp - b.timestamp);
  let tracker = {}; 
  board.expenseCategories.forEach(c => tracker[c.id] = { spentThisMonth: 0, deficit: 0, lastMonth: -1, lastYear: -1 });

  sortedData.forEach((item) => {
    item.analysis = {}; const d = new Date(item.timestamp); const itemMonth = d.getMonth(); const itemYear = d.getFullYear();
    board.expenseCategories.forEach(cat => {
      let expObj = getSafeExpenseObj(item, cat.id);
      let entered = parseFloat(expObj.amount) || 0; let status = expObj.status || 'pending';
      if (!cat.hasGoal) { 
        item.analysis[cat.id] = { msg: "No goal set", statusClass: "" }; 
        return; 
      }
      let t = tracker[cat.id]; let msg = ""; let statusClass = "";
      if (t.lastMonth !== itemMonth || t.lastYear !== itemYear) { t.spentThisMonth = 0; t.deficit = 0; t.lastMonth = itemMonth; t.lastYear = itemYear; }

      if (cat.type === 'monthly') {
        let remainingForMonth = cat.goal - t.spentThisMonth; 
        let effectiveSpend = (status === 'paid' || status === 'pending') ? entered : 0; 
        let afterEntry = remainingForMonth - effectiveSpend;
        
        if (status === 'not_required') { msg = `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Goal met`; statusClass = "success"; } 
        else if (status === 'carry_over') { msg = `➔ Carried over`; statusClass = "alert"; } 
        else if (status === 'paid') {
          // ONLY show Goal Reached if explicitly marked Paid
          if (afterEntry <= 0 && entered > 0) { msg = `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Goal reached`; statusClass = "success"; } 
          else { msg = `Target: ${formatCurrency(remainingForMonth)}`; if (effectiveSpend > 0) msg += ` <br>➔ Rem: ${formatCurrency(Math.max(0, afterEntry))}`; }
          t.spentThisMonth += effectiveSpend;
        } else {
          // Pending Status
          msg = `Target: ${formatCurrency(remainingForMonth)}`; if (effectiveSpend > 0) msg += ` <br>➔ Rem: ${formatCurrency(Math.max(0, afterEntry))}`;
          t.spentThisMonth += effectiveSpend;
        }
      } else if (cat.type === 'cutoff') {
        let targetForThisCutoff = cat.goal + t.deficit;
        
        if (status === 'not_required') { msg = `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Goal met`; statusClass = "success"; } 
        else if (status === 'carry_over') { msg = `➔ Carried over`; statusClass = "alert"; t.deficit += cat.goal; } 
        else if (status === 'paid') {
          // ONLY show Goal Reached if explicitly marked Paid
          if (entered >= targetForThisCutoff && entered > 0) {
             msg = `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Goal reached`; statusClass = "success";
          } else {
             msg = `Target: ${formatCurrency(targetForThisCutoff)}`;
             statusClass = t.deficit > 0 ? "alert" : (t.deficit < 0 ? "success" : "");
          }
          t.deficit += (cat.goal - entered);
        } else {
          // Pending Status
          msg = `Target: ${formatCurrency(targetForThisCutoff)}`;
          statusClass = t.deficit > 0 ? "alert" : (t.deficit < 0 ? "success" : "");
          let plannedSpend = entered > 0 ? entered : cat.goal;
          t.deficit += (cat.goal - plannedSpend);
        }
      }
      item.analysis[cat.id] = { msg, statusClass };
    });
  });
}

// --- ROW BUILDER HELPER ---
function buildPayoutRow(item, board, isUpcoming = false) {
    let totalExpenses = 0;
    board.expenseCategories.forEach(cat => { 
      let exp = getSafeExpenseObj(item, cat.id);
      if (exp.status === 'paid') totalExpenses += (parseFloat(exp.amount) || 0); 
    });

    let expenseCellsHTML = board.expenseCategories.map(cat => {
      const analysis = item.analysis[cat.id]; 
      const expObj = getSafeExpenseObj(item, cat.id);
      const status = expObj.status || 'pending'; 
      const isDisabled = (status === 'not_required' || status === 'carry_over') ? 'disabled' : '';
      
      const commentClass = expObj.comment ? 'has-comment' : '';
      const commentDisplay = expObj.comment ? expObj.comment : '<i>+ Add comment</i>';

      const goalStr = cat.hasGoal ? `<div class="mobile-goal-text">${formatCurrency(cat.goal)} ${cat.type === 'monthly' ? '/mo' : '/cutoff'}</div>` : '';

      return `
      <div class="swipe-container expense-cell-wrapper">
        <div class="swipe-actions mobile-only">
           <button class="swipe-action-btn edit" onclick="openEditCategory('${cat.id}')">
             <span class="material-symbols-outlined">edit</span>
             Edit
           </button>
           <button class="swipe-action-btn delete" onclick="promptDeleteCategory('${cat.id}')">
             <span class="material-symbols-outlined">delete</span>
             Delete
           </button>
        </div>
        <div class="swipe-content table-cell status-${status}">
          <div class="cell-header-group">
              <div class="mobile-label">${cat.name}</div>
              ${goalStr}
          </div>
          
          <div class="mobile-flex-row">
              <div class="mobile-status-col">
                  <select class="status-select" data-id="${item.id}" data-category="${cat.id}">
                    <option value="pending" ${status==='pending'?'selected':''}>Pending</option>
                    <option value="paid" ${status==='paid'?'selected':''}>Done/Paid</option>
                    <option value="not_required" ${status==='not_required'?'selected':''}>Not Required</option>
                    <option value="carry_over" ${status==='carry_over'?'selected':''}>Carry Over</option>
                  </select>
              </div>
              <div class="mobile-amount-col">
                  <input type="text" class="expense-input" data-id="${item.id}" data-category="${cat.id}" value="${expObj.amount ? formatNumberLive(expObj.amount) : ''}" placeholder="0.00" ${isDisabled}>
                  <div id="helper-${item.id}-${cat.id}" class="helper-text ${analysis.statusClass}">${analysis.msg}</div>
              </div>
          </div>
          
          <div class="cell-comment clickable-comment ${commentClass}" onclick="openCommentModal(${item.id}, '${cat.id}')" title="${expObj.comment ? expObj.comment.replace(/"/g, '&quot;') : 'Add a comment'}">${commentDisplay}</div>
        </div>
      </div>`
    }).join('');

    let upcomingBadge = '';
    if (isUpcoming) {
        upcomingBadge = `
        <div id="upcoming-marker" style="display: inline-flex; align-items: center; gap: 6px; background-color: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; align-self: flex-start; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            <span class="material-symbols-outlined" style="font-size: 16px;">calendar_month</span> CURRENT PAYOUT
        </div>`;
    }

    return `
      <div class="payout-row">
        <div class="table-cell col-sticky-info" data-row-id="${item.id}" style="cursor: pointer; transition: filter 0.2s;" onclick="openEditPayout(${item.id})" title="Click to edit payout details or declare salary" onmouseover="this.style.filter='brightness(0.95)'" onmouseout="this.style.filter='none'">
          ${upcomingBadge}
          <div class="date-block-wrapper" style="padding-top: 0;">
            <div class="date-block"><h3>${formatDate(new Date(item.timestamp))}</h3><p>${item.payoutName || item.type}</p></div>
            <div class="remaining-block"><h4>Remaining</h4><div class="balance" id="balance-${item.id}">${formatCurrency(item.salary - totalExpenses)}</div></div>
          </div>
        </div>
        
        ${expenseCellsHTML}
      </div>`;
}

// --- EXCEL DASHBOARD RENDER ENGINE ---
function renderDashboard() {
  const board = getActiveBoard(); 
  
  if (currentView === 'budgets') {
    currentViewTitle.textContent = board ? board.name : ''; 
  }

  const tableWrapper = document.querySelector('.table-wrapper');
  const scrollLeft = tableWrapper ? tableWrapper.scrollLeft : 0;
  const scrollTop = tableWrapper ? tableWrapper.scrollTop : 0;

  if (!board || board.trackingData.length === 0) {
    monthFilterContainer.innerHTML = ''; 
    dashboard.innerHTML = `<div class="empty-state"><h2>No Payouts Yet</h2></div>`;
    return;
  }

  recalculateGoalsAndRenderTexts(); 
  
  // Dynamic Button for Filter Trigger
  let filterText = "All Payouts";
  if (activePayoutId && activePayoutId !== 'All') {
      const p = board.trackingData.find(x => x.id === activePayoutId);
      if (p) filterText = formatDate(new Date(p.timestamp)) + " - " + (p.payoutName || p.type);
  } else if (activeMonthFilter !== 'All' && activeMonthFilter !== 'SPECIAL') {
      filterText = activeMonthFilter + " Payouts";
  } else if (activeMonthFilter === 'SPECIAL') {
      filterText = "Special Payouts";
  } else if (activeYearFilter !== 'All') {
      filterText = activeYearFilter + " Payouts";
  }
  
  monthFilterContainer.innerHTML = `
      <button class="btn btn-tonal" onclick="openFilterModal()" style="width: 100%; min-height: 48px; border-radius: 12px; font-size: 15px; padding: 0 20px;">
         <span class="material-symbols-outlined">tune</span> ${filterText}
      </button>
  `;

  let headerHTML = `
    <div class="master-header-row">
      <div class="table-cell col-sticky-info" style="display:flex; align-items:center; justify-content:center; background-color: var(--md-sys-color-surface-variant); padding: 0;">
          <span style="font-weight: 800; font-size: 11px; color: var(--md-sys-color-primary); letter-spacing: 1px;">PAYOUT PERIOD</span>
      </div>
  `;
  
  if (board.expenseCategories.length === 0) {
      headerHTML += `<div class="table-cell header-cell" style="position: relative; justify-content: center; align-items: center;"><button class="btn btn-filled desktop-only" onclick="openCategoryModal()" style="padding: 6px 12px; font-size: 13px; white-space: nowrap;">+ Add New Expense Category</button></div>`;
  }

  board.expenseCategories.forEach((cat, index, arr) => {
    const isLast = index === arr.length - 1;
    const addBtn = isLast ? `<button class="btn-icon-fab desktop-only" onclick="openCategoryModal()" title="Add Category" style="position: absolute; right: 0; top: 50%; transform: translate(50%, -50%); z-index: 20; width: 36px !important; height: 36px !important; min-width: 36px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 2px solid var(--md-sys-color-surface); background-color: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary);"><span class="material-symbols-outlined" style="font-size: 20px;">add</span></button>` : '';

    const noteHTML = cat.note ? `<span class="cat-note-badge">${cat.note}</span>` : '';
    const goalHTML = cat.hasGoal ? `<span class="goal-text">${formatCurrency(cat.goal)} ${cat.type === 'monthly' ? '/mo' : '/cutoff'}</span>` : '';
    headerHTML += `
      <div class="table-cell header-cell draggable-col" style="position: relative; overflow: visible;" draggable="true" data-cat-id="${cat.id}" ondragstart="handleDragStart(event)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)" ondragend="handleDragEnd(event)">
        <div style="display:flex; flex-direction:column; align-items:flex-start; gap:2px; pointer-events: none;">
          <label>${cat.name}</label>${goalHTML}${noteHTML}
        </div>
        <button class="btn-icon-small" style="pointer-events: auto;" onclick="openEditCategory('${cat.id}')"><span class="material-symbols-outlined" style="font-size: 16px;">edit</span></button>
        ${addBtn}
      </div>`;
  });
  
  headerHTML += `</div>`; // Close master-header-row

  const upcomingItem = getUpcomingItem(board.trackingData);
  let displayData = board.trackingData;
  
  if (activePayoutId !== null && activePayoutId !== 'All') {
      displayData = displayData.filter(i => i.id === activePayoutId);
  } else {
      if (activeMonthFilter === 'SPECIAL') {
          displayData = displayData.filter(item => item.type === 'SPECIAL PAYOUT');
      } else {
          if (activeYearFilter !== 'All') {
              displayData = displayData.filter(item => new Date(item.timestamp).getFullYear().toString() === activeYearFilter);
              if (activeMonthFilter !== 'All') {
                  displayData = displayData.filter(item => new Date(item.timestamp).toLocaleDateString('en-US', { month: 'long' }) === activeMonthFilter);
              }
          }
      }
  }
  
  displayData.sort((a,b) => a.timestamp - b.timestamp);

  let bodyHTML = '';
  if (displayData.length > 0) {
      bodyHTML = displayData.map(item => {
          const isUpcoming = upcomingItem && upcomingItem.id === item.id;
          return buildPayoutRow(item, board, isUpcoming);
      }).join('');
  }

  dashboard.innerHTML = `<div class="table-wrapper"><div class="table-inner">${headerHTML}${bodyHTML}</div></div>`;
  
  convertSelectsToCustom(dashboard);

  const newWrapper = dashboard.querySelector('.table-wrapper');
  if (newWrapper) { 
      if (!window.hasAutoScrolled) {
          window.hasAutoScrolled = true;
      } else {
          newWrapper.scrollLeft = scrollLeft; 
          newWrapper.scrollTop = scrollTop; 
      }
  }
}

// Initial Boot Trigger
switchView('budgets');
convertSelectsToCustom(document);

