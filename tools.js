window.SubTools = window.SubTools || {};

// ===================================================================================
// TOOL 1: COORDINATOR
// ===================================================================================
window.SubTools.coordinator = {
    toolContainer: null, subtitles: [], originalFileName: 'edited.srt', elements: {}, keyboardHandler: null,
    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) return;
        this.elements = {
            fileInput: this.toolContainer.querySelector('#coordinator-fileInput'),
            fileNameSpan: this.toolContainer.querySelector('#coordinator-file-name'),
            saveButton: this.toolContainer.querySelector('#coordinator-saveButton'),
            subtitleContainer: this.toolContainer.querySelector('#coordinator-subtitle-container'),
            selectAllCheckbox: this.toolContainer.querySelector('#coordinator-selectAllCheckbox'),
            shiftInputs: {
                h: this.toolContainer.querySelector('#coordinator-shiftHours'),
                m: this.toolContainer.querySelector('#coordinator-shiftMinutes'),
                s: this.toolContainer.querySelector('#coordinator-shiftSeconds'),
                ms: this.toolContainer.querySelector('#coordinator-shiftMilliseconds')
            },
            shiftForwardButton: this.toolContainer.querySelector('#coordinator-shiftForwardButton'),
            shiftBackwardButton: this.toolContainer.querySelector('#coordinator-shiftBackwardButton'),
        };
        this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.elements.saveButton.addEventListener('click', this.saveSrtFile.bind(this));
        this.elements.shiftForwardButton.addEventListener('click', () => this.applyShift(1));
        this.elements.shiftBackwardButton.addEventListener('click', () => this.applyShift(-1));
        this.elements.selectAllCheckbox.addEventListener('change', this.handleSelectAll.bind(this));
        this.keyboardHandler = this.handleKeyboardShortcuts.bind(this);
        document.addEventListener('keydown', this.keyboardHandler);
        console.log('Coordinator tool initialized.');
    },
    destroy: function() {
        if(this.keyboardHandler) document.removeEventListener('keydown', this.keyboardHandler);
        this.subtitles = []; this.originalFileName = 'edited.srt';
        if(this.elements.fileNameSpan) this.elements.fileNameSpan.textContent = "No file selected.";
        if(this.elements.subtitleContainer) this.elements.subtitleContainer.innerHTML = "";
        if(this.elements.fileInput) this.elements.fileInput.value = "";
        console.log('Coordinator tool destroyed.');
    },
    handleFileSelect: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.originalFileName = file.name.replace('.srt', '_edited.srt');
        this.elements.fileNameSpan.textContent = file.name;
        this.elements.saveButton.disabled = true;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.subtitles = this.parseSrt(e.target.result);
            if (this.subtitles.length > 0) {
                this.elements.saveButton.disabled = false; this.renderSubtitles();
            } else { alert('Could not parse SRT file.'); }
        };
        reader.readAsText(file, 'UTF-8');
    },
    renderSubtitles: function() {
        this.elements.subtitleContainer.innerHTML = '';
        this.subtitles.forEach((sub, i) => {
            const item = document.createElement('div');
            item.className = 'subtitle-item';
            if (sub.selected) item.classList.add('selected');
            item.innerHTML = `<input type="checkbox" data-index="${i}" ${sub.selected ? 'checked' : ''}><span class="subtitle-time">${sub.startTime} --> ${sub.endTime}</span><span class="subtitle-text">${sub.text.replace(/\n/g, '<br>')}</span>`;
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                this.subtitles[i].selected = checkbox.checked;
                item.classList.toggle('selected', checkbox.checked);
                this.updateSelectAllCheckboxState();
            });
            item.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') { checkbox.checked = !checkbox.checked; checkbox.dispatchEvent(new Event('change')); } });
            this.elements.subtitleContainer.appendChild(item);
        });
        this.updateSelectAllCheckboxState();
    },
    applyShift: function(direction) {
        const { h, m, s, ms } = this.elements.shiftInputs;
        const totalShift = ((parseInt(h.value)||0)*3600000 + (parseInt(m.value)||0)*60000 + (parseInt(s.value)||0)*1000 + (parseInt(ms.value)||0)) * direction;
        if (totalShift === 0) { alert("Please enter a time value."); return; }
        const targets = this.subtitles.filter(sub => sub.selected);
        const subjects = targets.length > 0 ? targets : this.subtitles;
        if (targets.length === 0 && !confirm("No lines selected. Apply to all?")) return;
        subjects.forEach(sub => this.shiftTime(sub, totalShift));
        this.renderSubtitles();
    },
    shiftTime: function(sub, shiftMs) {
        sub.startTime = this.millisecondsToTime(this.timeToMilliseconds(sub.startTime) + shiftMs);
        sub.endTime = this.millisecondsToTime(this.timeToMilliseconds(sub.endTime) + shiftMs);
    },
    saveSrtFile: function() {
        const srtContent = this.subtitles.map(s => `${s.index}\n${s.startTime} --> ${s.endTime}\n${s.text}`).join('\n\n') + '\n\n';
        this.triggerDownload(srtContent, this.originalFileName);
    },
    handleKeyboardShortcuts: function(e) { if (e.target.tagName === 'INPUT') return; if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); this.elements.selectAllCheckbox.checked = !this.elements.selectAllCheckbox.checked; this.handleSelectAll(); } if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); this.elements.saveButton.click(); } },
    handleSelectAll: function() { this.subtitles.forEach(sub => sub.selected = this.elements.selectAllCheckbox.checked); this.renderSubtitles(); },
    updateSelectAllCheckboxState: function() { const total = this.subtitles.length; const selected = this.subtitles.filter(s => s.selected).length; this.elements.selectAllCheckbox.checked = total > 0 && selected === total; this.elements.selectAllCheckbox.indeterminate = selected > 0 && selected < total; },
    timeToMilliseconds: (t) => { const p = t.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/); return p ? (parseInt(p[1])*36e5 + parseInt(p[2])*6e4 + parseInt(p[3])*1e3 + +p[4]) : 0; },
    millisecondsToTime: (ms) => { if(ms<0)ms=0; let h=Math.floor(ms/36e5);ms%=36e5;let m=Math.floor(ms/6e4);ms%=6e4;let s=Math.floor(ms/1e3); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1e3).padStart(3,'0')}`; },
    parseSrt: (d) => d.trim().replace(/\r/g,'').split('\n\n').map(b => { const l=b.split('\n'); if(l.length>=2){ const t=l[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/); if(t) return {index:parseInt(l[0],10),startTime:t[1],endTime:t[2],text:l.slice(2).join('\n'),selected:false}; } return null; }).filter(Boolean),
    triggerDownload: (c, f) => { const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type:'text/plain;charset=utf-8'}));a.download=f;document.body.appendChild(a);a.click();document.body.removeChild(a); }
};

// ===================================================================================
// TOOL 2: TRANSLATOR
// ===================================================================================
window.SubTools.translator = {
    toolContainer: null, subtitles: [], originalFileName: 'translated.srt', currentFileContent: '', searchState: { currentIndex: -1, searchTerm: '' }, elements: {},
    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) return;
        this.elements = {
            fileInput: this.toolContainer.querySelector('#translator-fileInput'),
            fileNameSpan: this.toolContainer.querySelector('#translator-file-name'),
            editorCard: this.toolContainer.querySelector('#translator-editor-card'),
            subtitleBody: this.toolContainer.querySelector('#translator-subtitle-body'),
            saveButton: this.toolContainer.querySelector('#translator-saveButton'),
            autoSaveStatus: this.toolContainer.querySelector('#translator-autosave-status'),
            selectAllCheckbox: this.toolContainer.querySelector('#translator-select-all-checkbox'),
            addLineBtn: this.toolContainer.querySelector('#translator-add-line-btn'),
            deleteLinesBtn: this.toolContainer.querySelector('#translator-delete-lines-btn'),
            findInput: this.toolContainer.querySelector('#translator-find-input'),
            replaceInput: this.toolContainer.querySelector('#translator-replace-input'),
            findNextBtn: this.toolContainer.querySelector('#translator-find-next-btn'),
            replaceBtn: this.toolContainer.querySelector('#translator-replace-btn'),
            replaceAllBtn: this.toolContainer.querySelector('#translator-replace-all-btn'),
            findReplaceStatus: this.toolContainer.querySelector('#translator-find-replace-status')
        };
        this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.elements.saveButton.addEventListener('click', this.saveTranslatedFile.bind(this));
        this.elements.findNextBtn.addEventListener('click', this.handleFindNext.bind(this));
        this.elements.replaceBtn.addEventListener('click', this.handleReplace.bind(this));
        this.elements.replaceAllBtn.addEventListener('click', this.handleReplaceAll.bind(this));
        this.elements.selectAllCheckbox.addEventListener('change', this.handleSelectAll.bind(this));
        this.elements.addLineBtn.addEventListener('click', this.handleAddLine.bind(this));
        this.elements.deleteLinesBtn.addEventListener('click', this.handleDeleteLines.bind(this));
        console.log('Translator tool initialized.');
    },
    destroy: function() {
        this.subtitles = []; this.originalFileName = 'translated.srt'; this.currentFileContent = ''; this.searchState = { currentIndex: -1, searchTerm: '' };
        if(this.elements.fileNameSpan) this.elements.fileNameSpan.textContent = "No file selected";
        if(this.elements.editorCard) this.elements.editorCard.classList.add('hidden');
        if(this.elements.fileInput) this.elements.fileInput.value = "";
        console.log('Translator tool destroyed.');
    },
    handleFileSelect: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.originalFileName = file.name.replace('.srt', '_translated.srt');
        this.elements.fileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentFileContent = e.target.result;
            this.subtitles = this.parseSrt(this.currentFileContent);
            if (this.subtitles.length > 0) { this.renderTranslator(); this.loadAutoSavedTranslations(); this.elements.editorCard.classList.remove('hidden'); }
            else { alert('The subtitle file appears to be empty or invalid.'); }
        };
        reader.readAsText(file, 'UTF-8');
    },
    parseSrt: function(data) {
        return data.trim().replace(/\r/g,'').split('\n\n').map(b => {const l=b.split('\n');if(l.length>=2 && l[1].includes('-->')){const t=l[1].split(' --> ');return {index:parseInt(l[0],10),startTime:t[0],endTime:t[1],text:l.slice(2).join('\n'),selected:false};}return null;}).filter(Boolean);
    },
    renderTranslator: function() {
        this.elements.subtitleBody.innerHTML = '';
        this.subtitles.forEach((sub, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `<td data-label="Select" class="col-select"><input type="checkbox" class="line-checkbox" data-index="${i}" ${sub.selected?'checked':''}></td><td data-label="#" class="col-index">${sub.index}</td><td data-label="Timestamp" class="col-time">${sub.startTime} --> ${sub.endTime}</td><td data-label="Original Text" class="col-original">${sub.text.replace(/\n/g,'<br>')}</td><td data-label="Translated Text" class="col-translation"><textarea data-id="${i}" class="translation-input" rows="2" spellcheck="false"></textarea><div class="translation-meta"><button class="copy-original-btn" title="Copy original text">Copy</button><span class="char-counter">0</span></div></td>`;
            this.elements.subtitleBody.appendChild(row);
        });
        this.attachEventListeners(); this.updateSelectAllCheckboxState();
    },
    attachEventListeners: function() {
        this.toolContainer.querySelectorAll('.line-checkbox').forEach(cb => cb.addEventListener('change', this.handleLineSelect.bind(this)));
        this.toolContainer.querySelectorAll('.translation-input').forEach(t => { t.addEventListener('input', this.handleTextareaInput.bind(this)); t.addEventListener('keydown', this.handleTextareaKeyDown.bind(this)); });
        this.toolContainer.querySelectorAll('.copy-original-btn').forEach(b => b.addEventListener('click', this.handleCopyOriginal.bind(this)));
    },
    handleAddLine: function() {
        const i = this.subtitles.findIndex(s => s.selected);
        if (i===-1) { alert("Please select a line to insert before."); return; }
        if (i===0) { alert("Cannot add a line before the first subtitle."); return; }
        const prev = this.subtitles[i-1], next = this.subtitles[i];
        const prevEnd = this.timeToMilliseconds(prev.endTime), nextStart = this.timeToMilliseconds(next.startTime);
        if ((nextStart-prevEnd) < 200) { alert(`Not enough time between lines ${prev.index} and ${next.index}.`); return; }
        this.subtitles.splice(i, 0, {index:-1,startTime:this.millisecondsToTime(prevEnd+1),endTime:this.millisecondsToTime(nextStart-1),text:"[New Line]",selected:false});
        this.reindexSubtitles(); this.renderTranslator(); this.loadAutoSavedTranslations();
    },
    handleDeleteLines: function() {
        const count = this.subtitles.filter(s=>s.selected).length;
        if(count === 0){ alert("Please select lines to delete."); return; }
        if(confirm(`Delete ${count} selected line(s)?`)){ this.subtitles=this.subtitles.filter(s=>!s.selected); this.reindexSubtitles();this.renderTranslator();this.loadAutoSavedTranslations(); }
    },
    reindexSubtitles: function() { this.subtitles.forEach((s,i) => { s.index=i+1; }); },
    handleLineSelect: function(e) { this.subtitles[parseInt(e.target.dataset.index)].selected = e.target.checked; this.updateSelectAllCheckboxState(); },
    handleSelectAll: function(e) { const chk = e.target.checked; this.subtitles.forEach(s=>s.selected=chk); this.toolContainer.querySelectorAll('.line-checkbox').forEach(c=>c.checked=chk); },
    updateSelectAllCheckboxState: function() { const sel=this.subtitles.filter(s=>s.selected).length; const total=this.subtitles.length; if(total>0){this.elements.selectAllCheckbox.checked=sel===total;this.elements.selectAllCheckbox.indeterminate=sel>0&&sel<total;}else{this.elements.selectAllCheckbox.checked=false;this.elements.selectAllCheckbox.indeterminate=false;} },
    handleFindNext: function() {
        const ta = Array.from(this.toolContainer.querySelectorAll('.translation-input'));
        const term = this.elements.findInput.value;
        if(!term){this.elements.findReplaceStatus.textContent="Enter text to find.";return;}
        if(this.searchState.searchTerm!==term){this.searchState.currentIndex=-1;this.searchState.searchTerm=term;this.clearHighlights();}
        for (let i=0;i<ta.length;i++){ let ci=(this.searchState.currentIndex+1+i)%ta.length; if(ta[ci].value.toLowerCase().includes(term.toLowerCase())){ this.clearHighlights(); ta[ci].classList.add('highlighted'); ta[ci].scrollIntoView({behavior:'smooth',block:'center'}); this.elements.findReplaceStatus.textContent=`Found in line #${this.subtitles[ci].index}`; this.searchState.currentIndex=ci; return; } }
        this.elements.findReplaceStatus.textContent="End of document reached.";this.searchState.currentIndex=-1;this.clearHighlights();
    },
    handleReplace: function() {
        if(this.searchState.currentIndex===-1||!this.elements.findInput.value){this.elements.findReplaceStatus.textContent="Find text before replacing.";return;}
        const ta=this.toolContainer.querySelector(`.translation-input[data-id="${this.searchState.currentIndex}"]`);
        const rx=new RegExp(this.elements.findInput.value,'i');
        if(rx.test(ta.value)){ ta.value=ta.value.replace(rx,this.elements.replaceInput.value); ta.dispatchEvent(new Event('input',{bubbles:true})); this.elements.findReplaceStatus.textContent="Replaced one occurrence."; this.handleFindNext(); }
    },
    handleReplaceAll: function() {
        const find=this.elements.findInput.value,repl=this.elements.replaceInput.value; if(!find){this.elements.findReplaceStatus.textContent="Enter text to find and replace.";return;}
        let total=0; const rx=new RegExp(find,'gi');
        this.toolContainer.querySelectorAll('.translation-input').forEach(ta=>{ const ov=ta.value; const nv=ov.replace(rx,repl); if(ov!==nv){ total+=(ov.match(rx)||[]).length; ta.value=nv; ta.dispatchEvent(new Event('input',{bubbles:true})); } });
        this.elements.findReplaceStatus.textContent=`Replaced ${total} occurrence(s).`; this.clearHighlights(); this.searchState.currentIndex=-1;
    },
    clearHighlights: function() { this.toolContainer.querySelectorAll('.translation-input.highlighted').forEach(el=>el.classList.remove('highlighted')); },
    handleTextareaInput: function(e) { const ta=e.target; const char=ta.nextElementSibling.querySelector('.char-counter'); char.textContent=ta.value.length; char.classList.toggle('limit-exceeded',ta.value.split('\n').some(l=>l.length>42)); this.autoSaveTranslation(ta.getAttribute('data-id'), ta.value); },
    handleCopyOriginal: function(e) { const ta=e.target.closest('.col-translation').querySelector('textarea'); ta.value=this.subtitles[ta.getAttribute('data-id')].text; ta.focus(); ta.dispatchEvent(new Event('input',{bubbles:true})); },
    handleTextareaKeyDown: function(e) { if(e.ctrlKey&&e.key==='Enter'){ e.preventDefault(); const next=this.toolContainer.querySelector(`.translation-input[data-id="${parseInt(e.target.getAttribute('data-id'))+1}"]`); if(next)next.focus();else this.elements.saveButton.focus(); } },
    getAutoSaveKey: function() { let h=0;for(let i=0;i<this.currentFileContent.length;i++){h=((h<<5)-h)+this.currentFileContent.charCodeAt(i);h|=0;}return `srt-translation-${h}`; },
    autoSaveTranslation: function(i,t) { const k=this.getAutoSaveKey(); try{ let tr=JSON.parse(localStorage.getItem(k))||{}; tr[i]=t; localStorage.setItem(k,JSON.stringify(tr)); this.elements.autoSaveStatus.textContent='Saved.'; setTimeout(()=> {if(this.elements.autoSaveStatus)this.elements.autoSaveStatus.textContent='';},2000); } catch(e){ this.elements.autoSaveStatus.textContent='Save Error!'; } },
    loadAutoSavedTranslations: function() { const k=this.getAutoSaveKey(); const st=JSON.parse(localStorage.getItem(k)); if(st){this.toolContainer.querySelectorAll('.translation-input').forEach(ta=>{ const i=ta.getAttribute('data-id'); if(st[i]){ta.value=st[i];ta.dispatchEvent(new Event('input',{bubbles:true}));}}); this.elements.autoSaveStatus.textContent='Loaded auto-saved session.'; } },
    saveTranslatedFile: function() { const content=this.subtitles.map((s,i)=>{const ta=this.toolContainer.querySelector(`.translation-input[data-id="${i}"]`);const tt=ta.value.trim()||s.text;return `${s.index}\n${s.startTime} --> ${s.endTime}\n${tt}`;}).join('\n\n')+'\n\n'; this.triggerDownload(content,this.originalFileName); if(confirm("Clear auto-saved data?")){localStorage.removeItem(this.getAutoSaveKey());this.elements.autoSaveStatus.textContent='Auto-save cleared.';} },
    timeToMilliseconds: (t) => { const p = t.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/); return p ? (parseInt(p[1])*36e5 + parseInt(p[2])*6e4 + parseInt(p[3])*1e3 + +p[4]) : 0; },
    millisecondsToTime: (ms) => { if(ms<0)ms=0; let h=Math.floor(ms/36e5);ms%=36e5;let m=Math.floor(ms/6e4);ms%=6e4;let s=Math.floor(ms/1e3); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1e3).padStart(3,'0')}`; },
    triggerDownload: (c, f) => { const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type:'text/plain;charset=utf-8'}));a.download=f;document.body.appendChild(a);a.click();document.body.removeChild(a); }
};

// ===================================================================================
// TOOL 3: CONVERTER
// ===================================================================================
window.SubTools.converter = {
    toolContainer: null, elements: {}, filesToProcess: [],
    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) return;
        this.elements = {
            fileInput: this.toolContainer.querySelector('#converter-file-input'),
            uploadArea: this.toolContainer.querySelector('#converter-upload-area'),
            fileNameDisplay: this.toolContainer.querySelector('#converter-file-name'),
            outputFormatSelect: this.toolContainer.querySelector('#converter-output-format'),
            convertBtn: this.toolContainer.querySelector('#converter-convert-btn'),
            statusMessage: this.toolContainer.querySelector('#converter-status-message'),
            stylingOptions: this.toolContainer.querySelector('#converter-styling-options'),
            removeStylingCheckbox: this.toolContainer.querySelector('#converter-remove-styling')
        };
        this.elements.fileInput.addEventListener('change', (e) => this.processFiles(e.target.files));
        this.elements.convertBtn.addEventListener('click', this.handleConvert.bind(this));
        const pD=(e)=>{e.preventDefault();e.stopPropagation();};['dragenter','dragover','dragleave','drop'].forEach(ev=>this.elements.uploadArea.addEventListener(ev,pD));
        ['dragenter','dragover'].forEach(ev=>this.elements.uploadArea.addEventListener(ev,()=>this.elements.uploadArea.classList.add('drag-over')));
        ['dragleave','drop'].forEach(ev=>this.elements.uploadArea.addEventListener(ev,()=>this.elements.uploadArea.classList.remove('drag-over')));
        this.elements.uploadArea.addEventListener('drop', (e) => this.processFiles(e.dataTransfer.files));
        console.log('Converter tool initialized.');
    },
    destroy: function() {
        this.filesToProcess = [];
        if(this.elements.fileNameDisplay) this.elements.fileNameDisplay.textContent = "No files selected";
        if(this.elements.statusMessage) this.elements.statusMessage.textContent = "";
        if(this.elements.convertBtn) this.elements.convertBtn.disabled = true;
        if(this.elements.stylingOptions) this.elements.stylingOptions.classList.add('hidden');
        if(this.elements.fileInput) this.elements.fileInput.value = "";
        console.log('Converter tool destroyed.');
    },
    processFiles: async function(files) {
        if(files.length===0)return; this.filesToProcess=[]; this.elements.stylingOptions.classList.add('hidden');
        const promises = Array.from(files).map(f => new Promise(res=>{ const ext=f.name.split('.').pop().toLowerCase(); if(!['srt','vtt','ass','ssa','sub'].includes(ext)){alert(`Unsupported file: ${f.name}`); return res(null);} if(['ass','ssa'].includes(ext)){this.elements.stylingOptions.classList.remove('hidden');} const r=new FileReader(); r.onload=(e)=>res({name:f.name,format:ext,content:e.target.result}); r.onerror=()=>res({error:`Error reading ${f.name}`}); r.readAsText(f); }));
        const results=await Promise.all(promises); this.filesToProcess=results.filter(f=>f&&!f.error); const errors=results.filter(f=>f&&f.error);
        if(errors.length>0){this.elements.statusMessage.className='status error';this.elements.statusMessage.textContent=errors.map(e=>e.error).join(', ');}else{this.elements.statusMessage.className='status';this.elements.statusMessage.textContent='';}
        if(this.filesToProcess.length>0){this.elements.fileNameDisplay.textContent=`${this.filesToProcess.length} file(s) selected.`;this.elements.convertBtn.disabled=false;}else{this.elements.fileNameDisplay.textContent="No files selected";this.elements.convertBtn.disabled=true;}
    },
    handleConvert: async function() {
        if(this.filesToProcess.length===0){alert("Please select files.");return;}
        const outFmt=this.elements.outputFormatSelect.value; const rmSty=this.elements.removeStylingCheckbox.checked;
        this.elements.statusMessage.className='status'; this.elements.statusMessage.textContent='Converting...';
        try{
            const pF=(f)=>{ const s=this.parseFile(f.content,f.format,rmSty); const o=this.buildFile(s,outFmt); const n=f.name.replace(/\.[^/.]+$/,`.${outFmt}`); return {name:n,content:o}; };
            if(this.filesToProcess.length===1){ const res=pF(this.filesToProcess[0]); this.triggerDownload(res.content,res.name); }
            else{ const zip=new JSZip(); for(const f of this.filesToProcess){ const res=pF(f); zip.file(res.name,res.content); } const zB=await zip.generateAsync({type:"blob"}); this.triggerDownload(zB,`converted_subtitles.zip`); }
            this.elements.statusMessage.className='status success'; this.elements.statusMessage.textContent=`${this.filesToProcess.length} file(s) converted.`;
        }catch(e){this.elements.statusMessage.className='status error';this.elements.statusMessage.textContent=`Error: ${e.message}`;}
    },
    parseFile: function(c,f,rS){ switch(f){ case 'srt': case 'sub': return this.parseSrt(c); case 'vtt': return this.parseVtt(c); case 'ass': case 'ssa': return this.parseAss(c,rS); default: throw new Error(`Unsupported input: ${f}`); } },
    buildFile: function(s,f){ switch(f){ case 'srt': return this.buildSrt(s); case 'vtt': return this.buildVtt(s); case 'txt': return this.buildTxt(s); default: throw new Error(`Unsupported output: ${f}`); } },
    parseSrt: function(d) { return d.trim().replace(/\r/g,'').split('\n\n').map((b,i)=>{const l=b.split('\n');if(l.length>=2){if(!l[1].match(/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/)){throw new Error(`Invalid SRT timestamp in block #${i+1}`);}const t=l[1].split(' --> ');return{startTime:t[0].replace(',','.'),endTime:t[1].replace(',','.'),text:l.slice(2).join('\n')};}return null;}).filter(Boolean); },
    parseVtt: function(d) { const b=d.trim().replace(/\r/g,'').split('\n\n'); const sI=b[0].toUpperCase().startsWith('WEBVTT')?1:0; return b.slice(sI).map(blk=>{const l=blk.split('\n');const tI=l.findIndex(ln=>ln.includes('-->'));if(tI!==-1){const t=l[tI].split(' --> ');return{startTime:t[0].trim(),endTime:t[1].trim(),text:l.slice(tI+1).join('\n')};}return null;}).filter(Boolean); },
    parseAss: function(d,rS) { const subs=[];const lines=d.trim().split(/\r?\n/); const ev=lines.filter(l=>l.startsWith('Dialogue:')); for(const[i,l] of ev.entries()){ const p=l.split(','); if(p.length<10){throw new Error(`Invalid ASS Dialogue line #${i+1}`);} let txt=p.slice(9).join(','); if(rS)txt=txt.replace(/{.*?}/g,''); subs.push({startTime:this.formatAssTime(p[1]),endTime:this.formatAssTime(p[2]),text:txt.replace(/\\N/g,'\n')});} return subs; },
    formatAssTime: (t)=>{const[h,m,s_cs]=t.split(':');const[s,cs]=s_cs.split('.');return `${h.padStart(2,'0')}:${m.padStart(2,'0')}:${s.padStart(2,'0')}.${(cs||'0').padEnd(3,'0')}`;},
    buildSrt: (s)=>s.map((sub,i)=>`${i+1}\n${sub.startTime.replace('.',',')} --> ${sub.endTime.replace('.',',')}\n${sub.text}`).join('\n\n')+'\n\n',
    buildVtt: (s)=>'WEBVTT\n\n'+s.map(sub=>`${sub.startTime} --> ${sub.endTime}\n${sub.text}`).join('\n\n')+'\n\n',
    buildTxt: (s)=>s.map(sub=>sub.text).join('\n'),
    triggerDownload: (c, f) => { const a=document.createElement('a');a.href=URL.createObjectURL((typeof c==='string')?new Blob([c],{type:'text/plain;charset=utf-8'}):c);a.download=f;document.body.appendChild(a);a.click();document.body.removeChild(a); }
};

