// ========== ALFAJR TAILORING MANAGEMENT SYSTEM ==========
// Version 5.0 - Professional Complete Edition
// Author: ALFAJR Team
// Phone: 0799799009
// Last Updated: 2024

// ========== CONFIGURATION ==========
const AppConfig = {
    DATABASE_NAME: 'ALFAJR_DB_V5',
    DATABASE_VERSION: 5,
    STORES: {
        CUSTOMERS: 'customers',
        SETTINGS: 'settings',
        BACKUP: 'backups'
    },
    
    MEASUREMENT_FIELDS: [
        "قد", "شانه_یک", "شانه_دو", "آستین_یک", "آستین_دو", "آستین_سه",
        "بغل", "دامن", "گردن", "دور_سینه", "شلوار", "دم_پاچه",
        "بر_تمبان", "خشتک", "چاک_پتی", "تعداد_سفارش", "مقدار_تکه"
    ],
    
    YAKHUN_MODELS: ["آف دار", "چپه یخن", "پاکستانی", "ملی", "شهبازی", "خامک", "قاسمی"],
    SLEEVE_MODELS: ["کفک", "ساده شیش بخیه", "بندک", "پر بخیه", "آف دار", "لایی یک انچ"],
    SKIRT_MODELS: ["دامن یک بخیه", "دامن دوبخیه", "دامن چهارکنج", "دامن ترخیز", "دامن گاوی"],
    FEATURES_LIST: ["جیب رو", "جیب شلوار", "یک بخیه سند", "دو بخیه سند", "مکمل دو بخیه"],
    DAYS_OF_WEEK: ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"],
    
    DEFAULT_SETTINGS: {
        theme: 'dark',
        printFormat: 'thermal',
        currency: 'افغانی',
        autoSave: true,
        backupInterval: 24
    }
};

// ========== GLOBAL VARIABLES ==========
let customers = [];
let currentCustomerIndex = null;
let dbManager = null;
let currentTheme = 'dark';
let saveTimeout = null;
let isInitialized = false;

// ========== UTILITY FUNCTIONS ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatPrice(price) {
    if (!price && price !== 0) return '۰';
    return new Intl.NumberFormat('fa-IR').format(price);
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fa-IR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

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

// ========== CUSTOMER CLASS ==========
class Customer {
    constructor(name, phone) {
        this.id = this.generateNumericId();
        this.name = name || '';
        this.phone = phone || '';
        this.notes = '';
        this.measurements = this.createEmptyMeasurements();
        this.models = {
            yakhun: '',
            sleeve: '',
            skirt: [],
            features: []
        };
        this.sewingPriceAfghani = null;
        this.deliveryDay = '';
        this.paymentReceived = false;
        this.paymentDate = null;
        this.orders = [];
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.deleted = false;
        this.version = 1;
    }

    generateNumericId() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(1000 + Math.random() * 9000);
        return parseInt(timestamp + random).toString().slice(0, 4);
    }

    createEmptyMeasurements() {
        const measurements = {};
        AppConfig.MEASUREMENT_FIELDS.forEach(field => {
            measurements[field] = '';
        });
        return measurements;
    }

    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim().length < 2) {
            errors.push('نام مشتری باید حداقل ۲ کاراکتر باشد');
        }
        
        if (!this.phone || this.phone.trim().length < 10 || !/^\d+$/.test(this.phone)) {
            errors.push('شماره تلفن باید حداقل ۱۰ رقم عددی باشد');
        }
        
        AppConfig.MEASUREMENT_FIELDS.forEach(field => {
            const value = this.measurements[field];
            if (value && isNaN(parseFloat(value))) {
                errors.push(`فیلد ${field} باید عددی باشد`);
            }
        });
        
        if (this.sewingPriceAfghani && isNaN(parseInt(this.sewingPriceAfghani))) {
            errors.push('قیمت باید عددی باشد');
        }
        
        return errors;
    }

    toObject() {
        return {
            id: this.id,
            name: this.name,
            phone: this.phone,
            notes: this.notes,
            measurements: this.measurements,
            models: this.models,
            sewingPriceAfghani: this.sewingPriceAfghani,
            deliveryDay: this.deliveryDay,
            paymentReceived: this.paymentReceived,
            paymentDate: this.paymentDate,
            orders: this.orders,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            deleted: this.deleted,
            version: this.version
        };
    }

    static fromObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return new Customer('', '');
        }
        
        const customer = new Customer(obj.name || '', obj.phone || '');
        
        Object.keys(obj).forEach(key => {
            if (key !== 'id' && key !== 'name' && key !== 'phone') {
                try {
                    customer[key] = obj[key];
                } catch (e) {}
            }
        });
        
        if (!Array.isArray(customer.orders)) customer.orders = [];
        if (!customer.models) customer.models = { yakhun: "", sleeve: "", skirt: [], features: [] };
        if (!Array.isArray(customer.models.skirt)) customer.models.skirt = [];
        if (!Array.isArray(customer.models.features)) customer.models.features = [];
        if (!customer.measurements) customer.measurements = customer.createEmptyMeasurements();
        
        AppConfig.MEASUREMENT_FIELDS.forEach(field => {
            if (customer.measurements[field] && typeof customer.measurements[field] === 'string') {
                const numValue = parseFloat(customer.measurements[field]);
                if (!isNaN(numValue)) {
                    customer.measurements[field] = numValue;
                }
            }
        });
        
        if (customer.sewingPriceAfghani && typeof customer.sewingPriceAfghani === 'string') {
            const priceValue = parseInt(customer.sewingPriceAfghani);
            if (!isNaN(priceValue)) {
                customer.sewingPriceAfghani = priceValue;
            }
        }
        
        return customer;
    }
}

