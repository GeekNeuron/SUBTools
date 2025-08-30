// Main Hub Script for Sub Tools

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const toolContents = document.querySelectorAll('.tool-content');
    let activeToolName = null; // To keep track of the currently active tool's script

    /**
     * Shows a specific tool and initializes its script.
     * It also cleans up the previously active tool.
     * @param {string} toolId The ID of the tool's container div (e.g., 'coordinator-tool').
     */
    function showTool(toolId) {
        // --- 1. Cleanup the previously active tool ---
        if (activeToolName && window.SubTools && typeof window.SubTools[activeToolName]?.destroy === 'function') {
            window.SubTools[activeToolName].destroy();
        }

        // --- 2. Update the UI ---
        // Hide all tool content divs
        toolContents.forEach(content => content.classList.remove('active'));
        // Deactivate all navigation links
        navLinks.forEach(link => link.classList.remove('active'));

        // Show the target tool's content and activate its link
        const targetContent = document.getElementById(toolId);
        const targetLink = document.querySelector(`.nav-link[data-tool="${toolId}"]`);
        
        if (targetContent) targetContent.classList.add('active');
        if (targetLink) targetLink.classList.add('active');
        
        // --- 3. Initialize the new tool's script ---
        // Extract the tool's name from its ID (e.g., 'coordinator-tool' -> 'coordinator')
        const toolName = toolId.split('-')[0];
        if (window.SubTools && typeof window.SubTools[toolName]?.init === 'function') {
            // Call the init method, passing the container ID
            window.SubTools[toolName].init(toolId);
            activeToolName = toolName; // Set the new active tool
        } else {
            console.warn(`No init method found for tool: ${toolName}`);
            activeToolName = null;
        }
    }

    // Add click event listeners to all navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const toolId = link.getAttribute('data-tool');
            if (toolId) {
                showTool(toolId);
            }
        });
    });

    // --- Initialize the default tool on page load ---
    // The default tool is the one that has the 'active' class in the HTML
    const defaultActiveLink = document.querySelector('.nav-link.active');
    if (defaultActiveLink) {
        const defaultToolId = defaultActiveLink.getAttribute('data-tool');
        showTool(defaultToolId);
    } else {
        // Fallback if no tool is marked as active in the HTML
        console.warn("No default active tool found. Please add the 'active' class to a nav link in index.html.");
    }
});