// ===================================================================================
// TOOL 4: EXTRACTOR
// ===================================================================================
window.SubTools.extractor = {
    toolContainer: null, elements: {}, ffmpeg: null, videoFile: null, subtitleTracks: [],
    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) return;
        this.elements = {
            videoInput: this.toolContainer.querySelector('#extractor-video-input'),
            statusText: this.toolContainer.querySelector('#extractor-status-text'),
            progressBar: this.toolContainer.querySelector('#extractor-progress-bar'),
            tracksContainer: this.toolContainer.querySelector('#extractor-tracks-container'),
            tracksList: this.toolContainer.querySelector('#extractor-tracks-list'),
            extractBtn: this.toolContainer.querySelector('#extractor-extract-btn'),
            outputFormatSelect: this.toolContainer.querySelector('#extractor-output-format'),
            previewBox: this.toolContainer.querySelector('#extractor-preview-box'),
            previewContent: this.toolContainer.querySelector('#extractor-preview-content')
        };
        const { createFFmpeg } = FFmpeg;
        this.ffmpeg = createFFmpeg({ log: true, corePath: 'assets/ffmpeg/ffmpeg-core.js' });
        this.elements.videoInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.elements.extractBtn.addEventListener('click', this.handleExtract.bind(this));
        console.log('Extractor tool initialized.');
    },
    destroy: function() {
        this.videoFile = null; this.subtitleTracks = [];
        if(this.elements.videoInput) this.elements.videoInput.value = "";
        this.resetUI();
        console.log('Extractor tool destroyed.');
    },
    handleFileSelect: async function(e) {
        this.videoFile = e.target.files[0]; if(!this.videoFile)return; this.resetUI();
        this.elements.statusText.textContent = 'Preparing to scan...';
        if(!this.ffmpeg.isLoaded()) { await this.loadFFmpeg(); }
        await this.scanForSubtitles();
    },
    loadFFmpeg: async function() {
        this.elements.statusText.textContent = 'Loading video engine (ffmpeg)...';
        this.elements.progressBar.classList.remove('hidden');
        this.ffmpeg.setProgress(({ratio})=>this.elements.progressBar.value=ratio*100);
        await this.ffmpeg.load();
        this.elements.progressBar.classList.add('hidden');
    },
    scanForSubtitles: async function() {
        this.subtitleTracks=[]; this.elements.statusText.textContent='Writing file to virtual memory...';
        this.ffmpeg.FS('writeFile', this.videoFile.name, await FFmpeg.fetchFile(this.videoFile));
        this.elements.statusText.textContent='Scanning for subtitle tracks...';
        let cmdOut=""; this.ffmpeg.setLogger(({type,message})=>{if(type==='fferr')cmdOut+=message+'\n';});
        try{await this.ffmpeg.run('-i',this.videoFile.name);}catch(e){}
        finally{this.parseFFmpegOutput(cmdOut);this.displayTracks();this.ffmpeg.setLogger(()=>{});}
    },
    handleExtract: async function() {
        const sel=Array.from(this.toolContainer.querySelectorAll('input[name="subtitle-track"]:checked'));
        if(sel.length===0){alert('Please select tracks to extract.');return;}
        this.elements.statusText.textContent=`Extracting ${sel.length} track(s)...`;
        this.elements.progressBar.classList.remove('hidden');
        try{
            const files=[];
            for (const tI of sel){ const trkIdx=tI.value;const ogFmt=tI.dataset.format;const outFmt=this.elements.outputFormatSelect.value;
                const tmpFile=`output.${ogFmt}`;
                await this.ffmpeg.run('-i',this.videoFile.name,'-map',`0:${trkIdx}`, '-c','copy',tmpFile);
                const data=this.ffmpeg.FS('readFile',tmpFile); this.ffmpeg.FS('unlink',tmpFile);
                const contentStr=new TextDecoder().decode(data);
                let finalContent=contentStr; let finalFmt=(outFmt==='original')?ogFmt:outFmt;
                if(outFmt!=='original'&&outFmt!==ogFmt){ const pS=window.SubTools.converter.parseFile(contentStr,ogFmt); finalContent=window.SubTools.converter.buildFile(pS,outFmt); }
                const fName=`${this.videoFile.name.split('.').slice(0,-1).join('.')}_${trkIdx}.${finalFmt}`;
                files.push({name:fName,content:finalContent});
            }
            if(files.length===1){ this.triggerDownload(files[0].content,files[0].name); }
            else{ const zip=new JSZip(); files.forEach(f=>zip.file(f.name,f.content)); const zB=await zip.generateAsync({type:"blob"}); this.triggerDownload(zB,'subtitles.zip'); }
            this.elements.statusText.textContent=`${files.length} track(s) extracted.`;
        }catch(e){this.elements.statusText.textContent='Error during extraction.';console.error(e);}
        finally{this.elements.progressBar.classList.add('hidden');}
    },
    handlePreview: async function(trkIdx,trkFmt) {
        this.elements.statusText.textContent=`Generating preview...`; this.elements.previewBox.classList.remove('hidden'); this.elements.previewContent.textContent='Processing...';
        try{
            const tmpFile=`preview.${trkFmt}`; await this.ffmpeg.run('-i',this.videoFile.name,'-map',`0:${trkIdx}`,'-c','copy',tmpFile);
            const data=this.ffmpeg.FS('readFile',tmpFile); this.ffmpeg.FS('unlink',tmpFile);
            const contentStr=new TextDecoder().decode(data); const pS=window.SubTools.converter.parseFile(contentStr,trkFmt);
            this.elements.previewContent.textContent=pS.slice(0,5).map(s=>s.text).join('\n---\n')||'(No preview available)';
            this.elements.statusText.textContent='Preview is ready.';
        }catch(e){this.elements.previewContent.textContent='Error generating preview.';}
    },
    parseFFmpegOutput: function(out) { const rx=/Stream #0:(\d+).*?Subtitle: (\w+)(?:.*?Language: (\w+))?/g; let m; while((m=rx.exec(out))!==null){ let fmt=m[2].toLowerCase();if(fmt==='subrip')fmt='srt';this.subtitleTracks.push({index:m[1],format:fmt,language:m[3]||'Unknown'});} },
    displayTracks: function() {
        if(this.subtitleTracks.length>0){
            this.elements.statusText.textContent=`${this.subtitleTracks.length} track(s) found.`; this.elements.tracksList.innerHTML='';
            this.subtitleTracks.forEach(t=>{const d=document.createElement('div');d.className='track-item';d.innerHTML=`<div class="track-item-info"><input type="checkbox" name="subtitle-track" value="${t.index}" data-format="${t.format}"><label>Track ${t.index} - Lang: ${t.language} (Format: ${t.format.toUpperCase()})</label></div><button class="preview-btn" data-index="${t.index}" data-format="${t.format}">Preview</button>`;this.elements.tracksList.appendChild(d);});
            this.toolContainer.querySelectorAll('.preview-btn').forEach(b=>{ b.addEventListener('click', (e)=>{ this.handlePreview(e.target.dataset.index, e.target.dataset.format); }); });
            this.elements.tracksContainer.classList.remove('hidden'); this.elements.extractBtn.disabled=false;
        }else{ this.elements.statusText.textContent='No embedded subtitle tracks were found.'; }
    },
    resetUI: function() {
        if (!this.elements.tracksContainer) return;
        this.elements.tracksContainer.classList.add('hidden');
        this.elements.previewBox.classList.add('hidden');
        this.elements.tracksList.innerHTML = '';
        this.elements.extractBtn.disabled = true;
        this.elements.progressBar.classList.add('hidden');
        this.elements.statusText.textContent = 'Select a video file (MKV, MP4) to begin.';
    },
    triggerDownload: (c, f) => { const a=document.createElement('a');a.href=URL.createObjectURL((typeof c==='string')?new Blob([c],{type:'text/plain;charset=utf-8'}):c);a.download=f;document.body.appendChild(a);a.click();document.body.removeChild(a); }
};

