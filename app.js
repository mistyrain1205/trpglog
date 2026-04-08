// Cocofolia Log Editor - Core Logic (Natural Wood Style)

let logEntries = [];
let selectedEntryIndex = null;
let isNewEntryMode = false;
let characters = []; // Unique character list: [{name, color}, ...]
let undoStack = [];
const MAX_UNDO = 20;

let projectName = "";
let projectMemo = "";

// DOM Elements
const uploadSection = document.getElementById('upload-section');
const editorContainer = document.getElementById('editor-container');
const logPreview = document.getElementById('log-preview');
const fileInput = document.getElementById('file-input');
const dropArea = document.getElementById('drop-area');
const pasteInput = document.getElementById('paste-input');
const parsePasteBtn = document.getElementById('parse-paste-btn');
const addNewBtn = document.getElementById('add-new-btn');

const editorControls = document.getElementById('editor-controls');
const editingIndicator = document.getElementById('editing-indicator');
const msgName = document.getElementById('msg-name');
const characterDatalist = document.getElementById('character-names');
const msgTab = document.getElementById('msg-tab');
const msgColor = document.getElementById('msg-color');
const msgText = document.getElementById('msg-text');
const imageInput = document.getElementById('image-input');
const removeImageBtn = document.getElementById('remove-image-btn');
const saveMsgBtn = document.getElementById('save-msg-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const deleteMsgBtn = document.getElementById('delete-msg-btn');
const duplicateMsgBtn = document.getElementById('duplicate-msg-btn');
const exportHtmlBtn = document.getElementById('export-html-btn');
const saveProjectBtn = document.getElementById('save-project-btn');
const backToTopBtn = document.getElementById('back-to-top-btn');
const undoBtn = document.getElementById('undo-btn');

const projectNameInput = document.getElementById('project-name-input');
const projectMemoInput = document.getElementById('project-memo-input');

const openBtn = document.getElementById('open-btn');

const loadingOverlay = document.getElementById('loading-overlay');

// --- Initialization ---

window.onload = () => {
    const savedData = localStorage.getItem('cocofolia_editor_session');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            if (Array.isArray(data)) {
                logEntries = data;
            } else {
                logEntries = data.entries || [];
                projectName = data.name || "";
                projectMemo = data.memo || "";
                projectNameInput.value = projectName;
                projectMemoInput.value = projectMemo;
            }
            if (logEntries.length > 0) {
                updateCharacterList();
                showEditor();
            }
        } catch(e) { console.error("Failed to load auto-save", e); }
    }
};

function autoSave() {
    const data = {
        entries: logEntries,
        name: projectNameInput.value,
        memo: projectMemoInput.value
    };
    localStorage.setItem('cocofolia_editor_session', JSON.stringify(data));
}

projectNameInput.oninput = autoSave;
projectMemoInput.oninput = autoSave;

// --- Undo System ---

function saveStateForUndo() {
    undoStack.push(JSON.stringify({
        entries: logEntries,
        name: projectNameInput.value,
        memo: projectMemoInput.value
    }));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function undo() {
    if (undoStack.length === 0) return;
    const data = JSON.parse(undoStack.pop());
    logEntries = data.entries;
    projectNameInput.value = data.name;
    projectMemoInput.value = data.memo;
    renderLog();
    if (selectedEntryIndex !== null) {
        if (selectedEntryIndex >= logEntries.length) selectedEntryIndex = null;
        else selectEntry(selectedEntryIndex);
    }
}

undoBtn.onclick = undo;
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
});

// --- Log Parser & Markdown ---

function renderContent(text) {
    let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Dice results
    escaped = escaped
        .replace(/(＞\s*成功)/g, '<span class="dice-success">$1</span>')
        .replace(/(＞\s*失敗)/g, '<span class="dice-failure">$1</span>');
    
    // Markdown
    escaped = escaped
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/__(.*?)__/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/_(.*?)_/g, '<i>$1</i>');
        
    return escaped.replace(/\n/g, '<br>');
}

