let inventory = [];

// 从本地存储加载数据
function loadInventory() {
    const savedInventory = localStorage.getItem('inventory');
    if (savedInventory) {
        inventory = JSON.parse(savedInventory);
        renderInventory();
    }
}

// 保存数据到本地存储
function saveInventory() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
}

// 渲染库存列表
function renderInventory() {
    const inventoryList = document.getElementById('inventoryList');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedMonth = document.getElementById('monthFilter').value;
    
    inventoryList.innerHTML = '';
    
    let totalProfit = 0;
    let totalPending = 0;
    let totalInvestment = 0;
    let monthlyStats = new Map(); // 用于存储每月统计数据

    // 创建一个Map来存储合并后的商品
    const mergedInventory = new Map();

    // 合并相同价格的商品，并考虑月份筛选
    inventory.forEach((item) => {
        if (selectedMonth && item.monthYear !== selectedMonth) {
            return;
        }

        if (item.productName.toLowerCase().includes(searchTerm)) {
            // 只使用价格和状态作为key
            const key = `${item.costPrice}-${item.price}-${item.status}`;
            if (mergedInventory.has(key)) {
                const existing = mergedInventory.get(key);
                existing.quantity += item.quantity;
                existing.productNames.push(item.productName);
                // 保存所有相关月份
                if (!existing.monthYears.includes(item.monthYear)) {
                    existing.monthYears.push(item.monthYear);
                }
            } else {
                mergedInventory.set(key, {
                    productNames: [item.productName],
                    quantity: item.quantity,
                    costPrice: item.costPrice,
                    price: item.price,
                    status: item.status,
                    monthYears: [item.monthYear]
                });
            }

            // 更新月度统计
            if (!monthlyStats.has(item.monthYear)) {
                monthlyStats.set(item.monthYear, {
                    profit: 0,
                    investment: 0
                });
            }
            const stats = monthlyStats.get(item.monthYear);
            if (item.status === 'sold') {
                stats.profit += (item.price - item.costPrice) * item.quantity;
            }
            stats.investment += item.costPrice * item.quantity;
        }
    });

    // 渲染合并后的商品列表
    mergedInventory.forEach((item, key) => {
        const row = document.createElement('tr');
        const profit = item.status === 'sold' ? item.price - item.costPrice : 0;
        const profitRate = item.status === 'sold' ? ((profit / item.costPrice) * 100).toFixed(2) : '-';
        const totalItemProfit = (profit * item.quantity).toFixed(2);
        
        if (item.status === 'sold') {
            totalProfit += parseFloat(totalItemProfit);
        } else {
            totalPending += item.quantity * item.costPrice;
        }
        totalInvestment += item.quantity * item.costPrice;

        // 格式化商品名称显示
        const productNamesDisplay = item.productNames.length > 1 
            ? `<div class="product-names">
                <span class="main-name">${item.productNames[0]} 等${item.productNames.length}种商品</span>
                <div class="tooltip">
                    ${item.productNames.join('<br>')}
                </div>
               </div>`
            : item.productNames[0];

        row.innerHTML = `
            <td>
                <input type="checkbox" class="item-checkbox" data-key="${key}" onclick="updateSelectAll()">
            </td>
            <td>${productNamesDisplay}</td>
            <td>${item.quantity}</td>
            <td>￥${item.costPrice}</td>
            <td><span class="status-badge status-${item.status}">${item.status === 'sold' ? '已售' : '未售'}</span></td>
            <td>${item.status === 'sold' ? '￥' + item.price : '<span class="price-pending">待售</span>'}</td>
            <td>${profitRate}${item.status === 'sold' ? '%' : ''}</td>
            <td>${item.status === 'sold' ? '￥' + totalItemProfit : '-'}</td>
            <td>
                <button class="action-btn view-btn" onclick="viewDetails('${key}')">查看详情</button>
            </td>
        `;
        
        inventoryList.appendChild(row);
    });

    updateStats(totalProfit, totalPending, totalInvestment, monthlyStats);
}

