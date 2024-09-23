from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/recommendations', methods=['POST'])
def recommend():
    data = request.get_json()
    mcq_score = data.get('mcqScore')
    project_score = data.get('projectScore')

    # Dummy recommendation logic based on scores
    recommendations = {
        "courseFocus": "Advanced Topics" if mcq_score > 70 else "Fundamentals",
        "mcqFocus": "Practice more MCQs" if mcq_score < 50 else "Review advanced concepts",
        "projectFocus": "Focus on project documentation" if project_score < 60 else "Enhance code quality",
        "batchStrategy": "Join a study group for peer support"
    }

    return jsonify(recommendations)

if __name__ == '__main__':
    app.run(port=5000)