function parseCocofoliaLog(htmlText) {
    saveStateForUndo();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const entries = [];

    const rows = doc.querySelectorAll('tr');
    if (rows.length > 0) {
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
                entries.push({
                    tab: cells[0].textContent.trim(),
                    name: cells[1].textContent.trim(),
                    text: cells[2].textContent.trim(),
                    color: cells[2].style.color || '#333333',
                    image: null
                });
            }
        });
    } else {
        const paragraphs = doc.querySelectorAll('p');
        paragraphs.forEach(p => {
            const spans = p.querySelectorAll('span');
            if (spans.length >= 3) {
                let name = spans[1].textContent.trim().replace(/ :$/, '');
                const boldName = spans[1].querySelector('b');
                if (boldName) name = boldName.textContent.trim();

                entries.push({
                    tab: spans[0].textContent.trim().replace(/[\[\]]/g, ''),
                    name: name,
                    text: spans[2].textContent.trim(),
                    color: p.style.color || '#333333',
                    image: null
                });
            }
        });
    }
    
    updateCharacterListFromEntries(entries);
    return entries;
}

function updateCharacterListFromEntries(entries) {
    const charMap = new Map();
    characters.forEach(c => charMap.set(c.name, c.color));
    entries.forEach(e => {
        if (e.name && !charMap.has(e.name)) {
            charMap.set(e.name, e.color);
        }
    });
    characters = Array.from(charMap.entries()).map(([name, color]) => ({ name, color }));
    updateCharacterDatalist();
}

function updateCharacterList() {
    updateCharacterListFromEntries(logEntries);
}

function updateCharacterDatalist() {
    characterDatalist.innerHTML = '';
    characters.forEach(char => {
        const option = document.createElement('option');
        option.value = char.name;
        characterDatalist.appendChild(option);
    });
}

msgName.oninput = () => {
    const selectedChar = characters.find(c => c.name === msgName.value);
    if (selectedChar) {
        msgColor.value = rgbToHex(selectedChar.color);
    }
};

// --- UI Rendering ---

function renderLog() {
    logPreview.innerHTML = '';
    logEntries.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'chat-entry';
        div.dataset.index = index;

        const header = document.createElement('div');
        header.className = 'chat-header';
        
        const tab = document.createElement('span');
        tab.className = 'chat-tab';
        tab.textContent = entry.tab;
        
        const name = document.createElement('span');
        name.className = 'chat-name';
        name.style.color = entry.color;
        name.textContent = entry.name;

        header.appendChild(tab);
        header.appendChild(name);

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.onclick = () => selectEntry(index);
        if (selectedEntryIndex === index) bubble.style.borderColor = 'var(--primary-color)';

        const content = document.createElement('div');
        content.className = 'chat-content';
        content.innerHTML = renderContent(entry.text);
        bubble.appendChild(content);

        if (entry.image) {
            const img = document.createElement('img');
            img.src = entry.image;
            img.className = 'chat-image';
            bubble.appendChild(img);
        }

        div.appendChild(header);
        div.appendChild(bubble);
        logPreview.appendChild(div);
    });
    autoSave();
}

// --- Editing Logic ---

function selectEntry(index) {
    selectedEntryIndex = index;
    isNewEntryMode = false;
    const entry = logEntries[index];
    
    msgName.value = entry.name;
    msgTab.value = entry.tab;
    msgColor.value = rgbToHex(entry.color);
    msgText.value = entry.text;
    
    editingIndicator.style.display = 'none';
    editorControls.style.display = 'block';
    deleteMsgBtn.parentElement.style.display = 'block';
    
    renderLog();
}

addNewBtn.onclick = () => {
    selectedEntryIndex = null;
    isNewEntryMode = true;
    
    msgName.value = '';
    msgTab.value = 'メイン';
    msgColor.value = '#333333';
    msgText.value = '';
    
    editingIndicator.style.display = 'none';
    editorControls.style.display = 'block';
    deleteMsgBtn.parentElement.style.display = 'none';
    
    document.querySelectorAll('.chat-bubble').forEach(el => el.style.borderColor = '#ddd');
};