// 修改查看详情函数
function viewDetails(key) {
    // 只解析价格和状态
    const [costPrice, price, status] = key.split('-');
    const selectedMonth = document.getElementById('monthFilter').value;
    
    const items = inventory.filter(item => {
        const costPriceMatch = Math.abs(item.costPrice - parseFloat(costPrice)) < 0.01;
        const statusMatch = item.status === status;
        const priceMatch = status === 'sold' ? 
            Math.abs(item.price - parseFloat(price)) < 0.01 : 
            true;
        // 如果选择了月份，则只显示该月份的商品
        const monthMatch = selectedMonth ? item.monthYear === selectedMonth : true;

        return costPriceMatch && statusMatch && priceMatch && monthMatch;
    });

    let detailsHtml = `
        <div class="details-modal">
            <h3>详细商品列表 (${items.length}个商品)</h3>
            <div class="modal-content">
                <div class="batch-actions">
                    <button class="action-btn delete-btn" onclick="deleteSelectedInModal()">批量删除</button>
                </div>
                <div class="table-view">
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    <input type="checkbox" id="selectAllModal" onclick="toggleSelectAllModal()">
                                </th>
                                <th>商品名称</th>
                                <th>数量</th>
                                <th>拿货价</th>
                                ${status === 'sold' ? '<th>销售价</th>' : ''}
                                <th>拿货日期</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length > 0 ? items.map((item) => `
                                <tr>
                                    <td>
                                        <input type="checkbox" class="modal-item-checkbox" data-index="${inventory.indexOf(item)}" onclick="updateSelectAllModal()">
                                    </td>
                                    <td>${item.productName}</td>
                                    <td>${item.quantity}</td>
                                    <td>￥${item.costPrice}</td>
                                    ${status === 'sold' ? `<td>￥${item.price}</td>` : ''}
                                    <td>${item.purchaseDate || '未记录'}</td>
                                    <td>
                                        <button class="action-btn edit-btn" onclick="showEditForm(${inventory.indexOf(item)}, this)">编辑</button>
                                        <button class="action-btn delete-btn" onclick="deleteItemInModal(${inventory.indexOf(item)})">删除</button>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="7" style="text-align: center;">没有找到匹配的商品</td></tr>'}
                        </tbody>
                    </table>
                </div>
                <div class="edit-form" style="display: none;">
                    <!-- 编辑表单将在这里动态插入 -->
                </div>
            </div>
            <button class="close-btn" onclick="closeDetails()">关闭</button>
        </div>
        <div class="modal-overlay" onclick="closeDetails()"></div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container';
    modalContainer.innerHTML = detailsHtml;
    document.body.appendChild(modalContainer);
}

// 添加在模态框中显示编辑表单的函数
function showEditForm(index, button) {
    const item = inventory[index];
    const editForm = document.querySelector('.edit-form');
    const tableView = document.querySelector('.table-view');
    
    editForm.innerHTML = `
        <h3>编辑商品</h3>
        <form onsubmit="updateItemInModal(event, ${index})">
            <div class="form-group">
                <label>商品名称：</label>
                <input type="text" name="productName" value="${item.productName}" required>
            </div>
            <div class="form-group">
                <label>数量：</label>
                <input type="number" name="quantity" value="${item.quantity}" required min="0">
            </div>
            <div class="form-group">
                <label>拿货价格：</label>
                <input type="number" name="costPrice" value="${item.costPrice}" required min="0" step="0.01">
            </div>
            <div class="form-group">
                <label>拿货日期：</label>
                <input type="date" name="purchaseDate" value="${item.purchaseDate || ''}">
                <span class="price-hint">(选填)</span>
            </div>
            <div class="form-group">
                <label>商品状态：</label>
                <select name="status" required>
                    <option value="unsold" ${item.status === 'unsold' ? 'selected' : ''}>未售</option>
                    <option value="sold" ${item.status === 'sold' ? 'selected' : ''}>已售</option>
                </select>
            </div>
            <div class="form-group">
                <label>销售价格：</label>
                <input type="number" name="price" value="${item.price}" min="0" step="0.01">
            </div>
            <div class="form-buttons">
                <button type="submit" class="action-btn edit-btn">保存</button>
                <button type="button" class="action-btn" onclick="hideEditForm()">取消</button>
            </div>
        </form>
    `;
    
    tableView.style.display = 'none';
    editForm.style.display = 'block';

    // 添加价格输入监听
    const form = editForm.querySelector('form');
    const priceInput = form.querySelector('input[name="price"]');
    const statusSelect = form.querySelector('select[name="status"]');

    priceInput.addEventListener('input', function() {
        if (this.value && parseFloat(this.value) > 0) {
            statusSelect.value = 'sold';
        } else {
            statusSelect.value = 'unsold';
        }
    });

    statusSelect.addEventListener('change', function() {
        if (this.value === 'unsold') {
            priceInput.value = '';
        }
    });
}

