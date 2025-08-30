(function() {
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const fileNameDisplay = document.getElementById('file-name');
    const outputFormatSelect = document.getElementById('output-format');
    const convertBtn = document.getElementById('convert-btn');
    const statusMessage = document.getElementById('status-message');
    const stylingOptions = document.getElementById('styling-options');
    const removeStylingCheckbox = document.getElementById('remove-styling');

    let filesToProcess = [];

    // --- Drag & Drop Event Listeners ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over'), false);
    });
    uploadArea.addEventListener('drop', handleDrop, false);

    // --- Other Event Listeners ---
    fileInput.addEventListener('change', (e) => processFiles(e.target.files));
    convertBtn.addEventListener('click', handleConvert);

    function handleDrop(e) {
        processFiles(e.dataTransfer.files);
    }
    
    async function processFiles(files) {
        if (files.length === 0) return;
        filesToProcess = [];
        stylingOptions.classList.add('hidden'); // Reset styling option
        
        const fileReadPromises = Array.from(files).map(file => {
            return new Promise((resolve) => {
                const extension = file.name.split('.').pop().toLowerCase();
                if (!['srt', 'vtt', 'ass', 'ssa', 'sub'].includes(extension)) {
                    alert(`Unsupported file format: ${file.name}`);
                    return resolve(null);
                }
                if (['ass', 'ssa'].includes(extension)) {
                    stylingOptions.classList.remove('hidden');
                }
                const reader = new FileReader();
                reader.onload = (e) => resolve({ name: file.name, format: extension, content: e.target.result });
                reader.onerror = () => resolve({ error: `Error reading file ${file.name}` });
                reader.readAsText(file);
            });
        });

        const results = await Promise.all(fileReadPromises);
        filesToProcess = results.filter(file => file && !file.error);
        const errors = results.filter(file => file && file.error);

        if (errors.length > 0) {
            statusMessage.className = 'status error';
            statusMessage.textContent = errors.map(e => e.error).join(', ');
        } else {
            statusMessage.className = 'status';
            statusMessage.textContent = '';
        }

        if (filesToProcess.length > 0) {
            fileNameDisplay.textContent = `${filesToProcess.length} file(s) selected.`;
            convertBtn.disabled = false;
        } else {
            fileNameDisplay.textContent = "No files selected";
            convertBtn.disabled = true;
        }
    }

    async function handleConvert() {
        if (filesToProcess.length === 0) {
            alert("Please select one or more files to convert.");
            return;
        }
        const outputFormat = outputFormatSelect.value;
        const removeStyling = removeStylingCheckbox.checked;
        statusMessage.className = 'status';
        statusMessage.textContent = 'Converting...';

        try {
            const processSingleFile = async (file) => {
                const subtitles = parseFile(file.content, file.format, removeStyling);
                const outputContent = buildFile(subtitles, outputFormat);
                const outputFileName = file.name.replace(/\.[^/.]+$/, `.${outputFormat}`);
                return { name: outputFileName, content: outputContent };
            };

            if (filesToProcess.length === 1) {
                const result = await processSingleFile(filesToProcess[0]);
                triggerDownload(result.content, result.name);
            } else {
                const zip = new JSZip();
                for (const file of filesToProcess) {
                    const result = await processSingleFile(file);
                    zip.file(result.name, result.content);
                }
                const zipBlob = await zip.generateAsync({ type: "blob" });
                triggerDownload(zipBlob, `converted_subtitles.zip`);
            }
            statusMessage.className = 'status success';
            statusMessage.textContent = `${filesToProcess.length} file(s) converted successfully.`;
        } catch (error) {
            statusMessage.className = 'status error';
            statusMessage.textContent = `Error: ${error.message}`;
            console.error(error);
        }
    }
    
    // --- Universal Parser with Error Handling ---
    function parseFile(content, format, removeStyling) {
        switch (format) {
            case 'srt':
            case 'sub': // Assuming .sub is the common SubRip text format
                return parseSrt(content);
            case 'vtt':
                return parseVtt(content);
            case 'ass':
            case 'ssa':
                return parseAss(content, removeStyling);
            default:
                throw new Error(`Unsupported input format: ${format}`);
        }
    }
    
    function buildFile(subtitles, format) {
        switch (format) {
            case 'srt':
                return buildSrt(subtitles);
            case 'vtt':
                return buildVtt(subtitles);
            case 'txt':
                return buildTxt(subtitles);
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    }

    // --- Format-Specific Parsers with Error Reporting ---
    function parseSrt(data) {
        const subs = [];
        const blocks = data.trim().replace(/\r/g, '').split('\n\n');
        for (const [i, block] of blocks.entries()) {
            const lines = block.split('\n');
            if (lines.length < 2) continue;
            if (!lines[1].match(/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/)) {
                throw new Error(`Invalid timestamp format in block #${i + 1} of SRT file.`);
            }
            const [startTime, endTime] = lines[1].split(' --> ');
            subs.push({
                startTime: startTime.replace(',', '.'),
                endTime: endTime.replace(',', '.'),
                text: lines.slice(2).join('\n')
            });
        }
        return subs;
    }
    
    function parseVtt(data) {
        const subs = [];
        const blocks = data.trim().replace(/\r/g, '').split('\n\n');
        const startIndex = blocks[0].toUpperCase().startsWith('WEBVTT') ? 1 : 0;
        for (let i = startIndex; i < blocks.length; i++) {
            const lines = blocks[i].split('\n');
            const timeLineIndex = lines.findIndex(line => line.includes('-->'));
            if (timeLineIndex !== -1) {
                 const [startTime, endTime] = lines[timeLineIndex].split(' --> ');
                 subs.push({ startTime: startTime.trim(), endTime: endTime.trim(), text: lines.slice(timeLineIndex + 1).join('\n') });
            }
        }
        return subs;
    }

    function parseAss(data, removeStyling) {
        const subs = [];
        const lines = data.trim().split(/\r?\n/);
        const eventLines = lines.filter(line => line.startsWith('Dialogue:'));
        for (const [i, line] of eventLines.entries()) {
            const parts = line.split(',');
            if (parts.length < 10) {
                 throw new Error(`Invalid Dialogue format on line #${i + 1} of ASS/SSA file.`);
            }
            let text = parts.slice(9).join(',');
            if (removeStyling) {
                text = text.replace(/{.*?}/g, ''); // Remove styling tags like {\i1}
            }
            subs.push({
                startTime: formatAssTime(parts[1]),
                endTime: formatAssTime(parts[2]),
                text: text.replace(/\\N/g, '\n') // Replace \N with newline
            });
        }
        return subs;
    }
    
    // --- Builder and Helper Functions ---
    function formatAssTime(time) {
        const [h, m, s_cs] = time.split(':');
        const [s, cs] = s_cs.split('.');
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${(cs + '0').padEnd(3, '0')}`;
    }

    function buildSrt(subtitles) {
        return subtitles.map((sub, index) => {
            const startTime = sub.startTime.replace('.', ',');
            const endTime = sub.endTime.replace('.', ',');
            return `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}`;
        }).join('\n\n') + '\n\n';
    }

    function buildVtt(subtitles) {
        const content = subtitles.map(sub => `${sub.startTime} --> ${sub.endTime}\n${sub.text}`).join('\n\n');
        return 'WEBVTT\n\n' + content + '\n\n';
    }
    
    function buildTxt(subtitles) {
        return subtitles.map(sub => sub.text).join('\n');
    }

    function triggerDownload(content, fileName) {
        const blob = (typeof content === 'string') ? new Blob([content], { type: 'text/plain;charset=utf-8' }) : content;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }
   });
})();
