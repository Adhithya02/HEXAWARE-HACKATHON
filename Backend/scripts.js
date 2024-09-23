document.addEventListener('DOMContentLoaded', () => {
    const progressForm = document.getElementById('progress-form');
    const recommendationsDiv = document.getElementById('recommendations');

    // Handle form submission
    progressForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Get form values
        const candidateName = document.getElementById('candidate-name').value;
        const courseCompletion = parseFloat(document.getElementById('course-completion').value);
        const mcqScore = parseInt(document.getElementById('mcq-score').value);
        const projectScore = parseInt(document.getElementById('project-score').value);

        // Prepare the data to send
        const data = {
            candidateName,
            courseCompletion,
            mcqScore,
            projectScore
        };

        // Send the data to the backend
        fetch('/update-progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            // Display the recommendations
            displayRecommendations(data);
        })
        .catch(error => {
            console.error('Error:', error);
            recommendationsDiv.innerHTML = `<p>Error fetching recommendations. Please try again later.</p>`;
        });
    });

    // Function to display recommendations
    function displayRecommendations(data) {
        const { recommendations } = data;
        recommendationsDiv.innerHTML = `
            <p><strong>Personalized Learning Path:</strong> ${recommendations.courseFocus || 'N/A'}</p>
            <p><strong>MCQ Improvement:</strong> ${recommendations.mcqFocus || 'N/A'}</p>
            <p><strong>Project Improvement:</strong> ${recommendations.projectFocus || 'N/A'}</p>
            <p><strong>Batch-Specific Improvement Strategy:</strong> ${recommendations.batchStrategy || 'N/A'}</p>
        `;
    }
});