// ===================================================================================
// TOOL 5: HEALTH CHECKKER
// ===================================================================================
window.SubTools.checker = {
    toolContainer: null,
    subtitles: [],
    currentFile: null,
    elements: {},

    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) return;

        this.elements = {
            fileInput: this.toolContainer.querySelector('#checker-file-input'),
            reReadBtn: this.toolContainer.querySelector('#checker-re-read-btn'),
            encodingFixer: this.toolContainer.querySelector('#checker-encoding-fixer'),
            resultsCard: this.toolContainer.querySelector('#checker-results-card'),
            summaryStats: this.toolContainer.querySelector('#checker-summary-stats'),
            fixCommonBtn: this.toolContainer.querySelector('#checker-fix-common-btn'),
            removeHiBtn: this.toolContainer.querySelector('#checker-remove-hi-btn'),
            removeStylesBtn: this.toolContainer.querySelector('#checker-remove-styles-btn'),
            subtitleBody: this.toolContainer.querySelector('#checker-subtitle-body'),
            outputEncodingSelect: this.toolContainer.querySelector('#checker-output-encoding'),
            saveBtn: this.toolContainer.querySelector('#checker-save-btn')
        };

        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        this.elements.reReadBtn.addEventListener('click', () => this.loadFile(this.currentFile, 'windows-1256'));
        this.elements.fixCommonBtn.addEventListener('click', this.fixCommonIssues.bind(this));
        this.elements.removeHiBtn.addEventListener('click', this.removeHiTags.bind(this));
        this.elements.removeStylesBtn.addEventListener('click', this.removeStyleTags.bind(this));
        this.elements.saveBtn.addEventListener('click', this.saveFile.bind(this));
        
        console.log('Health Checker tool initialized.');
    },

    destroy: function() {
        this.subtitles = [];
        this.currentFile = null;
        if (this.elements.fileInput) this.elements.fileInput.value = "";
        if (this.elements.resultsCard) this.elements.resultsCard.classList.add('hidden');
        if (this.elements.encodingFixer) this.elements.encodingFixer.classList.add('hidden');
        console.log('Health Checker tool destroyed.');
    },

    handleFileSelect: function(file) {
        if (!file) return;
        this.currentFile = file;
        this.elements.encodingFixer.classList.remove('hidden');
        this.loadFile(file);
    },

    loadFile: function(file, encoding = 'UTF-8') {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.subtitles = this.parseSrtAdvanced(e.target.result);
            this.analyzeSubtitles();
            this.elements.resultsCard.classList.remove('hidden');
        };
        reader.readAsText(file, encoding);
    },

    analyzeSubtitles: function() {
        const issuesCount = { syntax: 0, overlap: 0, short_duration: 0, long_duration: 0, cpl: 0, cps: 0, formatting: 0 };
        
        this.subtitles.forEach((sub, i) => {
            if (sub.isError) {
                issuesCount.syntax++;
                // Add the syntax issue to the object if the parser didn't already
                if (!sub.issues.some(iss => iss.type === 'syntax')) {
                    sub.issues.push({ type: 'syntax', message: 'Malformed block' });
                }
                return;
            }
            sub.issues = sub.issues.filter(iss => iss.type === 'syntax' || iss.type === 'formatting'); // Keep only parser issues

            // Timing checks
            if (i < this.subtitles.length - 1 && !this.subtitles[i+1].isError) {
                if (sub.endTimeMs > this.subtitles[i+1].startTimeMs) {
                    sub.issues.push({ type: 'overlap', message: 'Overlaps with next subtitle' });
                    issuesCount.overlap++;
                }
            }
            const duration = sub.endTimeMs - sub.startTimeMs;
            if (duration < 1000) { sub.issues.push({ type: 'short_duration', message: `Short duration (${duration}ms)` }); issuesCount.short_duration++; }
            if (duration > 7000) { sub.issues.push({ type: 'long_duration', message: `Long duration (${(duration/1000).toFixed(1)}s)` }); issuesCount.long_duration++; }

            // Text checks
            const lines = sub.text.split('\n');
            if (lines.some(line => line.length > 42)) { sub.issues.push({ type: 'cpl', message: 'High characters per line (>42)' }); issuesCount.cpl++; }
            const cps = duration > 0 ? sub.text.replace(/\s/g, '').length / (duration / 1000) : 0;
            if (cps > 21) { sub.issues.push({ type: 'cps', message: `High reading speed (${cps.toFixed(1)} CPS)` }); issuesCount.cps++; }
            if(lines.length > 2 && !sub.issues.some(iss=>iss.type === 'formatting')) { sub.issues.push({ type: 'formatting', message: 'More than two lines of text' }); issuesCount.formatting++; }
        });
        this.renderResults(issuesCount);
    },

    renderResults: function(issuesCount) {
        this.elements.subtitleBody.innerHTML = '';
        this.subtitles.forEach(sub => {
            const row = document.createElement('tr');
            
            const issueTypes = sub.issues.map(issue => `issue-${issue.type.replace('_', '-')}`);
            if (sub.isError) issueTypes.push('issue-syntax');
            row.classList.add(...issueTypes);
            row.title = sub.issues.map(issue => issue.message).join(', ');

            if (sub.isError) {
                row.innerHTML = `
                    <td class="col-index">${sub.index}</td>
                    <td colspan="2">
                        <div class="raw-block">${sub.raw.replace(/</g, "&lt;")}</div>
                    </td>`;
            } else {
                 row.innerHTML = `
                    <td class="col-index">${sub.index}</td>
                    <td class="col-time">${sub.startTime} --> ${sub.endTime}</td>
                    <td class="col-text">${sub.text.replace(/\n/g, '<br>')}</td>`;
            }
            this.elements.subtitleBody.appendChild(row);
        });
        
        this.elements.summaryStats.innerHTML = '';
        if (issuesCount.syntax > 0) this.elements.summaryStats.innerHTML += `<span class="stat-danger">${issuesCount.syntax} Syntax Errors</span>`;
        if (issuesCount.overlap > 0) this.elements.summaryStats.innerHTML += `<span class="stat-danger">${issuesCount.overlap} Overlaps</span>`;
        if (issuesCount.short_duration > 0) this.elements.summaryStats.innerHTML += `<span class="stat-danger">${issuesCount.short_duration} Short Durations</span>`;
        if (issuesCount.long_duration > 0) this.elements.summaryStats.innerHTML += `<span class="stat-warning">${issuesCount.long_duration} Long Durations</span>`;
        if (issuesCount.cpl > 0) this.elements.summaryStats.innerHTML += `<span class="stat-warning">${issuesCount.cpl} Long Lines</span>`;
        if (issuesCount.cps > 0) this.elements.summaryStats.innerHTML += `<span class="stat-warning">${issuesCount.cps} High CPS</span>`;
        if (issuesCount.formatting > 0) this.elements.summaryStats.innerHTML += `<span class="stat-info">${issuesCount.formatting} Formatting Issues</span>`;
        if (Object.values(issuesCount).every(v => v === 0)) this.elements.summaryStats.innerHTML = `<span class="stat-success">No issues found!</span>`;
    },

    fixCommonIssues: function() {
        this.subtitles.forEach((sub, i) => {
            if (sub.isError) return;
            if (i < this.subtitles.length - 1 && !this.subtitles[i+1].isError) {
                if (sub.endTimeMs > this.subtitles[i+1].startTimeMs) {
                    sub.endTimeMs = this.subtitles[i+1].startTimeMs - 50;
                }
            }
            if (sub.endTimeMs - sub.startTimeMs < 1000) {
                sub.endTimeMs = sub.startTimeMs + 1000;
            }
            sub.startTime = this.millisecondsToTime(sub.startTimeMs);
            sub.endTime = this.millisecondsToTime(sub.endTimeMs);
        });
        this.analyzeSubtitles(); // Re-analyze and re-render after fixing
    },

    removeHiTags: function() {
        if (!confirm('Are you sure you want to remove all text inside brackets [] and parentheses ()? This cannot be undone.')) return;
        this.subtitles.forEach(sub => {
            if (!sub.isError) {
                sub.text = sub.text.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/\n\s*\n/g, '\n').trim();
            }
        });
        this.analyzeSubtitles();
    },

    removeStyleTags: function() {
        if (!confirm('Are you sure you want to remove all styling tags like <i>, <b>, etc.? This cannot be undone.')) return;
        this.subtitles.forEach(sub => {
            if (!sub.isError) {
                sub.text = sub.text.replace(/<.*?>/g, '').trim();
            }
        });
        this.analyzeSubtitles();
    },

    saveFile: function() {
        const validSubtitles = this.subtitles.filter(sub => !sub.isError);
        const content = this.buildSrt(validSubtitles);
        const encoding = this.elements.outputEncodingSelect.value;
        const blob = new Blob([content], { type: `text/plain;charset=${encoding}` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.currentFile.name.replace('.srt', '_fixed.srt');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    parseSrtAdvanced: function(data) {
        const blocks = data.trim().replace(/\r/g, '').split(/\n\s*\n/);
        return blocks.map((block, i) => {
            const lines = block.split('\n');
            const result = { index: i + 1, raw: block, issues: [], isError: false };
            if (lines.length < 2 || (lines.length === 1 && lines[0].trim() === '')) {
                result.isError = true; result.issues.push({ type: 'syntax', message: 'Block is empty or has too few lines' }); return result;
            }
            let timeLineIndex = lines.findIndex(line => line.includes('-->'));
            if (timeLineIndex === -1) {
                result.isError = true; result.issues.push({ type: 'syntax', message: 'Timestamp line missing or malformed' }); return result;
            }
            const timeMatch = lines[timeLineIndex].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
            if (!timeMatch) {
                result.isError = true; result.issues.push({ type: 'syntax', message: `Invalid timestamp format: ${lines[timeLineIndex]}` }); return result;
            }
            result.index = parseInt(lines[0], 10) || (i + 1);
            result.startTime = timeMatch[1]; result.endTime = timeMatch[2];
            result.startTimeMs = this.timeToMilliseconds(result.startTime);
            result.endTimeMs = this.timeToMilliseconds(result.endTime);
            result.text = lines.slice(timeLineIndex + 1).join('\n').trim();
            if (result.endTimeMs <= result.startTimeMs) { result.issues.push({ type: 'syntax', message: 'End time is before or same as start time' }); }
            if (!result.text) { result.issues.push({ type: 'formatting', message: 'Subtitle has no text' }); }
            if (timeLineIndex > 1 || (timeLineIndex === 1 && isNaN(parseInt(lines[0], 10)))){
                result.issues.push({ type: 'syntax', message: 'Text or invalid index found before timestamp' });
            }
            return result;
        });
    },

    buildSrt: function(subs) { return subs.map(s => `${s.index}\n${s.startTime} --> ${s.endTime}\n${s.text}`).join('\n\n') + '\n\n'; },
    timeToMilliseconds: function(t) { const p = t.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/); return p ? (+p[1]*36e5 + +p[2]*6e4 + +p[3]*1e3 + +p[4]) : 0; },
    millisecondsToTime: function(ms) { if(ms<0)ms=0; let h=Math.floor(ms/36e5);ms%=36e5;let m=Math.floor(ms/6e4);ms%=6e4;let s=Math.floor(ms/1e3); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1e3).padStart(3,'0')}`; }
};