saveMsgBtn.onclick = () => {
    saveStateForUndo();
    const entryData = {
        name: msgName.value,
        tab: msgTab.value,
        color: msgColor.value,
        text: msgText.value,
        image: isNewEntryMode ? null : logEntries[selectedEntryIndex].image
    };

    if (isNewEntryMode) {
        const insertPos = document.querySelector('input[name="insert-pos"]:checked').value;
        const selectedIdx = parseInt(document.querySelector('.chat-entry[style*="var(--primary-color)"]')?.dataset.index);
        
        if (insertPos === 'after' && !isNaN(selectedIdx)) {
            logEntries.splice(selectedIdx + 1, 0, entryData);
            selectedEntryIndex = selectedIdx + 1;
        } else {
            logEntries.push(entryData);
            selectedEntryIndex = logEntries.length - 1;
        }
        isNewEntryMode = false;
    } else {
        logEntries[selectedEntryIndex] = {
            ...logEntries[selectedEntryIndex],
            ...entryData
        };
    }
    
    updateCharacterList();
    renderLog();
    selectEntry(selectedEntryIndex);
};

removeImageBtn.onclick = () => {
    if (selectedEntryIndex !== null && logEntries[selectedEntryIndex].image) {
        saveStateForUndo();
        logEntries[selectedEntryIndex].image = null;
        renderLog();
    }
};

duplicateMsgBtn.onclick = () => {
    if (selectedEntryIndex !== null) {
        saveStateForUndo();
        const clone = { ...logEntries[selectedEntryIndex] };
        logEntries.splice(selectedEntryIndex + 1, 0, clone);
        renderLog();
        selectEntry(selectedEntryIndex + 1);
    }
};

cancelEditBtn.onclick = () => {
    selectedEntryIndex = null;
    isNewEntryMode = false;
    editorControls.style.display = 'none';
    editingIndicator.style.display = 'block';
    renderLog();
};

deleteMsgBtn.onclick = () => {
    if (selectedEntryIndex !== null && confirm('この行を削除しますか？')) {
        saveStateForUndo();
        logEntries.splice(selectedEntryIndex, 1);
        selectedEntryIndex = null;
        editorControls.style.display = 'none';
        editingIndicator.style.display = 'block';
        renderLog();
    }
};

// Helper to convert style color to hex for input[type=color]
function rgbToHex(color) {
    if (!color || color.startsWith('#')) return color || '#333333';
    const rgb = color.match(/\d+/g);
    if (!rgb) return '#333333';
    return "#" + ((1 << 24) + (+rgb[0] << 16) + (+rgb[1] << 8) + +rgb[2]).toString(16).slice(1);
}

// --- Image Optimization ---

imageInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    loadingOverlay.style.display = 'flex';
    try {
        const optimizedDataUrl = await optimizeImage(file);
        if (isNewEntryMode) {
            alert('メッセージを一度保存してから画像を挿入してください。');
        } else {
            saveStateForUndo();
            logEntries[selectedEntryIndex].image = optimizedDataUrl;
            renderLog();
        }
    } catch (err) {
        console.error(err);
        alert('画像の処理に失敗しました。');
    } finally {
        loadingOverlay.style.display = 'none';
        imageInput.value = '';
    }
};

async function optimizeImage(file, maxWidth = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// --- Project Management ---

saveProjectBtn.onclick = () => {
    const data = {
        entries: logEntries,
        name: projectNameInput.value,
        memo: projectMemoInput.value
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (projectNameInput.value || 'trpg_log_project') + '.json';
    a.click();
};

// --- Unified Open Logic ---

openBtn.onclick = () => fileInput.click();

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleGenericFile(file);
    // Reset value so same file can be opened again
    fileInput.value = '';
};

function handleGenericFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (e) => {
        if (extension === 'json') {
            try {
                saveStateForUndo();
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    logEntries = data;
                } else {
                    logEntries = data.entries || [];
                    projectNameInput.value = data.name || "";
                    projectMemoInput.value = data.memo || "";
                }
                updateCharacterList();
                showEditor();
            } catch(err) { alert('プロジェクトファイルの読み込みに失敗しました。'); }
        } else if (extension === 'html') {
            logEntries = parseCocofoliaLog(e.target.result);
            if (logEntries.length === 0) {
                alert('ログの解析に失敗しました。');
                return;
            }
            showEditor();
        } else {
            alert('対応していないファイル形式です (.html または .json を選択してください)');
        }
    };
    reader.readAsText(file);
}

