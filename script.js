// Main Hub Script for Sub Tools - FINAL CORRECTED VERSION
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const toolContents = document.querySelectorAll('.tool-content');
    let activeToolName = null;

    function showTool(toolName) {
        if (activeToolName && window.SubTools && typeof window.SubTools[activeToolName]?.destroy === 'function') {
            window.SubTools[activeToolName].destroy();
        }

        const toolId = toolName + '-tool';
        
        toolContents.forEach(content => content.classList.remove('active'));
        navLinks.forEach(link => link.classList.remove('active'));

        const targetContent = document.getElementById(toolId);
        const targetLink = document.querySelector(`.nav-link[data-tool="${toolName}"]`);
        
        if (targetContent) targetContent.classList.add('active');
        if (targetLink) targetLink.classList.add('active');
        
        if (window.SubTools && typeof window.SubTools[toolName]?.init === 'function') {
            window.SubTools[toolName].init(toolId);
            activeToolName = toolName;
        } else {
            console.warn(`Initialization script for tool "${toolName}" not found.`);
            activeToolName = null;
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const toolName = link.getAttribute('data-tool');
            if (toolName) showTool(toolName);
        });
    });

    const defaultActiveLink = document.querySelector('.nav-link.active');
    if (defaultActiveLink) {
        const defaultToolName = defaultActiveLink.getAttribute('data-tool');
        showTool(defaultToolName);
    }
});
