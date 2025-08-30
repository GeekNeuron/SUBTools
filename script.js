document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const toolContents = document.querySelectorAll('.tool-content');

    // Set the first tool as active by default
    showTool('coordinator-tool');

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            
            const toolId = link.getAttribute('data-tool');
            showTool(toolId);
        });
    });

    function showTool(toolId) {
        // Hide all tools
        toolContents.forEach(content => {
            content.classList.remove('active');
        });

        // Deactivate all nav links
        navLinks.forEach(link => {
            link.classList.remove('active');
        });

        // Show the selected tool and activate its link
        document.getElementById(toolId).classList.add('active');
        document.querySelector(`.nav-link[data-tool="${toolId}"]`).classList.add('active');
    }
});