// 添加隐藏编辑表单的函数
function hideEditForm() {
    const editForm = document.querySelector('.edit-form');
    const tableView = document.querySelector('.table-view');
    
    editForm.style.display = 'none';
    tableView.style.display = 'block';
}

// 添加在模态框中更新商品的函数
function updateItemInModal(e, index) {
    e.preventDefault();
    const form = e.target;
    const status = form.status.value;
    const price = form.price.value ? parseFloat(form.price.value) : 0;

    if (status === 'sold' && !price) {
        alert('已售商品必须填写销售价格！');
        return;
    }

    inventory[index] = {
        productName: form.productName.value,
        quantity: parseInt(form.quantity.value),
        costPrice: parseFloat(form.costPrice.value),
        status: status,
        price: status === 'sold' ? price : 0,
        purchaseDate: form.purchaseDate.value || null,
        monthYear: inventory[index].monthYear // 保持原有的月份年份
    };

    saveInventory();
    renderInventory();
    closeDetails(); // 关闭模态框
}

// 添加在模态框中删除商品的函数
function deleteItemInModal(index) {
    if (confirm('确定要删除这个商品吗？')) {
        inventory.splice(index, 1);
        saveInventory();
        renderInventory();
        closeDetails(); // 关闭模态框
    }
}

// 关闭详情模态框
function closeDetails() {
    const modalContainer = document.querySelector('.modal-container');
    if (modalContainer) {
        modalContainer.remove();
    }
}

// 修改统计信息更新函数
function updateStats(totalProfit, totalPending, totalInvestment, monthlyStats) {
    const selectedMonth = document.getElementById('monthFilter').value;
    let displayProfit = totalProfit;
    let displayInvestment = totalInvestment;

    // 如果选择了特定月份，显示该月份的统计数据
    if (selectedMonth && monthlyStats.has(selectedMonth)) {
        const monthData = monthlyStats.get(selectedMonth);
        displayProfit = monthData.profit;
        displayInvestment = monthData.investment;
    }

    const statsHtml = `
        <div class="stats-container">
            <div class="stat-item">
                <div class="stat-label">${selectedMonth ? '当月投资' : '总投资'}</div>
                <div class="stat-value">￥${displayInvestment.toFixed(2)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">${selectedMonth ? '当月利润' : '总利润'}</div>
                <div class="stat-value profit">￥${displayProfit.toFixed(2)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">投资回报率</div>
                <div class="stat-value">${((displayProfit / displayInvestment) * 100).toFixed(2)}%</div>
            </div>
        </div>
    `;
    
    const existingStats = document.querySelector('.stats-container');
    if (existingStats) {
        existingStats.remove();
    }
    
    document.querySelector('.table-container').insertAdjacentHTML('beforebegin', statsHtml);
}

// 添加或更新商品
function handleSubmit(e) {
    e.preventDefault();
    
    const productName = document.getElementById('productName').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const costPrice = parseFloat(document.getElementById('costPrice').value);
    const status = document.getElementById('status').value;
    const price = document.getElementById('price').value ? parseFloat(document.getElementById('price').value) : 0;
    const purchaseDate = document.getElementById('purchaseDate').value || null;
    const editIndex = parseInt(document.getElementById('editIndex').value);
    
    if (status === 'sold' && !price) {
        alert('已售商品必须填写销售价格！');
        return;
    }
    
    const currentDate = new Date();
    const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const item = {
        productName,
        quantity,
        costPrice,
        status,
        price: status === 'sold' ? price : 0,
        monthYear,
        purchaseDate // 可以为null
    };
    
    if (editIndex === -1) {
        inventory.push(item);
    } else {
        inventory[editIndex] = item;
        document.getElementById('submitBtn').textContent = '添加商品';
        document.getElementById('editIndex').value = -1;
    }
    
    saveInventory();
    renderInventory();
    e.target.reset();
}

// 编辑商品
function editItem(index) {
    const item = inventory[index];
    
    document.getElementById('productName').value = item.productName;
    document.getElementById('quantity').value = item.quantity;
    document.getElementById('costPrice').value = item.costPrice;
    document.getElementById('status').value = item.status;
    document.getElementById('price').value = item.price;
    document.getElementById('purchaseDate').value = item.purchaseDate || ''; // 设置拿货日期
    document.getElementById('editIndex').value = index;
    document.getElementById('submitBtn').textContent = '更新商品';
}