// ========== DATABASE MANAGER ==========
class DatabaseManager {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.onUpdateCallbacks = [];
    }

    async init() {
        return new Promise((resolve, reject) => {
            if (this.isInitialized && this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(AppConfig.DATABASE_NAME, AppConfig.DATABASE_VERSION);
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isInitialized = true;
                
                this.db.onerror = (event) => {
                    showNotification('خطا در پایگاه داده', 'error');
                };
                
                this.updateDatabaseStatus(true);
                this.initializeSettings();
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains(AppConfig.STORES.CUSTOMERS)) {
                    const store = db.createObjectStore(AppConfig.STORES.CUSTOMERS, { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('phone', 'phone', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains(AppConfig.STORES.SETTINGS)) {
                    db.createObjectStore(AppConfig.STORES.SETTINGS, { keyPath: 'key' });
                }
                
                if (!db.objectStoreNames.contains(AppConfig.STORES.BACKUP)) {
                    const backupStore = db.createObjectStore(AppConfig.STORES.BACKUP, { keyPath: 'id', autoIncrement: true });
                    backupStore.createIndex('date', 'date', { unique: false });
                }
            };
        });
    }

    onUpdate(callback) {
        this.onUpdateCallbacks.push(callback);
    }

    notifyUpdate(type, data) {
        this.onUpdateCallbacks.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {}
        });
    }

    updateDatabaseStatus(connected) {
        const statusElement = document.getElementById('dbStatus');
        if (statusElement) {
            if (connected) {
                statusElement.innerHTML = '<i class="fas fa-database"></i> <span>متصل</span>';
                statusElement.className = 'db-status connected';
            } else {
                statusElement.innerHTML = '<i class="fas fa-database"></i> <span>قطع</span>';
                statusElement.className = 'db-status disconnected';
            }
        }
    }

    async initializeSettings() {
        try {
            for (const [key, value] of Object.entries(AppConfig.DEFAULT_SETTINGS)) {
                const existing = await this.getSettings(key);
                if (existing === null) {
                    await this.saveSettings(key, value);
                }
            }
        } catch (error) {}
    }

    async saveCustomer(customer) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized || !this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            if (!customer || !customer.id) {
                reject(new Error('Invalid customer data'));
                return;
            }
            
            const errors = customer.validate();
            if (errors.length > 0) {
                reject(new Error(errors.join('\n')));
                return;
            }
            
            customer.updatedAt = new Date().toISOString();
            const customerData = customer.toObject();
            
            const transaction = this.db.transaction([AppConfig.STORES.CUSTOMERS], 'readwrite');
            const store = transaction.objectStore(AppConfig.STORES.CUSTOMERS);
            
            const request = store.put(customerData);
            
            request.onsuccess = () => {
                this.notifyUpdate('customer_saved', customer);
                resolve(customer);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async getAllCustomers(includeDeleted = false) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized || !this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([AppConfig.STORES.CUSTOMERS], 'readonly');
            const store = transaction.objectStore(AppConfig.STORES.CUSTOMERS);
            const request = store.getAll();
            
            request.onsuccess = () => {
                let customers = request.result || [];
                
                if (!includeDeleted) {
                    customers = customers.filter(c => !c.deleted);
                }
                
                const customerObjects = customers.map(c => {
                    try {
                        return Customer.fromObject(c);
                    } catch (error) {
                        return null;
                    }
                }).filter(c => c !== null);
                
                customerObjects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                resolve(customerObjects);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async getCustomer(id) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized || !this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([AppConfig.STORES.CUSTOMERS], 'readonly');
            const store = transaction.objectStore(AppConfig.STORES.CUSTOMERS);
            const request = store.get(id);
            
            request.onsuccess = () => {
                if (request.result) {
                    resolve(Customer.fromObject(request.result));
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async deleteCustomer(id) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized || !this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([AppConfig.STORES.CUSTOMERS], 'readwrite');
            const store = transaction.objectStore(AppConfig.STORES.CUSTOMERS);
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const customer = getRequest.result;
                if (customer) {
                    customer.deleted = true;
                    customer.updatedAt = new Date().toISOString();
                    
                    const putRequest = store.put(customer);
                    putRequest.onsuccess = () => {
                        this.notifyUpdate('customer_deleted', { id });
                        resolve(true);
                    };
                    putRequest.onerror = (event) => reject(event.target.error);
                } else {
                    reject(new Error('Customer not found'));
                }
            };
            
            getRequest.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async searchCustomers(query) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized || !this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            if (!query || query.trim() === '') {
                resolve([]);
                return;
            }
            
            const transaction = this.db.transaction([AppConfig.STORES.CUSTOMERS], 'readonly');
            const store = transaction.objectStore(AppConfig.STORES.CUSTOMERS);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const allCustomers = request.result || [];
                const searchTerm = query.toLowerCase().trim();
                
                const results = allCustomers.filter(customer => {
                    if (customer.deleted) return false;
                    
                    const searchFields = [
                        customer.name,
                        customer.phone,
                        customer.notes,
                        customer.id,
                        customer.models?.yakhun,
                        customer.deliveryDay
                    ];
                    
                    return searchFields.some(field => 
                        field && field.toString().toLowerCase().includes(searchTerm)
                    );
                }).map(c => Customer.fromObject(c));
                
                resolve(results);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async getSettings(key) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized || !this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([AppConfig.STORES.SETTINGS], 'readonly');
            const store = transaction.objectStore(AppConfig.STORES.SETTINGS);
            const request = store.get(key);
            
            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async saveSettings(key, value) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized || !this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([AppConfig.STORES.SETTINGS], 'readwrite');
            const store = transaction.objectStore(AppConfig.STORES.SETTINGS);
            
            const settings = {
                key: key,
                value: value,
                updatedAt: new Date().toISOString()
            };
            
            const request = store.put(settings);
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async createBackup() {
        try {
            const allCustomers = await this.getAllCustomers(true);
            const backupData = {
                customers: allCustomers.map(c => c.toObject()),
                timestamp: new Date().toISOString(),
                version: AppConfig.DATABASE_VERSION,
                totalCustomers: allCustomers.length
            };
            
            const transaction = this.db.transaction([AppConfig.STORES.BACKUP], 'readwrite');
            const store = transaction.objectStore(AppConfig.STORES.BACKUP);
            
            const backup = {
                date: new Date().toISOString(),
                data: backupData
            };
            
            await new Promise((resolve, reject) => {
                const request = store.add(backup);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
            
            return backupData;
        } catch (error) {
            throw error;
        }
    }

    async clearAllData() {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized || !this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([AppConfig.STORES.CUSTOMERS], 'readwrite');
            const store = transaction.objectStore(AppConfig.STORES.CUSTOMERS);
            const request = store.clear();
            
            request.onsuccess = () => {
                this.notifyUpdate('data_cleared', null);
                resolve();
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
}

// ========== UI HELPER FUNCTIONS ==========
function showNotification(message, type = 'info', duration = 4000) {
    const existingNotification = document.getElementById('globalNotification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'globalNotification';
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 30px;
        right: 30px;
        padding: 20px 30px;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        max-width: 500px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        font-size: 15px;
        transition: all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
        display: flex;
        align-items: center;
        gap: 15px;
        backdrop-filter: blur(10px);
        border-left: 5px solid;
        opacity: 0;
        transform: translateX(100px);
    `;
    
    const colors = {
        success: { bg: '#28a745', border: '#28a745' },
        error: { bg: '#dc3545', border: '#dc3545' },
        warning: { bg: '#ffc107', border: '#ffc107', text: '#333' },
        info: { bg: '#17a2b8', border: '#17a2b8' }
    };
    
    const color = colors[type] || colors.info;
    notification.style.backgroundColor = color.bg;
    notification.style.borderLeftColor = color.border;
    if (color.text) {
        notification.style.color = color.text;
    }
    
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    
    notification.innerHTML = `
        <span style="font-size: 20px; font-weight: bold;">${icons[type] || 'ℹ'}</span>
        <span>${escapeHtml(message)}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, duration);
}

function showLoading(message = 'در حال بارگذاری...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.92);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: white;
            font-family: Tahoma, Arial, sans-serif;
            backdrop-filter: blur(10px);
        `;

        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 70px;
            height: 70px;
            border: 5px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            border-top-color: #D4AF37;
            animation: spin 1s linear infinite;
            margin-bottom: 30px;
        `;

        const text = document.createElement('div');
        text.id = 'loadingText';
        text.style.cssText = `
            font-size: 18px;
            text-align: center;
            max-width: 400px;
            line-height: 1.8;
            color: #D4AF37;
        `;
        text.textContent = message;

        if (!document.getElementById('spinAnimation')) {
            const style = document.createElement('style');
            style.id = 'spinAnimation';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        overlay.appendChild(spinner);
        overlay.appendChild(text);
        document.body.appendChild(overlay);
    }
    
    overlay.style.display = 'flex';
    document.getElementById('loadingText').textContent = message;
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ========== INITIALIZATION ==========
async function initializeApp() {
    try {
        showLoading('در حال راه‌اندازی سیستم ALFAJR...');
        
        if (!window.indexedDB) {
            throw new Error('مرورگر شما از IndexedDB پشتیبانی نمی‌کند');
        }
        
        dbManager = new DatabaseManager();
        await dbManager.init();
        
        dbManager.onUpdate((type, data) => {
            switch (type) {
                case 'customer_saved':
                case 'customer_deleted':
                case 'data_cleared':
                    updateStats();
                    break;
            }
        });
        
        await loadCustomers();
        await loadSettings();
        
        const savedTheme = await dbManager.getSettings('theme') || 'dark';
        if (savedTheme === 'light') window.toggleLightMode();
        else if (savedTheme === 'vivid') window.toggleVividMode();
        else window.toggleDarkMode();
        
        setupEventListeners();
        
        hideLoading();
        showNotification('سیستم ALFAJR با موفقیت راه‌اندازی شد', 'success');
        isInitialized = true;
        
    } catch (error) {
        hideLoading();
        showNotification('خطا در راه‌اندازی سیستم: ' + error.message, 'error');
        
        const listElement = document.getElementById('customerList');
        if (listElement) {
            listElement.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>خطا در راه‌اندازی</h3>
                    <p>${escapeHtml(error.message)}</p>
                    <p>لطفاً صفحه را رفرش کنید یا از مرورگر دیگری استفاده نمایید.</p>
                    <button class="btn-primary" onclick="location.reload()" style="margin-top: 20px;">
                        <i class="fas fa-redo"></i> رفرش صفحه
                    </button>
                </div>
            `;
        }
    }
}

async function loadSettings() {
    try {
        const autoSave = await dbManager.getSettings('autoSave');
        if (autoSave === null) {
            await dbManager.saveSettings('autoSave', true);
        }
    } catch (error) {}
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = debounce(searchCustomer, 500);
        searchInput.addEventListener('input', debouncedSearch);
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchCustomer();
        });
    }
    
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', loadDataFromFile);
    }
    
    const notesTextarea = document.getElementById('customerNotes');
    if (notesTextarea) {
        notesTextarea.addEventListener('input', updateNotes);
    }
    
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (currentCustomerIndex !== null) {
                saveCustomer();
                showNotification('تغییرات ذخیره شد', 'success');
            }
        }
        
        if (e.key === 'Escape') {
            const profilePage = document.getElementById('profilePage');
            if (profilePage && profilePage.style.display !== 'none') {
                backHome();
            }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            addCustomer();
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            if (currentCustomerIndex !== null) {
                printFullTable();
            }
        }
        
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            window.scrollBy({
                top: e.key === 'ArrowDown' ? 100 : -100,
                behavior: 'smooth'
            });
        }
    });
    
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('settingsDropdown');
        const settingsBtn = document.querySelector('.settings-btn');
        
        if (dropdown && dropdown.classList.contains('show') && 
            !dropdown.contains(event.target) && 
            !settingsBtn.contains(event.target)) {
            dropdown.classList.remove('show');
        }
    });
}

// ========== CUSTOMER MANAGEMENT ==========
async function addCustomer() {
    const name = prompt('نام کامل مشتری را وارد کنید:');
    if (!name || name.trim() === '') {
        showNotification('نام مشتری الزامی است', 'warning');
        return;
    }

    const phone = prompt('شماره تلفن مشتری را وارد کنید:');
    if (!phone || phone.trim() === '' || !/^\d+$/.test(phone)) {
        showNotification('شماره تلفن باید عددی و حداقل ۱۰ رقم باشد', 'warning');
        return;
    }

    try {
        showLoading('در حال اضافه کردن مشتری جدید...');
        const customer = new Customer(name.trim(), phone.trim());
        await dbManager.saveCustomer(customer);
        
        await loadCustomers();
        
        const index = customers.findIndex(c => c.id === customer.id);
        if (index !== -1) {
            openProfile(index);
        }
        
        hideLoading();
        showNotification(`مشتری "${name}" با موفقیت اضافه شد`, 'success');
    } catch (error) {
        hideLoading();
        showNotification('خطا در اضافه کردن مشتری: ' + error.message, 'error');
    }
}

async function loadCustomers() {
    try {
        showLoading('در حال بارگذاری مشتریان...');
        customers = await dbManager.getAllCustomers();
        renderCustomerList();
        updateStats();
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('خطا در بارگذاری مشتریان', 'error');
        renderCustomerList();
    }
}

function renderCustomerList() {
    const listElement = document.getElementById('customerList');
    if (!listElement) return;

    if (!customers || customers.length === 0) {
        listElement.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>هنوز مشتری ثبت نشده است</h3>
                <p>برای شروع، روی دکمه "مشتری جدید" کلیک کنید</p>
                <button class="btn-primary" onclick="addCustomer()" style="margin-top: 20px;">
                    <i class="fas fa-user-plus"></i> افزودن اولین مشتری
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    customers.forEach((customer, index) => {
        const hasPrice = customer.sewingPriceAfghani && customer.sewingPriceAfghani > 0;
        const isPaid = customer.paymentReceived;
        const deliveryDay = customer.deliveryDay;
        const date = new Date(customer.createdAt);
        const formattedDate = date.toLocaleDateString('fa-IR');
        const hasNotes = customer.notes && customer.notes.trim().length > 0;
        
        html += `
            <div class="customer-card" onclick="openProfile(${index})">
                <div class="customer-header">
                    <span class="customer-id">${escapeHtml(customer.id)}</span>
                    <span class="customer-date">${escapeHtml(formattedDate)}</span>
                </div>
                <div class="customer-name">${escapeHtml(customer.name || 'بدون نام')}</div>
                <div class="customer-phone">
                    <i class="fas fa-phone"></i>
                    ${escapeHtml(customer.phone || 'بدون شماره')}
                </div>
                ${hasNotes ? `
                    <div class="customer-notes">
                        <i class="fas fa-sticky-note"></i>
                        ${escapeHtml(customer.notes.substring(0, 80))}${customer.notes.length > 80 ? '...' : ''}
                    </div>
                ` : ''}
                <div class="customer-footer">
                    <div class="customer-badges">
                        ${hasPrice ? `<span class="badge price">${formatPrice(customer.sewingPriceAfghani)} افغانی</span>` : ''}
                        ${isPaid ? '<span class="badge paid">پرداخت شده</span>' : ''}
                        ${deliveryDay ? `<span class="badge delivery">${escapeHtml(deliveryDay)}</span>` : ''}
                    </div>
                    <button class="delete-btn-small" onclick="event.stopPropagation(); deleteCustomer('${customer.id}', ${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });

    listElement.innerHTML = html;
}

async function searchCustomer() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (!query) {
        await loadCustomers();
        return;
    }

    try {
        showLoading('در حال جستجو...');
        const results = await dbManager.searchCustomers(query);
        
        const listElement = document.getElementById('customerList');
        if (!listElement) return;

        if (results.length === 0) {
            listElement.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>مشتری یافت نشد</h3>
                    <p>هیچ مشتری با مشخصات "${escapeHtml(query)}" پیدا نشد</p>
                    <button class="btn-secondary" onclick="document.getElementById('searchInput').value = ''; loadCustomers();" style="margin-top: 20px;">
                        <i class="fas fa-times"></i> پاک کردن جستجو
                    </button>
                </div>
            `;
            hideLoading();
            return;
        }

        let html = '';
        results.forEach((customer, index) => {
            const realIndex = customers.findIndex(c => c.id === customer.id);
            const hasPrice = customer.sewingPriceAfghani && customer.sewingPriceAfghani > 0;
            const isPaid = customer.paymentReceived;
            const deliveryDay = customer.deliveryDay;
            
            html += `
                <div class="customer-card search-result" onclick="openProfile(${realIndex})" style="border: 2px solid #D4AF37;">
                    <div style="background: rgba(212, 175, 55, 0.1); padding: 5px 10px; border-radius: 20px; font-size: 12px; color: #D4AF37; margin-bottom: 10px; display: inline-block;">
                        <i class="fas fa-search"></i> نتیجه جستجو
                    </div>
                    <div class="customer-name">${escapeHtml(customer.name || 'بدون نام')}</div>
                    <div class="customer-phone">
                        <i class="fas fa-phone"></i>
                        ${escapeHtml(customer.phone || 'بدون شماره')}
                    </div>
                    <div class="customer-footer">
                        <div class="customer-badges">
                            ${hasPrice ? `<span class="badge price">${formatPrice(customer.sewingPriceAfghani)} افغانی</span>` : ''}
                            ${isPaid ? '<span class="badge paid">پرداخت شده</span>' : ''}
                            ${deliveryDay ? `<span class="badge delivery">${escapeHtml(deliveryDay)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        listElement.innerHTML = html;
        hideLoading();
        showNotification(`${results.length} مشتری یافت شد`, 'success');
    } catch (error) {
        hideLoading();
        showNotification('خطا در جستجو', 'error');
    }
}

async function deleteCustomer(id, index) {
    if (!id) return;
    
    const customer = customers.find(c => c.id === id);
    if (!customer) return;
    
    const customerName = customer.name || 'این مشتری';
    if (!confirm(`آیا از حذف "${customerName}" مطمئن هستید؟\nاین عمل قابل بازگشت نیست.`)) return;
    
    try {
        showLoading('در حال حذف مشتری...');
        await dbManager.deleteCustomer(id);
        await loadCustomers();
        
        if (document.getElementById('profilePage').style.display !== 'none') {
            backHome();
        }
        
        hideLoading();
        showNotification('مشتری با موفقیت حذف شد', 'success');
    } catch (error) {
        hideLoading();
        showNotification('خطا در حذف مشتری', 'error');
    }
}

function deleteCurrentCustomer() {
    if (currentCustomerIndex === null) return;
    const customer = customers[currentCustomerIndex];
    if (!customer) return;
    deleteCustomer(customer.id, currentCustomerIndex);
}

// ========== PROFILE MANAGEMENT ==========
function openProfile(index) {
    if (index < 0 || index >= customers.length) {
        showNotification('مشتری یافت نشد', 'error');
        return;
    }

    currentCustomerIndex = index;
    const customer = customers[index];

    document.getElementById('profileName').textContent = customer.name || 'بدون نام';
    document.getElementById('profilePhoneText').textContent = customer.phone || 'بدون شماره';
    document.getElementById('profileId').textContent = `کد: ${customer.id}`;
    
    const notesElement = document.getElementById('customerNotes');
    if (notesElement) {
        notesElement.value = customer.notes || '';
    }

    renderMeasurements();
    renderModels();
    renderOrders();
    renderPriceDelivery();
    
    addPrintButtons();

    document.getElementById('homePage').style.display = 'none';
    document.getElementById('profilePage').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backHome() {
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('profilePage').style.display = 'none';
    currentCustomerIndex = null;
    loadCustomers();
}

function updateNotes() {
    if (currentCustomerIndex === null) return;
    
    const notesElement = document.getElementById('customerNotes');
    if (!notesElement) return;
    
    const customer = customers[currentCustomerIndex];
    customer.notes = notesElement.value;
    saveCustomer();
}

function saveCustomer() {
    if (currentCustomerIndex === null) return;
    
    try {
        const customer = customers[currentCustomerIndex];
        if (!customer) return;
        
        const notesElement = document.getElementById('customerNotes');
        if (notesElement) {
            customer.notes = notesElement.value;
        }
        
        const measurementInputs = document.querySelectorAll('.measurement-input');
        measurementInputs.forEach(input => {
            const field = input.dataset.field;
            if (field) {
                const value = input.value;
                customer.measurements[field] = value ? parseFloat(value) : '';
            }
        });
        
        const priceInput = document.getElementById('sewingPrice');
        if (priceInput) {
            const priceValue = priceInput.value;
            customer.sewingPriceAfghani = priceValue ? parseInt(priceValue) : null;
        }
        
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            try {
                await dbManager.saveCustomer(customer);
                
                const saveIndicator = document.createElement('div');
                saveIndicator.textContent = '✓ ذخیره شد';
                saveIndicator.style.cssText = `
                    position: fixed;
                    bottom: 80px;
                    left: 30px;
                    background: #28a745;
                    color: white;
                    padding: 8px 15px;
                    border-radius: 20px;
                    font-size: 12px;
                    z-index: 1000;
                    animation: fadeInOut 2s;
                `;
                document.body.appendChild(saveIndicator);
                setTimeout(() => {
                    if (saveIndicator.parentNode) {
                        saveIndicator.parentNode.removeChild(saveIndicator);
                    }
                }, 2000);
            } catch (error) {}
        }, 1500);
    } catch (error) {
        showNotification('خطا در ذخیره', 'error');
    }
}

// ========== MEASUREMENTS SECTION ==========
function renderMeasurements() {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    const container = document.getElementById('measurementsContainer');
    if (!container) return;

    let html = `
        <div class="section-header">
            <h3><i class="fas fa-ruler-combined"></i> اندازه‌گیری‌ها</h3>
        </div>
        <div class="measurements-grid">
    `;

    const groups = [
        {
            title: 'قد',
            fields: [{key: 'قد', label: 'قد', placeholder: '170', icon: 'fas fa-user-alt'}]
        },
        {
            title: 'شانه',
            fields: [
                {key: 'شانه_یک', label: 'شانه یک', placeholder: '45', icon: 'fas fa-arrows-alt-h'},
                {key: 'شانه_دو', label: 'شانه دو', placeholder: '45', icon: 'fas fa-arrows-alt-h'}
            ]
        },
        {
            title: 'آستین',
            fields: [
                {key: 'آستین_یک', label: 'آستین یک', placeholder: '60', icon: 'fas fa-hand-paper'},
                {key: 'آستین_دو', label: 'آستین دو', placeholder: '25', icon: 'fas fa-arrows-alt-v'},
                {key: 'آستین_سه', label: 'آستین سه', placeholder: '15', icon: 'fas fa-ruler-vertical'}
            ]
        },
        {
            title: 'بدنه',
            fields: [
                {key: 'بغل', label: 'بغل', placeholder: '50', icon: 'fas fa-tshirt'},
                {key: 'دامن', label: 'دامن', placeholder: '100', icon: 'fas fa-venus'},
                {key: 'گردن', label: 'گردن', placeholder: '40', icon: 'fas fa-circle'},
                {key: 'دور_سینه', label: 'دور سینه', placeholder: '100', icon: 'fas fa-arrows-alt'}
            ]
        },
        {
            title: 'شلوار',
            fields: [
                {key: 'شلوار', label: 'شلوار', placeholder: '110', icon: 'fas fa-male'},
                {key: 'دم_پاچه', label: 'دم پاچه', placeholder: '22', icon: 'fas fa-shoe-prints'}
            ]
        },
        {
            title: 'سایر',
            fields: [
                {key: 'بر_تمبان', label: 'بر تهمان', placeholder: '40', icon: 'fas fa-ruler'},
                {key: 'خشتک', label: 'خشتک', placeholder: '25', icon: 'fas fa-shoe-prints'},
                {key: 'چاک_پتی', label: 'چاک پتی', placeholder: '30', icon: 'fas fa-cut'}
            ]
        },
        {
            title: 'سفارش',
            fields: [
                {key: 'تعداد_سفارش', label: 'تعداد سفارش', placeholder: '1', icon: 'fas fa-clipboard-list'},
                {key: 'مقدار_تکه', label: 'مقدار تکه', placeholder: '2', icon: 'fas fa-layer-group'}
            ]
        }
    ];

    groups.forEach(group => {
        html += `<div class="measurement-group">`;
        html += `<h4><i class="fas fa-cube"></i> ${group.title}</h4>`;
        html += `<div class="measurement-fields">`;
        
        group.fields.forEach(field => {
            const value = customer.measurements[field.key] || '';
            html += `
                <div class="measurement-field">
                    <label><i class="${field.icon}"></i> ${field.label}</label>
                    <input type="number" 
                           class="measurement-input" 
                           data-field="${field.key}"
                           value="${value}"
                           placeholder="${field.placeholder}"
                           oninput="updateMeasurement('${field.key}', this.value)"
                           onkeydown="handleMeasurementKeydown(event, '${field.key}')"
                           step="0.5"
                           min="0">
                </div>
            `;
        });
        
        html += `</div></div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function updateMeasurement(field, value) {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    if (!customer.measurements) {
        customer.measurements = {};
    }
    
    customer.measurements[field] = value ? parseFloat(value) : '';
    saveCustomer();
}

function handleMeasurementKeydown(event, field) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const inputs = document.querySelectorAll('.measurement-input');
        const currentIndex = Array.from(inputs).findIndex(input => input.dataset.field === field);
        if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
            inputs[currentIndex + 1].focus();
            inputs[currentIndex + 1].select();
        }
    }
}

// ========== MODELS SECTION ==========
function renderModels() {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    const container = document.getElementById('modelsContainer');
    if (!container) return;

    let html = `
        <div class="section-header">
            <h3><i class="fas fa-tshirt"></i> مدل‌ها و ویژگی‌ها</h3>
        </div>
        <div class="models-grid">
    `;

    html += `
        <div class="model-category">
            <h4><i class="fas fa-snowflake"></i> مدل یخن</h4>
            <div class="model-options">
    `;
    
    AppConfig.YAKHUN_MODELS.forEach(model => {
        const isSelected = customer.models.yakhun === model;
        html += `
            <div class="model-option ${isSelected ? 'selected' : ''}" 
                 onclick="selectModel('yakhun', '${model.replace(/'/g, "\\'")}')">
                ${escapeHtml(model)}
            </div>
        `;
    });
    
    html += `</div></div>`;

    html += `
        <div class="model-category">
            <h4><i class="fas fa-hand-paper"></i> مدل آستین</h4>
            <div class="model-options">
    `;
    
    AppConfig.SLEEVE_MODELS.forEach(model => {
        const isSelected = customer.models.sleeve === model;
        html += `
            <div class="model-option ${isSelected ? 'selected' : ''}" 
                 onclick="selectModel('sleeve', '${model.replace(/'/g, "\\'")}')">
                ${escapeHtml(model)}
            </div>
        `;
    });
    
    html += `</div></div>`;

    html += `
        <div class="model-category">
            <h4><i class="fas fa-venus"></i> مدل دامن</h4>
            <div class="model-options">
    `;
    
    AppConfig.SKIRT_MODELS.forEach(model => {
        const isSelected = customer.models.skirt && customer.models.skirt.includes(model);
        html += `
            <div class="model-option multi-select ${isSelected ? 'selected' : ''}" 
                 onclick="toggleMultiSelect('skirt', '${model.replace(/'/g, "\\'")}')">
                ${escapeHtml(model)}
                <span class="checkmark">${isSelected ? '✓' : ''}</span>
            </div>
        `;
    });
    
    html += `</div></div>`;

    html += `
        <div class="model-category">
            <h4><i class="fas fa-star"></i> ویژگی‌ها</h4>
            <div class="model-options">
    `;
    
    AppConfig.FEATURES_LIST.forEach(feature => {
        const isSelected = customer.models.features && customer.models.features.includes(feature);
        html += `
            <div class="model-option multi-select ${isSelected ? 'selected' : ''}" 
                 onclick="toggleMultiSelect('features', '${feature.replace(/'/g, "\\'")}')">
                ${escapeHtml(feature)}
                <span class="checkmark">${isSelected ? '✓' : ''}</span>
            </div>
        `;
    });
    
    html += `</div></div></div>`;
    container.innerHTML = html;
}

function selectModel(type, model) {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    customer.models[type] = model;
    renderModels();
    saveCustomer();
    showNotification(`مدل ${type === 'yakhun' ? 'یخن' : 'آستین'} به "${model}" تغییر کرد`, 'success');
}

function toggleMultiSelect(type, value) {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    if (!customer.models[type]) {
        customer.models[type] = [];
    }
    
    const index = customer.models[type].indexOf(value);
    if (index > -1) {
        customer.models[type].splice(index, 1);
        showNotification(`"${value}" حذف شد`, 'info');
    } else {
        customer.models[type].push(value);
        showNotification(`"${value}" اضافه شد`, 'success');
    }
    
    renderModels();
    saveCustomer();
}

// ========== PRICE & DELIVERY SECTION ==========
function renderPriceDelivery() {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    const container = document.getElementById('priceDeliveryContainer');
    if (!container) return;

    let html = `
        <div class="section-header">
            <h3><i class="fas fa-money-bill-wave"></i> قیمت و تحویل</h3>
        </div>
        <div class="price-delivery-grid">
            <div class="price-section">
                <h4><i class="fas fa-money-bill"></i> قیمت دوخت</h4>
                <div class="price-input-group">
                    <input type="number" 
                           id="sewingPrice"
                           value="${customer.sewingPriceAfghani || ''}"
                           placeholder="مبلغ به افغانی"
                           oninput="updatePrice(this.value)"
                           min="0">
                    <span class="currency">افغانی</span>
                </div>
                <p style="color: #888; margin-top: 10px; font-size: 14px;">مبلغ را به عدد وارد کنید</p>
            </div>
            
            <div class="payment-section">
                <h4><i class="fas fa-check-circle"></i> وضعیت پرداخت</h4>
                <div class="payment-toggle" onclick="togglePayment()">
                    <div class="payment-checkbox ${customer.paymentReceived ? 'checked' : ''}">
                        <div class="checkbox-icon">${customer.paymentReceived ? '✓' : ''}</div>
                        <span>${customer.paymentReceived ? 'پرداخت شده' : 'پرداخت نشده'}</span>
                    </div>
                    ${customer.paymentReceived && customer.paymentDate ? 
                        `<div class="payment-date">تاریخ پرداخت: ${new Date(customer.paymentDate).toLocaleDateString('fa-IR')}</div>` : ''}
                </div>
            </div>
            
            <div class="delivery-section">
                <h4><i class="fas fa-calendar-check"></i> روز تحویل</h4>
                <div class="delivery-days">
    `;
    
    AppConfig.DAYS_OF_WEEK.forEach(day => {
        const isSelected = customer.deliveryDay === day;
        html += `
            <div class="day-button ${isSelected ? 'selected' : ''}" 
                 onclick="setDeliveryDay('${day.replace(/'/g, "\\'")}')">
                ${escapeHtml(day)}
            </div>
        `;
    });
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function updatePrice(price) {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    customer.sewingPriceAfghani = price ? parseInt(price) : null;
    saveCustomer();
}

function togglePayment() {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    customer.paymentReceived = !customer.paymentReceived;
    
    if (customer.paymentReceived && !customer.paymentDate) {
        customer.paymentDate = new Date().toISOString();
    } else if (!customer.paymentReceived) {
        customer.paymentDate = null;
    }
    
    renderPriceDelivery();
    saveCustomer();
    showNotification(`وضعیت پرداخت تغییر کرد به: ${customer.paymentReceived ? 'پرداخت شده' : 'پرداخت نشده'}`, 'success');
}

function setDeliveryDay(day) {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    customer.deliveryDay = day;
    renderPriceDelivery();
    saveCustomer();
    showNotification(`روز تحویل به ${day} تنظیم شد`, 'success');
}

// ========== ORDERS SECTION ==========
function renderOrders() {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    let html = `
        <div class="section-header">
            <h3><i class="fas fa-clipboard-list"></i> سفارشات</h3>
            <button class="btn-add-order" onclick="addOrder()">
                <i class="fas fa-plus"></i> سفارش جدید
            </button>
        </div>
    `;
    
    if (!customer.orders || customer.orders.length === 0) {
        html += `
            <div class="empty-orders">
                <i class="fas fa-clipboard"></i>
                <p>هنوز سفارشی ثبت نشده است</p>
            </div>
        `;
    } else {
        html += `<div class="orders-list">`;
        customer.orders.forEach((order, index) => {
            const date = new Date(order.date || order.createdAt);
            html += `
                <div class="order-item">
                    <div class="order-content">
                        <div class="order-header">
                            <span class="order-number">سفارش #${index + 1}</span>
                            <span class="order-date">${date.toLocaleDateString('fa-IR')}</span>
                        </div>
                        <div class="order-details">${escapeHtml(order.details || 'بدون توضیحات')}</div>
                    </div>
                    <button class="btn-delete-order" onclick="deleteOrder(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    container.innerHTML = html;
}

function addOrder() {
    if (currentCustomerIndex === null) return;
    
    const details = prompt('جزئیات سفارش جدید را وارد کنید (متن):');
    if (!details || details.trim() === '') {
        showNotification('لطفاً جزئیات سفارش را وارد کنید', 'warning');
        return;
    }
    
    const customer = customers[currentCustomerIndex];
    if (!customer.orders) {
        customer.orders = [];
    }
    
    customer.orders.push({
        id: Date.now().toString(),
        details: details.trim(),
        date: new Date().toISOString(),
        status: 'pending'
    });
    
    renderOrders();
    saveCustomer();
    showNotification('سفارش جدید اضافه شد', 'success');
}

function deleteOrder(index) {
    if (currentCustomerIndex === null) return;
    
    const customer = customers[currentCustomerIndex];
    if (!customer.orders || index >= customer.orders.length) return;
    
    if (confirm('آیا از حذف این سفارش مطمئن هستید؟')) {
        customer.orders.splice(index, 1);
        renderOrders();
        saveCustomer();
        showNotification('سفارش حذف شد', 'success');
    }
}

// ========== PRINT FUNCTIONS ==========
function printFullTable() {
    if (currentCustomerIndex === null) {
        showNotification('لطفاً ابتدا یک مشتری انتخاب کنید', 'warning');
        return;
    }

    const customer = customers[currentCustomerIndex];
    const today = new Date();
    const persianDate = today.toLocaleDateString('fa-IR');
    const time = today.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    
    // فرمت جدید لیبل بر اساس درخواست شما
    const printContent = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
    <meta charset="UTF-8">
    <title>لیبل اندازه‌گیری ALFAJR</title>
    <style>
        @page { 
            size: 76mm auto; 
            margin: 2mm; 
            padding: 0;
        }
        body { 
            width: 72mm; 
            padding: 0; 
            font-family: "B Nazanin", "B Mitra", Tahoma, Arial, sans-serif; 
            font-size: 13px !important; 
            margin: 0 auto;
            background: white;
            color: black;
            line-height: 1.5;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        .header {
            text-align: center;
            padding: 3mm 0;
            border-bottom: 1px solid #000;
            margin-bottom: 3mm;
        }
        .shop-name {
            font-size: 16px !important;
            font-weight: bold;
            margin-bottom: 2mm;
        }
        .contact {
            font-size: 12px !important;
            margin-bottom: 1mm;
        }
        .customer-info {
            text-align: center;
            margin: 2mm 0;
            padding: 2mm;
            background: #f0f0f0;
            border-radius: 1px;
        }
        .customer-name {
            font-size: 14px !important;
            font-weight: bold;
            margin-bottom: 1mm;
        }
        .customer-phone {
            font-size: 12px !important;
            margin-bottom: 1mm;
        }
        .customer-id {
            font-size: 11px !important;
            color: #666;
        }
        .measurements-table {
            width: 100%;
            margin: 3mm 0;
            border-collapse: collapse;
            font-size: 12px !important;
        }
        .measurement-row {
            margin-bottom: 1mm;
            padding: 1mm 0;
            border-bottom: 0.3px dashed #ccc;
        }
        .measurement-label {
            font-weight: bold;
            text-align: right;
            padding-left: 2mm;
            width: 45%;
        }
        .measurement-value {
            text-align: left;
            font-family: 'Courier New', monospace;
            width: 55%;
        }
        .multi-field {
            display: flex;
            gap: 5mm;
            justify-content: space-between;
        }
        .multi-value {
            font-family: 'Courier New', monospace;
        }
        .models-section {
            margin-top: 3mm;
            padding-top: 2mm;
            border-top: 0.5px dashed #000;
            font-size: 12px !important;
        }
        .model-item {
            margin-bottom: 1mm;
        }
        .model-label {
            font-weight: bold;
            display: inline-block;
            width: 25mm;
        }
        .footer {
            text-align: center;
            margin-top: 3mm;
            padding-top: 2mm;
            border-top: 0.5px solid #ccc;
            font-size: 10px !important;
            color: #666;
        }
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="shop-name">ALFAJR خیاطی</div>
        <div class="contact">۰۷۹۹۷۹۹۰۰۹</div>
    </div>
    
    <div class="customer-info">
        <div class="customer-name">${escapeHtml(customer.name || 'بدون نام')}</div>
        <div class="customer-phone">${escapeHtml(customer.phone || 'بدون شماره')}</div>
        <div class="customer-id">کد: ${escapeHtml(customer.id)}</div>
    </div>
    
    <table class="measurements-table">
        <tr class="measurement-row">
            <td class="measurement-label">قد:</td>
            <td class="measurement-value">${customer.measurements.قد || '-'}</td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">شانه:</td>
            <td class="measurement-value">
                ${customer.measurements.شانه_یک || '-'} - ${customer.measurements.شانه_دو || '-'}
            </td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">آستین:</td>
            <td class="measurement-value">
                ${customer.measurements.آستین_یک || '-'} - ${customer.measurements.آستین_دو || '-'} - ${customer.measurements.آستین_سه || '-'}
            </td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">بغل:</td>
            <td class="measurement-value">${customer.measurements.بغل || '-'}</td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">دامن:</td>
            <td class="measurement-value">${customer.measurements.دامن || '-'}</td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">گردن:</td>
            <td class="measurement-value">${customer.measurements.گردن || '-'}</td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">دور سینه:</td>
            <td class="measurement-value">${customer.measurements.دور_سینه || '-'}</td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">شلوار:</td>
            <td class="measurement-value">${customer.measurements.شلوار || '-'}</td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">دم پاچه:</td>
            <td class="measurement-value">${customer.measurements.دم_پاچه || '-'}</td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">ب - خ:</td>
            <td class="measurement-value">
                ب: ${customer.measurements.بر_تمبان || '-'} - خ: ${customer.measurements.خشتک || '-'}
            </td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">چاک:</td>
            <td class="measurement-value">${customer.measurements.چاک_پتی || '-'}</td>
        </tr>
        <tr class="measurement-row">
            <td class="measurement-label">سفارش - تکه:</td>
            <td class="measurement-value">
                ${customer.measurements.تعداد_سفارش || '-'} - ${customer.measurements.مقدار_تکه || '-'}
            </td>
        </tr>
    </table>
    
    <div class="models-section">
        <div class="model-item">
            <span class="model-label">یخن:</span>
            <span>${escapeHtml(customer.models.yakhun || '-')}</span>
        </div>
        ${customer.models.sleeve ? `
        <div class="model-item">
            <span class="model-label">آستین:</span>
            <span>${escapeHtml(customer.models.sleeve)}</span>
        </div>
        ` : ''}
        ${customer.models.skirt && customer.models.skirt.length > 0 ? `
        <div class="model-item">
            <span class="model-label">دامن:</span>
            <span>${escapeHtml(customer.models.skirt.join('، '))}</span>
        </div>
        ` : ''}
        ${customer.models.features && customer.models.features.length > 0 ? `
        <div class="model-item">
            <span class="model-label">ویژگی:</span>
            <span>${escapeHtml(customer.models.features.join('، '))}</span>
        </div>
        ` : ''}
        ${customer.deliveryDay ? `
        <div class="model-item">
            <span class="model-label">تحویل:</span>
            <span>${escapeHtml(customer.deliveryDay)}</span>
        </div>
        ` : ''}
    </div>
    
    <div class="footer">
        <div>${persianDate} - ${time}</div>
        <div>سیستم مدیریت خیاطی ALFAJR</div>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                setTimeout(function() {
                    window.close();
                }, 500);
            }, 300);
        };
        window.onbeforeunload = null;
    </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=600,height=800,toolbar=no,scrollbars=no,status=no');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
    } else {
        showNotification('لطفاً popup blocker را غیرفعال کنید', 'error');
    }
}

function printProfessionalInvoice() {
    if (currentCustomerIndex === null) {
        showNotification('لطفاً ابتدا یک مشتری انتخاب کنید', 'warning');
        return;
    }

    const customer = customers[currentCustomerIndex];
    const today = new Date();
    const persianDate = today.toLocaleDateString('fa-IR');
    
    const printContent = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
    <meta charset="UTF-8">
    <title>فاکتور ALFAJR</title>
    <style>
        @page { 
            size: 76mm auto; 
            margin: 2mm; 
            padding: 0;
        }
        body { 
            width: 72mm; 
            padding: 0; 
            font-family: "B Nazanin", "B Mitra", Tahoma, Arial, sans-serif; 
            font-size: 14px !important; 
            margin: 0 auto;
            background: white;
            color: black;
            line-height: 1.5;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        .invoice {
            border: 1px solid #000;
            padding: 3mm;
            border-radius: 1px;
        }
        .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
            margin-bottom: 3mm;
        }
        .logo {
            font-size: 18px !important;
            font-weight: bold;
            color: #000;
            margin-bottom: 1mm;
        }
        .title {
            font-size: 16px !important;
            font-weight: bold;
            margin-bottom: 2mm;
        }
        .contact {
            font-size: 12px !important;
        }
        .customer-info {
            margin: 3mm 0;
            padding: 2mm;
            background: #f0f0f0;
            border-radius: 1px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1mm;
            font-size: 12px !important;
        }
        .info-label {
            font-weight: bold;
            min-width: 20mm;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px !important;
            margin: 3mm 0;
        }
        .details-table td {
            border: 0.5px solid #000;
            padding: 1.5mm;
            vertical-align: middle;
        }
        .col-label {
            width: 30%;
            background: #f8f8f8;
            font-weight: bold;
        }
        .col-value {
            width: 70%;
        }
        .price-section {
            text-align: center;
            margin: 3mm 0;
            padding: 2mm;
            border: 1px solid #000;
            border-radius: 1px;
        }
        .price-label {
            font-size: 13px !important;
            font-weight: bold;
        }
        .price-amount {
            font-size: 16px !important;
            font-weight: bold;
            color: #000;
            margin-top: 2mm;
        }
        .thank-you {
            text-align: center;
            margin-top: 3mm;
            padding: 2mm;
            border-top: 0.5px dashed #000;
            font-size: 11px !important;
            color: #666;
        }
        .brand {
            font-weight: bold;
            font-size: 12px !important;
        }
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="logo">ALFAJR خیاطی</div>
            <div class="contact">۰۷۹۹۷۹۹۰۰۹</div>
            <div class="title">فاکتور فروش</div>
        </div>
        
        <div class="customer-info">
            <div class="info-row">
                <span class="info-label">مشتری:</span>
                <span class="info-value">${escapeHtml(customer.name || 'بدون نام')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">تلفن:</span>
                <span class="info-value">${escapeHtml(customer.phone || 'بدون شماره')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">کد مشتری:</span>
                <span class="info-value">${escapeHtml(customer.id)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">تاریخ:</span>
                <span class="info-value">${persianDate}</span>
            </div>
        </div>
        
        <table class="details-table">
            <tr>
                <td class="col-label">مدل یخن</td>
                <td class="col-value">${escapeHtml(customer.models.yakhun || '-')}</td>
            </tr>
            <tr>
                <td class="col-label">تاریخ تحویل</td>
                <td class="col-value">${escapeHtml(customer.deliveryDay || '-')}</td>
            </tr>
        </table>
        
        ${customer.sewingPriceAfghani ? `
        <div class="price-section">
            <div class="price-label">مبلغ قابل پرداخت</div>
            <div class="price-amount">${formatPrice(customer.sewingPriceAfghani)} افغانی</div>
            ${customer.paymentReceived ? 
                '<div style="color: green; font-size: 11px; margin-top: 1mm;">✅ پرداخت شده</div>' : 
                '<div style="color: red; font-size: 11px; margin-top: 1mm;">❌ پرداخت نشده</div>'}
        </div>
        ` : ''}
        
        <div class="thank-you">
            <div>با تشکر از انتخاب شما</div>
            <div class="brand">برند الفجر</div>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                setTimeout(function() {
                    window.close();
                }, 500);
            }, 300);
        };
        window.onbeforeunload = null;
    </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=600,height=800,toolbar=no,scrollbars=no,status=no');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
    } else {
        showNotification('لطفاً popup blocker را غیرفعال کنید', 'error');
    }
}

function addPrintButtons() {
    const printContainer = document.getElementById('printButtonsContainer');
    if (printContainer) {
        printContainer.innerHTML = `
            <button class="btn-primary" onclick="printFullTable()">
                <i class="fas fa-print"></i>
                چاپ لیبل اندازه
            </button>
            <button class="btn-secondary" onclick="printProfessionalInvoice()">
                <i class="fas fa-file-invoice"></i>
                چاپ فاکتور
            </button>
        `;
    }
}

// ========== STATISTICS ==========
async function updateStats() {
    try {
        const totalCustomers = customers.length;
        const totalOrders = customers.reduce((sum, customer) => sum + (customer.orders ? customer.orders.length : 0), 0);
        const paidCustomers = customers.filter(c => c.paymentReceived).length;
        
        document.getElementById('totalCustomers').textContent = totalCustomers;
        document.getElementById('activeOrders').textContent = totalOrders;
        document.getElementById('paidCustomers').textContent = paidCustomers;
        
    } catch (error) {}
}

// ========== DATA MANAGEMENT ==========
async function saveDataToFile() {
    try {
        showLoading('در حال آماده‌سازی داده‌ها...');
        
        const backupData = await dbManager.createBackup();
        
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
        link.download = `alfajr-backup-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        hideLoading();
        showNotification(`پشتیبان با موفقیت ذخیره شد`, 'success');
    } catch (error) {
        hideLoading();
        showNotification('خطا در ذخیره فایل: ' + error.message, 'error');
    }
}

function loadDataFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('آیا از وارد کردن داده‌های جدید مطمئن هستید؟\nاین عمل ممکن است داده‌های فعلی را بازنویسی کند.')) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            showLoading('در حال وارد کردن داده‌ها...');
            const backupData = JSON.parse(e.target.result);
            
            if (!backupData || !backupData.customers || !Array.isArray(backupData.customers)) {
                throw new Error('فرمت فایل نامعتبر است');
            }
            
            await dbManager.clearAllData();
            
            let importedCount = 0;
            
            for (const customerData of backupData.customers) {
                try {
                    if (customerData.deleted) continue;
                    const customer = Customer.fromObject(customerData);
                    await dbManager.saveCustomer(customer);
                    importedCount++;
                } catch (error) {}
            }
            
            await loadCustomers();
            
            hideLoading();
            showNotification(`${importedCount} مشتری با موفقیت وارد شد`, 'success');
            
            event.target.value = '';
        } catch (error) {
            hideLoading();
            showNotification('خطا در وارد کردن داده‌ها: ' + error.message, 'error');
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

async function clearAllData() {
    if (!confirm('⚠️ ⚠️ ⚠️\n\nآیا از پاک‌سازی تمام داده‌ها مطمئن هستید؟\n\nاین عمل قابل بازگشت نیست و تمام مشتریان، سفارشات و تنظیمات پاک خواهند شد.')) return;
    
    if (!confirm('❌ ❌ ❌\n\nآخرین هشدار!\n\nتمام اطلاعات شما حذف خواهد شد. برای ادامه مجدداً تأیید کنید.')) return;
    
    try {
        showLoading('در حال پاک‌سازی کامل دیتابیس...');
        await dbManager.clearAllData();
        customers = [];
        currentCustomerIndex = null;
        await loadCustomers();
        backHome();
        hideLoading();
        showNotification('تمامی داده‌ها با موفقیت پاک شدند', 'success');
    } catch (error) {
        hideLoading();
        showNotification('خطا در پاک‌سازی: ' + error.message, 'error');
    }
}

// ========== THEME MANAGEMENT ==========
function toggleDarkMode() {
    document.body.className = 'dark-mode';
    currentTheme = 'dark';
    if (dbManager) {
        dbManager.saveSettings('theme', 'dark');
    }
    showNotification('حالت تاریک فعال شد', 'success');
}

function toggleLightMode() {
    document.body.className = 'light-mode';
    currentTheme = 'light';
    if (dbManager) {
        dbManager.saveSettings('theme', 'light');
    }
    showNotification('حالت روشن فعال شد', 'success');
}

function toggleVividMode() {
    document.body.className = 'vivid-mode';
    currentTheme = 'vivid';
    if (dbManager) {
        dbManager.saveSettings('theme', 'vivid');
    }
    showNotification('حالت ویوید فعال شد', 'success');
}

// ========== GLOBAL EXPORTS ==========
window.addCustomer = addCustomer;
window.searchCustomer = searchCustomer;
window.openProfile = openProfile;
window.backHome = backHome;
window.saveCustomer = saveCustomer;
window.deleteCustomer = deleteCustomer;
window.deleteCurrentCustomer = deleteCurrentCustomer;
window.updateNotes = updateNotes;
window.updateMeasurement = updateMeasurement;
window.handleMeasurementKeydown = handleMeasurementKeydown;
window.selectModel = selectModel;
window.toggleMultiSelect = toggleMultiSelect;
window.updatePrice = updatePrice;
window.togglePayment = togglePayment;
window.setDeliveryDay = setDeliveryDay;
window.addOrder = addOrder;
window.deleteOrder = deleteOrder;
window.printFullTable = printFullTable;
window.printProfessionalInvoice = printProfessionalInvoice;
window.saveDataToFile = saveDataToFile;
window.loadDataFromFile = loadDataFromFile;
window.clearAllData = clearAllData;
window.toggleDarkMode = toggleDarkMode;
window.toggleLightMode = toggleLightMode;
window.toggleVividMode = toggleVividMode;
window.formatPrice = formatPrice;
window.showNotification = showNotification;
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// ========== START APP ==========
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

console.log('ALFAJR App initialized - Version 5.0');