// --- Export Logic ---

exportHtmlBtn.onclick = () => {
    const htmlContent = generateExportHtml();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (projectNameInput.value || 'edited_trpg_log') + '.html';
    a.click();
};

function generateExportHtml() {
    let entriesHtml = logEntries.map(entry => `
        <div class="msg-box">
            <div class="msg-meta"><span class="msg-tab">[${entry.tab}]</span> <span class="msg-name" style="color:${entry.color}">${entry.name}</span></div>
            <div class="msg-bubble">
                <div class="msg-text">${renderContent(entry.text)}</div>
                ${entry.image ? `<img src="${entry.image}" class="msg-img">` : ''}
            </div>
        </div>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectNameInput.value || 'TRPG Replay Log'}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
        
        body { 
            background: #fdf6e3; 
            color: #2c1810; 
            font-family: 'Noto Serif JP', serif; 
            margin: 0;
            padding: 40px 20px;
            background-image: linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px);
            background-size: 100% 2em;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        .msg-box { 
            margin-bottom: 30px; 
            animation: fadeIn 0.5s ease-out;
        }

        .msg-meta { 
            font-size: 0.85em; 
            margin-bottom: 8px; 
            color: #6d4c41; 
            display: flex;
            align-items: center;
        }

        .msg-tab { 
            background: #d4c1b4; 
            padding: 2px 8px; 
            border-radius: 4px; 
            font-weight: normal; 
            margin-right: 10px;
            box-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }

        .msg-name { 
            font-weight: bold; 
            font-size: 1.1em;
            text-shadow: 1px 1px 1px rgba(255,255,255,0.5);
        }

        .msg-bubble { 
            background: #fff; 
            padding: 1.5rem 1.8rem; 
            border-radius: 4px 20px 20px 20px; 
            border: 1px solid #dcd0c0; 
            box-shadow: 4px 4px 10px rgba(0,0,0,0.05); 
            display: inline-block; 
            max-width: 90%;
            line-height: 1.7;
        }

        .msg-text {
            font-size: 1.1rem;
            word-wrap: break-word;
        }

        .msg-img { 
            max-width: 100%; 
            border-radius: 6px; 
            margin-top: 15px; 
            display: block; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        }

        .dice-success { color: #1a73e8 !important; font-weight: bold; }
        .dice-failure { color: #d93025 !important; font-weight: bold; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 600px) {
            body { padding: 20px 10px; }
            .msg-bubble { max-width: 95%; padding: 1.2rem; }
            .msg-text { font-size: 1rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="text-align: center; margin-bottom: 2rem;">${projectNameInput.value || ''}</h1>
        ${entriesHtml}
    </div>
</body>
</html>
    `;
}

// --- File Handling ---

dropArea.onclick = () => fileInput.click();
dropArea.ondragover = (e) => { e.preventDefault(); dropArea.style.borderColor = 'var(--primary-color)'; };
dropArea.ondragleave = () => { dropArea.style.borderColor = 'var(--wood-light)'; };
dropArea.ondrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleGenericFile(file);
};

function showEditor() {
    uploadSection.style.display = 'none';
    editorContainer.classList.add('visible');
    backToTopBtn.style.display = 'block';
    renderLog();
}

function goBackToTop() {
    if (logEntries.length > 0 && !confirm('編集中の内容は自動保存されていますが、トップ画面に戻りますか？')) {
        return;
    }
    uploadSection.style.display = 'block';
    editorContainer.classList.remove('visible');
    backToTopBtn.style.display = 'none';
}

backToTopBtn.onclick = goBackToTop;

// --- Tab Switching ---

function switchUploadTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

parsePasteBtn.onclick = () => {
    const htmlText = pasteInput.value.trim();
    if (!htmlText) {
        alert('HTMLを貼り付けてください。');
        return;
    }
    
    logEntries = parseCocofoliaLog(htmlText);
    if (logEntries.length === 0) {
        alert('ログの解析に失敗しました。正しいHTMLか確認してください。');
        return;
    }
    showEditor();
};

window.switchUploadTab = switchUploadTab;
