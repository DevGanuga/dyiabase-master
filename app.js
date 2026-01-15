/* 
 * JunkProfit Tracker Pro - Developer Version
 * 
 * This version has NO licensing restrictions.
 * All data is stored in localStorage with the key prefix 'junkProfit_dev_'
 * 
 * To add authentication:
 * 1. Replace the init() method to check for valid authentication
 * 2. Add your own authentication service (Firebase, Supabase, custom API, etc.)
 * 3. Store user ID instead of 'dev' in getStorageKey()
 */

const app = {
  currentUser: 'dev',
  currentView: 'dashboard',
  jobs: [],
  quotes: [],
  settings: { 
    taxPercentage: 30, 
    monthlyGoal: 0,
    businessInfo: { name: '', phone: '', email: '', address: '', logo: null }
  },
  selectedMonth: new Date(),
  editingJob: null,
  tempCustomers: null,
  tempExpenses: null,
  tempPhotos: [],
  
  init() {
    this.loadData();
    this.cleanOldQuotes();
    this.showApp();
  },
  
  showApp() {
    document.getElementById('appContainer').classList.add('dev-banner-active');
    this.renderNav();
    this.render();
  },
  
  getStorageKey(key) {
    return `junkProfit_${this.currentUser}_${key}`;
  },
  
  loadData() {
    try {
      const savedJobs = localStorage.getItem(this.getStorageKey('jobs'));
      const savedQuotes = localStorage.getItem(this.getStorageKey('quotes'));
      const savedSettings = localStorage.getItem(this.getStorageKey('settings'));
      
      if (savedJobs) {
        this.jobs = JSON.parse(savedJobs);
      }
      if (savedQuotes) {
        this.quotes = JSON.parse(savedQuotes);
      }
      if (savedSettings) {
        const loadedSettings = JSON.parse(savedSettings);
        this.settings = {
          taxPercentage: loadedSettings.taxPercentage || 30,
          monthlyGoal: loadedSettings.monthlyGoal || 0,
          businessInfo: {
            name: loadedSettings.businessInfo?.name || '',
            phone: loadedSettings.businessInfo?.phone || '',
            email: loadedSettings.businessInfo?.email || '',
            address: loadedSettings.businessInfo?.address || '',
            logo: loadedSettings.businessInfo?.logo || null
          }
        };
      }
    } catch (e) {
      console.error('Error loading data:', e);
      alert('Error loading data. Your data may be corrupted.');
    }
  },
  
  saveData() {
    try {
      const jobsData = JSON.stringify(this.jobs);
      const quotesData = JSON.stringify(this.quotes);
      const settingsData = JSON.stringify(this.settings);
      
      const totalSize = jobsData.length + quotesData.length + settingsData.length;
      console.log(`Saving ${(totalSize / 1024 / 1024).toFixed(2)} MB of data`);
      
      if (totalSize > 5 * 1024 * 1024) {
        throw new Error('Data too large (>5MB). Try removing some photos from quotes.');
      }
      
      localStorage.setItem(this.getStorageKey('jobs'), jobsData);
      localStorage.setItem(this.getStorageKey('quotes'), quotesData);
      localStorage.setItem(this.getStorageKey('settings'), settingsData);
    } catch (e) {
      console.error('Error saving data:', e);
      if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
        alert('Storage full! Photos are too large. Try:\n1. Remove old photos from quotes\n2. Use smaller images\n3. Delete old quotes');
      } else {
        alert('Error saving data: ' + e.message);
      }
    }
  },
  
  cleanOldQuotes() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.quotes = this.quotes.filter(q => q.createdAt > thirtyDaysAgo);
    this.saveData();
  },
  
  exportData() {
    const data = {
      jobs: this.jobs,
      quotes: this.quotes,
      settings: this.settings,
      exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `junkprofit-backup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    this.showSuccessMessage('📥 Data exported successfully!');
  },
  
  clearData() {
    if (confirm('⚠️ Clear ALL data? This cannot be undone!\n\nMake sure to export your data first.')) {
      if (confirm('Are you ABSOLUTELY sure? This will delete all jobs, quotes, and settings.')) {
        localStorage.removeItem(this.getStorageKey('jobs'));
        localStorage.removeItem(this.getStorageKey('quotes'));
        localStorage.removeItem(this.getStorageKey('settings'));
        this.jobs = [];
        this.quotes = [];
        this.settings = { 
          taxPercentage: 30, 
          monthlyGoal: 0,
          businessInfo: { name: '', phone: '', email: '', address: '', logo: null }
        };
        this.render();
        this.showSuccessMessage('🗑️ All data cleared!');
      }
    }
  },
  
  setView(view) {
    this.currentView = view;
    this.editingJob = null;
    this.tempCustomers = null;
    this.tempExpenses = null;
    this.tempPhotos = [];
    this.renderNav();
    this.render();
  },
  
  renderNav() {
    const nav = document.getElementById('nav');
    const views = [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'jobs', icon: '💼', label: 'Jobs' },
      { id: 'quotes', icon: '📋', label: 'Quotes' },
      { id: 'quoteBuilder', icon: '✏️', label: 'Quote Builder' },
      { id: 'settings', icon: '⚙️', label: 'Settings' }
    ];
    
    nav.innerHTML = views.map(v => `
      <button class="nav-btn ${this.currentView === v.id ? 'active' : ''}" 
              onclick="app.setView('${v.id}')">
        <span>${v.icon}</span>
        <span>${v.label}</span>
      </button>
    `).join('');
  },
  
  render() {
    const content = document.getElementById('mainContent');
    
    switch(this.currentView) {
      case 'dashboard': content.innerHTML = this.renderDashboard(); break;
      case 'jobs': content.innerHTML = this.renderJobs(); break;
      case 'quotes': content.innerHTML = this.renderQuotes(); break;
      case 'quoteBuilder': 
        content.innerHTML = this.renderQuoteBuilder();
        setTimeout(() => this.updateQuotePreview(), 0);
        break;
      case 'settings': content.innerHTML = this.renderSettings(); break;
    }
  },
  
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
  },
  
  getJobsForMonth() {
    return this.jobs.filter(job => {
      const jobDate = new Date(job.date);
      return jobDate.getMonth() === this.selectedMonth.getMonth() &&
             jobDate.getFullYear() === this.selectedMonth.getFullYear();
    });
  },
  
  calculateStats() {
    const monthJobs = this.getJobsForMonth();
    const totalRevenue = monthJobs.reduce((sum, job) => sum + (job.revenue || 0), 0);
    const totalExpenses = monthJobs.reduce((sum, job) => {
      return sum + (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) + 
                   (job.dumpsterRental || 0) + (job.additionalExpense || 0);
    }, 0);
    const netProfit = totalRevenue - totalExpenses;
    const setAside = netProfit * (this.settings.taxPercentage / 100);
    const goalProgress = this.settings.monthlyGoal > 0 ? Math.min((totalRevenue / this.settings.monthlyGoal) * 100, 100) : 0;
    
    const sources = {};
    monthJobs.forEach(job => {
      if (job.source && job.source.trim()) {
        sources[job.source] = (sources[job.source] || 0) + 1;
      }
    });
    
    let topSource = null;
    let topCount = 0;
    for (const [source, count] of Object.entries(sources)) {
      if (count > topCount) {
        topSource = source;
        topCount = count;
      }
    }
    
    return {
      jobCount: monthJobs.length,
      totalRevenue,
      totalExpenses,
      netProfit,
      setAside,
      goalProgress,
      topSource,
      topSourceCount: topCount,
      topSourcePercent: monthJobs.length > 0 ? ((topCount / monthJobs.length) * 100).toFixed(0) : 0,
      sources
    };
  },
  
  renderDashboard() {
    const stats = this.calculateStats();
    const monthName = this.selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthValue = `${this.selectedMonth.getFullYear()}-${String(this.selectedMonth.getMonth() + 1).padStart(2, '0')}`;
    
    return `
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <button class="btn-primary" onclick="app.startAddJob()">
          ➕ Add Jobs
        </button>
      </div>
      
      <div class="month-picker">
        <button onclick="app.navigateMonth(-1)">◀ Previous</button>
        <input type="month" value="${monthValue}" 
               onchange="app.changeMonth(this.value)">
        <button onclick="app.navigateMonth(1)">Next ▶</button>
        <button onclick="app.goToToday()">Today</button>
      </div>
      
      ${this.settings.monthlyGoal > 0 ? `
        <div class="card" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h3 style="color: #1e40af; margin-bottom: 4px;">🎯 Monthly Revenue Goal</h3>
              <p style="font-size: 14px; color: #1e40af;">
                ${this.formatCurrency(stats.totalRevenue)} of ${this.formatCurrency(this.settings.monthlyGoal)}
              </p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 32px; font-weight: 700; color: #1e40af;">
                ${Math.round(stats.goalProgress)}%
              </div>
            </div>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${stats.goalProgress}%"></div>
          </div>
          <p style="font-size: 13px; color: #1e40af; margin-top: 8px;">
            ${stats.goalProgress >= 100 ? '🎉 Goal achieved!' : `${this.formatCurrency(this.settings.monthlyGoal - stats.totalRevenue)} to go!`}
          </p>
        </div>
      ` : ''}
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background: #dbeafe;">📊</div>
          <div class="stat-label">Jobs This Month</div>
          <div class="stat-value">${stats.jobCount}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #d1fae5;">💵</div>
          <div class="stat-label">Total Revenue</div>
          <div class="stat-value">${this.formatCurrency(stats.totalRevenue)}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #fed7aa;">⚠️</div>
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value">${this.formatCurrency(stats.totalExpenses)}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #e9d5ff;">📈</div>
          <div class="stat-label">Net Profit</div>
          <div class="stat-value">${this.formatCurrency(stats.netProfit)}</div>
        </div>
        
        <div class="stat-card" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);">
          <div class="stat-icon" style="background: white;">🐷</div>
          <div class="stat-label" style="color: #92400e;">Set Aside (${this.settings.taxPercentage}%)</div>
          <div class="stat-value" style="color: #92400e;">${this.formatCurrency(stats.setAside)}</div>
          <p style="font-size: 13px; color: #92400e; margin-top: 8px;">
            💡 For taxes & savings
          </p>
        </div>
        
        ${stats.topSource ? `
          <div class="stat-card" style="background: linear-gradient(135deg, #fae8ff 0%, #e9d5ff 100%);">
            <div class="stat-icon" style="background: white;">📣</div>
            <div class="stat-label" style="color: #6b21a8;">Top Marketing Source</div>
            <div class="stat-value" style="color: #6b21a8; font-size: 20px;">${stats.topSource}</div>
            <p style="font-size: 13px; color: #6b21a8; margin-top: 8px;">
              ${stats.topSourceCount} jobs (${stats.topSourcePercent}%)
            </p>
          </div>
        ` : stats.jobCount > 0 ? `
          <div class="stat-card" style="opacity: 0.7;">
            <div class="stat-icon" style="background: #f3f4f6;">📣</div>
            <div class="stat-label">Top Marketing Source</div>
            <div class="stat-value" style="font-size: 18px; color: #6b7280;">No data yet</div>
            <p style="font-size: 13px; color: #6b7280; margin-top: 8px;">
              Add marketing sources to jobs
            </p>
          </div>
        ` : ''}
      </div>
    `;
  },
  
  navigateMonth(dir) {
    const newDate = new Date(this.selectedMonth);
    newDate.setMonth(newDate.getMonth() + dir);
    this.selectedMonth = newDate;
    this.render();
  },
  
  changeMonth(value) {
    const [year, month] = value.split('-');
    this.selectedMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    this.render();
  },
  
  goToToday() {
    this.selectedMonth = new Date();
    this.render();
  },renderJobs() {
    const monthJobs = this.getJobsForMonth();
    const monthName = this.selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    if (this.editingJob !== null) {
      return this.renderJobForm();
    }
    
    const sortedJobs = monthJobs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Jobs</h1>
          <p style="color: #6b7280; margin-top: 8px;">
            ${monthJobs.length} job${monthJobs.length !== 1 ? 's' : ''} in ${monthName}
          </p>
        </div>
        <button class="btn-primary" onclick="app.startAddJob()">
          ➕ Add Jobs
        </button>
      </div>
      
      <div class="month-picker">
        <button onclick="app.navigateMonth(-1)">◀ Previous</button>
        <input type="month" value="${this.selectedMonth.getFullYear()}-${String(this.selectedMonth.getMonth() + 1).padStart(2, '0')}" 
               onchange="app.changeMonth(this.value)">
        <button onclick="app.navigateMonth(1)">Next ▶</button>
        <button onclick="app.goToToday()">Today</button>
      </div>
      
      <div class="card">
        ${sortedJobs.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">💼</div>
            <p style="font-size: 20px; color: #6b7280; margin-bottom: 24px;">No jobs yet</p>
            <button class="btn-primary" onclick="app.startAddJob()">
              ➕ Add Your First Job
            </button>
          </div>
        ` : `
          <div style="overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Revenue</th>
                  <th>Expenses</th>
                  <th>Profit</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${sortedJobs.map(job => {
                  const totalExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) + 
                                      (job.dumpsterRental || 0) + (job.additionalExpense || 0);
                  const profit = (job.revenue || 0) - totalExpenses;
                  
                  return `
                    <tr>
                      <td>${job.date}</td>
                      <td>
                        <strong>${job.customerName}</strong>
                        ${job.source ? `<br><small style="color: #6b7280;">${job.source}</small>` : ''}
                      </td>
                      <td><strong>${this.formatCurrency(job.revenue || 0)}</strong></td>
                      <td>${this.formatCurrency(totalExpenses)}</td>
                      <td><strong style="color: #22c55e;">${this.formatCurrency(profit)}</strong></td>
                      <td style="text-align: right;">
                        <button class="btn-edit" onclick="app.startEditJob('${job.id}')">✏️</button>
                        <button class="btn-danger" onclick="app.deleteJob('${job.id}')">🗑️</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  },
  
  captureFormData() {
    const dateInput = document.getElementById('jobDate');
    if (dateInput) {
      this.tempDate = dateInput.value;
    }
    
    document.querySelectorAll('.customer-name').forEach((input, index) => {
      if (this.tempCustomers[index]) {
        this.tempCustomers[index].name = input.value;
        const revenueInput = document.querySelectorAll('.customer-revenue')[index];
        const sourceInput = document.querySelectorAll('.customer-source')[index];
        if (revenueInput) this.tempCustomers[index].revenue = parseFloat(revenueInput.value) || 0;
        if (sourceInput) this.tempCustomers[index].source = sourceInput.value;
      }
    });
    
    const laborInput = document.getElementById('expenseLabor');
    const gasInput = document.getElementById('expenseGas');
    const dumpFeeInput = document.getElementById('expenseDumpFee');
    const dumpsterInput = document.getElementById('expenseDumpsterRental');
    const additionalInput = document.getElementById('expenseAdditional');
    
    if (laborInput) this.tempExpenses.labor = parseFloat(laborInput.value) || 0;
    if (gasInput) this.tempExpenses.gas = parseFloat(gasInput.value) || 0;
    if (dumpFeeInput) this.tempExpenses.dumpFee = parseFloat(dumpFeeInput.value) || 0;
    if (dumpsterInput) this.tempExpenses.dumpsterRental = parseFloat(dumpsterInput.value) || 0;
    if (additionalInput) this.tempExpenses.additional = parseFloat(additionalInput.value) || 0;
  },
  
  renderJobForm() {
    const isEditing = this.editingJob && this.editingJob !== 'new';
    
    if (!this.tempCustomers) {
      if (isEditing) {
        this.tempCustomers = [{
          id: this.editingJob.id,
          name: this.editingJob.customerName,
          source: this.editingJob.source || '',
          revenue: this.editingJob.revenue || 0
        }];
        this.tempExpenses = {
          labor: this.editingJob.labor || 0,
          gas: this.editingJob.gas || 0,
          dumpFee: this.editingJob.dumpFee || 0,
          dumpsterRental: this.editingJob.dumpsterRental || 0,
          additional: this.editingJob.additionalExpense || 0
        };
        this.tempDate = this.editingJob.date;
      } else {
        this.tempCustomers = [{ id: Date.now(), name: '', source: '', revenue: 0 }];
        this.tempExpenses = { labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 };
        this.tempDate = new Date().toISOString().split('T')[0];
      }
    }
    
    const totalExpenses = Object.values(this.tempExpenses).reduce((sum, e) => sum + (parseFloat(e) || 0), 0);
    const expensePerCustomer = this.tempCustomers.length > 0 ? totalExpenses / this.tempCustomers.length : 0;
    
    return `
      <div class="page-header">
        <h1 class="page-title">${isEditing ? 'Edit' : 'Add'} Jobs</h1>
        <button class="btn-secondary" onclick="app.cancelJobForm()">← Back</button>
      </div>
      
      <div class="card">
        <h3 style="margin-bottom: 16px;">📅 Job Date</h3>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" id="jobDate" class="form-input" value="${this.tempDate}" onchange="app.captureFormData()">
        </div>
      </div>
      
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3>👥 Customers (${this.tempCustomers.length})</h3>
          ${!isEditing ? `
            <button class="btn-primary" type="button" onclick="app.addCustomerRow()">➕ Add Customer</button>
          ` : ''}
        </div>
        
        <div id="customersContainer">
          ${this.tempCustomers.map((customer, index) => `
            <div class="customer-row">
              ${!isEditing && this.tempCustomers.length > 1 ? `
                <button type="button" class="remove-btn" onclick="app.removeCustomerRow(${index})">✖</button>
              ` : ''}
              <div class="grid-2" style="margin-top: ${!isEditing && this.tempCustomers.length > 1 ? '24px' : '0'};">
                <div class="form-group">
                  <label class="form-label">Customer Name *</label>
                  <input type="text" class="form-input customer-name" data-index="${index}" 
                         value="${customer.name || ''}" placeholder="Enter name" required
                         onchange="app.captureFormData()">
                </div>
                <div class="form-group">
                  <label class="form-label">Revenue from this customer *</label>
                  <input type="number" class="form-input customer-revenue" data-index="${index}"
                         value="${customer.revenue || 0}" min="1" step="0.01" placeholder="500" required
                         onchange="app.captureFormData()">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">How did they find you? (Marketing Source)</label>
                <select class="form-input customer-source" data-index="${index}" onchange="app.captureFormData()">
                  <option value="">Select source (optional)</option>
                  ${['Google', 'Facebook', 'Referral', 'Repeat Customer', 'Yelp', 'Craigslist', 'Instagram', 'Other'].map(s =>
                    `<option value="${s}" ${customer.source === s ? 'selected' : ''}>${s}</option>`
                  ).join('')}
                </select>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="card">
        <h3 style="margin-bottom: 16px;">💰 ${isEditing ? 'Expenses' : 'Shared Expenses'}</h3>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Labor</label>
            <input type="number" id="expenseLabor" class="form-input" 
                   value="${this.tempExpenses.labor || 0}" min="0" step="0.01"
                   onchange="app.captureFormData()">
          </div>
          <div class="form-group">
            <label class="form-label">Gas</label>
            <input type="number" id="expenseGas" class="form-input"
                   value="${this.tempExpenses.gas || 0}" min="0" step="0.01"
                   onchange="app.captureFormData()">
          </div>
          <div class="form-group">
            <label class="form-label">Dump Fee</label>
            <input type="number" id="expenseDumpFee" class="form-input"
                   value="${this.tempExpenses.dumpFee || 0}" min="0" step="0.01"
                   onchange="app.captureFormData()">
          </div>
          <div class="form-group">
            <label class="form-label">Dumpster Rental</label>
            <input type="number" id="expenseDumpsterRental" class="form-input"
                   value="${this.tempExpenses.dumpsterRental || 0}" min="0" step="0.01"
                   onchange="app.captureFormData()">
          </div>
          <div class="form-group">
            <label class="form-label">Other Expense</label>
            <input type="number" id="expenseAdditional" class="form-input"
                   value="${this.tempExpenses.additional || 0}" min="0" step="0.01"
                   onchange="app.captureFormData()">
          </div>
        </div>
        
        ${!isEditing ? `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <p style="font-size: 14px; color: #1e40af; line-height: 1.6;">
              💡 Total Expenses: <strong>${this.formatCurrency(totalExpenses)}</strong><br>
              Split among <strong>${this.tempCustomers.length}</strong> customer${this.tempCustomers.length !== 1 ? 's' : ''}<br>
              Each customer: <strong>${this.formatCurrency(expensePerCustomer)}</strong>
            </p>
          </div>
        ` : ''}
      </div>
      
      <div style="text-align: right; margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn-secondary" type="button" onclick="app.cancelJobForm()">Cancel</button>
        <button class="btn-primary" type="button" onclick="app.saveMultipleJobs()">
          💾 Save ${this.tempCustomers.length} Job${this.tempCustomers.length !== 1 ? 's' : ''}
        </button>
      </div>
    `;
  },
  
  startAddJob() {
    this.editingJob = 'new';
    this.tempCustomers = null;
    this.tempExpenses = null;
    this.tempDate = null;
    this.currentView = 'jobs';
    this.renderNav();
    this.render();
  },
  
  startEditJob(id) {
    const job = this.jobs.find(j => j.id === id);
    if (!job) return;
    
    this.editingJob = job;
    this.tempCustomers = null;
    this.tempExpenses = null;
    this.tempDate = null;
    this.currentView = 'jobs';
    this.renderNav();
    this.render();
  },
  
  cancelJobForm() {
    this.editingJob = null;
    this.tempCustomers = null;
    this.tempExpenses = null;
    this.tempDate = null;
    this.render();
  },
  
  addCustomerRow() {
    this.captureFormData();
    this.tempCustomers.push({ id: Date.now(), name: '', source: '', revenue: 0 });
    this.render();
  },
  
  removeCustomerRow(index) {
    if (this.tempCustomers.length > 1) {
      this.captureFormData();
      this.tempCustomers.splice(index, 1);
      this.render();
    }
  },
  
  saveMultipleJobs() {
    this.captureFormData();
    
    if (!this.tempDate) {
      alert('Please select a date');
      return;
    }
    
    const validCustomers = this.tempCustomers.filter(c => 
      (c.name || '').trim() && (c.revenue || 0) > 0
    );
    
    if (validCustomers.length === 0) {
      alert('Please add at least one customer with a name and revenue greater than 0');
      return;
    }
    
    const totalExpenses = 
      (this.tempExpenses.labor || 0) +
      (this.tempExpenses.gas || 0) +
      (this.tempExpenses.dumpFee || 0) +
      (this.tempExpenses.dumpsterRental || 0) +
      (this.tempExpenses.additional || 0);
    
    const isEditing = this.editingJob && this.editingJob !== 'new';
    
    if (isEditing) {
      this.jobs = this.jobs.filter(j => j.id !== this.editingJob.id);
    }
    
    if (isEditing) {
      this.jobs.push({
        id: this.editingJob.id,
        date: this.tempDate,
        customerName: validCustomers[0].name.trim(),
        source: validCustomers[0].source || '',
        revenue: validCustomers[0].revenue || 0,
        labor: this.tempExpenses.labor || 0,
        gas: this.tempExpenses.gas || 0,
        dumpFee: this.tempExpenses.dumpFee || 0,
        dumpsterRental: this.tempExpenses.dumpsterRental || 0,
        additionalExpense: this.tempExpenses.additional || 0
      });
    } else {
      validCustomers.forEach(customer => {
        this.jobs.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 10),
          date: this.tempDate,
          customerName: customer.name.trim(),
          source: customer.source || '',
          revenue: customer.revenue || 0,
          labor: (this.tempExpenses.labor || 0) / validCustomers.length,
          gas: (this.tempExpenses.gas || 0) / validCustomers.length,
          dumpFee: (this.tempExpenses.dumpFee || 0) / validCustomers.length,
          dumpsterRental: (this.tempExpenses.dumpsterRental || 0) / validCustomers.length,
          additionalExpense: (this.tempExpenses.additional || 0) / validCustomers.length
        });
      });
    }
    
    this.saveData();
    this.cancelJobForm();
    this.showSuccessMessage(`✅ ${validCustomers.length} job${validCustomers.length === 1 ? '' : 's'} saved!`);
  },
  
  deleteJob(id) {
    if (confirm('Delete this job?')) {
      this.jobs = this.jobs.filter(j => j.id !== id);
      this.saveData();
      this.render();
    }
  },
  
  renderQuotes() {
    const recentQuotes = this.quotes;
    
    return `
      <div class="page-header">
        <h1 class="page-title">Quotes (${this.quotes.length})</h1>
        <button class="btn-primary" onclick="app.setView('quoteBuilder')">
          ✏️ Create Quote
        </button>
      </div>
      
      <div class="card">
        ${recentQuotes.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p style="color: #6b7280; margin-bottom: 24px;">No quotes yet</p>
            <button class="btn-primary" onclick="app.setView('quoteBuilder')">
              ✏️ Create Your First Quote
            </button>
          </div>
        ` : `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Estimate</th>
                <th>Photos</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${recentQuotes.map(q => `
                <tr>
                  <td>${new Date(q.createdAt).toLocaleDateString()}</td>
                  <td>${q.customer.name}</td>
                  <td><strong>${this.formatCurrency(q.estimateRange.low)} - ${this.formatCurrency(q.estimateRange.high)}</strong></td>
                  <td>${(q.photos && q.photos.length) || 0} photo${(q.photos && q.photos.length) !== 1 ? 's' : ''}</td>
                  <td>
                    <button class="btn-edit" onclick="app.downloadQuotePDF('${q.id}')">📄 PDF</button>
                    <button class="btn-danger" onclick="app.deleteQuote('${q.id}')">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },
  
  deleteQuote(id) {
    if (confirm('Delete this quote?')) {
      this.quotes = this.quotes.filter(q => q.id !== id);
      this.saveData();
      this.render();
    }
  },renderQuoteBuilder() {
    return `
      <div class="page-header">
        <h1 class="page-title">Quote Builder</h1>
        <button class="btn-secondary" onclick="app.setView('quotes')">← Back to Quotes</button>
      </div>
      
      <form id="quoteForm" onsubmit="app.saveQuote(event)">
        <div class="card">
          <h3 style="margin-bottom: 16px;">👤 Customer Information</h3>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Customer Name *</label>
              <input type="text" class="form-input" name="customerName" required>
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="tel" class="form-input" name="customerPhone">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" name="customerEmail">
            </div>
            <div class="form-group">
              <label class="form-label">Address</label>
              <input type="text" class="form-input" name="customerAddress">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Job Description</label>
            <textarea class="form-input" name="jobDescription" rows="3"></textarea>
          </div>
        </div>
        
        <div class="card">
          <h3 style="margin-bottom: 16px;">📦 Volume-Based Pricing</h3>
          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Minimum Fee</label>
              <input type="number" class="form-input" name="minimumFee" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">1/4 Trailer Load</label>
              <input type="number" class="form-input" name="quarterLoad" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">1/2 Trailer Load</label>
              <input type="number" class="form-input" name="halfLoad" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">3/4 Trailer Load</label>
              <input type="number" class="form-input" name="threeQuarterLoad" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Single Full Load</label>
              <input type="number" class="form-input" name="fullLoad" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <h4 style="color: #92400e; margin-bottom: 12px;">🚛 Multiple Full Loads</h4>
            <div class="grid-2">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="color: #92400e;">Number of Loads</label>
                <input type="number" class="form-input" id="numLoads" min="0" step="1" value="0" 
                       oninput="app.calculateMultipleLoads(); app.updateQuotePreview()" placeholder="e.g., 3">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="color: #92400e;">Price Per Load</label>
                <input type="number" class="form-input" id="pricePerLoad" min="0" step="0.01" value="0"
                       oninput="app.calculateMultipleLoads(); app.updateQuotePreview()" placeholder="e.g., 500">
              </div>
            </div>
            <p style="color: #92400e; margin-top: 12px; font-size: 14px;">
              <strong>Total for Multiple Loads: <span id="multipleLoadsTotal">$0</span></strong>
            </p>
          </div>
        </div>
        
        <div class="card">
          <h3 style="margin-bottom: 16px;">🔧 Specialty Jobs</h3>
          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Trampoline Removal</label>
              <input type="number" class="form-input" name="trampoline" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Shed Demo/Removal</label>
              <input type="number" class="form-input" name="shed" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Fridge Removal</label>
              <input type="number" class="form-input" name="fridge" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Furniture Removal</label>
              <input type="number" class="form-input" name="furniture" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Hot Tub Removal</label>
              <input type="number" class="form-input" name="hotTub" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Custom Demo</label>
              <input type="number" class="form-input" name="customDemo" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
          </div>
        </div>
        
        <div class="card">
          <h3 style="margin-bottom: 16px;">💰 Additional Fees</h3>
          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Labor Fee</label>
              <input type="number" class="form-input" name="laborFee" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Heavy Item Fee</label>
              <input type="number" class="form-input" name="heavyItemFee" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Distance Fee</label>
              <input type="number" class="form-input" name="distanceFee" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Additional Time Fee</label>
              <input type="number" class="form-input" name="timeFee" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Hazard Fee</label>
              <input type="number" class="form-input" name="hazardFee" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Custom Fee</label>
              <input type="number" class="form-input" name="customFee" min="0" step="0.01" placeholder="0" oninput="app.updateQuotePreview()">
            </div>
          </div>
        </div>
        
        <div class="card" style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 2px solid #10b981;">
          <div id="quotePreview">
            <div style="text-align: center;">
              <div style="font-size: 14px; color: #10b981; font-weight: 600; margin-bottom: 8px;">
                LIVE ESTIMATE PREVIEW
              </div>
              <div style="font-size: 28px; font-weight: 700; color: #059669; margin-bottom: 8px;">
                $0 - $0
              </div>
              <div style="font-size: 14px; color: #6b7280;">
                Base Total: <strong>$0</strong>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h3 style="margin-bottom: 8px;">📸 Job Photos (Optional)</h3>
          <p style="color: #6b7280; margin-bottom: 16px; font-size: 14px;">
            Upload up to 5 photos. <strong>⚠️ Large photos may cause save errors.</strong> Use compressed/resized images if possible.
          </p>
          <div class="image-upload-container">
            ${[0,1,2,3,4].map(i => `
              <div class="image-upload-box" id="photoBox${i}">
                <input type="file" accept="image/*" onchange="app.handleImageUpload(event, ${i})" id="photoInput${i}">
                <div class="placeholder" id="placeholder${i}">
                  <div style="font-size: 32px;">📷</div>
                  <div style="font-size: 12px;">Add Photo</div>
                </div>
                <img id="photo${i}" class="image-preview hidden" src="">
                <button type="button" class="image-remove-btn hidden" id="removePhoto${i}" onclick="app.removeImage(${i})">✖</button>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="text-align: right; margin-top: 24px;">
          <button type="button" class="btn-secondary" onclick="app.setView('quotes')" style="margin-right: 12px;">Cancel</button>
          <button type="submit" class="btn-primary" id="saveQuoteBtn">💾 Generate Quote</button>
        </div>
      </form>
    `;
  },
  
  calculateMultipleLoads() {
    const numLoads = parseInt(document.getElementById('numLoads').value) || 0;
    const pricePerLoad = parseFloat(document.getElementById('pricePerLoad').value) || 0;
    const total = numLoads * pricePerLoad;
    
    document.getElementById('multipleLoadsTotal').textContent = this.formatCurrency(total);
  },
  
  updateQuotePreview() {
    const form = document.getElementById('quoteForm');
    if (!form) return;
    
    const numLoads = parseInt(document.getElementById('numLoads')?.value) || 0;
    const pricePerLoad = parseFloat(document.getElementById('pricePerLoad')?.value) || 0;
    const multipleLoadsTotal = numLoads * pricePerLoad;
    
    const prices = [
      'minimumFee', 'quarterLoad', 'halfLoad', 'threeQuarterLoad', 'fullLoad',
      'trampoline', 'shed', 'fridge', 'furniture', 'hotTub', 'customDemo',
      'laborFee', 'heavyItemFee', 'distanceFee', 'timeFee', 'hazardFee', 'customFee'
    ];
    
    let total = multipleLoadsTotal;
    prices.forEach(p => {
      const input = form.elements[p];
      if (input) {
        total += parseFloat(input.value) || 0;
      }
    });
    
    const rangeLow = Math.floor(total * 0.9);
    const rangeHigh = Math.ceil(total * 1.1);
    
    const previewEl = document.getElementById('quotePreview');
    if (previewEl) {
      previewEl.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 14px; color: #10b981; font-weight: 600; margin-bottom: 8px;">
            LIVE ESTIMATE PREVIEW
          </div>
          <div style="font-size: 28px; font-weight: 700; color: #059669; margin-bottom: 8px;">
            ${this.formatCurrency(rangeLow)} - ${this.formatCurrency(rangeHigh)}
          </div>
          <div style="font-size: 14px; color: #6b7280;">
            Base Total: <strong>${this.formatCurrency(total)}</strong>
          </div>
        </div>
      `;
    }
  },
  
  handleImageUpload(event, index) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert(`Warning: Image "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB. Large images may cause save errors. Consider using a compressed image.`);
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.tempPhotos[index] = e.target.result;
        const imgEl = document.getElementById('photo' + index);
        const placeholderEl = document.getElementById('placeholder' + index);
        const removeBtn = document.getElementById('removePhoto' + index);
        
        if (imgEl && placeholderEl && removeBtn) {
          imgEl.src = e.target.result;
          imgEl.classList.remove('hidden');
          placeholderEl.classList.add('hidden');
          removeBtn.classList.remove('hidden');
        }
      };
      reader.readAsDataURL(file);
    }
  },
  
  removeImage(index) {
    this.tempPhotos[index] = null;
    const imgEl = document.getElementById('photo' + index);
    const placeholderEl = document.getElementById('placeholder' + index);
    const removeBtn = document.getElementById('removePhoto' + index);
    const inputEl = document.getElementById('photoInput' + index);
    
    if (imgEl) imgEl.classList.add('hidden');
    if (placeholderEl) placeholderEl.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');
    if (inputEl) inputEl.value = '';
  },
  
  saveQuote(e) {
    e.preventDefault();
    
    const btn = document.getElementById('saveQuoteBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Saving...';
    
    const formData = new FormData(e.target);
    
    const numLoads = parseInt(document.getElementById('numLoads').value) || 0;
    const pricePerLoad = parseFloat(document.getElementById('pricePerLoad').value) || 0;
    const multipleLoadsTotal = numLoads * pricePerLoad;
    
    const prices = [
      'minimumFee', 'quarterLoad', 'halfLoad', 'threeQuarterLoad', 'fullLoad',
      'trampoline', 'shed', 'fridge', 'furniture', 'hotTub', 'customDemo',
      'laborFee', 'heavyItemFee', 'distanceFee', 'timeFee', 'hazardFee', 'customFee'
    ];
    
    let total = multipleLoadsTotal;
    prices.forEach(p => {
      total += parseFloat(formData.get(p)) || 0;
    });
    
    const rangeLow = Math.floor(total * 0.9);
    const rangeHigh = Math.ceil(total * 1.1);
    
    const quote = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      customer: {
        name: formData.get('customerName'),
        phone: formData.get('customerPhone'),
        email: formData.get('customerEmail'),
        address: formData.get('customerAddress'),
        jobDescription: formData.get('jobDescription')
      },
      pricing: {
        ...Object.fromEntries(prices.map(p => [p, parseFloat(formData.get(p)) || 0])),
        multipleLoads: {
          numLoads: numLoads,
          pricePerLoad: pricePerLoad,
          total: multipleLoadsTotal
        }
      },
      photos: this.tempPhotos.filter(p => p),
      estimateRange: { low: rangeLow, high: rangeHigh },
      total: total
    };
    
    this.quotes.push(quote);
    
    try {
      this.saveData();
      this.tempPhotos = [];
      this.showSuccessMessage('✅ Quote saved successfully!');
      setTimeout(() => {
        this.setView('quotes');
      }, 500);
    } catch (error) {
      btn.disabled = false;
      btn.innerHTML = '💾 Generate Quote';
      
      if (confirm('Save failed (likely due to large photos). Save quote WITHOUT photos?')) {
        this.quotes.pop();
        quote.photos = [];
        this.quotes.push(quote);
        this.saveData();
        this.tempPhotos = [];
        this.showSuccessMessage('✅ Quote saved (without photos)!');
        setTimeout(() => {
          this.setView('quotes');
        }, 500);
      }
    }
  },
  
  showSuccessMessage(message) {
    const existingMsg = document.querySelector('.success-message');
    if (existingMsg) existingMsg.remove();
    
    const msg = document.createElement('div');
    msg.className = 'success-message';
    msg.textContent = message;
    document.body.appendChild(msg);
    
    setTimeout(() => {
      msg.remove();
    }, 3000);
  },
  
  downloadQuotePDF(quoteId) {
    const quote = this.quotes.find(q => q.id === quoteId);
    if (!quote) {
      alert('Quote not found!');
      return;
    }
    
    try {
      if (typeof window.jspdf === 'undefined') {
        alert('PDF library not loaded. Please refresh the page and try again.');
        return;
      }
      
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 20;
      
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTIMATE', 105, y, { align: 'center' });
      y += 15;
      
      const businessInfo = this.settings.businessInfo;
      
      if (businessInfo && businessInfo.logo) {
        try {
          doc.addImage(businessInfo.logo, 'PNG', 80, y, 50, 50);
          y += 55;
        } catch (logoError) {
          console.error('Error adding logo to PDF:', logoError);
        }
      }
      
      if (businessInfo && businessInfo.name && businessInfo.name.trim()) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(businessInfo.name, 105, y, { align: 'center' });
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        if (businessInfo.phone && businessInfo.phone.trim()) {
          doc.text(businessInfo.phone, 105, y, { align: 'center' });
          y += 6;
        }
        if (businessInfo.email && businessInfo.email.trim()) {
          doc.text(businessInfo.email, 105, y, { align: 'center' });
          y += 6;
        }
        y += 5;
      }
      y += 10;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PREPARED FOR:', 20, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.text(quote.customer.name, 20, y);
      y += 6;
      
      if (quote.customer.phone) {
        doc.text(quote.customer.phone, 20, y);
        y += 6;
      }
      
      if (quote.customer.address) {
        doc.text(quote.customer.address, 20, y);
        y += 6;
      }
      
      y += 10;
      
      doc.setFillColor(59, 130, 246);
      doc.rect(20, y, 170, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTIMATED COST', 105, y + 12, { align: 'center' });
      doc.setFontSize(22);
      doc.text(
        `${this.formatCurrency(quote.estimateRange.low)} - ${this.formatCurrency(quote.estimateRange.high)}`,
        105, y + 24, { align: 'center' }
      );
      doc.setTextColor(0, 0, 0);
      y += 40;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Labor and disposal fees are all included', 105, y, { align: 'center' });
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`, 20, y);
      y += 10;
      
      if (quote.customer.jobDescription) {
        doc.setFont('helvetica', 'bold');
        
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        doc.text('Job Description:', 20, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        const splitDesc = doc.splitTextToSize(quote.customer.jobDescription, 170);
        
        for (let i = 0; i < splitDesc.length; i++) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(splitDesc[i], 20, y);
          y += 5;
        }
      }
      
      if (quote.photos && quote.photos.length > 0) {
        y += 5;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.text(`${quote.photos.length} photo${quote.photos.length !== 1 ? 's' : ''} attached to this quote`, 20, y);
      }
      
      doc.save(`quote-${quote.customer.name.replace(/\s/g, '-')}-${Date.now()}.pdf`);
      this.showSuccessMessage('📄 PDF downloaded!');
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF: ' + error.message);
    }
  },
  
  renderSettings() {
    return `
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
      </div>
      
      <div class="card">
        <h3 style="margin-bottom: 16px;">🏢 Business Information</h3>
        <div class="form-group">
          <label class="form-label">Business Name</label>
          <input type="text" id="businessName" class="form-input" 
                 value="${this.settings.businessInfo.name || ''}" placeholder="Your Junk Removal Co.">
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="tel" id="businessPhone" class="form-input" 
                   value="${this.settings.businessInfo.phone || ''}" placeholder="(555) 123-4567">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="businessEmail" class="form-input" 
                   value="${this.settings.businessInfo.email || ''}" placeholder="info@company.com">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <input type="text" id="businessAddress" class="form-input" 
                 value="${this.settings.businessInfo.address || ''}" placeholder="123 Main St, City, State">
        </div>
        <div class="form-group">
          <label class="form-label">Logo (for quotes)</label>
          <input type="file" accept="image/*" onchange="app.uploadLogo(event)" class="form-input">
          ${this.settings.businessInfo.logo ? `
            <div style="margin-top: 12px;">
              <img src="${this.settings.businessInfo.logo}" style="max-width: 200px; border-radius: 8px; display: block;">
              <button type="button" class="btn-danger" onclick="app.removeLogo()" style="margin-top: 8px;">
                🗑️ Remove Logo
              </button>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="card">
        <h3 style="margin-bottom: 16px;">🐷 Tax & Savings</h3>
        <div style="text-align: center; margin-bottom: 16px;">
          <span id="taxDisplay" style="font-size: 36px; font-weight: 700; color: #3b82f6;">
            ${this.settings.taxPercentage}%
          </span>
        </div>
        <input type="range" id="taxPercentage" class="slider" 
               value="${this.settings.taxPercentage}" 
               min="0" max="100" step="1"
               oninput="document.getElementById('taxDisplay').textContent = this.value + '%'">
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; margin-top: 8px;">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>
      
      <div class="card">
        <h3 style="margin-bottom: 16px;">📈 Monthly Revenue Goal</h3>
        <div class="form-group">
          <label class="form-label">Target Revenue</label>
          <input type="number" id="monthlyGoal" class="form-input" 
                 value="${this.settings.monthlyGoal || ''}" min="0" step="100" placeholder="5000">
        </div>
        <p style="font-size: 13px; color: #6b7280;">
          💡 Set a goal to see progress on your dashboard
        </p>
      </div>
      
      <div style="text-align: right;">
        <button class="btn-primary" onclick="app.saveSettings()">
          💾 Save Settings
        </button>
      </div>
    `;
  },
  
  uploadLogo(event) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        alert('Logo file is too large. Please use an image under 1MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.settings.businessInfo.logo = e.target.result;
        this.saveData();
        this.showSuccessMessage('✅ Logo uploaded!');
        this.render();
      };
      reader.readAsDataURL(file);
    }
  },
  
  removeLogo() {
    if (confirm('Remove the uploaded logo?')) {
      this.settings.businessInfo.logo = null;
      this.saveData();
      this.showSuccessMessage('🗑️ Logo removed!');
      this.render();
    }
  },
  
  saveSettings() {
    try {
      const name = document.getElementById('businessName').value.trim();
      const phone = document.getElementById('businessPhone').value.trim();
      const email = document.getElementById('businessEmail').value.trim();
      const address = document.getElementById('businessAddress').value.trim();
      const taxPercentage = parseInt(document.getElementById('taxPercentage').value) || 30;
      const monthlyGoal = parseFloat(document.getElementById('monthlyGoal').value) || 0;
      
      this.settings.businessInfo.name = name;
      this.settings.businessInfo.phone = phone;
      this.settings.businessInfo.email = email;
      this.settings.businessInfo.address = address;
      this.settings.taxPercentage = taxPercentage;
      this.settings.monthlyGoal = monthlyGoal;
      
      this.saveData();
      this.showSuccessMessage('✅ Settings saved!');
      
      setTimeout(() => {
        this.loadData();
      }, 100);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings: ' + error.message);
    }
  }
};

// Initialize the app
app.init();