// 删除商品
function deleteItem(index) {
    if (confirm('确定要删除这个商品吗？')) {
        inventory.splice(index, 1);
        saveInventory();
        renderInventory();
    }
}

// 事件监听器
document.getElementById('inventoryForm').addEventListener('submit', handleSubmit);
document.getElementById('searchInput').addEventListener('input', renderInventory);
document.getElementById('monthFilter').addEventListener('change', renderInventory);

// 页面加载时初始化
loadInventory();

// 添加清除筛选器函数
function clearFilter() {
    document.getElementById('monthFilter').value = '';
    renderInventory();
}

// 添加全选/取消全选功能
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.item-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

// 更新全选框状态
function updateSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.item-checkbox');
    const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
    
    selectAllCheckbox.checked = checkboxes.length === checkedBoxes.length;
    selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkboxes.length !== checkedBoxes.length;
}

// 获取选中的商品
function getSelectedItems() {
    const selectedKeys = Array.from(document.querySelectorAll('.item-checkbox:checked'))
        .map(checkbox => checkbox.getAttribute('data-key'));
    
    const selectedItems = [];
    selectedKeys.forEach(key => {
        const [costPrice, price, status] = key.split('-');
        const items = inventory.filter(item => 
            Math.abs(item.costPrice - parseFloat(costPrice)) < 0.01 &&
            ((status === 'sold' && Math.abs(item.price - parseFloat(price)) < 0.01) || status === 'unsold') &&
            item.status === status
        );
        selectedItems.push(...items);
    });
    
    return selectedItems;
}

// 批量删除选中的商品
function deleteSelected() {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
        alert('请先选择要删除的商品');
        return;
    }
    
    if (confirm(`确定要删除选中的 ${selectedItems.length} 个商品吗？`)) {
        selectedItems.forEach(selectedItem => {
            const index = inventory.findIndex(item => 
                item.productName === selectedItem.productName &&
                item.costPrice === selectedItem.costPrice &&
                item.price === selectedItem.price &&
                item.status === selectedItem.status &&
                item.purchaseDate === selectedItem.purchaseDate
            );
            if (index !== -1) {
                inventory.splice(index, 1);
            }
        });
        
        saveInventory();
        renderInventory();
    }
}

// 添加模态框中的全选/取消全选功能
function toggleSelectAllModal() {
    const selectAllCheckbox = document.getElementById('selectAllModal');
    const checkboxes = document.querySelectorAll('.modal-item-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

// 更新模态框中的全选框状态
function updateSelectAllModal() {
    const selectAllCheckbox = document.getElementById('selectAllModal');
    const checkboxes = document.querySelectorAll('.modal-item-checkbox');
    const checkedBoxes = document.querySelectorAll('.modal-item-checkbox:checked');
    
    selectAllCheckbox.checked = checkboxes.length === checkedBoxes.length;
    selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkboxes.length !== checkedBoxes.length;
}

// 在模态框中批量删除选中的商品
function deleteSelectedInModal() {
    const selectedIndexes = Array.from(document.querySelectorAll('.modal-item-checkbox:checked'))
        .map(checkbox => parseInt(checkbox.getAttribute('data-index')))
        .sort((a, b) => b - a); // 从大到小排序，这样删除时不会影响其他索引
    
    if (selectedIndexes.length === 0) {
        alert('请先选择要删除的商品');
        return;
    }
    
    if (confirm(`确定要删除选中的 ${selectedIndexes.length} 个商品吗？`)) {
        selectedIndexes.forEach(index => {
            inventory.splice(index, 1);
        });
        
        saveInventory();
        renderInventory();
        closeDetails(); // 关闭模态框
    }
}

// 在script.js文件开头添加价格输入框的事件监听
document.addEventListener('DOMContentLoaded', function() {
    const priceInput = document.getElementById('price');
    const statusSelect = document.getElementById('status');

    // 监听价格输入
    priceInput.addEventListener('input', function() {
        if (this.value && parseFloat(this.value) > 0) {
            statusSelect.value = 'sold';
        } else {
            statusSelect.value = 'unsold';
        }
    });

    // 监听状态改变
    statusSelect.addEventListener('change', function() {
        if (this.value === 'unsold') {
            priceInput.value = '';
        }
    });
}); 